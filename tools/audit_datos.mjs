// Compara web/data con los .cfg originales (Helbreath.ServerFiles/Config). Uso: node tools/audit_datos.mjs [carpeta_config] [--verbose] [--json fichero]
// Las diferencias conocidas (build distinta del servidor, balance propio) se congelan en docs/auditoria_baseline.json; tests/original-data.test.mjs falla si aparece una nueva.
import fs from "node:fs";
const AV = process.argv.slice(2).filter((a, i, r) => !a.startsWith("--") && r[i - 1] !== "--json");
const CFG = AV[0] || "C:/Users/sansp/Documents/HelbreathOriginal/Helbreath.ServerFiles/Config";
const V = process.argv.includes("--verbose");
const rd = f => fs.readFileSync(CFG + "/" + f, "latin1").split(/\r?\n/);
const J = f => JSON.parse(fs.readFileSync("web/data/" + f, "utf8"));
const out = {};
const rep = (area, diffs, total) => { out[area] = { total, diffs: diffs.length, lines: diffs }; console.log(`${area}: ${total} filas, ${diffs.length} diferencias`); if (V || diffs.length <= 15) for (const d of diffs.slice(0, V ? 400 : 15)) console.log("   ", d); };
// ---- items
const F = ["type","equipPos","effectType","v1","v2","v3","v4","v5","v6","maxLife","specialEffect","sprite","spriteFrame","price","weight","appr","speed","levelLimit","gender","seV1","seV2","skill","category","color"];
const items = J("items.json"), orig = {};
for (const f of ["Item.cfg", "Item2.cfg", "Item3.cfg", "Item4.cfg"]) for (const l of rd(f)) {
  if (/^\s*\[ENDITEMLIST\]/.test(l)) break;
  const m = l.match(/^\s*item\s*=\s*(\d+)\s+(\S+)\s+(.*)/i); if (!m) continue;
  const n = m[3].split(/\s+/).filter(Boolean).map(Number); orig[+m[1]] = { name: m[2], n };
}
{ const d = [];
  for (const [id, o] of Object.entries(orig)) {
    const it = items[id]; if (!it) { d.push(`#${id} ${o.name}: FALTA`); continue; }
    if (it.name !== o.name) d.push(`#${id} nombre ${o.name} -> ${it.name}`);
    const df = F.filter((k, i) => it[k] !== o.n[i]).map(k => `${k}:${o.n[F.indexOf(k)]}->${it[k]}`);
    if (df.length) d.push(`#${id} ${o.name}: ${df.join(" ")}`);
  }
  for (const id of Object.keys(items)) if (!orig[id]) d.push(`#${id} ${items[id].name}: SOLO NUESTRO`);
  rep("items", d, Object.keys(orig).length); }
// ---- npc
const npc = J("npc.json");
{ const d = [], seen = new Set(); let total = 0;
  const hdr = ["type","hitDice","defenseRatio","hitRatio","minBravery","expDice","attackDiceThrow","attackDiceRange","size","side","actionLimit","actionTime","resistMagic","magicLevel","dayOfWeek","chat","searchRange","regenTime","attribute","absDamage","maxMana","magicHitRatio","attackRange","goldDice"];
  for (const l of rd("Npc.cfg")) { const m = l.match(/^\s*npc\s*=\s*(\S+)\s+(.*)/i); if (!m) continue; total++;
    const n = m[2].split(/\s+/).filter(Boolean).map(Number); const c = npc[m[1]]; seen.add(m[1]);
    if (!c) { d.push(m[1] + ": FALTA"); continue; }
    const df = [];
    const chk = (k, v) => { if (c[k] !== v) df.push(`${k}:${v}->${c[k]}`); };
    ["type","hitDice","defenseRatio","hitRatio","minBravery"].forEach((k, i) => chk(k, n[i]));
    chk("attackDiceThrow", n[6]); chk("attackDiceRange", n[7]); chk("size", n[8]); chk("side", n[9]); chk("actionLimit", n[10]); chk("actionTime", n[11]);
    chk("resistMagic", n[12]); chk("magicLevel", n[13]); chk("dayOfWeek", n[14]); chk("chat", n[15]); chk("searchRange", n[16]); chk("regenTime", n[17]);
    chk("attribute", n[18]); chk("absDamage", n[19]); chk("maxMana", n[20]); chk("magicHitRatio", n[21]); chk("attackRange", n[22]);
    if (df.length) d.push(m[1] + ": " + df.join(" ")); }
  for (const k of Object.keys(npc)) if (!seen.has(k)) d.push(k + ": SOLO NUESTRO");
  rep("npc", d, total); }
// ---- magic (los nombres originales llevan guion; los nuestros espacio: cosmético)
const magic = J("magic.json");
{ const d = []; let total = 0; const norm = x => x.replace(/[-\s]/g, "").toLowerCase();
  for (const l of rd("Magic.cfg")) { const m = l.match(/^\s*magic\s*=\s*(\d+)\s+(\S+)\s+(.*)/i); if (!m) continue; total++;
    const c = magic[m[1]]; if (!c) { d.push(`#${m[1]} ${m[2]}: FALTA`); continue; }
    const n = m[3].split(/\s+/).filter(Boolean).map(Number); const df = [];
    if (norm(c.name) !== norm(m[2])) df.push("nombre " + m[2] + "->" + c.name);
    const K = { type: 0, delay: 1, last: 2, mana: 3, reqInt: 15, category: 17, attr: 18 };
    for (let i = 4; i <= 14; i++) K["v" + (i - 2)] = i;
    for (const [k, i] of Object.entries(K)) if (c[k] !== n[i]) df.push(`${k}:${n[i]}->${c[k]}`);
    if (df.length) d.push(`#${m[1]} ${m[2]}: ${df.join(" ")}`); }
  rep("magic", d, total); }
// ---- teleport
{ const tp = J("teleport.json"), d = []; let total = 0;
  for (const l of rd("Teleport.cfg")) if (/^\s*teleport\s*=/i.test(l)) total++;
  if (tp.length !== total) d.push(`filas ${total} -> ${tp.length}`);
  rep("teleport", d, total); }
// ---- skill
{ const sk = fs.existsSync("web/data/skills.json") ? J("skills.json") : null, d = []; let total = 0;
  for (const l of rd("Skill.cfg")) if (/^\s*skill\s*=/i.test(l)) total++;
  rep("skill", sk ? d : ["sin web/data/skills.json"], total); }
if (process.argv.includes("--json")) fs.writeFileSync(process.argv[process.argv.indexOf("--json") + 1], JSON.stringify(out, null, 1));
