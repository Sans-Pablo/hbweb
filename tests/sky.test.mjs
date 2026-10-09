// Hora del día, clima y zonas sin ataque (HGServer/Game.cpp: _CheckDayOrNight, WhetherProcessor, _SetupNoAttackArea).
// node tests/sky.test.mjs
import { readFileSync } from "node:fs";
import { Grid } from "../web/src/shared/grid.js";
import { Adventure } from "../web/src/shared/adventure.js";
import { GameData } from "../web/src/shared/data.js";
import { MAGIC_MODE } from "../web/src/shared/magic.js";
import { NIGHT_MINUTE, bowHitWithWeather, extraWeaponWear } from "../web/src/shared/systems/weather.js";

MAGIC_MODE.free = true;
const D = new URL("../web/data/", import.meta.url);
const J = f => JSON.parse(readFileSync(new URL(f, D)));
const meta = J("map.json"), bytes = new Uint8Array(readFileSync(new URL(meta.map + ".bin", D)));
const npcDb = J("npc.json"), data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const maps = {};
for (const id of Object.keys(J("maps/index.json"))) { const m = J("maps/" + id + ".json"); maps[id] = { meta: m, grid: id === "arefarm" ? null : new Grid(m.w, m.h, new Uint8Array(readFileSync(new URL("maps/" + id + ".bin", D)))) }; }
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };

let minute = 10;
const A = new Adventure({ grid: new Grid(meta.w, meta.h, bytes), npcDb, data, spawns: [], start: meta.start, maps, clock: () => minute });
const pid = A.addPlayer("tester");
const farm = A.farm, p = farm.ents.get(pid);

// día / noche según el minuto del reloj (>= 40 es de noche) y aviso al cambiar
assert(NIGHT_MINUTE === 40, "DEF_NIGHTTIME");
farm.tick(6000);
assert(farm.dayOrNight === 1, "a las :10 es de día");
minute = 45; farm.tick(6000);
assert(farm.dayOrNight === 2 && farm.events.some(e => e.t === "time" && e.v === 2), "a las :45 es de noche");
minute = 5; farm.tick(6000);
assert(farm.dayOrNight === 1, "vuelve el día");

// los mapas de día fijo no tienen noche ni clima
minute = 50;
const shop = A.staticWorld("gshop_1f");
assert(shop.fixedDay, "gshop_1f es de día fijo");
shop.tick(30000);
assert(shop.dayOrNight === 1 && shop.weather === 0, "tienda: siempre de día y despejado");

// clima: empieza con 1/300 cada 20 s y dura 3 + 1d7 minutos; con rng que siempre da 13 empieza en la primera revisión
{
  const w = A.staticWorld("aresden");
  w.rng = () => 12 / 300 + 0.0001;                   // dice(1,300) = 13
  minute = 5;
  w.tick(21000);
  assert(w.weather >= 1 && w.weather <= 3, "empieza a llover: " + w.weather);
  assert(w.weatherUntil - w.time >= 60000 * 3 && w.weatherUntil - w.time <= 60000 * 10, "dura entre 4 y 10 minutos");
  assert(w.events.some(e => e.t === "weather"), "se avisa del clima");
  w.rng = () => 0.5; w.tick(60000 * 11);
  assert(w.weather === 0, "escampa");
}

// efectos de la lluvia sobre arcos y armas
assert(bowHitWithWeather(100, 0) === 100 && bowHitWithWeather(100, 1) === 95 && bowHitWithWeather(100, 2) === 90 && bowHitWithWeather(100, 3) === 75, "acierto del arco con lluvia");
{
  const w = { weather: 3, rng: () => 0 };               // d2 = 1, d3 = 1
  assert(extraWeaponWear(w) === 1, "desgaste extra con lluvia fuerte");
  w.weather = 0; assert(extraWeaponWear(w) === 0, "sin lluvia no hay desgaste extra");
}

// zona sin ataque: los hechizos de ataque no se lanzan desde ella (tampoco a menos de 20 casillas del borde)
{
  const w = A.staticWorld("aresden"), q = w.ents.get(pid) || (() => { A.transfer(p, farm, w, [150, 150]); return p; })();
  assert(!w.safeAt(100, 100), "zona libre");
  assert(w.safeAt(10, 100) && w.safeAt(290, 100), "borde");
  const r = (maps.aresden.meta.noAttack || [])[0];
  assert(r && w.safeAt(r[0] + 1, r[1] + 1), "rectángulo sin ataque");
  void q;
}
assert(A.staticWorld("gshop_1f").safeAt(50, 50), "tienda: todo el mapa sin ataque");

console.log("OK");
