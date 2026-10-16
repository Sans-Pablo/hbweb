# Sprites clave (dónde está cada cosa)

Consultar antes de buscar. Originales: `web/data/sprites.json` + `sprites/<clave>.png`; IA (x4): `sprites_ia.json` + `sprites_ia/<clave>.webp`.
La lista blanca de prefijos con IA está en `web/src/client/assets.js` (regex ~línea 101); al cambiar hojas o regex hay que subir `IA_VERSION` (ahora `ia-0.80.12`).

## Terreno y escenario
| Qué | Clave | Notas |
|---|---|---|
| Suelo de la granja | `t0 t3 t4 t5 t19 t337 t339-t343` | regenerado con `remaster_ia.py --detail 0.9 --force` |
| Plataforma redonda con gemas rojas (junto al árbol, Aresfarm ~(44,100)) | `t301` (36 celdas: frames 14-17, 33-38, 52-59, 72-79, 93-98, 114-117) | motas negras = huecos de alfa del original; rellenados (script en `tools/`, ver ESTADO) |
| Bordes de tierra/piedra de la farm | `t363` | sin problemas |
| Hueco de bajada a la cripta | `equip/cryptpit.webp` (clave `cryptpit` en `equip.json`) | lo genera `tools/make_crypt_assets.py`; se dibuja en `renderer.js drawPortals`; sin versión IA |
| Interiores: almacén / herrería / tienda | suelos `t406-t409` / `t418-t421` / `t410-t413` | huecos de alfa de 32x32 rellenados (alfa 255) |

## NPC de ciudad (kind `citizen`)
| NPC | Prefijo de sprite | Sitio |
|---|---|---|
| Howard | `how` | almacén (wrhus_1f) |
| Tom | `tom` | herrería (bsmith_1f) |
| ShopKeeper-W | `shk` | tienda (gshop_1f) |
| Gail | `gail` | tienda |
| Gandlf | `gnd0-7` | tienda; el original traía motas verdes: limpiadas (alfa) |
| Otros | `william kennedy mcgaffin perry devlin` | |

## Trampas conocidas
- Cualquier sprite nuevo con IA debe estar en la regex de `assets.js`, o se verá el original.
- Los PNG originales traen píxeles verdes sueltos (croma) y huecos de alfa de 1 px: tras la IA se ven como motas verdes/negras. Receta: despill del verde, rellenar componentes de alfa < ~500 px con `cv2.inpaint` y alfa 255.
- `--detail` no es idempotente: solo sobre IA cruda (`--force`).
- Herramienta de pruebas: Playwright (msedge) a `http://localhost:8123/?offline=1`; `hb.conn.send({t:'dbg',op:'goto',map:'wrhus_1f'})` y `op:'teleportxy',x,y`.
- Armas: equipadas = `w<género 0=H,1=M>_<appr>_<n>` en equip.json (Battle Axe H = `w0_26_*`); IA en sprites_ia/. Receta nitidez: script de detalle (λ1.0 σ1.6) + unsharp + alfa×2.2.
- Equipo H: a0_4=KnightPlateMail, b0_2=Hauberk, l0_4=Leggings, h0_5=Horned-Helm, h0_6=Wings-Helm (letra: a=cuerpo b=berk l=piernas h=casco s=escudo o=botas m=manto).

- Armaduras M (a0_4,b0_2,l0_4): evitar CLAHE+curva S (queda blanco); usar contraste local que conserva la media.

- tools/remaster_equip.py: script unico para todo el equipo; leer siempre de una copia de seguridad (--bak) y subir IA_VERSION.
| Suelo/paredes de la cripta | `t300-t309`, objeto `t211` | IA + `tools/fill_tile_holes.py` para las motas negras |
| Costuras en suelo de cripta | `tools/fix_tile_seams.py` | la IA procesa cada casilla aislada y marca el borde; no usar tone/blur sobre terreno |
| Cuadricula de terreno (hojas t* 300 casillas) | pendiente | `fix_tile_seams.py` aplicado a todo se REVIRTIO (aspecto de upscale viejo + negros en t406-409); solo se usa en t300-t309 (cripta). Probar IA con vecinos como contexto |

## Fuente de sprites de texto (interface2_1)
`interface2_1` (285 fotogramas = 3 tipos x 95 glifos): glifo = `código-32 + 95*tipo`, avance = ancho del fotograma. Usada en `fx.js` (`sprFontDraw`) para daño, fallo y conjuros; mensajes tipo 21/22/23 -> tipo 2/1/0. Las cifras (`interface2_0` 6-15) las dibuja `gui.num`.

## Caché de personajes compuestos (v0.82.6)
`client/composed.js` (`PersonCache`): `drawPerson` se ejecuta sobre un grabador (`Object.create(spr)` que mide la caja de cada pieza) y el resultado recortado va a páginas de atlas 2048² (8 máx., reciclaje de la más antigua). Clave = género+aspecto+acción/dirección/fotograma+equipo+tintes. No aplica con `spr.recolor`/`spr.modelFx` (bestiario) ni si falta alguna hoja (reintento cada 8 fotogramas). Escala de caché = min(2, ceil(scale*2)/2). Contadores en el texto de fps (`caché acierto/compuestos/directos`). `warm(3)` (0.82.7): precompone los 2 fotogramas siguientes de los personajes vistos, máx. 3 ms/fotograma.

## Crítico, dash y berserk (cliente)
- Chispas del crítico: efectos 20-27 (vuelan 50 px/tick, sueltan el efecto 8 «Burst» x5; Game.cpp:5360, 14296, 6350) en `client/spellfx.js`.
- Dash: fantasma 26/16 px detrás (Game.cpp:8616-8654, 8917-8921), `renderer.js` DASH_BACK + evento `dash`.
- Berserk: tinte (0,-5,-5) sobre el cuerpo (Game.cpp:8911).
