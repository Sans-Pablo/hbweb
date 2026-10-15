// Pretend-Corpse (skill 19): fingir muerte. HG.cpp UseSkillHandler (SKILLEFFECTTYPE_PRETEND, value1 = 1).
// Tirada dice(1,100) > maestría = fallo; no en zona de lucha ni con alguien en las 8 casillas contiguas; éxito: quita la invisibilidad,
// SkillUp(19, 1), OBJECTDYING (sAttackerWeapon = 1) y m_bSkillUsingStatus[19] = TRUE. Moverse o atacar lo termina (ClearSkillUsingStatus).
import { ACT, DX, DY, PLAYER } from "../const.js";
import { dice } from "../rules.js";
import { gainSSN, SKILL } from "../skills.js";
import { sclear } from "./status.js";

export const feigning = e => !!e && e.feign === true;

// ClearSkillUsingStatus: el personaje se levanta (el cliente lo ve volver a STOP).
export function stand(w, p) {
  if (!p.feign) return;
  p.feign = false;
  w.setAct(p, ACT.STOP, 0);
  w.emit({ t: "skillend", id: p.id, skill: SKILL.PRETEND_CORPSE, ok: true, up: true });
}

export function useSkill(w, p, cmd) {
  const sk = cmd.skill | 0;
  if (sk !== SKILL.PRETEND_CORPSE) return w.reject(p, cmd, "esa habilidad aún no se puede usar");
  if (p.feign) { stand(w, p); return true; }                          // pulsar de nuevo = levantarse
  if (w.busy(p)) return w.reject(p, cmd, "ocupado");
  const m = p.skills[sk] | 0;
  if (!m) return w.reject(p, cmd, "sin maestría");
  const fail = () => { w.emit({ t: "skillend", id: p.id, skill: sk, ok: false }); return true; };
  if (dice(w.rng, 1, 100) > m) return fail();                         // UseSkillHandler: tirada contra la maestría
  if (w.fightZone) return fail();                                     // m_bIsFightZone
  for (const e of w.ents.values()) if (e !== p && e.dead && e.x === p.x && e.y === p.y) return fail();   // GetDeadOwner: un cadáver en tu casilla
  if (!p.gm) for (let d = 1; d <= 8; d++) if (w.grid.occupant(p.x + DX[d], p.y + DY[d]) !== undefined) return fail();   // cualquier dueño en las 8 casillas contiguas
  sclear(w, p, "invis");                                              // RemoveMagicEffect(INVISIBILITY)
  gainSSN(p, sk, 1);                                                  // SkillUp(sk, 1)
  p.feign = true;
  w.setAct(p, ACT.DYING, PLAYER.dyingMs);
  w.emit({ t: "skillend", id: p.id, skill: sk, ok: true, up: false });
  return true;
}
