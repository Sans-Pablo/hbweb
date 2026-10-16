#!/usr/bin/env python3
"""Captura REAL de cada ventana del juego (todas las de hb.gui.dialogs) y genera docs/diseno/ventanas.html.
Reejecutar tras cualquier cambio de interfaz:   python tools/capturar_ventanas.py
Salida: docs/diseno/ventanas/<id>.png + docs/diseno/ventanas.html (abrir con cualquier servidor estático o directamente).
Las ventanas que dependen de un NPC o de un estado concreto pueden salir vacías: se marcan como "sin contenido"."""
import sys, json, html, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from e2e import game
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "diseno" / "ventanas"; OUT.mkdir(parents=True, exist_ok=True)
NAMES = {1: "Personaje", 2: "Inventario", 3: "Equipo/Magia", 10: "Chat Log", 14: "Almacén", 34: "Guild", 43: "Summons", 45: "Summon",
         46: "Tutorial", 49: "Diario de misiones", 70: "Novedades y pruebas", 72: "Informar de un fallo", 73: "Simulador de estadísticas",
         74: "Menú automático", 75: "Auto Hunt (mini)", 76: "Misión (mini)"}
FRAME = """(async()=>{const g=hb.gui;for(const id of [...g.dialogs.keys()])try{g.close(id,true)}catch(e){}
if(hb.tutorial){hb.tutorial.skipAll&&hb.tutorial.skipAll();hb.tutorial.suppress=true}
for(const d of g.dialogs.values())if(d.id==76||d.id==75)d.x=5000;
return 1})()"""
def main():
    with game() as pg:
        pg.evaluate(FRAME)
        ids = pg.evaluate("[...hb.gui.dialogs.values()].map(d=>d.id)")
        items = []
        for i in ids:
            r = pg.evaluate(f"""(async()=>{{const g=hb.gui;for(const id of [...g.dialogs.keys()])try{{g.close(id,true)}}catch(e){{}}
              try{{g.open({i},true)}}catch(e){{return null}} const d=g.dialogs.get({i}); if(!d) return null;
              if(d.x>=800) d.x=300;
              await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
              const s=g.scale,R=g.rect,b=document.querySelector('#gui').getBoundingClientRect();
              return {{t:d.title||'',x:b.left+R.x+d.x*s-2,y:b.top+R.y+d.y*s-2,w:Math.round(d.w*s)+4,h:Math.round(d.h*s)+4}}}})()""")
            if not r: continue
            vp = pg.viewport_size
            x, y = max(0, r["x"]), max(0, r["y"]); w = min(r["w"], vp["width"] - x); h = min(r["h"], vp["height"] - y)
            f = OUT / f"{i}.png"; pg.screenshot(path=str(f), clip={"x": x, "y": y, "width": w, "height": h})
            items.append({"id": i, "name": NAMES.get(i) or r["t"].strip() or f"Ventana {i}", "size": f"{w}x{h}", "kb": f.stat().st_size // 1024})
        ver = json.loads((ROOT / "web/data/version.json").read_text(encoding="utf-8"))
        cards = "".join(f'<figure><figcaption><b>{html.escape(it["name"])}</b> <small>id {it["id"]} · {it["size"]}</small></figcaption>'
                        f'<img loading="lazy" src="ventanas/{it["id"]}.png" alt=""></figure>' for it in items)
        page = f"""<!doctype html><html lang="es"><meta charset="utf-8"><title>Ventanas reales del juego</title>
<style>body{{margin:0;padding:24px;font:13px Tahoma,Verdana,sans-serif;background:#12100b;color:#e6d6ac}}h1{{font:600 18px Tahoma;color:#f2c14e;margin:0 0 4px}}
p{{color:#b9a67a}}.g{{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}}figure{{margin:0}}figcaption{{margin-bottom:6px}}small{{color:#8a7a52}}
img{{display:block;background:#000;border:1px solid #3a2e1e;image-rendering:auto}}</style><body>
<h1>Ventanas reales del juego</h1><p>hbweb v{ver["version"]} · {ver.get("name","")} · generado {datetime.datetime.now():%Y-%m-%d %H:%M} con <code>python tools/capturar_ventanas.py</code> · {len(items)} ventanas.
Las que dependen de un NPC o estado concreto pueden verse vacías.</p><div class="g">{cards}</div></body></html>"""
        (ROOT / "docs/diseno/ventanas.html").write_text(page, encoding="utf-8")
        print(f"{len(items)} ventanas -> docs/diseno/ventanas.html (v{ver['version']}); errores:", pg.errors or "ninguno")
if __name__ == "__main__": main()
