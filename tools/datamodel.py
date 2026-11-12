"""Sanaseikkailun tietomalli v2 (vaihe 38).

Rakenne (kansio data/):
  meta.json              versio, kielet, muutosloki
  concepts.json          kielestä riippumattomat käsitteet: id, fi (suomen kehote),
                         cat (koulutilan teema), also (lisäteemat), en_ref (vain
                         käsitteille, joilla ei ole englannin muotoa: viite)
  forms/<kieli>.json     kielikohtaiset muodot käsitteelle: text (hyväksytyt vastaukset
                         " / " eroteltuna), pl (monikko), fi (kielikohtainen kehote, jos
                         yhteinen suomen kehote ei sovi tälle kielelle)
  school.json            koulutila: luokka-asteet, kielten aloitusluokat, teemat
  self.json              itseopiskelutila: CEFR-tasot ja aihepiirit (luonnos)
  sentences/<kieli>.json virkkeet: id, grade (koulutila), level (itseopiskelu, myöh.),
                         text, fi, alt, theme

Käsitteen id = vanha sanan id, joten laitteelle tallennettu edistyminen säilyy.
to_legacy() tuottaa sovelluksen nykyisen VOCAB- ja SENTENCE_DATA-muodon, joten
sovellus toimii ennallaan, kunnes se siirretään lukemaan mallia suoraan.
"""
import json
from pathlib import Path

LANGS = ["en", "de", "sv"]


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
    }
    for lang in m["meta"]["languages"]:
        m["forms"][lang] = _load(d / "forms" / f"{lang}.json")["forms"]
        sp = d / "sentences" / f"{lang}.json"
        m["sentences"][lang] = _load(sp)["sentences"] if sp.exists() else []
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
        w["category"] = c["cat"]
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
        if c.get("also"):
            w["also"] = c["also"]
        if not en:
            w["de_only"] = True  # vanha lippu: ei englannin muotoa
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
        if c.get("cat") not in cats:
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
    seen = {}
    for t in m["self"]["topics"]:
        if t["level"] not in levels:
            err.append(f"self {t['id']}: tuntematon taso {t['level']}")
        for c in t.get("from_categories", []):
            if c not in cats:
                err.append(f"self {t['id']}: tuntematon teema {c}")
            if c in seen:
                warn.append(f"self: teema {c} kahdessa aihepiirissä ({seen[c]}, {t['id']})")
            seen[c] = t["id"]
        for cid in t.get("add", []) + t.get("exclude", []):
            if cid not in idset:
                err.append(f"self {t['id']}: tuntematon käsite {cid}")
    return err, warn


def self_topic_concepts(m, topic):
    """Itseopiskelun aihepiirin käsitteet: teemoista + lisätyt - poistetut."""
    src = set(topic.get("from_categories", []))
    ex = set(topic.get("exclude", []))
    out = [c["id"] for c in m["concepts"] if c["cat"] in src and c["id"] not in ex]
    out += [a for a in topic.get("add", []) if a not in out]
    return out


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
