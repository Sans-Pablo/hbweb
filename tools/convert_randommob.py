#!/usr/bin/env python3
"""Genera web/src/shared/randommob.gen.js a partir del MobGenerator aleatorio del original
(HG.cpp:15993-16780: tabla por nivel de mapa, nombre/SA, iTotalMob y filtros de grupo). Transcripción mecánica, sin editar a mano.
Uso: python3 tools/convert_randommob.py [ruta HG.cpp]"""
import re, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\sansp\Documents\HelbreathOriginal\Helbreath.HGServerConsole\Helbreath.HGServerConsole\HG.cpp"
L = open(SRC, encoding="latin-1").read().split("\n")
def find(pat, start=0):
    for i in range(start, len(L)):
        if pat in L[i]: return i
    raise SystemExit("no encontrado: " + pat)
a = find("switch (m_pMapList[i]->m_cRandomMobGeneratorLevel)", 15900)
b = find("pX = NULL;", a)
lvl = L[a:b]
def tr(s):
    s = re.sub(r"//.*", "", s)
    s = re.sub(r"dice\(1,\s*(\d+)\)", r"d(\1)", s)
    s = s.replace("m_pMapList[i]->m_cRandomMobGeneratorLevel", "level")
    s = re.sub(r"iMapLevel\s*=\s*\d+\s*;", "", s)
    s = s.replace("bFirmBerserk = TRUE", "o.berserk = true")
    s = re.sub(r"iFirmSAType\s*=\s*", "o.firmSA = ", s)
    s = s.replace("iResult", "r").replace("TRUE", "true").replace("FALSE", "false")
    return s
body = "\n".join("    " + tr(x) for x in lvl)
# tabla id -> nombre, tipo, probSA, kindSA
c0 = find("switch (iResult) {", b); tab = {}
for i in range(c0, c0 + 120):
    m = re.search(r'case (\d+):\s+strcpy\(cNpcName,\s*"([^"]+)"\);\s*sNpcType = (\d+)\s*;\s*iProbSA\s*=\s*(\d+);\s*iKindSA\s*=\s*(\d+)', L[i])
    if m: tab[int(m[1])] = [m[2], int(m[3]), int(m[4]), int(m[5])]
    m = re.search(r'default:\s*strcpy\(cNpcName,\s*"([^"]+)"\);\s*sNpcType = (\d+)\s*;\s*iProbSA\s*=\s*(\d+);\s*iKindSA\s*=\s*(\d+)', L[i])
    if m: dflt = [m[1], int(m[2]), int(m[3]), int(m[4])]; break
# iTotalMob por id
t0 = find("case 1:	 iTotalMob", c0); mob = {}
for i in range(t0, t0 + 60):
    m = re.search(r"case (\d+):\s*iTotalMob = (?:dice\(1,(\d+)\)-1|(\d+));", L[i])
    if m: mob[int(m[1])] = ("d-1", int(m[2])) if m[2] else ("n", int(m[3]))
    if "default: iTotalMob" in L[i]: break
# filtros de grupo
g0 = find("if (iTotalMob >= 2) {", t0); grp = {"keep1in5": [], "drop1in5": []}; cur = []; 
for i in range(g0, g0 + 80):
    m = re.search(r"^\s*case (\d+):", L[i])
    if m: cur.append(int(m[1]))
    if "dice(1,5) != 1) iTotalMob = 0" in L[i]: grp["keep1in5"] = cur; cur = []
    if "dice(1,5) == 1) iTotalMob = 0" in L[i]: grp["drop1in5"] = cur; break
import json
out = f"""// GENERADO por tools/convert_randommob.py desde HG.cpp:{a+1}-{g0+60} (MobGenerator aleatorio). No editar a mano.
export const MOB_TABLE = {json.dumps(tab, separators=(",", ":"))};   // id -> [nombre, tipo, probSA, kindSA]
export const MOB_DEFAULT = {json.dumps(dflt)};
export const MOB_COUNT = {json.dumps(mob, separators=(",", ":"))};   // id -> ["d-1", N] = dice(1,N)-1 | ["n", N]; ausente = 0
export const GROUP_KEEP_1_IN_5 = {json.dumps(grp["keep1in5"])};     // con iTotalMob>=2 solo se conserva si dice(1,5)==1
export const GROUP_DROP_1_IN_5 = {json.dumps(grp["drop1in5"])};     // con iTotalMob>=2 se anula si dice(1,5)==1

// Nivel de mapa (m_cRandomMobGeneratorLevel) -> id de monstruo; `d(n)` = dice(1,n). Devuelve {{ id, berserk, firmSA }}.
export function pickMob(level, d) {{
  const o = {{ berserk: false, firmSA: 0 }};
  let r = d(100);
{body}
  o.id = r;
  return o;
}}
"""
open("web/src/shared/randommob.gen.js", "w", newline="\r\n").write(out)
print(len(tab), "monstruos,", len(mob), "conteos")
