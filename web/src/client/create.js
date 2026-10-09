// Pantalla de creación de personaje (UpdateScreen_OnCreateNewCharacter del cliente original):
// nombre, 10 puntos entre atributos de 10 a 14, género, piel, peinado, color de pelo y de ropa interior.
import { drawPerson, HAIR_COLORS, SKIN_NAMES, UNDER_NAMES, DEFAULT_LOOK } from "./look.js";
import { PRESETS, sanitizeCreate, validCharName } from "../shared/systems/player.js";

const STATS = [["str", "Fuerza"], ["vit", "Vitalidad"], ["dex", "Destreza"], ["int", "Inteligencia"], ["mag", "Magia"], ["chr", "Carisma"]];
const rnd = n => Math.floor(Math.random() * n);

// Personalidad: decide el tono de las frases del personaje y de su mascota (voice.js). Invento del port.
export const PERSONAS = [
  { id: "w", name: "Prudente", desc: "Cauto y reflexivo: avisa de los peligros y habla con calma." },
  { id: "j", name: "Bromista", desc: "Charlatán y socarrón: comenta todo con humor." },
  { id: "d", name: "Decidido", desc: "Directo y valiente: pocas palabras y mucha acción." },
];
export function createCharacter(spr, defaultName) {
  const root = document.getElementById("create");
  const st = { ...PRESETS.warrior };
  const c = { name: validCharName(defaultName) ? defaultName : "", gender: 1 + rnd(2), skin: 1 + rnd(3), hair: rnd(8), hairCol: rnd(16), under: rnd(8), persona: rnd(3) };
  const left = () => 70 - STATS.reduce((a, [k]) => a + st[k], 0);

  root.innerHTML = `<div class="box">
    <h2>Crear personaje</h2>
    <div class="cols">
      <div class="col">
        <label>Nombre<input class="cname" maxlength="10" autocomplete="off" spellcheck="false"></label>
        <div class="presets"><button data-preset="warrior">Guerrero</button><button data-preset="mage">Mago</button><button data-preset="priest">Sacerdote</button></div>
        <div class="stats"></div>
        <p class="left"></p>
      </div>
      <div class="col">
        <canvas width="520" height="600" style="width:260px;height:300px"></canvas>
        <div class="opts"></div>
        <p class="pdesc"></p>
      </div>
    </div>
    <p class="msg"></p>
    <div class="btns"><button class="ok">Crear personaje</button></div>
  </div>`;
  root.style.display = "grid";
  const nameIn = root.querySelector(".cname"), msg = root.querySelector(".msg");
  nameIn.value = c.name;

  const OPTS = [
    ["gender", "Género", () => (c.gender === 1 ? "Hombre" : "Mujer"), v => (c.gender = v < 1 ? 2 : v > 2 ? 1 : v)],
    ["skin", "Piel", () => SKIN_NAMES[c.skin], v => (c.skin = v < 1 ? 3 : v > 3 ? 1 : v)],
    ["hair", "Peinado", () => "Estilo " + (c.hair + 1), v => (c.hair = (v + 8) % 8)],
    ["hairCol", "Color de pelo", () => HAIR_COLORS[c.hairCol][0], v => (c.hairCol = (v + 16) % 16)],
    ["persona", "Personalidad", () => PERSONAS[c.persona].name, v => (c.persona = (v + 3) % 3)],
    ["under", "Ropa interior", () => UNDER_NAMES[c.under], v => (c.under = (v + 8) % 8)],
  ];
  const look = () => ({ skin: c.skin, hair: c.hair, hairCol: c.hairCol, under: c.under });
  // solo la animación de reposo (grupo 0): el resto se descarga después, al entrar al juego
  const idleKeys = (gender, lk) => {
    const type = (gender === 2 ? 3 : 0) + lk.skin, g = gender === 2 ? 1 : 0, keys = [];
    for (let d = 0; d < 8; d++) keys.push("pb" + type + "_" + d);
    keys.push("pu" + g + "_" + lk.under + "_0", "ph" + g + "_" + lk.hair + "_0");
    return keys;
  };
  let shown = { gender: c.gender, look: look(), ready: false };
  const need = () => {
    const want = { gender: c.gender, look: look() }, keys = idleKeys(want.gender, want.look);
    return Promise.all([spr.preload(keys), spr.preloadHd(keys)]).then(() => {
      if (want.gender === c.gender && JSON.stringify(want.look) === JSON.stringify(look())) shown = { ...want, ready: true };
    });
  };
  // calentar la caché: todas las pieles, peinados y ropas interiores de ambos géneros (el actual primero)
  const warm = () => {
    const gs = [c.gender, c.gender === 1 ? 2 : 1], keys = [];
    for (const gd of gs) {
      for (let skin = 1; skin <= 3; skin++) keys.push(...idleKeys(gd, { skin, hair: 0, under: 0 }).slice(0, 8));
      for (let i = 0; i < 8; i++) keys.push(...idleKeys(gd, { skin: 1, hair: i, under: i }).slice(8));
    }
    spr.preload(keys); spr.preloadHd(keys);
  };
  spr.hd = true;

  function render() {
    root.querySelector(".stats").innerHTML = STATS.map(([k, n]) =>
      `<div class="row"><span>${n}</span><button data-s="${k}" data-d="-1"${st[k] <= 10 ? " disabled" : ""}>−</button><b>${st[k]}</b><button data-s="${k}" data-d="1"${st[k] >= 14 || !left() ? " disabled" : ""}>+</button></div>`).join("");
    root.querySelector(".left").textContent = left() ? "Puntos por repartir: " + left() : "Todos los puntos repartidos";
    root.querySelector(".opts").innerHTML = OPTS.map(([k, n, txt]) =>
      `<div class="row"><span>${n}</span><button data-o="${k}" data-d="-1">◀</button><b>${txt()}</b><button data-o="${k}" data-d="1">▶</button></div>`).join("");
    root.querySelector(".pdesc").textContent = PERSONAS[c.persona].desc;
  }
  render(); need(); warm();

  const cv = root.querySelector("canvas"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  let raf = 0, t0 = performance.now();
  const draw = t => {
    g.clearRect(0, 0, cv.width, cv.height);
    g.save(); g.scale(8, 8);
    const d = Math.floor((t - t0) / 900) % 8, f = Math.floor((t - t0) / 160) % 4;
    // sombra sencilla bajo los pies
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(33, 70, 14, 5, 0, 0, 7); g.fill();
    drawPerson(g, spr, shown.gender, shown.look, 0, d, f, 33, 68);
    g.restore();
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return new Promise(resolve => {
    root.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.preset) { Object.assign(st, PRESETS[b.dataset.preset]); render(); return; }
      if (b.dataset.s) {
        const k = b.dataset.s, d = +b.dataset.d;
        if (d > 0 ? st[k] < 14 && left() > 0 : st[k] > 10) st[k] += d;
        render(); return;
      }
      if (b.dataset.o) {
        const o = OPTS.find(x => x[0] === b.dataset.o);
        o[3](c[o[0]] + +b.dataset.d);
        render(); need(); return;
      }
      if (b.classList.contains("ok")) {
        const name = nameIn.value.trim();
        if (!validCharName(name)) { msg.textContent = "Nombre no válido: hasta 10 letras o números, sin espacios ni símbolos."; return; }
        cancelAnimationFrame(raf);
        root.style.display = "none"; root.innerHTML = "";
        resolve({ name, stats: { ...st }, gender: c.gender, skin: c.skin, hair: c.hair, hairCol: c.hairCol, under: c.under, persona: PERSONAS[c.persona].id });
      }
    };
    root.onkeydown = e => e.stopPropagation();
    nameIn.focus();
  });
}
