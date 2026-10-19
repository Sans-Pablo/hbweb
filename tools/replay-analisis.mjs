// Analizador de replays (server/data/replays/*.jsonl, ver docs/sistemas/grabador.md). v0.85.81
// Uso: node tools/replay-analisis.mjs [fichero|carpeta|filtro-de-nombre ...]   (sin argumentos: todos los «zzzz» de la carpeta)
// Saca: duración, hechizos lanzados (con nombre de Magic.cfg), pociones (clasificadas por el salto de HP/MP tras «use»), mínimos de HP/MP,
// ACCIONES DE ADMINISTRACIÓN (eventos «dbgact» con antes/después; en replays antiguos, las órdenes «dbg» y los saltos de máximos de HP/MP detectados en las fotos).
import fs from "node:fs";
import path from "node:path";
const root = new URL("../", import.meta.url);
const magic = JSON.parse(fs.readFileSync(new URL("web/data/magic.json", root)));
const spellName = id => magic[id]?.name || ("#" + id);
const dir = new URL("server/data/replays/", root).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const args = process.argv.slice(2);
let files = [];
if (!args.length) args.push("zzzz");
for (const a of args) {
  if (fs.existsSync(a) && fs.statSync(a).isDirectory()) files.push(...fs.readdirSync(a).filter(f => f.endsWith(".jsonl")).map(f => path.join(a, f)));
  else if (fs.existsSync(a)) files.push(a);
  else files.push(...fs.readdirSync(dir).filter(f => f.endsWith(".jsonl") && f.includes(a)).map(f => path.join(dir, f)));
}
const fmt = ms => (ms / 60000).toFixed(1) + " min";
export function analyze(file) {
  const r = { file: path.basename(file), casts: {}, admin: [], jumps: [], uses: [], mpMin: 1e9, hpMin: 1e9, deaths: 0, attacks: 0, t0: null, t1: 0, lvl: 0, mpMax: 0, mhpMax: 0 };
  let lastS = null, pend = [], prevMax = null;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue; let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.w != null) { if (r.t0 == null) r.t0 = o.w; r.t1 = Math.max(r.t1, o.w); }
    if (o.k === "s") {
      const m = o.me; lastS = o; r.lvl = m.lvl; r.mpMin = Math.min(r.mpMin, m.mp); r.hpMin = Math.min(r.hpMin, m.hp); r.mpMax = Math.max(r.mpMax, m.mm || 0); r.mhpMax = Math.max(r.mhpMax, m.mh || 0);
      for (const u of pend.filter(u => o.w - u.w >= 500)) { u.dhp = m.hp - u.hp; u.dmp = m.mp - u.mp; r.uses.push(u); pend.splice(pend.indexOf(u), 1); }
      if (prevMax && (prevMax.mh !== m.mh || prevMax.mm !== m.mm)) r.jumps.push({ w: o.w, mh: [prevMax.mh, m.mh], mm: [prevMax.mm, m.mm] });
      prevMax = { mh: m.mh, mm: m.mm };
    } else if (o.k === "c") {
      const c = o.c;
      if (c.t === "cast" && !c.pre) r.casts[c.spell] = (r.casts[c.spell] || 0) + 1;
      else if (c.t === "cast") r.casts[c.spell] = (r.casts[c.spell] || 0) + 1;
      else if (c.t === "attack") r.attacks++;
      else if (c.t === "use" && lastS) pend.push({ w: o.w, hp: lastS.me.hp, mp: lastS.me.mp, mh: lastS.me.mh, mm: lastS.me.mm });
      else if (c.t === "dbg") r.admin.push({ w: o.w, op: c.op, cmd: c, old: true });
    } else if (o.k === "e") {
      if (o.ev.t === "dbgact") { const i = r.admin.findIndex(a => a.old && a.op === o.ev.op && Math.abs(a.w - o.w) < 1500); const e = { w: o.w, op: o.ev.op, cmd: o.ev.cmd, change: o.ev.change }; if (i >= 0) r.admin[i] = e; else r.admin.push(e); }
      if (o.ev.t === "death" || o.ev.t === "die") r.deaths++;
    }
  }
  r.potions = { mana: r.uses.filter(u => u.dmp > 40 && u.dmp >= u.dhp), hp: r.uses.filter(u => u.dhp > 40 && u.dhp > u.dmp) };
  return r;
}
export function report(r) {
  const L = [];
  L.push(`== ${r.file}  (${fmt(r.t1 - (r.t0 || 0))}, nivel ${r.lvl}, HP máx ${r.mhpMax}, MP máx ${r.mpMax}, mín HP ${r.hpMin}, mín MP ${r.mpMin}, muertes ${r.deaths}, ataques ${r.attacks})`);
  const cs = Object.entries(r.casts).sort((a, b) => b[1] - a[1]);
  if (cs.length) L.push("  hechizos: " + cs.map(([id, n]) => `${spellName(id)} ${n}`).join(", "));
  const avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
  L.push(`  pociones: maná ${r.potions.mana.length} (bebidas con MP medio ${avg(r.potions.mana.map(u => u.mp))}), vida ${r.potions.hp.length} (con HP medio ${avg(r.potions.hp.map(u => u.hp))})`);
  if (r.admin.length) {
    L.push("  ADMIN/DBG:");
    for (const a of r.admin) L.push(`    t=${(a.w / 1000).toFixed(1)}s ${a.op} ${JSON.stringify({ ...a.cmd, t: undefined, op: undefined })} ` + (a.change ? "cambio " + JSON.stringify(a.change) : "(sin antes/después: replay anterior a 0.85.81)"));
  }
  const adminAt = r.admin.map(a => a.w);
  const lvlUp = j => j.mh[1] > j.mh[0] && j.mh[1] - j.mh[0] <= 60 && j.mm[1] - j.mm[0] <= 4 && r.lvl < 140;          // subida de nivel / punto de Vit: no es un salto raro
  const unexplained = r.jumps.filter(j => !adminAt.some(w => Math.abs(w - j.w) < 3000) && !lvlUp(j));
  for (const j of r.jumps.filter(j => !lvlUp(j) || adminAt.some(w => Math.abs(w - j.w) < 3000))) L.push(`  salto de máximos t=${(j.w / 1000).toFixed(1)}s HP máx ${j.mh[0]}→${j.mh[1]}, MP máx ${j.mm[0]}→${j.mm[1]}` + (unexplained.includes(j) ? "  ← SIN orden admin cercana" : "  (explicado por orden admin)"));
  return L.join("\n");
}
if (process.argv[1] && process.argv[1].endsWith("replay-analisis.mjs")) for (const f of files) console.log(report(analyze(f)) + "\n");
