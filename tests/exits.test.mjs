// Salidas del mapa señaladas (ticket 6): todo destino de teleport de la granja tiene nombre legible (MAP_NAMES) para el rótulo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAP_NAMES, ALLOWED_MAPS } from "../web/src/shared/adventure.js";
const meta = JSON.parse(readFileSync(new URL("../web/data/maps/arefarm.json", import.meta.url), "utf8"));
const tps = meta.teleports || meta.meta?.teleports || [];
assert.ok(tps.length > 0, "la granja tiene teleports");
for (const t of tps) assert.ok(MAP_NAMES[t.map.toLowerCase()], "sin nombre: " + t.map);
assert.ok(ALLOWED_MAPS.has("2ndmiddle") && !ALLOWED_MAPS.has("aresden"), "Promise Land abierto, Aresden cerrado");
console.log("exits OK");
