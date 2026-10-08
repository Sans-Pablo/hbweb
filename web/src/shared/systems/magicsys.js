// Lanzar y aprender hechizos.
import { ACT, PLAYER, dist, dirTo } from "../const.js";
import { dice } from "../rules.js";
import { gainSSN } from "../skills.js";
import { EQUIP } from "../items.js";
import * as M from "../magic.js";
import { damageNpc } from "./combatsys.js";

// RequestStudyMagicHandler: hace falta Int >= ReqInt y pagar el coste (negativo = no se vende).
export function learn(w, p, id) {
  const sp = w.magic[id];
  if (!sp) return w.reject(p, { t: "learn" }, "no existe");
  if (p.magic[id]) return w.reject(p, { t: "learn" }, "ya la conoces");
  if (sp.cost < 0) return w.reject(p, { t: "learn" }, "no se vende");
  if (p.stats.int < sp.reqInt) return w.reject(p, { t: "learn" }, "Int " + sp.reqInt + " necesaria");
  if (p.gold < sp.cost) return w.reject(p, { t: "learn" }, "oro insuficiente");
  p.gold -= sp.cost;
  p.magic[id] = 1;
  w.recalc(p);
  w.emit({ t: "learned", id: p.id, spell: id });
  return true;
}

// Comprobaciones comunes de lanzar/preparar (UseMagic del cliente original)
function usable(w, p, cmd) {
  const sp = w.magic[cmd.spell];
  if (!sp || !p.magic[cmd.spell]) return w.reject(p, cmd, "no conoces ese hechizo");
  if (!M.SUPPORTED_TYPES.has(sp.type)) return w.reject(p, cmd, "aún no disponible");
  // sin escudo ni arma a dos manos; en la mano derecha, solo varitas (tipos 34-39)
  if (p.equip[EQUIP.LHAND] !== undefined || p.equip[EQUIP.TWOHAND] !== undefined) return w.reject(p, cmd, "quítate el escudo y las armas a dos manos");
  if (p.equip[EQUIP.RHAND] !== undefined && !(p.eff.wtype >= 34 && p.eff.wtype <= 39)) return w.reject(p, cmd, "solo se lanza con las manos libres o con una varita");
  if (p.mp < M.manaCost(p, sp)) return w.reject(p, cmd, "maná insuficiente");
  return sp;
}

// Elegir el hechizo en el libro: el personaje empieza a lanzarlo (animación) y espera el objetivo.
export function prepare(w, p, cmd) {
  if (p.dead || w.busy(p)) return w.reject(p, cmd, "ocupado");
  const sp = usable(w, p, cmd); if (!sp) return false;
  p.prep = { spell: cmd.spell, at: w.time };
  p.lastCombat = w.time;
  w.setAct(p, ACT.MAGIC, M.CAST_MS);
  p.busyUntil = w.time + M.CAST_MS;
  w.emit({ t: "prepare", id: p.id, spell: cmd.spell });
  return true;
}

export function cast(w, p, cmd) {
  const pre = !!(cmd.pre && p.prep && p.prep.spell === cmd.spell && w.time - p.prep.at < 120000);
  if (!pre && w.busy(p)) return w.reject(p, cmd, "ocupado");
  if (w.time - (p.lastCast ?? -1e9) < M.CAST_COOLDOWN_MS) return w.reject(p, cmd, "demasiado rápido");
  const sp = usable(w, p, cmd); if (!sp) return false;
  const x = cmd.x | 0, y = cmd.y | 0;
  if (!w.grid.inside(x, y) || dist(p, { x, y }) > 14) return w.reject(p, cmd, "demasiado lejos");
  const cost = M.manaCost(p, sp);

  p.lastCast = w.time;
  p.lastCombat = w.time;
  if (x !== p.x || y !== p.y) p.dir = dirTo(p.x, p.y, x, y) || p.dir;
  // con el hechizo ya preparado, la animación de lanzar ya se hizo al elegirlo: solo queda soltarlo
  const wait = pre ? Math.max(0, p.busyUntil - w.time) : 0, ms = pre ? (wait || 160) : M.CAST_MS;
  p.prep = null;
  if (!pre || !wait) { w.setAct(p, ACT.MAGIC, ms); p.busyUntil = w.time + ms; }
  w.emit({ t: "cast", id: p.id, spell: cmd.spell, x, y, attr: sp.attr, type: sp.type });
  w.after(pre ? wait + 80 : ms, () => resolve(w, p, cmd.spell, sp, x, y, cost));
  return true;
}

function resolve(w, p, id, sp, x, y, cost) {
  if (p.dead) return;
  // ¿sale el hechizo?
  const chance = M.castChance(p, id);
  if (chance < 100 && dice(w.rng, 1, 100) > chance) { w.emit({ t: "castfail", id: p.id }); return; }
  if ((p.hunger <= 10 || p.sp <= 0) && dice(w.rng, 1, 1000) <= 100) { w.emit({ t: "castfail", id: p.id }); return; }
  p.mp = Math.max(0, p.mp - cost);
  gainSSN(p, 4, 1);
  const power = M.castPower(p, id);
  const at = (tx, ty) => { const oid = w.grid.occupant(tx, ty); return oid === undefined ? null : w.ents.get(oid); };
  const hurt = (tgt, n, d, k) => {
    if (!tgt || tgt.kind !== "npc" || tgt.dead) return;
    if (M.resists(w.rng, power, tgt.cfg.resistMagic)) { w.emit({ t: "resist", id: tgt.id }); return; }
    if (tgt.cfg.actionLimit === 1 || tgt.cfg.actionLimit === 2) return;     // invulnerables
    let dmg = M.spellDamage(w.rng, p, n, d, k);
    if (tgt.cfg.absDamage > 0) { dmg = Math.floor(dmg - dmg * (tgt.cfg.absDamage / 100)); if (dmg < 0) dmg = 1; }
    damageNpc(w, tgt, dmg, p, null);
  };
  switch (sp.type) {
    case M.MAGIC_TYPE.DAMAGE_SPOT:
      hurt(at(x, y), sp.v4, sp.v5, sp.v6);
      break;
    case M.MAGIC_TYPE.HPUP_SPOT: {
      const t = at(x, y);
      if (t && t.kind === "player" && !t.dead && t.hp < t.maxHp) {
        const heal = dice(w.rng, sp.v4, sp.v5) + sp.v6;
        t.hp = Math.min(t.maxHp, t.hp + heal);
        w.emit({ t: "heal", id: t.id, amount: heal, by: p.id });
      }
      break;
    }
    case M.MAGIC_TYPE.DAMAGE_AREA:
      hurt(at(x, y), sp.v4, sp.v5, sp.v6);                                 // centro
      for (let iy = y - sp.v3; iy <= y + sp.v3; iy++) for (let ix = x - sp.v2; ix <= x + sp.v2; ix++)
        hurt(at(ix, iy), sp.v7, sp.v8, sp.v9);                              // zona (incluye el centro, como el original)
      break;
  }
  w.emit({ t: "spell", id: p.id, spell: id, x, y, attr: sp.attr, type: sp.type });
}
