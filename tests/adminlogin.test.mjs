// Panel de admin público (sin clave) con botón en el login y sección Observador: comprobación estática del contrato.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const S = readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8"), A = readFileSync(new URL("../server/admin.mjs", import.meta.url), "utf8"), M = readFileSync(new URL("../web/src/client/main.js", import.meta.url), "utf8");
assert.match(S, /adminAllowed = \(\) => true/);
assert.match(A, /id="bobs"/); assert.match(A, /observador\.html/);
assert.match(M, /adminbtn/); assert.match(M, /"\/admin"/);
assert.ok(S.includes("/api/admin/economy")); assert.match(A, /id="eco"/);
console.log("OK adminlogin");
