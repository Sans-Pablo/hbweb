// Monitor económico (server/economy.mjs): flujo, riqueza, alertas con enfriamiento, configuración versionada, simulación y ruta HTTP.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openStore } from "../server/store.mjs";
import { createEconomy, gini, shapeEvent, MISSING } from "../server/economy.mjs";

assert.equal(gini([5, 5, 5, 5]), 0); assert.ok(gini([0, 0, 0, 100]) > 0.7);
assert.ok(MISSING.length >= 3, "las métricas sin instrumentar se declaran, no se inventan");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-eco-"));
const st = await openStore(dir, { log() {} });
if (st.kind !== "sqlite") { console.log("OK economy (sin SQLite: omitido)"); process.exit(0); }
let T = 10 * 3600000; const eco = createEconomy({ store: st, now: () => T });
const mk = (id, o) => ({ eventId: id, ts: T - 1000, gt: 1, reason: "quest_reward", cls: "faucet", delta: 100, actor: "Ana", artificial: null, bal: 100, map: "farm", ...o });
st.econAdd(mk("a1")); st.econAdd(mk("a1")); st.econAdd(mk("a2", { reason: "shop_buy", cls: "sink", delta: -30, bal: 70, gt: 2 }));
st.econAdd(mk("a3", { artificial: "bot", delta: 999 }));
const o = eco.overview({}); assert.equal(o.created, 100, "idempotente y sin bots"); assert.equal(o.destroyed, 30); assert.equal(o.net, 70);
assert.equal(eco.overview({ artificial: "all" }).created, 1099);
const f = eco.flow({}); assert.ok(f.faucets.some(x => x.reason === "quest_reward")); assert.ok(f.sinks.some(x => x.reason === "shop_buy"));
assert.equal(shapeEvent({ event_id: "x", ts: 1, reason: "r", cls: "faucet", delta: 1, actor: "A", bal: 2 }).source, "r");

// Duplicados: 3 movimientos idénticos en el mismo instante de juego
for (let i = 0; i < 3; i++) st.econAdd(mk("d" + i, { actor: "Beto", delta: 500, gt: 77, bal: 500 }));
const made = eco.evaluate(T); assert.ok(made.some(m => m.rule === "duplicate"), "regla de duplicados");
assert.equal(eco.evaluate(T).filter(m => m.rule === "duplicate").length, 0, "el enfriamiento evita repetir la alerta");
const al = st.alertList({}); assert.ok(al.length >= 1); st.alertSet(al[0].id, "dismissed", "prueba", "t", T);
assert.equal(st.alertList({ status: "dismissed" }).length, 1);

// Configuración: validación, borrador, alto impacto, publicación y reversión
assert.throws(() => eco.validateCfg({ inventada: {} })); assert.throws(() => eco.validateCfg({ net_growth: { ratio: -5 } }));
assert.ok(eco.highImpact(eco.cfg().rules, eco.mergeCfg({ net_growth: { ratio: 30 } })).length, "x10 es alto impacto");
const v = st.cfgDraft("admin", "prueba", { net_growth: { ratio: 4 } }, T); st.cfgPublish(v, "admin", T);
assert.equal(eco.cfg().rules.net_growth.ratio, 4); assert.equal(eco.cfg().version, v);

// Simulación
const s = eco.simulate({ hours: 24, changes: [{ reason: "quest_reward", factor: 2 }, { reason: "nada", factor: 1 }] });
assert.equal(s.baselineNet, 1570); assert.equal(s.projectedNet, 3170); assert.deepEqual(s.unknownReasons, ["nada"]);
assert.throws(() => eco.simulate({ changes: [{ reason: "x", factor: 99 }] }));

// Ruta HTTP simulada: respuesta JSON y auditoría de la mutación
let out; const res = {}, json = (rq, rs, c, b) => { out = { c, b }; }, wait = () => new Promise(r => setTimeout(r, 50));
await eco.handle({ method: "GET", headers: {} }, res, new URL("http://x/api/admin/economy/overview"), { json, cors: {}, ip: "1.1.1.1", readBody: async () => "{}" }); await wait();
assert.equal(out.c, 200); assert.equal(out.b.created, 1600);
await eco.handle({ method: "POST", headers: {} }, res, new URL("http://x/api/admin/economy/alerts"), { json, cors: {}, ip: "1.1.1.1", readBody: async () => '{"evaluate":true}' }); await wait();
assert.ok(st.auditList(10).length >= 1, "toda mutación deja fila de auditoría");
await eco.handle({ method: "GET", headers: {} }, res, new URL("http://x/api/admin/economy/items"), { json, cors: {}, ip: "1.1.1.1", readBody: async () => "{}" }); await wait();
assert.equal(out.b.available, false);

st.close(); fs.rmSync(dir, { recursive: true, force: true });
console.log("OK economy");
