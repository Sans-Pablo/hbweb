// Almacén SQLite: persistencia, solo filas cambiadas, importación de los JSON antiguos, historial y restauración.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openStore } from "../server/store.mjs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hbstore-"));
const quiet = () => {};

// migración de los JSON antiguos
fs.writeFileSync(path.join(dir, "accounts.json"), JSON.stringify({ ana: { name: "Ana", salt: "s", hash: "h" } }));
fs.writeFileSync(path.join(dir, "saves.json"), JSON.stringify({ ana: { level: 7, bag: [{ id: 1, count: 1 }] } }));
let st = await openStore(dir, { log: quiet });
assert.equal(st.kind, "sqlite");
assert.equal(st.saves.ana.level, 7); assert.equal(st.accounts.ana.name, "Ana");
assert.ok(fs.existsSync(path.join(dir, "saves.json.migrated")) && !fs.existsSync(path.join(dir, "saves.json")));

// cambios: solo se escribe lo modificado; sobrevive a reabrir
assert.equal(st.flush(), 0, "sin cambios no se escribe nada");
st.saves.ana.level = 8; st.saves.bob = { level: 1 };
assert.equal(st.flush(), 2);
st.close();
st = await openStore(dir, { log: quiet });
assert.equal(st.saves.ana.level, 8); assert.equal(st.saves.bob.level, 1);

// borrar
delete st.saves.bob; assert.equal(st.flush(), 1); st.close();
st = await openStore(dir, { log: quiet });
assert.ok(!st.saves.bob);

// historial y restauración (flush(true) fuerza copia)
st.saves.ana.level = 20; st.flush(true);
st.saves.ana.level = 3; st.saves.ana.bag = []; st.flush(true);        // «corrupto»
const v = st.versions("ana"); assert.ok(v.length >= 2);
assert.ok(st.restore("ana", v[1]), "restaura la copia anterior");
assert.equal(st.saves.ana.level, 20);
st.close();
st = await openStore(dir, { log: quiet });
assert.equal(st.saves.ana.level, 20, "la restauración quedó guardada");

// poda: nunca más de 24 copias
for (let i = 0; i < 40; i++) { st.saves.ana.level = 100 + i; st.flush(true); }
assert.ok(st.versions("ana").length <= 24);
st.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log("OK");
