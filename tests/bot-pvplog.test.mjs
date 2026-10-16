// v0.85.51: el pensamiento de PvP de los bots ('⚔' en blog) llega al sumidero del admin
import assert from "node:assert";
import { plog } from "../web/src/shared/systems/bot.js";
const got = [], w = { hooks: { logSink: (p, t) => got.push(t) } }, p = { bot: {} };
plog(w, p, "Elijo pelear con X");
assert.strictEqual(got[0], "⚔ Elijo pelear con X");
assert.strictEqual(p.bot.log.length, 1);
console.log("OK bot-pvplog");
