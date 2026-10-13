// Añade a web/data/items.json los objetos de Item*.cfg (incl. Item4.cfg) que el conversor antiguo no leyó.
// No toca los ya existentes. Uso: node tools/add_missing_items.mjs CARPETA_CONFIG
import fs from "node:fs";
const F = ["type","equipPos","effectType","v1","v2","v3","v4","v5","v6","maxLife","specialEffect","sprite","spriteFrame","price","weight","appr","speed","levelLimit","gender","seV1","seV2","skill","category","color"];
const dir = process.argv[2], out = "web/data/items.json", it = JSON.parse(fs.readFileSync(out, "utf8"));
let add = [], bad = [];
for (const f of ["Item.cfg", "Item2.cfg", "Item3.cfg", "Item4.cfg"]) {
  for (const l of fs.readFileSync(dir + "/" + f, "latin1").split(/\r?\n/)) {
    if (/^\s*\[ENDITEMLIST\]/.test(l)) break;
    const m = l.match(/^\s*item\s*=\s*(\d+)\s+(\S+)\s+(.*)/i); if (!m) continue;
    const id = +m[1]; if (it[id]) continue;
    const nums = m[3].split(/\s+/).filter(Boolean);
    if (nums.length < F.length) { bad.push(f + ":" + id + ":" + m[2] + "(" + nums.length + ")"); continue; }
    const o = { name: m[2] }; F.forEach((k, i) => o[k] = parseInt(nums[i], 10)); o.display = m[2];
    it[id] = o; add.push(id);
  }
}
const sorted = Object.fromEntries(Object.entries(it).sort((a, b) => a[0] - b[0]));
fs.writeFileSync(out, JSON.stringify(sorted));
console.log("añadidos", add.length, add.join(","), "\nmal formados", bad.join(" "));
