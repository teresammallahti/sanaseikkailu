"""Vaihe 43: sanakirjaston laajennus.
1) Englanti ja saksa itseopiskelun käsitteille (lex40/ende_out_*.tsv).
2) Uudet käsitteet Kotuksen yleisimmistä perusmuodoista (lex40/new_*.tsv): fi + sv + en + de, tasot A1-B2.
3) Itseopiskeluun lisätyt muodot koulun käsitteillä merkitään self_only (eivät näy peruskoulussa).
4) Käsitteille yleisyys zipf_fi (wordfreq).
"""
import csv, glob, json, re, sys, collections, unicodedata
from pathlib import Path
import wordfreq
sys.path.insert(0, str(Path(__file__).parent)); import datamodel as dm
ROOT = Path(__file__).resolve().parent.parent; D = ROOT / "data"; L = Path(sys.argv[1])
cj = json.load(open(D / "concepts.json")); C = {c["id"]: c for c in cj["concepts"]}
F = {l: json.load(open(D / f"forms/{l}.json")) for l in ("en", "de", "sv")}
S = json.load(open(D / "self.json"))
v17 = json.load(open(ROOT / "en_1_9lk_v17.json"))
SCHOOL = {l: {w["id"] for w in v17["words"] if w.get(l) and not (l == "en" and w.get("de_only"))} for l in ("en", "de", "sv")}
def rd(f): return list(csv.DictReader(open(f), delimiter="\t", quoting=csv.QUOTE_NONE))
def infl(s):
    out = {}
    for kv in (s or "").split(";"):
        if "=" in kv:
            k, v = kv.split("=", 1); k, v = k.strip(), v.strip()
            if v and v not in ("-", "–"): out[k] = v
    return out
st = collections.Counter()
# 1) en/de olemassa oleville
for f in sorted(glob.glob(str(L / "ende_out_*.tsv"))):
    for r in rd(f):
        cid = r["id"]; c = C[cid]
        for lang in ("en", "de"):
            txt = r[lang].strip(); inf = infl(r[f"{lang}_infl"])
            forms = F[lang]["forms"]
            if not txt: continue
            if cid in forms:
                fm = forms[cid]
                for k, v in inf.items():
                    if k not in fm: fm[k] = v; st[f"{lang}_infl_added"] += 1
            else:
                if lang == "en" and c.get("cat") and cid not in F["en"]["forms"] and c.get("en_ref") and cid not in SCHOOL["en"] and not cid.startswith("s_"):
                    pass
                fm = {"text": txt}; fm.update(inf); forms[cid] = fm; st[f"{lang}_new"] += 1
# 2) uudet käsitteet
B2 = json.load(open(L / "b2_topics.json"))
if not any(l["id"] == "B2" for l in S["levels"]):
    S["levels"].append({"id": "B2", "name_fi": "B2 – Itsenäinen kielenkäyttäjä (vahva)", "goal_fi": "Ymmärtää monipuolisia tekstejä ja keskusteluja yhteiskunnasta, työstä ja kulttuurista; ilmaisee itseään sujuvasti ja täsmällisesti myös abstrakteista aiheista."})
    for i, n in B2: S["topics"].append({"id": i, "name_fi": n, "level": "B2", "target": 0, "scope_fi": "", "concepts": []})
T = {t["id"]: t for t in S["topics"]}
used = set(C)
def slug(s):
    s = unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")[:30] or "x"
for f in sorted(glob.glob(str(L / "new_*.tsv"))):
    for r in rd(f):
        if r["keep"] != "1": st["skipped"] += 1; continue
        t = T.get(r["topic"])
        if not t or t["level"] != r["level"]:
            # korjaa: valitse saman tason yleisaihepiiri
            t = T.get({"A1": "a1_core", "A2": "a2_describe", "B1": "b1_abstract", "B2": "b2_abstract"}[r["level"]]); st["topic_fixed"] += 1
        base = "k_" + slug(re.sub(r"\s*\(.*?\)", "", r["fi"].split(" / ")[0]) or r["fi_lemma"]); cid = base; n = 2
        while cid in used: cid = f"{base}_{n}"; n += 1
        used.add(cid)
        c = {"id": cid, "fi": r["fi"].strip(), "pos": r["pos"].strip(), "kotus": r["fi_lemma"]}
        C[cid] = c; cj["concepts"].append(c)
        for lang in ("sv", "en", "de"):
            if r[lang].strip():
                fm = {"text": r[lang].strip()}; fm.update(infl(r[f"{lang}_infl"])); F[lang]["forms"][cid] = fm
        t["concepts"].append(cid); st["new_concepts"] += 1
# 3) self_only-merkintä koulun käsitteiden itseopiskelumuodoille
for lang in ("en", "de", "sv"):
    for cid, fm in F[lang]["forms"].items():
        c = C[cid]
        if c.get("cat") and cid not in SCHOOL[lang] and not fm.get("self_only"):
            # vaiheissa 33-37 lisätyt kouluaineistot (v17:n jälkeen ei kouluun lisätty muotoja)
            fm["self_only"] = True; st[f"{lang}_self_only"] += 1
# 4) yleisyys
for c in cj["concepts"]:
    w = re.sub(r"\s*\(.*?\)", "", c["fi"].split(" / ")[0]).strip().lower()
    c["zipf_fi"] = round(wordfreq.zipf_frequency(w, "fi"), 2)
S["languages"] = ["sv"]; S["languages_ready"] = ["en", "de"]  # en/de käyttöön Fable-tarkistuksen jälkeen
S["status"] = "sv A1-B1 Fable-tarkistettu (v40); en/de ja B2-laajennus Opus-luonnos (v43), Fable-tarkistus odottaa"
dm.dump_lines("concepts", cj["concepts"], D / "concepts.json")
for l in F: dm.dump_lines("forms", F[l]["forms"], D / f"forms/{l}.json", meta=F[l]["meta"])
(D / "self.json").write_text(json.dumps(S, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(dict(st))
# Jälkikorjaus (ajettu erikseen): kaksoiskäsitteet, joiden kehote on jo olemassa olevalla käsitteellä.
DUP = ["k_olla_oikeassa", "k_minun_mielestani", "k_menna_kihloihin", "k_menna_naimisiin"]
