"""Sanaseikkailun tietomalli v2 (vaihe 38).

Rakenne (kansio data/):
  meta.json              versio, kielet, muutosloki
  concepts.json          kielestä riippumattomat käsitteet: id, fi (suomen kehote),
                         cat (koulutilan teema; puuttuu = vain itseopiskelussa),
                         also (lisäteemat), pos (n/v/adj/adv/pron/prep/conj/num/
                         interj/phrase), en_ref (viite, jos ei englannin muotoa)
  forms/<kieli>.json     kielikohtaiset muodot käsitteelle: text (hyväksytyt vastaukset
                         " / " eroteltuna), pl (monikko), fi (kielikohtainen kehote, jos
                         yhteinen suomen kehote ei sovi tälle kielelle); taivutus:
                         substantiivi def (määräinen yks.), verbi pres/pret/sup,
                         adjektiivi neut/apl (ett-muoto, monikko)
  school.json            koulutila: luokka-asteet, kielten aloitusluokat, teemat
  self.json              itseopiskelutila: CEFR-tasot, aihepiirit ja niiden käsitteet
  sentences/<kieli>.json virkkeet: id, grade (koulutila), level (itseopiskelu, myöh.),
                         text, fi, alt, theme

Käsitteen id = vanha sanan id, joten laitteelle tallennettu edistyminen säilyy.
to_legacy() tuottaa sovelluksen nykyisen VOCAB- ja SENTENCE_DATA-muodon, joten
sovellus toimii ennallaan, kunnes se siirretään lukemaan mallia suoraan.
"""
import json
from pathlib import Path

LANGS = ["en", "de", "sv"]
INFL = ("def", "pres", "pret", "sup", "neut", "apl", "past", "pp", "pres3")


def _load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def load(data_dir):
    d = Path(data_dir)
    m = {
        "meta": _load(d / "meta.json"),
        "concepts": _load(d / "concepts.json")["concepts"],
        "school": _load(d / "school.json"),
        "self": _load(d / "self.json"),
        "forms": {},
        "sentences": {},
        "self_sentences": {},
        "dialogues": {},
    }
    for lang in m["meta"]["languages"]:
        m["forms"][lang] = _load(d / "forms" / f"{lang}.json")["forms"]
        sp = d / "sentences" / f"{lang}.json"
        m["sentences"][lang] = _load(sp)["sentences"] if sp.exists() else []
        # Itseopiskelun virkkeet ja dialogit (vaihe 45): self_sentences/<kieli>.json, dialogues/<kieli>.json
        sp = d / "self_sentences" / f"{lang}.json"
        m["self_sentences"][lang] = _load(sp)["sentences"] if sp.exists() else []
        sp = d / "dialogues" / f"{lang}.json"
        m["dialogues"][lang] = _load(sp)["dialogues"] if sp.exists() else []
    return m


def to_legacy(m):
    """Sovelluksen nykyinen muoto: VOCAB {meta, categories, words} + SENTENCE_DATA."""
    words = []
    for c in m["concepts"]:
        w = {"id": c["id"]}
        en = m["forms"].get("en", {}).get(c["id"])
        if en:
            w["en"] = en["text"]
        elif c.get("en_ref"):
            w["en"] = c["en_ref"]
        w["fi"] = c["fi"]
        if c.get("cat"):
            w["category"] = c["cat"]
        else:
            w["self_only"] = True  # vain itseopiskelutilassa
        for lang in m["meta"]["languages"]:
            f = m["forms"][lang].get(c["id"])
            if not f:
                continue
            if lang != "en":
                w[lang] = f["text"]
            if f.get("pl"):
                w[f"{lang}_pl"] = f["pl"]
            if f.get("fi"):
                w[f"fi_{lang}"] = f["fi"]
            if f.get("self_only"):
                w.setdefault("self_langs", []).append(lang)  # muoto vain itseopiskeluun
            infl = {k: f[k] for k in INFL if f.get(k)}
            if infl:
                w[f"{lang}_infl"] = infl
        if c.get("also"):
            w["also"] = c["also"]
        if c.get("pos"):
            w["pos"] = c["pos"]
        if c.get("zipf_fi") is not None:
            w["zipf_fi"] = c["zipf_fi"]  # suomen yleisyys (wordfreq): uusien sanojen järjestys itseopiskelussa
        if c.get("cat") and (not en or en.get("self_only")):
            w["de_only"] = True  # koulussa ei englannin muotoa  # vanha lippu: ei englannin muotoa
        words.append(w)
    meta = dict(m["meta"].get("legacy_meta", {}))
    meta["version"] = m["meta"]["version"]
    meta["language_targets"] = m["meta"]["languages"]
    vocab = {"meta": meta, "categories": m["school"]["categories"], "words": words}
    sd = {}
    for lang, ss in m["sentences"].items():
        out = []
        for s in ss:
            o = {"id": s["id"], "grade": s["grade"], lang: s["text"], "fi": s["fi"]}
            for k in ("alt", "theme"):
                if s.get(k):
                    o[k] = s[k]
            out.append(o)
        sd[lang] = out
    return vocab, sd


def to_self_data(m):
    """Itseopiskelutilan rakenne sovellukselle: SELF_DATA {languages, levels, topics}."""
    s = m["self"]
    return {
        "languages": s.get("languages", []),
        "levels": [{"id": l["id"], "name_fi": l["name_fi"], "goal_fi": l.get("goal_fi", "")} for l in s["levels"]],
        "topics": [{"id": t["id"], "name_fi": t["name_fi"], "level": t["level"], "concepts": t["concepts"]}
                   for t in s["topics"]],
        # virkkeet: {kieli: [{id, topic, level, text, fi, alt}]}, dialogit: {kieli: [{id, topic, level, title_fi, lines: [{speaker, text, fi}]}]}
        "sentences": {l: v for l, v in m.get("self_sentences", {}).items() if v},
        "dialogues": {l: v for l, v in m.get("dialogues", {}).items() if v},
    }


def validate(m):
    """Mallin rakenteelliset tarkistukset. Palauttaa (virheet, varoitukset)."""
    err, warn = [], []
    ids = [c["id"] for c in m["concepts"]]
    idset = set(ids)
    if len(ids) != len(idset):
        err.append("käsitteiden id:issä on kaksoiskappaleita")
    cats = {c["id"] for c in m["school"]["categories"]}
    for c in m["concepts"]:
        if not c.get("fi"):
            err.append(f"{c['id']}: fi puuttuu")
        if c.get("cat") is not None and c["cat"] not in cats:
            err.append(f"{c['id']}: tuntematon teema {c.get('cat')}")
        for a in c.get("also", []):
            if a not in cats:
                err.append(f"{c['id']}: tuntematon lisäteema {a}")
        if not any(c["id"] in m["forms"][l] for l in m["forms"]):
            err.append(f"{c['id']}: ei yhtään kielimuotoa")
    for lang, forms in m["forms"].items():
        for cid, f in forms.items():
            if cid not in idset:
                err.append(f"forms/{lang}: tuntematon käsite {cid}")
            if not f.get("text", "").strip():
                err.append(f"forms/{lang} {cid}: text tyhjä")
    for lang, ss in m["sentences"].items():
        sids = [s["id"] for s in ss]
        if len(sids) != len(set(sids)):
            err.append(f"sentences/{lang}: kaksoiskappale-id")
        for s in ss:
            if not s.get("text") or not s.get("fi"):
                err.append(f"sentences/{lang} {s.get('id')}: text/fi puuttuu")
            if s.get("theme") and s["theme"] not in cats:
                err.append(f"sentences/{lang} {s['id']}: tuntematon teema {s['theme']}")
    levels = {l["id"] for l in m["self"]["levels"]}
    in_self = set()
    for t in m["self"]["topics"]:
        if t["level"] not in levels:
            err.append(f"self {t['id']}: tuntematon taso {t['level']}")
        if len(t["concepts"]) != len(set(t["concepts"])):
            err.append(f"self {t['id']}: sama käsite kahdesti")
        for cid in t["concepts"]:
            if cid not in idset:
                err.append(f"self {t['id']}: tuntematon käsite {cid}")
        in_self.update(t["concepts"])
    for c in m["concepts"]:
        if not c.get("cat") and c["id"] not in in_self:
            err.append(f"{c['id']}: ei koulun teemaa eikä itseopiskelun aihepiiriä")
    return err, warn


def dump_lines(obj_key, items, path, meta=None):
    """Kirjoittaa JSONin yksi alkio per rivi (siistit git-diffit)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["{"]
    if meta is not None:
        lines.append(f'  "meta": {json.dumps(meta, ensure_ascii=False)},')
    lines.append(f'  "{obj_key}": ' + ("{" if isinstance(items, dict) else "["))
    if isinstance(items, dict):
        body = [f"    {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}" for k, v in items.items()]
        close = "  }"
    else:
        body = [f"    {json.dumps(v, ensure_ascii=False)}" for v in items]
        close = "  ]"
    lines.append(",\n".join(body))
    lines.append(close)
    lines.append("}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
