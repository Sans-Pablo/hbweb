# Estado del proyecto

**Hecho:** granja de Aresden jugable; combate con fórmulas del servidor original; ítems originales (568 de Item.cfg), mochila de 50 casillas, peso, equipar con requisitos, absorción por parte del cuerpo, durabilidad (solo con bando), botín con las tasas originales (1/1), habilidades con maestría, resistencia, hambre; opciones (Esc), mapa tipo Diablo II, correr con R, guardado en el navegador.

**Pendiente (por orden):** magia (Magic.cfg), resto de monstruos y mapas, portales, NPC y tiendas, reparación, atributos raros de ítems, arco y flechas, grupos y PvP. Gráficos y música congelados hasta que todo sea fiel.

Especificaciones en `docs/` (items_spec.md). Pruebas: `node tests/sim.test.mjs`, `node tests/net-walk.test.mjs`.

## Atributos de los drops (revisado contra NpcDeadItemGenerator / _AdjustRareItemValue / bEquipItemHandler)
- Tablas de drop (oro 60 %, estándar 1d12000, genLevel de armas/varitas/armaduras) comprobadas: coinciden. Corregido: en diciembre cualquier monstruo suelta caramelos (el original lo escribe `type == 61 || 55`, siempre cierto).
- Nuevo `shared/attributes.js`: tipo/valor principal y secundario, color, tope 7 para monstruos de nivel ≤2, mínimos por tipo; peso/velocidad/durabilidad reales; efectos al equipar (dado +1/+2, acierto, defensa, recuperación de vida/aguante/maná, absorción, daño de combo, experiencia, oro, maná por daño, carga de crítico, bonus de lanzamiento de varitas).
- No portado aún: veneno (tipo 2), daño crítico (1, necesita ataque especial), "Righteous" (solo PvP), resistencias a veneno y magia (necesitan veneno y magia de NPC).

## Cuentas y guardado (prueba local)
- Pantalla de login con «Entrar» / «Crear cuenta» (`client/accounts.js`): contraseña con PBKDF2 + sal en localStorage; una partida previa con el mismo nombre se conserva al crear la cuenta.
- Guardado automático cada 10 s, al ocultar/cerrar la pestaña y desde Opciones («Guardar ahora»); copia de seguridad en archivo (exportar/importar) y cerrar sesión.
- Limitación: todo vive en el navegador (no hay sincronización entre dispositivos; haría falta un servidor).


## Cripta procedural — entrega 1

Entrada en Aresfarm (134, 94) con E, nueve salas conectadas, esqueletos originales, instancias privadas en local y servidor, portales de regreso, finalización y limpieza. Pruebas y límites en [DUNGEON_V1.md](DUNGEON_V1.md).

## Creación de personaje
- Pantalla de creación (`client/create.js`) tras crear la cuenta: nombre (≤10, reglas del original), 10 puntos entre atributos de 10 a 14, plantillas Guerrero/Mago/Sacerdote, género, 3 pieles, 8 peinados, 16 colores de pelo y 8 de ropa interior, con vista previa que gira.
- `tools/convert_players.py` exporta los sprites (6 cuerpos, 16 peinados, 16 ropas interiores) a `data/players.json`; se cargan bajo demanda.
- Pendiente: el tinte del pelo es una aproximación (el original suma RGB al píxel); el bando (Aresden/Elvine) aún no se elige.

## Cliente original: teclas y ratón (fase 1)
Teclas y ratón copiados de `Client/Game.cpp` (OnKeyUp/CommandProcessor): F1 ayuda, F2/F3 atajos (Ctrl+F2/F3 asigna lo último usado), F4 hechizo elegido,
F5 personaje, F6 mochila, F7 magia, F12 sistema, Insert/Supr pociones, Tab combate/paz, Inicio ataque seguro, Fin último mensaje,
Ctrl+A/D/M/R/S/T/W/X, Intro o cualquier letra = chat. Ratón: izquierdo andar/recoger, Ctrl+izquierdo atacar, derecho atacar adyacente;
con un hechizo preparado (UseMagic) el izquierdo lo lanza y el derecho cancela. Se quitaron teclas inventadas (C I K M G B N O R H Espacio 1 2 3).
Pendiente: Tab/Inicio/PageUp/Ctrl+A solo avisan (aún sin efecto en la simulación), F8/F9 y Ctrl+0..9 esperan a los diálogos originales.

## Cliente original: interfaz, magia y efectos (fase 2)
- Diálogos originales con sprites y posiciones del cliente: Personaje, Inventario (posición libre), Magia, Tienda de magia, Subida de nivel, Menú del sistema, Habilidades, Texto/Ayuda, Historial de chat. Clic derecho cierra el cuadro; arrastrar o pasar sobre un objeto muestra sus estadísticas.
- Magia como el original: elegir el hechizo en el libro cierra el libro, empieza la animación de lanzar (`prepare`) y el siguiente clic izquierdo lo suelta sobre el objetivo (`cast` con `pre`); el clic derecho cancela.
- Efectos de hechizos: `web/src/client/spellfx.js` porta bAddNewEffect / bEffectFrameCounter / DrawEffects con los mismos números de efecto (100 + hechizo) y los sprites de EFFECT*.PAK (`tools/convert_fx.py` -> `web/data/fx*`). Portados: 100, 101, 110, 120, 121, 130, 137, 143, 147, 156, 161 y las explosiones/chispas (4-12, 15, 30, 31).
- Sonidos originales E1..E53 y C1..C24 (`tools/convert.py`): lanzar, curar, explosiones, rayo, equipar (E28), quitar (E29), recoger (E20 / oro E12), clic de interfaz (E14).
- Ataque: sin pausa entre golpes (como el original); ataque automático opcional con `/auto` o en el panel de opciones.
- Pendiente de magia: tipos 4-7, 8-18, 19-33 (veneno, parálisis, escudos, invisibilidad, furia, invocación, resurrección, teletransporte...) con sus efectos 102-172, y el mago de la ciudad.

## Coordinación entre agentes
Se trabaja en `main` con commits pequeños: `git pull --rebase origin main` antes de cada push. Fase de UI original (cliente): `web/src/client/{controller,main,hud}.js`, `web/index.html`.
