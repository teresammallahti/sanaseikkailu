"""Vaihe 45: itseopiskelun ruotsin virkkeet ja dialogit (sent45/all.json -> data/self_sentences/sv.json, data/dialogues/sv.json)."""
import json, sys, collections
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent)); import datamodel as dm
ROOT = Path(__file__).resolve().parent.parent; D = ROOT / "data"
A = json.load(open(sys.argv[1]))
S = [{"id": r["id"], "topic": r["topic"], "level": r["level"], "text": r["sv"], "fi": r["fi"],
      **({"alt": [a.strip() for a in r["alt"].split("||") if a.strip()]} if r.get("alt", "").strip() else {})}
     for r in A["sentences"]]
dl = collections.OrderedDict()
for r in A["dialogues"]:
    did = "svd_" + r["topic"]
    d = dl.setdefault(did, {"id": did, "topic": r["topic"], "level": r["level"], "title_fi": r["title_fi"], "lines": []})
    d["lines"].append({"speaker": r["speaker"], "text": r["sv"], "fi": r["fi"]})
dm.dump_lines("sentences", S, D / "self_sentences/sv.json", meta={"lang": "sv"})
dm.dump_lines("dialogues", list(dl.values()), D / "dialogues/sv.json", meta={"lang": "sv"})
print(len(S), len(dl))
