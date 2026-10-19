# Auditoría UI vs original (v0.85.9)

Original: `HelbreathOriginal\Helbreath.Client\Helbreath.Client\Game.cpp`. Auditoría por lectura de código (no se ejecutó el original). Estado: OK / DIFERENTE / FALTA. Lo marcado ✔ se corrigió en 0.85.9; el resto queda pendiente y listado abajo.

## Corregido en 0.85.9 (✔)
- Barra inferior: tooltips de iconos con los textos originales (Character Menu, Spell Book, Skill List, Chat History, Options…); texto central "Required Exp: N" (también al pasar el ratón por 144-317 × 434-477) en 250,250,220.
- Chat: color 0 = 225,225,225. Textos flotantes: sin jitter horizontal; nombre de hechizo en 255,80,80.
- Registro Legacy: y=10 (ShowEventList).
- Nombres sobre jugadores: neutral en 50,50,255 (verde solo aliado del mismo bando).
- Character: exp y next exp sin separador de miles (%d).
- Magic: pulsar un hechizo ya no cierra el libro.
- Level Up: Ctrl suma/resta hasta lo que quede (min(5, restantes)).
- Skills: zona de clic desde x30 (original).
- Party: líneas de info del modo 0 a y175; modo 4 con PARTY31/32 ("The character names" / "of your party members.") a y50/65, nombres en (10..260, 95+15i), sin sufijo "Lv".
- Cantidad: importe a y57, subrayado a y62, tinta 55,25,25. Tienda: color de aviso 195,25,25; valor "above" 125,25,25.
- Sonido de UI: ya existe (`gui.onSound`, E14 en cada clic atendido); la auditoría lo daba por ausente.

## Tabla por ventana
| Ventana | Original | Nuestro | Estado |
|---|---|---|---|
| Barra inferior / iconos | DrawDialogBox_IconPannel l.17899 | Textos ✔; extras: Summons, Quests, hambre | DIFERENTE (extras nuestros) |
| Gauges HP/MP/SP/EXP | GaugePannel l.17984: EXP 167 px y447 + número | Tira EXP de ancho completo; falta número y "Poisoned" en la barra | DIFERENTE |
| "Level Up!" | estático 250,250,0 + icono 17/18 | parpadeo amarillo | DIFERENTE |
| Registro de eventos | ShowEventList: 6 líneas, 5 s, y10, sin repetidos | y10 ✔; repetidos no suprimidos | DIFERENTE (menor) |
| Burbujas de chat | 3 líneas de 20 car., ascienden | una línea de 64 | DIFERENTE |
| Nombres sobre cabeza | DrawObjectName: nombre/guild/bando, Berserked/Frozen | color neutral ✔; faltan sufijos y "?????" | DIFERENTE (menor) |
| Barras de HP sobre cabeza | no existen | opción "Barras de vida" | OK (opción explícita) |
| Cursor | frames 0,3,4,5,6,10 | faltan 1/2, 8 y cruz de observador; foe por kind | DIFERENTE |
| Minimapa | 128×128, marco 2 px 50,50,50, sin monstruos | mayor, arrastrable, puntos rojos | DIFERENTE (con opción de minimapa) |
| Textos de daño | OBJECTDAMAGE | jitter quitado ✔ | OK |
| SysMenu | DrawDialogBox_SysMenu l.35975 | posiciones/textos idénticos; extra "Mejoras…" | OK (casi) |
| Character (1) | l.32092 | exp ✔; falta Criminal(PK), sufijo de guild, azul de angel stat, botón Quest (hay AUTO), ranuras de mujer, skirt | DIFERENTE |
| Inventario (2) | l.18698 | falta zona Upgrade (dlg 34); oro y "Tienda" inventados; mensaje de fabricación en español | DIFERENTE |
| Magic (3) | l.33895 | no cierra ✔; falta flujo alquimia 3 vías (INVENTORY10/15/16) | DIFERENTE |
| Skills (15) | l.35273 | clic x30 ✔; barra de scroll siempre dibujada; faltan SKILL1/2; solo Pretend Corpse usable | DIFERENTE |
| Party (32) | l.34629 | y y textos ✔; falta auto-accept (PARTY56/57), PARTY21 en modo 1, scrollbar | DIFERENTE |
| Level Up (12) | l.32805 | Ctrl ✔; falta angel stat, tope 200 al clic, envío solo de cambiados, botón Majestic | DIFERENTE |
| Item drop confirm (4) | l.18133 "Are you sure to drop away this item?" | no existe (suelta directo) | FALTA |
| Cantidad (17) | QueryDropItemAmount | y/tinta ✔; mensajes "You entered 0…" sin verificar | DIFERENTE (menor) |
| Tooltips de objeto | función original no localizada | tarjeta "Olympia" propia | DIFERENTE (inventado) |
| Tienda (11) | npcdialogs.js:214-332 | aviso ✔; cabeceras ITEM/PRICE, aviso de STR a y288, género solo en armadura | cabeceras ITEM/PRICE ✔ (npcdialogs.js:287); resto menor |
| Lista de venta / Reparar | | | OK |
| NpcActionQuery (20) | modos 0-9 | solo 0, 2, 3, 5; faltan 1, 4, 6, 7, 8, 9 | DIFERENTE |
| Warehouse (14) | npcdialogs.js:496 | "Space Used %d Of %d Items" ✔ | IGUAL (aviso de bolsa llena pendiente) |
| Menú de herrería (modo 7) | | | FALTA |
| Fabricación/Alquimia (SkillDlg) | Game.cpp:35358 | solo ajuste `manufill` | FALTA |
| NpcTalk (21) | ventana ND_GAME2, líneas y57+15i | DialogBox de piedra con un párrafo | DIFERENTE |
| Quest (28) | QUEST1-35 | diario propio (id 49) + rastreador | DIFERENTE |
| Guild | GUILDMENU1-53 (20 CHR/nivel 20, papeles 50 oro, arena 1500) | diálogo propio de miembros | DIFERENTE |
| Trade (33) | | extensión con oro/bolsa; faltan ConfirmExchange y EXCHANGE9-39; y40/y322 vs 38/310 | DIFERENTE |
| Hospital (41), apuestas (44), Summons (43), Puesto (48) | no existen en el original | inventos del port | NO ORIGINAL |
| F11 informe de fallo | no existe en el original | bugwin.js (herramienta de testers) | NO ORIGINAL (se conserva) |

## Añadidos nuestros no originales
Panel objetivo con barra de HP (opción), HUD remastered (opción de modo), marca de hora (`/timestamp`), pestañas de chat Todo/Chat/Grupo/Clan/Sistema, avisos de objeto raro/único, toasts, iconos Summons/Quests/hambre, panel de estados (opción), rastreador de misión (opción), minimapa arrastrable con puntos rojos, aviso de HP bajo (solo modo remastered), botón AUTO del Character, oro y "Tienda" en el inventario, "Reset stats" en la tienda. Los que son opción explícita se conservan; el resto está pendiente de retirar.

## Pendiente (siguiente bloque, por prioridad)
1. NpcActionQuery modos 1/4/6/7/8/9 y menú de herrería. 2. Diálogo de fabricación. 3. NpcTalk y Quest fieles. 4. Item drop confirm (id 4) y zona Upgrade del inventario. 5. Character (PK, guild, angel stat, Quest), Party (auto-accept, scroll), Level Up (Majestic, angel). 6. Minimapa Legacy 128 px con marco, burbujas de 20 car., cursor 1/2/8, EXP 167 px, sufijos de nombre. 7. Flujo de Guild.
