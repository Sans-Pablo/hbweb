// Hospital de compañeros (diálogo 41, npcdialogs.js): pestañas, filas, buscador y órdenes que envía.
import assert from "node:assert/strict";
globalThis.document = { documentElement: {}, body: null, createElement: () => ({ getContext: () => ctx }) };
globalThis.navigator ??= {};
globalThis.window ??= {};
const ctx = new Proxy({ measureText: s => ({ width: String(s).length * 6 }) }, { get: (o, k) => k in o ? o[k] : () => {}, set: () => true });
const { registerNpcDialogs } = await import("../web/src/client/npcdialogs.js");
const { HOSPITAL, CANDY_PRICE } = await import("../web/src/shared/systems/companion.js");

const dialogs = new Map(), opened = [], sent = [], previews = [];
const gui = { register: d => dialogs.set(d.id, d), open: id => opened.push(id), close() {}, isOpen: () => false, confirm: async () => true, ask: async () => null };
const me = { stats: { str: 10, vit: 10, dex: 10, int: 10, mag: 10, chr: 10 }, lvl: 20, bag: [
  { uid: 7, comp: { sp: "Orc", lvl: 3, hp: 5, nm: "Grunt" } },
  { uid: 8, comp: { sp: "Pixie", lvl: 10, down: true, nm: "Lila" } },
  { uid: 9, name: "Potion" }] };
const api = { me: () => me, send: m => sent.push(m), preview: (sp, npc) => previews.push([sp, npc]), log() {}, hasNpc: () => true };
const nd = registerNpcDialogs(gui, api);
const h = dialogs.get(41); assert.ok(h, "el hospital se registra con id 41");

assert.equal(nd.clickNpc({ id: 55, type: 1, x: 1, y: 2, role: HOSPITAL.role }, 0, 0), true);
assert.deepEqual(opened, [41]); assert.equal(h.tab, 0);

// Cuidados: solo las bolas con compañero; nunca el objeto normal
let r = h.rows(me);
assert.equal(r.length, 2); assert.ok(r.every(x => x.uid && x.ball));
assert.ok(/Inconsciente/.test(r.find(x => x.uid === 8).text) && /Herido|Sano/.test(r.find(x => x.uid === 7).text));
h.pick(r.find(x => x.uid === 7)); assert.deepEqual(sent.pop(), { t: "petheal", npc: 55, uid: 7 });

// Bolas: una por especie base, comprarla = previsualizar
h.tab = 1; r = h.rows(me); assert.ok(r.length > 0 && r.every(x => x.sp && x.right === HOSPITAL.ballPrice));
h.pick(r[0]); assert.deepEqual(previews.pop(), [r[0].sp, 55]);

// Caramelos: tres, con su precio
h.tab = 2; r = h.rows(me); assert.equal(r.length, Object.keys(CANDY_PRICE).length);
h.pick(r[0]); assert.deepEqual(sent.pop(), { t: "candybuy", npc: 55, item: r[0].candy, count: 1 });

// Ayuda: sin filas, con texto
h.tab = 3; assert.deepEqual(h.rows(me), []); assert.ok(h.HELP.length >= 6);

// Buscador: filtra por el texto de la fila
h.tab = 0; h.query = "lila";
assert.deepEqual(h.rows(me).filter(x => x.text.toLowerCase().includes(h.query)).map(x => x.uid), [8]);
h.query = "";
console.log("OK hospital");
