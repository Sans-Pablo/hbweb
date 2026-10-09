"""Paleta de teselas de la cripta de esqueletos, extraída de los mapas originales de dungeon (middled1n y middled1x).
    python3 tools/build_dungeon_palette.py            ->  web/data/dungeon_palette.json
La cripta procedural (shared/dungeon.js) solo usa teselas que aparecen en esos mapas:
  - floor / deep: texturas repetitivas (bloques de 6x4 casillas): sprite, fila-base, variante y desfase (kx, ky) más frecuente.
  - edge: bordes y acantilados, indexados por la máscara 5x5 de casillas bloqueadas alrededor (25 bits, centro incluido).
  - decor: objetos sueltos (obj 211)."""
import json, struct, os, collections
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "web", "data")
SRC = ["middled1n", "middled1x"]
edge = collections.defaultdict(collections.Counter)
floor = collections.defaultdict(collections.Counter); deep = collections.defaultdict(collections.Counter)
decor = collections.Counter()

def tex(spr, frame, x, y):
    r, c = divmod(frame, 20)
    if c >= 18: return None                                   # no es un bloque de 6 columnas
    v, c6 = divmod(c, 6)
    return (spr, r - r % 4, v), ((c6 - x) % 6, ((r % 4) - y) % 4)

for name in SRC:
    mj = json.load(open(os.path.join(DATA, "maps", name + ".json"))); W, H = mj["w"], mj["h"]
    b = open(os.path.join(DATA, "maps", name + ".bin"), "rb").read()
    cells = [struct.unpack_from("<hhhhB", b, i * 10) for i in range(W * H)]
    blk = lambda x, y: 1 if (x < 0 or y < 0 or x >= W or y >= H or cells[y * W + x][4] & 0x80) else 0
    for y in range(H):
        for x in range(W):
            s, f, o, of, fl = cells[y * W + x]
            m = 0
            for dy in range(-2, 3):
                for dx in range(-2, 3): m = (m << 1) | blk(x + dx, y + dy)
            self_blocked = fl & 0x80
            if o == 211: decor[(o, of, s, f)] += 1
            if m == 0 and not self_blocked:
                t = tex(s, f, x, y)
                if t: floor[t[0]][t[1]] += 1
            elif m == (1 << 25) - 1 and self_blocked:
                t = tex(s, f, x, y)
                if t: deep[t[0]][t[1]] += 1
            else:
                edge["%x" % m][(s, f, o, of)] += 1

def pack(d, minc=40):
    out = []
    for (spr, rb, v), offs in sorted(d.items(), key=lambda kv: -sum(kv[1].values())):
        n = sum(offs.values())
        if n < minc: continue
        (kx, ky), _ = offs.most_common(1)[0]
        out.append([spr, rb, v, kx, ky, n])
    return out
pal = {"version": 1, "src": SRC,
       "floor": pack(floor), "deep": pack(deep),
       "edge": {k: [list(t) for t, _ in v.most_common(3)] for k, v in edge.items()},
       "decor": [[o, of, s, f] for (o, of, s, f), _ in decor.most_common(6)]}
json.dump(pal, open(os.path.join(DATA, "dungeon_palette.json"), "w"), separators=(",", ":"))
print("floor", pal["floor"][:6]); print("deep", pal["deep"][:6]); print("edge keys", len(pal["edge"]), "samples", sum(len(v) for v in pal["edge"].values()), "decor", pal["decor"])
print(os.path.getsize(os.path.join(DATA, "dungeon_palette.json")), "bytes")
