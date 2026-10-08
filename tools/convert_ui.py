"""Exporta los sprites de la interfaz del cliente original (cuadros de diálogo, panel de iconos, texto, botones).
    python convert_ui.py CARPETA_HELBREATH SALIDA
Salida: SALIDA/ui/<pak>_<n>.png y SALIDA/ui.json  ({clave: {png, frames:[x,y,w,h,pivotX,pivotY]}}).
Claves como en Client/Game.cpp: GameDialog n (ND_GAME1..4 = 0..3, ICONPANNEL = 6, INVENTORY = 7), GameDialog2 n (ICONPANNEL2 = 6),
DialogText 0 (TEXT) y 1 (BUTTON), interface2 0 (ADDINTERFACE: cifras, cursores)."""
import json, os, struct, sys
from convert import PakFolder, export

hb, out = sys.argv[1], sys.argv[2]
sd = os.path.join(out, "ui")
os.makedirs(sd, exist_ok=True)
pak = PakFolder(os.path.join(hb, "SPRITES"))
man = {}
WANT = {"GameDialog": [0, 1, 2, 3, 6, 7], "GameDialog2": [6], "DialogText": [0, 1], "interface2": [0, 1, 2], "interface": [0, 1], "sprfonts": [0, 1]}
for name, nths in WANT.items():
    if pak.data(name) is None:
        print("falta", name); continue
    for n in nths:
        export(pak, name, n, sd, "%s_%d" % (name.lower(), n), man)
# paperdoll del diálogo de personaje: item-equipM / item-equipW (15 hojas cada una) y colgantes de item-pack
for pk, tag in (("item-equipM", "em"), ("item-equipW", "ew")):
    for n in range(15):
        export(pak, pk, n, sd, "%s_%d" % (tag, n), man)
for n in (15, 19):
    export(pak, "item-pack", n, sd, "pk_%d" % n, man)
json.dump(man, open(os.path.join(out, "ui.json"), "w"), separators=(",", ":"))
print(len(man), "sprites")
