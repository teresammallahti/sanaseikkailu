"""Vaihe 46: Fable-tarkistuksen korjaukset sanakirjastoon (fable43/fix_*.json) ja itseopiskelun virkkeisiin/dialogeihin (sent45/fix_*.json)."""
import json, sys, glob, collections, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent)); import datamodel as dm
ROOT = Path(__file__).resolve().parent.parent; D = ROOT / "data"
cj = json.load(open(D / "concepts.json")); C = {c["id"]: c for c in cj["concepts"]}
F = {l: json.load(open(D / f"forms/{l}.json")) for l in ("sv", "en", "de")}
S = json.load(open(D / "self.json")); TOP = {t["id"]: t for t in S["topics"]}
INF = dm.INFL + ("pl",)
FALLBACK = {"A1": "a1_core", "A2": "a2_describe", "B1": "b1_abstract", "B2": "b2_abstract"}
def infl_str(f): return ";".join(f"{k}={f[k]}" for k in ("def","pl","pres","pret","sup","neut","apl","past","pp","pres3") if f.get(k))
st = collections.Counter(); skip = []
for fp in sorted(glob.glob(str(ROOT / "fable43/fix_*.json"))):
    for x in json.load(open(fp)):
        cid, fld, old, new = x["id"], x["field"], x.get("old", ""), x.get("new", "")
        c = C.get(cid)
        if not c: skip.append((cid, fld, "ei käsitettä")); continue
        if fld == "fi":
            if c.get("cat"):
                langs = ["en", "de"] if "ende" in fp else ["sv", "en", "de"]
                for l in langs:
                    if cid in F[l]["forms"]: F[l]["forms"][cid]["fi"] = new
            else:
                c["fi"] = new
                for l in F:
                    F[l]["forms"].get(cid, {}).pop("fi", None)
        elif fld.endswith("_text"):
            l = fld[:2]; f = F[l]["forms"].get(cid)
            if f is None: F[l]["forms"][cid] = {"text": new}; st["new_form"] += 1
            elif f["text"] != old: skip.append((cid, fld, "old ei täsmää")); continue
            else: f["text"] = new
        elif fld.endswith("_infl"):
            l = fld[:2]; f = F[l]["forms"].setdefault(cid, {"text": ""})
            for k in INF: f.pop(k, None)
            for kv in new.split(";"):
                if "=" in kv:
                    k, v = [s.strip() for s in kv.split("=", 1)]
                    if v and v not in ("-", "–"): f[k] = v
        elif fld == "taso":
            cur = [t for t in S["topics"] if cid in t["concepts"]]
            for t in cur: t["concepts"].remove(cid)
            TOP[FALLBACK[new]]["concepts"].append(cid)
        elif fld == "delete":
            for t in S["topics"]:
                if cid in t["concepts"]: t["concepts"].remove(cid)
        else:
            skip.append((cid, fld, "tuntematon")); continue
        st[fld] += 1
print("sanasto", dict(st), "ohitettu", len(skip)); [print(" ", s) for s in skip[:20]]
dm.dump_lines("concepts", cj["concepts"], D / "concepts.json")
for l in F: dm.dump_lines("forms", F[l]["forms"], D / f"forms/{l}.json", meta=F[l]["meta"])
(D / "self.json").write_text(json.dumps(S, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
# virkkeet ja dialogit
A = json.load(open(ROOT / "sent45/all.json"))
SID = {r["id"]: r for r in A["sentences"]}; DID = {r["id"]: r for r in A["dialogues"]}
st2 = collections.Counter(); skip2 = []
for fp in sorted(glob.glob(str(ROOT / "sent45/fix_*.json"))):
    for x in json.load(open(fp)):
        rid, fld, old, new = x["id"], x["field"], x.get("old"), x.get("new")
        r = SID.get(rid) or DID.get(rid)
        if not r: skip2.append((rid, "ei riviä")); continue
        if fld == "title_fi":
            topic = r["topic"]
            for d in A["dialogues"]:
                if d["topic"] == topic: d["title_fi"] = new
        else:
            if (r.get(fld) or "") != (old or ""): skip2.append((rid, fld, "old ei täsmää")); continue
            r[fld] = new or ""
        st2[fld] += 1
for r in A["sentences"]:
    r["fi"] = re.sub(r"\s*\|+\s*$", "", r["fi"]).strip()
json.dump(A, open(ROOT / "sent45/all.json", "w"), ensure_ascii=False)
print("virkkeet", dict(st2), "ohitettu", len(skip2)); [print(" ", s) for s in skip2[:20]]
# Jälkikorjaukset (ajettu erikseen): koulun englannin sulkutarkenteet palautettu (orange (hedelmä/väri),
# Finnish (kansalaisuus), letter (kirje)); en/de-kehotteet personality_kind = "kiltti / ystävällinen",
# relationships_7_trust = "luottamus" (sama kuin ruotsissa).
