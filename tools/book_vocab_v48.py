"""Vaihe 48: 4. luokan kirjasanasto (25 teemaa, no_de) erotetaan luokka-asteesta omaksi kokonaisuudekseen.
Teemat saavat group="book", grade=null ja book_grade=4 (kirjan luokka-aste, näytetään valikossa)."""
import json
from pathlib import Path
D = Path(__file__).resolve().parent.parent / "data"
S = json.load(open(D / "school.json"))
n = 0
for c in S["categories"]:
    if c.get("no_de") and c.get("grade") == 4 and not c.get("exam"):
        c["group"] = "book"; c["book_grade"] = 4; c["grade"] = None; n += 1
(D / "school.json").write_text(json.dumps(S, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("kirjateemoja", n)
