// Estados mágicos (m_cMagicEffectStatus + eventos de liberación diferida del servidor original).
// e.st[clave] = { v, until }. Claves: pfm (v = % menos de daño mágico), hold, ice, protect (v = 1..5), invis, berserk, poison (v = nivel), confuse.
export function sget(w, e, key) {
  const s = e.st && e.st[key];
  if (!s) return 0;
  if (s.until !== Infinity && w.time >= s.until) { delete e.st[key]; return 0; }
  return s.v;
}

export function sset(w, e, key, v, ms) {
  if (!e.st) e.st = {};
  const s = e.st[key] = { v, until: ms === Infinity ? Infinity : w.time + ms };
  w.emit({ t: "status", id: e.id, key, v, on: true });
  if (ms !== Infinity) w.after(ms, () => { if (e.st && e.st[key] === s) { delete e.st[key]; w.emit({ t: "status", id: e.id, key, v, on: false }); } });
}

export function sclear(w, e, key) {
  if (!e.st || !e.st[key]) return;
  const v = e.st[key].v;
  delete e.st[key];
  w.emit({ t: "status", id: e.id, key, v, on: false });
}

export const BUFFS = ["hold", "ice", "protect", "invis", "berserk", "confuse", "pfm"];
