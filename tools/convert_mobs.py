"""Exporta todos los monstruos de NPC.cfg: sprites (40 hojas: 8 direcciones x 5 estados), sonidos y fichas.
    python convert_mobs.py CARPETA_HELBREATH CARPETA_SERVIDOR SALIDA
Tabla tipo -> sprite tomada de ErkoKnoll/helbreath-base-game y juanrossi/helbreath (NPC_SPRITE_MAP, ids de NPC.cfg);
los sonidos (M<n>: andar, +1 atacar, +2 daño, +3 morir) salen de tools/ref/Monsters.ts.
Cada hoja del .pak trae sus propios fotogramas, así que el cliente anima con los que tenga."""
import json, os, re, shutil, sys
from convert import PakFolder, export, read_npc_cfg

hb, server, out = sys.argv[1:4]
MOBS = {10: "slm", 11: "ske", 12: "gol", 13: "cyc", 14: "orc", 16: "ant", 17: "scp", 18: "zom", 22: "amp", 23: "cla",
        27: "helb", 28: "troll", 29: "orge", 30: "liche", 31: "demon", 32: "unicorn", 33: "werewolf", 34: "dummy",
        48: "stalker", 49: "hellclaw", 50: "tigerworm", 52: "gagoyle", 53: "beholder", 54: "darkelf", 55: "bunny",
        56: "cat", 57: "giantfrog", 58: "mtgiant", 59: "ettin", 60: "giantplant", 61: "rudolph", 62: "direboar",
        63: "frost", 64: "crop", 65: "icegolem", 66: "wyvern", 71: "centaurus", 72: "clawturtle", 73: "firewyvern",
        74: "giantcrayfish", 75: "giantlizard", 76: "giantplant", 77: "mastermageorc", 78: "minotaurs", 79: "nizie",
        80: "tentocle"}
# sonido base por sprite (Monsters.ts: states.move.sound = 'M<n>.mp3')
ref = open(os.path.join(os.path.dirname(__file__), "ref", "Monsters.ts"), encoding="utf-8").read()
SND = {}
for m in re.finditer(r"spriteName:\s*'(\w+)',(.*?)corpseDecayTime", ref, re.S):
    mv = re.search(r"move:\s*\{\s*sound:\s*'M(\d+)\.mp3'", m.group(2))
    if mv: SND[m.group(1).lower()] = int(mv.group(1))

pak = PakFolder(os.path.join(hb, "SPRITES"))
sdir = os.path.join(out, "sprites")
man_path, npc_path = os.path.join(out, "sprites.json"), os.path.join(out, "npc.json")
manifest, npcs = json.load(open(man_path)), json.load(open(npc_path))
cfg = read_npc_cfg(os.path.join(server, "Files", "NPC.cfg"))
by_type = {}
for k, v in cfg.items(): by_type.setdefault(v["type"], k)
snd_dir = os.path.join(out, "sfx"); os.makedirs(snd_dir, exist_ok=True)
snd_names = {f.lower(): f for f in os.listdir(os.path.join(hb, "SOUNDS"))}
done = set()
for t, key in sorted(MOBS.items()):
    name = by_type.get(t)
    if not name: print("  sin ficha en NPC.cfg:", t, key); continue
    total = 0
    if key not in done:
        for n in range(40):
            if export(pak, key, n, sdir, "%s%d" % (key, n), manifest): total += 1
        done.add(key)
    base = SND.get(key, 0)
    for i in range(4 if base else 0):
        real = snd_names.get("m%d.wav" % (base + i))
        if real: shutil.copy(os.path.join(hb, "SOUNDS", real), os.path.join(snd_dir, "M%d.wav" % (base + i)))
    old = npcs.get(name, {})
    npcs[name] = dict(cfg[name], sprite=key, sound=base, **({"town": True} if old.get("town") else {}))
json.dump(manifest, open(man_path, "w"), separators=(",", ":"))
json.dump(npcs, open(npc_path, "w"), indent=1)
print("monstruos:", len(done), "sprites; fichas NPC:", len(npcs))
