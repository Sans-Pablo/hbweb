// Grupos (party), como el original. Cliente: Client/Game.cpp (DlgBoxClick_Party, DrawDialogBox_Party, DEF_NOTIFY_PARTY, GetExp en el servidor);
// servidor: HGServer/Game.cpp (JoinPartyHandler, RequestAcceptJoinPartyHandler, PartyOperationResult_*, GetExp, chat '$').
//   - Se invita pulsando sobre otro jugador (JOINPARTY v1=1); el invitado acepta (1) o rechaza (0); el que invita puede cancelar (2).
//   - Si el invitado no tenía grupo se crea uno con él; el que invita entra. Máximo DEF_MAXPARTYMEMBERS = 8 (Client/Game.h).
//   - Solo se puede invitar a alguien del mismo bando, sin invitación pendiente y que no esté esperando respuesta.
//   - Retirarse (JOINPARTY v1=0): los demás reciben el aviso; con un solo miembro el grupo se disuelve solo.
//   - Experiencia (GetExp): se reparte entre los miembros vivos del mismo mapa; con el grupo lleno (8) cada uno recibe el doble de su parte.
//   - Chat de grupo: el texto que empieza por «$» (cuesta 3 de SP) lo ven solo los miembros.
//   - Los miembros no se hieren entre sí (PvP no existe todavía en esta versión: no hay nada que filtrar).
// Estado: p.party = { id, names } en cada miembro (ownState lo manda tal cual; no se guarda en la partida, como en el original).
// Eventos privados (llevan `id` del destinatario): {t:"party", k, ok, name} con k = tipo de DEF_NOTIFY_PARTY (1 grupo creado, 2 disuelto,
// 4 entra alguien, 6 sale alguien, 7 no se pudo), {t:"partyquery", from} (DEF_NOTIFY_QUERY_JOINPARTY) y {t:"partychat", name, text}.
import { giveExp } from "./combatsys.js";

export const MAX_MEMBERS = 8;
const SP_CHAT = 3;

// Registro de grupos compartido por todos los mundos de una aventura (el grupo cruza mapas); un mundo suelto crea el suyo.
export function makeReg(worlds) { return { worlds, parties: new Map(), next: 1 }; }
const regOf = w => w.hooks?.party || (w.partyReg ??= makeReg(() => [w]));

function find(reg, match) {
  for (const w of reg.worlds()) for (const e of w.ents.values()) if (e.kind === "player" && match(e)) return [w, e];
  return [null, null];
}
const byId = (reg, id) => find(reg, e => e.id === id);
function note(reg, id, ev) { const [w] = byId(reg, id); if (w) w.emit({ ...ev, id }); }
const fail = (reg, id) => note(reg, id, { t: "party", k: 7, ok: 0 });

function sync(reg, party) {
  const names = party.members.map(id => byId(reg, id)[1]?.name).filter(Boolean);
  for (const id of party.members) { const e = byId(reg, id)[1]; if (e) e.party = { id: party.id, names }; }
}

// JOINPARTY v1=1: p pide formar grupo con el jugador `name`
export function request(w, p, name) {
  const reg = regOf(w);
  if (p.party || p.partyReq) { fail(reg, p.id); return false; }
  const key = String(name || "").toLowerCase();
  const [, t] = find(reg, e => e !== p && e.name.toLowerCase() === key);
  if (!t || t.dead || t.side !== p.side || t.partyReq || t.partyQuery) { fail(reg, p.id); return false; }
  if (t.party && t.party.names.length >= MAX_MEMBERS) { fail(reg, p.id); return false; }
  p.partyReq = { to: t.id };
  t.partyQuery = { from: p.id };
  note(reg, t.id, { t: "partyquery", from: p.name });
  return true;
}

// ACCEPTJOINPARTY: r 1 = acepta, 0 = rechaza (los dos los envía el invitado); 2 = el que invitó cancela
export function answer(w, p, r) {
  const reg = regOf(w);
  if (r === 2) {
    const t = p.partyReq && byId(reg, p.partyReq.to)[1];
    delete p.partyReq;
    if (t && t.partyQuery && t.partyQuery.from === p.id) { delete t.partyQuery; note(reg, t.id, { t: "partyquery", from: null }); }
    return true;
  }
  const q = p.partyQuery; if (!q) return false;
  delete p.partyQuery;
  const [, who] = byId(reg, q.from);
  if (!who || !who.partyReq || who.partyReq.to !== p.id || who.party) return false;       // petición caducada (el otro se fue o canceló)
  delete who.partyReq;
  if (r !== 1) { fail(reg, who.id); return true; }
  let party = p.party && reg.parties.get(p.party.id);
  if (!party) {                                                                              // RequestCreatePartyHandler: el invitado funda el grupo
    party = { id: reg.next++, members: [p.id] };
    reg.parties.set(party.id, party);
    sync(reg, party);
    note(reg, p.id, { t: "party", k: 1, ok: 1 });
  }
  if (party.members.length >= MAX_MEMBERS) { fail(reg, who.id); return true; }
  party.members.push(who.id);
  sync(reg, party);
  for (const id of party.members) note(reg, id, { t: "party", k: 4, ok: 1, name: who.name });
  return true;
}

// JOINPARTY v1=0: retirarse. silent = el jugador se desconecta (no hay a quién avisar)
export function leave(w, p, silent = false) {
  const reg = regOf(w);
  if (p.partyReq) answer(w, p, 2);
  if (p.partyQuery) { const [, who] = byId(reg, p.partyQuery.from); delete p.partyQuery; if (who) { delete who.partyReq; fail(reg, who.id); } }
  const party = p.party && reg.parties.get(p.party.id);
  delete p.party;
  if (!party) return false;
  party.members = party.members.filter(id => id !== p.id);
  if (!silent) note(reg, p.id, { t: "party", k: 6, ok: 1, name: p.name });
  if (party.members.length <= 1) {                                                           // «con 1 miembro el grupo se disuelve solo»
    reg.parties.delete(party.id);
    for (const id of party.members) { const e = byId(reg, id)[1]; if (e) delete e.party; note(reg, id, { t: "party", k: 2, ok: 0 }); }
  } else {
    sync(reg, party);
    for (const id of party.members) note(reg, id, { t: "party", k: 6, ok: 1, name: p.name });
  }
  return true;
}

// Chat de grupo (texto «$…»): solo lo reciben los miembros; cuesta 3 de SP
export function chat(w, p, text) {
  const reg = regOf(w), party = p.party && reg.parties.get(p.party.id);
  if (!party) return w.reject(p, { t: "say" }, "no estás en un grupo");
  if (p.sp < SP_CHAT) return w.reject(p, { t: "say" }, "sin resistencia");
  p.sp -= SP_CHAT;
  for (const id of party.members) note(reg, id, { t: "partychat", name: p.name, text });
  return true;
}

// GetExp: experiencia de una muerte, repartida entre los miembros vivos del mismo mapa (si no hay grupo, para quien mató)
export function shareExp(w, p, xp) {
  const reg = regOf(w), party = p.party && reg.parties.get(p.party.id);
  const near = party ? party.members.map(id => w.ents.get(id)).filter(e => e && e.kind === "player" && !e.dead && e.hp > 0) : [];
  if (near.length <= 1) { giveExp(w, p, xp); return; }
  const n = near.length, unit = Math.floor((xp + xp * Math.floor(n / MAX_MEMBERS)) / n + 0.5);      // la división entera n/8 es del original
  for (const m of near) giveExp(w, m, unit);
}
