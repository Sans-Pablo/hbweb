// Registro de rendimiento del jugador: desde que entra hasta que sale. Muestras de 1 s (fps, coste de dibujado por fase,
// caché de personajes, entidades) que se envían al servidor (/api/perflog -> data/perf/<jugador>_<sesión>.jsonl) para analizarlas luego.
export class PerfLog {
  constructor(version) {
    this.sid = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    this.buf = []; this.name = ""; this.t0 = performance.now(); this.version = version || "";
    this.acc = null; this.lastT = 0; this.on = false; this.pc0 = null;
    addEventListener("pagehide", () => this.end("pagehide"));
    addEventListener("visibilitychange", () => { if (document.hidden) this.push({ ev: "hidden" }); else this.push({ ev: "visible" }); });
  }
  gpu() {
    try { const g = document.createElement("canvas").getContext("webgl"), x = g.getExtension("WEBGL_debug_renderer_info"); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : "?"; } catch { return "?"; }
  }
  start(name, extra = {}) {
    this.name = String(name || "?"); this.on = true; this.t0 = performance.now(); this.acc = this.fresh(); this.lastT = this.t0;
    this.push({ ev: "start", user: this.name, version: this.version, ua: navigator.userAgent, screen: [screen.width, screen.height], inner: [innerWidth, innerHeight],
      dpr: window.devicePixelRatio, cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory, gpu: this.gpu(), ...extra });
    this.timer = setInterval(() => this.flush(), 8000);
  }
  fresh() { return { n: 0, dt: 0, max: 0, long: 0, draw: 0, drawMax: 0, g: 0, e: 0, l: 0, f: 0 }; }
  push(o) { this.buf.push({ t: Math.round(performance.now() - this.t0), ...o }); }
  // llamar una vez por fotograma tras dibujar: dt = ms desde el fotograma anterior, draw = ms del renderer.render, r = renderer, extra = datos del mundo
  frame(dt, draw, r, extra) {
    const a = this.acc; if (!this.on || !a || document.hidden) return;
    a.n++; a.dt += dt; if (dt > a.max) a.max = dt; if (dt > 50) a.long++;
    a.draw += draw; if (draw > a.drawMax) a.drawMax = draw;
    a.g += r.pt.ground; a.e += r.pt.ents; a.l += r.pt.light; a.f += r.pt.fx;
    const now = performance.now();
    if (now - this.lastT < 1000) return;
    const st = r.pcache.st, p = this.pc0 || { hit: 0, comp: 0, direct: 0, recycled: 0, msComp: 0, msDirect: 0, msHit: 0, warm: 0, msWarm: 0, nDirect: 0 }, n = a.n, k = x => +(x / n).toFixed(2);
    const s = { fps: Math.round(n * 1000 / (now - this.lastT)), frameMs: k(a.dt), maxMs: +a.max.toFixed(1), long: a.long, drawMs: k(a.draw), drawMax: +a.drawMax.toFixed(1),
      gMs: k(a.g), eMs: k(a.e), lMs: k(a.l), fxMs: k(a.f), onscreen: r.crowdLast, q: r.q || 0, scale: +r.scale.toFixed(2),
      pc: { hit: st.hit - p.hit, comp: st.comp - p.comp, direct: st.direct - p.direct, rec: st.recycled - p.recycled, n: r.pcache.map.size,
        warm: st.warm - p.warm, ms: { comp: +(st.msComp - p.msComp).toFixed(1), direct: +(st.msDirect - p.msDirect).toFixed(1), nd: (st.nDirect || 0) - (p.nDirect || 0), hit: +(st.msHit - p.msHit).toFixed(1), warm: +(st.msWarm - p.msWarm).toFixed(1) }, cp: Object.fromEntries(Object.entries(st.cp).map(([k, v]) => [k, +(v - (p.cp ? p.cp[k] : 0)).toFixed(1)])) },
      ...extra };
    const m = performance.memory; if (m) s.heapMB = Math.round(m.usedJSHeapSize / 1048576);
    this.pc0 = { ...st, cp: { ...st.cp } };
    this.push(s); this.acc = this.fresh(); this.lastT = now;
  }
  flush(final) {
    if (!this.buf.length) return;
    const body = this.buf.map(o => JSON.stringify(o)).join("\n") + "\n"; this.buf = [];
    const url = "/api/perflog?s=" + this.sid + "&u=" + encodeURIComponent(this.name);
    try { if (final && navigator.sendBeacon) navigator.sendBeacon(url, body); else fetch(url, { method: "POST", body, keepalive: true }).catch(() => {}); } catch {}
  }
  end(why) { if (!this.on) return; this.push({ ev: "end", why }); this.on = false; clearInterval(this.timer); this.flush(true); }
}
