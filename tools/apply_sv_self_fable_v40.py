"""Vaihe 40: ruotsin itseopiskelusanaston Fable-tarkistuksen korjaukset (fable39/fix_b*.json)."""
import json, sys, glob, collections
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import datamodel as dm
ROOT = Path(__file__).resolve().parent.parent; D = ROOT / "data"; R = Path(sys.argv[1])
cj = json.load(open(D / "concepts.json")); C = {c["id"]: c for c in cj["concepts"]}
F = json.load(open(D / "forms/sv.json")); SV = F["forms"]
S = json.load(open(D / "self.json")); T = {t["id"]: t for t in S["topics"]}
INF = ("def", "pl", "pres", "pret", "sup", "neut", "apl")
stat = collections.Counter(); skipped = []
for fp in sorted(glob.glob(str(R / "fix_b*.json"))):
    for x in json.load(open(fp)):
        cid, fld, old, new = x["id"], x["field"], x.get("old"), x.get("new")
        if cid not in SV: skipped.append((cid, fld, "ei sv-muotoa")); continue
        f, c = SV[cid], C[cid]
        if fld == "sv":
            if f["text"] != old: skipped.append((cid, fld, "old ei täsmää")); continue
            f["text"] = new
        elif fld == "fi":
            cur = f.get("fi", c["fi"])
            if cur != old: skipped.append((cid, fld, "old ei täsmää")); continue
            if "fi" in f or c.get("cat"): f["fi"] = new
            else: c["fi"] = new
        elif fld in INF:
            if (f.get(fld) or "") != (old or ""): skipped.append((cid, fld, "old ei täsmää")); continue
            if new and new not in ("-", "–"): f[fld] = new
            else: f.pop(fld, None)
        elif fld == "topic":
            for t in S["topics"]:
                if cid in t["concepts"]: t["concepts"].remove(cid)
            T[new]["concepts"].append(cid)
        elif fld == "delete":
            for t in S["topics"]:
                if cid in t["concepts"]: t["concepts"].remove(cid)
        else:
            skipped.append((cid, fld, "tuntematon kenttä")); continue
        stat[fld] += 1
dm.dump_lines("concepts", cj["concepts"], D / "concepts.json")
dm.dump_lines("forms", SV, D / "forms/sv.json", meta=F["meta"])
S["status"] = "Opus-luonnos (vaihe 39) + Fable-tarkistus (vaihe 40)"
(D / "self.json").write_text(json.dumps(S, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(dict(stat), "ohitettu", len(skipped)); [print(" ", s) for s in skipped]
# Jälkikorjaukset (ajettu käsin vaiheessa 40): kehotetörmäykset hauska/taitava/painaa,
# de_k1_richtig pois itseopiskelusta (sama merkitys kuin s_a1_right_correct).
