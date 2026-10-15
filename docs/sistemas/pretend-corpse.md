# Pretend Corpse (skill 19)

Original: `HG.cpp` `UseSkillHandler` (SKILLEFFECTTYPE_PRETEND, value1=1). Código: `web/src/shared/systems/feign.js`, test `tests/feign.test.mjs`.

- Orden `useskill {skill:19}` (diálogo de habilidades). Tirada `dice(1,100) > maestría` falla; falla también en zona de lucha o con cualquier ocupante en las 8 casillas contiguas.
- Éxito: quita invisibilidad, sube la habilidad (SSN +1), `p.feign=true`, acto DYING (el cliente anima DYING→DEAD). El jugador NO está `dead` (no pasa por reaparición).
- Mientras `feign`: los monstruos no lo apuntan (npcsys), no regenera hambre/vida (vitals), no se le puede atacar.
- Se levanta (`stand`) al mover, atacar, lanzar magia o volver a usar la habilidad (ClearSkillUsingStatus del original).
- Evento `skillend` (privado): `ok`, `up`.
- No implementado: bloqueo por reliquia (no hay sistema de reliquias) ni "dueño muerto en la casilla".

## v0.84.19
- Falla con un cadáver en tu casilla (GetDeadOwner); la comprobación de las 8 casillas se omite para GM (HG.cpp ~19794). Bloqueo por reliquia: no aplica, el port no tiene reliquias.
