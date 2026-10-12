# Recuento para el primer release de testers (2026-10-12, v0.79.2)

Base: `server/data/Informe de bots.md` (180 temas, 5178 avisos de 40 bots de nivel 32-50), `docs/ESTADO.md`, `docs/FUTURO.md`, `docs/sistemas/quests.md`.

## 1. Lo que dicen los bots
**Fallos (bloqueantes para testers)**
- Atascos en granjas: «sin progreso» ×120 (25 bots) y atascos puntuales en Aresfarm (62-64,72-75), (28-34,98-108); Elvine Farm (198,200). Hay casillas concretas donde se quedan: probable colisión/ruta en el mapa.
- Recall: se interrumpe 4 veces seguidas en la cripta (16 bots) y «Recall en curso» bloquea 44 s en Promise Land (14 bots).
- Sin flechas: 5 bots bloqueados 36 s (×46) en Elvine Farm; la regla de comprar antes no basta.
- Summons: se quedan a 75 casillas; tras morir no vuelven; uno figura invocado sin existir.
- Entrar en la cripta desde la granja falla (2 bots).

**Incomodidades**
- Peso: 40 de 40 bots van al límite (81156/84000) sin aviso (×1093). El botín nuevo (0.79.2) debería reducirlo; hay que remedirlo.
- `attack` rechazado por «sin objetivo» (6600 veces): órdenes sobre objetivos ya muertos. Pet-target igual.
- Mochila de 50 llena sin forma rápida de vender/tirar (11 bots).
- Aviso de recall en recarga repetido: la UI debe mostrar la cuenta atrás en vez de aceptar la orden.
- Sin sitio para puestos (8 bots).
- Un bot repite `learn` 186 veces sin elegir escuela de summon.

**Balance**
- Cyclops, Troll y Skeleton matan a niveles 32-49 (vida máx. ~400): casi todos los bots mueren con ellos.
- Revivir al summon cuesta 16-25 mil de oro (30 bots): demasiado caro.
- El summon sube lento (40 % de la exp) en 14 bots.
- Sobra oro (20 mil, ×519, 34 bots) y no hay sumideros.
- Anomalía: hay niveles con exp/min negativa y 10-20 mil Slime muertos. Parece farmeo inútil o pérdida de exp por muerte; investigar.
- Las «ideas» del LLM local (llama3.2:3b) son ruido: no usarlas para decidir.

## 2. Estado del juego (según ESTADO.md)
- Hecho: ítems originales, combate, magia, criptas, summons y psíquicos, PvP, gremios/party, puestos, artesanos, observador de 4 paneles, online con dirección fija (Tailscale).
- Historia: hay misiones del acto 1 (22 por clase, hasta nivel 50), invención propia. El «muro» medido son los reyes de la cripta (rey 1, misión 5): los bots llegan en 2-4 h. Los capítulos 3-5 no se han recorrido en tiempo real. Faltan actos 2+ y el final.
- Aplazado a propósito: arena, tutorial de cripta y elección de bando, LFS, tinte `m_wR`, mapas de Elvine/nieve, rediseño del sonido.

## 3. Propuesta de ruta al release de testers
**A. Bloqueantes (antes de invitar a nadie)**
1. Atascos de Aresfarm/Elvine Farm: reproducir en las casillas del informe y arreglar.
2. Recall que se interrumpe y cola «Recall en curso» (bots y jugador).
3. Estabilidad del servidor: `crash.log` muestra bucles de EADDRINUSE al reiniciar; el servicio debe esperar al puerto o salir limpio.
4. Reencontrar el protocolo: el servidor anunciaba 0.79.1/protocolo 10 y `NET_PROTO` figura 8 en notas antiguas; confirmar que clientes viejos reciben el aviso de recargar.
5. Cuentas: límites de registro y backups de `hb.sqlite` (hoy `maxRegistersPerHour 0`).

**B. Experiencia del tester (alta prioridad)**
6. Avisos de peso y mochila llena; botón «vender basura».
7. Orden `attack` a objetivo muerto: ignorar en silencio.
8. Cuenta atrás del recall en pantalla.
9. Summons: regreso tras la muerte; revivir menos caro (p. ej. escala con nivel del summon).
10. Sumideros de oro (reparar, teñir, apuestas de summon, mejora de equipo).

**C. Balance**
11. Revisar Cyclops/Troll/Skeleton a niveles 32-50 contra el original (`NPC.cfg`), sin tocar valores autoritativos sin citarlos: quizá es el equipo del bot y no el monstruo.
12. Investigar el exp/min negativo y el farmeo de Slimes.

**D. Contenido y guía para testers**
13. Decidir el alcance: ¿solo acto 1 (hasta nivel 50) o también el final? Para un primer release basta el acto 1 con un cierre claro (rey de la cripta + mensaje).
14. Tutorial y primeras 2 horas: lo más importante para testers nuevos (creación, tienda, primera cripta).
15. F1 / `news.json` con lista de pruebas por versión; canal de reporte (formulario o Discord).
16. Documento corto para testers: cómo entrar (enlace de GitHub), qué probar, cómo reportar.

## 4. Qué NO entra en este primer release
Arena, mapas de Elvine/nieve, rediseño de sonido, LFS, contramagias psíquicas, HD de Beholder/Centaurus/Stalker.

## 5. Criterio de listo
- 8 h de 40 bots sin avisos de «bloqueado» ni caídas del servidor.
- Un jugador nuevo llega al nivel 10 y a la primera cripta guiado, sin leer documentos.
- Tests verdes (`tools/test.sh`) y entrada en F1 con la lista de pruebas.
