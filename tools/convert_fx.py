"""Exporta los sprites de efectos del cliente original (hechizos, impactos, curación...).
    python convert_fx.py CARPETA_HELBREATH SALIDA
Salida: SALIDA/fx/fx<n>.png y SALIDA/fx.json. El número n es el índice m_pEffectSpr[n] del cliente
(Game.cpp, MakeEffectSpr), así que los casos de DrawEffects se pueden copiar tal cual."""
import json, os, sys
from convert import PakFolder, export

hb, out = sys.argv[1], sys.argv[2]
sd = os.path.join(out, "fx")
os.makedirs(sd, exist_ok=True)
pak = PakFolder(os.path.join(hb, "SPRITES"))
man = {}
GROUPS = [("effect", 0, 10), ("effect2", 10, 3), ("effect3", 13, 6), ("effect4", 19, 5), ("CruEffect1", 31, 9),
          ("effect6", 40, 5), ("effect7", 45, 12), ("effect8", 57, 9), ("effect9", 66, 21),
          ("effect10", 87, 2), ("effect11", 89, 14), ("effect11s", 104, 1), ("effect12", 148, 4)]
for name, start, count in GROUPS:
    for i in range(count):
        export(pak, name, i, sd, "fx%d" % (start + i), man)
for i in range(7):                                  # effect5 empieza en 1: la 0 es la esfera de energía
    export(pak, "effect5", i + 1, sd, "fx%d" % (24 + i), man)
json.dump(man, open(os.path.join(out, "fx.json"), "w"), separators=(",", ":"))
print(len(man), "sprites")
