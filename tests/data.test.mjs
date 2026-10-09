// Coherencia de los datos generados (web/data): lo que un conversor deja a medias suele romper el juego mucho después.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const D = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "web", "data");
const J = f => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const npc = J("npc.json"), sprites = J("sprites.json"), items = J("items.json"), shops = J("shops.json"), maps = J("maps/index.json");
const byName = new Map(Object.values(items).map(i => [i.name, i]));

// todo sprite del manifiesto tiene su hoja en disco
for (const [k, v] of Object.entries(sprites)) {
  if (!v.png) continue;
  const f = path.join(D, "sprites", v.png);
  if (!fs.existsSync(f) && !fs.existsSync(path.join(D, v.png))) assert.fail("falta la hoja de " + k + ": " + v.png);
}

// cada NPC tiene sus sprites (8 direcciones los de ciudad)
for (const [name, c] of Object.entries(npc)) {
  assert.ok(c.sprite, name + " sin sprite");
  assert.ok(sprites[c.sprite + "0"] || sprites[c.sprite + "8"], name + ": faltan los sprites " + c.sprite);
  if (c.town) for (let d = 0; d < 8; d++) assert.ok(sprites[c.sprite + d], name + ": falta " + c.sprite + d);
}

// los NPC de ciudad que usa el juego existen con el tipo del servidor
const TOWN = { "ShopKeeper-W": 15, Gandlf: 19, Howard: 20, Tom: 24 };
for (const [n, t] of Object.entries(TOWN)) { assert.equal(npc[n]?.type, t, n); assert.equal(npc[n].town, true, n + " sin town"); }

// las dos listas de venta: cada objeto existe en Item.cfg y tiene precio
for (const [shop, rows] of Object.entries(shops)) {
  assert.ok(rows.length > 0, "tienda " + shop + " vacía");
  for (const r of rows) {
    const base = r.name.replace(/^(10|100)Arrows$/, "Arrow");
    const it = byName.get(base);
    assert.ok(it, "tienda " + shop + ": " + r.name + " no está en items.json");
    assert.ok(r.price > 0, r.name + " sin precio");
    assert.equal(typeof r.display, "string");
  }
}

// mapas: teleports a mapas que existen y NPC conocidos (los que faltan se cuentan, no fallan)
let missingNpc = new Set(), missingMap = new Set();
for (const id of Object.keys(maps)) {
  const m = J("maps/" + id + ".json");
  assert.equal(m.id, id);
  for (const t of m.teleports || []) if (!maps[t.map.toLowerCase()] && t.map !== "arefarm") missingMap.add(t.map);
  for (const n of m.npcs || []) if (!npc[n.name]) missingNpc.add(n.name);
}
console.log("datos: mapas", Object.keys(maps).length, "| NPC sin portar:", [...missingNpc].sort().join(", ") || "-", "| teleports a mapas no exportados:", [...missingMap].sort().join(", ") || "-");
console.log("OK");
