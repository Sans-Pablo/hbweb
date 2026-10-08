"""Exporta los sprites de personaje: 3 pieles x 2 géneros, 8 ropas interiores y 8 peinados por género.
    python convert_players.py CARPETA_HELBREATH SALIDA
Salida: SALIDA/sprites/pb<tipo>_<n>.png (cuerpo), pu<g>_<set>_<grupo>.png, ph<g>_<estilo>_<grupo>.png y SALIDA/players.json
Tipos (Client/Game.cpp): 1 Bm, 2 Wm, 3 Ym (hombres) y 4 Bw, 5 Ww, 6 Yw (mujeres)."""
import json, os, sys
from convert import PakFolder, export, PLAYER_GROUPS

hb, out = sys.argv[1], sys.argv[2]
sd = os.path.join(out, "sprites")
os.makedirs(sd, exist_ok=True)
pak = PakFolder(os.path.join(hb, "SPRITES"))
man = {}
for t, name in enumerate(["Bm", "Wm", "Ym", "Bw", "Ww", "Yw"], 1):
    for g in PLAYER_GROUPS:
        for d in range(8):
            export(pak, name, g * 8 + d, sd, "pb%d_%d" % (t, g * 8 + d), man)
for gi, (u, h) in enumerate([("Mpt", "Mhr"), ("Wpt", "Whr")]):
    for k in range(8):
        for g in PLAYER_GROUPS:
            export(pak, u, g + 12 * k, sd, "pu%d_%d_%d" % (gi, k, g), man)
            export(pak, h, g + 12 * k, sd, "ph%d_%d_%d" % (gi, k, g), man)
json.dump(man, open(os.path.join(out, "players.json"), "w"), separators=(",", ":"))
print(len(man), "sprites")
