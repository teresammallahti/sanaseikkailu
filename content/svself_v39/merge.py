import csv,glob,collections,json,re,sys
sys.path.insert(0,'../tools'); import datamodel as dm
M=dm.load('../data'); S=M['self']; LV={'A1':0,'A2':1,'B1':2}
tlev={t['id']:LV[t['level']] for t in S['topics']}; torder={t['id']:i for i,t in enumerate(S['topics'])}
rows=[]
for f in sorted(glob.glob('out_*.tsv')):
    r=list(csv.reader(open(f),delimiter='\t',quoting=csv.QUOTE_NONE)); h=r[0]
    for i,x in enumerate(r[1:]):
        if any(x): d={k:v.strip() for k,v in zip(h,x)}; d['_k']=(tlev[d['topic']],torder[d['topic']],f,i); rows.append(d)
import re as _re
main=lambda x:x.split(' / ')[0].strip().lower()
norm=lambda x:_re.sub(r'^(en|ett) ','',_re.sub(r'[?!.,…]','',main(x))).strip()
strip=lambda x:_re.sub(r'[?!.,…]','',re.sub(r'\s*\(.*?\)','',main(x))).strip()
par=list(range(len(rows)))
def find(a):
    while par[a]!=a: par[a]=par[par[a]]; a=par[a]
    return a
def uni(a,b): par[find(a)]=find(b)
by=collections.defaultdict(list)
for i,d in enumerate(rows):
    if d['id']: by[('id',d['id'])].append(i)
    by[('svfi',norm(d['sv']),d['pos'],strip(d['fi']))].append(i)
    if d['en']: by[('sven',norm(d['sv']),d['pos'],d['en'].lower())].append(i)
for i,d in enumerate(rows):
    if d['en']: by[('fien',strip(d['fi']),d['pos'],d['en'].lower())].append(i)
for v in by.values():
    for j in v[1:]: uni(v[0],j)
groups=collections.defaultdict(list)
for i in range(len(rows)): groups[find(i)].append(i)
print('rows',len(rows),'concepts',len(groups))
json.dump([[rows[i] for i in sorted(g,key=lambda i:rows[i]['_k'])] for g in groups.values()],open('groups.json','w'),ensure_ascii=False)
