"""Paleta de teselas de la cripta de esqueletos, extraída de los mapas originales de dungeon (middled1n y middled1x).
    python3 tools/build_dungeon_palette.py            ->  web/data/dungeon_palette.json
La cripta (shared/dungeon.js) recorta ventanas de esos mapas completos (srcMaps, RLE) y solo usa teselas que aparecen en ellos.
Sin agua ni puentes (hojas 305-309) en los bordes. Para sellar el corte usa:
  - floor / deep: texturas repetitivas (bloques de 6x4 casillas): sprite, fila-base, variante y desfase (kx, ky) más frecuente.
  - edge: bordes y acantilados, indexados por la máscara 5x5 de casillas bloqueadas alrededor (25 bits, centro incluido).
  - decor: objetos sueltos (obj 211)."""
import json, struct, os, collections
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "web", "data")
# (mapa, tema): las cámaras de cada rey usan el escenario de otro dungeon del original (ver convert_theme_maps.py)
SRC = [("middled1n", "cueva"), ("middled1x", "cueva"), ("dglv4", "fuego"), ("toh1", "sombra"), ("toh2", "sombra"), ("toh3", "sombra"), ("icebound", "hielo"), ("maze", "oro")]
LIMIT = {"fuego": 5, "oro": 5, "sombra": 2, "hielo": 3}       # recortes por mapa (las hojas con un solo mapa necesitan más variedad)
THEMES = ["cueva", "fuego", "sombra", "hielo", "oro"]
edgeT = {t: collections.defaultdict(collections.Counter) for t in THEMES}
floorT = {t: collections.defaultdict(collections.Counter) for t in THEMES}; deepT = {t: collections.defaultdict(collections.Counter) for t in THEMES}
decor = collections.Counter()

def tex(spr, frame, x, y):
    r, c = divmod(frame, 20)
    if c >= 18: return None                                   # no es un bloque de 6 columnas
    v, c6 = divmod(c, 6)
    return (spr, r - r % 4, v), ((c6 - x) % 6, ((r % 4) - y) % 4)

WATER = {305, 306, 307, 308, 309}                                 # hojas con agua (animadas) y puente: no se reutilizan
tiles = []; tindex = {}
def tid(t):
    if t not in tindex: tindex[t] = len(tiles); tiles.append(t)
    return tindex[t]
adjH = collections.Counter(); adjV = collections.Counter()
for name, theme in SRC:
    edge, floor, deep = edgeT[theme], floorT[theme], deepT[theme]
    mj = json.load(open(os.path.join(DATA, "maps", name + ".json"))); W, H = mj["w"], mj["h"]
    b = open(os.path.join(DATA, "maps", name + ".bin"), "rb").read()
    cells = [struct.unpack_from("<hhhhB", b, i * 10) for i in range(W * H)]
    water = lambda x, y: 0 <= x < W and 0 <= y < H and cells[y * W + x][0] in WATER
    kind = {}                                                  # casillas de borde (mascara no trivial) -> tesela, para la adyacencia
    blk = lambda x, y: 1 if (x < 0 or y < 0 or x >= W or y >= H or cells[y * W + x][4] & 0x80) else 0
    for y in range(H):
        for x in range(W):
            s, f, o, of, fl = cells[y * W + x]
            m = 0
            if any(water(x + dx, y + dy) for dy in range(-2, 3) for dx in range(-2, 3)): continue      # nada que ver con agua
            for dy in range(-2, 3):
                for dx in range(-2, 3): m = (m << 1) | blk(x + dx, y + dy)
            self_blocked = fl & 0x80
            if o == 211 and theme == "cueva": decor[(o, of, s, f)] += 1
            if m == 0 and not self_blocked:
                t = tex(s, f, x, y)
                if t: floor[t[0]][t[1]] += 1
            elif m == (1 << 25) - 1 and self_blocked:
                t = tex(s, f, x, y)
                if t: deep[t[0]][t[1]] += 1
            else:
                edge["%x" % m][(s, f, o, of)] += 1
                kind[(x, y)] = (s, f, o, of)
    for (x, y), t in kind.items():                              # pares vecinos (derecha / abajo) entre teselas de borde
        if (x + 1, y) in kind: adjH[(tid(t), tid(kind[(x + 1, y)]))] += 1
        if (x, y + 1) in kind: adjV[(tid(t), tid(kind[(x, y + 1)]))] += 1

def pack(d, minc=40):
    out = []
    for (spr, rb, v), offs in sorted(d.items(), key=lambda kv: -sum(kv[1].values())):
        n = sum(offs.values())
        if n < minc: continue
        (kx, ky), _ = offs.most_common(1)[0]
        out.append([spr, rb, v, kx, ky, n])
    return out
for T in THEMES:
    for v in edgeT[T].values():
        for t in list(v): tid(t)
# mapas completos (RLE) para que el generador recorte ventanas con las paredes tal cual las dibuja el original
src_tiles = []; src_index = {}; src_maps = []
for name, theme in SRC:
    mj = json.load(open(os.path.join(DATA, "maps", name + ".json"))); W, H = mj["w"], mj["h"]
    b = open(os.path.join(DATA, "maps", name + ".bin"), "rb").read()
    raw = [struct.unpack_from("<hhhhB", b, i * 10) for i in range(W * H)]
    tl = [(s_, f_, o_, of_, 1 if fl_ & 0x80 else (2 if fl_ else 0)) for s_, f_, o_, of_, fl_ in raw]       # 1 bloqueada, 2 otras banderas (teletransporte...), 0 libre
    def emit(x0, y0, w_, h_, nm):
        flat = []
        for yy in range(y0, y0 + h_):
            for xx in range(x0, x0 + w_):
                t = tl[yy * W + xx]
                if t not in src_index: src_index[t] = len(src_tiles); src_tiles.append(list(t))
                flat.append(src_index[t])
        rle = []; i = 0
        while i < len(flat):
            j = i
            while j < len(flat) and flat[j] == flat[i]: j += 1
            rle += [flat[i], j - i]; i = j
        src_maps.append({"name": nm, "theme": theme, "w": w_, "h": h_, "rle": rle})
    if theme == "cueva": emit(0, 0, W, H, name); continue
    # Escenarios de los reyes: no se guarda el mapa entero (pesa mucho), sino hasta 3 recortes de 90x90 sin agua ni casillas especiales y con
    # la mayor superficie libre; de ellos el generador recorta las ventanas de 60x60 / 36x36.
    C = 90; cand = []
    cnt = collections.Counter(t[0] for t in tl); main = {k for k, v in cnt.items() if v >= 0.025 * W * H}      # solo las hojas dominantes: sin manchas de hierba en el hielo
    for y0 in range(0, H - C + 1, 15):
        for x0 in range(0, W - C + 1, 15):
            bad = free = off = 0
            for yy in range(y0, y0 + C):
                for xx in range(x0, x0 + C):
                    t = tl[yy * W + xx]
                    if t[0] in WATER or t[4] == 2: bad += 1
                    elif t[0] not in main: off += 1
                    elif t[4] == 0: free += 1
            if not bad and off <= C * C * 0.03: cand.append((free, x0, y0))
    cand.sort(reverse=True); took = []
    for free, x0, y0 in cand:
        if len(took) >= LIMIT[theme] or free < C * C * 0.10: break
        if any(abs(x0 - a_) < C * 2 // 3 and abs(y0 - b_) < C * 2 // 3 for a_, b_ in took): continue
        took.append((x0, y0)); emit(x0, y0, C, C, name + "@%d,%d" % (x0, y0))
    print(name, "recortes", took, [c[0] for c in cand[:3]])
def sect(T):
    return {"floor": pack(floorT[T]), "deep": pack(deepT[T]), "edge": {k: [tindex[t] for t, _ in v.most_common(4)] for k, v in edgeT[T].items()}}
base = sect("cueva")
pal = {"version": 4, "srcTiles": src_tiles, "srcMaps": src_maps, "src": [n for n, _ in SRC], "tiles": [list(t) for t in tiles], "adjH": [list(k) for k in adjH], "adjV": [list(k) for k in adjV],
       "floor": base["floor"], "deep": base["deep"], "edge": base["edge"], "themes": {T: sect(T) for T in THEMES if T != "cueva"},
       "decor": [[o, of, s, f] for (o, of, s, f), _ in decor.most_common(6)]}
json.dump(pal, open(os.path.join(DATA, "dungeon_palette.json"), "w"), separators=(",", ":"))
print("floor", pal["floor"][:3]); print({T: (len(v["floor"]), len(v["edge"])) for T, v in pal["themes"].items()})
print(os.path.getsize(os.path.join(DATA, "dungeon_palette.json")), "bytes")
