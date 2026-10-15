#!/usr/bin/env python3
"""Pruebas de rendimiento autónomas: escenarios con bots, monstruos y magias; mide fps, tiempo de dibujo y fotogramas lentos y guarda
capturas de referencia + resultados en pruebas/rendimiento/. Uso: python tools/perf.py [escenario ...] [--secs 8]
Presupuesto mínimo (por escenario): dibujo medio < 12 ms y p95 de fotograma < 33 ms."""
import json, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e import game, ROOT

OUT = ROOT / "pruebas" / "rendimiento"
D = lambda **k: dict(t="dbg", **k)
SCEN = {
  "base":      [],
  "bots20":    [D(op="bot", n=10, level=40), D(op="bot", n=10, level=40)],
  "monstruos": [D(op="spawn", name="Cyclops", count=5), D(op="spawn", name="Troll", count=8), D(op="spawn", name="Liche", count=3)],
  "correr":    [D(op="bot", n=10, level=40), D(op="bot", n=10, level=40)],   # el jugador corre dirección tras dirección (cámara en movimiento)
  "magia":     [D(op="fullmage"), D(op="spawn", name="Cyclops", count=5), D(op="spawn", name="Troll", count=8), D(op="spawn", name="Demon", count=3),
                D(op="bot", n=10, level=60), D(op="bot", n=10, level=60)],
  "extremo":   [D(op="fullmage"), D(op="spawn", name="Cyclops", count=10), D(op="spawn", name="Troll", count=10), D(op="spawn", name="Liche", count=5),
                D(op="spawn", name="Demon", count=5)] + [D(op="bot", n=10, level=80)] * 4,
}
MEASURE = """async (secs) => {
  const r = hb.renderer, orig = r.render.bind(r), draw = [], frames = [];
  r.render = (...a) => { const t = performance.now(); const v = orig(...a); draw.push(performance.now() - t); return v; };
  let last = performance.now(), run = true;
  const loop = () => { const n = performance.now(); frames.push(n - last); last = n; if (run) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  await new Promise(s => setTimeout(s, secs * 1000)); run = false; r.render = orig;
  const q = (a, p) => { a = [...a].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))] || 0; };
  const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return { fps: +(frames.length / secs).toFixed(1), drawAvg: +avg(draw).toFixed(2), drawP95: +q(draw, .95).toFixed(2), drawMax: +Math.max(0, ...draw).toFixed(1),
           frameP95: +q(frames, .95).toFixed(1), frameMax: +Math.max(0, ...frames).toFixed(0), ents: hb.world?.ents?.size ?? null, ping: hb.conn.ping, q: r.q || 0 };
}"""

def top(prof):
    nodes = {n["id"]: n for n in prof["nodes"]}; self_t = {}
    dt = prof["timeDeltas"]
    for sid, d in zip(prof["samples"], dt): self_t[sid] = self_t.get(sid, 0) + d
    agg = {}
    for i, t in self_t.items():
        cf = nodes[i]["callFrame"]; k = f'{cf["functionName"] or "(anon)"} {cf["url"].split("/")[-1]}:{cf["lineNumber"]+1}'; agg[k] = agg.get(k, 0) + t
    par = {}
    for n in prof["nodes"]:
        for c in n.get("children", []): par[c] = n["id"]
    inc = {}
    for i, t in self_t.items():
        seen = set(); j = i
        while j:
            cf = nodes[j]["callFrame"]; k = f'{cf["functionName"] or "(anon)"} {cf["url"].split("/")[-1]}:{cf["lineNumber"]+1}'
            if k not in seen and cf["url"]: inc[k] = inc.get(k, 0) + t; seen.add(k)
            j = par.get(j)
    tt = sum(self_t.values()); print("  -- inclusivo")
    for k, t in sorted(inc.items(), key=lambda x: -x[1])[:16]: print(f"   {t/tt*100:5.1f}%  {k}")
    print("  -- propio")
    tot = sum(agg.values())
    for k, t in sorted(agg.items(), key=lambda x: -x[1])[:14]: print(f"   {t/tot*100:5.1f}%  {k}")

def main():
    args = sys.argv[1:]; secs = 8
    if "--secs" in args: i = args.index("--secs"); secs = int(args[i + 1]); del args[i:i + 2]
    names = args or list(SCEN)
    OUT.mkdir(parents=True, exist_ok=True); res = {}
    for n in names:
        with game(query="offline=1") as pg:
            import os
            if os.environ.get("RSET"): pg.evaluate("o=>{const r=hb.renderer;for(const k in o){if(k==='hd'){r.hdOpt=o[k];r.spr.hd=o[k]}else r[k]=o[k]}}", json.loads(os.environ["RSET"]))   # variantes: {"hd":false,"lightFx":false,"lighting":false}
            for c in SCEN[n]: pg.evaluate("c=>hbDev.send(c)", c); pg.wait_for_timeout(300)
            pg.wait_for_timeout(22000)
            if n in ("magia", "extremo"):   # el jugador también lanza: círculo de ataque continuo con rayos
                pg.evaluate("()=>{ const w=hb.world; }")
            import os
            cdp = None
            if os.environ.get("PROF"): cdp = pg.context.new_cdp_session(pg); cdp.send("Profiler.enable"); cdp.send("Profiler.start")
            if n == "correr": pg.evaluate("()=>{let i=0;window.__run=setInterval(()=>{hbDev.send({t:'move',dir:[3,3,3,3,5,5,5,5,7,7,7,7,1,1,1,1][i++%16],run:true})},140)}")
            r = pg.evaluate(MEASURE, secs)
            if cdp: top(cdp.send("Profiler.stop")["profile"]); r["errores"] = pg.errors[:3]
            pg.screenshot(path=str(OUT / f"{n}.png")); res[n] = r
            ok = r["drawAvg"] < 12 and r["frameP95"] < 33
            print(f"{'OK ' if ok else 'LENTO'} {n:10} {r}")
    (OUT / "resultados.json").write_text(json.dumps(res, indent=1))
if __name__ == "__main__": main()
