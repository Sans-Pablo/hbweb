# Bestiario (herramienta de pruebas visuales)

`http://localhost:8088/bestiario.html` (o `web/bestiario.html` en cualquier servidor estático). Código: `web/src/client/bestiary.js`.

Dibuja cualquier criatura de `npc.json` con el mismo `Renderer.drawEntity` del juego, sin entrar a jugar:
- **Vista Evolución**: una fila por etapa de tamaño (niveles 1, 10, 25, 40, 50) y una columna por dirección.
- **Vista Un nivel**: las 8 direcciones de un nivel concreto.
- Acciones: reposo, andar, atacar, daño, morir (en bucle). «Como summon» activa escala por nivel y auras; «Círculo de casteo» el círculo de nivel máximo.
- No modifica nada del juego ni usa la simulación: solo lectura de datos y sprites. Por eso no tiene test propio.

## Armería (`armeria.html`, `client/armory.js`)
Editor de sprites de objetos, enlazado con el Bestiario. Recorta el fotograma de mochila (`packKey`) de cualquier objeto de `items.json` y lo recolorea: matiz, saturación, brillo, contraste y reemplazo de un color (cuentagotas sobre el original, tolerancia, destino). Exporta PNG o lo guarda con `POST /api/dev/armory` (solo loopback) en `art/armory/<nombre>.png` + `.json` con la receta.
- No crea objetos en el juego: eso exigiría nuevos IDs de Item.cfg (autoritativos). Los PNG son material para spritelab/arte.
- Sin test propio (herramienta visual de solo lectura; el endpoint solo escribe en `art/armory/`).

## Magia de monstruos (v0.74.0)
`npcsys.NPC_SPELLS`: el Cíclope (magicLevel 5, 450 de maná) lanza Fire Ball (20) o Fire Strike (30) a jugadores a 4-6 casillas (melé: ataca normal). Gasta el maná del hechizo y recupera 4/s; acierto = `magicHitRatio`+25. INVENTO: el `NpcMagicHandler` original no está en el repo, así que la tabla es del port. Test `npc-cast`.

- **Cyclops Lv 50 eléctrico** (v0.78.1, invento del port): con «Como summon» y nivel ≥ 50 `renderer.js` dibuja arcos, chispas y halo azul en las pinzas. `clawPos()` localiza las pinzas por fotograma buscando los píxeles plateados (claros y sin color) del sprite, separados en izquierda/derecha; no usa `anchors.json`. Al morir (v0.78.3) descargas recorren la silueta del cuerpo y se apagan en ~2,5 s; de espaldas las pinzas se estiman por la silueta.
  - v0.78.6: al atacar, el halo de las pinzas crece y chispas convergen hacia ellas (carga leve, fase `pa` del ataque).
  - v0.78.11: progresión (el arco entre pinzas solo al 50) (nace al 45 % del tamaño, 63 %, 82 %, 100 %) por niveles: tamaño en 10/20/30 (`companion.stagesOf`, tamaño real al 30), 30 solo mini destello en pinzas, 40 + efecto en el cuerpo, 50 + rayos de las pinzas y el resto.
- **Pixie por niveles** (v0.78.12, invento del port): `stagesOf("Tutelary-Angel")` = [10,20,30] (como el Cyclops, tamaños 45/63/82/100 %). Efectos solo con «Como summon»: Lv 30 destello blanco en las puntas de las alas y motas; Lv 40 parpadeo azul hielo y motas orbitando; Lv 50 halo y copos de luz. Usa `clawPos()` solo para rellenar `_cbox` (silueta) y se ancla a esa caja más el hover.

- Panel «Sonidos de la Pixie» (v0.78.14, `web/src/client/bestiary-sounds.js`): botones que reproducen WAV originales de `data/sfx` agrupados por uso (campanilla, chispa/aleteo, zumbido, crecer, invocar, morir) más la lista completa C/E/M. Solo para elegir a oído; aún no se asignan a eventos.

- Panel «Sonidos de la Pixie» (v0.78.14, `web/src/client/bestiary-sounds.js`): botones que reproducen WAV originales de `data/sfx` agrupados por uso (campanilla, chispa/aleteo, zumbido, crecer, invocar, morir) más la lista completa C/E/M. Solo para elegir a oído; aún no se asignan a eventos.
- Pixie HD generada con `tools/make_pixie_hd.py` (×4 sobre las hojas `ututelarangel*`).
- Sonidos en juego (`client/audio.js`): E46 al subir, +E30 al crecer (10/20/30), +E36/E19 en 30/40/50, M62 al perderla.
- v0.78.17: Healer/Buffer/Aura en el Bestiario con sus efectos de nivel 30/40/50 (verde cruces y halo, amarillo escudos-rombo y runa, azul ondas y resplandor).
- v0.78.18: hojas HD de uhealer/usorceress/ubuffer generadas con tools/make_support_hd.py.

- **Modelos gráficos** (selector «Modelo», sin versión publicada): 1 Original, 2 HD actual (`sprites_hd`), 3 IA (`sprites_ia`, `tools/remaster_ia.py ESRGAN_DIR [prefijo…]`, Real-ESRGAN x4plus ncnn-vulkan; misma maqueta x4 que HD, el manifiesto `sprites_ia.json` lleva `dir`), 4 IA + luz (filtro CSS de contraste, bordes cálido/frío y sombra: **simulado**, la iluminación real iría en el renderer con mapas de normales). «Comparar los 4» dibuja un modelo por fila. `Sprites.modelFx` solo lo usa el Bestiario. `sprites_ia/` se ignora en git.

## Reglas para generar hojas IA (`tools/remaster_ia.py`)
1. **Aislar cada fotograma.** Las hojas están empaquetadas: cualquier filtro por fotograma (suavizado, desenfoque, morfología) debe leer solo su propio recuadro. Si lee el margen, entran píxeles del vecino y quedan tiras rectas de 1 px en el borde (causa confirmada en orge1, fotogramas 1 y 2).
2. **No borrar negro.** Los píxeles casi negros bajo los pies y entre las púas son sombra propia del modelo (la del garrote), no mugre: el orge los perdía con el recorte de «sombra del suelo» (lum<14, 14 filas bajas). Está apagado (`black=0` en `clean_mask`); activarlo solo para un monstruo concreto con cuña de sombra plana comprobada. Nunca limpiar «oscuros» en general.
3. Mugre suelta: por fotograma, descartar trozos que no toquen el cuerpo (5 px) ni midan el 15 % del mayor.
4. El alfa original es binario: se rehace aparte; el WebP lleva `exact=True` para poder rehacer solo el alfa con `--alpha`.
5. Tras regenerar, comprobar que cada fotograma tenga un solo componente (o piezas grandes legítimas, como las puntas del garrote).
