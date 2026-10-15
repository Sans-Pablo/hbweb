// No se entra en la granja del bando enemigo (HG.cpp iGetMapLocationSide + denegación de teletransporte ~11714).
// node tests/farm-side.test.mjs
import { enemyMap, FARM_SIDE } from "../web/src/shared/adventure.js";
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
assert(FARM_SIDE.arefarm === 1 && FARM_SIDE.elvfarm === 2, "lados de las granjas");
assert(!enemyMap({ side: 1 }, "arefarm"), "Aresden entra en su granja");
assert(enemyMap({ side: 1 }, "elvfarm"), "Aresden no entra en Elvfarm");
assert(enemyMap({ side: 2 }, "arefarm"), "Elvine no entra en Aresfarm");
assert(!enemyMap({ side: 2 }, "elvfarm"), "Elvine entra en su granja");
assert(!enemyMap({ side: 0 }, "elvfarm"), "el neutral entra");
assert(!enemyMap({ side: 1, gm: true }, "elvfarm"), "el GM entra");
assert(!enemyMap({ side: 1 }, "2ndmiddle"), "Promise Land es libre");
console.log("OK farm-side");
