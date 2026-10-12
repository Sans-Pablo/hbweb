// Bestiario: panel de sonidos candidatos para la Pixie. Cada botón reproduce un WAV original de data/sfx
// (los mismos que usa audio.js). Sirve para elegir a oído; aún no se asignan a eventos del juego.
const SETS = [
  ["Campanilla / cristal (destello 30–50)", ["E46", "E36", "E19", "E12", "E20", "E37", "E10", "E13"]],
  ["Chispa y aleteo (alas, motas)", ["M72", "M21", "C11", "C9", "C8", "C10", "C1", "C7"]],
  ["Zumbido suave (aura 40)", ["M5", "M99", "M25", "M9", "M116", "E28"]],
  ["Crecer / subir de nivel", ["E30", "M119", "M129", "M23", "M6", "M24", "M27"]],
  ["Invocar / aparecer", ["E22", "M15", "M26", "M76", "M32", "M128", "M28"]],
  ["Morir / desvanecerse", ["C6", "M62", "M10", "M29", "M22", "M118"]],
];
const ctx = new (window.AudioContext || window.webkitAudioContext)(), cache = new Map();
let src = null;
async function play(name, btn) {
  if (ctx.state === "suspended") await ctx.resume();
  if (!cache.has(name)) cache.set(name, fetch("data/sfx/" + name + ".wav").then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)));
  const buf = await cache.get(name); try { src?.stop(); } catch {}
  src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
  for (const b of document.querySelectorAll("#snd button.on")) b.classList.remove("on");
  btn.classList.add("on"); src.onended = () => btn.classList.remove("on");
  document.getElementById("snd-now").textContent = `${name} · ${buf.duration.toFixed(2)} s`;
}
const box = document.getElementById("snd-body");
const grp = (title, names) => {
  const d = document.createElement("div"); d.className = "sg"; d.innerHTML = `<b>${title}</b> `;
  for (const n of names) { const b = document.createElement("button"); b.textContent = n; b.onclick = () => play(n, b); d.appendChild(b); }
  box.appendChild(d);
};
for (const [t, ns] of SETS) grp(t, ns);
const all = [];
for (const p of ["C", "E", "M"]) for (let i = 1; i <= 135; i++) all.push(p + i);
// todos los WAV existentes, sin los ya listados arriba; los que no existan se ignoran al pulsar
const det = document.createElement("details"); det.innerHTML = "<summary>Todos los sonidos (C, E, M)</summary>";
const hold = document.createElement("div"); hold.className = "sg"; det.appendChild(hold); box.appendChild(det);
det.addEventListener("toggle", () => {
  if (hold.childElementCount) return;
  for (const n of all) { const b = document.createElement("button"); b.textContent = n; b.onclick = () => play(n, b).catch(() => { b.disabled = true; }); hold.appendChild(b); }
}, { once: true });
