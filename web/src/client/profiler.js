// Perfilador A/B automático (?prof=1): en la misma escena alterna fases con una capa del dibujado apagada y mide los fps de cada una,
// para saber qué capa cuesta GPU/compositor (el JS ya se mide aparte). Lógica pura (sin DOM): tests/profiler.test.mjs.
export const PHASES = [
  { name: "base", pf: {} },
  { name: "sinSuelo", pf: { ground: 1 } },
  { name: "sinEntidades", pf: { ents: 1 } },
  { name: "sinLuces", pf: { light: 1 } },
  { name: "sinFx", pf: { fx: 1 } },
  { name: "nada", pf: { ground: 1, ents: 1, light: 1, fx: 1 } },
  { name: "base2", pf: {} },
];

export class Profiler {
  constructor(secs = 6, warm = 1.5, phases = PHASES) { this.secs = secs * 1000; this.warm = warm * 1000; this.phases = phases; this.i = 0; this.t0 = null; this.reset(); this.done = false; }
  reset() { this.n = 0; this.sum = 0; this.max = 0; }
  get pf() { return this.done ? {} : this.phases[this.i].pf; }
  get name() { return this.done ? "fin" : this.phases[this.i].name; }
  // Una llamada por fotograma, antes de dibujar. now/dt en ms. Devuelve el resumen de la fase recién terminada (o null).
  step(now, dt) {
    if (this.done) return null;
    if (this.t0 === null) this.t0 = now;
    const el = now - this.t0;
    if (el >= this.warm) { this.n++; this.sum += dt; if (dt > this.max) this.max = dt; }
    if (el < this.secs) return null;
    const r = { phase: this.phases[this.i].name, frames: this.n, fps: this.sum ? Math.round(this.n * 10000 / this.sum) / 10 : 0, frameMs: this.n ? Math.round(this.sum / this.n * 10) / 10 : 0, maxMs: Math.round(this.max) };
    this.i++; this.t0 = now; this.reset();
    if (this.i >= this.phases.length) this.done = true;
    return r;
  }
}
