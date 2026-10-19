// Auditoría 2026-10-19 (cliente): NpcActionQuery (cajas y textos de los modos 4/6/7/8/9, Talk, sonido) y diálogo de alquimia (id 26, SkillDlg modos 1/2).
import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.document = { documentElement: {}, body: null, createElement: () => ({ getContext: () => ctx }) };
globalThis.navigator ??= {};
globalThis.window ??= {};
const ctx = new Proxy({ measureText: s => ({ width: String(s).length * 6 }) }, { get: (o, k) => k in o ? o[k] : () => {}, set: () => true });
const { registerNpcDialogs } = await import("../web/src/client/npcdialogs.js");
const { setData } = await import("../web/src/client/names.js");
const items = JSON.parse(fs.readFileSync(new URL("../web/data/items.json", import.meta.url), "utf8"));
setData({ item: id => items[id] ? { id: +id, ...items[id] } : null });
const { NPC } = await import("../web/src/shared/systems/shopsys.js");

const dialogs = new Map(), open = new Set(), opened = [], sent = [], logs = [], sounds = [];
const gui = { register: d => dialogs.set(d.id, d), open: id => { open.add(id); opened.push(id); }, close: id => { open.delete(id); dialogs.get(id)?.onClose?.(gui); }, isOpen: id => open.has(id), mouse: { x: 0, y: 0 }, onSound: n => sounds.push(n), confirm: async () => true, ask: async () => null };
const me = { x: 10, y: 10, stats: {}, skills: {}, bag: [{ uid: 1, id: 227, count: 1, life: 300 }, { uid: 2, id: 91, count: 3, life: 0 }, { uid: 3, id: 1, count: 1, life: 300 }, { uid: 4, id: 352, count: 1, life: 0 }] };
const api = { me: () => me, pid: 1, send: m => sent.push(m), log: m => logs.push(m), hasNpc: () => true, talk: { 154: ["x"] }, shops: {} };
const nd = registerNpcDialogs(gui, api);
const q = dialogs.get(20), a = dialogs.get(26);
assert.ok(q && a, "menú 20 y alquimia 26 registrados");
assert.equal(q.silent, true, "DlgBoxClick_NpcActionQuery no suena (sin PlaySound)");

// modo 7 (herrero): cajas x 25..100 / 125..175, y 30..45 / 50..65
nd.clickNpc({ id: 5, type: NPC.BLACKSMITH, x: 10, y: 10 }, 300, 200);
assert.equal(q.mode, 7);
opened.length = 0;
assert.equal(q.click(gui, 200, 35), false, "x 200 queda fuera de la caja (original 125..175)");
assert.deepEqual(opened, []);
assert.equal(q.click(gui, 130, 52), true); assert.ok(opened.includes(11), "Buy (W) Armor abre la tienda");

// modo 9 (ayuntamiento): Talk no cierra el cuadro y deja el texto del servidor
nd.clickNpc({ id: 6, type: 25, x: 10, y: 10 }, 300, 200);
assert.equal(q.mode, 9); open.add(20); logs.length = 0;
assert.equal(q.click(gui, 30, 55), true);
assert.ok(logs.includes("Talking to Cityhall Officer...")); assert.ok(open.has(20), "el diálogo 20 sigue abierto en modo 9 Talk");
open.delete(21);

// modo 4: Talk solo con NpcTalk (21) cerrado
nd.clickNpc({ id: 7, type: 21, x: 10, y: 10 }, 300, 200);
open.add(21); logs.length = 0; q.click(gui, 130, 60);
assert.deepEqual(logs, [], "con el NpcTalk abierto el botón Talk no actúa");
open.delete(21);

// objeto en el intercambio abierto: «Item transaction not finished.»
open.add(33); logs.length = 0; q.click(gui, 130, 60); open.delete(33);
assert.deepEqual(logs, ["Item transaction not finished."]);

// modo 3 (almacén): texto de lan_eng.h
Object.assign(q, { mode: 3, npcType: NPC.WAREHOUSE, uid: 3, count: 1 }); me.bank = new Array(300).fill(0);
logs.length = 0; q.click(gui, 30, 60);
assert.deepEqual(logs, ["There is no empty space left in warehouse."]);
me.bank = [];

// alquimia: sin maestría no abre
assert.equal(a.begin(false), false); assert.equal(logs.pop(), "You should learn alchemy skill to use this item.");
assert.equal(a.begin(true), false); assert.equal(logs.pop(), "You should learn alchemy skill to use alchemy skill. Alchemy manual is purchasable in Shop.");
me.skills[12] = 20;
assert.equal(a.begin(false), true); assert.ok(open.has(26)); assert.equal(logs.pop(), "Using alchemy skill..."); assert.equal(a.mode, 1);

// ingredientes: solo EAT / CONSUME / NONE; máximo 6; una pila no se pasa de sus unidades
a.drop(3); assert.deepEqual(a.slots, [], "un arma no es ingrediente");
a.drop(2); a.drop(2); assert.deepEqual(a.slots, [2], "EAT: una unidad y queda desactivado (m_bIsItemDisabled)");
a.slots = []; me.bag[3].count = 3;
a.drop(4); a.drop(4); a.drop(4); a.drop(4);
assert.deepEqual(a.slots, [4, 4, 4], "CONSUME: tantas veces como unidades tenga");
a.drop(2); a.drop(1); logs.length = 0;
a.slots = [4, 4, 4, 2, 2, 2];
a.drop(4); assert.equal(a.slots.length, 6);
me.bag[3].count = 9; a.drop(4); assert.equal(a.slots.length, 6); assert.equal(logs.pop(), "There is no more space for ingredients.");
a.slots = [2, 4];

// Try Now! -> Creating... -> a los 3 pasos manda la orden y cierra
sounds.length = 0;
assert.equal(a.click(gui, 10, 10), false, "fuera del botón");
assert.equal(a.click(gui, 100, 190), true); assert.equal(a.mode, 2); assert.equal(a.step, 1); assert.deepEqual(sounds, [41]);
for (let i = 0; i < 3; i++) { a.t1 = performance.now() - 2000; a.tick(me); }
assert.ok(!open.has(26)); assert.deepEqual(sent.pop(), { t: "alchemy", uids: [2, 4] }); assert.deepEqual(sounds, [41, 42]);

// avisos del servidor (NOTIFY_MSG_HANDLER46-49)
logs.length = 0;
for (const t of ["potion-ok", "potion-fail", "potion-lowskill", "potion-nomatch"]) nd.onEvent({ t, id: 1 }, null);
assert.deepEqual(logs, ["You successfully mixed a potion!", "You failed on mixing a potion.", "Your alchemy level is too low to mix the potion.", "Incorrect ingredients to mix the potion."]);
console.log("OK npcquery-alchemy");
