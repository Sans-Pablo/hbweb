import { readFileSync } from "node:fs";
const r = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const gui = r("web/src/client/gui.js"), ren = r("web/src/client/renderer.js");
const ok = (c, m) => { if (!c) { console.error("FALLA: " + m); process.exit(1); } };
ok(/itemTooltip/.test(gui) && gui.includes("hdrH") && gui.includes("MAIN") && gui.includes("SUB"), "ficha con cabecera, principal y secundarios");
ok(gui.includes("info.color"), "nombre con color de rareza");
ok(!ren.includes("pitMob"), "sin mini esqueleto en la entrada de la cripta (v0.85.7)");
console.log("OK fichas-pozos");
