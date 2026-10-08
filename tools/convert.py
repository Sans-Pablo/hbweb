"""
Convierte un mapa de Helbreath (.amd) y los sprites que usa (.pak) a un formato
que entiende el navegador: PNG con transparencia + JSON con los fotogramas.

    python convert.py CARPETA_HELBREATH SALIDA [mapa] [CARPETA_REPOSITORIO_SERVIDOR]

Formato .pak (Client/Sprite.cpp, Client/Mydib.cpp):
  offset 20          -> número de sprites (int32)
  offset 24 + n*8    -> inicio del sprite n (int32)
  inicio + 100       -> número de fotogramas (int32)
  inicio + 104       -> fotogramas: 6 x int16 (sx, sy, ancho, alto, pivote_x, pivote_y)
  inicio + 108 + 12*fotogramas -> un BMP completo con la hoja de sprites
  El color del píxel (0,0) de la hoja es el color transparente.
Formato .amd (Client/MapData.cpp): 256 bytes de cabecera de texto y luego, fila a fila,
  10 bytes por casilla: sprite_suelo, frame_suelo, sprite_objeto, frame_objeto (int16) y flags.
"""
import io
import json
import os
import re
import shutil
import subprocess
import struct
import sys

from PIL import Image

from tile_table import locate


PLAYER_GROUPS = (0, 1, 2, 3, 4, 6, 8, 9, 10, 11)

# número de monstruo de "spot-mob-generator" -> nombre en NPC.cfg (HGServer/Game.cpp)
SPOT_MOB_NAMES = {10: "Slime", 16: "Giant-Ant", 17: "Scorpion", 12: "Stone-Golem", 22: "Amphis",
                  11: "Skeleton", 14: "Orc", 18: "Zombie", 13: "Cyclops", 23: "Clay-Golem"}
# probabilidad (%) de que nazca como monstruo especial y de qué tipo (mismo switch del servidor)
SPECIAL = {10: (5, 1), 16: (10, 2), 17: (15, 3), 12: (25, 5), 22: (20, 3)}
# sprites de cada monstruo (Client/Game.cpp, MakeSprite)
# música de cada mapa (Client/Game.cpp: los que no están en la lista usan MainTm)
MAP_MUSIC = {"aresden": "aresden", "elvine": "elvine", "middleland": "middleland", "druncncity": "druncncity", "abaddon": "abaddon"}
MOB_SOUNDS = {10: 1, 16: 29, 17: 21, 12: 33, 22: 25}
MOB_PAKS = {10: "slm", 16: "Ant", 17: "Scp", 12: "Gol", 22: "Amp"}

NPC_COLUMNS = ["type", "hitDice", "defenseRatio", "hitRatio", "minBravery", "expMin", "expMax",
               "goldMin", "goldMax", "attackDiceThrow", "attackDiceRange", "size", "side", "actionLimit",
               "actionTime", "resistMagic", "magicLevel", "dayOfWeek", "chat", "searchRange",
               "regenTime", "attribute", "absDamage", "maxMana", "magicHitRatio", "attackRange", "areaSize"]


def read_npc_cfg(path):
    """Files/NPC.cfg: 'Npc = Nombre  valores...' (columnas en la cabecera del archivo)."""
    out = {}
    for line in open(path, encoding="latin-1"):
        m = re.match(r"\s*Npc\s*=\s*(\S+)\s+(.*)", line)
        if not m:
            continue
        vals = [int(v) for v in m.group(2).split()]
        out[m.group(1)] = dict(zip(NPC_COLUMNS, vals))
    return out


def read_spawns(server, map_name):
    """spot-mob-generator = n  tipo  x1 y1 x2 y2  monstruo  máximo  (Files/GameServers/*/MAPDATA/mapa.txt)"""
    for root, _, files in os.walk(os.path.join(server, "Files")):
        for f in files:
            if f.lower() == map_name.lower() + ".txt":
                spawns = []
                for line in open(os.path.join(root, f), encoding="latin-1"):
                    line = line.split("//")[0]
                    m = re.match(r"\s*spot-mob-generator\s*=\s*(.*)", line)
                    if not m:
                        continue
                    v = [int(x) for x in m.group(1).split()]
                    if len(v) >= 8 and v[1] == 1:
                        prob, kind = SPECIAL.get(v[6], (0, 0))
                        spawns.append({"id": v[0], "rect": v[2:6], "mob": v[6], "max": v[7],
                                       "specialProb": prob, "specialKind": kind})
                return spawns
    return []


class PakFolder:
    def __init__(self, folder):
        self.folder = folder
        self.names = {f.lower(): f for f in os.listdir(folder)}
        self.cache = {}

    def data(self, name):
        key = name.lower() + ".pak"
        if key not in self.cache:
            real = self.names.get(key)
            self.cache[key] = open(os.path.join(self.folder, real), "rb").read() if real else None
        return self.cache[key]

    def sprite(self, name, nth):
        d = self.data(name)
        if d is None:
            return None
        total = struct.unpack_from("<i", d, 20)[0]
        if nth >= total:
            return None
        start = struct.unpack_from("<i", d, 24 + nth * 8)[0]
        nframes = struct.unpack_from("<i", d, start + 100)[0]
        frames = [list(struct.unpack_from("<6h", d, start + 104 + 12 * i)) for i in range(nframes)]
        bmp_at = start + 108 + 12 * nframes
        size = struct.unpack_from("<I", d, bmp_at + 2)[0]
        img = Image.open(io.BytesIO(d[bmp_at:bmp_at + size]))
        img.load()
        rgb = img.convert("RGB")
        key = rgb.getpixel((0, 0))
        rgba = rgb.convert("RGBA")
        px = rgba.load()
        w, h = rgba.size
        for y in range(h):
            for x in range(w):
                if px[x, y][:3] == key:
                    px[x, y] = (0, 0, 0, 0)
        return rgba, frames


def export(pak, name, nth, out_dir, tag, manifest):
    res = pak.sprite(name, nth)
    if res is None:
        print("  falta:", name, nth)
        return False
    img, frames = res
    # recortar la hoja a lo que usan los fotogramas (las hojas suelen ser 640x480 casi vacías)
    if frames:
        w = max(f[0] + f[2] for f in frames)
        h = max(f[1] + f[3] for f in frames)
        img = img.crop((0, 0, min(w, img.width), min(h, img.height)))
    fn = "%s.png" % tag
    img.save(os.path.join(out_dir, fn), optimize=True)
    manifest[tag] = {"png": fn, "frames": frames}
    return True


ITEM_FIELDS = ["type", "equipPos", "effectType", "v1", "v2", "v3", "v4", "v5", "v6", "maxLife", "specialEffect",
               "sprite", "spriteFrame", "price", "weight", "appr", "speed", "levelLimit", "gender",
               "seV1", "seV2", "skill", "category", "color"]

def read_items(server, hb):
    """Item.cfg + Item2.cfg + Item3.cfg del servidor -> {id: {name, display, ...}} (ids únicos entre los tres)."""
    import re
    items = {}
    for fn in ("Item.cfg", "Item2.cfg", "Item3.cfg"):
        path = os.path.join(server, "Files", fn)
        for line in open(path, encoding="latin-1"):
            if line.strip().startswith("[ENDITEMLIST]"): break
            m = re.match(r"\s*Item\s*=\s*(\d+)\s+(\S+)\s+(.*)", line)
            if not m: continue
            nums = m.group(3).split()
            if len(nums) < len(ITEM_FIELDS): continue
            it = {"name": m.group(2)}
            for k, v in zip(ITEM_FIELDS, nums): it[k] = int(v)
            items[int(m.group(1))] = it
    # nombres para mostrar (ItemName.cfg del cliente)
    names = {}
    nm = os.path.join(hb, "CONTENTS", "ItemName.cfg")
    if os.path.exists(nm):
        for line in open(nm, encoding="latin-1"):
            parts = [x for x in re.split(r"[=\r\n]+", line) if x.strip()]
            if len(parts) >= 3 and parts[0].strip() == "Item": names[parts[1].strip()] = parts[2].strip()
    for it in items.values(): it["display"] = names.get(it["name"], it["name"])
    return items


MAGIC_FIELDS = ["type", "delay", "last", "mana", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", "v11", "v12",
                "reqInt", "cost", "category", "attr"]

def read_magic(server):
    """Files/Magic.cfg -> {id: {name, type, delay, last, mana, v2..v12, reqInt, cost, category, attr}}"""
    import re
    out = {}
    for line in open(os.path.join(server, "Files", "Magic.cfg"), encoding="latin-1"):
        m = re.match(r"\s*magic\s*=\s*(\d+)\s+(\S+)\s+(.*)", line)
        if not m: continue
        nums = m.group(3).split()
        if len(nums) < len(MAGIC_FIELDS): continue
        d = {"name": m.group(2).replace("-", " ")}
        for k, v in zip(MAGIC_FIELDS, nums): d[k] = int(v)
        out[int(m.group(1))] = d
    return out


def main():
    hb, out = sys.argv[1], sys.argv[2]
    map_name = sys.argv[3] if len(sys.argv) > 3 else "arefarm"
    server = sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].startswith("--") else None     # carpeta del repositorio HelbreathServer
    sprites_dir = os.path.join(out, "sprites")
    os.makedirs(sprites_dir, exist_ok=True)
    pak = PakFolder(os.path.join(hb, "SPRITES"))

    # --- mapa
    mapdir = os.path.join(hb, "MAPDATA")
    amd = next(f for f in os.listdir(mapdir) if f.lower() == map_name.lower() + ".amd")
    raw = open(os.path.join(mapdir, amd), "rb").read()
    head = raw[:256].replace(b"\0", b" ").decode("latin-1")
    w = int(re.search(r"MAPSIZEX\s*=\s*(\d+)", head).group(1))
    h = int(re.search(r"MAPSIZEY\s*=\s*(\d+)", head).group(1))
    body = raw[256:256 + w * h * 10]
    open(os.path.join(out, map_name + ".bin"), "wb").write(body)

    used = set()
    for i in range(w * h):
        ts, tf, os_, of = struct.unpack_from("<hhhh", body, i * 10)
        used.add(ts)
        if os_:
            used.add(os_)
            if 100 <= os_ < 150:
                used.add(os_ + 50)         # sombra del árbol
    manifest = {}
    print("Mapa %s: %dx%d, %d sprites de mapa" % (map_name, w, h, len(used)))
    for idx in sorted(used):
        loc = locate(idx)
        if loc:
            export(pak, loc[0], loc[1], sprites_dir, "t%d" % idx, manifest)

    # --- personaje (hombre blanco, Wm.pak: 12 grupos x 8 direcciones) y su ropa interior y pelo.
    # Grupos (Client/Game.cpp, DrawObject_On*): 0 quieto, 1 quieto en combate, 2 andar,
    # 3 andar en combate, 4 correr, 6 atacar (sin arma o arma corta), 9 recoger,
    # 10 recibir daño, 11 morir. Mpt/Mhr: un sprite por grupo (8 direcciones x fotogramas).
    for group in PLAYER_GROUPS:
        for d in range(8):
            n = group * 8 + d
            export(pak, "Wm", n, sprites_dir, "wm%d" % n, manifest)
        export(pak, "Mpt", group, sprites_dir, "mpt%d" % group, manifest)
        export(pak, "Mhr", 12 * 1 + group, sprites_dir, "mhr%d" % group, manifest)   # peinado 1
    # --- monstruos: 5 grupos x 8 direcciones (0 quieto, 1 andar, 2 atacar, 3 daño, 4 morir)
    for pak_name in MOB_PAKS.values():
        for n in range(40):
            export(pak, pak_name, n, sprites_dir, "%s%d" % (pak_name.lower(), n), manifest)

    # --- sonidos (Client/MapData.cpp): monstruo base = andar, +1 atacar, +2 daño, +3 morir;
    # C1 golpe al aire, C5/C6 impacto (sin arma / arma corta), C8 paso, C12 quejido, C14 muerte.
    # Música: data/music/<pista>.mp3 (original) y <pista>.remaster.mp3 (con --remaster).
    sfx_dir = os.path.join(out, "sfx")
    os.makedirs(sfx_dir, exist_ok=True)
    sounds = ["C1", "C5", "C6", "C8", "C12", "C14"]
    for base in MOB_SOUNDS.values():
        sounds += ["M%d" % (base + i) for i in range(4)]
    snd_names = {f.lower(): f for f in os.listdir(os.path.join(hb, "SOUNDS"))}
    for name in sounds:
        real = snd_names.get(name.lower() + ".wav")
        if real:
            shutil.copy(os.path.join(hb, "SOUNDS", real), os.path.join(sfx_dir, name + ".wav"))
    music_dir = os.path.join(out, "music")
    os.makedirs(music_dir, exist_ok=True)
    track = MAP_MUSIC.get(map_name.lower(), "MainTm")
    music = os.path.join(hb, "MUSIC", track + ".wav")
    if os.path.exists(music) and shutil.which("ffmpeg"):
        # original, tal cual (estéreo); la versión remasterizada la hace remaster_music.py
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", music, "-ac", "2", "-b:a", "96k",
                        os.path.join(music_dir, track.lower() + ".mp3")], check=True)
        if "--remaster" in sys.argv:
            import remaster_music
            remaster_music.remaster(music, os.path.join(music_dir, track.lower() + ".remaster.mp3"))

    # --- objetos en el suelo (item-ground.pak, sprite 6 de Item.cfg -> índice 5): oro y pociones
    for n in range(20):
        export(pak, "item-ground", n, sprites_dir, "ig%d" % n, manifest)   # suelo: sprite de Item.cfg = n+1
        export(pak, "item-pack", n, sprites_dir, "ip%d" % n, manifest)     # icono de mochila: igual

    # --- datos del servidor: NPC.cfg y generadores de monstruos del mapa
    if server:
        npcs = read_npc_cfg(os.path.join(server, "Files", "NPC.cfg"))
        spawns = read_spawns(server, map_name)
        used_types = {s["mob"] for s in spawns}
        npc_out = {}
        for mob in sorted(used_types):
            name = SPOT_MOB_NAMES.get(mob)
            if name in npcs and mob in MOB_PAKS:
                npc_out[name] = dict(npcs[name], sprite=MOB_PAKS[mob].lower(), sound=MOB_SOUNDS[mob])
        spawns = [s for s in spawns if SPOT_MOB_NAMES.get(s["mob"]) in npc_out]
        for s in spawns:
            s["name"] = SPOT_MOB_NAMES[s["mob"]]
        json.dump(npc_out, open(os.path.join(out, "npc.json"), "w"), indent=1)
        items = read_items(server, hb)
        json.dump(items, open(os.path.join(out, "items.json"), "w"), separators=(",", ":"))
        print("ítems:", len(items))
        magic = read_magic(server)
        json.dump(magic, open(os.path.join(out, "magic.json"), "w"), separators=(",", ":"))
        print("hechizos:", len(magic))
        json.dump(spawns, open(os.path.join(out, map_name + ".spawns.json"), "w"), indent=1)
        print("Monstruos: %s; %d generadores" % (", ".join(npc_out), len(spawns)))

    # teleports del mapa (para pintarlos) desde el .txt del servidor si existe
    meta = {"map": map_name, "w": w, "h": h, "start": [127, 91], "music": MAP_MUSIC.get(map_name.lower(), "MainTm").lower()}
    json.dump(manifest, open(os.path.join(out, "sprites.json"), "w"), separators=(",", ":"))
    json.dump(meta, open(os.path.join(out, "map.json"), "w"))
    total = sum(os.path.getsize(os.path.join(sprites_dir, f)) for f in os.listdir(sprites_dir))
    print("Listo: %d imágenes, %.1f MB" % (len(manifest), total / 1e6))


if __name__ == "__main__":
    main()
