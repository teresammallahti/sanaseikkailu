"""Vaihe 38: ruotsin Fable-tarkistuksen korjaukset + kielikohtaiset suomen kehotteet."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import datamodel as dm
ROOT = Path(__file__).resolve().parent.parent; D = ROOT / "data"; R = Path(sys.argv[1])
sv = json.load(open(D / "forms/sv.json")); de = json.load(open(D / "forms/de.json"))
n = 0
for f in ("fix_a.json", "fix_b.json"):
    for x in json.load(open(R / f)):
        cur = sv["forms"][x["id"]]
        assert cur["text"] == x["old"], x
        cur["text"] = x["new"]; n += 1
# Kehote: yhteinen fi sisältää englannin homonyymin, joka ei koske saksaa/ruotsia.
FI = {"weather_seasons_spring": "kevät", "gaming_fortnite_land": "laskeutua",
      "school_objects_book": "kirja", "school_objects_ruler": "viivain",
      "body_parts_foot": "jalkaterä / jalka"}
for forms in (sv, de):
    for cid, fi in FI.items():
        if cid in forms["forms"]:
            forms["forms"][cid]["fi"] = fi
ss = json.load(open(D / "sentences/sv.json")); byid = {s["id"]: s for s in ss["sentences"]}
m = 0
for x in json.load(open(R / "fix_sent.json")):
    s = byid[x["id"]]; field = {"sv": "text"}.get(x["field"], x["field"])
    assert s.get(field) == x["old"], x
    s[field] = x["new"]; m += 1
dm.dump_lines("forms", sv["forms"], D / "forms/sv.json", meta=sv["meta"])
dm.dump_lines("forms", de["forms"], D / "forms/de.json", meta=de["meta"])
dm.dump_lines("sentences", ss["sentences"], D / "sentences/sv.json", meta=ss["meta"])
print("sanakorjauksia", n, "virkekorjauksia", m)
