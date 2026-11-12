import json,re,collections,sys,unicodedata
sys.path.insert(0,'../tools'); import datamodel as dm
M=dm.load('../data'); G=json.load(open('groups.json'))
C={c['id']:c for c in M['concepts']}; SV=M['forms']['sv']
main=lambda x:x.split(' / ')[0].strip().lower()
alts=lambda x:[a.strip() for a in x.split(' / ') if a.strip()]
strip=lambda x:re.sub(r'\s*\(.*?\)','',main(x)).strip()
INF=('pl','def','pres','pret','sup','neut','apl')
def slug(s):
    s=unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z0-9]+','_',s).strip('_')[:30] or 'x'
def union(vals):
    out=[]
    for v in vals:
        for a in alts(v):
            if a.lower() not in [o.lower() for o in out]: out.append(a)
    return ' / '.join(out)
used=set(C); new_concepts=[]; sv_upd={}; topics=collections.defaultdict(list); stats=collections.Counter()
for g in G:
    p=g[0]; eid=next((r['id'] for r in g if r['id']),None)
    infl={k:p[k] for k in INF if p.get(k) and p[k] not in ('-','–')}
    svtext=union([r['sv'] for r in g]); fitext=union([r['fi'] for r in g])
    if eid and eid in SV:
        ex=[a.lower() for a in alts(SV[eid]['text'])]
        if main(p['sv']) in ex:
            f=dict(SV[eid]); f.update({k:v for k,v in infl.items() if k not in f}); sv_upd[eid]=f
            if not C[eid].get('pos'): C[eid]['pos']=p['pos']
            topics[p['topic']].append(eid); stats['existing_sv']+=1; continue
        eid=None; stats['existing_conflict_new']+=1
    if eid:
        f={'text':svtext}; f.update(infl)
        if strip(fitext)!=strip(C[eid]['fi']): f['fi']=fitext
        sv_upd[eid]=f
        if not C[eid].get('pos'): C[eid]['pos']=p['pos']
        topics[p['topic']].append(eid); stats['existing_new_sv']+=1; continue
    base=f"s_{p['topic'].split('_',1)[0]}_{slug(p['en'] or main(p['sv']))}"; cid=base; n=2
    while cid in used: cid=f"{base}_{n}"; n+=1
    used.add(cid)
    c={'id':cid,'fi':fitext,'pos':p['pos']}
    if p['en']: c['en_ref']=p['en']
    new_concepts.append(c); f={'text':svtext}; f.update(infl); sv_upd[cid]=f
    topics[p['topic']].append(cid); stats['new']+=1
print(stats)
json.dump({'new_concepts':new_concepts,'sv':sv_upd,'topics':topics,'pos':{k:C[k].get('pos') for k in C if C[k].get('pos')}},open('merged.json','w'),ensure_ascii=False)
# prompt collisions within self pool
shown=collections.defaultdict(list)
allc={**C,**{c['id']:c for c in new_concepts}}
for t,ids in topics.items():
    for cid in ids:
        fi=sv_upd[cid].get('fi') or allc[cid]['fi']
        shown[main(fi)].append((cid,t,sv_upd[cid]['text']))
col={k:v for k,v in shown.items() if len(v)>1}
print('prompt collisions',len(col))
with open('collisions.tsv','w') as fh:
    fh.write('shown_fi\tid\ttopic\tfi_full\tsv\n')
    for k,v in sorted(col.items()):
        for cid,t,sv in v: fh.write(f"{k}\t{cid}\t{t}\t{sv_upd[cid].get('fi') or allc[cid]['fi']}\t{sv}\n")
print(sum(len(v) for v in topics.values()), {t:len(v) for t,v in list(topics.items())[:5]})
