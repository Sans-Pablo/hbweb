#!/usr/bin/env python3
"""Abre cada cuadro registrado y lista textos fuera del marco, sobre el botón Ok o superpuestos (ver reglas en client/classicdialog.js).
  python3 tools/lint_dialogs.py        -> imprime los problemas; código de salida 1 si hay alguno"""
import sys; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from e2e import game
JS_OPEN = """async (id)=>{ const g=hb.gui; g.lintOn=true; try{ if(g.isOpen(id)) g.close(id); g.open(id); }catch(e){ return 'ERR '+e.message } return 'ok' }"""
with game() as pg:
    ids = pg.evaluate("[...hb.gui.dialogs.keys()]")
    bad = 0
    for i in ids:
        r = pg.evaluate(JS_OPEN, i); pg.wait_for_timeout(250)
        pg.evaluate("(id)=>{ if(hb.gui.isOpen(id)) hb.gui.close(id) }", i)
        if r != "ok": print(f"[{i}] no se pudo abrir: {r}"); continue
    res = pg.evaluate("Object.fromEntries(Object.entries(window.hbLint||{}).map(([k,v])=>[k,[...v]]))")
    for k, v in res.items():
        for m in v: print(f"[{k}] {m}"); bad += 1
    print("lint_dialogs:", "OK" if not bad else f"{bad} problema(s)")
    sys.exit(1 if bad else 0)
