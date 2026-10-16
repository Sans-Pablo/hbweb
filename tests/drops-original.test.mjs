// Botín fiel a NpcDeadItemGenerator (HelbreathOriginal HG.cpp:29315-29990). Esperados derivados del código original.
import { rollKillDrop, dropInfo } from "../web/src/shared/drops.js";
const assert = (c, m) => { if (!c) { console.log("FALLO:", m); process.exit(1); } };
let s = 12345; const rng = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const N = 40000, cfg = { goldMax: 10 };
const run = (type, o = {}) => { const c = {}; let n = 0; for (let i = 0; i < N; i++) { const d = rollKillDrop(rng, { type, cfg }, { month: 10, ...o }); if (d) { n++; c[d.id] = (c[d.id] || 0) + 1; } } return { n, c }; };
// guardia (21), maniquí (34) y cultivo (64): HG.cpp:29335 nunca sueltan
for (const t of [21, 34, 64]) assert(run(t).n === 0, "tipo " + t + " no suelta");
// Slime (gen 1): solo tablas de HG.cpp:29504 (armas 1,8,59), 29668 (79,81) y pociones estándar
const sl = run(10); const ok1 = new Set([1, 8, 59, 79, 81, 95, 91, 93, 650, 651, 652, 653, 654, 655, 656, 657, ...Array.from({ length: 10 }, (_, i) => 881 + i)]);
assert(Object.keys(sl.c).every(k => ok1.has(+k)), "slime: ids fuera de la tabla " + Object.keys(sl.c));
// Proporción: 0,91 x 0,4 x 0,5 x (3000+1000+1500)/12000 = potions permitidas (95,91,93) ≈ 8,3 %
const pot = (sl.c[95] || 0) + (sl.c[91] || 0) + (sl.c[93] || 0);
assert(Math.abs(pot / N - 0.91 * 0.4 * 0.5 * 5500 / 12000) < 0.01, "pociones estándar " + pot / N);
// gen 1 no tiene varita: el 20 % de las armas no suelta nada → armas ≈ 0,91x0,4x0,5x0,6x0,8 = 8,7 %
const w = (sl.c[1] || 0) + (sl.c[8] || 0) + (sl.c[59] || 0);
assert(Math.abs(w / N - 0.91 * 0.4 * 0.5 * 0.6 * 0.8) < 0.01, "armas gen1 " + w / N);
// Sin corte "débil": un slime y un Stone-Golem (gen 8?) usan la misma probabilidad base 9100/10000
assert(dropInfo(10).gen === 1 && !dropInfo(10).weak, "sin WEAK_DROP");
// diciembre: banda 9 (10001-12000) suelta dulces 780-782 o 91 (HG.cpp:29439)
const dec = run(10, { month: 12 });
assert((dec.c[780] || 0) + (dec.c[781] || 0) + (dec.c[782] || 0) > 0, "dulces en diciembre");
// reputación +3000 baja la banda estándar a 2000 (HG.cpp:29396)
const rep = run(10, { rating: 3000 }); const pot2 = (rep.c[95] || 0) + (rep.c[91] || 0) + (rep.c[93] || 0);
assert(pot2 < pot * 0.6, "reputación alta reduce el botín estándar");
console.log("OK");
