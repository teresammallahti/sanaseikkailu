#!/usr/bin/env python3
"""Tietomalli v2:n testit (vaihe 38). Ajo: python3 tests/test_datamodel.py"""
import sys
from pathlib import Path
REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))
import datamodel as dm

m = dm.load(REPO / "data")
fails = 0
def check(name, cond):
    global fails
    print(("OK   " if cond else "FAIL ") + name); fails += (not cond)

err, warn = dm.validate(m)
check("validate: ei virheitä", not err)
check("validate: ei varoituksia", not warn)
sdata = dm.to_self_data(m)
check("SELF_DATA: kielet ja tasot", sdata["languages"] and [l["id"] for l in sdata["levels"]] == ["A1", "A2", "B1", "B2"])
vocab, sd = dm.to_legacy(m)
ids = [w["id"] for w in vocab["words"]]
check("käsitteet = sanat, id:t säilyvät (edistyminen ei katoa)", ids == [c["id"] for c in m["concepts"]])
check("jokaisella sanalla fi ja joko category tai self_only", all(w.get("fi") and (w.get("category") or w.get("self_only")) for w in vocab["words"]))
check("koulun käsitteet ilman koulun englannin muotoa -> de_only", all(bool(w.get("de_only")) == (c["id"] not in m["forms"]["en"] or bool(m["forms"]["en"][c["id"]].get("self_only"))) for w, c in zip(vocab["words"], m["concepts"]) if c.get("cat")))
check("virkkeet kaikille kolmelle kielelle", set(sd) == {"en", "de", "sv"} and all(sd[l] for l in sd))
check("virkkeessä kielen kenttä", all(s.get(l) for l in sd for s in sd[l]))
check("kielikohtainen kehote vain kielille joilla muoto", all(f"fi_{l}" not in w or w.get(l) for w in vocab["words"] for l in ("de", "sv")))
byid = {w["id"]: w for w in vocab["words"]}
for lang in sdata["languages"]:
    check(f"itseopiskelu {lang}: jokaisella tasolla sanoja", all(any(byid[c].get(lang) for t in sdata["topics"] if t["level"] == L for c in t["concepts"]) for L in ("A1", "A2", "B1", "B2")))
check("zipf_fi kopioituu käsitteeltä sanalle (uusien sanojen yleisyysjärjestys)", all(w.get("zipf_fi") == c.get("zipf_fi") for w, c in zip(vocab["words"], m["concepts"])) and sum(1 for w in vocab["words"] if isinstance(w.get("zipf_fi"), (int, float))) > 6500)
check("vain itseopiskelun käsitteillä ei koulun teemaa eikä de_only-lippua", all(not w.get("de_only") for w in vocab["words"] if w.get("self_only")))
print(f"\n{'0 FAIL' if not fails else str(fails) + ' FAIL'}")
sys.exit(1 if fails else 0)
