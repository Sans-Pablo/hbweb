# Entrega 1 — Cripta procedural de esqueletos

## Probar esta rama

Los cambios están en `feature/skeleton-dungeon-v1`; la web de GitHub Pages sigue ejecutando `main` hasta integrar el pull request.

1. Selecciona esa rama en GitHub y descarga su ZIP, o ejecuta:

   ```sh
   git fetch origin
   git switch feature/skeleton-dungeon-v1
   node server/server.mjs 8080
   ```

2. Abre `http://localhost:8080` y entra con un personaje. También sirven los lanzadores `.bat` habituales: el de prueba local y el multijugador.
3. Cerca del inicio de Aresfarm hay un portal azul **Cripta de esqueletos**, en **(134, 94)**. Camina hasta una casilla de distancia, espera a terminar el paso y pulsa **E**.
4. Explora las nueve salas y sus pasillos. Pulsa **M** para el minimapa y **B** para comprobar las colisiones. Los esqueletos usan las animaciones originales de Helbreath.
5. Puedes volver por el portal de la sala inicial o por la salida de la última sala, usando **E**. Al matar a todos los esqueletos aparece «¡Cripta completada!». Recoge el botín antes de salir.
6. Vuelve a entrar: la distribución cambia. Con dos jugadores, cada uno obtiene una instancia privada y vuelve a encontrarse en la granja al salir.

Si tienes la web abierta desde antes de actualizar el servidor, recarga la página para cargar los nuevos módulos.

## Alcance

- Mapa de 64 × 64, nueve salas, pasillos de dos casillas y distribución reproducible mediante una seed de 32 bits. Se valida la conectividad en cuatro direcciones, no solamente en diagonal.
- Entre ocho y dieciséis esqueletos, distribuidos fuera de la sala inicial. No reaparecen dentro de la instancia.
- Entrada y salidas validadas por la simulación: distancia, personaje vivo y acción terminada.
- Aresfarm conserva sus bytes, colisiones y once generadores originales. El portal es una señal dibujada encima del mapa.
- Se conserva el mismo personaje: inventario, equipo, vida, maná, resistencia, hambre, experiencia y oro. Salir no cura al jugador.
- Morir dentro permite reaparecer en Aresfarm con Intro, como en el juego existente.
- Al salir, morir y reaparecer, o desconectarse, se elimina la instancia. El guardado conserva la progresión, pero no la mazmorra ni el botín que quede en el suelo; al reconectar se aparece en la granja.
- Instancias privadas por jugador también en el servidor multijugador. Grupos, jefe, cofres y persistencia de mazmorras quedan fuera de esta entrega.

Los esqueletos son más fuertes que los slimes: la primera visita puede usarse para probar entrada, exploración y salida; para combate lleva equipo y pociones. La experiencia (400–800) y el oro (30–35) son valores iniciales adaptados al formato de HBWeb y quedan pendientes de ajuste de progresión.

## Referencias gráficas y de NPC

- `isolatorhk/Helbreath.ServerFiles`, `Config/Npc.cfg`: tipo 11, 8 HitDice, defensa 40, acierto 100, ataque 5d4, alcance 2 y búsqueda 5. Este archivo usa un esquema de experiencia distinto del `npc.json` de HBWeb; los premios de esta entrega son una adaptación explícita.
- `isolatorhk/Helbreath.Client`, `Helbreath.Client/Map/MapData.cpp`: tiempos de animación del esqueleto.
- Estos repositorios no incluyen los paquetes `.pak` del cliente. Se obtuvo `SPRITES/SKE.PAK` de `play-helbreath/helbreath-assets` y se convirtió usando `tools/convert.py`: 40 hojas, cinco acciones × ocho direcciones × cuatro fotogramas, con sus pivotes y transparencia.
- La cripta reutiliza tiles originales ya incluidos en HBWeb: suelo `t330` y roca `t301`. La oscuridad dibujada sobre las rocas indica las paredes bloqueadas. No se importan nuevos mapas ni se modifica el `.bin` de Aresfarm.

## Verificación

```sh
node tests/sim.test.mjs
node --test tests/dungeon.test.mjs
node --test tests/net-dungeon.test.mjs
node tests/net-walk.test.mjs
```

Las pruebas cubren 1.000 seeds, conectividad de todas las casillas abiertas, bordes cerrados, entrada accesible, aislamiento de IDs/instancias, conservación del personaje, drops, finalización sin respawn, muerte y limpieza. La prueba de red usa dos WebSockets reales, el cliente `NetConnection` y 80 ms de latencia simulada.

Las pruebas y la inspección de los PNG se ejecutaron; la validación visual interactiva del juego queda para la prueba local, porque el navegador remoto no puede acceder al servidor del entorno de desarrollo.

## Siguiente entrega propuesta

Tras probar esta versión: ajustar dificultad y recompensas con tu experiencia de juego, y definir la ubicación definitiva de la entrada. Después se puede añadir un jefe o juego cooperativo como una entrega independiente.
