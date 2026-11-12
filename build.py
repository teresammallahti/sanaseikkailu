import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools"))
import datamodel

# Polut ovat suhteessa tämän skriptin sijaintiin, joten build toimii suoraan
# repokansiosta millä tahansa koneella (ei enää kovakoodattuja /tmp-polkuja).
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "index_template.html")
DATA = os.path.join(HERE, "data")  # tietomalli v2 (vaihe 38)
OUT_FULL = os.path.join(HERE, "index.html")
OUT_FRAGMENT = os.path.join(HERE, "sanaseikkailu.html")

with open(TEMPLATE, "r", encoding="utf-8") as f:
    template = f.read()

model = datamodel.load(DATA)
errors, warnings = datamodel.validate(model)
if errors:
    print("ERROR: tietomallin tarkistus:", *errors[:20], sep="\n  ", file=sys.stderr)
    sys.exit(1)
vocab, sentence_data = datamodel.to_legacy(model)
self_data = datamodel.to_self_data(model)

vocab_json = json.dumps(vocab, ensure_ascii=False, indent=2)

if "__WORD_DATA__" not in template:
    print("ERROR: __WORD_DATA__ placeholder not found in template", file=sys.stderr)
    sys.exit(1)

if "__SENTENCE_DATA__" not in template:
    print("ERROR: __SENTENCE_DATA__ placeholder not found in template", file=sys.stderr)
    sys.exit(1)
full = template.replace("__WORD_DATA__", vocab_json).replace(
    "__SENTENCE_DATA__", json.dumps(sentence_data, ensure_ascii=False, indent=1))
if "__SELF_DATA__" in template:
    full = full.replace("__SELF_DATA__", json.dumps(self_data, ensure_ascii=False))

with open(OUT_FULL, "w", encoding="utf-8") as f:
    f.write(full)

# Fragment for the Artifact tool: strip doctype/html/head/body wrapper, keep body content only.
m = re.search(r"<body[^>]*>(.*)</body>", full, re.DOTALL | re.IGNORECASE)
if not m:
    print("ERROR: could not find <body> in output", file=sys.stderr)
    sys.exit(1)
body_inner = m.group(1)

# Also need the <style> block from <head> since Artifact wraps only a minimal skeleton.
style_m = re.search(r"<style[^>]*>.*?</style>", full, re.DOTALL | re.IGNORECASE)
style_block = style_m.group(0) if style_m else ""

# Also carry the Google Fonts <link> from head.
link_m = re.findall(r'<link[^>]+fonts\.googleapis[^>]*>', full, re.IGNORECASE)
link_block = "\n".join(link_m)

title_m = re.search(r"<title>(.*?)</title>", full, re.DOTALL | re.IGNORECASE)
title = title_m.group(1) if title_m else "Sanaseikkailu"

fragment = f"<title>{title}</title>\n{link_block}\n{style_block}\n{body_inner}"

with open(OUT_FRAGMENT, "w", encoding="utf-8") as f:
    f.write(fragment)

print("Built:", OUT_FULL, "and", OUT_FRAGMENT)
print("Vocab words:", len(vocab["words"]), "version:", vocab["meta"].get("version"),
      "sentences:", {k: len(v) for k, v in sentence_data.items()})
