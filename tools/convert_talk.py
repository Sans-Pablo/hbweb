"""Textos de conversación de los NPC (CONTENTS/contents*.txt) -> web/data/talk.json.
Uso: convert_talk.py CARPETA_HELBREATH SALIDA
El cliente original los carga con _iLoadTextDlgContents2 (una línea por renglón, entre comillas)."""
import json, os, re, sys
hb, out = sys.argv[1:3]
src = os.path.join(hb, "CONTENTS")
talk = {}
for f in sorted(os.listdir(src)):
    m = re.fullmatch(r"contents(\d+)\.txt", f, re.I)
    if not m or not 100 <= int(m.group(1)) <= 199: continue
    raw = open(os.path.join(src, f), encoding="latin-1").read().replace("\r", "")
    lines = raw.split("\n")
    if lines and lines[0].startswith('"'): lines[0] = lines[0][1:]
    while lines and not lines[-1].strip(): lines.pop()
    if lines and lines[-1].endswith('"'): lines[-1] = lines[-1][:-1]
    talk[m.group(1)] = lines
json.dump(talk, open(os.path.join(out, "talk.json"), "w"), ensure_ascii=False)
print("talk.json:", len(talk), "textos")
