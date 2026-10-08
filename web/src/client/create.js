// Pantalla de creación de personaje (UpdateScreen_OnCreateNewCharacter del cliente original):
// nombre, 10 puntos entre atributos de 10 a 14, género, piel, peinado, color de pelo y de ropa interior.
import { drawPerson, HAIR_COLORS, SKIN_NAMES, UNDER_NAMES, DEFAULT_LOOK } from "./look.js";
import { PRESETS, sanitizeCreate, validCharName } from "../shared/systems/player.js";

const STATS = [["str", "Fuerza"], ["vit", "Vitalidad"], ["dex", "Destreza"], ["int", "Inteligencia"], ["mag", "Magia"], ["chr", "Carisma"]];
const rnd = n => Math.floor(Math.random() * n);

export function createCharacter(spr, defaultName) {
  const root = document.getElementById("create");
  const st = { ...PRESETS.warrior };
  const c = { name: validCharName(defaultName) ? defaultName : "", gender: 1 + rnd(2), skin: 1 + rnd(3), hair: rnd(8), hairCol: rnd(16), under: rnd(8) };
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
        <canvas width="200" height="230"></canvas>
        <div class="opts"></div>
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
    ["under", "Ropa interior", () => UNDER_NAMES[c.under], v => (c.under = (v + 8) % 8)],
  ];
  const look = () => ({ skin: c.skin, hair: c.hair, hairCol: c.hairCol, under: c.under });
  const need = () => spr.preload(spr.lookKeys(c.gender, look()));

  function render() {
    root.querySelector(".stats").innerHTML = STATS.map(([k, n]) =>
      `<div class="row"><span>${n}</span><button data-s="${k}" data-d="-1"${st[k] <= 10 ? " disabled" : ""}>−</button><b>${st[k]}</b><button data-s="${k}" data-d="1"${st[k] >= 14 || !left() ? " disabled" : ""}>+</button></div>`).join("");
    root.querySelector(".left").textContent = left() ? "Puntos por repartir: " + left() : "Todos los puntos repartidos";
    root.querySelector(".opts").innerHTML = OPTS.map(([k, n, txt]) =>
      `<div class="row"><span>${n}</span><button data-o="${k}" data-d="-1">◀</button><b>${txt()}</b><button data-o="${k}" data-d="1">▶</button></div>`).join("");
  }
  render(); need();

  const cv = root.querySelector("canvas"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  let raf = 0, t0 = performance.now();
  const draw = t => {
    g.clearRect(0, 0, cv.width, cv.height);
    g.save(); g.scale(3, 3);
    const d = Math.floor((t - t0) / 900) % 8, f = Math.floor((t - t0) / 160) % 4;
    // sombra sencilla bajo los pies
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(33, 70, 14, 5, 0, 0, 7); g.fill();
    drawPerson(g, spr, c.gender, look(), 0, d, f, 33, 68);
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
        resolve({ name, stats: { ...st }, gender: c.gender, skin: c.skin, hair: c.hair, hairCol: c.hairCol, under: c.under });
      }
    };
    root.onkeydown = e => e.stopPropagation();
    nameIn.focus();
  });
}
