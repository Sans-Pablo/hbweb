"""Exporta los sprites de equipo del personaje (ropa, armaduras, armas, escudos, capas, cascos) y todos los
objetos de suelo y mochila. Lee las tablas de carga de Client/Game.cpp (MakeSprite y los bucles de CSprite),
así que los índices son los del cliente original.
    python convert_equip.py CARPETA_HELBREATH SALIDA
Claves (data/equip/<clave>.webp, data/equip.json):
  a<g>_<pieza>_<grupo>  armadura de cuerpo     b  mangas/hauberk     l  piernas     o  botas     m  capa     h  casco
  s<g>_<escudo>_<grupo> escudo (grupos 0-6)
  w<g>_<arma>_<grupo*8+dir>  arma (56 hojas por arma: 7 grupos x 8 direcciones)
  ig<n>, ip<n>          objetos en el suelo y en la mochila (item-ground / item-pack)
g = 0 hombre, 1 mujer. Los fotogramas de a/b/l/o/m/h/s son dirección*8+animación, como el pelo."""
import json, os, re, struct, sys
from convert import PakFolder, export

hb, out = sys.argv[1], sys.argv[2]
src = open(os.path.join(os.path.dirname(os.path.abspath(hb)), "Client", "Game.cpp"), encoding="latin-1").read() if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(hb)), "Client", "Game.cpp")) else None
if src is None:
    src = open(sys.argv[3], encoding="latin-1").read()
sd = os.path.join(out, "equip")
os.makedirs(sd, exist_ok=True)
pak = PakFolder(os.path.join(hb, "SPRITES"))

KIND = {"BODYARMOR": ("a", 15), "BERK": ("b", 15), "LEGG": ("l", 15), "BOOT": ("o", 15), "MANTLE": ("m", 15),
        "HEAD": ("h", 15), "WEAPON": ("w", 64), "SHIELD": ("s", 8)}
ent = []   # (pak, parte, g, pieza, sub0, cuenta, primer sprite del pak)
r1 = re.compile(r'MakeSprite\(\s*"([\w-]+)"\s*,\s*DEF_SPRID_(\w+?)_([MW])\s*\+\s*(\d+)\s*\*\s*(\d+)\s*,\s*(\d+)')
for m in r1.finditer(src):
    pk, part, g, a, b, cnt = m.groups()
    if part in KIND: ent.append((pk, part, g, int(a) * int(b), int(cnt), 0))
r2 = re.compile(r'for \(i = 0; i < (\d+); i\+\+\)\s*m_pSprite\[DEF_SPRID_(\w+?)_([MW])\s*\+\s*i\s*\+\s*(\d+)\s*\*\s*(\d+)\]\s*=\s*new class CSprite\(m_hPakFile,\s*&m_DDraw,\s*"([\w-]+)",\s*i\s*\+\s*(\d+)\s*\*\s*(\d+)')
for m in r2.finditer(src):
    cnt, part, g, a, b, pk, c, d = m.groups()
    if part in KIND: ent.append((pk, part, g, int(a) * int(b), int(cnt), int(c) * int(d)))

man = {}
n = 0
for pk, part, g, off, cnt, first in ent:
    letter, stride = KIND[part]
    gi = 0 if g == "M" else 1
    piece, sub0 = divmod(off, stride)
    for i in range(cnt):
        piece_i, sub = divmod(off + i, stride)
        key = "%s%d_%d_%d" % (letter, gi, piece_i, sub)
        if key in man: continue
        if export(pak, pk, first + i, sd, key, man): n += 1
# objetos en suelo y mochila: todas las hojas
for name, tag in (("item-ground", "ig"), ("item-pack", "ip"), ("item-dynamic", "id")):
    d = pak.data(name)
    if d is None: continue
    total = struct.unpack_from("<i", d, 20)[0]
    for i in range(total):
        if export(pak, name, i, sd, "%s%d" % (tag, i), man): n += 1
json.dump(man, open(os.path.join(out, "equip.json"), "w"), separators=(",", ":"))
print(n, "sprites de equipo")
