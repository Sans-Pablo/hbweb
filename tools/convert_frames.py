"""Tiempos y fotogramas de cada monstruo (Client/MapData.cpp, constructor de CMapData) -> web/src/shared/mobtiming.gen.js.
    python convert_frames.py CARPETA_CLIENTE SALIDA_JS
Se evalúan tal cual las asignaciones m_stFrame[tipo][ACCION].m_sFrameTime / m_sMaxFrame (con restar = 20)."""
import json, re, sys
src, out = sys.argv[1:3]
text = open(src + "/MapData.cpp", encoding="latin-1").read()
text = text[text.index("int restar"):]
text = text[:text.index("}", text.index("m_stFrame[110]"))] if "m_stFrame[110]" in text else text
ACT = {"STOP": "stop", "MOVE": "move", "ATTACK": "attack", "DAMAGE": "damage", "DYING": "dying"}
table = {}
for m in re.finditer(r"m_stFrame\[(\d+)\]\[DEF_OBJECT([A-Z]+)\]\.m_s(FrameTime|MaxFrame)\s*=\s*([^;]+);", text):
    t, act, what, expr = int(m.group(1)), m.group(2), m.group(3), m.group(4)
    if act not in ACT: continue
    expr = re.sub(r"//.*", "", expr).strip().replace("restar", "20")
    table.setdefault(t, {}).setdefault(ACT[act], {})["time" if what == "FrameTime" else "max"] = round(eval(expr), 3)
with open(out, "w") as f:
    f.write("// Generado por tools/convert_frames.py desde Client/MapData.cpp: no editar a mano.\n")
    f.write("// MOB_FRAMES[tipo][accion] = { time: ms por fotograma, max: último fotograma lógico }\n")
    f.write("export const MOB_FRAMES = " + json.dumps(table, separators=(",", ":")) + ";\n")
print("tipos:", len(table))
