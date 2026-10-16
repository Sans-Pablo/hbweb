// Login de admin por cuenta (POST /api/admin/login) y sección Observador del panel: comprobación estática del contrato.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const S = readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8"), A = readFileSync(new URL("../server/admin.mjs", import.meta.url), "utf8"), M = readFileSync(new URL("../web/src/client/main.js", import.meta.url), "utf8");
assert.match(S, /\/api\/admin\/login/); assert.match(S, /ADMINS\.has\(/); assert.match(S, /sessionOk\(t\)/);
assert.match(S, /adminSessions\.set\(token, Date\.now\(\) \+/);
assert.match(A, /id="bobs"/); assert.match(A, /observador\.html/);
assert.match(M, /adminbtn/); assert.match(M, /\/api\/admin\/login/);
console.log("OK adminlogin");
