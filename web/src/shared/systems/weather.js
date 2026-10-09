// Hora del día y clima de cada mundo (HGServer/Game.cpp: _CheckDayOrNight / WhetherProcessor).
//  · Día/noche: noche cuando el minuto del reloj es >= DEF_NIGHTTIME (40). 1 = día, 2 = noche. Los mapas con
//    "fixed-day-mode" son siempre de día y sin clima.
//  · Clima: cada 20 s, si no hay, 1/300 de que empiece (lluvia 1..3 = ligera, media, fuerte) y dura 3 + 1d7 minutos.
// El reloj es opcional (`w.clock()` devuelve el minuto de la hora); sin reloj, siempre es de día, y así las pruebas son deterministas.
import { dice } from "../rules.js";

export const NIGHT_MINUTE = 40;
const WEATHER_EVERY_MS = 20000, SKY_EVERY_MS = 5000;

export function tickSky(w) {
  if (w.dbgSky) { setSky(w, w.dbgSky.day, w.dbgSky.weather); return; }          // herramientas de prueba
  if (w.fixedDay) { setSky(w, 1, 0); return; }
  if (!w.clock) return;
  if (w.time - (w.tSky ?? -1e9) >= SKY_EVERY_MS) {
    w.tSky = w.time;
    setSky(w, w.clock() >= NIGHT_MINUTE ? 2 : 1, w.weather);
  }
  if (w.time - (w.tWeather ?? 0) >= WEATHER_EVERY_MS) {
    w.tWeather = w.time;
    let v = w.weather;
    if (v !== 0) { if (w.time > w.weatherUntil) v = 0; }
    else if (dice(w.rng, 1, 300) === 13) { v = dice(w.rng, 1, 3); w.weatherUntil = w.time + 60000 * 3 + 60000 * dice(w.rng, 1, 7); }
    setSky(w, w.dayOrNight, v);
  }
}

function setSky(w, day, weather) {
  if (w.dayOrNight !== day) { w.dayOrNight = day; w.emit({ t: "time", v: day }); }
  if (w.weather !== weather) { w.weather = weather; w.emit({ t: "weather", v: weather }); }
}

// Penalización del acierto de los arcos con lluvia (iCalculateAttackEffect)
export const bowHitWithWeather = (hit, weather) => {
  const h = weather === 1 ? hit - Math.floor(hit / 20) : weather === 2 ? hit - Math.floor(hit / 10) : weather === 3 ? hit - Math.floor(hit / 4) : hit;
  return Math.max(0, h);
};

// Desgaste extra de las armas cuerpo a cuerpo con lluvia
export function extraWeaponWear(w) {
  switch (w.weather) {
    case 1: return dice(w.rng, 1, 3) === 1 ? 1 : 0;
    case 2: return dice(w.rng, 1, 2) === 1 ? dice(w.rng, 1, 2) : 0;
    case 3: return dice(w.rng, 1, 2) === 1 ? dice(w.rng, 1, 3) : 0;
    default: return 0;
  }
}
