// Sonido: efectos originales (SOUNDS/*.wav) con volumen y panorámica según la distancia,
// como PlaySound(tipo, n, distancia, pan) del cliente, y la música del mapa.
import { posOf } from "./anim.js";

const MUSIC_VOL = 0.35;

export class Sound {
  constructor(world, me) {
    this.world = world;
    this.me = me;
    this.on = true;
    this.ctx = null;
    this.buffers = new Map();
    this.tracks = null;
    this.track = "maintm";
    this.mode = "remastered";
    this.last = new Map();
  }

  // Carga bajo demanda: sonidos del mapa en el que se entra (monstruos). Si el audio aún no se ha desbloqueado, se guardan para entonces.
  prefetch(names) {
    if (!this.ctx) { this.wanted = [...(this.wanted || []), ...names]; return; }
    for (const n of names) this.buffer(n);
  }

  // los navegadores solo dejan sonar audio después de un gesto del usuario
  unlock() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.7 * (this.vol ?? 1) : 0;
      this.master.connect(this.ctx.destination);
    } catch { return; }
    // música: la original y la remasterizada suenan a la vez y sincronizadas; el modo
    // gráfico decide cuál se oye (como Diablo II Resurrected al cambiar de modo)
    this.tracks = this.makeTracks(this.track);
    if (this.wanted) { const w = this.wanted; this.wanted = null; this.prefetch(w); }
    if (this.on) this.startMusic();
    if (this.wantRain) this.rain(true);
  }

  makeTracks(name) {
    const mk = src => {
      const a = new window.Audio(src);
      a.loop = true; a.preload = "auto"; a.volume = 0;
      a.addEventListener("error", () => { a.broken = true; this.applyMusic(0); });
      return a;
    };
    return { classic: mk("data/music/" + name + ".mp3"), remastered: mk("data/music/" + name + ".remaster.mp3") };
  }

  // cambia la pista (StartBGM: si ya suena la misma no hace nada); la anterior se apaga con un fundido
  setTrack(name) {
    if (name === this.track) return;
    this.track = name;
    if (!this.tracks) return;
    const old = this.tracks, t0 = performance.now(), from = { classic: old.classic.volume, remastered: old.remastered.volume };
    const fade = () => {
      const k = Math.min(1, (performance.now() - t0) / 600);
      for (const m of ["classic", "remastered"]) old[m].volume = from[m] * (1 - k);
      if (k < 1) requestAnimationFrame(fade); else for (const a of Object.values(old)) a.pause();
    };
    fade();
    this.tracks = this.makeTracks(name);
    if (this.on) this.startMusic();
  }

  // lluvia: bucle del sonido E38 mientras llueve (SetWhetherStatus)
  async rain(on) {
    if (!this.ctx) { this.wantRain = on; return; }
    if (on && !this.rainSrc && this.on) {
      const buf = await this.buffer("E38"); if (!buf || this.rainSrc) return;
      const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0.6;
      s.connect(g).connect(this.master); s.start();
      this.rainSrc = s;
    } else if (!on && this.rainSrc) { try { this.rainSrc.stop(); } catch {} this.rainSrc = null; }
  }

  startMusic() {
    for (const a of Object.values(this.tracks)) a.play().catch(() => {});
    this.applyMusic(0);
  }

  // modo "classic" o "remastered": funde una versión con la otra en el mismo punto
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (!this.tracks) return;
    const to = this.tracks[mode], from = this.tracks[mode === "classic" ? "remastered" : "classic"];
    if (!to.broken && !from.broken && isFinite(from.currentTime) && to.duration) {
      try { to.currentTime = from.currentTime % to.duration; } catch {}
    }
    this.applyMusic(700);
  }

  applyMusic(ms) {
    if (!this.tracks) return;
    const want = this.tracks[this.mode]?.broken ? "classic" : this.mode;
    const target = { classic: want === "classic" ? MUSIC_VOL : 0, remastered: want === "remastered" ? MUSIC_VOL : 0 };
    const start = performance.now(), from = { classic: this.tracks.classic.volume, remastered: this.tracks.remastered.volume };
    cancelAnimationFrame(this.fadeRaf);
    const step = () => {
      const k = ms ? Math.min(1, (performance.now() - start) / ms) : 1;
      for (const m of ["classic", "remastered"]) this.tracks[m].volume = from[m] + (target[m] - from[m]) * k;
      if (k < 1) this.fadeRaf = requestAnimationFrame(step);
    };
    step();
  }

  setVolume(pct) { this.vol = Math.max(0, Math.min(1, pct / 100)); if (this.master) this.master.gain.value = this.on ? 0.7 * this.vol : 0; }
  toggle() {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 0.7 * (this.vol ?? 1) : 0;
    if (this.tracks) {
      if (this.on) this.startMusic();
      else for (const a of Object.values(this.tracks)) a.pause();
    }
    return this.on;
  }

  async buffer(name) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const p = fetch("data/sfx/" + name + ".wav").then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).catch(() => null);
    this.buffers.set(name, p);
    return p;
  }

  async play(name, id, vol = 1) {
    if (!this.ctx || !this.on) return;
    // no repetir el mismo sonido de la misma fuente más de una vez cada 60 ms
    const k = name + ":" + id, now = performance.now();
    if (now - (this.last.get(k) || 0) < 60) return;
    this.last.set(k, now);
    let pan = 0, gain = vol;
    const src = this.world.ents.get(id), me = this.world.ents.get(this.me);
    if (src && me && src !== me) {
      const [sx, sy] = posOf(src, this.world.time), [mx, my] = posOf(me, this.world.time);
      const d = Math.hypot(sx - mx, sy - my) / 32;
      if (d > 14) return;
      gain *= Math.max(0, 1 - d / 14);
      pan = Math.max(-1, Math.min(1, (sx - mx) / 400));
    }
    const buf = await this.buffer(name);
    if (!buf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; s.connect(g).connect(p).connect(this.master); }
    else s.connect(g).connect(this.master);
    s.start();
  }

  // sonido de un efecto en la casilla (tx,ty): volumen y panorámica según la distancia, como PlaySound
  playAt(name, tx, ty) {
    const me = this.world.ents.get(this.me);
    if (!me) return this.play(name, this.me);
    const d = Math.max(Math.abs(tx - me.x), Math.abs(ty - me.y));
    if (d > 14) return;
    this.playRaw(name, Math.max(0, 1 - d / 14), Math.max(-1, Math.min(1, (tx - me.x) / 12)));
  }
  async playRaw(name, gain, pan) {
    if (!this.ctx || !this.on) return;
    const buf = await this.buffer(name); if (!buf) return;
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = gain;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; s.connect(g).connect(p).connect(this.master); } else s.connect(g).connect(this.master);
    s.start();
  }

  // M(base) andar, M(base+1) atacar, M(base+2) daño, M(base+3) morir
  onEvent(ev) {
    const e = this.world.ents.get(ev.id);
    const mob = e && e.kind === "npc" ? e.cfg.sound : 0;
    switch (ev.t) {
      case "equip": if (ev.id === this.me) this.playRaw("E28", 1, 0); break;
      case "unequip": if (ev.id === this.me) this.playRaw("E29", 1, 0); break;
      case "drop": if (ev.r >= 2) { const m = this.world.ents.get(this.me); if (m && Math.max(Math.abs(m.x - ev.x), Math.abs(m.y - ev.y)) <= 14) this.playRaw(ev.r === 3 ? "E30" : "E12", 1, 0); } break;
      case "pickup": if (ev.id === this.me) this.playRaw(ev.item === 90 ? "E12" : "E20", 1, 0); break;
      case "levelup": if (ev.id === this.me) this.playRaw("E30", 1, 0); break;
      case "attack":
        if (mob) this.play("M" + (mob + 1), ev.id);
        else this.play(ev.bow ? "C3" : "C1", ev.id, 0.8);   // C3: arco (MapData.cpp, armas 40..59)
        break;
      case "damage":
        if (mob) { this.play("C6", ev.id); this.play("M" + (mob + 2), ev.id, 0.8); }
        else { this.play("C5", ev.id); this.play("C12", ev.id, 0.8); }
        break;
      case "death":
        this.play(mob ? "M" + (mob + 3) : "C14", ev.id);
        break;
      case "step":
        if (mob) this.play("M" + mob, ev.id, 0.35);
        else this.play("C8", ev.id, 0.35);
        break;
    }
  }
}
