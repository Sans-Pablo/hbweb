# Helbreath Web (iteración 3)

Primera entrega de la cripta procedural: instrucciones y alcance en [docs/DUNGEON_V1.md](docs/DUNGEON_V1.md).

Prueba en línea (un jugador): ver `SUBIR A GITHUB.md`.

Doble clic en **`Abrir prueba web.bat`**. Arranca un servidor local y abre `http://localhost:8080`. La ventana muestra también la dirección para entrar desde el móvil en tu misma Wi-Fi. Al cerrarla se apaga el servidor.

## Jugar online con cuentas (servidor propio + web de GitHub)

Doble clic en **`Iniciar servidor.bat`** (instala Node si falta, se actualiza solo, arranca el servidor, abre el navegador y lo reinicia si se cae; la primera vez te pregunta solo tu usuario) y sigue **[docs/ONLINE.md](docs/ONLINE.md)**: cuentas con usuario y contraseña, mundo compartido, panel de administración y dirección fija para que los jugadores entren desde el enlace de GitHub.

## Jugar con otra persona (multijugador rápido, enlace temporal)

Doble clic en **`Jugar con mi hermano (multijugador).bat`** (o `Iniciar servidor.bat rapido`). La primera vez descarga Node.js portátil y `cloudflared` (unos 80 MB en total, dentro de `tools/`). Después:

1. Arranca el servidor del juego y te abre el navegador.
2. Crea un **enlace público** (`https://algo.trycloudflare.com`) y lo copia al portapapeles. Pásaselo a tu hermano: lo abre en su navegador, escribe un nombre y entra en tu misma granja.
3. Para apagarlo todo, pulsa Intro en esa ventana.

- Os veis el uno al otro con vuestro nombre encima; `Intro` abre el chat.
- Cada personaje guarda su progreso por nombre en `server/saves.json`: si vuelve a entrar con el mismo nombre, sigue donde lo dejó.
- El enlace cambia cada vez que abres el programa, y cualquiera que lo tenga puede entrar mientras esté encendido.
- Si estáis en la misma Wi-Fi también vale la dirección local que aparece en la ventana.
- Windows puede preguntar por el Firewall la primera vez: permite "Redes privadas".

## Qué hay en esta versión

- **La granja de Aresden completa**, con los 11 generadores de monstruos del servidor original: 45 slimes, 45 hormigas gigantes, 30 escorpiones, 20 amphis y 10 golems de piedra. Cada uno vuelve a aparecer en su zona al morir.
- **Combate con las fórmulas del servidor** (`HGServer/Game.cpp`):
  - acierto = (ataque / defensa) × 50, entre 15 % y 99 %; por la espalda, la defensa cuenta la mitad;
  - daño con daga 1d4, más bonificación de fuerza y de nivel;
  - vida de los monstruos según sus dados de golpe;
  - experiencia por golpe y al rematar, y subida de nivel con 3 puntos para repartir;
  - regeneración de vida cada 15 s.
- **Monstruos especiales:** dan más experiencia o absorben daño. En el modo remastered tienen un aura.
- **Botín:** oro y pociones caen al suelo. Se recogen haciendo clic en ellos o con Espacio estando encima.
- **Sonidos originales**, con volumen y panorámica según la distancia.
- **Música remasterizada** de la granja (`MainTm`): misma grabación, restaurada con `tools/remaster_music.py` (sin el ruido de 8 bits, con los agudos que faltaban, sala estéreo y volumen nivelado). En modo clásico suena la original; al pulsar `G` se funde de una a otra en el mismo punto de la canción.
- **Dos modos gráficos sobre el mismo juego**, como en Diablo II Resurrected. Se cambia con `G`.
  - **Clásico:** 800×600, cámara fija, barra de piedra y texto plano.
  - **Remastered:** pantalla completa con más campo de visión, zoom con la rueda, luz y viñeta, orbes de vida y maná, números de daño animados, destellos al golpear, barras de vida, etiquetas de objetos con `Alt` y partículas al subir de nivel.

## Controles

| | |
|---|---|
| Clic en el suelo | andar (mantén pulsado para seguir al cursor) |
| Clic en un monstruo | atacar hasta matarlo |
| Clic en un objeto / `Espacio` | recoger |
| `R` | alternar andar / correr |
| `1` `2` `3` (o `Insert` / `Supr`) | pociones |
| `C` | personaje y reparto de puntos |
| `G` | gráficos clásicos / remastered |
| `Alt` | nombres de los objetos del suelo |
| `M`, `B`, `N`, `H` | minimapa, casillas bloqueadas, sonido, ayuda |
| `Intro` | hablar (chat) o reaparecer al morir |

## Cómo está organizado el código

```
web/
  index.html            interfaz (HUD en HTML con estilos clásico y remastered)
  src/shared/           el "servidor": no sabe nada del navegador; correrá igual en Node
    const.js            direcciones, acciones, tiempos de animación del original
    rules.js            fórmulas de combate, experiencia, vida, botín
    grid.js             casillas bloqueadas y ocupación
    path.js             A* y el paso "codicioso" de los monstruos
    world.js            simulación: jugadores, monstruos, generadores, objetos, órdenes
  src/client/           lo que solo existe en el navegador
    connection.js       conexión con el servidor (hoy local; mañana WebSocket)
    controller.js       ratón y teclado -> órdenes
    anim.js             qué fotograma dibujar en cada momento
    renderer.js         dibujo (modo clásico y remastered)
    fx.js, audio.js, hud.js
  data/                 generado por tools/convert.py a partir del cliente y del servidor
tools/convert.py        .pak/.amd/.wav del cliente + NPC.cfg y mapas del servidor -> web/data
tools/remaster_music.py remasterización de la música (python tools/remaster_music.py <carpeta MUSIC> web/data/music)
tools/serve.py          servidor local (lo usa el .bat; permite saltar dentro de la música)
server/server.mjs       servidor multijugador (Node, sin dependencias): web + WebSocket + la misma simulación
tools/iniciar.ps1  lanzador único (modos online y rápido): Node portátil, actualización, servidor con reinicio automático, túnel
tests/sim.test.mjs      prueba de la simulación sin navegador: node tests/sim.test.mjs
```

La regla de oro: **todo lo que decide qué pasa en el juego va en `src/shared`**, y lo que decide cómo se ve va en `src/client`. Así el modo remastered nunca cambia la jugabilidad. Cuando llegue el servidor de verdad, `world.js` se mueve a Node sin tocarlo.

Para regenerar los datos: `python tools/convert.py <carpeta Helbreath del cliente> web/data arefarm <carpeta del repositorio HelbreathServer>` (necesita Pillow y, para la música, ffmpeg).

