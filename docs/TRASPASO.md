# Traspaso (leer primero) — 11 oct 2026

**Instrucción permanente del dueño del proyecto:** resolver todo lo pendiente y manejar todo de forma **autónoma** en esta carpeta (git, servidor local, tests, publicación), sin pedir permiso paso a paso. Primero construir por bloques y probar todo junto al final (más rápido). Prioridades las decide el agente. Respuestas al dueño en **español**. Tras cada tarea: versión y nombre. Al publicar: esperar al CI, verificar la versión en la web, cerrar y reabrir el servidor local (`node server/server.mjs 8088`) y dar el enlace https://sans-pablo.github.io/hbweb/. Reglas del proyecto: `CLAUDE.md`. Estado: `docs/ESTADO.md`.

## Estado
Publicada **0.49.0 «Vida propia, grupos y builds»**. Incluye: gestión de objetos de los bots por valor, EK guardados, reset de stats (mago de la tienda general) y builds de bots, parties que debaten (`council.js`), PvP solo en Promise Land (rencor y «fiebre de guerra»), humanización (`systems/human.js`: horarios de conexión por hora real, AFK, despistes, erratas, charla, llegadas con nivel, panel admin «Conexiones»), desatasco, estilos personales, arreglos de diálogos (lint + reglas), drops reducidos.

## Pendiente (por prioridad sugerida)
1. **Verificar en partida larga** (servidor real, varias horas): horarios de conexión, rebuild de builds, PvP en PL, guilds. Servidor de prueba: `HB_ADMIN_TOKEN=tk HB_NO_LIMITS=1 HB_DATA=/tmp/x HB_LLM=off HB_RESIDENTS=20 node server/server.mjs 8089`; panel `/admin?token=tk` (solo loopback); API `/api/admin/{bots,botanalysis,botparties,botdetail?name=,human}`.
2. **Sumideros de oro**: bots con >20.000 de oro sin gastar.
3. **Gail / summon**: 13 de 20 bots sin summon a nivel 19-26; falta pista de dónde está. Revisar el reparto del 40 % de experiencia al summon (`Comp.OWNER_SHARE`).
4. **Comercio**: 0 tratos cerrados entre bots; investigar (`residents.js` bloque de tratos, `spareFor`, distancia/afinidad); idea: punto de encuentro/mercado.
5. **Variedad de presas**: casi todo Slime/Orc; que suban de mob cuando ya no rinde (`mobRatio`, `council.evaluate`).
6. **Muertes** por Skeleton/Stone-Golem/Clay-Golem: afinar `fightEstimate`/`tooStrong`.
7. Bug sin confirmar: «misma semilla de cripta» en pisos distintos.
8. Parties: miembros en mapas distintos al líder (transitorio); revisar seguimiento.
9. Panel admin: mostrar estilo, hora punta y build en el detalle del bot; ajustar `minOnline` según jugadores humanos conectados.
10. Hoja de ruta de humanización restante: memoria más rica entre sesiones (frases con recuerdos concretos vía LLM), metas individuales más variadas, salidas/llegadas definitivas de residentes.
11. Docs: ficha `docs/sistemas/` para `human.js`, `respec.js`, `builds.js`, `council.js`, `botitems.js`, `hazards.js` (regla 8 de CLAUDE.md; el dueño pidió no añadirlas hasta nuevo aviso — preguntar o hacerlas junto a la siguiente entrega).

## Trampas conocidas
- `pkill -f` mata el propio shell: usar `fuser -k PORT/tcp`.
- Un segundo comando `recall` mientras canaliza lo CANCELA.
- `human.js` es opt-in (`adv.human.on`); las pruebas lo ven apagado. El servidor lo enciende (`HB_HUMAN=0` lo apaga).
- Los tests: `tools/test.sh` (56 deben pasar). Entrega: `tools/release.sh X.Y.Z "Nombre" "mensaje"` (exige CHANGELOG y news con la versión).
