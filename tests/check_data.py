#!/usr/bin/env python3
"""Data-integrity checker for Sanaseikkailu (read-only). Exit 1 on any ERROR."""
import json, re, subprocess, sys, collections
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VOCAB = REPO / "en_1_6lk_v7.json"
TEMPLATE = REPO / "index_template.html"

ERR, WARN, INFO = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
def err(g, m): ERR[g].append(m)
def warn(g, m): WARN[g].append(m)
def info(g, m): INFO[g].append(m)

def load_sentences():
    src = TEMPLATE.read_text(encoding="utf-8")
    m = re.search(r"const\s+SENTENCE_DATA\s*=\s*\{", src)
    if not m:
        err("Load", "SENTENCE_DATA not found in index_template.html"); return {}
    i = m.end() - 1; depth = 0; j = i; instr = None; esc = False
    while j < len(src):  # brace-match, aware of strings and comments
        c = src[j]
        if instr:
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == instr: instr = None
        elif c in "\"'`": instr = c
        elif src.startswith("//", j): j = src.index("\n", j); continue
        elif src.startswith("/*", j): j = src.index("*/", j) + 1
        elif c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0: break
        j += 1
    literal = src[i:j + 1]
    r = subprocess.run(["node", "-e", "console.log(JSON.stringify(" + literal + "))"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        err("Load", "Node failed to evaluate SENTENCE_DATA: " + r.stderr.strip()[:300]); return {}
    return json.loads(r.stdout)

data = json.load(open(VOCAB, encoding="utf-8"))
SD = load_sentences()
cats = data["categories"]; words = data["words"]; sents = SD.get("en", []) if SD else []
catmap = {c["id"]: c for c in cats}

# ---------- ids ----------
def dups(seq):
    c = collections.Counter(seq); return [k for k, v in c.items() if v > 1]
for d in dups(w.get("id") for w in words): err("IDs", f"duplicate word id: {d}")
for d in dups(s.get("id") for s in sents): err("IDs", f"duplicate sentence id: {d}")
for d in set(w.get("id") for w in words) & set(s.get("id") for s in sents): err("IDs", f"id used by both word and sentence: {d}")
for d in dups(c.get("id") for c in cats): err("IDs", f"duplicate category id: {d}")

# ---------- words ----------
for w in words:
    wid = w.get("id")
    for f in ("en", "fi", "de"):
        v = w.get(f)
        if not isinstance(v, str) or not v.strip(): err("Word fields", f"{wid}: missing/empty '{f}'")
    if w.get("category") not in catmap: err("Word fields", f"{wid}: unknown category {w.get('category')!r}")

used = collections.Counter(w.get("category") for w in words)
for c in cats:
    if not used[c["id"]]: err("Categories", f"category '{c['id']}' has no words")
    g, grp = c.get("grade"), c.get("group")
    if grp == "hobby":
        if g is not None: err("Categories", f"hobby category '{c['id']}' has grade {g}")
    elif not (isinstance(g, int) and 1 <= g <= 6):
        err("Categories", f"category '{c['id']}' (group={grp}) has invalid grade {g!r}")

def wgrade(w):
    c = catmap.get(w.get("category")); return c.get("grade") if c else None
wpg = collections.Counter(wgrade(w) for w in words)
for g in range(1, 7):
    if not wpg[g]: err("Grades", f"grade {g} has no words")

# ---------- sentences ----------
spg = collections.Counter()
for s in sents:
    sid = s.get("id")
    for f in ("id", "grade", "en", "fi"):
        if s.get(f) in (None, ""): err("Sentences", f"{sid}: missing '{f}'")
    g = s.get("grade")
    if not (isinstance(g, int) and 1 <= g <= 6): err("Sentences", f"{sid}: invalid grade {g!r}")
    else: spg[g] += 1
    en, fi = s.get("en") or "", s.get("fi") or ""
    if not en or en[-1] not in ".?!": err("Sentences", f"{sid}: en does not end with . ? or ! -> {en!r}")
    if not fi or fi[-1] not in ".?!": err("Sentences", f"{sid}: fi does not end with . ? or ! -> {fi!r}")
    elif en and en[-1] in ".?!" and (en[-1] == "?") != (fi[-1] == "?"):
        err("Sentences", f"{sid}: question/statement mismatch: {en!r} <-> {fi!r}")
for g in range(1, 7):
    if spg[g] < 10: err("Grades", f"grade {g} has only {spg[g]} sentences (need >=10)")

# ---------- whitespace / slash ----------
def ws_check(label, v):
    if not isinstance(v, str): return
    if v != v.strip(): err("Whitespace", f"{label}: leading/trailing whitespace {v!r}")
    if "  " in v: err("Whitespace", f"{label}: double space {v!r}")
    if "\t" in v or "\n" in v: err("Whitespace", f"{label}: tab/newline {v!r}")
for w in words:
    for f in ("en", "fi", "de"):
        v = w.get(f); ws_check(f"word {w.get('id')}.{f}", v)
        if isinstance(v, str) and "/" in v and any(not p.strip() for p in v.split("/")):
            err("Empty alternatives", f"word {w.get('id')}.{f}: {v!r}")
for s in sents:
    for f in ("en", "fi"):
        ws_check(f"sentence {s.get('id')}.{f}", s.get(f))
for c in cats: ws_check(f"category {c['id']}.name_fi", c.get("name_fi"))

# ---------- pattern phrases (INFO) ----------
for w in words:
    for f in ("fi", "en", "de"):
        if "..." in (w.get(f) or ""):
            info("Pattern phrases with '...' (filtered from practice)",
                 f"{w['id']}: en={w['en']!r} fi={w['fi']!r} de={w['de']!r}"); break
def practicable(w): return "..." not in w["fi"] and "..." not in w["en"]

# ---------- ambiguity ----------
def norm(s): return s.strip().lower()
def alts(s): return [norm(a) for a in s.split("/") if a.strip()]
by_en = collections.defaultdict(list)
for w in words: by_en[norm(w["en"])].append(w)
for en, ws in sorted(by_en.items()):
    if len(ws) > 1:
        fis = {norm(w["fi"]) for w in ws}
        if len(fis) > 1:
            warn("Same en, different fi (en->fi ambiguous)",
                 f"{en!r}: " + "; ".join(f"{w['fi']!r} [{w['category']}]" for w in ws))
        else:
            warn("Exact duplicate en+fi", f"{en!r}: " + ", ".join(f"{w['id']}" for w in ws))
fi_map = collections.defaultdict(lambda: collections.defaultdict(list))
for w in words:
    if not practicable(w): continue
    for a in alts(w["fi"]): fi_map[a][norm(w["en"])].append(w["id"])
for fi, m in sorted(fi_map.items()):
    if len(m) > 1:
        warn("Same fi, different en (fi->en ambiguous)", f"{fi!r} -> " + " | ".join(f"{en!r}" for en in m))

# ---------- German heuristics ----------
ART = r"(?:der|die|das)"
NOART_OK = set(x.lower() for x in """Montag Dienstag Mittwoch Donnerstag Freitag Samstag Sonntag Sonnabend
Englisch Finnisch Deutsch Schwedisch Französisch Spanisch Russisch Italienisch
Deutschland Finnland England Schweden Frankreich Spanien Russland Italien Norwegen Dänemark Estland
Japan China Amerika Europa Großbritannien Australien Kanada Island Schottland Irland Griechenland Polen Norwegen
Januar Februar März April Mai Juni Juli August September Oktober November Dezember
Weihnachten Ostern Ich Du Er Sie Es Wir Ihr Tennis Hotel Internet Taxi Baby App Computer Fußball Basketball
Handball Eishockey Volleyball Judo Karate Yoga Ballett Minecraft Fortnite Pizza Sport Musik Mathe Mathematik Kunst Religion
Physik Chemie Biologie Geschichte Geografie Erdkunde Sachkunde Handarbeit Zeit Gold Silber Hallo Tschüss Danke Bitte Gesundheit
Mama Papa Oma Opa Mutti Vati Eltern Geschwister Leute Schach Ski Rad Wetter Gras Obst Gemüse Fleisch Brot Käse Fisch Wasser Milch Eis
Schnee Regen Wind Sonne Mond""".split())
def clean(p): return re.sub(r"\(.*?\)", "", p).strip()
noun_like = lambda en: bool(re.fullmatch(r"[A-Za-z]+", en.strip()))
for w in words:
    de, en, wid = w["de"], w["en"], w["id"]
    parts = [clean(p) for p in de.split("/") if p.strip()]
    has_art = [bool(re.match(rf"{ART}\s", p)) for p in parts]
    for p in parts:
        if re.match(rf"(?:{ART}|ein|eine)\s+[a-zäöüß]", p):
            warn("DE: article followed by lowercase word", f"{wid}: en={en!r} de={de!r}")
            break
    if len(parts) > 1 and any(has_art) and not all(has_art):
        bad = [p for p, h in zip(parts, has_art) if not h]
        if any(p[:1].isupper() for p in bad):
            warn("DE: combined form, a half lacks article", f"{wid}: en={en!r} de={de!r}")
    elif len(parts) >= 1 and not any(has_art) and noun_like(en) and parts[0][:1].isupper():
        first = parts[0].split()[0] if parts[0].split() else ""
        if parts[0].lower() not in NOART_OK and first.lower() not in NOART_OK and not en[:1].isupper():
            warn("DE: possible missing article", f"{wid}: en={en!r} de={de!r}")
    # lowercase word (adj/verb) with article is covered above; also article + verb-like infinitive
    for p in parts:
        if re.match(rf"{ART}\s+\w+(?:en|ern|eln)$", p) and p.split()[1][:1].islower():
            pass
    if len(en) > 2 and norm(en) == norm(de):
        info("DE equals EN (eyeball)", f"{wid}: {en!r} = {de!r}")

# ---------- stats ----------
info("Words per grade", ", ".join(f"g{g}: {wpg[g]}" for g in range(1, 7)) + f", ungraded(hobby): {wpg[None]}")
for c in cats:
    info("Words per category", f"{c['id']} (grade {c['grade']}, {c['group']}): {used[c['id']]}")
info("Sentences per grade", ", ".join(f"g{g}: {spg[g]}" for g in range(1, 7)) + f" (total {len(sents)})")
tok = lambda t: re.findall(r"[A-Za-z']+", t)
avg = {}
for g in range(1, 7):
    ls = [len(tok(s["en"])) for s in sents if s.get("grade") == g]
    if ls: avg[g] = sum(ls) / len(ls)
info("Average sentence length (words)", ", ".join(f"g{g}: {avg[g]:.2f}" for g in sorted(avg)))
for g in sorted(avg):
    if g - 1 in avg and avg[g] < avg[g - 1]:
        warn("Sentence length not increasing", f"grade {g} avg {avg[g]:.2f} < grade {g-1} avg {avg[g-1]:.2f}")

# ---------- coverage ----------
STOP = set("""a an the i you he she it we they me him her us them my your his its our their
is am are was were be been do does did to of in on at and or but not no so if that this these those there
with for from by as can will would should could have has had what who where when how why which than then
very too just also some any all up out into over under about""".split())
def stem(w):
    for suf in ("ies", "es", "s", "ing", "ed"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            yield w[:-len(suf)] + ("y" if suf == "ies" else "")
    yield w
def forms(w): return set(stem(w)) | {w}
vocab_by_grade = collections.defaultdict(set); allvocab = set()
for w in words:
    ts = set()
    for a in re.split(r"/", w["en"]):
        for t in tok(a.lower().replace("...", " ")): ts |= forms(t)
    allvocab |= ts
    g = wgrade(w)
    if g: vocab_by_grade[g] |= ts
def known(t, pool): return bool(forms(t) & pool)
unk = collections.Counter()
for g in range(1, 7):
    pool = set().union(*(vocab_by_grade[x] for x in range(1, g + 1)))
    tot = hit = 0
    for s in sents:
        if s.get("grade") != g: continue
        for t in tok(s["en"].lower()):
            t = t.strip("'")
            if not t or t in STOP: continue
            tot += 1; hit += known(t, pool)
            if not known(t, allvocab): unk[t] += 1
    if tot: info("Sentence vocabulary coverage (content words in vocab at grade <= g; light plural/-ing/-ed stemming)",
                 f"grade {g}: {hit}/{tot} = {100*hit/tot:.1f}%")
info("Top 30 sentence words NOT in vocabulary at all", ", ".join(f"{w}({n})" for w, n in unk.most_common(30)))

# ---------- report ----------
def section(title, d, limit=None):
    n = sum(len(v) for v in d.values())
    print(f"\n===== {title} ({n}) =====")
    for g, ms in d.items():
        print(f"\n[{g}] ({len(ms)})")
        for m in ms: print("  - " + m)
print(f"Sanaseikkailu data check: {len(words)} words, {len(cats)} categories, {len(sents)} sentences")
section("ERRORS", ERR); section("WARNINGS", WARN); section("INFO", INFO)
ne = sum(len(v) for v in ERR.values()); nw = sum(len(v) for v in WARN.values())
print(f"\nSUMMARY: {ne} error(s), {nw} warning(s)")
sys.exit(1 if ne else 0)
