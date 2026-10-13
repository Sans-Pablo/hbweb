# Backlog consolidado (2026-10-13, v0.81.0)

Resumen de lo que falta, sacado de `ESTADO.md`, `DESVIOS.md`, `RELEASE_TESTERS.md`, `FUTURO.md` y `HOSTING*.md`.
`ESTADO.md` sigue siendo el registro histórico; este fichero es la vista ordenada de lo **abierto**.
Meta vigente: **release de testers, solo acto 1**.

Leyenda: 🔴 bloquea el release · 🟠 importante · 🟡 deseable · ⏸ aplazado a propósito.

## 1. Bloqueantes del release de testers
| # | Tarea | Estado / detalle |
|---|---|---|
| 1 | 🔴 Bots atascados en Aresfarm (61-64,72-77) y Elvine Farm (198,200) | Reproducir en esas casillas (colisión/ruta) |
| 2 | 🔴 Residuales de bots: `cryptentry`, `crypt-exit`, `pet-far`/`pet-missing` | Revisar `Informe de bots.md` |
| 3 | 🔴 Criterio de listo: 8 h con 40 bots sin avisos de «bloqueado» ni caídas | Sin medir aún |
| 4 | 🔴 Clientes viejos reciben el aviso de recargar (`NET_PROTO`) | Sin comprobar |
| 5 | 🔴 El cliente de GitHub Pages conecta con `https://pablo.tail495855.ts.net` | Sin comprobar |
| 6 | 🔴 Verificar fluidez con 5 Cyclops + Trolls + bots lanzando (leer «dibujo» y ping) | Si sigue alto: cachear gradientes de auras en `renderer.js` |
| 7 | 🔴 Servidor siempre online (`HOSTING.md`, `HOSTING_LOCAL.md`, `HOSTING_ESCALA.md`) | Planes escritos, **sin código**. Decidir: región, proveedor/dominio, correo obligatorio. Siguiente paso sugerido: montar el low cost y medir (Fase A) |

## 2. Experiencia del tester
- 🟠 Tutorial y primeras 2 horas (creación, tienda, primera cripta) · `sistemas/tutorial.md`
- 🟠 Cierre claro del acto 1 (rey de la cripta + mensaje)
- 🟠 Avisos de peso y mochila llena + botón «vender basura»
- 🟠 Cuenta atrás del Recall en pantalla
- 🟠 Guía corta para testers (cómo entrar, qué probar, cómo reportar) y canal de reporte
- 🟡 `attack` a objetivo muerto: ignorar en silencio (6600 rechazos)
- 🟡 Bucle de `learn` repetido de los bots (186 veces sin elegir escuela)
- 🟡 Sin sitio para puestos (8 bots)
- 🟡 Daño: apilado de líneas y fuente de sprites en el resto de avisos (v0.81.0)

## 3. Balance
- 🟠 Cyclops/Troll/Skeleton matan a bots nivel 32-50: decidir si es el equipo del bot o el monstruo (contra `NPC.cfg`)
- 🟠 Revivir al summon menos caro (hoy 16-25 mil; que escale con su nivel)
- 🟠 Sumideros de oro (reparar, teñir, apuestas, mejora de equipo)
- 🟡 Exp/min negativa y farmeo de Slimes (10-20 mil muertos)
- 🟡 Summon sube lento (40 % de la exp) en 14 bots
- 🟡 Balance de arena y bots; afinar con partidas reales (`sistemas/balance.md`)

## 4. Fidelidad al original (`DESVIOS.md`)
Cobertura estimada: ítems ~93 %, NPC ~47 %, mapas ~48 %, ventanas de cliente 🟡.
- 🟠 Ítems que faltan (~40 según el diff; ya hechos 80) y **2 hechizos** de 66 sin listar
- 🟠 Magia pendiente: tipos 4-7, 8-18, 19-33 y mago de la ciudad
- 🟠 PK: UI y textos, cárcel real (`arejail`/`elvjail`), `DecPKCount`, diálogo William/Gail
- 🟠 Sistemas sin portar: Polymorph, Slates, ItemUpgrade (a verificar), Dark Knight, ChangeStatsMajestic, FeedBackCard
- 🟠 Pesca, minería, alquimia y manufactura leídas de los `.cfg`; fuente de sprites del original
- 🟡 NPC: estructuras de guerra (torres, cañones, gates, mercenarios), Ghost/Vampire/Scarecrow, GHK/TK/BG, Princess, Energy-Sphere…
- 🟡 Facciones, cruzada, bandos (en curso)
- 🟡 Habilidad especial por arma (`m_iSpecialAbilityTime`): comprobar que la actual es la del original
- 🟡 Atributos de drops no portados: veneno (tipo 2), «Righteous» (solo PvP), resistencias a veneno y magia
- 🟡 Teclas aún sin efecto en la simulación: Tab/Inicio/PageUp/Ctrl+A; F8/F9 y Ctrl+0..9
- 🟡 Artesanos: también caramelos
- 🟡 Contramagias psíquicas
- 🟡 Compañeros: habilidades por especie y multijugador (snapshot)
- 🟡 Pasada de verificación de las filas «(a verificar)» de `DESVIOS.md`, `DelayedEvents.cpp` y `Astoria.cpp` (eventos de mundo)

## 5. Visual y contenido
- 🟡 Pendientes de visto bueno de Pablo: monstruos IA (zombi, orco, esqueleto, cíclope), equipo IA completo (`remaster_equip.py`), terreno IA (costuras, zona difusa de hierba t7/t6/t9/t352), cripta, bolsa
- 🟡 Terreno IA: método alternativo con contexto de vecinos (el pase de costuras se revirtió); resto de teselas sin IA (223/309)
- 🟡 Sprites sin IA: pb 264, pu 88, ph 88, `ututelarangel`, unidades `u*`, dummy, crop, ugate, id, cryptpit
- 🟡 HD de Beholder, Centaurus y Stalker
- 🟡 Sonidos de la Pixie: elegir y asignar (invocar, aura continua)
- 🟡 Remaster tipo Diablo 2: decidir upscaler, luz dinámica ya hecha (`luz.md`), HD manual de jefes
- 🟡 Verificar a ojo el vuelo y tamaño del Pixie
- 🟡 Rendimiento: p95 de fotograma con magia ~26-39 ms (drawImage en hojas IA grandes)
- 🟡 Sprite negro ocasional: sin causa identificada (solo reintento)

## 6. Aplazado a propósito ⏸
Arena (código conservado), mapas de Elvine/nieve, rediseño de sonido, Git LFS (`web/data` ~450 MB, `.git` ~420 MB), tinte de pelo `m_wR`, actos 2+ y final, Firebow/Direction-Bow, retroceso `actionLimit 4`, tutorial de la cripta y elección de bando, `docs/FUTURO.md`.

## 7. Proceso / pendiente de publicar
- Varios trabajos están «en local, sin publicar» y sin commit por mezclarse con el otro agente (v0.81.0 y anteriores): conviene un commit ordenado por bloque.
- Falta verificación visual del usuario del rework de ventanas (v0.80.7). Migrar `questui.js`, paneles `#charpanel/#inv/#book` y el observador a `client/window.js`.
- `tests/support-summon.test.mjs` fallaba por el balance del otro agente.

## Orden sugerido
1. Bloqueantes 1-6 (estabilidad con bots y fluidez).
2. Decisiones de hosting (7) y montar el low cost.
3. Experiencia del tester (peso/mochila, Recall, tutorial, cierre del acto 1, guía).
4. Balance de Cyclops/Troll/Skeleton y sumideros de oro.
5. Fidelidad: magia pendiente, PK completo, pesca/minería, ítems y hechizos que faltan.
