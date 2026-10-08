# Cripta — entrega 3

## Entrada y continuidad

Salir a Aresfarm conserva la instancia privada del jugador: mismo mapa, enemigos muertos, vida de los supervivientes y botín. Al volver con E se ofrece **Continuar**, **Reiniciar** o **Cancelar**. Solo Reiniciar sustituye la instancia por una nueva; cancelar no modifica nada. La decisión vuelve a validar distancia, estado y portal en el servidor. El diálogo solo se envía a su propietario.

Morir y volver a Aresfarm también conserva la cripta. Desconectar o cerrar la sesión libera la instancia, incluso si el jugador está en la granja; hay como máximo una instancia retenida por jugador. No se guarda aún el estado completo de la mazmorra entre recargas del navegador o reinicios del servidor.

## Distribución y decoración

Se mantiene el tamaño de 112 × 112 y nueve cámaras, con cinco formas: vestíbulo, cámaras redondeadas, cruces, octágono central y sala con entrante. Las doce conexiones principales son curvas; combinan anchos de 3–7 casillas. Cuatro ramales estrechos terminan en cámaras de excavación. Los circuitos permiten recorrer las salas por distintas rutas.

Las zonas excavadas usan tierra y piedras originales (`t363`, `t365`), junto al pavimento (`t330`). Cruces, columnas y antorchas de `t200`, tablones de `t216`, carros de `t219` y mesa de `t223` dan identidad a las zonas. No se añaden interacciones ficticias a estos objetos decorativos. Los obstáculos solo se colocan con espacio para rodearlos, sin estrechar galerías ni aislar casillas.

La cámara conserva el seguimiento habitual del personaje también junto a los bordes. No se limita al rectángulo del mapa.

## Pruebas

```sh
node tests/sim.test.mjs
node --test tests/assets.test.mjs tests/dungeon.test.mjs tests/net-dungeon.test.mjs
node tests/net-walk.test.mjs
python tests/version_web_test.py
```

Incluyen conectividad de 1.000 seeds, anchura libre de todas las curvas, distintos tipos de salas, PNG reales sin suelo negro, conservación de bajas/HP/botín, instancia despejada, reinicio explícito, limpieza al desconectar y dos clientes reales con elección privada y reentrada al mismo mapa.

Para comprobarlo jugando: matar un esqueleto, dejar botín sin recoger, salir y volver. Cancelar debe dejarte en Aresfarm; Continuar debe recuperar esa misma cripta; Reiniciar debe crear otro mapa con todos sus enemigos. Vista de distribución sin combate: [dungeon-preview.html](https://sans-pablo.github.io/hbweb/dungeon-preview.html).

## Coordinación

Rama `feature/dungeon-persistence-v3`, sobre `1abc9ba`. Se conservan los cambios de interfaz, magia y ataque del otro agente. Ámbito: instancia/generador, cargador de sus sprites, elección de entrada, filtro de ese evento en el servidor, vista de prueba y pruebas. Las ediciones a `main.js` se limitan al import del diálogo y su evento; se integra la revisión actual de main antes del merge.
