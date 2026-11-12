import json,sys,collections
sys.path.insert(0,'../tools'); import datamodel as dm
D='../data'; M=dm.load(D); X=json.load(open('merged.json'))
sv=X['sv']; topics=X['topics']; newc={c['id']:c for c in X['new_concepts']}
def drop(cid, into=None, add_sv=None):
    for t in topics.values():
        if cid in t: t.remove(cid)
    newc.pop(cid,None); sv.pop(cid,None)
    if into and add_sv: sv[into]['text']+=' / '+add_sv
drop('s_b1_right_of_public_access','s_a2_everyman_s_right','allemansrätten')
drop('s_a2_luckily'); drop('s_a2_take_medicine'); drop('s_a2_visit')
FI={'s_a2_spectator':'katsoja (yleisö, esim. ottelussa)','s_b1_viewer':'katsoja (tv:n)',
 's_b1_probationary_period':'koeaikainen työsuhde / koeaika (työsuhteena)',
 'verbs1_4_touch':'koskettaa / koskea (kädellä)','s_b1_apply':'olla voimassa / koskea (jotakuta)',
 's_b1_consider_be_of_the_opinion':'katsoa (olevan) / olla jotakin mieltä (muodollinen)',
 's_b1_get_in_touch':'antaa kuulua itsestään / ottaa yhteyttä (puhek.)',
 's_a1_capable_good_at_sth':'reipas / taitava / hyvä (jossakin)','personality_kind':'kiltti / ystävällinen'}
for cid,fi in FI.items():
    if cid in newc: newc[cid]['fi']=fi
    else: sv[cid]['fi']=fi
# write concepts
C=M['concepts']; byid={c['id']:c for c in C}
for cid,p in X['pos'].items():
    if cid in byid and p: byid[cid]['pos']=p
for t in topics.values():
    for cid in t:
        if cid in byid and not byid[cid].get('pos'):
            pass
C+=list(newc.values())
dm.dump_lines('concepts',C,f'{D}/concepts.json')
F=json.load(open(f'{D}/forms/sv.json'))
F['forms'].update(sv)
dm.dump_lines('forms',F['forms'],f'{D}/forms/sv.json',meta=F['meta'])
S=json.load(open(f'{D}/self.json'))
for t in S['topics']: t['concepts']=topics.get(t['id'],[])
S['status']='draft (Opus-luonnos vaihe 39; Fable-tarkistus odottaa)'
open(f'{D}/self.json','w').write(json.dumps(S,ensure_ascii=False,indent=1)+'\n')
print('new',len(newc),'sv forms',len(F['forms']),'self concepts',sum(len(t['concepts']) for t in S['topics']))
