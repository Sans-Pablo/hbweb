# Misiones (v0.63.0 «El camino del invocador»)

Sistema de líneas de misiones por clase (Guerrero, Mago, Invocador) del acto 1 (hasta nivel 50). Código: `web/src/shared/systems/quests.js`; interfaz: `web/src/client/questui.js` (tecla J, rastreador arriba a la derecha). Invención propia (el original no tiene misiones): los ids de hito son 9101–9111 y los emblemas 9121–9123.

## Reglas
- 22 misiones por clase; el acto 1 acaba en la 19. Siempre hay una siguiente misión visible.
- Meta final: nivel 50 → subir un compañero a nivel 25/50 → conseguir el báculo (drop del Gold Skeleton, solo tras la misión que lo habilita) → invocar la última evolución (Demon / Frost / Liche) y subirla a 50 → derrotar al rey de la cripta.
- La cripta tiene tope de profundidad 5 que suben los jefes (10/15/20). El comercio entre jugadores (`tradeUp`) se abre con una misión.
- Estado propio `p.quests = {n, cls, c, d, b[4], tr, u:{crypt,staff,trade}, t[]}`; `d` es la mayor profundidad alcanzada (sobrevive a reiniciar la cripta). No viaja a otros jugadores (`ownState`).
- Eventos: `{t:"quest"}` y `{t:"questdone", id, q, n, rew}`.

## Bots
Los habitantes (`residents.js`) persiguen la misión actual (`questGoal`); `node tools/questsim.mjs [bots] [min] [seed] [out.json]` mide tiempos por misión (`q.t`). El «muro» medido es el rey 1 (q5): los bots llegan en 2–4 h con nivel 34–37.

## Pruebas
`tests/quests.test.mjs`: recorre las 22 misiones de cada clase forzando cada objetivo y comprueba permisos finales.
