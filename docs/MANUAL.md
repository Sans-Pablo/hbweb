# Manual del jugador · Helbreath Web

Versión del manual: primera versión del juego (build 0.34.0 «Escuelas de magia», octubre de 2026).
La versión que estás jugando aparece arriba a la izquierda, junto a los fps (por ejemplo `v0.34.0 Escuelas de magia`).

## Cómo leer este manual

Helbreath Web es un port del Helbreath original al navegador. La regla del proyecto es que **el código original es la especificación**,
pero esta primera versión también añade sistemas propios. Cada sección indica qué es qué con estas etiquetas:

| Etiqueta | Significa |
|---|---|
| **[FIEL]** | Viene del juego original (fórmulas, textos, listas y números de `Game.cpp`, `Item.cfg`, `NPC.cfg`, `Magic.cfg`...). |
| **[INVENTO]** | Lo ha añadido el port. El Helbreath original no lo tiene. |
| **[ADAPTADO]** | Existe en el original pero el port lo cambia a propósito (por ejemplo, el nivel máximo). |

Lo que no se ha podido comprobar en el código o en las fichas del proyecto no se cuenta aquí.

## Índice

1. [Qué es el juego y cómo empezar](#1-qué-es-el-juego-y-cómo-empezar)
2. [Controles](#2-controles)
3. [Tu personaje](#3-tu-personaje)
4. [Combate y magia](#4-combate-y-magia)
5. [El mundo](#5-el-mundo)
6. [Grupos (party)](#6-grupos-party)
7. [Summons y compañeros](#7-summons-y-compañeros)
8. [Multijugador y administración](#8-multijugador-y-administración)
9. [Herramientas de prueba y cómo reportar fallos](#9-herramientas-de-prueba-y-cómo-reportar-fallos)
10. [Limitaciones conocidas de esta primera versión](#10-limitaciones-conocidas-de-esta-primera-versión)
11. [Resumen: qué es fiel y qué es invento](#11-resumen-qué-es-fiel-y-qué-es-invento)

---

## 1. Qué es el juego y cómo empezar

### 1.1 Qué es

Un RPG de acción en 2D isométrico: eliges un personaje, cazas monstruos, subes de nivel, equipas objetos con atributos,
compras en la ciudad y baja a una cripta de 20 niveles con cuatro jefes. Se juega entero en el navegador, sin instalar nada.

Lo central de esta versión, además del combate fiel al original, son los **summons** (compañeros): criaturas que luchan,
curan o lanzan magia por ti (sección 7).

### 1.2 Modo local y modo online

| | Modo local | Modo online |
|---|---|---|
| Jugadores | Uno. | Varios, en un mundo compartido. |
| Dónde corre el mundo | En tu navegador. | En el servidor del anfitrión (`server/server.mjs`, a 20 Hz). |
| Dónde se guarda | En el navegador (`localStorage`). Sin sincronización entre dispositivos. | En el servidor (base SQLite con 24 copias por personaje). |
| Cuentas | Locales (nombre + contraseña en tu navegador). | Usuario 3–16 caracteres y clave 6–64, en el servidor. |
| Cuándo se usa | Si no hay servidor configurado o no responde. | Si la web encuentra un servidor. |

**[INVENTO]** Ambos modos son del port: el original tenía su propio cliente/servidor, aquí hay una única simulación compartida
que corre igual en el navegador y en Node.

La web busca el servidor en este orden: parámetro `?server=URL` de la dirección, el fichero `data/server.json`, y por último el mismo origen
desde el que se sirve la web. Si el servidor configurado no responde, juegas en modo local con un aviso. Con `?offline=1` fuerzas el modo local.

### 1.3 Primeros pasos

1. **Abre la web.** Aparece la pantalla de entrada con los botones **Español / English** (por omisión, el idioma del navegador).
2. **Crea una cuenta** (pestaña «Crear cuenta») o entra con una existente («Entrar»). En local, la cuenta vive en tu navegador;
   en online, en el servidor.
3. **Crea tu personaje.** La pantalla de creación (basada en la del cliente original) ofrece:
   - **Nombre**: hasta 10 caracteres, con las reglas de nombres del original **[FIEL]**.
   - **Atributos**: Fuerza, Vitalidad, Destreza, Inteligencia, Magia y Carisma, cada uno entre 10 y 14, con un máximo de 70 puntos en total **[FIEL]**.
     Hay tres plantillas: Guerrero (14/12/14/10/10/10), Mago (10/12/10/14/14/10) y Sacerdote (14/10/10/10/12/14).
   - **Aspecto**: género, 3 pieles, 8 peinados, 16 colores de pelo y 8 de ropa interior, con vista previa giratoria.
   - **Personalidad** (prudente, bromista, decidida) **[INVENTO]**: solo cambia el tono de las frases que dice tu personaje en burbujas.
4. **Empieza el tutorial** (ver 1.4). Los personajes nuevos siempre entran por **Aresfarm** (casilla 65,75).
5. Tu personaje nuevo empieza con: una Daga, un Mapa, una poción roja, una azul y una verde, un escudo de madera y pantalón/camisa equipados.

El bando (Aresden / Elvine) **todavía no se elige**.

### 1.4 Tutorial

**[INVENTO]** El original no tiene tutorial. Son 18 pasos con conversaciones (naufragio, la granja de Aresden, la guerra Aresden–Elvine y los muertos de las criptas)
y objetivos que cumples jugando: andar, correr, abrir el personaje y la mochila, equipar, matar un limo de práctica, recoger el botín, beber una poción,
subir de nivel, ir a la tienda, hablar con el tendero, comprar, conseguir un compañero con Gail, invocarlo, visitar la arena y la cripta.

- Avanza con **Espacio**, **Intro** o clic (el primero completa el texto que se escribe).
- Puedes **saltar el tutorial** o **saltar un paso** (el primer clic pide confirmar).
- Un rastreador de objetivos arriba al centro muestra la pista, una barra y una flecha con la distancia al destino.
- Para repetirlo: botón «Repetir tutorial» en Opciones, o `/tutorial` en el chat (`/tutorial off` lo salta).
- Da 400 monedas para comprar en la tienda y, al final, 500 monedas y 3 pociones. Ambas recompensas **solo una vez por personaje**.

### 1.5 Idiomas

Español e inglés. Se cambia en la pantalla de entrada, en Opciones o en el cuadro de mejoras (fila «Idioma / Language»); se recuerda en el navegador.
Los textos del juego original (diálogos de NPC, tiendas, nombres de objetos y monstruos) están en inglés tal cual, como en el original **[FIEL]**.

### 1.6 Versión visible y novedades

La versión y el nombre de la compilación salen junto a los fps. **F1** abre la ventana de novedades, lista de pruebas y notas (sección 9).

### 1.7 Guardado

- **Local**: automático cada 10 s, al ocultar o cerrar la pestaña, y a mano con «Guardar ahora» en Opciones. También hay «Exportar copia» / «Importar copia»
  (archivo) y «Cerrar sesión». Todo vive en tu navegador: si borras los datos del sitio, pierdes la partida.
- **Online**: el servidor guarda cada 5 s lo que cambia y al salir. Un personaje nuevo se guarda al instante.
- Tras actualizar la versión, recarga con **Ctrl+F5** (hay caché). Si algo se ve a medias, vacía los datos del sitio.

### 1.8 Modo móvil

**[INVENTO]** Si el dispositivo es táctil (o con `?mobile=1`) se activa un modo móvil: barras HP/MP/SP/XP, **joystick virtual**, botones de atacar al más cercano,
recoger, pociones, correr y chat, un menú ☰ con todos los cuadros, zoom con dos dedos y aviso para girar el móvil a vertical.
El **ataque automático** se activa la primera vez. Tabla de controles táctiles en la sección 2.5.

---

## 2. Controles

La interfaz usa coordenadas 800x600 como el cliente original. Hay dos modos gráficos, **Clásico** (800x600, cámara fija) y **Remastered**
(pantalla completa, zoom con la rueda, luz y viñeta, orbes de vida y maná, números de daño animados). Se cambia con el botón «Gráficos».
**[INVENTO]** El modo Remastered y el minimapa estilo Diablo II son del port.

### 2.1 Ratón

Copiado del cliente original (`CommandProcessor`) **[FIEL]**, salvo lo indicado.

| Acción | Efecto |
|---|---|
| Clic izquierdo en el suelo | Andar hasta esa casilla (mantén pulsado para seguir al cursor). |
| Clic izquierdo sobre tu propia casilla | Recoger el objeto del suelo. |
| Ctrl + clic izquierdo sobre un monstruo | Atacar hasta matarlo (con arco, a cualquier distancia). |
| Clic derecho sobre un monstruo | Atacar sin moverte (cuerpo a cuerpo, el adyacente; con arco, a distancia). |
| Clic derecho sobre el suelo | Solo giras hacia esa casilla, no andas. |
| Clic izquierdo sobre un habitante de la ciudad | Abre su menú (tienda, herrero, almacén, mago...) si estás a 8 casillas o menos. |
| Clic izquierdo con un hechizo preparado | Lo lanza sobre el objetivo. |
| Clic derecho con un hechizo preparado | Cancela el hechizo. |
| Clic derecho dentro de un cuadro | Cierra el cuadro. Con el minimapa grande abierto, lo cierra. |
| Arrastrar un objeto | Mueve objetos en la mochila, equipa/desequipa, vende sobre el tendero, deposita en el almacén. Tirar fuera del cuadro lo deja en el suelo (también un objeto equipado, arrastrándolo desde Personaje hacia fuera). |
| Pasar el cursor sobre un objeto | Muestra sus estadísticas. |
| Rueda del ratón | Zoom (solo modo Remastered). |
| Mayús + arrastrar un objeto | Agrupa en la misma casilla los objetos del mismo tipo. |
| Alt + clic izquierdo sobre un monstruo | **[INVENTO]** Ordenas a tu summon atacar a ese monstruo (aunque esté en modo Peace). |
| Alt + clic derecho en el suelo | **[INVENTO]** Tu summon va a esa casilla y se queda allí (vuelve a seguirte si te alejas más de 14 casillas). |
| Mantener Alt | Muestra las etiquetas de los objetos del suelo (modo Remastered). |

El **ataque automático** (opción, o `/auto`) hace que el clic izquierdo sobre un monstruo lo ataque sin necesidad de Ctrl.

### 2.2 Teclado y atajos

Teclas del cliente original (`OnKeyUp`) **[FIEL]** salvo las marcadas.

| Tecla | Efecto |
|---|---|
| **F1** | **[INVENTO]** Novedades, lista de pruebas y notas para testers (sustituye a la ayuda original). También Ctrl+H. Esc lo cierra. |
| F2 / F3 | Usar el atajo 1 / 2. Con Ctrl asignas el último objeto o hechizo usado a ese atajo. |
| F4 | Usar el hechizo elegido. |
| F5 | Cuadro Personaje. |
| F6 | Mochila. |
| F7 | Libro de magia. |
| F8 | Habilidades. |
| F9 | Historial de chat. |
| **F10** | **[INVENTO]** Cuadro Summons (también el botón de la barra, entre Personaje y Mochila). |
| F11 | Alterna la transparencia de los cuadros (también Ctrl+W). |
| **F12** | Menú del sistema / Opciones (también Ctrl+X). |
| Esc | Cancela un hechizo preparado o una invitación de grupo y cierra paneles y el cuadro de NPC abierto. **No** abre las opciones: usa F12. |
| Insert / Supr | Beber la poción de vida / de maná. |
| Tab | Alterna modo combate / paz. |
| Inicio | Ataque seguro. |
| Fin | Repite el último mensaje de chat. |
| Intro | Abre el chat; muerto, reaparece. |
| Cualquier letra | Abre el chat y empieza a escribir (excepto E: junto a un portal lo usa). |
| E | Junto a un portal (cripta), lo atraviesa. |
| + / - | Mapa ampliado / normal. |

Combinaciones con Ctrl:

| Tecla | Efecto |
|---|---|
| Ctrl + 1…9, 0 | Abre el libro de magia en ese círculo (el 0 abre el círculo 10). |
| Ctrl + R | **Alterna correr / andar.** No se usa Mayús para correr. |
| Ctrl + A | Modo de ataque automático (alterna). |
| Ctrl + D | Cambia el nivel de detalle gráfico (bajo / medio / alto). |
| Ctrl + M | Muestra / oculta el mapa. |
| Ctrl + S | Sonido on / off. |
| Ctrl + T | Abre el chat con `/to ` (mensaje privado). |
| **Ctrl + P** | **[INVENTO]** Grupo automático: invita al jugador bajo el cursor (o al más cercano a menos de 20 casillas) y entra en el grupo sin preguntar. |
| Ctrl + clic al subir stats | Reparte los puntos de 5 en 5. |

Notas:
- PageUp solo avisa («no tienes ninguna habilidad especial lista»).
  Las teclas que el original no tenía (C, I, K, M, G, B, N, O, R, H, Espacio, 1, 2, 3) se quitaron del port.
- **No** se usa Mayús para correr; solo sirve para agrupar objetos arrastrados.

### 2.3 Chat y comandos

Intro (o cualquier letra) abre el chat. Prefijos y comandos:

| Entrada | Efecto |
|---|---|
| Texto normal | Chat del mapa (hay chat de mapa, no global; sin susurros ni gremios). |
| `$texto` | Chat de grupo (cuesta 3 SP) **[FIEL]**. |
| `/to nombre mensaje` | Mensaje privado (atajo Ctrl+T). |
| `/auto` | Alterna el ataque automático. |
| `/petname nombre` | Renombra a tu summon activo. |
| `/tutorial`, `/tutorial off` | Repite o salta el tutorial. |
| `/magicshop` | Abre la tienda de magia (provisional). |
| `/gold N` | Solo en modo local, para pruebas. |
| `/time day|night|auto`, `/weather 0-3` | Solo en modo local, para pruebas. |

Los comandos de administración se describen en la sección 8.

### 2.4 Cuadros y barra

- Los cuadros del cliente original (Personaje, Mochila, Magia, Habilidades, Sistema...) son movibles; un clic en un hueco vacío del cuadro permite arrastrarlo.
- La barra inferior (modo clásico) o el HUD HTML (Remastered) muestra vida, maná, aguante y experiencia, las pociones con sus teclas (Insert/Supr),
  los botones Personaje, Mochila, Magia, Gráficos, Sonido, Opciones y Novedades, el símbolo de combate/paz y el panel del summon con su símbolo ATQ/PAZ.
- Hay un botón **Recall** a la derecha de la barra (sección 5.6).
- El **minimapa** (Ctrl+M) puede ser de esquina o superpuesto estilo Diablo II.

Opciones principales (F12): correr, mostrar mapa, estilo del mapa, ataque automático, casillas bloqueadas, cursor clásico, sprites HD, luz y viñeta,
animaciones de hechizos, información de objetos del suelo (atributos y precio), volumen de sonido y de música con sus interruptores, idioma, y las
acciones de cuenta (guardar, exportar/importar copia, cerrar sesión, repetir tutorial).

### 2.5 Móvil

| Control | Efecto |
|---|---|
| Joystick virtual | Andar; a fondo, correr. |
| Botón de espadas | Atacar al enemigo más cercano. |
| Botón de mano | Recoger el objeto más cercano. |
| Corazón / rombo | Poción de vida / de maná. |
| Botón de correr | Alterna correr. |
| Botón de chat | Abre el chat. |
| ☰ | Menú con todos los cuadros, opciones, novedades, tutorial, retorno, guardar, pantalla completa y zoom. |
| ✕ | Cierra el cuadro abierto (un cuadro cada vez, centrado). |
| Dos dedos | Zoom. |
| AUTO | Ataque automático. |

---

## 3. Tu personaje

### 3.1 Atributos y puntos

Los seis atributos son **Fuerza (Str), Vitalidad (Vit), Destreza (Dex), Inteligencia (Int), Magia (Mag) y Carisma (Chr)**. Cada uno puede llegar a 200 **[FIEL]**.

| Derivado | Fórmula **[FIEL]** (`iGetMaxHP/MP/SP`) |
|---|---|
| Vida máxima | Vit × 3 + nivel × 2 + Str / 2 |
| Maná máximo | Mag × 2 + nivel × 2 + Int / 2 |
| Aguante máximo | Str × 2 + nivel × 2 |
| Defensa base | Dex × 2 (más armaduras) |
| Carga máxima (peso) | Str × 500 + nivel × 500 (en unidades de peso del juego) |

Qué hace cada atributo, según el código del port:
- **Str**: vida y aguante máximos, daño sin arma (1d(Str/12)) y bonus de daño con arma (+Str/5 %), peso que puedes cargar.
- **Vit**: vida máxima, regeneración de vida y de aguante, reducción del daño que recibes (1d(Vit/10) − 1).
- **Dex**: acierto, defensa y tope de varias maestrías de armas.
- **Int**: maná máximo, requisito para aprender hechizos y tope de habilidades como alquimia.
- **Mag**: maná máximo, regeneración de maná, tope de la maestría de Magia y Bastón.
- **Chr**: descuento en las tiendas ((Chr − 10) / 4 %, con un tope de la mitad menos 1 del precio).

**Puntos**: cada nivel da **3 puntos** para repartir **[FIEL]** (`bCheckLevelUp`). Se reparten en el cuadro Personaje (F5). El botón de pool
muestra los puntos pendientes. Con Ctrl repartes de 5 en 5.

### 3.2 Nivel y experiencia

- La experiencia necesaria sigue la tabla del original: `exp(n) = exp(n−1) + n·(50 + n·(n/17)²)` con división entera **[FIEL]**.
- **[ADAPTADO]** El nivel máximo es **50** (el original llega a 180).
- La experiencia viene de golpear (daño hecho, hasta agotar la del monstruo) y de matar. Los monstruos especiales (tipos 1–8) dan más
  (+15 % a +30 %) o absorben daño. Los objetos con atributos de experiencia la aumentan.
- En un grupo la experiencia se reparte entre los miembros vivos del mismo mapa (sección 6).

### 3.3 Vida, maná, aguante y hambre

| Recurso | Cómo se recupera **[FIEL]** salvo lo indicado |
|---|---|
| Vida | Cada 15 s: el mayor entre 1d(Vit) y Vit/2. Pociones y hechizos. |
| Maná | Cada 20 s: 1d(Mag). Pociones. |
| Aguante | **[ADAPTADO]** Cada 2 s (más rápido que en el original, para que los nuevos puedan correr). Correr gasta 1 SP cada 4 casillas. Sin aguante no se corre. |
| Hambre | **[FIEL]** Baja 1 punto por minuto, **solo a partir del nivel 20**. Con el estómago vacío no hay recuperación; con poco hambre la recuperación se enlentece. Con hambre ≤ 10 o sin aliento tienes 1/10 de fallar los golpes. |

Come con comida u objetos de consumo. El hambre vuelve a 100 al reaparecer.

### 3.4 Peso y mochila

- La mochila tiene **50 casillas** **[FIEL]**. Los objetos apilables (pociones, flechas) se juntan; cada uso gasta una unidad.
- Si el peso supera tu carga máxima, no puedes recoger más (aviso de que no puedes cargar). Las bolas de summon pesan 1.
- El **almacén** de la ciudad tiene 200 huecos (sección 5.4).

### 3.5 Habilidades

Las habilidades de `Skill.cfg` **[FIEL]**: Minería, Pesca, Agricultura, Resistencia mágica, Magia, Ataque sin armas, Arquería, Espada corta,
Espada larga, Esgrima, Hacha, Escudo, Alquimia, Fabricación, Martillo, Fingir muerte, Bastón y Resistencia al veneno.

- La maestría va de 0 a 100 y **sube con el uso** (cada golpe da experiencia de habilidad al arma; al matar se añade más).
- Solo progresa una habilidad que ya tienes (maestría inicial > 0). Los personajes nuevos empiezan con: Resistencia mágica (Mag/3), Magia (Mag+10),
  Ataque sin armas (Str+10) y Espada corta (Dex+10).
- Cada habilidad tiene un tope según un atributo (por ejemplo, armas = Dex × 2, Magia = Mag × 2, Resistencia mágica = nivel × 2).
- Total máximo de maestrías: 700. Se ven con F8.
- Se pueden aprender más habilidades con manuales de habilidad (objetos).

### 3.6 Equipo y objetos

- Los 568 objetos de `Item.cfg` están en el juego con sus IDs y nombres originales **[FIEL]**. Equipar exige requisitos (fuerza, nivel, género...).
- La armadura absorbe daño por parte del cuerpo: 50 % cuerpo, 25 % piernas, 15 % brazos, 10 % cabeza; la absorción total tiene tope del 80 % **[FIEL]**.
- **Durabilidad**: las armas y armaduras se desgastan al combatir (solo si tienes bando; ver limitaciones). La lluvia aumenta el desgaste de las armas cuerpo a cuerpo.
  Un objeto sin vida queda «exhausted» y se desequipa; el herrero o el tendero lo reparan.
- **Atributos de objetos que caen** **[FIEL]** (`NpcDeadItemGenerator`, `_AdjustRareItemValue`): dado extra, acierto, defensa, recuperación de vida/aguante/maná,
  absorción, daño de combo, experiencia, oro, maná por daño, carga de crítico y bonus de varitas. Aún sin portar: veneno, daño crítico, «Righteous».
- **Rareza visible [INVENTO]**: normal (blanco), mágico (azul, algún atributo), raro (dorado, dos atributos con suma ≥ 12 o valor ≥ 10) y único (naranja).
  Los raros y únicos en el suelo llevan etiqueta siempre visible y un rayo de luz, y avisan con «¡Objeto único!/raro!» y sonido.
- **Únicos de rey [INVENTO]**: cada jefe de la cripta suelta siempre objetos reales de `Item.cfg` (collares y anillos como Efreet, Liche, Abaddon...).
  Dan **protección elemental** (fuego, hielo, luz, veneno; tope 90 %).
- **Botín**: el oro cae el 60 % de las veces y los objetos siguen las tablas del original **[FIEL]**. En la cripta, el botín se escala con la profundidad **[INVENTO]**.
- En diciembre cualquier monstruo suelta caramelos (el original lo programa así) **[FIEL]**.

### 3.7 Muerte y penalización

Mira la sección 4.4.

---

## 4. Combate y magia

### 4.1 Cuerpo a cuerpo

Fórmulas auditadas contra `iCalculateAttackEffect` **[FIEL]**:
- Sin arma: daño 1d(Str/12). Con arma: dados del arma + bonus, y después + Str/5 %.
- **Acierto**: base 50, + (Dex − 50) si Dex > 50, + bonus del equipo. Probabilidad = (acierto / defensa del objetivo) × 50, entre 15 % y 99 %.
  Atacar por la espalda reduce a la mitad la defensa del objetivo.
- El **combo** (golpes seguidos) añade daño desde el segundo golpe; un fallo lo reinicia.
- **Furia** (berserk) duplica el daño de los golpes normales. Los escudos mágicos del objetivo suman +40 / +100 de defensa.
- El alcance cuerpo a cuerpo es de 1 casilla (4 con el arma 845).
- Contra monstruos: cuando los hieres, 1 de cada 3 veces se vuelven contra ti.
- El retroceso (golpes físicos de 40 o más al jugador) está portado.
- **[ADAPTADO]** Tras luchar, el personaje mantiene la postura de combate 4 s.

### 4.2 Arco

Con un arco equipado (habilidad Arquería) el botón derecho sobre un monstruo, o Ctrl + clic izquierdo, **dispara a cualquier distancia** **[FIEL]**.
Cada disparo con blanco gasta una flecha del primer montón; sin flechas el gesto no hace daño. La lluvia reduce el acierto del arco (5 / 10 / 25 %).
Un monstruo grande (wyvern) se puede golpear desde 2 casillas aunque el servidor original solo lo permita desde 1 (diferencia conocida).

### 4.3 Magia

La magia sigue las reglas del servidor original (`PlayerMagicHandler`, `Magic.cfg`) **[FIEL]**:

- **Aprender**: cada hechizo se aprende con el mago **Gandlf** (está en la tienda general). Cuesta oro y exige un mínimo de **Inteligencia**.
  Se compra desde el libro de magia (F7), que se organiza en **círculos** (10 círculos; Ctrl + 1…0 abre el libro en ese círculo).
- **Lanzar**: elige el hechizo en el libro (el libro se cierra y empieza la animación de lanzar) y haz clic con el botón izquierdo sobre el objetivo.
  El botón derecho cancela. F4 relanza el hechizo elegido.
- **Requisitos**: cuesta maná, hay que lanzarlo con las manos libres o con una varita, y **puede fallar** (probabilidad según Magia, Int y resistencia del objetivo).
- **Zonas seguras**: un hechizo de ataque no se puede lanzar desde una casilla sin ataque (sección 4.5).
- **Tipos portados**: daño a un objetivo, daño de área, lineal, temblor, hielo, rompe-armaduras, curar, recuperar, crear comida, escudos, parálisis,
  invisibilidad, campos de fuego/hielo/veneno, posesión, veneno, furia, cancelación, escaneo, **Recall**, **Summon Creature**.
- **Invocar** (Summon Creature) crea un seguidor temporal (hasta Magia/20, 300 s, sin experiencia ni botín).
- **Sin efecto todavía**: Confusion, Inhibition y Resurrection (solo afectan a otros jugadores), y los tipos 4–6 y 20.
- Los efectos visuales portados cubren los hechizos más comunes; algunos hechizos de los tipos 19–33 aún no tienen su animación.

**[INVENTO]** Las **escuelas de magia** de los summons cambian cómo se lanzan los hechizos de ataque elementales y los de apoyo (sección 7.9).
En esta versión, **curar, escudos y berserk ya no los lanza el jugador**: son del Dummy.

### 4.4 Muerte y reaparición

- Al morir aparece el cuadro del sistema original con **Restart** (o pulsa Intro). Reapareces en **Aresfarm (65,75)** con vida, maná, aguante y hambre completos.
- **[INVENTO] Penalización**: pierdes el 25 % de la experiencia que cuesta tu nivel y, si no alcanza, **bajas de nivel** (con sus puntos sin repartir).
  Sin penalización en zonas de lucha.
- Si mueres en la cripta, la instancia se descarta.
- Tu summon no sufre nada cuando mueres tú, pero sí cae si lo derrotan a él (sección 7.8).

### 4.5 Zonas seguras

Las zonas sin ataque **[FIEL]**: rectángulos marcados en cada mapa (la ciudad, tiendas...) y las 20 casillas del borde del mapa.
No se puede lanzar un hechizo de ataque desde ellas. En la arena de apuestas el mapa entero está sin ataque.

### 4.6 Día, noche y clima

**[FIEL]** (`_CheckDayOrNight`, `WhetherProcessor`): es de noche cuando el minuto del reloj es ≥ 40. Los mapas con día fijo son siempre de día.
Cada 20 s hay 1/300 de probabilidad de que empiece lluvia ligera, media o fuerte durante unos minutos. La lluvia baja el acierto de los arcos y
aumenta el desgaste de las armas. La nieve aún no está portada.

---

## 5. El mundo

### 5.1 Aresfarm

Tu punto de entrada y de reaparición. Es la granja de Aresden con los 11 generadores de monstruos del servidor original **[FIEL]**
(slimes, hormigas gigantes, escorpiones, amphis y golems de piedra, entre otros). Los monstruos reaparecen en su zona al morir.
El teletransportador de la granja hacia middled1n (casillas 78–80, 69–71) lleva a la **cripta de esqueletos**; los demás llevan a otros mapas exportados.
En total hay 45 tipos de monstruos con sus sprites, sonidos y tiempos originales.

### 5.2 Ciudad (Aresden) y NPC

La ciudad tiene tiendas, herrería, almacén, el ayuntamiento y el mago, todo con sus NPC del original:

| NPC | Función | Origen |
|---|---|---|
| ShopKeeper-W | Tienda general (comprar y vender, repara objetos de tipo 11, 12 y 43–50) | **[FIEL]** |
| BlackSmith (Tom) | Herrero: compra/vende armas y armaduras y las repara | **[FIEL]** |
| Howard | Almacén (depositar y retirar) | **[FIEL]** |
| Gandlf | Mago: enseña hechizos | **[FIEL]** |
| Gail | Hospital de summons | **[INVENTO]** (usa la ficha y el sprite de un NPC sin función en el original) |
| Kennedy | Arena de apuestas | **[INVENTO]** (usa la ficha y el sprite de un NPC sin función en el original) |

La ciudad cambia día/noche, lluvia y música según el lugar (aresden, dungeon, MainTm...).
Faltan por portar los menús de William, McGaffin, Perry, Devlin y Guard-Aresden, y los teletransportes a Elvine.

### 5.3 Tiendas

Clic izquierdo en el tendero o el herrero (a 8 casillas o menos) abre el menú. Los mensajes y textos son los del original, en inglés **[FIEL]**.

- **Comprar**: descuento por Carisma ((Chr − 10) / 4 %). Hasta 50 unidades por orden. `10Arrows` y `100Arrows` compran 10 o 100 flechas.
- **Vender**: se hace en dos pasos (consulta de precio y confirmación). Arrastra el objeto sobre el tendero o usa el cuadro de venta (hasta 12 objetos).
  Las categorías 11–50 se pagan a la mitad del precio; las armas y armaduras (1–10) según la vida restante y sus atributos.
- **Reparar**: cuesta la mitad del precio menos lo que aún vale. Armas y armaduras (1–10) las arregla el herrero; el resto, el tendero.
- Mientras estás dentro de una tienda no aparece el minimapa.

### 5.4 Almacén

Howard guarda hasta **200 objetos**. Los apilables se suman. El almacén se guarda con tu personaje. Las bolas de summon se pueden
guardar en el almacén; el summon se desvanece.

### 5.5 Teletransportadores

Los teletransportadores de cada mapa llevan a otros mapas exportados. Un personaje de nivel bajo no puede entrar en mapas con límite de nivel
(los de Middleland, por ejemplo). Algunos destinos todavía no están exportados (2ndmiddle, CmdHall_1, dglv2, huntzone2, middled1n, middleland).

### 5.6 Recall

El botón **Recall** (a la derecha de la barra) o el hechizo del mismo nombre te lleva de vuelta a Aresfarm (65,75).
**[INVENTO]** El botón requiere **3 s quieto y sin combatir** y tiene un **enfriamiento de 60 s**; si te mueves o te atacan, se cancela.
El hechizo Recall del original está portado solo para uno mismo.

### 5.7 Arena de apuestas

**[INVENTO]** (sin equivalente en el original). El NPC **Kennedy** está en la tienda general (55,43).

1. Necesitas un summon sano. Clic en Kennedy → ves las ofertas con **probabilidades y cuotas**.
2. Apuestas oro a que gana tu summon («a») o un retador generado («b»). Mínimo 100, máximo 500 + 250 × nivel.
3. Viajas a un mapa de arena (sin monstruos, todo sin ataque, no se puede atacar ni lanzar magia) y ves la pelea en directo. Eres solo espectador.
4. Al terminar se cobra la apuesta y vuelves a la tienda.

El resultado se fija al apostar (si recargas a mitad de combate se cobra igualmente). La casa gana el 10 % de margen. Tu summon real no sufre
heridas, experiencia ni penalización: pelea una copia.

### 5.8 La cripta de esqueletos

**[INVENTO]** (el original no tiene mazmorras con jefes). Se entra por el teletransportador de Aresfarm hacia middled1n.
Cada jugador (o cada **party**) tiene su propia **instancia privada**.

**Niveles.** Son **20 niveles** que se bajan de uno en uno. Cada nivel es una ventana de 60x60 casillas recortada de mapas del original, con acantilados,
suelos y antorchas del original. Se generan con una semilla, así que son iguales en el navegador y en el servidor. Para bajar tienes que **despejar el nivel**
(sin enemigos vivos ni fantasmas pendientes): se abre entonces el portal de bajada. Hay un portal de salida; usa **E** junto a ellos.

**Dificultad.** Cada nivel aumenta la vida de los monstruos un 22 %, el daño un 10 % y la experiencia un 15 % sobre el nivel anterior.
Los niveles 5, 10, 15 y 20 son una ventana de 36x36 con un **jefe** a tres cuartos del camino.

**Progreso.** Se guarda el nivel más profundo alcanzado. Al volver a entrar, el juego pregunta si **continúas** donde lo dejaste o **reinicias** desde el nivel 1.

**Fantasmas.** Al matar un esqueleto común hay un 25 % de que, cuando desaparezca su cadáver, salga un fantasma (translúcido). Dan poca experiencia
(20 %) y no sueltan botín, pero cuentan para despejar el nivel.

**Jefes (reyes)**:

| Jefe | Nivel | Mecánicas |
|---|---|---|
| 1 Carmesí | 5 | Furia (más rápido al perder vida, rugido que aturde), brasas de fuego bajo los jugadores y compañeros con aviso previo, invoca huesos y mantiene un campo de fuego. |
| 2 Umbrío | 10 | Salto a la espalda, drenaje que roba vida a un compañero o jugador y cura al jefe, clones al 75 % y 40 % de vida (con clones vivos el real recibe solo el 35 %). |
| 3 Glacial | 15 | Suelo helado (más tiempo por paso), congelación del compañero (parálisis breve si no tienes), escudo de hielo que exige destruir 3 cristales. |
| 4 Dorado | 20 | Cambia de fase según su vida (brasas, salto y drenaje, suelo helado), contador de furia que sube su daño pero también el oro que suelta, y un aura que devuelve el 30 % del daño mágico al lanzador. |

Cada jefe suelta siempre sus objetos únicos (collares y anillos, ver 3.6). Los monstruos de cada tramo llevan un leve tinte del color del rey correspondiente.

**Party en la cripta.** Un grupo entra siempre a la misma cripta: **entrad todos por la entrada y bajad juntos**.

**Música y voces.** La cripta usa su propia música. Tu personaje y tu summon comentan lo que ven con **miedo creciente** según la profundidad.

---

## 6. Grupos (party)

Basado en el sistema del original (`JoinPartyHandler`, `GetExp`...) **[FIEL]**:

- **Invitar**: Personaje > Party > «Join a party» y haz clic sobre el otro jugador (mientras eliges, los cuadros Personaje y Grupo se ocultan hasta el clic).
  El invitado ve «offered you to join the party» con Yes / No; puedes cancelar la invitación.
- **Reglas**: máximo **8** miembros, mismo bando; si el invitado no tenía grupo, lo funda. No puedes invitar a quien ya tiene una invitación pendiente.
- **Salir**: «Withdraw». Con un solo miembro el grupo se disuelve.
- **Experiencia**: se reparte entre los miembros vivos del mismo mapa. Con 8 miembros sale el doble por la división entera del original.
- **Chat de grupo**: `$texto` (cuesta 3 SP). Los miembros llevan «, Party Member» junto a su nombre.
- **[INVENTO] Ctrl + P**: invita al jugador bajo el cursor (o al más cercano) y entra al grupo **sin preguntar**.
- **[INVENTO]** Marcos de grupo a la izquierda con la vida de cada miembro y de su compañero.
- **[INVENTO]** Los bots (sección 8.4) entran a tu grupo.
- No hay fuego amigo porque no existe el PvP. El grupo vale en la cripta (sección 5.8) y para las ayudas del Dummy (sección 7.10).

---

## 7. Summons y compañeros

**[INVENTO]** Los summons no existen en el original (reutilizan las bolas 651–655 de `Item.cfg`, los monstruos de `NPC.cfg` y los hechizos de `Magic.cfg`).
Son **la parte principal del juego**: luchan por ti, matan por ti (la experiencia se reparte) y sueltan botín.

### 7.1 Bolas y obtención

Un summon vive en una **bola** (GreenBall a PearlBall) que llevas en la mochila. Se compra en el **hospital de Gail** (pestaña «Bolas»; precio simbólico de 1 de oro
durante las pruebas). Matar monstruos ya no da bolas. La bola guarda el nivel, la experiencia, el maná y el nombre.

- **Usar la bola** (doble clic): invoca / guarda el summon. Solo hay uno activo a la vez.
- Tirar la bola al suelo o depositarla en el almacén la guarda. Una bola en el suelo muestra su nombre (por ejemplo «Cyclops Ball»).
- Al guardarse, el summon se desvanece en 1 segundo.
- Si cambias de mapa, el summon te sigue.
- Una bola de un summon caído se ve en escala de grises.
- **Alt + clic izquierdo**: ordena atacar a un monstruo; **Alt + clic derecho**: va a una casilla (sección 2.1).

### 7.2 Cuadro Summons (F10)

Ventana movible con el monstruo caminando, su nombre, nivel, vida, barra de experiencia y 4 pestañas: **Info** (renombrar, modo, reinicio de talentos,
hechizos aprendidos) y **Support / Damage / Warrior**. El panel de la barra muestra una miniatura de su vida, el símbolo **ATQ/PAZ**, una barra azul de experiencia
y un nombre con nivel.

### 7.3 Modos Peace y Attack

El símbolo ATQ/PAZ del panel (o el botón de modo) alterna:
- **Attack**: el summon ataca a los enemigos.
- **Peace**: no ataca por su cuenta. Con **Alt + clic izquierdo** sobre un monstruo, lo ataca igualmente.

### 7.4 Nivel y experiencia

- El summon sube de nivel con **experiencia propia**: 25 % de la del dueño en cada muerte propia y 50 % de `exp/3` del monstruo en las suyas.
  Curva `30 × nivel^1,7`. Su nivel nunca supera el tuyo y tiene un máximo de 50.
- Daño y vida: comparte tus estadísticas. Aproximadamente, daño = tu daño medio × cuota (hasta 0,5 sin talentos, hasta 0,9 con especialidad), vida = tu vida × (0,3 + 0,01 × nivel, máx. 0,8).
- **Los monstruos prefieren atacar al más cercano entre tú y tu summon.**

### 7.5 Evolución de tamaño

El summon cambia de tamaño a saltos en los niveles **10, 25, 40 y 50** (cría, joven, veterano, élite, tamaño real). Al cruzarlo dice una frase especial y
2,5 s después se **vuelve a invocar** con un efecto de anillos y chispas. En el último nivel antes de evolucionar late y brilla más rápido.
Las voces cambian con la etapa (baby 1–9, young 10–24, veteran 25–39, elite 40+).

### 7.6 Talentos: Support, Damage, Warrior

Cada nivel del summon da **1 punto** de talento (nivel máx. 50). Se reparten en tres ramas. Una fila (tier) `t` exige `2·t` puntos gastados en la rama.
La rama con más puntos (sin empate) es la **especialidad**:

| Rama | Efecto |
|---|---|
| Damage | Daño ×1,35, vida ×0,85. |
| Warrior | Daño ×0,85, vida ×1,7, maná ×0,8. Tanque. |
| Support | Daño ×0,6, maná ×2. |

Reiniciar los talentos cuesta `50 × nivel` de oro y se hace con Gail.
Los summons de combate (sección 7.9) **no aprenden talentos con hechizo**: solo luchan. Sus hechizos de apoyo originales (Heal, Defense Shield...) pasaron al Dummy.

### 7.7 Caramelos

Items 780 (rojo), 781 (azul), 782 (verde) de `Item.cfg`. Ya no curan al jugador; se usan sobre el summon con **doble clic** (sobre el compañero elegido)
o **arrastrándolos sobre su bola** en la mochila:

| Caramelo | Efecto |
|---|---|
| Rojo | Cura la vida del compañero. |
| Azul (4d8+200) | Le da maná (también con la bola guardada). |
| Verde | Revive a un summon caído (a mitad de vida). |

### 7.8 El hospital de Gail y cuando cae tu summon

Gail está dentro de la tienda general (57,41). Ofrece:

- **Cuidados**: curar vida (2 de oro por punto de vida), reanimar a un summon caído (coste `(1500 + 400·nivel) × (1 + 0,15·rango)`).
- **Bolas**: comprar una bola de cualquier especie de combate o de escuela de nivel 1 (precio de pruebas; Demon, Frost y Liche solo por cambio al nivel 50).
- **Caramelos**: rojo 60, azul 90 y verde 400 de oro cada uno (precios del port).
- **Reiniciar talentos** (`50 × nivel`).
- **Cambio de escuela** a nivel 50 (sección 7.9).

Si tu summon cae, queda **inconsciente**, vuelve a la bola, y pierde el 25 % de la experiencia de su nivel (baja de nivel si no alcanza).
No se puede invocar caído; recupera un 2 % de vida cada 6 s tras 8 s sin recibir daño, o con Gail / caramelo verde.

### 7.9 Escuelas de magia y summons de combate

Tus hechizos de ataque elementales los lanza el summon de su escuela, **con su propio maná**:

| Escuela | Especie (nivel 1) | Especie superior (nivel 50) |
|---|---|---|
| Fuego | Orc (rojo) | Demon |
| Hielo | Tentocle (azul) | Frost |
| Rayo | Cannibal-Plant (celeste) | Liche |

- Tú tienes el hechizo en el libro y lo lanzas normal (animación, probabilidad, daño con tu Magia), pero **solo sale si el summon de la escuela está fuera**
  y tiene maná. El efecto sale del summon.
- Daño × Frenzy × (1 + 1 % por nivel) × 1,25 si es la especie superior.
- Tierra y los hechizos sin elemento no tienen escuela y siguen siendo tuyos, igual que las utilidades (Recall, Summon, Create Food...).
- **El maná del summon de escuela no se regenera por sí solo.** Se recupera con el **caramelo azul** (también con la bola guardada). El maná viaja con la bola.
- Tienen el doble de maná que un summon normal (×1,6 más en la especie superior).
- **Cambio al nivel 50**: en el hospital de Gail, un Orc / Tentocle / Cannibal-Plant de nivel 50, vivo y guardado se cambia por Demon / Frost / Liche de **nivel 1**, con
  el mismo nombre y mejores estadísticas (+50 % vida, +60 % maná, +25 % daño). Demon, Frost y Liche no se compran.
- **Summons de combate** (escuela general, el resto de especies: Slime, Giant-Ant, Amphis, Skeleton, Clay-Golem, Stone-Golem, Orc-Mage, Hellbound, Cyclops, Troll, Orge...):
  luchan y no lanzan hechizos. Sus ramas de talento sirven para ajustar daño, vida y resistencia.
- Curar, escudos y berserk son **solo del Dummy**.

### 7.10 Dummy

El Dummy es el summon de apoyo único del port. Se compra como cualquier bola en Gail (pestaña «Bolas»).

- **Frágil y pacífico**: vida `6 + 1,2 × nivel` (66 al nivel 50). **No ataca**. Los monstruos cercanos lo prefieren (la distancia cuenta la mitad), así que ponlo a salvo.
  El Dummy no habla: muestra sobre su cabeza la magia o el aura que usa, y avisa de forma corta cuando un monstruo lo ataca.
- **Clases** (la primera magia que aprendes fija la clase; reiniciar talentos cuesta oro):

  | Clase | Color | Qué hace |
  |---|---|---|
  | Healer | Verde | Heal, Great Heal. |
  | Buffer | Amarillo | Defense Shield, Great Defense Shield, Protection From Magic, Berserk. |
  | Aura | Azul | Auras de regeneración de vida, experiencia, defensa y maná. |

  La bola del Dummy se tiñe del color de su clase.
- **Área**: radio 1 al nivel 1, hasta 6 al nivel 50 (casillas, Chebyshev). Se dibuja como un **anillo del color de su clase** en el suelo (por debajo del personaje).
- **Solo ayuda al grupo**: tú, tu party y los summons de todos ellos, dentro de su área.
- **Modo Stay / Follow**: con el botón de modo, se queda en su sitio o te sigue.
- **Auras**: los porcentajes crecen con el nivel y el rango; al nivel 50 con rango 5: hasta 5 % de vida por segundo, 4 % de maná, +40 % de experiencia
  y −30 % de daño recibido. Se renuevan cada segundo a quien esté dentro del área.
- **MASS** (talento de nivel 30, recarga de 60 s): Healer lanza Great Heal a todo el grupo, Buffer aplica todos sus buffs a todo el grupo, Aura duplica sus auras 20 s.
  Ignora el radio (basta con el mismo mapa).
- **Protection From Magic**: reduce el daño elemental y mágico recibido.
- **Agro**: los monstruos cercanos lo atacan primero; colócalo detrás del grupo.

### 7.11 Voces

Tu personaje y tu summon hablan con burbujas de chat: comentan compras, subidas de nivel, el clima, los monstruos y, en la cripta, el miedo creciente.
Esto es un adorno **[INVENTO]**: no cambia ninguna regla.

---

## 8. Multijugador y administración

### 8.1 Cómo se juega online

La web trae gráficos y cliente; el mundo, las cuentas y los personajes viven en el servidor del anfitrión. El servidor debe estar encendido
(`Servidor online.bat`) para que se pueda entrar; si no, la web funciona en modo local. Dirección fija con túnel (ngrok o Tailscale Funnel);
los pasos están en [ONLINE.md](ONLINE.md).

Ves a los demás jugadores con su nombre encima (formato del cliente original: nombre y debajo *Traveller*, *(Enemy)* o *(Friendly)*). La Aresfarm, la ciudad,
las tiendas y la arena son mundos compartidos; **cada jugador o grupo tiene su cripta privada**. El movimiento de los otros jugadores se suaviza
con un retardo de 120 ms. Una sola sesión por cuenta (la nueva expulsa a la vieja). Los nombres de personaje son únicos en el servidor.

### 8.2 Chat

El chat es **del mapa** (los jugadores del mismo mapa os veis), más el chat de grupo (`$texto`) y el privado (`/to`). No hay susurros globales ni gremios.

### 8.3 Seguridad (para el jugador)

Contraseñas con scrypt; 8 intentos fallidos por IP y 10 minutos produce bloqueo; el servidor decide todo (daño, botín, oro). No hay recuperación de clave por
correo: el administrador la restablece con `/resetpass`. **PvP no existe todavía.**

### 8.4 Administración: comandos y bots

Solo para las cuentas listadas como `admins` en `server/config.json`. Comandos de chat (con `/`):

| Comando | Efecto |
|---|---|
| `/who` | Lista de jugadores conectados. |
| `/kick <jugador> [motivo]` | Expulsa. |
| `/mute <jugador> [min]`, `/unmute` | Silencia. |
| `/ban <cuenta>`, `/unban <cuenta>`, `/banip <ip>` | Bloqueos. |
| `/say <anuncio>` | Anuncio global. |
| `/resetpass <cuenta> <clave>` | Restablece la clave. |
| `/save`, `/restart`, `/stop` | Guardar, reiniciar, apagar el servidor. |

Los mismos comandos funcionan en la consola del servidor (sin barra) y en el **panel web** `/admin` (solo desde el propio PC).

**Bots de administración [INVENTO].** En **F1 → Herramientas** hay botones «Invocar bot (en tu grupo)», «Bot suelto» y «Quitar bots», con el número
de bots y el nivel. Los bots son **jugadores simulados** que usan las mismas órdenes que un cliente (andar, atacar, recoger, equipar, usar, repartir puntos, hablar):

- Con «Invocar bot» entran **en tu grupo**, te acompañan, atacan lo que te amenaza y te siguen si cambias de mapa o de cripta.
- Con «Bot suelto» cazan por su cuenta cerca de donde nacieron.
- Cada pocos segundos hacen recados: reparten puntos, **compran con su oro por catálogo, se equipan** con lo mejor que les llega, reponen pociones y comida,
  venden lo que sobra y recogen botín.
- **Suben de nivel matando**. Evitan los monstruos que los matarían en 3 golpes y descansan con poca vida.
- Se pueden invocar hasta 10 a la vez por orden y hasta 40 en total; al salir su dueño, sus bots se van con él.
- Sirven para rellenar un servidor y probar grupos y reparto de experiencia.

---

## 9. Herramientas de prueba y cómo reportar fallos

### 9.1 F1: Novedades y pruebas

**[INVENTO]** F1 abre una ventana con tres pestañas:
- **Novedades**: el registro por fecha de lo que cambia en cada versión.
- **Para probar**: una lista con casillas; márcalas al probarlas (se guardan en tu navegador).
- **A tener en cuenta**: límites conocidos y lo que falta por portar.

### 9.2 F1 → Herramientas

**[INVENTO]** Solo para testers. En el servidor online están abiertas a todos los jugadores salvo que el anfitrión las desactive (`HB_DEBUG=0`).

| Sección | Qué hace |
|---|---|
| Personaje | Subir de nivel (1–50) o experiencia, dar oro y puntos, curarte, modo inmortal, habilidades. |
| Ir a | Saltar a cualquier mapa exportado, a un nivel concreto de la cripta, despejar el nivel y abrir portales. |
| Objetos | Crear cualquier objeto por su nombre de `Item.cfg`; kits de pociones, flechas, tintes y manuales. |
| Enemigos | Crear monstruos (cantidad, fuerza, jefes 1–4), matarlos a todos, congelarlos. |
| Summons | Crear bolas de cualquier especie y nivel, subir su nivel, curar, asignar un build de talentos, reiniciar. |
| Mundo | Día / noche / automático y clima 0–3. |
| Bots | Invocar y quitar bots (sección 8.4). |

### 9.3 Cómo reportar un fallo

Lo pide el propio juego en sus notas de F1:
- Indica **el mapa, tu nivel y el arma equipada** (el código original es la especificación: si algo difiere de tu recuerdo del juego, cuéntalo).
- Describe lo que hiciste, lo que esperabas y lo que pasó. Si es un objeto o una casilla del mapa, di cuál.
- Anota la **versión** (arriba a la izquierda, junto a los fps) y si juegas en **local u online**.
- Después de una actualización, **recarga con Ctrl+F5**; si persiste, vacía los datos del sitio.
- Marca en F1 → «Para probar» lo que ya has probado.

---

## 10. Limitaciones conocidas de esta primera versión

### 10.1 Lo que falta por portar del original

- Ataques **críticos / super ataque**, ataque en carrera, Firebow (873) y Direction-Bow (874).
- **Reputación** (Kloness), **zonas de lucha**, **PvP** y habilidades especiales.
- Hechizos **Confusion, Inhibition y Resurrection**; algunos efectos visuales de los hechizos de tipos 19–33; teletransporte entre mapas por hechizo.
- Veneno (tipo 2), daño crítico (tipo 1) y «Righteous» como atributos de objeto; resistencias a veneno y magia.
- Menús de los NPC **Kennedy** (versión original), **William, McGaffin, Perry, Devlin** y los muñecos de práctica.
- **Elección de bando** (Aresden / Elvine) y mapas de **Elvine**; el desgaste de objetos solo funciona con bando.
- Teletransportes a mapas aún no exportados (2ndmiddle, CmdHall_1, dglv2, huntzone2, middled1n, middleland).
- Nieve y luces nocturnas de Navidad.
- Tab / Inicio / PageUp / Ctrl+A solo avisan o aún no tienen efecto completo en la simulación; los gráficos y la música están congelados (solo se portan MainTm, aresden y dungeon).
- El tinte del pelo es una aproximación.

### 10.2 Cambios deliberados respecto al original

- **[ADAPTADO]** Nivel máximo 50 (el original: 180).
- **[ADAPTADO]** Regeneración de aguante más rápida y correr más barato.
- **[ADAPTADO]** El jugador **no lanza** curar, escudos ni berserk (son del Dummy), y los hechizos elementales de ataque dependen de su summon.
- **[ADAPTADO]** Penalización por morir y postura de combate de 4 s.
- **[ADAPTADO]** Recall con canal de 3 s y enfriamiento de 60 s.
- **[ADAPTADO]** Los monstruos grandes se golpean desde 2 casillas con arco.
- Se quitó Mayús para correr (se usa Ctrl+R).

### 10.3 Online

- Un único servidor, un único proceso; sin recuperación de clave por correo.
- El chat es del mapa; sin susurros ni gremios; sin PvP.
- Los scripts de Windows y los túneles ngrok / Tailscale no se han podido probar en el entorno de desarrollo; el servidor y el protocolo sí tienen pruebas automáticas.
- Los compañeros en multijugador: solo se ve el tuyo.

### 10.4 Otros avisos

- La partida local vive en el navegador; sin sincronización entre dispositivos.
- Es una versión de pruebas: los precios de las bolas son simbólicos (1 de oro) y las herramientas de prueba están abiertas.
- La primera visita descarga bastante (~39 MB al arrancar, ~18 MB al cambiar a la ciudad); la segunda va desde la caché.

---

## 11. Resumen: qué es fiel y qué es invento

| Sistema | Origen |
|---|---|
| Fórmulas de combate, daño, acierto, vida, maná, aguante | **[FIEL]** |
| Objetos, atributos y botín (`Item.cfg`, `NpcDeadItemGenerator`) | **[FIEL]** |
| Monstruos y mapas (`NPC.cfg`, mapas originales) | **[FIEL]** |
| Magia: hechizos, costes, probabilidades | **[FIEL]** |
| Tiendas, herrero, almacén, mago | **[FIEL]** |
| Party | **[FIEL]** |
| Arco | **[FIEL]** |
| Día / noche / lluvia | **[FIEL]** |
| Teclas y ratón del cliente | **[FIEL]**, con adiciones |
| Nivel máximo 50, aguante, penalización por muerte, Recall con canal | **[ADAPTADO]** |
| Tutorial, voces, personalidad | **[INVENTO]** |
| Summons, bolas, talentos, evolución, caramelos, hospital (Gail) | **[INVENTO]** |
| Dummy y escuelas de magia | **[INVENTO]** |
| Arena de apuestas (Kennedy) | **[INVENTO]** |
| Cripta de 20 niveles, jefes, fantasmas, únicos, rareza visible | **[INVENTO]** |
| Modo online, cuentas, bots | **[INVENTO]** |
| Modo Remastered, minimapa, modo móvil, F1 novedades y herramientas | **[INVENTO]** |

Para saber más: [ESTADO.md](ESTADO.md) (estado y pendientes), [ONLINE.md](ONLINE.md) (montar el servidor), [CHANGELOG.md](CHANGELOG.md) (historial de versiones)
y las fichas por sistema en [sistemas/](sistemas/README.md).
