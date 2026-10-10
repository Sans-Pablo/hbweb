// F1 → «Herramientas»: panel de pruebas (crear objetos y enemigos, subir niveles, saltar de mapa...). Manda órdenes `dbg` a la simulación
// (shared/systems/debug.js); en el servidor real solo funcionan con HB_DEBUG=1. Los datos llegan por window.hbDev (main.js).
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SPECIES = ["Slime", "Giant-Ant", "Amphis", "Orc", "Skeleton", "Clay-Golem", "Stone-Golem", "Orc-Mage", "Hellbound", "Cyclops", "Troll", "Orge", "Tentocle", "Cannibal-Plant", "Demon", "Frost", "Liche"];
const KITS = {
  potions: [["RedPotion", 50], ["BluePotion", 50], ["GreenPotion", 50]],
  arrows: [["Arrow", 500]],
  dyes: [["Dye(Red)", 1], ["Dye(Blue)", 1], ["Dye(Green)", 1], ["ArmorDye(Red)", 1], ["ArmorDye(Blue)", 1], ["ArmorDye(Gold)", 1]],
  bone: [["SkeletonBones", 5]],
  manuals: [["ArcheryManual", 1]],
};
const L = (lang, es, en) => (lang === "en" ? en : es);

export function devHtml(lang) {
  const d = window.hbDev;
  if (!d) return `<p>${L(lang, "Las herramientas aparecen al entrar en el juego.", "The tools appear once you are in the game.")}</p>`;
  const items = [...d.data.items.values()].map(i => i.name).filter(Boolean).sort();
  const monsters = Object.keys(d.npcDb).sort();
  const maps = ["arefarm", ...d.mapIds.filter(m => m !== "arefarm")];
  const opt = (a, sel) => a.map(v => `<option${v === sel ? " selected" : ""}>${esc(v)}</option>`).join("");
  const row = (title, inner) => `<section class="dev"><h4>${title}</h4><div class="devrow">${inner}</div></section>`;
  const b = (op, label, extra = "") => `<button data-dbg="${op}" ${extra}>${label}</button>`;
  const num = (id, v, min, max, w = 56) => `<input id="dv-${id}" type="number" value="${v}" min="${min}" max="${max}" style="width:${w}px">`;
  return `<p>${L(lang, "Solo para pruebas: lo que hagas aquí se guarda con la partida. Los mensajes salen en el chat.", "Testing only: what you do here is saved with the game. Results show in the chat log.")}</p>` +
    row(L(lang, "Personaje", "Character"),
      `Lv ${num("lvl", 30, 1, 50)} ${b("level", "Set level")} ${b("exp", "+1000 exp", 'data-n="1000"')} ${b("gold", "+100k gold", 'data-n="100000"')} ${b("points", "+5 points", 'data-n="5"')}` +
      ` ${b("heal", "Heal all")} ${b("god", "Invulnerable on/off")} ${b("skills", "Skills 50", 'data-n="50"')}` +
      ` <select id="dv-stat">${opt(["str", "vit", "dex", "int", "mag", "chr"])}</select> ${num("statv", 50, 1, 500)} ${b("stat", "Set stat")}`) +
    row(L(lang, "Ir a", "Go to"),
      `<select id="dv-map">${opt(maps)}</select> ${b("goto", "Go")} ` +
      `${L(lang, "Cripta nivel", "Crypt level")} ${num("clv", 1, 1, 20, 48)} ${b("crypt", "Jump")} ${b("clear", "Clear level (open portal)")} ` +
      `x ${num("tx", 60, 0, 999)} y ${num("ty", 60, 0, 999)} ${b("teleportxy", "Move")}`) +
    row(L(lang, "Objetos", "Items"),
      `<input id="dv-item" list="dv-items" placeholder="${L(lang, "nombre del objeto", "item name")}" style="width:190px"><datalist id="dv-items">${items.map(n => `<option>${esc(n)}</option>`).join("")}</datalist> ` +
      `x ${num("icount", 1, 1, 10000, 64)} ${b("give", "Give")} | ${b("kit:potions", "Potions")} ${b("kit:arrows", "Arrows")} ${b("kit:dyes", "Dyes")} ${b("kit:bone", "Skeleton bones")} ${b("kit:manuals", "Manual")}`) +
    row("Bots",
      `${num("bn", 1, 1, 10, 44)} Lv ${num("blv", 1, 1, 50, 52)} ${b("bot", L(lang, "Invocar bot (en tu grupo)", "Summon bot (joins your party)"))} ${b("botsolo", L(lang, "Bot suelto", "Solo bot"))} ${b("botclear", L(lang, "Quitar bots", "Remove bots"))}`) +
    row(L(lang, "Enemigos", "Enemies"),
      `<select id="dv-mob">${opt(monsters, "Skeleton")}</select> x ${num("mcount", 1, 1, 30, 48)} ${L(lang, "fuerza", "power")} ${num("mmult", 1, 1, 50, 48)} ` +
      `${L(lang, "jefe", "boss")} <select id="dv-boss">${opt(["0", "1", "2", "3", "4"])}</select> ${b("spawn", "Spawn")} ${b("killall", "Kill all")} ${b("freeze", "Freeze monsters on/off")} | ${L(lang, "vida del jefe", "boss life")} ${num("bhp", 50, 1, 100, 48)} % ${b("bosshp", "Set")}`) +
    row("Summons",
      `<select id="dv-sp">${opt(SPECIES, "Orc")}</select> Lv ${num("plv", 1, 1, 50, 48)} ${b("ball", "Give ball")} | ` +
      `Lv ${num("pl", 20, 1, 50, 48)} ${b("petlvl", "Set active summon level")} ${b("petheal", "Heal + mana")} | ` +
      `${b("petspec:support", "Support build")} ${b("petspec:damage", "Damage build")} ${b("petspec:tank", "Warrior build")} ${b("petreset", "Reset talents")} <small>(F10)</small>`) +
    row(L(lang, "Mundo", "World"),
      `${b("sky:1", "Day")} ${b("sky:2", "Night")} ${b("sky:0", "Auto")} ${L(lang, "clima", "weather")} <select id="dv-wx">${opt(["0", "1", "2", "3"])}</select> <small>(0 = ${L(lang, "despejado", "clear")}, 1-3 = ${L(lang, "lluvia", "rain")})</small>`);
}

export function devClick(e) {
  const btn = e.target.closest("[data-dbg]"), d = window.hbDev;
  if (!btn || !d) return false;
  const val = id => document.getElementById("dv-" + id)?.value;
  const [op, arg] = btn.dataset.dbg.split(":");
  const send = c => d.send({ t: "dbg", ...c });
  switch (op) {
    case "level": send({ op, n: val("lvl") }); break;
    case "exp": case "gold": case "points": case "skills": send({ op, n: btn.dataset.n }); break;
    case "stat": send({ op, key: val("stat"), n: val("statv") }); break;
    case "bot": send({ op, n: val("bn"), level: val("blv") }); break;
    case "botsolo": send({ op: "bot", n: val("bn"), level: val("blv"), solo: true }); break;
    case "botclear": send({ op }); break;
    case "heal": case "god": case "clear": case "killall": case "freeze": case "petheal": case "petreset": send({ op }); break;
    case "goto": send({ op, map: val("map") }); break;
    case "bosshp": send({ op, n: val("bhp") }); break;
    case "crypt": send({ op, level: val("clv") }); break;
    case "teleportxy": send({ op, x: val("tx"), y: val("ty") }); break;
    case "give": send({ op, name: val("item"), count: val("icount") }); break;
    case "kit": for (const [name, count] of KITS[arg]) send({ op: "give", name, count }); break;
    case "spawn": send({ op, name: val("mob"), count: val("mcount"), mult: val("mmult"), boss: +val("boss") || 0 }); break;
    case "ball": send({ op, sp: val("sp"), lvl: val("plv") }); break;
    case "petlvl": send({ op, n: val("pl") }); break;
    case "petspec": send({ op, br: arg }); break;
    case "sky": send({ op, day: +arg, weather: +val("wx") }); break;
  }
  return true;
}
