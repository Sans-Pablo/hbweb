# Magias — documento base de diseño

> Generado por `node tools/sim_magia.mjs` a partir de `web/data/magic.json` (Magic.cfg) y de los módulos reales del juego
> (`web/src/shared/magic.js`, `rules.js`, `systems/magicsys.js`, `schools.js`, `fields.js`, `psychic.js`). Las **tablas son calculadas**: si cambia un
> número del juego, se regenera el documento y las cifras se corrigen solas. Los textos de **lore son INVENTADOS** por el port (el original no tiene historia
> de los hechizos) y van señalados como tales; las **fórmulas** salen del servidor original (`PlayerMagicHandler`, `Effect_Damage_Spot`,
> `bCheckResistingMagicSuccess`) salvo donde se diga «invento del port».

Contenido: 1 · Visión general · 2 · Fórmulas · 3 · Catálogo por círculo (65 hechizos) · 4 · Simulaciones · 5 · Escuelas de summons · 6 · Psíquicos · 7 · Guía de equilibrio · 8 · Hallazgos y pendientes.

---

## 1. Visión general

- **65 hechizos** en 10 círculos (`circulo = floor(id/10)+1`). Los ids son autoritativos: no se renumeran ni se inventan.
- Campos de `Magic.cfg` que usa el juego: `type` (qué hace), `mana`, `v2..v12` (parámetros según el tipo), `reqInt` (Int mínima para aprender), `cost` (oro del libro; `-1` = no se vende), `category` (1 ataque, 0 utilidad, 2 mejora), `attr` (elemento) y `last` (duración en s).
- **Elementos:** Tierra (1), Rayo (2), Fuego (3), Hielo (4); 0 = sin elemento. Hoy el elemento no cambia el daño (no hay debilidades elementales de monstruos); sirve para repartir los hechizos entre **escuelas de summons** (fuego, hielo, rayo).
- **Dos modos de lanzar** en el port: (a) el modo base del original, en el que el jugador lanza con su Int/Mag/habilidad (`MAGIC_MODE.schools = false`); (b) el modo del juego actual (`schools = true`): los hechizos de ataque de fuego/hielo/rayo los lanza el **summon de la escuela** con su propio maná y nivel, y el jugador pone Mag y el oro/Int para enseñarle (ver §5). Tierra y sin elemento no tienen escuela: los lanza el jugador.
- **Tipos de efecto** (resueltos en `magicsys.js` → `resolve`):

| type | Qué hace | Hechizos |
| --- | --- | --- |
| 1 | Daño a un objetivo `dice(v4,v5)+v6` | 0, 37, 43, 56 |
| 3 / 22 | Daño al centro (v4..v6) + zona rx=v2, ry=v3 (v7..v9) | 10, 20, 30, 38, 47, 61 |
| 19 / 30 | Rayo en línea (centro v4..v6, línea y zona v7..v9) | 51, 70 |
| 21 | Zona sin centro aparte (v7..v9) | 60, 74, 81, 82 |
| 23 | Zona de hielo (v4..v6) + congelación `v10` s | 45, 57, 63, 72, 75 |
| 25 / 26 | Zona (v4..v6) · Blizzard: línea de hielo | 64, 91 · 96 (tipo 30) |
| 28 | Rompe-armaduras: daño de zona; ignora el escudo de «protección contra magia» | 66 |
| 2 | Curación `dice(v4,v5)+v6` | 1, 21 |
| 5 / 7 | Resta / recupera Stamina (SP) | 11 · 23, 28 |
| 11 | Escudos (`v4` = nivel de protección, dura `last` s) | 13, 24, 33, 44, 65 |
| 12 | Hold / Paralyze (inmoviliza) | 25, 35 |
| 13 | Invisibilidad (v4=1) / Detectar invisibles (v4=2) | 32, 34 |
| 14 | Campos en el suelo (fuego, nube, pinchos, tormenta de hielo) | 40, 41, 46, 54, 55, 73 |
| 16 | Confusión / Ilusión (solo contra jugadores) | 42, 62, 71, 80, 90 |
| 17 | Veneno (v4=1) / Curar (v4=0) | 27, 53 · 36 |
| 18 | Berserk (doble daño cuerpo a cuerpo) | 50 |
| 29 / 31 / 32 | Cancelación · Inhibición · Resurrección | 76 · 83 · 94 |
| 8 / 9 / 10 / 15 / 33 | Recall · Invocar · Crear comida · Posesión · Scan | 12 · 31 · 2 · 26 · 67 |

---

## 2. Fórmulas (la base matemática)

Todo está en `web/src/shared/magic.js` y `systems/magicsys.js`. Notación: `floor` = parte entera; `1d100` = tirada de 1 a 100; `d(n,r)` = suma de `n` dados de `r` caras.

### 2.1 ¿Sale el hechizo? (`castChance`, solo cuando lo lanza el jugador)

```
r = floor( habilidadMagia/100 * MC_PROB[círculo] )        MC_PROB = [-, 300, 250, 200, 150, 100, 80, 70, 60, 50, 40]
si Int > 50:  r += floor((Int - 50) / 2)
r = ajusteNivel(r, círculo, nivel)
r += bonoVaritas ("Special")
si r < 100: sale con probabilidad r % (tirada 1d100 <= r); r <= 0 cuenta como 1
```

`ajusteNivel` (se usa dos veces: aquí y en el acierto), con `lm = floor(nivel/10)`:
- círculo = lm → sin cambio.
- círculo > lm → `r - | v2 - floor(v1/v3 * v2) |` con `v1 = nivel - lm*10`, `v2 = |círculo-lm| * MC_PENALTY[círculo]`, `v3 = |círculo-lm| * 10` (`MC_PENALTY = [-, 5, 5, 8, 8, 10, 14, 28, 32, 36, 40]`). Es decir: lanzar un círculo por encima de tu nivel es una penalización que se **amortigua** al acercarte al siguiente tramo de 10 niveles.
- círculo < lm → `r + 5 * (lm - círculo)` (los círculos bajos se vuelven fiables al subir).

Fallo extra: con hambre ≤ 10 o SP ≤ 0, un 10 % de fallo. En modo escuelas (§5) **el jugador no tira esta probabilidad**: el summon no falla.

### 2.2 Acierto contra la resistencia (`castPower` y `resists`)

```
poder = habilidadMagia + (Mag > 50 ? Mag - 50 : 0)
poder = ajusteNivel(poder, círculo, nivel) + addAR                       (addAR: bono de equipo "acierto")
rr    = resistencia del objetivo (mínimo 1)
         monstruo: cfg.resistMagic
         jugador : habilidad[3] + addMR + (Mag > 50 ? Mag - 50 : 0)
dest  = floor( poder / rr * 50 ) , acotado a [15, 99]                    (MIN_HIT, MAX_HIT)
el objetivo RESISTE si 1d100 > dest        → P(impacto) = dest / 100
```

Consecuencias: con `poder = 2·rr` ya impactas al máximo (99 %); con `poder = rr/3` estás en el suelo (15 %). **Un 1 % de resistencia siempre queda** (el tope es 99).
Notas: los hechizos con `id >= 80` y el tipo 28 suman +10000 al poder — pero `resist()` lo vuelve a restar: **no son irresistibles**, lo único que logran es saltarse el auto-resistir del escudo «Protección contra magia» (`protect 2`). `protect 5` (Absolute Magic Protection) resiste todo.

### 2.3 Daño (`spellDamage`, `hurt`)

```
base   = d(n, caras) + k                       (n,caras,k = v4,v5,v6 para el centro; v7,v8,v9 para la zona)
daño   = floor( base + base * (Mag/3.3)/100 + 0.5 ) + addMagic                 ≈ base * (1 + Mag/330)
si va por escuela: daño = floor(daño * factorSpell * (tier2 ? 1.25 : 1) * levelPower(nivel del summon))
monstruo con absDamage%: daño = floor(daño - daño * absDamage/100)  (si queda < 0, vale 1)
protect 2 (Protección contra magia): daño / 2
```

Cada casilla del área es una tirada **independiente** de resistencia y de dados. Los golpes de zona dan la mitad de experiencia (`half`) al que mata. No dañan a tus summons ni a los de tu grupo.

### 2.4 Maná, tiempos y límites

- `maná = mana de Magic.cfg`, reducido por `manaSave` % (mínimo 1) y **+20 con varita de tipo 34**.
- Reserva del jugador: `maxMP = 2·Mag + 2·nivel + floor(Int/2)`.
- Animación de lanzar: 16 fotogramas × 40 ms = **640 ms**; el servidor exige **1000 ms** entre lanzamientos → máximo **1 lanzamiento/s**. Alcance 14 casillas. Los hechizos de ataque no funcionan en zona segura; lanzar rompe la invisibilidad; el inhibido no puede lanzar.
- Sin escuelas: no se puede lanzar con escudo ni arma a dos manos, y la mano derecha debe estar libre o llevar varita (wtype 34–39).

### 2.5 Campos (`fields.js`, tic cada 1 s)

| Campo | Daño por tic a quien está dentro | Extra |
| --- | --- | --- |
| Fuego (1) | 1d6 | — |
| Tormenta de hielo (8) | 3d3+5 (media 11) | congela 20 s (salvo resistencia al hielo) |
| Nube venenosa (10) | 1d6 si `v1<20`, 1d8 si no | jugadores: 50 % de envenenar (`1d(nivel)` cada 12 s) |
| Pinchos (9) | solo se dibuja | — |

El daño de los campos es **fijo y no escala con la Magia** (no pasa por `spellDamage`) y **cada casilla del campo golpea por separado en radio** (fuego/nube radio 1, hielo radio 2): ver el hallazgo de solapes en §8.

Veneno: `1d(nivel)` de vida cada 12 s; probabilidad de curarse por tic `habilidad[23] - 10 + addPR` (mínimo 10 %). Resistencia al hielo del monstruo: `max(1, resistMagic - floor(resistMagic/3))` %; del jugador: `addAbsWater·2` %.

### 2.6 Experiencia de magia (SSN)
Cada lanzamiento sube la habilidad de Magia (`gainSSN`, cuatro intentos por lanzamiento). Más habilidad ⇒ más poder y más probabilidad de salir; es el motor de progresión de un mago «puro».

---

## 3. Catálogo por círculo

Cada ficha trae: datos del cfg, qué hace en el port, **lore inventado** y la valoración de equilibrio (si es de daño). Convención: `n×d+k` = `d(n,d)+k`. «Zona» = lado del cuadrado afectado (`(2·rx+1)×(2·ry+1)`). Los daños se muestran **sin** bono de Magia (la columna de simulación los escala).

### Primer círculo — Las Chispas

*Lore (inventado):* Lo que se enseña a los niños con talento en las aldeas: encender una vela, cerrar un rasguño, hacer pan de la nada. Nadie los llama «magia» en voz alta.

#### 0 · Magic Missile  `type 1` · ataque · Rayo
- maná **8** · Int mín. 18 · libro 100 oro · centro 1d8+0 (media 4.5)
- Un objetivo (Mag 100): **5.9** · por maná **0.7** (mediana de ataque 0.7)
- **Efecto:** Proyectil mágico de un solo objetivo.
- *Lore (inventado):* La primera chispa que un aprendiz logra disparar; en las aldeas lo llaman «el dedo de luz».

#### 1 · Heal  `type 2` · utilidad · Hielo
- maná **15** · Int mín. 20 · libro 100 oro
- **Efecto:** Cura al objetivo `1d6+10`.
- *Lore (inventado):* Remedio de las comadronas: se pronuncia con la mano abierta sobre la herida.

#### 2 · Create Food  `type 10` · utilidad · —
- maná **18** · Int mín. 18 · libro 100 oro
- **Efecto:** Crea comida en el inventario.
- *Lore (inventado):* Los monjes del Valle lo inventaron en un invierno sin cosecha. Nadie preguntó de dónde sale el pan.

### Segundo círculo — Las Brasas

*Lore (inventado):* Las academias de las ciudades piden aquí el primer juramento: el mago ya no juega, escoge un elemento y aprende su precio en maná.

#### 10 · Energy Bolt  `type 3` · ataque · Rayo
- maná **15** · Int mín. 24 · libro 200 oro · centro 2d4+1 (media 6) · zona 5×5 · 2d4+1 (media 6)
- Un objetivo (Mag 100): **15.6** · por maná **1** (mediana de ataque 0.7)
- **Efecto:** Daño al centro y a una zona pequeña.
- *Lore (inventado):* Una esfera de energía pura que explota al contacto; el examen de los novicios de Aresden.

#### 11 · Staminar Drain  `type 5` · ataque · —
- maná **14** · Int mín. 22 · libro 200 oro
- **Efecto:** Resta Stamina al objetivo.
- *Lore (inventado):* Un hechizo cruel: no hiere, agota. El rival tropieza como tras una larga marcha.

#### 12 · Recall  `type 8` · utilidad · —
- maná **15** · Int mín. 20 · libro 120 oro
- **Efecto:** Teletransporta al jugador a su ciudad.
- *Lore (inventado):* Rasgar el aire y volver a casa. Los viajeros lo pagan caro en las posadas.

#### 13 · Defense Shield  `type 11` · mejora · —
- maná **19** · Int mín. 26 · libro 200 oro · dura 60 s
- **Efecto:** Escudo ligero de protección física temporal.
- *Lore (inventado):* Un velo de luz tenue que desvía el primer golpe.

#### 14 · Celebrating Light  `type 5` · utilidad · —
- maná **20** · Int mín. 25 · libro 400 oro
- **Efecto:** Efecto visual/campo ligero.
- *Lore (inventado):* Luz festiva que los clérigos encienden en las bodas; no daña, pero marca el terreno.

### Tercer círculo — El Juramento

*Lore (inventado):* La frontera entre el aprendiz y el oficio. Los magos de campaña suelen detenerse aquí toda la vida: cubre lo que hace falta para sobrevivir y cobrar.

#### 20 · Fire Ball  `type 3` · ataque · Fuego
- maná **27** · Int mín. 26 · libro 500 oro · centro 2d6+2 (media 9) · zona 5×5 · 2d6+2 (media 9)
- Un objetivo (Mag 100): **23.5** · por maná **0.9** (mediana de ataque 0.7)
- **Efecto:** Daño al centro y zona; elemento fuego.
- *Lore (inventado):* La bola de fuego clásica, favorita de los magos de caravana.

#### 21 · Great Heal  `type 2` · utilidad · —
- maná **28** · Int mín. 28 · libro 500 oro
- **Efecto:** Cura al objetivo `4d10+20`.
- *Lore (inventado):* Plegaria de los sanadores de Elvine, solo se enseña tras años de servicio.

#### 23 · Staminar Recovery  `type 7` · utilidad · —
- maná **20** · Int mín. 20 · libro 300 oro
- **Efecto:** Recupera Stamina.
- *Lore (inventado):* Respiración profunda hecha hechizo: devuelve el aliento a quien corre.

#### 24 · Protection From Arrow  `type 11` · mejora · —
- maná **22** · Int mín. 20 · libro 300 oro · dura 60 s
- **Efecto:** Escudo contra proyectiles.
- *Lore (inventado):* Una ráfaga contraria desvía las flechas antes de que lleguen.

#### 25 · Hold Person  `type 12` · ataque · —
- maná **24** · Int mín. 26 · libro 500 oro · dura 30 s
- **Efecto:** Inmoviliza al objetivo unos segundos.
- *Lore (inventado):* Enseñado por los carceleros: las piernas dejan de obedecer.

#### 26 · Possession  `type 15` · ataque · —
- maná **25** · Int mín. 26 · libro 500 oro
- **Efecto:** Posesión (control temporal).
- *Lore (inventado):* Prohibido en tres reinos. El mago toma prestado el cuerpo de otro.

#### 27 · Poison  `type 17` · ataque · Tierra
- maná **28** · Int mín. 29 · libro 700 oro · veneno nivel 15
- **Efecto:** Envenena a un jugador (nivel 15).
- *Lore (inventado):* Un susurro en la sangre; barato y de efecto lento.

#### 28 · Great Staminar Recov.  `type 7` · utilidad · —
- maná **45** · Int mín. 30 · libro 800 oro
- **Efecto:** Recupera mucha Stamina.
- *Lore (inventado):* La versión de campaña: un trago de aire frío que cura el cansancio.

### Cuarto círculo — La Marea

*Lore (inventado):* Los hechizos de la marea cambian el terreno: campos, muros y escudos. Un buen mago de este nivel hace que el combate ocurra donde él quiere.

#### 30 · Fire Strike  `type 3` · ataque · Fuego
- maná **36** · Int mín. 34 · libro 1000 oro · centro 2d8+3 (media 12) · zona 5×5 · 2d8+3 (media 12)
- Un objetivo (Mag 100): **31.3** · por maná **0.9** (mediana de ataque 0.7)
- **Efecto:** Daño de fuego en zona, mayor que Fire Ball.
- *Lore (inventado):* La bola de fuego ya no basta: el mago deja caer el sol sobre un punto.

#### 31 · Summon Creature  `type 9` · ataque · Tierra
- maná **35** · Int mín. 38 · libro 1000 oro
- **Efecto:** Invoca una criatura aliada.
- *Lore (inventado):* Se llama a un ser de otro plano; obedece mientras el mago mantiene el nombre.

#### 32 · Invisibility  `type 13` · ataque · —
- maná **31** · Int mín. 30 · libro 800 oro · dura 60 s
- **Efecto:** Invisibilidad temporal; se rompe al atacar/lanzar.
- *Lore (inventado):* La luz se dobla alrededor del lanzador.

#### 33 · Protection From Magic  `type 11` · mejora · —
- maná **35** · Int mín. 32 · libro 850 oro · dura 60 s
- **Efecto:** Reduce a la mitad el daño mágico recibido.
- *Lore (inventado):* El primer escudo contra la propia magia: media fuerza para el hechizo enemigo.

#### 34 · Detect Invisibility  `type 13` · utilidad · —
- maná **33** · Int mín. 30 · libro 700 oro
- **Efecto:** Revela a los invisibles cercanos.
- *Lore (inventado):* Los guardias de las murallas lo usan por la noche.

#### 35 · Paralyze  `type 12` · ataque · —
- maná **35** · Int mín. 36 · libro 1000 oro · dura 50 s
- **Efecto:** Inmoviliza más tiempo.
- *Lore (inventado):* La versión «mayor» de Hold: el cuerpo se queda como piedra.

#### 36 · Cure  `type 17` · utilidad · Tierra
- maná **32** · Int mín. 35 · libro 700 oro
- **Efecto:** Cura el veneno.
- *Lore (inventado):* La antítoxina de las boticas.

#### 37 · Lightning Arrow  `type 1` · ataque · Rayo
- maná **32** · Int mín. 38 · libro 1100 oro · centro 4d5+10 (media 22)
- Un objetivo (Mag 100): **28.7** · por maná **0.9** (mediana de ataque 0.7)
- **Efecto:** Daño de rayo a un objetivo.
- *Lore (inventado):* Cada flecha es un relámpago; un solo objetivo, mucha precisión.

#### 38 · Tremor  `type 22` · ataque · Tierra
- maná **34** · Int mín. 33 · libro 1000 oro · centro 3d4+3 (media 10.5) · zona 5×5 · 3d4+3 (media 10.5)
- Un objetivo (Mag 100): **27.4** · por maná **0.8** (mediana de ataque 0.7)
- **Efecto:** Daño de tierra en zona.
- *Lore (inventado):* El suelo tiembla a los pies del enemigo.

### Quinto círculo — El Velo

*Lore (inventado):* Veneno, furia y velos. Es el círculo de los que ganan sin que se note: debilitan, confunden y esperan.

#### 40 · Fire Wall  `type 14` · ataque · Fuego
- maná **42** · Int mín. 45 · libro 1200 oro · dura 30 s
- **Efecto:** Campo de fuego lineal; daña cada segundo.
- *Lore (inventado):* Una pared de llamas que corta el paso.

#### 41 · Fire Field  `type 14` · ataque · Fuego
- maná **48** · Int mín. 48 · libro 1400 oro · dura 30 s
- **Efecto:** Campo de fuego en cuadrado; daña cada segundo.
- *Lore (inventado):* Más ancho que el muro: fuego en el suelo en un cuadrado.

#### 42 · Confuse Language  `type 16` · ataque · —
- maná **40** · Int mín. 42 · libro 1300 oro · dura 120 s
- **Efecto:** Confunde a un jugador.
- *Lore (inventado):* Palabras que se enredan en la lengua del otro.

#### 43 · Lightning  `type 1` · ataque · Rayo
- maná **44** · Int mín. 47 · libro 1700 oro · centro 4d7+12 (media 28)
- Un objetivo (Mag 100): **36.5** · por maná **0.8** (mediana de ataque 0.7)
- **Efecto:** Daño de rayo a un objetivo.
- *Lore (inventado):* El rayo puro del tercer círculo; muy fiable.

#### 44 · Great Defense Shield  `type 11` · mejora · —
- maná **45** · Int mín. 46 · libro 1500 oro · dura 40 s
- **Efecto:** Protección física alta, temporal.
- *Lore (inventado):* Un escudo mayor, con la fuerza de un muro.

#### 45 · Chill Wind  `type 23` · ataque · Hielo
- maná **48** · Int mín. 50 · libro 2000 oro · zona 5×5 · 2d8+3 (media 12) · congela 5 s
- Un objetivo (Mag 100): **15.6** · por maná **0.3** (mediana de ataque 0.7) · **ineficiente** (−)
- **Efecto:** Daño de hielo y congela unos segundos.
- *Lore (inventado):* El aire se vuelve cuchillo helado.

#### 46 · Poison Cloud  `type 14` · ataque · Tierra
- maná **48** · Int mín. 49 · libro 1800 oro · dura 30 s
- **Efecto:** Campo de veneno en cuadrado.
- *Lore (inventado):* Una niebla verde que los alquimistas llaman «aliento del pantano».

#### 47 · Triple Energy Bolt  `type 3` · ataque · Rayo
- maná **40** · Int mín. 45 · libro 1700 oro · centro 2d4+2 (media 7) · zona 5×5 · 3d8+3 (media 16.5)
- Un objetivo (Mag 100): **30.6** · por maná **0.8** (mediana de ataque 0.7)
- **Efecto:** Daño al centro y zona; ráfaga de energía.
- *Lore (inventado):* Tres bolas de energía en fila.

### Sexto círculo — La Tormenta

*Lore (inventado):* Aquí la magia deja de pedir permiso. Rayos, tormentas y hielo que cae del cielo; las academias exigen testigos antes de enseñarlos.

#### 50 · Berserk  `type 18` · ataque · —
- maná **57** · Int mín. 59 · libro 2200 oro · dura 40 s
- **Efecto:** Berserk: aumenta el daño cuerpo a cuerpo.
- *Lore (inventado):* Los guerreros lo piden a los magos antes de las batallas.

#### 51 · Lightning Bolt  `type 19` · ataque · Rayo
- maná **58** · Int mín. 58 · libro 2500 oro · centro 4d5+18 (media 30) · zona 5×5 · 4d2+6 (media 12) · línea de impacto
- Un objetivo (Mag 100): **54.7** · por maná **0.9** (mediana de ataque 0.7)
- **Efecto:** Rayo en línea con daño a lo largo del trayecto.
- *Lore (inventado):* Un rayo que perfora la fila entera.

#### 53 · Mass Poison  `type 17` · ataque · Tierra
- maná **54** · Int mín. 52 · libro 2100 oro · veneno nivel 40
- **Efecto:** Envenena en zona (nivel 40).
- *Lore (inventado):* Veneno para grupos; nadie lo enseña en voz alta.

#### 54 · Spike Field  `type 14` · ataque · Tierra
- maná **56** · Int mín. 56 · libro 2300 oro · dura 30 s
- **Efecto:** Campo que solo se dibuja (sin daño en el cfg).
- *Lore (inventado):* Campo de pinchos en el suelo.

#### 55 · Ice Storm  `type 14` · ataque · Hielo
- maná **58** · Int mín. 59 · no se vende · dura 30 s
- **Efecto:** Campo de hielo: daño y congelación.
- *Lore (inventado):* Una tormenta helada que cae sobre un punto.

#### 56 · Mass Lightning Arrow  `type 1` · ataque · Rayo
- maná **55** · Int mín. 53 · libro 3000 oro · centro 5d6+20 (media 37.5)
- Un objetivo (Mag 100): **48.9** · por maná **0.9** (mediana de ataque 0.7)
- **Efecto:** Daño de rayo a un objetivo, mayor.
- *Lore (inventado):* La flecha rayo multiplicada.

#### 57 · Ice Strike  `type 23` · ataque · Hielo
- maná **59** · Int mín. 60 · libro 4200 oro · zona 5×5 · 5d6+12 (media 29.5) · congela 4 s
- Un objetivo (Mag 100): **38.4** · por maná **0.7** (mediana de ataque 0.7)
- **Efecto:** Daño de hielo en zona + congelación.
- *Lore (inventado):* Estaca de hielo desde el cielo.

### Séptimo círculo — El Eclipse

*Lore (inventado):* Los hechizos del eclipse dañan a muchos a la vez y vacían la reserva de maná de quien los lanza. Se dice que cada uno cuesta un año de vida.

#### 60 · Energy Strike  `type 21` · ataque · Rayo
- maná **65** · Int mín. 67 · libro 5000 oro · zona 5×5 · 7d6+17 (media 41.5)
- Un objetivo (Mag 100): **54.1** · por maná **0.8** (mediana de ataque 0.7)
- **Efecto:** Daño en zona sin centro.
- *Lore (inventado):* Energía pura sin forma: el mago se limita a soltarla.

#### 61 · Mass Fire Strike  `type 3` · ataque · Fuego
- maná **80** · Int mín. 85 · no se vende · centro 5d6+12 (media 29.5) · zona 5×7 · 7d10+18 (media 56.5)
- Un objetivo (Mag 100): **112.1** · por maná **1.4** (mediana de ataque 0.7) · **eficiente** (+)
- **Efecto:** Daño de fuego en zona grande.
- *Lore (inventado):* Fire Strike para muchos: la lluvia de fuego.

#### 62 · Confusion  `type 16` · ataque · —
- maná **78** · Int mín. 75 · libro 7500 oro · dura 20 s
- **Efecto:** Confusión a un jugador.
- *Lore (inventado):* Un desorden mental más profundo que su versión menor.

#### 63 · Mass Chill Wind  `type 23` · ataque · Hielo
- maná **90** · Int mín. 93 · libro 9800 oro · zona 5×5 · 3d8+6 (media 19.5) · congela 10 s
- Un objetivo (Mag 100): **25.4** · por maná **0.3** (mediana de ataque 0.7) · **ineficiente** (−)
- **Efecto:** Hielo en zona + congelación larga.
- *Lore (inventado):* El viento helado cubre un campo.

#### 64 · Earthworm Strike  `type 25` · ataque · Tierra
- maná **80** · Int mín. 97 · libro 12000 oro · zona 5×5 · 7d6+17 (media 41.5)
- Un objetivo (Mag 100): **54.1** · por maná **0.7** (mediana de ataque 0.7)
- **Efecto:** Daño de tierra en zona.
- *Lore (inventado):* El gusano de la tierra emerge y arrasa.

#### 65 · Absolute Magic Protect.  `type 11` · mejora · —
- maná **90** · Int mín. 112 · libro 13500 oro · dura 60 s
- **Efecto:** Protege de toda magia (protect 5).
- *Lore (inventado):* El escudo definitivo contra la magia.

#### 66 · Armor Break  `type 28` · ataque · Tierra
- maná **90** · Int mín. 97 · libro 20000 oro · zona 3×3 · 7d6+17 (media 41.5)
- Un objetivo (Mag 100): **54.1** · por maná **0.6** (mediana de ataque 0.7)
- **Efecto:** Daño de zona; ignora protect 2.
- *Lore (inventado):* Una ola que parte armaduras; se salta el escudo de magia.

#### 67 · Scan  `type 33` · ataque · Tierra
- maná **50** · Int mín. 70 · libro 7500 oro
- **Efecto:** Muestra el entorno cercano.
- *Lore (inventado):* Una mirada que atraviesa muros.

### Octavo círculo — La Ruptura

*Lore (inventado):* Romper armaduras, cancelar lo ya hecho, ver lo oculto. El octavo círculo no crea: deshace.

#### 70 · Bloody Shock Wave  `type 19` · ataque · Rayo
- maná **120** · Int mín. 105 · no se vende · centro 5d8+20 (media 42.5) · zona 5×5 · 5d4+9 (media 21.5) · línea de impacto
- Un objetivo (Mag 100): **83.4** · por maná **0.7** (mediana de ataque 0.7)
- **Efecto:** Rayo en línea con zona; elevado.
- *Lore (inventado):* Una descarga de choque brutal.

#### 71 · Mass Confusion  `type 16` · ataque · —
- maná **125** · Int mín. 130 · libro 15000 oro · dura 60 s
- **Efecto:** Confunde a varios jugadores.
- *Lore (inventado):* Confusión en masa.

#### 72 · Mass Ice Strike  `type 23` · ataque · Hielo
- maná **120** · Int mín. 133 · libro 21000 oro · zona 5×5 · 7d8+25 (media 56.5) · congela 7 s
- Un objetivo (Mag 100): **73.6** · por maná **0.6** (mediana de ataque 0.7)
- **Efecto:** Hielo en zona + congelación.
- *Lore (inventado):* Estacas de hielo para el ejército.

#### 73 · Cloud Kill  `type 14` · ataque · Tierra
- maná **130** · Int mín. 120 · libro 20000 oro · dura 30 s
- **Efecto:** Campo de veneno grande (5×5).
- *Lore (inventado):* Una niebla que mata despacio.

#### 74 · Lightning Strike  `type 21` · ataque · Rayo
- maná **90** · Int mín. 123 · libro 35000 oro · zona 5×5 · 7d7+20 (media 48)
- Un objetivo (Mag 100): **62.5** · por maná **0.7** (mediana de ataque 0.7)
- **Efecto:** Daño de rayo en zona.
- *Lore (inventado):* El rayo cae sobre el punto marcado.

#### 75 · Ice Whirlwind  `type 23` · ataque · Hielo
- maná **120** · Int mín. 201 · no se vende · congela 2 s
- **Efecto:** Hielo en zona + congelación breve.
- *Lore (inventado):* Un torbellino helado.

#### 76 · Cancellation  `type 29` · ataque · —
- maná **120** · Int mín. 135 · no se vende · dura 30 s
- **Efecto:** Quita invis, hielo, hold, protect, berserk, confusión.
- *Lore (inventado):* El mago deshace lo que otro hizo.

#### 77 · Illusion Movement  `type 21` · ataque · Rayo
- maná **130** · Int mín. 160 · libro 27000 oro · zona 5×5 · 7d7+20 (media 48)
- Un objetivo (Mag 100): **62.5** · por maná **0.5** (mediana de ataque 0.7)
- **Efecto:** Desorienta; sin daño en el port (efecto del psíquico).
- *Lore (inventado):* El enemigo cree que el suelo se desplaza.

### Noveno círculo — La Cumbre

*Lore (inventado):* Los que llegan aquí ya no estudian: dirigen. El noveno círculo se lanza con el nombre del mago y el poder de quien lo escucha.

#### 80 · Illusion  `type 16` · ataque · —
- maná **143** · Int mín. 150 · libro 27000 oro · dura 20 s
- **Efecto:** Ilusión a un jugador.
- *Lore (inventado):* Una visión falsa que se mete en la cabeza.

#### 81 · Meteor Strike  `type 21` · ataque · Fuego
- maná **120** · Int mín. 169 · libro 40000 oro · zona 5×5 · 7d12+18 (media 63.5)
- Un objetivo (Mag 100): **82.7** · por maná **0.7** (mediana de ataque 0.7)
- **Efecto:** Daño de fuego en zona amplia.
- *Lore (inventado):* Un meteorito cae del cielo; solo lo ven quienes viven hasta ver el humo.

#### 82 · Mass Magic Missile  `type 21` · ataque · Rayo
- maná **160** · Int mín. 185 · libro 45000 oro · zona 7×7 · 7d7+30 (media 58)
- Un objetivo (Mag 100): **75.6** · por maná **0.5** (mediana de ataque 0.7)
- **Efecto:** Daño en zona enorme.
- *Lore (inventado):* Cientos de misiles en lluvia.

#### 83 · Inhibition Casting  `type 31` · utilidad · —
- maná **180** · Int mín. 180 · no se vende
- **Efecto:** Impide lanzar hechizos.
- *Lore (inventado):* El enemigo olvida cómo se pronuncian los hechizos.

### Décimo círculo — Lo Innombrable

*Lore (inventado):* Se enseña una vez, a una sola persona, y no se escribe. Los pocos que lo conocen prefieren no ser preguntados.

#### 90 · Mass Illusion  `type 16` · ataque · —
- maná **200** · Int mín. 180 · libro 35000 oro · dura 60 s
- **Efecto:** Ilusión en masa.
- *Lore (inventado):* La ilusión llega al ejército entero.

#### 91 · Blizzard  `type 26` · ataque · Hielo
- maná **170** · Int mín. 195 · libro 43000 oro · dura 20 s · centro 5d1+20 (media 25) · zona 7×7 · 7d8+16 (media 47.5) · línea de impacto · congela 2 s
- Un objetivo (Mag 100): **94.5** · por maná **0.6** (mediana de ataque 0.7)
- **Efecto:** Hielo en línea y zona + congelación + campo.
- *Lore (inventado):* La tormenta de nieve que borra el mundo.

#### 94 · Resurrection  `type 32` · ataque · Rayo
- maná **200** · Int mín. 0 · no se vende · retardo 600
- **Efecto:** Revive a un jugador caído.
- *Lore (inventado):* Un milagro que el clero no confiesa.

#### 95 · Mass Illusion Movement  `type 21` · ataque · Rayo
- maná **200** · Int mín. 200 · libro 27000 oro · zona 5×5 · 7d7+20 (media 48)
- Un objetivo (Mag 100): **62.5** · por maná **0.3** (mediana de ataque 0.7) · **ineficiente** (−)
- **Efecto:** Desorienta a varios.
- *Lore (inventado):* Mismo hechizo que Illusion Movement, a escala de grupo.

#### 96 · Earth Shock Wave  `type 30` · ataque · Tierra
- maná **180** · Int mín. 200 · no se vende · centro 5d1+20 (media 25) · zona 5×5 · 7d8+16 (media 47.5) · línea de impacto
- Un objetivo (Mag 100): **94.5** · por maná **0.5** (mediana de ataque 0.7)
- **Efecto:** Daño de tierra en línea y zona.
- *Lore (inventado):* La onda de choque definitiva de la tierra.

---

## 4. Simulaciones de daño

Perfiles de lanzador usados (se aplican las funciones reales `castChance` / `castPower` / `manaCost`):

- **A · novato (nv 20, Mag 60, Int 60, habilidad 40)** — reserva de maná 190.
- **B · veterano (nv 50, Mag 120, Int 120, habilidad 80)** — reserva de maná 400.
- **C · archimago (nv 50, Mag 200, Int 200, habilidad 100)** — reserva de maná 600.

### 4.1 Daño, zona y eficiencia de todos los hechizos de ataque

`dmg1` = un objetivo situado en el centro (centro + zona; Mag 100). `dmg5` = 5 objetivos dentro de la zona (el primero recibe todo, los otros 4 solo la zona). `/maná` = daño por punto de maná. `/s` = daño por segundo sostenido a 1 lanzamiento/s. `bar` = daño total con la reserva completa del perfil B.

| id | hechizo | círc | elem | maná | centro | zona | área | dmg1 | dmg5 | /maná (1) | /maná (5) | /s | bar B |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Magic Missile | 1 | Rayo | 8 | 4.5 | — | 1 | 5.9 | 5.9 | 0.7 | 0.7 | 5.9 | 293 |
| 10 | Energy Bolt | 2 | Rayo | 15 | 6 | 6 | 5×5 | 15.6 | 46.9 | 1 | 3.1 | 15.6 | 407 |
| 20 | Fire Ball | 3 | Fuego | 27 | 9 | 9 | 5×5 | 23.5 | 70.4 | 0.9 | 2.6 | 23.5 | 328 |
| 30 | Fire Strike | 4 | Fuego | 36 | 12 | 12 | 5×5 | 31.3 | 93.8 | 0.9 | 2.6 | 31.3 | 344 |
| 37 | Lightning Arrow | 4 | Rayo | 32 | 22 | — | 1 | 28.7 | 28.7 | 0.9 | 0.9 | 28.7 | 344 |
| 38 | Tremor | 4 | Tierra | 34 | 10.5 | 10.5 | 5×5 | 27.4 | 82.1 | 0.8 | 2.4 | 27.4 | 301 |
| 43 | Lightning | 5 | Rayo | 44 | 28 | — | 1 | 36.5 | 36.5 | 0.8 | 0.8 | 36.5 | 328 |
| 45 | Chill Wind | 5 | Hielo | 48 | — | 12 | 5×5 | 15.6 | 78.2 | 0.3 | 1.6 | 15.6 | 125 |
| 47 | Triple Energy Bolt | 5 | Rayo | 40 | 7 | 16.5 | 5×5 | 30.6 | 116.6 | 0.8 | 2.9 | 30.6 | 306 |
| 51 | Lightning Bolt | 6 | Rayo | 58 | 30 | 12 | 5×5 | 54.7 | 117.3 | 0.9 | 2 | 54.7 | 328 |
| 56 | Mass Lightning Arrow | 6 | Rayo | 55 | 37.5 | — | 1 | 48.9 | 48.9 | 0.9 | 0.9 | 48.9 | 342 |
| 57 | Ice Strike | 6 | Hielo | 59 | — | 29.5 | 5×5 | 38.4 | 192.2 | 0.7 | 3.3 | 38.4 | 231 |
| 60 | Energy Strike | 7 | Rayo | 65 | — | 41.5 | 5×5 | 54.1 | 270.4 | 0.8 | 4.2 | 54.1 | 324 |
| 61 | Mass Fire Strike | 7 | Fuego | 80 | 29.5 | 56.5 | 5×7 | 112.1 | 406.5 | 1.4 | 5.1 | 112.1 | 560 |
| 63 | Mass Chill Wind | 7 | Hielo | 90 | — | 19.5 | 5×5 | 25.4 | 127 | 0.3 | 1.4 | 25.4 | 102 |
| 64 | Earthworm Strike | 7 | Tierra | 80 | — | 41.5 | 5×5 | 54.1 | 270.4 | 0.7 | 3.4 | 54.1 | 270 |
| 66 | Armor Break | 7 | Tierra | 90 | — | 41.5 | 3×3 | 54.1 | 270.4 | 0.6 | 3 | 54.1 | 216 |
| 70 | Bloody Shock Wave | 8 | Rayo | 120 | 42.5 | 21.5 | 5×5 | 83.4 | 195.5 | 0.7 | 1.6 | 83.4 | 250 |
| 72 | Mass Ice Strike | 8 | Hielo | 120 | — | 56.5 | 5×5 | 73.6 | 368.1 | 0.6 | 3.1 | 73.6 | 221 |
| 74 | Lightning Strike | 8 | Rayo | 90 | — | 48 | 5×5 | 62.5 | 312.7 | 0.7 | 3.5 | 62.5 | 250 |
| 77 | Illusion Movement | 8 | Rayo | 130 | — | 48 | 5×5 | 62.5 | 312.7 | 0.5 | 2.4 | 62.5 | 188 |
| 81 | Meteor Strike | 9 | Fuego | 120 | — | 63.5 | 5×5 | 82.7 | 413.7 | 0.7 | 3.4 | 82.7 | 248 |
| 82 | Mass Magic Missile | 9 | Rayo | 160 | — | 58 | 7×7 | 75.6 | 377.9 | 0.5 | 2.4 | 75.6 | 151 |
| 91 | Blizzard | 10 | Hielo | 170 | 25 | 47.5 | 7×7 | 94.5 | 342 | 0.6 | 2 | 94.5 | 189 |
| 95 | Mass Illusion Movement | 10 | Rayo | 200 | — | 48 | 5×5 | 62.5 | 312.7 | 0.3 | 1.6 | 62.5 | 125 |
| 96 | Earth Shock Wave | 10 | Tierra | 180 | 25 | 47.5 | 5×5 | 94.5 | 342 | 0.5 | 1.9 | 94.5 | 189 |

Lectura: el daño crece con el círculo, pero **no de forma proporcional al maná**: los hechizos de un solo objetivo de los primeros círculos tienen la mejor relación daño/maná (Magic Missile, Lightning Arrow), mientras que los de círculos altos compensan con zona. El coste por zona es lineal en celdas, así que contra grupos los de 5×5+ ganan.

### 4.2 Probabilidad de impacto por círculo (hechizo lanzado por el jugador)

`P(impacto) = clamp(floor(poder/rr·50), 15, 99) %`. El poder baja al subir el círculo si el nivel no acompaña (§2.2). Filas = círculo del hechizo; columnas = resistencia mágica del objetivo (5 ≈ Slime/Dummy, 25 Orc, 50 Stone-Golem, 70 Ogre/Cannibal-Plant, 100 Demon/Unicorn/Hellclaw).

**Perfil A · novato (nv 20, Mag 60, Int 60, habilidad 40)**

| círc | poder | rr 5 | rr 25 | rr 50 | rr 70 | rr 100 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 55 | 99% | 99% | 55% | 39% | 27% |
| 2 | 50 | 99% | 99% | 50% | 35% | 25% |
| 3 | 42 | 99% | 84% | 42% | 30% | 21% |
| 4 | 34 | 99% | 68% | 34% | 24% | 17% |
| 5 | 20 | 99% | 40% | 20% | 15% | 15% |
| 6 | 1 | 15% | 15% | 15% | 15% | 15% |
| 7 | 1 | 15% | 15% | 15% | 15% | 15% |
| 8 | 1 | 15% | 15% | 15% | 15% | 15% |
| 9 | 1 | 15% | 15% | 15% | 15% | 15% |
| 10 | 1 | 15% | 15% | 15% | 15% | 15% |

**Perfil B · veterano (nv 50, Mag 120, Int 120, habilidad 80)**

| círc | poder | rr 5 | rr 25 | rr 50 | rr 70 | rr 100 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 170 | 99% | 99% | 99% | 99% | 85% |
| 2 | 165 | 99% | 99% | 99% | 99% | 82% |
| 3 | 160 | 99% | 99% | 99% | 99% | 80% |
| 4 | 155 | 99% | 99% | 99% | 99% | 77% |
| 5 | 150 | 99% | 99% | 99% | 99% | 75% |
| 6 | 136 | 99% | 99% | 99% | 97% | 68% |
| 7 | 94 | 99% | 99% | 94% | 67% | 47% |
| 8 | 54 | 99% | 99% | 54% | 38% | 27% |
| 9 | 6 | 60% | 15% | 15% | 15% | 15% |
| 10 | 1 | 15% | 15% | 15% | 15% | 15% |

**Perfil C · archimago (nv 50, Mag 200, Int 200, habilidad 100)**

| círc | poder | rr 5 | rr 25 | rr 50 | rr 70 | rr 100 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 270 | 99% | 99% | 99% | 99% | 99% |
| 2 | 265 | 99% | 99% | 99% | 99% | 99% |
| 3 | 260 | 99% | 99% | 99% | 99% | 99% |
| 4 | 255 | 99% | 99% | 99% | 99% | 99% |
| 5 | 250 | 99% | 99% | 99% | 99% | 99% |
| 6 | 236 | 99% | 99% | 99% | 99% | 99% |
| 7 | 194 | 99% | 99% | 99% | 99% | 97% |
| 8 | 154 | 99% | 99% | 99% | 99% | 77% |
| 9 | 106 | 99% | 99% | 99% | 75% | 53% |
| 10 | 50 | 99% | 99% | 50% | 35% | 25% |

Lectura: el círculo 9–10 con un archimago nivel 50 pierde casi todo el poder por el ajuste de nivel (`castPower` baja >100 puntos): el diseño del original asume jugadores nivel 100+ para esos hechizos. En el port (nivel máximo 50 en el acto 1) los círculos 8–10 solo son viables **vía escuelas** (§5), donde el summon aporta su propio poder.

### 4.3 Probabilidad de que el hechizo salga (castChance)

Perfil B (veterano) por círculo y nivel de personaje; Int 120, habilidad 80. Valores ≥ 100 % salen siempre.

| círc | nv 10 | nv 20 | nv 30 | nv 40 | nv 50 | nv 70 | nv 100 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| 2 | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| 3 | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| 4 | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| 5 | 75% | 85% | 95% | 100% | 100% | 100% | 100% |
| 6 | 29% | 43% | 57% | 71% | 85% | 100% | 100% |
| 7 | 1% | 1% | 1% | 7% | 35% | 91% | 100% |
| 8 | 1% | 1% | 1% | 1% | 1% | 51% | 93% |
| 9 | 1% | 1% | 1% | 1% | 1% | 3% | 80% |
| 10 | 1% | 1% | 1% | 1% | 1% | 1% | 67% |

Misma tabla variando la **habilidad** (nivel 50, Int 120): círculos 1, 3, 5, 7 y 9.

| habilidad | círc 1 | círc 3 | círc 5 | círc 7 | círc 9 |
| --- | --- | --- | --- | --- | --- |
| 20 | 100% | 85% | 55% | 1% | 1% |
| 40 | 100% | 100% | 75% | 7% | 1% |
| 60 | 100% | 100% | 95% | 21% | 1% |
| 80 | 100% | 100% | 100% | 35% | 1% |
| 100 | 100% | 100% | 100% | 49% | 1% |

### 4.4 ¿Con qué hechizo se mata mejor a cada monstruo? (maná y tiempo hasta matar)

Para cada monstruo se calcula la vida media (`npcHP` con `hitDice`), la probabilidad de impacto real (con su `resistMagic`), la absorción `absDamage` y se elige el hechizo de ataque que **minimiza el maná esperado** para matarlo, con el perfil C (Mag 200, lanzado por el jugador, 1 objetivo). Sin sobre-daño ni regeneración del monstruo.

| monstruo | vida | rr | abs | mejor hechizo | impacto | lanz. | maná | % reserva C |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Slime | 7 | 5 | 0% | 61 Mass Fire Strike | 99% | 0.1 | 4 | 1% |
| Skeleton | 44 | 40 | 0% | 61 Mass Fire Strike | 99% | 0.3 | 26 | 4% |
| Orc | 14 | 25 | 0% | 61 Mass Fire Strike | 99% | 0.1 | 8 | 1% |
| Zombie | 55 | 30 | 0% | 61 Mass Fire Strike | 99% | 0.4 | 32 | 5% |
| Troll | 303 | 60 | 0% | 61 Mass Fire Strike | 99% | 2.2 | 177 | 30% |
| Cyclops | 329 | 65 | 0% | 61 Mass Fire Strike | 99% | 2.4 | 192 | 32% |
| Orge | 633 | 70 | 0% | 61 Mass Fire Strike | 99% | 4.6 | 370 | 62% |
| Liche | 713 | 75 | 10% | 61 Mass Fire Strike | 99% | 5.8 | 463 | 77% |
| Dark-Elf | 771 | 60 | 50% | 61 Mass Fire Strike | 99% | 11.3 | 902 | 150% |
| WereWolf | 772 | 80 | 20% | 61 Mass Fire Strike | 99% | 7.1 | 565 | 94% |
| Gagoyle | 2188 | 70 | 80% | 61 Mass Fire Strike | 99% | 80 | 6401 | 1067% |
| Ettin | 989 | 90 | 65% | 61 Mass Fire Strike | 99% | 20.7 | 1654 | 276% |
| Demon | 1878 | 100 | 75% | 61 Mass Fire Strike | 97% | 56.1 | 4485 | 748% |
| Unicorn | 1874 | 100 | 75% | 61 Mass Fire Strike | 97% | 55.9 | 4476 | 746% |
| Hellclaw | 5491 | 100 | 50% | 61 Mass Fire Strike | 97% | 82 | 6557 | 1093% |
| Tigerworm | 10995 | 100 | 70% | 61 Mass Fire Strike | 97% | 273.5 | 21884 | 3647% |
| Wyvern | 13743 | 100 | 80% | — | — | — | — | — |

Lectura: los monstruos con **absDamage** alto (Gagoyle 80 %, Ettin 65 %, Dark-Elf 50 %) y rr 100 son casi inmunes a la magia; ahí manda el cuerpo a cuerpo. Los jefes de miles de HD (Hellclaw, Tigerworm, Wyvern) no caben en una sola reserva de maná: la magia solo es viable en grupo o con summons de escuela.

### 4.5 Escalado con la Magia y con varios objetivos

La Magia añade `Mag/330` al daño: Mag 50 = +15 %, Mag 100 = +30 %, Mag 200 = +61 %. Ejemplo de 4 hechizos de referencia (un objetivo):

| id | hechizo | maná | Mag 0 | Mag 50 | Mag 100 | Mag 150 | Mag 200 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Magic Missile | 8 | 4.5 | 5.2 | 5.9 | 6.5 | 7.2 |
| 20 | Fire Ball | 27 | 18 | 20.7 | 23.5 | 26.2 | 28.9 |
| 43 | Lightning | 44 | 28 | 32.2 | 36.5 | 40.7 | 45 |
| 61 | Mass Fire Strike | 80 | 86 | 99 | 112.1 | 125.1 | 138.1 |
| 81 | Meteor Strike | 120 | 63.5 | 73.1 | 82.7 | 92.4 | 102 |

Daño total según el número de objetivos dentro de la zona (Mag 100):

| id | hechizo | 1 | 3 | 5 | 8 |
| --- | --- | --- | --- | --- | --- |
| 0 | Magic Missile | 5.9 | 5.9 | 5.9 | 5.9 |
| 20 | Fire Ball | 23.5 | 46.9 | 70.4 | 105.5 |
| 43 | Lightning | 36.5 | 36.5 | 36.5 | 36.5 |
| 61 | Mass Fire Strike | 112.1 | 259.3 | 406.5 | 627.4 |
| 81 | Meteor Strike | 82.7 | 248.2 | 413.7 | 661.9 |

### 4.6 Campos: daño en el suelo (con solapes)

Cada casilla del campo es una entrada propia que castiga **en radio** cada segundo, así que quien está en el centro de un campo cuadrado recibe los tics de **todas** las casillas que lo cubren. Simulación exacta sobre rejilla (horizontal para muros), con las medias de dados del tic. «Centro» = casilla de máxima superposición; «borde» = esquina; «total» = estar quieto durante toda la `last`.

| id | campo | maná | dur s | casillas | centro | borde | total centro | eficiencia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | Fire Wall | 42 | 30 | 5 | 3×3.5 = 10.5/s | 2×3.5 = 7/s | 315 | 7.5 /maná |
| 41 | Fire Field | 48 | 30 | 9 | 9×3.5 = 31.5/s | 4×3.5 = 14/s | 945 | 19.7 /maná |
| 46 | Poison Cloud | 48 | 30 | 9 | 9×3.5 = 31.5/s | 4×3.5 = 14/s | 945 | 19.7 /maná |
| 54 | Spike Field | 56 | 30 | — | — | — | — | solo dibuja |
| 55 | Ice Storm | 58 | 30 | 1 | 1×11 = 11/s | 1×11 = 11/s | 330 | 5.7 /maná |
| 73 | Cloud Kill | 130 | 30 | 25 | 9×4.5 = 40.5/s | 4×4.5 = 18/s | 1215 | 9.3 /maná |

Lectura: contra un monstruo que se queda dentro, los campos de 3×3 y 5×5 hacen cientos de puntos de daño por unos 50 de maná — **muy por encima** de cualquier hechizo de ataque directo (compara con §4.1). Es el principal desequilibrio detectado (§8). Contra jugadores (que caminan) el efecto práctico es mucho menor.

### 4.7 Veneno

`Poison` (27, nivel 15) y `Mass Poison` (53, nivel 40) solo afectan a jugadores: 1 de cada 12 s hace `1d(nivel)`. Duración media hasta curarse con habilidad de resistencia al veneno `s` (curación por tic = `max(10, s-10+addPR)` %):

| resist. veneno | cura/tic | tics | duración | daño total (niv 15) | daño total (niv 40) |
| --- | --- | --- | --- | --- | --- |
| 0 | 10% | 10 | 120 s | 80 | 205 |
| 20 | 10% | 10 | 120 s | 80 | 205 |
| 40 | 30% | 3.3 | 40 s | 27 | 68 |
| 60 | 50% | 2 | 24 s | 16 | 41 |
| 80 | 70% | 1.4 | 17 s | 11 | 29 |
| 100 | 90% | 1.1 | 13 s | 9 | 23 |

---

## 5. Escuelas de summons (modo del juego actual)

Con `MAGIC_MODE.schools = true`, los hechizos **de ataque** fuego/hielo/rayo (`OFFENSIVE = {1,3,14,19,21,22,23,25,26,28,30}`) los lanza el summon de la escuela: Orc→Demon (fuego), Tentocle→Frost (hielo), Cannibal-Plant→Liche (rayo). Parámetros (`schools.js`):

```
nivel de desbloqueo : los hechizos comprables de la escuela, ordenados por maná, se reparten entre los niveles 1..50
                      (tier 2 ×0,8)
maná del hechizo    : round(4 + 1,5·(Lh - 1))            Lh = nivel de desbloqueo (NO el maná de Magic.cfg)
Int / oro de enseñar: max(10, 2·Lh)  /  round(25·Lh^1,7 / 10)·10
poder (acierto)     : 40 + 3·nivelSummon                 (no usa la habilidad del jugador; nivel 50 → 190)
daño                : spellDamage(Mag del DUEÑO) · levelPower(nivelSummon) · (tier2 ? 1,25 : 1) · talento "frenzy"
levelPower(L)       : 0,6 + 0,8·min(50, L)/50            (0,6 al nv 1 → 1,4 al nv 50)
reserva del summon  : round((20 + 6·L) · factorMp · 2 · (tier2 ? 1,6 : 1))   (sin regeneración natural: caramelos azules)
```

El summon cuesta mucho menos maná por hechizo que el jugador (un hechizo de 8–180 de Magic.cfg pasa a costar 4–78), así que la magia de escuela es el modo **eficiente** del juego; el límite lo pone la reserva del summon, no la del jugador.

### 5.1 Escuela de Fire — 5 hechizos

| id | hechizo | desbloq. | maná sch | maná cfg | dmg1 nv50 | /maná | dmg1 tier2 | /maná T2 | impacto rr100 | impacto rr60 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | Fire Ball | 1 | 4 | 27 | 32.8 | 8.2 | 41 | 10.3 | 95% | 99% |
| 30 | Fire Strike | 13 | 22 | 36 | 43.8 | 2 | 54.7 | 2.5 | 95% | 99% |
| 40 | Fire Wall | 26 | 42 | 42 | 0 | 0 | 0 | 0 | 95% | 99% |
| 41 | Fire Field | 38 | 60 | 48 | 0 | 0 | 0 | 0 | 95% | 99% |
| 81 | Meteor Strike | 50 | 78 | 120 | 115.8 | 1.5 | 144.8 | 1.9 | 95% | 99% |

Summon nivel 50 y dueño con Mag 100. «dmg1» ya incluye `levelPower(50) = 1,4`; tier 2 multiplica ×1,25 (y la reserva ×1,6).

### 5.2 Escuela de Ice — 5 hechizos

| id | hechizo | desbloq. | maná sch | maná cfg | dmg1 nv50 | /maná | dmg1 tier2 | /maná T2 | impacto rr100 | impacto rr60 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 45 | Chill Wind | 1 | 4 | 48 | 21.9 | 5.5 | 27.4 | 6.8 | 95% | 99% |
| 57 | Ice Strike | 13 | 22 | 59 | 53.8 | 2.4 | 67.3 | 3.1 | 95% | 99% |
| 63 | Mass Chill Wind | 26 | 42 | 90 | 35.6 | 0.8 | 44.5 | 1.1 | 95% | 99% |
| 72 | Mass Ice Strike | 38 | 60 | 120 | 103.1 | 1.7 | 128.8 | 2.1 | 95% | 99% |
| 91 | Blizzard | 50 | 78 | 170 | 132.3 | 1.7 | 165.3 | 2.1 | 95% | 99% |

Summon nivel 50 y dueño con Mag 100. «dmg1» ya incluye `levelPower(50) = 1,4`; tier 2 multiplica ×1,25 (y la reserva ×1,6).

### 5.3 Escuela de Lightning — 12 hechizos

| id | hechizo | desbloq. | maná sch | maná cfg | dmg1 nv50 | /maná | dmg1 tier2 | /maná T2 | impacto rr100 | impacto rr60 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Magic Missile | 1 | 4 | 8 | 8.2 | 2.1 | 10.3 | 2.6 | 95% | 99% |
| 10 | Energy Bolt | 5 | 10 | 15 | 21.9 | 2.2 | 27.4 | 2.7 | 95% | 99% |
| 37 | Lightning Arrow | 10 | 18 | 32 | 40.1 | 2.2 | 50.2 | 2.8 | 95% | 99% |
| 47 | Triple Energy Bolt | 14 | 24 | 40 | 42.9 | 1.8 | 53.6 | 2.2 | 95% | 99% |
| 43 | Lightning | 19 | 31 | 44 | 51.1 | 1.6 | 63.8 | 2.1 | 95% | 99% |
| 56 | Mass Lightning Arrow | 23 | 37 | 55 | 68.4 | 1.8 | 85.5 | 2.3 | 95% | 99% |
| 51 | Lightning Bolt | 28 | 45 | 58 | 76.6 | 1.7 | 95.8 | 2.1 | 95% | 99% |
| 60 | Energy Strike | 32 | 51 | 65 | 75.7 | 1.5 | 94.6 | 1.9 | 95% | 99% |
| 74 | Lightning Strike | 37 | 58 | 90 | 87.6 | 1.5 | 109.5 | 1.9 | 95% | 99% |
| 77 | Illusion Movement | 41 | 64 | 130 | 87.6 | 1.4 | 109.5 | 1.7 | 95% | 99% |
| 82 | Mass Magic Missile | 46 | 72 | 160 | 105.8 | 1.5 | 132.3 | 1.8 | 95% | 99% |
| 95 | Mass Illusion Movement | 50 | 78 | 200 | 87.6 | 1.1 | 109.5 | 1.4 | 95% | 99% |

Summon nivel 50 y dueño con Mag 100. «dmg1» ya incluye `levelPower(50) = 1,4`; tier 2 multiplica ×1,25 (y la reserva ×1,6).

### 5.4 Progresión del summon: poder, reserva y daño por reserva

Daño total que puede entregar un summon con la **reserva completa** lanzando siempre el mejor hechizo disponible de su escuela contra un objetivo de rr 60 (dueño Mag 100, un objetivo). Cuenta solo hechizos ya desbloqueados.

| escuela | nv | tier | reserva | mejor hechizo/maná | dmg esperado | /maná | daño por reserva |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fire | 1 | T1 | 52 | 20 Fire Ball | 5.1 | 1.3 | 66 |
| Fire | 1 | T2 | 83 | 20 Fire Ball | 6.3 | 1.6 | 126 |
| Fire | 10 | T1 | 160 | 20 Fire Ball | 10.3 | 2.6 | 414 |
| Fire | 10 | T2 | 256 | 20 Fire Ball | 12.9 | 3.2 | 827 |
| Fire | 25 | T1 | 340 | 20 Fire Ball | 22.3 | 5.6 | 1894 |
| Fire | 25 | T2 | 544 | 20 Fire Ball | 27.9 | 7 | 3788 |
| Fire | 50 | T1 | 640 | 20 Fire Ball | 32.5 | 8.1 | 5201 |
| Fire | 50 | T2 | 1024 | 20 Fire Ball | 40.6 | 10.2 | 10403 |
| Ice | 1 | T1 | 52 | 45 Chill Wind | 3.4 | 0.8 | 44 |
| Ice | 1 | T2 | 83 | 45 Chill Wind | 4.2 | 1.1 | 84 |
| Ice | 10 | T1 | 160 | 45 Chill Wind | 6.9 | 1.7 | 276 |
| Ice | 10 | T2 | 256 | 45 Chill Wind | 8.6 | 2.2 | 551 |
| Ice | 25 | T1 | 340 | 45 Chill Wind | 14.9 | 3.7 | 1263 |
| Ice | 25 | T2 | 544 | 45 Chill Wind | 18.6 | 4.6 | 2525 |
| Ice | 50 | T1 | 640 | 45 Chill Wind | 21.7 | 5.4 | 3468 |
| Ice | 50 | T2 | 1024 | 45 Chill Wind | 27.1 | 6.8 | 6935 |
| Lightning | 1 | T1 | 52 | 0 Magic Missile | 1.3 | 0.3 | 16 |
| Lightning | 1 | T2 | 83 | 0 Magic Missile | 1.6 | 0.4 | 32 |
| Lightning | 10 | T1 | 160 | 37 Lightning Arrow | 12.6 | 0.7 | 101 |
| Lightning | 10 | T2 | 256 | 37 Lightning Arrow | 15.8 | 0.9 | 221 |
| Lightning | 25 | T1 | 340 | 37 Lightning Arrow | 27.2 | 1.5 | 490 |
| Lightning | 25 | T2 | 544 | 37 Lightning Arrow | 34 | 1.9 | 1021 |
| Lightning | 50 | T1 | 640 | 37 Lightning Arrow | 39.7 | 2.2 | 1391 |
| Lightning | 50 | T2 | 1024 | 37 Lightning Arrow | 49.7 | 2.8 | 2781 |

Lectura: el tier 2 multiplica daño ×1,25 y reserva ×1,6 ⇒ **×2 en daño por reserva**, un salto fuerte; combinado con que sus hechizos se desbloquean un 20 % antes, es la mejora más grande de todo el sistema. Cualquier ajuste de balance en escuelas debe empezar por `TIER_MULT`.

---

## 6. Hechizos psíquicos (invento del port)

`systems/psychic.js`: Beholder (**Movimiento**), Centaurus (**Interferencia**) y Stalker (**Territorio**) lanzan solos, sin daño directo, con el **Psychic Controller** (id 9004) en la mano. Alcance 10, recarga global 2200 ms, resistencia: `1d100 <= min(80, rr·0,6)` (un 60 % de rr da 36 % de resistir). Reutilizan hechizos de Magic.cfg **solo por su estado**:

| rama | id | hechizo | recarga | duración | efecto |
| --- | --- | --- | --- | --- | --- |
| Movimiento | 25 | Hold Person | 14 s | 5 s | inmoviliza (no a magicLevel ≥ 6 ni addPR ≥ 500) |
| Movimiento | 77 | Illusion Movement | 14 s | 6 s | el monstruo pierde su objetivo; el jugador se desorienta |
| Movimiento | 45 | Chill Wind | 10 s | 8 s | congela (ralentiza) |
| Interferencia | 83 | Inhibition Casting | 16 s | 8 s | el jugador no lanza |
| Interferencia | 76 | Cancellation | 20 s | — | quita invis, protect, berserk, pfm |
| Interferencia | 62 | Confusion | 14 s | 6 s | movimiento errático |
| Interferencia | 66 | Armor Break | 18 s | 10 s | +25 % daño recibido |
| Interferencia | 11 | Staminar Drain | 15 s | — | −30 % de la SP máxima |
| Territorio | 41 | Fire Field | 16 s | 9 s | campo: raíz de 1,5 s (con 6 s de inmunidad) |
| Territorio | 54 | Spike Field | 16 s | 9 s | campo: ralentiza 4 s |
| Territorio | 46 | Poison Cloud | 18 s | 9 s | campo: ralentiza 4 s |

### 6.1 Tiempo de control esperado
Fracción del tiempo que un único objetivo está bajo el efecto `duración/recarga · (1 − P(resistir))`, sin contar el GCD ni los solapes entre hechizos (cota superior por hechizo; el efecto no se renueva mientras está activo):

| hechizo | rr 5 | rr 30 | rr 60 | rr 100 |
| --- | --- | --- | --- | --- |
| Hold Person | 35% | 29% | 23% | 14% |
| Illusion Movement | 42% | 35% | 27% | 17% |
| Chill Wind | 78% | 66% | 51% | 32% |
| Inhibition Casting | 49% | 41% | 32% | 20% |
| Confusion | 42% | 35% | 27% | 17% |
| Armor Break | 54% | 46% | 36% | 22% |

Lectura: ninguna rama puede mantener a un objetivo inmovilizado de forma permanente (Hold ≤ 36 % de uptime, Chill Wind ≤ 80 %). El control combinado de la rama Movimiento (Hold + Illusion + Chill Wind) sube a ~100 % de "algo activo" contra rr bajo, por diseño: su misión es evitar que un monstruo te alcance, no matarlo.

---

## 7. Guía de equilibrio

### 7.1 Palancas (qué tocar y qué consecuencia tiene)

| Palanca | Dónde | Efecto | Riesgo |
| --- | --- | --- | --- |
| Dados del hechizo (`v4..v9`) | `magic.json` (cfg) — **autoritativo** | Daño directo | Prohibido tocar sin motivo: el cfg es la especificación. Preferir palancas del port |
| `MC_PROB`, `MC_PENALTY` | `magic.js` | Fiabilidad de lanzar por círculo | Afecta a todo el modo base |
| `MIN_HIT`/`MAX_HIT` | `rules.js` | Suelo/techo del acierto | Tocarlo cambia melé y magia |
| `levelPower`, `spellPower` | `schools.js` | Daño y acierto del summon por nivel | Controla la curva de escuelas |
| `TIER_MULT` (hp/mp/dmg) | `schools.js` | Salto de tier 2 | El mayor multiplicador del sistema (×2 daño por reserva) |
| `spellMana`, `unlockLevels` | `schools.js` | Coste y nivel de aprendizaje | Cambia el ritmo de desbloqueo |
| `manaSave`, `+20 wtype 34` | equipo | Eficiencia | Poca; acumulativa con otras |
| Daño de campos | `fields.js` | Campos | Ver solapes (§8) |
| Recargas/duraciones | `psychic.js` | Uptime del control | Acotar siempre < 100 % |

### 7.2 Objetivos de diseño propuestos
1. **Daño por maná decreciente con el círculo, compensado por zona.** Un hechizo de mayor círculo no debe ser mejor por maná contra un solo objetivo que los de círculos bajos; su ventaja es la zona, el control o saltarse el `protect 2`.
2. **Ningún hechizo debe superar ~3× la mediana de daño/maná** (hoy la mediana de ataque es 0.7 /maná a Mag 100). Los que se salen por encima o por debajo están marcados en §3 y listados en §8.
3. **El control no puede ser permanente:** uptime por hechizo < ~60 % contra rr medio; sin apilar el mismo estado; inmunidad posterior tras raíces (ya hecho en el fuego psíquico).
4. **La magia no sustituye al cuerpo a cuerpo contra absorbentes** (`absDamage` alto): mantener ese contrapeso.
5. **El tier 2 es el premio, no una obligación:** si T2 duplica el daño por reserva, el T1 queda obsoleto. Bajar `TIER_MULT.mp` a 1,3 deja el salto en ~×1,6.

### 7.3 Procedimiento para añadir un hechizo nuevo
1. Si es de Magic.cfg: no inventarlo ni renumerarlo; solo ajustar su comportamiento en `magicsys.js` si falta.
2. Si es invento del port (como los psíquicos): id fuera del rango cfg, anotar «INVENTO» en el comentario, ficha en esta guía.
3. Calcular con este script: daño/maná, hit% por rr (5/25/50/70/100) y daño por reserva. Debe caer entre 0,6× y 1,5× la mediana de su círculo, o justificarse.
4. Test en `tests/`, ficha en `docs/sistemas/`, entrada en español con EN en `client/i18n.js`.
5. Si se ve para otros jugadores: `PUBLIC` y `pub()` en `server/server.mjs`, y subir `NET_PROTO`.

### 7.4 Checklist de pruebas de equilibrio
- Matar a un monstruo "de su nivel" con la magia no debe costar más del 50 % de la reserva del perfil adecuado.
- Ningún jefe cae a una sola reserva de maná.
- El hechizo de un círculo no es resistible al 100 % por un monstruo de su nivel (acierto ≥ 50 %).
- Dos hechizos de la misma escuela no pueden dominar uno al otro en daño/maná **y** zona a la vez.

---

## 8. Hallazgos y pendientes (calculados)

**Más eficientes por maná (un objetivo, Mag 100, relativo a la mediana):** 61 Mass Fire Strike (×2), 10 Energy Bolt (×1.5), 51 Lightning Bolt (×1.4), 37 Lightning Arrow (×1.3), 56 Mass Lightning Arrow (×1.3), 30 Fire Strike (×1.3).

**Menos eficientes:** 63 Mass Chill Wind (×0.4), 95 Mass Illusion Movement (×0.5), 45 Chill Wind (×0.5), 82 Mass Magic Missile (×0.7), 77 Illusion Movement (×0.7), 96 Earth Shock Wave (×0.8).

1. **Solape de campos (crítico).** Cada casilla de un campo golpea en radio, así que el centro de Fire Field recibe 9 tics/s (≈31 de daño/s), Cloud Kill hasta 9×4,5 y el muro de Fire Wall ~3×. Según la tabla 4.6, un Fire Field entrega ~945 de daño a quien se quede en el centro durante sus 30 s por 48 de maná (≈20 /maná, frente a ~2–3 /maná de los hechizos directos). **Verificar contra el original** (`Effect_Damage_Spot`/objetos dinámicos en `HGServer/Game.cpp`) si cada objeto de campo daña solo a quien pisa su casilla o en radio; el port hoy usa radio. **Propuesta:** el tic de campo debe golpear **una vez por entidad y segundo** (deduplicar por entidad, no por entrada), o reducir el radio a 0. Esto reduce el centro a 3,5/s y deja los campos como herramientas de control, no de daño.
2. **Los campos no escalan con Magia ni resisten magia** (no pasan por `spellDamage` ni `resists`). Es coherente con el original; mantener.
3. **Hechizos de 9.º–10.º círculo imposibles de lanzar a nivel ≤ 50** fuera de escuelas (§4.2). Si se quiere que el jugador sin escuela los use, hay que o subir `MC_PENALTY` más suave o limitar a escuelas (decisión actual).
4. **Tier 2 ×2 por reserva** (§5.4): el salto es grande. Valorar `TIER_MULT.mp` 1,6 → 1,3.
5. **Elemento sin efecto:** hielo/fuego/rayo no tienen resistencias por especie. Una posible mejora (invento a documentar) es +25 % contra la debilidad natural de la especie (Ice-Golem débil al fuego, Fire-Wyvern débil al hielo) y −25 % contra la afinidad.
6. **Curación y utilidades sin simular:** Heal/Great Heal (`1d6+10`, `4d10+20`) y los escudos no tienen simulación porque su valor depende del combate; pendiente un test que mida "vida curada por maná" y "daño evitado por escudo".
7. **Pendiente de cobertura de tests:** hay pruebas de resolución de hechizos (`magic.test.mjs`) pero ninguna que fije la **matriz de equilibrio** (daño/maná por hechizo). Añadir un test que falle si un hechizo de ataque se sale de [0,4×, 2,5×] de la mediana, para que los cambios de balance sean conscientes.

---

*Este documento es la base de desarrollo de la magia. Mantenerlo al día: ejecutar `node tools/sim_magia.mjs` tras cualquier cambio en `magic.json`, `magic.js`, `schools.js`, `fields.js` o `psychic.js`.*
