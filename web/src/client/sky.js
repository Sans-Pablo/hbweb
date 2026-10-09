// Cielo del cliente: noche (G_cSpriteAlphaDegree), lluvia (DrawWhetherEffects / WhetherObjectFrameCounter de Game.cpp)
// y la música de cada lugar (StartBGM).

const DROPS = 600;                                  // DEF_MAXWHETHEROBJECTS
const FALL_FRAMES = 16, FALL_LEN = 20, SPLASH_END = 25;       // fotogramas 16..19 de caída, 20..24 de salpicadura (efecto 11)
const TICK_MS = 30;

// pista según el lugar del mapa (m_cCurLocation)
export function trackFor(world) {
  if (world?.map?.kind === "dungeon") return "darkloop";                   // Dark_Loop.mp3 aportada por el usuario para la cripta
  const loc = (world?.meta?.location || "").toLowerCase();
  const rules = [["aresden", "aresden"], ["elvine", "elvine"], ["dglv", "dungeon"], ["middled1", "dungeon"], ["middleland", "middleland"],
    ["druncncity", "druncncity"], ["infernia", "middleland"], ["maze", "dungeon"], ["abaddon", "abaddon"]];
  for (const [prefix, track] of rules) if (loc.startsWith(prefix)) return track;
  return "maintm";
}

export class Sky {
  constructor() {
    this.night = 0;                                 // 0 día .. 1 noche (se funde)
    this.nightTarget = 0;
    this.weather = 0;
    this.drops = [];
    this.t = 0;
  }

  // lo que dice el mundo (dayOrNight 1/2, weather 0..6)
  sync(world) {
    this.nightTarget = world.fixedDay ? 0 : world.dayOrNight === 2 ? 1 : 0;
    const v = world.fixedDay ? 0 : world.weather || 0;
    if (v !== this.weather) this.setWeather(v);
  }

  setWeather(v) {
    this.weather = v;
    this.drops = [];
    this.t = 0;
    if (v >= 1 && v <= 3) {
      const n = v === 1 ? DROPS / 5 : v === 2 ? DROPS / 2 : DROPS;
      for (let i = 0; i < n; i++) this.drops.push({ x: 0, y: 0, step: -Math.floor(Math.random() * 40), live: false });
    }
  }

  update(dt) {
    this.night += Math.sign(this.nightTarget - this.night) * Math.min(Math.abs(this.nightTarget - this.night), dt / 3000);
    this.t += dt;
    while (this.t >= TICK_MS) { this.t -= TICK_MS; this.tick(); }
  }

  // un paso de gota: cae acelerando hasta el suelo, salpica y reaparece arriba
  tick() {
    for (const d of this.drops) {
      d.step++;
      if (d.step >= 0 && d.step < FALL_LEN) {
        if (!d.live) { d.live = true; d.land = Math.random(); d.sx = Math.random(); }
        d.fall = (d.fall || 0) + Math.max(0, 40 - d.step);
      } else if (d.step >= SPLASH_END) {
        d.step = -Math.floor(Math.random() * 10);
        d.live = false; d.fall = 0;
      }
    }
  }

  // ctx dibujando en coordenadas de pantalla del mundo (0..vw, 0..vh); sp = SpellFx (put)
  draw(ctx, vw, vh, sp) {
    if (this.night > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const k = this.night;
      ctx.fillStyle = `rgb(${Math.round(255 - 150 * k)},${Math.round(255 - 130 * k)},${Math.round(255 - 70 * k)})`;   // azul oscuro: la noche del original oscurece y enfría
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
    }
    if (!this.drops.length || !sp) return;
    for (const d of this.drops) {
      if (!d.live) continue;
      const x = d.sx * (vw + 120) - 60 - Math.min(d.step, FALL_LEN) * 1, land = 40 + d.land * (vh - 60);
      if (d.step >= 0 && d.step < FALL_LEN) {
        const y = land - 610 + d.fall;                   // 610 = suma de los saltos 40-step de una caída
        sp.put(ctx, 11, FALL_FRAMES + Math.floor(d.step / 6), x, y, "add", .9);
      } else if (d.step >= FALL_LEN && d.step < SPLASH_END) {
        sp.put(ctx, 11, d.step, x, land, "add", .9);
      }
    }
  }
}
