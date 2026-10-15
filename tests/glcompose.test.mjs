// El compositor necesita un navegador; aquí se comprueban solo las partes puras.
import { hex3 } from "../web/src/client/glcompose.js";
import { WEAPON_RGB } from "../web/src/client/assets.js";
const a = hex3("#ff8000");
if (a[0] !== 1 || Math.abs(a[1] - 128 / 255) > 1e-6 || a[2] !== 0) throw new Error("hex3");
if (!WEAPON_RGB[1] || WEAPON_RGB.length !== 11) throw new Error("WEAPON_RGB");
console.log("OK glcompose");
