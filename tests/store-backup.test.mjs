// Copia de seguridad diaria del almacén SQLite: crea backups/hb-AAAA-MM-DD.sqlite, una por día, y se puede reabrir.
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { openStore } from "../server/store.mjs";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hbbk-"));
const st = await openStore(dir, { accountsFile: path.join(dir, "a.json"), savesFile: path.join(dir, "s.json"), log: () => {} });
st.saves.pepe = { name: "pepe", level: 3 }; 
const out = st.backup();
assert.ok(out && fs.existsSync(out), "crea la copia");
assert.equal(st.backup(), null, "una por día");
const bd = path.dirname(out);
for (let d = 1; d <= 9; d++) fs.writeFileSync(path.join(bd, `hb-2020-01-0${d}.sqlite`), "x");
fs.rmSync(out); st.backup(3);
assert.ok(fs.readdirSync(bd).length <= 3, "poda a 3");
st.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log("store-backup OK");
