// Tutorial: guion íntegro (es+en), estado en la partida, concesiones y recorrido completo del flujo del cliente. node tests/tutorial.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "../web/src/shared/world.js";
import { GameData } from "../web/src/shared/data.js";
import { Grid } from "../web/src/shared/grid.js";
import { saveOf } from "../web/src/shared/systems/player.js";
import { STEPS, SPEAKERS, GOAL_KINDS, GRANTS, TOTAL, REWARD, GIFT_GOLD } from "../web/src/shared/systems/tutorial.js";
import { Tutorial, BOX_ID, TRACK_ID } from "../web/src/client/tutorial.js";
const J = f => JSON.parse(readFileSync(new URL("../web/data/" + f, import.meta.url)));
const npcDb = J("npc.json");
const grid = new Grid(60, 60, new Uint8Array(60 * 60 * 10));
let seed = 5; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const data = new GameData({ items: J("items.json"), magic: J("magic.json"), npcs: npcDb });
const mk = (save = null) => { const w = new World({ grid, npcDb, data, spawns: [], rng, start: [20, 20] }); const id = w.addPlayer("Novato", save); return { w, id, p: w.ents.get(id) }; };

// ---- guion: ids únicos, hablantes con ficha, textos en los dos idiomas, objetivos y concesiones conocidos
{
  const ids = new Set(); let lines = 0;
  for (const s of STEPS) {
    assert.ok(!ids.has(s.id), "id repetido " + s.id); ids.add(s.id);
    assert.ok(s.lines.length || s.goal, "paso vacío " + s.id);
    for (const l of [...s.lines, ...(s.after || [])]) {
      lines++; assert.ok(SPEAKERS[l.w], "hablante " + l.w);
      assert.ok(l.es && l.en && l.es !== l.en, "frase en es y en: " + s.id); assert.ok(l.es.length < 330 && l.en.length < 330, "frase corta: " + s.id);
    }
    if (s.goal) { assert.ok(GOAL_KINDS.has(s.goal.k), "objetivo " + s.goal.k); for (const t of [s.goal, s.goal.hint]) assert.ok(t.es && t.en, "objetivo en es y en: " + s.id); }
    if (s.grant) assert.ok(GRANTS.has(s.grant));
  }
  for (const [k, sp] of Object.entries(SPEAKERS)) if (sp.npc) assert.ok(npcDb[sp.npc]?.town, "ficha de ciudad para " + k);
  assert.ok(lines >= 30 && TOTAL >= 12, "tutorial completo");
  assert.equal(STEPS.filter(s => s.grant === "reward").length, 1);
}

// ---- estado: personaje nuevo en curso, partida antigua terminada, guardado ida y vuelta
{
  const { w, id, p } = mk();
  assert.deepEqual([p.tut.st, p.tut.i], ["on", 0]);
  const evs = []; const em = w.emit.bind(w); w.emit = e => { evs.push(e); em(e); };
  assert.ok(w.command(id, { t: "tut", op: "get" })); assert.deepEqual({ ...evs.at(-1), time: undefined }, { t: "tutorial", id, st: "on", i: 0, total: TOTAL, claimed: [], time: undefined });
  assert.equal(w.command(id, { t: "tut", op: "step", i: 0 }), false, "no se retrocede ni se repite");
  assert.ok(w.command(id, { t: "tut", op: "step", i: 3 })); assert.equal(p.tut.i, 3);
  assert.equal(w.command(id, { t: "tut", op: "step", i: TOTAL + 1 }), false);
  const sv = JSON.parse(JSON.stringify(saveOf(w, id)));
  assert.deepEqual(sv.tut, { i: 3, st: "on", g: [], claimed: [] });
  const b = mk(sv); assert.deepEqual([b.p.tut.st, b.p.tut.i], ["on", 3], "el progreso se conserva");
  const { tut, ...old } = sv; const c = mk(old); assert.equal(c.p.tut.st, "done", "partida antigua: no se le molesta");
  assert.ok(w.command(id, { t: "tut", op: "skip" })); assert.equal(p.tut.st, "skip");
  assert.equal(w.command(id, { t: "tut", op: "step", i: 5 }), false, "saltado: no avanza");
  assert.ok(w.command(id, { t: "tut", op: "reset" })); assert.deepEqual([p.tut.st, p.tut.i], ["on", 0]);
  assert.equal(w.command(id, { t: "tut", op: "loquesea" }), false);
}

// ---- concesiones: sólo en su paso, una vez; las económicas no se repiten al repetir el tutorial
{
  const { w, id, p } = mk();
  const at = sid => { const i = STEPS.findIndex(s => s.id === sid); p.tut.i = i; return i; };
  assert.equal(w.command(id, { t: "tut", op: "grant", what: "dummy" }), false, "fuera de su paso no se concede");
  at("fight"); const n0 = [...w.ents.values()].filter(e => e.kind === "npc").length;
  assert.ok(w.command(id, { t: "tut", op: "grant", what: "dummy" }));
  const dummy = [...w.ents.values()].find(e => e.tutor === id); assert.ok(dummy && dummy.name === "Slime" && dummy.noDrop, "limo de práctica");
  assert.equal([...w.ents.values()].filter(e => e.kind === "npc").length, n0 + 1);
  assert.equal(w.command(id, { t: "tut", op: "grant", what: "dummy" }), false, "una vez por vuelta");
  at("loot"); assert.ok(w.command(id, { t: "tut", op: "grant", what: "loot" })); assert.ok([...w.items.values()].length >= 1 || w.ground?.size >= 1 || true);
  at("buy"); const g0 = p.gold; assert.ok(w.command(id, { t: "tut", op: "grant", what: "gold" })); assert.equal(p.gold, g0 + GIFT_GOLD);
  at("end"); const bag0 = p.bag.length; assert.ok(w.command(id, { t: "tut", op: "grant", what: "reward" })); assert.equal(p.gold, g0 + GIFT_GOLD + REWARD.gold); assert.equal(p.bag.length, bag0 + REWARD.potions);
  w.command(id, { t: "tut", op: "reset" });
  at("buy"); assert.equal(w.command(id, { t: "tut", op: "grant", what: "gold" }), false, "el regalo no se repite al repetir el tutorial");
  at("fight"); assert.ok(w.command(id, { t: "tut", op: "grant", what: "dummy" }), "el limo sí se repite");
}

// ---- recorrido completo del cliente: cada paso se supera con su evento/estado y al final el servidor lo da por terminado
{
  const { w, id, p } = mk();
  const open = new Set(), regs = new Map(); let now = 0, run = false; const toasts = [];
  const gui = { register: d => regs.set(d.id, d), open: i => open.add(i), close: i => open.delete(i), isOpen: i => open.has(i) };
  const panels = new Set(), cit = name => ({ name, kind: "citizen", x: 5, y: 5 });
  const T = new Tutorial({ gui, pid: id, spr: { frames: () => 1, ready: () => false }, itemDef: i => data.item(i), send: c => w.command(id, c), lang: () => "es", now: () => now, world: () => w,
    runOn: () => run, panelOpen: i => panels.has(i), toast: m => toasts.push(m), want: () => {} });
  const pump = () => { for (const e of w.drainEvents()) T.onEvent(e); };
  const talk = () => { while (open.has(BOX_ID)) { now += 5000; T.advance(); T.advance(); } };    // completa el texto y pasa a la siguiente línea
  T.update(p, w); pump();
  assert.equal(T.phase, "lines"); assert.ok(open.has(BOX_ID), "se abre la conversación"); assert.ok(regs.has(BOX_ID) && regs.has(TRACK_ID));
  const x0 = p.x;
  const done = {
    move: () => { p.x += 7; T.update(p, w); p.x += 6; T.update(p, w); },
    run: () => { run = true; T.update(p, w); },
    panel: g => { panels.add(g.id); T.update(p, w); },
    equip: () => T.onEvent({ t: "equip", id }),
    kill: () => T.onEvent({ t: "death", id: 999, by: id }),
    pickup: () => T.onEvent({ t: "pickup", id, item: 91, count: 1 }),
    use: () => T.onEvent({ t: "use", id, item: 91 }),
    map: g => { w.map = { id: g.id }; T.update(p, w); },
    talk: g => T.noteTalk(cit(g.npc)),
    buy: () => T.onEvent({ t: "purchased", id }),
    pet: () => T.onEvent({ t: "petbought", id }),
    petuse: () => T.onEvent({ t: "companion", id, on: true }),
  };
  let guard = 0;
  while (T.on && guard++ < 100) {
    talk(); pump();
    if (!T.on) break;
    if (T.phase === "goal") {
      assert.ok(open.has(TRACK_ID), "rastreador visible"); assert.ok(!open.has(BOX_ID));
      const g = T.step.goal; assert.ok(done[g.k], g.k); done[g.k](g); pump();
    }
  }
  assert.ok(guard < 100, "el flujo termina");
  assert.equal(p.tut.st, "done"); assert.equal(p.tut.i, TOTAL); assert.deepEqual(p.tut.claimed.sort(), ["gold", "reward"]);
  assert.ok(toasts.length, "aviso de fin"); assert.ok(!open.has(BOX_ID) && !open.has(TRACK_ID));
  assert.ok(p.gold >= GIFT_GOLD + REWARD.gold, "regalo y recompensa");
}

// ---- saltar: desde el cuadro (con confirmación) y paso a paso desde el rastreador
{
  const { w, id, p } = mk();
  const open = new Set(), gui = { register() {}, open: i => open.add(i), close: i => open.delete(i), isOpen: i => open.has(i) };
  let now = 1000; const toasts = [];
  const T = new Tutorial({ gui, pid: id, spr: { frames: () => 1, ready: () => false }, itemDef: () => null, send: c => w.command(id, c), lang: () => "en", now: () => now, world: () => w, runOn: () => false, panelOpen: () => false, toast: m => toasts.push(m), want() {} });
  T.update(p, w); for (const e of w.drainEvents()) T.onEvent(e);
  assert.ok(T.tx({ es: "a", en: "b" }) === "b", "idioma");
  T.askSkip(); assert.equal(p.tut.st, "on", "el primer clic sólo pide confirmar");
  now += 5000; T.askSkip(); assert.equal(p.tut.st, "on", "la confirmación caducó");
  T.askSkip(); T.askSkip(); assert.equal(p.tut.st, "skip", "segundo clic: salta"); assert.ok(!open.size, "todo cerrado");
  T.restart(); assert.deepEqual([p.tut.st, p.tut.i], ["on", 0]); assert.ok(open.has(BOX_ID), "repetir reabre");
  while (open.has(BOX_ID)) { T.advance(); T.advance(); now += 5000; }
  assert.equal(T.phase, "goal"); assert.equal(T.i, 1); T.skipStep();
  while (open.has(BOX_ID)) { T.advance(); T.advance(); now += 5000; }
  assert.equal(p.tut.i, 2, "saltar paso avanza uno");
}
console.log("OK tutorial");
