import json, os, re, sys

# Polut ovat suhteessa tämän skriptin sijaintiin, joten build toimii suoraan
# repokansiosta millä tahansa koneella (ei enää kovakoodattuja /tmp-polkuja).
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "index_template.html")
VOCAB = os.path.join(HERE, "en_1_6lk_v7.json")
OUT_FULL = os.path.join(HERE, "index.html")
OUT_FRAGMENT = os.path.join(HERE, "sanaseikkailu.html")

with open(TEMPLATE, "r", encoding="utf-8") as f:
    template = f.read()

with open(VOCAB, "r", encoding="utf-8") as f:
    vocab = json.load(f)

vocab_json = json.dumps(vocab, ensure_ascii=False, indent=2)

if "__WORD_DATA__" not in template:
    print("ERROR: __WORD_DATA__ placeholder not found in template", file=sys.stderr)
    sys.exit(1)

full = template.replace("__WORD_DATA__", vocab_json)

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
print("Vocab words:", len(vocab["words"]), "version:", vocab["meta"].get("version"))
