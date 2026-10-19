// Órdenes a la mascota (Ctrl+B / botón ORD): con ui.petCmd el clic manda petgo (suelo) o pettarget (enemigo)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { Controller } = await import("../web/src/client/controller.js");
globalThis.addEventListener = () => {};
const sent = [], logs = [];
const ui = { petCmd: true, togglePetCmd(on) { this.petCmd = on; logs.push(on); }, cancelPointing() {} };
const canvas = { addEventListener() {} };
const c = new Controller({ conn: { send: m => sent.push(m) }, grid: {}, renderer: {}, canvas, ui });
Object.defineProperty(c, "me", { get: () => ({ id: 1, dead: false, x: 5, y: 5 }) });
c.pointer = [0, 0];
c.target = () => ({ ent: null, x: 7, y: 8 });
c.click(true);
assert.deepEqual(sent.pop(), { t: "petgo", x: 7, y: 8 });
c.target = () => ({ ent: { id: 9, kind: "npc", x: 3, y: 3 }, x: 3, y: 3 });
c.click(true);
assert.deepEqual(sent.pop(), { t: "pettarget", target: 9 });
c.target = () => ({ ent: { id: 1, kind: "player", x: 5, y: 5 }, x: 5, y: 5 });   // uno mismo: nada
c.click(true); assert.equal(sent.length, 0);
c.target = () => ({ ent: { id: 4, kind: "npc", master: 1, x: 3, y: 3 }, x: 3, y: 3 });   // su propia mascota: nada
c.click(true); assert.equal(sent.length, 0);
c.click(false); assert.equal(sent.length, 0);   // mantener pulsado no repite
c.rightClick(); assert.equal(ui.petCmd, false);  // clic derecho sale del modo
// Ctrl+B y botón ORD cableados
const m = readFileSync(new URL("../web/src/client/main.js", import.meta.url), "utf8");
assert.ok(/case "b": e\.preventDefault\(\); ui\.togglePetCmd\(\)/.test(m) && /petcmd: \(\) => ui\.togglePetCmd\(\)/.test(m));
console.log("OK petcmd");
