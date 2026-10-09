"""Rebuild the public aggregate snapshot. Requires pypdf and openpyxl.

Original documents are cached locally and excluded from Git. No personal data.
Run from the repository root: python scripts/prepare-cesar-statistics.py
"""
import csv
import hashlib
import io
import json
import pathlib
import re
import unicodedata
import urllib.request
from collections import defaultdict
from pypdf import PdfReader
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.data-cache'
CACHE.mkdir(exist_ok=True)
RNEC_URL = 'https://wapp.registraduria.gov.co/electoral/2026/congreso-de-la-republica/IMG/pdf/Divipole_definitiva_%20Elecciones_Congreso_2026_GEO_CITREP_Exterior_L_V_v5.pdf'
DANE_URL = 'https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx'

def fetch(name, url):
    path = CACHE / name
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return path

def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.upper()) if not unicodedata.combining(c))

rows = []
def record(municipality, year, metric, value, source, url, reference_date):
    rows.append(dict(municipality=municipality, year=year, metric=metric, group='', value=value, level='', source=source, url=url, referenceDate=reference_date, provenance='oficial'))

dane_path = fetch('dane-area.xlsx', DANE_URL)
book = openpyxl.load_workbook(dane_path, read_only=True, data_only=True)
municipalities = set()
totals = defaultdict(int)
for dp, department, code, municipality, year, area, value in book.worksheets[2].iter_rows(min_row=10, values_only=True):
    if str(dp) != '20' or year not in [2023, 2026, 2027]:
        continue
    metric = {'Total': 'poblacion', 'Cabecera Municipal': 'poblacion_urbana', 'Centros Poblados y Rural Disperso': 'poblacion_rural'}[area]
    municipalities.add(municipality)
    record(municipality, year, metric, value, 'DANE · Proyecciones municipales por área, actualización 2025', DANE_URL, '2025-08-08')
    totals[year, metric] += value
assert len(municipalities) == 25, f'DANE: expected 25 municipalities, got {len(municipalities)}'
for (year, metric), value in totals.items():
    record('Cesar', year, metric, value, 'DANE · Proyecciones municipales por área, actualización 2025', DANE_URL, '2025-08-08')
book.close()

census_path = fetch('divipole-congreso-2026.pdf', RNEC_URL)
reader = PdfReader(census_path)
# This specific published PDF has 323 pages. Cesar occurs on pages 90–97.
# The document digest below makes a replacement detectable. Coverage and arithmetic
# checks fail instead of silently accepting an incomplete extraction.
assert len(reader.pages) == 323, 'Divipole layout changed: review page range before regenerating.'
text_cache = CACHE / 'cesar-pages.json'
digest = hashlib.sha256(census_path.read_bytes()).hexdigest()
cached = json.loads(text_cache.read_text(encoding='utf-8')) if text_cache.exists() else {}
if cached.get('sha256') != digest:
    cached = dict(sha256=digest, pages=[reader.pages[index].extract_text() for index in range(89, 101)])
    text_cache.write_text(json.dumps(cached, ensure_ascii=False), encoding='utf-8')
census = defaultdict(lambda: [0, 0, 0, 0])
station_ids = set()
pages_used = set()
names = sorted(municipalities, key=len, reverse=True)
aliases = {'MANAURE': 'Manaure Balcón del Cesar'}
for index, text in enumerate(cached['pages'], start=89):
    blocks = re.split(r'(?m)(?=^\d{2} \d{3} \d{2} \d{2} )', text)
    for block in blocks:
        flat = re.sub(r'\s+', ' ', block).strip()
        head = re.match(r'12 (\d{3}) (\d{2}) (\d{2}) CESAR (.*)', flat)
        if not head:
            continue
        body = head[4]
        municipality = next((name for name in names if body.startswith(normalize(name))), None)
        if municipality is None:
            municipality = next((name for alias, name in aliases.items() if body.startswith(alias + ' ')), None)
        assert municipality, f'Unknown municipality in row: {flat}'
        numbers = re.search(r' (\d+) (\d+) (\d+) (\d+) (-?\d+\.\d+) (-?\d+\.\d+)', body)
        assert numbers, f'Unparsed census values: {flat}'
        women, men, total, tables = map(int, numbers.groups()[:4])
        assert women + men == total, f'Census row does not reconcile: {flat}'
        station_id = tuple(head[i] for i in [1, 2, 3])
        assert station_id not in station_ids, f'Duplicate station {station_id}'
        station_ids.add(station_id)
        pages_used.add(index + 1)
        census[municipality] = [a + b for a, b in zip(census[municipality], [women, men, total, tables])]
assert set(census) == municipalities, f'Incomplete census coverage: {municipalities - set(census)}'
census['Cesar'] = [sum(counts[i] for counts in census.values()) for i in range(4)]
for municipality, counts in census.items():
    for metric, value in zip(['electoras', 'electores', 'censo', 'mesas'], counts):
        record(municipality, 2026, metric, value, 'RNEC · Divipole definitiva Congreso 2026 (fecha de elección; corte no indicado)', RNEC_URL, '2026-03-08')

out = ROOT / 'src' / 'data' / 'cesarStatistics.json'
out.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
evidence = dict(sources=[dict(url=url, sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for url, path in [(RNEC_URL, census_path), (DANE_URL, dane_path)]], censusPages=sorted(pages_used), stations=len(station_ids), municipalities=25, rows=len(rows), astreaCensus=census['Astrea'][2], cesarCensus=census['Cesar'][2])
(ROOT / 'docs' / 'statistics-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(evidence, indent=2), flush=True)
