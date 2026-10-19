// GRABADOR DE PARTIDAS (v0.85.67, INVENTO del port): guarda el 100 % de las sesiones de jugadores reales (no bots) en ficheros JSONL locales
// (server/data/replays/) para analizarlas luego (huida por vida, distancia de ataque, uso de hechizos, cómo acorralan o rodean a magos).
// Por línea: {k:"h"} cabecera, {k:"c"} orden del jugador, {k:"s"} foto cada SNAP_MS (propio + cercanos), {k:"e"} evento de combate que le afecta.
// No toca la simulación ni el protocolo: solo observa desde el servidor.
import fs from "node:fs";
import path from "node:path";

const SNAP_MS = 250, NEAR = 14;
const EV = new Set(["miss", "crit", "damage", "hit", "death", "die", "cast", "spell", "heal", "kill", "broken", "attack", "resist", "castfail", "status", "levelup", "pkpenalty", "respawn", "dbgact"]);

export function createRecorder(dir, { log = () => {}, now = () => Date.now() } = {}) {
  const sess = new Map();                                    // pid -> { stream, last, n }
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const safe = s => String(s || "x").replace(/[^\w.-]+/g, "_").slice(0, 24);
  const put = (s, o) => { try { s.stream.write(JSON.stringify(o) + "\n"); s.lines++; } catch {} };
  const ent = e => ({ id: e.id, k: e.kind, n: e.name, x: e.x, y: e.y, hp: e.hp, mh: e.maxHp, d: e.dead ? 1 : 0, a: e.act, dir: e.dir, rl: e.role, pk: e.pkCount || undefined, sd: e.side });
  function open(pid, me, world) {
    const stamp = new Date(now()).toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const file = path.join(dir, stamp + "_" + safe(me.name) + "_" + pid + ".jsonl");
    const s = { stream: fs.createWriteStream(file, { flags: "a" }), last: -1e9, lines: 0, file };
    sess.set(pid, s);
    put(s, { k: "h", name: me.name, pid, map: world.map.id, at: new Date(now()).toISOString(), lvl: me.level, stats: me.stats });
    return s;
  }
  function cmd(pid, world, c) {
    const s = sess.get(pid);
    if (s) put(s, { k: "c", w: Math.round(world.time), c });
  }
  function tick(clients, adventure, eventsByMap) {
    const live = new Set();
    for (const c of clients) {
      if (!c.pid || c.watch) continue;
      try {
        const world = adventure.worldFor(c.pid), me = world.ents.get(c.pid);
        if (!me) continue;
        live.add(c.pid);
        const s = sess.get(c.pid) || open(c.pid, me, world);
        if (s.map !== world.map.id) { if (s.map !== undefined) put(s, { k: "m", w: Math.round(world.time), map: world.map.id }); s.map = world.map.id; }
        for (const ev of eventsByMap.get(world.map.id) || []) if (EV.has(ev.t) && (ev.id === c.pid || ev.from === c.pid || ev.target === c.pid)) put(s, { k: "e", w: Math.round(world.time), ev });
        if (world.time - s.last < SNAP_MS) continue;
        s.last = world.time;
        const near = [];
        for (const e of world.ents.values()) if (e !== me && Math.abs(e.x - me.x) <= NEAR && Math.abs(e.y - me.y) <= NEAR) near.push(ent(e));
        put(s, { k: "s", w: Math.round(world.time), me: { ...ent(me), mp: Math.floor(me.mp ?? 0), mm: me.maxMp, sp: me.sp, lvl: me.level, wt: me.eff?.wtype, tg: me.target, cm: me.combatMode ? 1 : 0 }, near });
      } catch (e) { log("recorder", e && e.message); }
    }
    for (const [pid, s] of sess) if (!live.has(pid)) { try { s.stream.end(); } catch {} sess.delete(pid); }
  }
  const close = () => { for (const s of sess.values()) try { s.stream.end(); } catch {} sess.clear(); };
  return { cmd, tick, close, sessions: sess };
}
