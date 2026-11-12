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
vocab, sd = dm.to_legacy(m)
ids = [w["id"] for w in vocab["words"]]
check("käsitteet = sanat, id:t säilyvät (edistyminen ei katoa)", ids == [c["id"] for c in m["concepts"]])
check("jokaisella sanalla fi ja category", all(w.get("fi") and w.get("category") for w in vocab["words"]))
check("ilman englannin muotoa olevat käsitteet -> de_only", all(w.get("de_only") == (c["id"] not in m["forms"]["en"]) or (not w.get("de_only") and c["id"] in m["forms"]["en"]) for w, c in zip(vocab["words"], m["concepts"])))
check("virkkeet kaikille kolmelle kielelle", set(sd) == {"en", "de", "sv"} and all(sd[l] for l in sd))
check("virkkeessä kielen kenttä", all(s.get(l) for l in sd for s in sd[l]))
check("kielikohtainen kehote vain kielille joilla muoto", all(f"fi_{l}" not in w or w.get(l) for w in vocab["words"] for l in ("de", "sv")))
levels = [l["id"] for l in m["self"]["levels"]]
check("itseopiskelutasot A1, A2, B1", levels == ["A1", "A2", "B1"])
mapped = {c for t in m["self"]["topics"] for c in t["from_categories"]} | set(m["self"]["not_in_self"]["categories"])
check("jokainen koulun teema joko itseopiskelun aihepiirissä tai rajattu pois", all(c["id"] in mapped for c in m["school"]["categories"]))
check("jokaisessa aihepiirissä käsitteitä", all(dm.self_topic_concepts(m, t) for t in m["self"]["topics"]))
print(f"\n{'0 FAIL' if not fails else str(fails) + ' FAIL'}")
sys.exit(1 if fails else 0)
