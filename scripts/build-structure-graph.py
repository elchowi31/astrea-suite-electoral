"""Local structural fallback: source imports and explicit Markdown links, no semantic claims."""
from pathlib import Path
import re, json, collections, html

root = Path(__file__).resolve().parents[1]
out = root / 'graphify-out'
out.mkdir(exist_ok=True)
files = sorted(p for d in ('src','api','tests','docs') for p in (root/d).rglob('*') if p.suffix in ('.ts','.tsx','.md','.json'))
nodes = [{'id':p.relative_to(root).as_posix(),'kind':p.relative_to(root).parts[0]} for p in files]
known = {n['id'] for n in nodes}
edges = set()
for p in files:
    text = p.read_text(encoding='utf-8-sig')
    refs = re.findall(r'''(?:from\s*|import\s*)['"](\.[^'"]+)['"]''',text) if p.suffix != '.md' else re.findall(r'\]\(([^)#]+)',text)
    for ref in refs:
        if ref.startswith(('http:','https:','C:','D:')): continue
        target = p.parent/ref
        candidates = [target,Path(str(target)+'.ts'),Path(str(target)+'.tsx'),target/'index.ts']
        if target.suffix == '.js': candidates.insert(0,target.with_suffix('.ts'))
        for candidate in candidates:
            try: key=candidate.resolve().relative_to(root).as_posix()
            except ValueError: continue
            if key in known:
                edges.add((p.relative_to(root).as_posix(),key));break
degree=collections.Counter(t for s,t in edges)
data={'mode':'structural-fallback','date':'2026-11-14','scope':['src','api','tests','docs'],'limitations':['Imports and explicit file links only; not native semantic Graphify output.','Paths are repository-relative; source data and credentials are excluded.'],'nodes':nodes,'edges':[{'source':s,'target':t,'kind':'explicit-reference'} for s,t in sorted(edges)]}
(out/'graph.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
lines=['# Astrea — grafo estructural de respaldo','','Packet: repo-structure-packet. Modo: structural-fallback.','',f'{len(nodes)} archivos; {len(edges)} referencias explícitas. Alcance: src, api, tests y docs.','', 'Se revisó el grafo original del 11 de noviembre (436 nodos y 1.416 relaciones). Este respaldo actualizado registra referencias de archivos; no sustituye su análisis semántico ni acredita funcionamiento en producción.','','## Dependencias con más referencias','', '| Archivo | Referencias entrantes |','| --- | --- |']
lines += [f'| `{name}` | {count} |' for name,count in degree.most_common(20)]
lines += ['','## Recorridos de revisión','','- Navegación: App → moduleNavigation/useModuleNavigation → Sidebar/PageNavigation.','- Finanzas: FinancesView y CampaignCostsReportView → tipos y persistencia; unificar con serviceCosts.','- Datos: formularios → firebase/recordEditing → offlineMutations → reglas y auditoría.','- Operación: OperationsProvider → stores transaccionales → reglas → pruebas de concurrencia.','','Consultar graph.html por nombre de archivo; graph.json conserva las referencias para refrescos posteriores.']
(out/'GRAPH_REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
payload=json.dumps(data,ensure_ascii=False).replace('<','\\u003c')
page='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Grafo estructural Astrea</title><style>body{font:16px system-ui;background:#0b1220;color:#dbeafe;max-width:1000px;margin:40px auto;padding:20px}input{font:inherit;padding:12px;width:90%}li{margin:10px}a{color:#67e8f9}small{color:#94a3b8}button{font:inherit;background:#1e293b;color:white;padding:10px;border:1px solid #475569;cursor:pointer}</style><h1>Astrea · relaciones de archivos</h1><p>Grafo estructural de respaldo. Referencias explícitas; no extracción semántica de Graphify.</p><label>Buscar archivo <input id="q" placeholder="FinancesView, offlineMutations…"></label><p id="summary"></p><ul id="results"></ul><section id="detail" aria-live="polite"></section><script>const graph=PAYLOAD;const q=document.querySelector('#q'),list=document.querySelector('#results'),detail=document.querySelector('#detail');document.querySelector('#summary').textContent=graph.nodes.length+' archivos · '+graph.edges.length+' referencias';function show(id){detail.replaceChildren();const title=document.createElement('h2');title.textContent=id;detail.append(title);for(const direction of ['source','target']){const h=document.createElement('h3');h.textContent=direction==='source'?'Utiliza':'Referenciado por';detail.append(h);const ul=document.createElement('ul');graph.edges.filter(e=>e[direction]===id).forEach(e=>{const li=document.createElement('li'),b=document.createElement('button');b.textContent=e[direction==='source'?'target':'source'];b.onclick=()=>show(b.textContent);li.append(b);ul.append(li)});detail.append(ul)}}function render(){list.replaceChildren();graph.nodes.filter(n=>n.id.toLowerCase().includes(q.value.toLowerCase())).slice(0,60).forEach(n=>{const li=document.createElement('li'),b=document.createElement('button');b.textContent=n.id;b.onclick=()=>show(n.id);li.append(b);list.append(li)})}q.oninput=render;render();</script></html>'''.replace('PAYLOAD',payload)
(out/'graph.html').write_text(page,encoding='utf-8')
print(json.dumps({'mode':data['mode'],'nodes':len(nodes),'edges':len(edges),'output':str(out)}))
