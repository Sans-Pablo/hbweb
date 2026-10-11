// GUILDS, como en el original (Client/Game.cpp: DEF_MSG_GUILDMASTER / GUILDSMAN, cuadros de guild; HGServer/Game.cpp: RequestCreateNewGuildHandler,
// JoinGuildApproveHandler, DismissGuildApproveHandler, RequestDisbandGuildHandler, chat «@»).
//   - Crear: nivel ≥ 20, carisma ≥ 20, con bando (Aresden/Elvine), en un pueblo (no en la cripta ni en Promise Land) y sin guild. Quien crea es el Guildmaster (rango 0).
//   - Invitar (solo el Guildmaster): a un jugador cercano del mismo bando sin guild; el invitado acepta o rechaza y entra como Guildsman (rango 1).
//   - Expulsar (Dismiss) y disolver (Disband): solo el Guildmaster. Salir: el Guildmaster que se va cede el mando al siguiente o disuelve si está solo.
//   - El nombre del personaje muestra debajo «<Guild> Guildmaster» / «<Guild> Guildsman». Chat de guild con «@» (3 SP, nivel > 1).
//   - INVENTO del port: el guild elige color de capa y de botas (0..15, tintes de Item.cfg) que ven todos los que las llevan puestas; actividades de guild (act).
// Estado: p.guild = { name, rank, cape, boots } (en cada miembro conectado; se guarda { name, rank }). Registro: reg.guilds (name → G) en la aventura.
// G = { name, master, members: { personaje: rango }, side, cape, boots, at, ethos? }. Eventos privados: {t:"guild", id, k, ...}, {t:"guildquery", id, from, guild},
// {t:"guildchat", id, name, text, guild}.
export const MIN_LEVEL = 20, MIN_CHR = 20, MAX_MEMBERS = 20, SP_CHAT = 3, COLORS = 16;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{2,19}$/;

export function makeReg(worlds) { return { worlds, guilds: new Map() }; }
const regOf = w => w.hooks?.guild || (w.guildReg ??= makeReg(() => [w]));
export const guildOf = (w, p) => (p.guild ? regOf(w).guilds.get(p.guild.name) || null : null);
export const exportReg = reg => [...reg.guilds.values()].map(g => ({ name: g.name, master: g.master, members: g.members, side: g.side, cape: g.cape, boots: g.boots, at: g.at, ethos: g.ethos || null }));
export function importReg(reg, list) { reg.guilds.clear(); for (const g of Array.isArray(list) ? list : []) if (g && NAME_RE.test(g.name || "") && g.members && typeof g.members === "object") reg.guilds.set(g.name, { ...g, cape: g.cape | 0, boots: g.boots | 0 }); }

function playersOf(reg) { const m = new Map(); for (const w of reg.worlds()) for (const e of w.ents.values()) if (e.kind === "player") m.set(e.name, [w, e]); return m; }
const note = (reg, id, ev) => { for (const w of reg.worlds()) if (w.ents.has(id)) { w.emit({ ...ev, id }); return; } };
function sync(reg, g) {                                                          // pone p.guild en los miembros conectados
  for (const [name, [, e]] of playersOf(reg)) {
    if (g.members[name] !== undefined) e.guild = { name: g.name, rank: g.members[name], cape: g.cape, boots: g.boots };
    else if (e.guild?.name === g.name) delete e.guild;
  }
}
function tellAll(reg, g, ev) { for (const [name, [, e]] of playersOf(reg)) if (g.members[name] !== undefined) note(reg, e.id, ev); }
export const onlineMembers = (reg, g) => [...playersOf(reg).entries()].filter(([n]) => g.members[n] !== undefined).map(([, [w, e]]) => e);
const fail = (w, p, why) => { w.emit({ t: "guild", id: p.id, k: "fail", why }); return false; };

export function create(w, p, name) {
  const reg = regOf(w); name = String(name || "").trim().replace(/\s+/g, " ");
  if (p.guild) return fail(w, p, "ya perteneces a un guild");
  if (p.level < MIN_LEVEL || (p.stats?.chr ?? 0) < MIN_CHR) return fail(w, p, `hace falta nivel ${MIN_LEVEL} y carisma ${MIN_CHR}`);
  if (!(p.side === 1 || p.side === 2)) return fail(w, p, "los viajeros no pueden fundar guilds");
  if (w.pvp || w.map?.kind === "dungeon" || w.map?.kind === "arena") return fail(w, p, "solo se funda en un pueblo");
  if (!NAME_RE.test(name)) return fail(w, p, "nombre no válido (3-20 letras, cifras, espacio, _ o -)");
  if ([...reg.guilds.keys()].some(n => n.toLowerCase() === name.toLowerCase())) return fail(w, p, "ya existe un guild con ese nombre");
  const g = { name, master: p.name, members: { [p.name]: 0 }, side: p.side, cape: 0, boots: 0, at: Date.now() };
  reg.guilds.set(name, g); sync(reg, g);
  w.emit({ t: "guild", id: p.id, k: "created", name });
  return true;
}
export function invite(w, p, name) {
  const reg = regOf(w), g = guildOf(w, p);
  if (!g || g.members[p.name] !== 0) return fail(w, p, "solo el Guildmaster invita");
  if (Object.keys(g.members).length >= MAX_MEMBERS) return fail(w, p, "el guild está lleno");
  const t = [...w.ents.values()].find(e => e.kind === "player" && e !== p && e.name.toLowerCase() === String(name || "").toLowerCase());
  if (!t || t.dead || t.guild || t.guildQuery || t.side !== p.side || Math.max(Math.abs(t.x - p.x), Math.abs(t.y - p.y)) > 10) return fail(w, p, "no se le puede invitar ahora");
  t.guildQuery = { from: p.id, guild: g.name, at: w.time };
  note(reg, t.id, { t: "guildquery", from: p.name, guild: g.name });
  return true;
}
export function answer(w, p, yes) {
  const reg = regOf(w), q = p.guildQuery; if (!q) return false;
  delete p.guildQuery;
  const g = reg.guilds.get(q.guild), master = g && playersOf(reg).get(g.master)?.[1];
  if (!g || p.guild) return false;
  if (!yes) { if (master) note(reg, master.id, { t: "guild", k: "refused", name: p.name }); return true; }
  if (Object.keys(g.members).length >= MAX_MEMBERS) return fail(w, p, "el guild está lleno");
  g.members[p.name] = 1; sync(reg, g);
  tellAll(reg, g, { t: "guild", k: "joined", name: p.name, guild: g.name });
  return true;
}
function drop(reg, g, name, k) {
  delete g.members[name];
  const e = playersOf(reg).get(name)?.[1]; if (e) { delete e.guild; note(reg, e.id, { t: "guild", k, guild: g.name }); }
  tellAll(reg, g, { t: "guild", k: "left", name, guild: g.name });
}
export function disband(w, p) {
  const reg = regOf(w), g = guildOf(w, p);
  if (!g || g.members[p.name] !== 0) return fail(w, p, "solo el Guildmaster disuelve el guild");
  for (const n of Object.keys(g.members)) { const e = playersOf(reg).get(n)?.[1]; if (e) { delete e.guild; note(reg, e.id, { t: "guild", k: "disbanded", guild: g.name }); } }
  reg.guilds.delete(g.name); return true;
}
export function leave(w, p, silent = false) {
  const reg = regOf(w), g = guildOf(w, p); if (!g) return false;
  const others = Object.keys(g.members).filter(n => n !== p.name);
  if (g.members[p.name] === 0) {
    if (!others.length) return disband(w, p);
    const next = others.sort((a, b) => (g.members[a] - g.members[b]) || (!!playersOf(reg).get(b) - !!playersOf(reg).get(a)))[0];     // el mando pasa a un miembro conectado
    g.master = next; g.members[next] = 0; sync(reg, g);
    tellAll(reg, g, { t: "guild", k: "master", name: next, guild: g.name });
  }
  drop(reg, g, p.name, silent ? "left-silent" : "left");
  return true;
}
export function kick(w, p, name) {
  const reg = regOf(w), g = guildOf(w, p);
  if (!g || g.members[p.name] !== 0) return fail(w, p, "solo el Guildmaster expulsa");
  const n = Object.keys(g.members).find(m => m.toLowerCase() === String(name || "").toLowerCase());
  if (!n || n === p.name) return fail(w, p, "no es de tu guild");
  drop(reg, g, n, "kicked"); return true;
}
export function setColors(w, p, cape, boots) {
  const reg = regOf(w), g = guildOf(w, p);
  if (!g || g.members[p.name] !== 0) return fail(w, p, "solo el Guildmaster elige los colores");
  if (Number.isFinite(cape)) g.cape = Math.max(0, Math.min(COLORS - 1, cape | 0));
  if (Number.isFinite(boots)) g.boots = Math.max(0, Math.min(COLORS - 1, boots | 0));
  sync(reg, g); tellAll(reg, g, { t: "guild", k: "colors", cape: g.cape, boots: g.boots, guild: g.name });
  return true;
}
// Chat «@»: lo reciben todos los miembros conectados, en cualquier mapa
export function chat(w, p, text) {
  const reg = regOf(w), g = guildOf(w, p);
  if (!g) return w.reject(p, { t: "say" }, "no tienes guild");
  if (p.level <= 1) return w.reject(p, { t: "say" }, "nivel insuficiente para este canal");
  if (p.sp < SP_CHAT) return w.reject(p, { t: "say" }, "sin resistencia");
  p.sp -= SP_CHAT;
  tellAll(reg, g, { t: "guildchat", name: p.name, text, guild: g.name });
  return true;
}
export function info(w, p) {
  const reg = regOf(w), g = guildOf(w, p); if (!g) return w.emit({ t: "guild", id: p.id, k: "info", guild: null });
  const on = playersOf(reg);
  w.emit({ t: "guild", id: p.id, k: "info", guild: { name: g.name, master: g.master, cape: g.cape, boots: g.boots, side: g.side, members: Object.entries(g.members).map(([n, r]) => ({ n, r, on: on.has(n), lv: on.get(n)?.[1].level || 0 })).sort((a, b) => a.r - b.r || b.on - a.on || a.n.localeCompare(b.n)) } });
  return true;
}
// Cada 5 s: quien figura en un guild que ya no existe (o lo expulsaron sin estar conectado) lo pierde; las invitaciones sin respuesta caducan
export function tick(w) {
  const reg = regOf(w);
  for (const p of w.ents.values()) {
    if (p.kind !== "player") continue;
    if (p.guild) { const g = reg.guilds.get(p.guild.name); if (!g || g.members[p.name] === undefined) delete p.guild; else if (p.guild.rank !== g.members[p.name] || p.guild.cape !== g.cape || p.guild.boots !== g.boots) p.guild = { name: g.name, rank: g.members[p.name], cape: g.cape, boots: g.boots }; }
    if (p.guildQuery && w.time - p.guildQuery.at > 60000) delete p.guildQuery;
  }
}
// Al cargar un personaje: recupera su guild si sigue existiendo
export function restore(w, p, saved) {
  const reg = regOf(w), g = saved?.name && reg.guilds.get(saved.name);
  if (g && g.members[p.name] !== undefined) p.guild = { name: g.name, rank: g.members[p.name], cape: g.cape, boots: g.boots };
}
