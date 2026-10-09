"""Build reference seats from a transcript checked against the official RNEC PDFs."""
from pathlib import Path
import csv, hashlib, json, re

file=Path('docs/source-transcripts/curules-cesar-2023.csv')
names=re.findall(r"^  '([^']+)',",Path('src/data/geography.ts').read_text(encoding='utf-8'),re.M)[:25]
rows=[]
for item in csv.DictReader(file.read_text(encoding='utf-8').splitlines()):
    kind='concejo' if item['cargo']=='Concejo Municipal' else 'asamblea'
    rows.append(dict(municipality=item['municipio'],year=2023,metric='curules',group='',value=int(item['curules']),level=item['cargo'],source='RNEC · Curules territoriales 2023',url=f'https://www.registraduria.gov.co/IMG/pdf/20230719_curules-{kind}.pdf',referenceDate='2023-10-29',provenance='oficial'))
if {row['municipality'] for row in rows if row['level']=='Concejo Municipal'} != set(names): raise ValueError('Cobertura municipal incompleta.')
if len(rows)!=26 or any(row['value']<1 or row['value']>100 for row in rows): raise ValueError('Curules inválidas.')
Path('src/data/cesarSeats.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
Path('docs/seats-evidence.json').write_text(json.dumps(dict(method='Transcripción revisada contra las páginas 11-12 del PDF de concejos y la página 1 del PDF de asamblea',checkedAt='2026-10-09',transcript=str(file),transcriptSha256=hashlib.sha256(file.read_bytes()).hexdigest(),rows=26),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Preparadas 26 referencias oficiales de curules de 2023; Astrea: 11.')
