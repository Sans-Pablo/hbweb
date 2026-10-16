// Texto de cast sobre el lanzador (Game.cpp:40047-40062) y tamaño de las bolas de compañero: contrato del cliente.
import { readFileSync } from "node:fs";
const assert = (c, m) => { if (!c) { console.error("FALLO:", m); process.exit(1); } };
const fx = readFileSync(new URL("../web/src/client/fx.js", import.meta.url), "utf8");
assert(/case "prepare": case "cast":[^]*?ev.anim === false[^]*?world\.data\?\.magic\?\.\[ev\.spell\][^]*?castMsgs\.set\(ev\.id/.test(fx), "el mensaje nace al iniciar el casting (prepare) o en el cast que arranca animación");
assert(/Trebuchet MS/.test(fx) && fx.includes("age > 352 ? 9 : age > 320 ? 10 : age >> 5"), "fuente y rareza de iLoc del original");
assert(/rgb\(180,30,30\)/.test(fx) && /age ?>> ?5/.test(fx) && /2000/.test(fx), "color, subida y duración del original");
const ci = readFileSync(new URL("../web/src/client/compicon.js", import.meta.url), "utf8");
const s = +/BALL_SCALE = ([\d.]+)/.exec(ci)[1], inner = +/BALL_INNER = ([\d.]+)/.exec(ci)[1];
assert(s <= 0.9 && inner < 0.6, "las bolas no son gigantes");
const mg = JSON.parse(readFileSync(new URL("../web/data/magic.json", import.meta.url)));
assert(Object.values(mg).filter(m => m && m.name).length > 50, "magic.json tiene nombres");
console.log("OK cast-text");
import { castMs, CAST_MS } from "../web/src/shared/magic.js";
// MapData.cpp:35-36 (16 fotogramas x 88 ms) y 1994-1998 (retardo -(maestría*0.13) entero)
assert(castMs(0) === 16 * 88 && castMs(100) === 16 * 75 && CAST_MS === 1200 && castMs(50) === 16 * (88 - 6), "tiempos de cast del original");
console.log("OK cast-ms");
