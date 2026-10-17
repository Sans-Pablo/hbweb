// ÚNICA FUENTE del nivel máximo del servidor. Para cambiar el tope basta con tocar MAX_LEVEL: todo lo demás (curva de experiencia, oro por nivel, nivel de
// los objetos, Int y precio de los libros de magia, misión de maestría, barras del cliente, bots) se deriva de aquí. Ver docs/sistemas/nivel-140.md.
// shared/: sin DOM, sin Math.random ni Date.now.
export const MAX_LEVEL = 140;            // el original llega a 180
export const ORIGINAL_MAX = 180;
export const REF_LEVEL = 50;             // tope de referencia con el que se calibraron las constantes antiguas

// Reparto de puntos: base 60 (6 x 10) + 3 por nivel (R.LEVELUP_POINTS).
export const pointBudget = level => 60 + 3 * (level - 1);

// Experiencia ganada: -8 % por nivel desde el 20 hasta el nivel de referencia; después baja hasta ENDGAME_RATE de lo que valía en el de referencia
// justo en MAX_LEVEL (si el tope sube, la pendiente se suaviza sola). Con tope <= REF_LEVEL solo aplica el primer tramo.
export const ENDGAME_RATE = 0.35;
const tail = Math.max(1, MAX_LEVEL - REF_LEVEL), tailDecay = Math.pow(ENDGAME_RATE, 1 / tail);
export const expDecay = level => Math.pow(0.92, Math.max(0, Math.min(level, REF_LEVEL) - 20)) * Math.pow(tailDecay, Math.max(0, level - REF_LEVEL));

// Oro por subir de nivel (bCheckLevelUp da 50 en el original).
export const levelUpGold = level => 50 + Math.floor(level / 2);

// Escala de las magias: a menor tope, más se comprime la Int mínima y el precio del libro (magicbal.js).
//  - Int: la magia más cara (original 201) debe exigir ~55 % de los puntos de un mago puro, con tope 170 (STAT_LIMIT 200 menos margen para otras stats).
//  - Oro: factor 0,35 con tope 50, proporcional al tope, máximo 1 (precio original).
export const MAGIC_TOP_INT = 201, MAGIC_FREE_INT = 30;
export const intFactor = Math.min(1, (Math.min(170, 0.55 * pointBudget(MAX_LEVEL)) - MAGIC_FREE_INT) / (MAGIC_TOP_INT - MAGIC_FREE_INT));
export const costFactor = Math.min(1, 0.35 * MAX_LEVEL / REF_LEVEL);
