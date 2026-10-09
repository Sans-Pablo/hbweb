"""Regenera todos los datos de web/data desde los recursos originales, en el orden correcto.
    python convert_all.py CARPETA_HELBREATH CARPETA_SERVIDOR SALIDA [--only paso,paso] [--dry]
Pasos (en este orden): base, equip, fx, players, ui, maps, npcs.
`base` (convert.py) puede sobrescribir npc.json; `npcs` va siempre después para volver a añadir los NPC de ciudad.
Después se ejecuta tests/data.test.mjs para comprobar que no falta nada."""
import os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
argv, only = sys.argv[1:], None
if "--only" in argv:
    i = argv.index("--only")
    only = argv[i + 1].split(",")
    del argv[i:i + 2]
dry = "--dry" in argv
args = [a for a in argv if not a.startswith("--")]
if len(args) < 3:
    sys.exit(__doc__)
hb, server, out = args[:3]

STEPS = [
    ("base", ["convert.py", hb, out, "arefarm", server]),
    ("equip", ["convert_equip.py", hb, out]),
    ("fx", ["convert_fx.py", hb, out]),
    ("players", ["convert_players.py", hb, out]),
    ("ui", ["convert_ui.py", hb, out]),
    ("maps", ["convert_maps.py", hb, server, out]),
    ("npcs", ["convert_npcs.py", hb, server, out]),
    ("mobs", ["convert_mobs.py", hb, server, out]),
    ("talk", ["convert_talk.py", hb, out]),
]
for name, cmd in STEPS:
    if only and name not in only:
        continue
    line = [sys.executable, os.path.join(here, cmd[0])] + cmd[1:]
    print("==", name, ":", " ".join(line[1:]))
    if not dry:
        r = subprocess.run(line, cwd=here)
        if r.returncode:
            sys.exit("falló el paso %s (código %d)" % (name, r.returncode))
if not dry:
    root = os.path.dirname(here)
    r = subprocess.run(["node", os.path.join(root, "tests", "data.test.mjs")], cwd=root)
    sys.exit(r.returncode)
