#!/usr/bin/env python3
"""Pruebas visuales en un solo comando (Playwright + Chromium). Arranca el servidor si hace falta, crea cuenta y personaje,
salta el tutorial y deja `window.hb` listo. Sirve para verificar un cambio sin reescribir el guion cada vez.

  python3 tools/e2e.py --shot /tmp/a.png                       escritorio, captura
  python3 tools/e2e.py --mobile --eval "hb.gui.open('inv')" --shot /tmp/m.png
  python3 tools/e2e.py --tap "#m-menu" --tap "#m-sheet [data-t]:nth-child(2)" --shot /tmp/m.png
  python3 tools/e2e.py --keep-tutorial ...                     no saltar el tutorial
Varios --eval/--tap/--wait/--shot se ejecutan EN ORDEN. Imprime errores de consola y el resultado de cada --eval.
Uso desde Python: from e2e import game; with game(mobile=True) as pg: ...
"""
import argparse, contextlib, os, socket, subprocess, sys, time, random
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
PORT = 8123

def _serve():
    s = socket.socket()
    try: s.connect(("127.0.0.1", PORT)); return None
    except OSError: pass
    finally: s.close()
    p = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT / "web", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); return p

def _player(b, mobile, skip_tutorial, query, size, user=None):
    if mobile:
        ctx = b.new_context(viewport=size or {"width": 844, "height": 390}, device_scale_factor=2, is_mobile=True, has_touch=True,
                            user_agent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")
    else:
        ctx = b.new_context(viewport=size or {"width": 1280, "height": 800})
    pg = ctx.new_page(); pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: pg.errors.append(m.text) if m.type == "error" and "404" not in m.text else None)
    click = pg.tap if mobile else pg.click
    pg.goto(f"http://localhost:{PORT}/?{'mobile=1&' if mobile else ''}{query}"); pg.wait_for_timeout(2500)
    pg.user = user or "e2e" + str(random.randint(1000, 9999))
    click('#join [data-tab=new]'); pg.fill('#join .user', pg.user); pg.fill('#join .pass', 'abcdef'); pg.fill('#join .pass2', 'abcdef')
    click('#join .go'); pg.wait_for_timeout(2500)
    click("text=Crear personaje >> nth=-1"); pg.wait_for_function("window.hb && hb.world", timeout=30000); pg.wait_for_timeout(2500)
    if skip_tutorial: pg.evaluate("()=>hb.tutorial&&hb.tutorial.skipAll&&hb.tutorial.skipAll()"); pg.wait_for_timeout(400)
    return pg

@contextlib.contextmanager
def players(n=1, mobile=False, skip_tutorial=True, query="", size=None):
    """n jugadores (cada uno en su contexto de navegador) sobre el mismo servidor/URL; úsalo con query="server=http://localhost:8088" para el modo online."""
    srv = _serve()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
        try: yield [_player(b, mobile, skip_tutorial, query, size) for _ in range(n)]
        finally:
            b.close()
            if srv: srv.terminate()

@contextlib.contextmanager
def game(mobile=False, skip_tutorial=True, query="", size=None):
    with players(1, mobile, skip_tutorial, query, size) as (pg,): yield pg

def main():
    a = argparse.ArgumentParser(); a.add_argument("--mobile", action="store_true"); a.add_argument("--keep-tutorial", action="store_true")
    a.add_argument("--query", default=""); a.add_argument("--size", help="WxH")
    a.add_argument("--eval", action="append", default=[]); a.add_argument("--tap", action="append", default=[])
    a.add_argument("--wait", action="append", default=[]); a.add_argument("--shot", action="append", default=[])
    a = a.parse_args()
    size = dict(zip(("width", "height"), map(int, a.size.split("x")))) if a.size else None
    with game(a.mobile, not a.keep_tutorial, a.query, size) as pg:
        # el orden de la línea de comandos manda
        argv = sys.argv[1:]; ev, tp, wt, sh = map(iter, (a.eval, a.tap, a.wait, a.shot))
        for i, x in enumerate(argv):
            if x == "--eval": print("eval:", pg.evaluate(next(ev)))
            elif x == "--tap": (pg.tap if a.mobile else pg.click)(next(tp)); pg.wait_for_timeout(500)
            elif x == "--wait": pg.wait_for_timeout(int(next(wt)))
            elif x == "--shot": f = next(sh); pg.screenshot(path=f); print("shot:", f)
        print("errores:", pg.errors or "ninguno")
if __name__ == "__main__": main()
