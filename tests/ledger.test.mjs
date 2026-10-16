// Libro de oro (systems/ledger.js) y persistencia econ_events (server/store.mjs): clases, artificial, transferencias, idempotencia y consultas.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gold, setEconSink } from "../web/src/shared/systems/ledger.js";
import { openStore } from "../server/store.mjs";

const evs = []; setEconSink((w, e) => evs.push(e));
const w = { time: 500, map: { id: "farm" } }, a = { id: 1, name: "Ana", gold: 100 }, b = { id: 2, name: "Beto", gold: 0 }, bot = { id: 3, name: "Bot", gold: 0, bot: true };
assert.equal(gold(w, a, -30, "shop_buy"), -30); assert.equal(a.gold, 70);
gold(w, a, 50, "quest_reward"); gold(w, a, 0, "nada"); gold(w, a, NaN, "nada");
assert.equal(evs.length, 2, "delta 0/NaN no genera evento");
assert.deepEqual(evs.map(e => e.cls), ["sink", "faucet"]);
assert.equal(evs[0].bal, 70); assert.ok(evs[1].seq > evs[0].seq); assert.equal(evs[0].artificial, null);
evs.length = 0;
const total = () => a.gold + b.gold;
const t0 = total(); gold(w, a, -20, "trade", { cls: "transfer", peer: "Beto" }); gold(w, b, 20, "trade", { cls: "transfer", peer: "Ana" });
assert.equal(total(), t0, "una transferencia no cambia el oro total");
assert.equal(evs.reduce((s, e) => s + e.delta, 0), 0);
gold(w, bot, 10, "quest_reward"); gold(w, a, 5, "debug", { debug: true });
assert.equal(evs.at(-2).artificial, "bot"); assert.equal(evs.at(-1).artificial, "debug");
const hooked = []; gold({ time: 1, econHook: (_, e) => hooked.push(e) }, a, 1, "x"); assert.equal(hooked.length, 1, "w.econHook tiene prioridad");
setEconSink(null); const n = evs.length; gold(w, a, 1, "x"); assert.equal(evs.length, n, "sin sumidero no registra");

// Persistencia
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-econ-"));
const st = await openStore(dir, { log() {} });
if (st.kind !== "sqlite") { console.log("OK ledger (sin SQLite: persistencia omitida)"); process.exit(0); }
const mk = (id, o) => ({ eventId: id, ts: 1000000, gt: 1, reason: "shop_buy", cls: "sink", delta: -10, actor: "Ana", artificial: null, bal: 5, map: "farm", ...o });
st.econAdd(mk("e1")); st.econAdd(mk("e1")); st.econAdd(mk("e2", { reason: "quest_reward", cls: "faucet", delta: 40, ts: 1000000 + 3600000 }));
st.econAdd(mk("e3", { reason: "trade", cls: "transfer", delta: 7 })); st.econAdd(mk("e4", { artificial: "bot", delta: -99 }));
assert.equal(st.econEvents().length, 3, "event_id repetido no se duplica; artificial se excluye por defecto");
assert.equal(st.econEvents({ artificial: "all" }).length, 4);
assert.equal(st.econEvents({ reason: "trade" }).length, 1);
const sum = Object.fromEntries(st.econSummary().map(r => [r.reason, r])); assert.equal(sum.shop_buy.outflow, 10); assert.equal(sum.quest_reward.inflow, 40);
const ser = st.econSeries({ bucket: 3600000 }); assert.equal(ser.length, 2, "series sin transferencias, un tramo por hora y clase"); assert.ok(ser.every(r => r.cls !== "transfer"));
st.close();
const st2 = await openStore(dir, { log() {} }); assert.equal(st2.econEvents().length, 3, "sobrevive al reinicio"); st2.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log("OK ledger");
