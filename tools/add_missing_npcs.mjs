// Añade a web/data/npc.json los NPC de Npc.cfg (original) que faltan. Aditivo: no toca los existentes.
// Columnas: Npc.cpp / HG.cpp (bReadNpcConfig). Exp: el port usa expMin/expMax = ExpDice*28 / *35 (misma razón que Orc: 20 -> 560/700).
// Sprite: por tipo según data/units.json (convert_units.py); Orc-Mage reutiliza orc y Attack-Dummy el de Dummy. Sin sprite exportado -> se omite.
import fs from "node:fs";
const [cfg, out = "web/data"] = process.argv.slice(2);
const npc = JSON.parse(fs.readFileSync(out + "/npc.json")), units = JSON.parse(fs.readFileSync(out + "/units.json"));
const sheets = JSON.parse(fs.readFileSync(out + "/sprites.json"));
const byType = {}; for (const u of Object.values(units)) if (u.type && !(u.type in byType)) byType[u.type] = u.sprite;
const lines = fs.readFileSync(cfg, "utf8").split(/\r?\n/).filter(l => /^Npc\s*=/.test(l)).map(l => l.split(/\s+/));
const skipped = []; let added = 0;
for (const c of lines) {
  const name = c[2]; if (npc[name]) continue;
  const n = c.slice(3).map(Number), [type, hd, dr, hr, br, ed, adt, adr, size, side, al, at, mr, ml, dow, chat, sr, reg, attr, abs, mana, mhr, ar, gold] = n;
  let sprite = name === "Orc-Mage" ? "orc" : name === "Attack-Dummy" ? npc.Dummy?.sprite : byType[type];
  if (!sprite || !sheets[sprite + "0"]) { skipped.push(name); continue; }
  npc[name] = { type, hitDice: hd, defenseRatio: dr, hitRatio: hr, minBravery: br, expMin: ed * 28, expMax: ed * 35, goldMin: gold, goldMax: gold,
    attackDiceThrow: adt, attackDiceRange: adr, size, side, actionLimit: al, actionTime: at, resistMagic: mr, magicLevel: ml, dayOfWeek: dow, chat, searchRange: sr,
    regenTime: reg, attribute: attr, absDamage: abs, maxMana: mana, magicHitRatio: mhr, attackRange: ar, areaSize: 0, sprite, sound: npc.Orc?.sound ?? 0 };
  added++;
}
fs.writeFileSync(out + "/npc.json", JSON.stringify(npc, null, 1));
console.log("añadidos", added, "omitidos (sin sprite):", skipped.join(" "));
