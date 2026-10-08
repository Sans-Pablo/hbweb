// Vida, maná, resistencia y hambre (CheckClientResponseTime, TimeHitPointsUp, TimeStaminarPointsUp).
import { dice } from "../rules.js";

export const HUNGER_MS = 60000;        // DEF_HUNGERTIME
export const HUNGER_LEVEL = 20;        // DEF_LEVELLIMIT: el hambre solo cuenta a partir de aquí
export const SP_MS = 10000, HP_MS = 15000, MP_MS = 20000;

export function initVitals(w, p) {
  p.hunger = 100; p.hpStock = 0; p.combo = 0;
  p.sp = p.maxSp;
  p.tHunger = p.tHp = p.tSp = p.tMp = w.time;
}

// Se llama una vez por segundo para cada jugador vivo.
export function tickVitals(w, p) {
  const now = w.time, rng = w.rng, s = p.stats;
  if (p.level >= HUNGER_LEVEL && now - p.tHunger >= HUNGER_MS) {
    p.tHunger = now;
    if (p.hunger > 0) p.hunger--;
  }
  const plus = p.hunger >= 0 && p.hunger <= 30 ? (30 - p.hunger) * 1000 : 0;
  if (p.hunger <= 0) return;                                 // con el estómago vacío no hay recuperación
  if (now - p.tSp >= SP_MS + plus) {
    p.tSp = now;
    if (p.sp < p.maxSp) {
      let t = dice(rng, 1, Math.floor(s.vit / 3));
      t += p.level <= 20 ? 15 : p.level <= 40 ? 10 : p.level <= 60 ? 5 : 0;
      p.sp = Math.min(p.maxSp, p.sp + t);
    }
  }
  if (now - p.tHp >= HP_MS + plus) {
    p.tHp = now;
    if (p.hp < p.maxHp) {
      const t = Math.max(dice(rng, 1, s.vit), Math.floor(s.vit / 2)) + p.hpStock;
      p.hp = Math.min(p.maxHp, p.hp + t);
    }
    p.hpStock = 0;
  }
  if (now - p.tMp >= MP_MS + plus) {
    p.tMp = now;
    if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + dice(rng, 1, s.mag));
  }
}
