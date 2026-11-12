"""Kertaluonteinen siirto: en_1_9lk_v17.json + SENTENCE_DATA -> data/ (tietomalli v2).

Ajetaan: python3 tools/migrate_v17_to_v2.py <v17.json> <sentences.json>
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from datamodel import dump_lines, LANGS

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data"
v17 = json.load(open(sys.argv[1], encoding="utf-8"))
sd = json.load(open(sys.argv[2], encoding="utf-8"))

concepts, forms = [], {l: {} for l in LANGS}
for w in v17["words"]:
    c = {"id": w["id"], "fi": w["fi"], "cat": w["category"]}
    if w.get("also"):
        c["also"] = w["also"]
    if w.get("de_only"):
        c["en_ref"] = w["en"]
    else:
        forms["en"][w["id"]] = {"text": w["en"]}
    concepts.append(c)
    for l in ("de", "sv"):
        if w.get(l):
            f = {"text": w[l]}
            if w.get(f"{l}_pl"):
                f["pl"] = w[f"{l}_pl"]
            forms[l][w["id"]] = f

legacy_meta = {k: v for k, v in v17["meta"].items() if k not in ("version", "language_targets")}
meta = {
    "schema": 2,
    "version": "v18",
    "native": "fi",
    "languages": LANGS,
    "language_names": {"en": "englanti", "de": "saksa", "sv": "ruotsi"},
    "changelog": [
        "v18 (vaihe 38): tietomalli v2 - käsitteet (concepts.json) erotettu kielikohtaisista muodoista (forms/), koulutila (school.json) ja itseopiskelutila (self.json) omiksi rakenteikseen, virkkeet omiin tiedostoihinsa. Ruotsin Fable-tarkistuksen korjaukset. Kielikohtaiset suomen kehotteet (forms/<kieli>.json: fi). Aiempi historia: legacy_meta.changelog."
    ],
    "legacy_meta": legacy_meta,
}
D.mkdir(exist_ok=True)
(D / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
dump_lines("concepts", concepts, D / "concepts.json")
names = meta["language_names"]
for l in LANGS:
    dump_lines("forms", forms[l], D / "forms" / f"{l}.json", meta={"lang": l, "name": names[l]})
for l, ss in sd.items():
    out = []
    for s in ss:
        o = {"id": s["id"], "grade": s["grade"], "text": s[l], "fi": s["fi"]}
        for k in ("alt", "theme"):
            if s.get(k):
                o[k] = s[k]
        out.append(o)
    dump_lines("sentences", out, D / "sentences" / f"{l}.json", meta={"lang": l})
school = {
    "description": "Koulutila: suomalaisen peruskoulun luokka-asteet. Teeman grade = kielen opiskeluvuosi; sovellus lisää kielen aloitusluokan (start_grade) - 1.",
    "grades": list(range(1, 10)),
    "start_grade": {"en": 1, "de": 4, "sv": 4},
    "categories": v17["categories"],
}
(D / "school.json").write_text(json.dumps(school, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("concepts", len(concepts), {l: len(f) for l, f in forms.items()}, {l: len(s) for l, s in sd.items()})
