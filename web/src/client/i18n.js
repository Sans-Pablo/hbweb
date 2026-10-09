// Idiomas: español (el texto del código) e inglés. `t(texto)` traduce el texto en español a inglés cuando el idioma es "en";
// los textos que ya están en inglés (los del juego original) se dejan tal cual. Las frases con datos van en PATTERNS.
// El DOM se traduce solo (nodos de texto y atributos) y se restaura al volver a español.
const LS = "hbweb.lang";
let lang = "es";
try { lang = localStorage.getItem(LS) || (/^en/i.test(navigator.language || "") ? "en" : "es"); } catch {}
if (lang !== "en" && lang !== "es") lang = "es";
const listeners = new Set();

const EN = {
  // ---- pantalla de entrada y creación
  "Cargando…": "Loading…", "Cargando el mapa…": "Loading map…", "Entrar": "Log in", "Crear cuenta": "Create account", "Nombre": "Name", "Contraseña": "Password",
  "Repite la contraseña": "Repeat password", "Tu personaje se guarda solo en este navegador. Puedes hacer una copia en Opciones.": "Your character is saved only in this browser. You can make a backup in Options.",
  "Conexión perdida": "Connection lost", "El servidor se ha cerrado o se cortó internet.": "The server closed or the internet dropped.", "Volver a entrar": "Log back in",
  "Crear cuenta y entrar": "Create account and log in", "Escribe un nombre.": "Enter a name.", "Las contraseñas no coinciden.": "The passwords do not match.",
  "Este navegador no permite crear cuentas (hace falta https o localhost).": "This browser cannot create accounts (https or localhost is required).",
  "El nombre: 3 a 16 letras, números, _ o -.": "Name: 3 to 16 letters, numbers, _ or -.", "La contraseña necesita al menos 4 caracteres.": "The password needs at least 4 characters.",
  "Ese nombre ya existe en este navegador.": "That name already exists in this browser.", "No existe esa cuenta. Pulsa «Crear cuenta».": "That account does not exist. Press “Create account”.",
  "Contraseña incorrecta.": "Wrong password.", "Ese archivo no es una partida de Helbreath Web.": "That file is not a Helbreath Web save.",
  "No se pudo conectar con el servidor.": "Could not connect to the server.", "Partida en línea": "Online game", " · aún no hay nadie": " · nobody here yet",
  "Personalidad": "Personality", "Prudente": "Cautious", "Bromista": "Joker", "Decidido": "Bold",
  "Cauto y reflexivo: avisa de los peligros y habla con calma.": "Careful and thoughtful: warns about dangers and speaks calmly.",
  "Charlatán y socarrón: comenta todo con humor.": "Chatty and cheeky: comments on everything with humour.",
  "Directo y valiente: pocas palabras y mucha acción.": "Direct and brave: few words, lots of action.",
  "Prueba local (un jugador)": "Local test (single player)", "Género": "Gender", "Hombre": "Male", "Mujer": "Female", "Color de pelo": "Hair color",
  "Todos los puntos repartidos": "All points assigned", "Nombre no válido: hasta 10 letras o números, sin espacios ni símbolos.": "Invalid name: up to 10 letters or numbers, no spaces or symbols.",
  "Preparando el mapa…": "Preparing the map…",
  // ---- barra y paneles
  "Poción de vida": "Health potion", "Poción de maná": "Mana potion", "Poción de resistencia": "Stamina potion", "Personaje (F5)": "Character (F5)", "Mochila (F6)": "Bag (F6)",
  "Magia (F7)": "Magic (F7)", "Gráficos": "Graphics", "Sonido": "Sound", "Opciones (F12)": "Options (F12)", "Novedades (F1)": "News (F1)", "Mochila": "Bag", "Libro de magia": "Spellbook",
  "Aprende con oro y elige uno. Elige un hechizo: el siguiente clic izquierdo lo lanza, el derecho cancela.": "Learn spells with gold and pick one. Pick a spell: the next left click casts it, right click cancels.",
  "Opciones": "Options", "Estilo del mapa": "Map style", "Esquina": "Corner", "Superpuesto (estilo Diablo II)": "Overlay (Diablo II style)",
  "Ataque automático (clic izquierdo sobre un monstruo)": "Auto attack (left click on a monster)", "Mostrar casillas bloqueadas": "Show blocked tiles", "Mejoras": "Enhancements",
  "Cursor clásico del juego": "Classic game cursor", "Sprites y terreno en HD (solo Remastered)": "HD sprites and terrain (Remastered only)", "Luz y viñeta (solo Remastered)": "Lighting and vignette (Remastered only)",
  "Animaciones de hechizos": "Spell animations", "Magia libre: todos los hechizos, sin coste de MP (pruebas)": "Free magic: all spells, no MP cost (testing)", "Cuenta": "Account",
  "Guardar ahora": "Save now", "Exportar copia": "Export backup", "Importar copia": "Import backup", "Cerrar sesión": "Log out", "Clásico": "Classic", "Idioma": "Language",
  "Has muerto": "You died", "Reaparecer": "Respawn",
  "Clic izquierdo: andar (correr si el modo correr está activo) · sobre ti: recoger": "Left click: walk (run if run mode is on) · on yourself: pick up",
  "Clic derecho: atacar al monstruo adyacente ·": "Right click: attack the adjacent monster ·", "+clic izquierdo: ir a atacar": "+left click: go and attack",
  "ayuda ·": "help ·", "personaje ·": "character ·", "mochila ·": "bag ·", "magia ·": "magic ·", "sistema": "system", ": atajos (asigna con": ": shortcuts (assign with", "lo último usado) ·": "the last one used) ·",
  ": hechizo elegido": ": selected spell", "poción de vida ·": "health potion ·", "poción de maná": "mana potion", "combate/paz ·": "combat/peace ·", "ataque seguro ·": "safe attack ·", "último mensaje": "last message",
  "correr ·": "run ·", "ataque automático ·": "auto attack ·", "mapa ·": "map ·", "sonido ·": "sound ·", "susurro": "whisper", "o cualquier letra: escribir ·": "or any letter: type ·", ": cerrar": ": close",
  "junto a un portal de la cripta (añadido de esta versión)": "next to a crypt portal (added in this version)",
  "Escribe y pulsa Intro (Esc para cancelar)": "Type and press Enter (Esc to cancel)", "Correr (": "Run (", "Mostrar mapa (": "Show map (", "Sonido (": "Sound (", "Mejoras de esta versión": "Enhancements in this version",
  // ---- diálogos
  "No hay misiones en esta versión.": "There are no quests in this version.", "No hay grupos en esta versión.": "There are no parties in this version.",
  "No hay mejora de objetos en esta versión.": "Item upgrades are not available in this version.", "Aprende la habilidad de fabricación para usar el manual.": "Learn the manufacturing skill to use the manual.",
  "Ataque automático": "Auto attack", "Cursor clásico": "Classic cursor", "Sprites y terreno HD": "HD sprites and terrain", "Luz y viñeta": "Light and vignette", "Magia libre (sin MP)": "Free magic (no MP)",
  "Ver casillas bloqueadas": "Show blocked tiles", "Clic derecho: cerrar": "Right click: close", "Esa habilidad aún no se puede usar en esta versión.": "That skill cannot be used yet in this version.",
  "el hechizo falla": "the spell fails", "Galerías de la cripta": "Crypt galleries", "¡Cripta despejada! Recoge el botín y regresa (E).": "Crypt cleared! Collect the loot and go back (E).",
  "Volver a la cripta": "Back to the crypt", "Pantalón": "Trousers", "Probabilidad de acierto": "Hit probability", "Defensa añadida": "Added defense", "Recuperación de HP": "HP recovery",
  "Recuperación de SP": "SP recovery", "Recuperación de MP": "MP recovery", "Resistencia mágica": "Magic resistance", "Resistencia al veneno": "Poison resistance", "Absorción física": "Physical absorption",
  "Absorción mágica": "Magic absorption", "Daño de ataques seguidos": "Combo damage", "Ahorro de MP": "MP saving", "Probabilidad de lanzar magia": "Spell casting probability", "Daño convertido en MP": "Damage converted to MP",
  "Probabilidad de crítico": "Critical chance", "Experiencia": "Experience", "Oro": "Gold", "Daño": "Damage", "Sin puntos para repartir": "No points to assign", "Bonos del equipo": "Equipment bonuses",
  "Cabeza": "Head", "Cuerpo": "Body", "Brazos": "Arms", "Calzado": "Footwear", "Cuello": "Neck", "Mano izquierda": "Left hand", "Mano derecha": "Right hand", "Dos manos": "Two hands",
  "Anillo dcho.": "Right ring", "Anillo izdo.": "Left ring", "Espalda": "Back", "Cuerpo completo": "Full body",
  // ---- registro de mensajes
  "Has muerto.": "You died.", "Pesa demasiado para llevarlo.": "It is too heavy to carry.", "No tienes sitio en la mochila.": "There is no room in your bag.",
  "Un objeto se ha gastado del todo: hay que repararlo.": "An item is completely worn out: it needs repairing.", "Vuelves al punto de inicio.": "You return to the starting point.",
  "Vuelves a la granja con el HP lleno.": "You return to the farm with full HP.", "Se ha perdido la conexión con el servidor.": "The connection to the server was lost.",
  "No tienes ese objeto.": "You do not have that item.", "¡Cripta completada! Recoge el botín y regresa por un portal (E).": "Crypt completed! Collect the loot and return through a portal (E).",
  "¡Cripta completada!": "Crypt completed!", "Minimapa oculto (se vuelve a activar en Opciones).": "Minimap hidden (turn it back on in Options).", "No tienes MP suficiente.": "Not enough MP.",
  "Hechizo cancelado.": "Spell cancelled.", "Modo de ataque automático activado.": "Auto attack mode on.", "Modo de ataque automático desactivado.": "Auto attack mode off.",
  "Ataque automático activado.": "Auto attack on.", "Ataque automático desactivado.": "Auto attack off.", "Nivel de detalle: bajo": "Detail level: low", "Nivel de detalle: medio": "Detail level: medium",
  "Nivel de detalle: alto": "Detail level: high", "Cambiado a modo correr.": "Switched to run mode.", "Cambiado a modo andar.": "Switched to walk mode.", "Sonido activado.": "Sound on.", "Sonido desactivado.": "Sound off.",
  "Modo de ataque seguro activado.": "Safe attack mode on.", "Modo de ataque seguro desactivado.": "Safe attack mode off.", "Modo de combate.": "Combat mode.", "Modo de paz.": "Peace mode.",
  "No tienes ninguna habilidad especial lista.": "You have no special ability ready.", "Mapa ampliado": "Large map", "Mapa normal": "Normal map", "Gráficos clásicos": "Classic graphics",
  "Gráficos remastered": "Remastered graphics", "Partida guardada": "Game saved", "Aún no hay nada guardado": "Nothing saved yet",
  "Bienvenido a la granja de Aresden. Pulsa F1 para ver las novedades y qué probar.": "Welcome to the Aresden farm. Press F1 for the news and what to test.",
  "Cripta de esqueletos: pisa el teletransportador de middled1n (78–80, 69–71) de Aresfarm.": "Skeleton crypt: step on the middled1n teleporter (78–80, 69–71) in Aresfarm.",
  "Partida en línea: se ha cargado tu progreso. Intro para hablar.": "Online game: your progress was loaded. Enter to chat.", "Partida en línea. Pulsa Intro para hablar con los demás.": "Online game. Press Enter to talk to the others.",
  "Faltan los datos de Skeleton. Recarga la página.": "Skeleton data is missing. Reload the page.", "Cripta de esqueletos": "Skeleton crypt",
  "Summons": "Summons", "Rename": "Rename", "Mode": "Mode", "Reset talents": "Reset talents", "Peace": "Peace", "Attack": "Attack", "You have no companion ball.": "You have no companion ball.",
  "solo existen Aresfarm, sus tiendas y la cripta": "only Aresfarm, its shops and the crypt exist",
  "Cristal de hielo": "Ice Crystal",
  "Fantasma skeleton": "Ghost skeleton", "Recall: vuelves a la granja.": "Recall: you return to the farm.", "Recall cancelado.": "Recall cancelled.", "Recall interrumpido: te moviste o entraste en combate.": "Recall interrupted: you moved or entered combat.",
  "¡El rey carmesí ruge y os aturde!": "The Crimson King roars and stuns you!", "¡Brasas bajo tus pies!": "Embers under your feet!", "¡Los huesos se levantan!": "The bones rise!",
  "¡Clones de sombra! Solo uno es real.": "Shadow clones! Only one is real.", "¡El rey umbrío drena a tu compañero! Aléjalo o rompe el vínculo.": "The Umbral King drains your companion! Move it away or break the link.", "El vínculo se rompe.": "The link breaks.",
  "¡Escudo de hielo! Rompe los cristales.": "Ice shield! Break the crystals.", "¡El escudo se rompe!": "The shield breaks!", "¡Tu compañero se congela! Acércate para liberarlo.": "Your companion is frozen! Get close to free it.",
  "¡El rey dorado se oscurece! Fase 2.": "The Golden King darkens! Phase 2.", "¡El rey dorado se congela! Fase 3.": "The Golden King freezes over! Phase 3.", "El rey dorado se enfurece.": "The Golden King grows furious.",
  "Hospital de compañeros": "Companion hospital", "Cuidados": "Care", "Bolas": "Balls", "Curar: por punto de vida · Revivir: caro": "Heal: per hit point · Revive: expensive", "Bolas de prueba (nivel 1)": "Test balls (level 1)", "Oro": "Gold",
  "No llevas ninguna bola de compañero.": "You carry no companion ball.", "Un caído no se invoca hasta revivirlo.": "A fallen one cannot be summoned until revived.", "Inconsciente": "Unconscious", "Herido": "Wounded", "Sano": "Healthy", "ATQ": "ATK", "PAZ": "PCE",
  "los hechizos son de tu compañero": "spells belong to your companion", "Los hechizos son de tu compañero (F10: talentos).": "Spells belong to your companion (F10: talents).",
  "solo existen Aresfarm y las criptas": "only Aresfarm and the crypts exist", "sin puntos de talento": "no talent points", "ya está al máximo": "already at maximum",
  "no existe": "does not exist", "no hay talentos que reiniciar": "no talents to reset", "no tienes compañero": "you have no companion",
  "acércate a la enfermera": "get close to the nurse", "no necesita cuidados": "needs no care", "no disponible": "not available", "tu compañero está inconsciente: llévalo al hospital de compañeros": "your companion is unconscious: take it to the companion hospital",
  "ya conoces esa habilidad": "you already know that skill", "no tienes compañero": "you have no companion", "no tienes compañero fuera": "your companion is not out", "objetivo no válido": "invalid target",
  "Alt + clic sobre un monstruo para que tu compañero lo ataque.": "Alt + click a monster to make your companion attack it.",
  "¡Nivel despejado! Recoge el botín y baja por el portal (E).": "Level cleared! Collect the loot and take the portal down (E).", "¡Nivel despejado!": "Level cleared!",
  "¡Nivel despejado! Baja por el portal (E).": "Level cleared! Take the portal down (E).", "¡Cripta despejada! Busca la salida (E).": "Crypt cleared! Find the exit (E).",
  "mata a todos los esqueletos para continuar": "kill all the skeletons to continue", "no hay más niveles": "there are no more levels", "faltan los datos de la cripta; recarga la página": "crypt data is missing; reload the page",
  "Salir de la cripta": "Leave the crypt", "Salida de la cripta · ¡victoria!": "Crypt exit · victory!", "Reiniciar (nivel 1)": "Restart (level 1)",
  "Salas olvidadas": "Forgotten Halls", "Laberinto de osarios": "Ossuary Maze", "Galerías concéntricas": "Concentric Galleries", "Islas sobre el lago": "Islands on the Lake", "Sala de los pilares": "Pillar Hall", "Cruce de las cuatro criptas": "Crossing of the Four Crypts",
  "Rey esqueleto carmesí": "Crimson Skeleton King", "Rey esqueleto umbrío": "Umbral Skeleton King", "Rey esqueleto glacial": "Glacial Skeleton King", "Rey esqueleto dorado": "Golden Skeleton King",
  "Para asignar un atajo usa primero un objeto o un hechizo, luego pulsa Ctrl+": "To assign a shortcut, first use an item or a spell, then press Ctrl+",
  // ---- motivos de rechazo (servidor)
  "demasiado rápido": "too fast", "sin objetivo": "no target", "no tienes": "you do not have it", "sin puntos": "no points", "mapa no disponible": "map not available", "cargando el mapa, vuelve a intentarlo": "loading the map, try again", "ocupado o muerto": "busy or dead",
  "acércate al portal": "get close to the portal", "faltan los datos de los esqueletos; recarga la página": "skeleton data is missing; reload the page", "no se puede equipar": "cannot be equipped",
  "solo para hombres": "males only", "solo para mujeres": "females only", "nada que recoger": "nothing to pick up", "sin oro": "no gold", "no se puede usar": "cannot be used", "no implementado": "not implemented",
  "no existe": "does not exist", "ya la conoces": "you already know it", "no se vende": "not for sale", "oro insuficiente": "not enough gold", "no conoces ese hechizo": "you do not know that spell",
  "aún no disponible": "not available yet", "quítate el escudo y las armas a dos manos": "take off the shield and two-handed weapons", "solo se lanza con las manos libres o con una varita": "can only be cast with free hands or a wand",
  "maná insuficiente": "not enough mana", "demasiado lejos": "too far", "zona segura": "safe zone", "bloqueado": "blocked", "ocupado": "busy", "lejos": "too far", "paralizado": "paralyzed", "demasiado pesado (fuerza ": "too heavy (strength ",
  // ---- estados
  "paralizado": "paralyzed", "congelado": "frozen", "protegido": "protected", "invisible": "invisible", "en furia": "berserk", "envenenado": "poisoned", "confuso": "confused",
  // ---- habilidades, colores, mapas
  "Minería": "Mining", "Pesca": "Fishing", "Agricultura": "Farming", "Magia": "Magic", "Ataque sin armas": "Hand-Attack", "Arquería": "Archery", "Espada corta": "Short-Sword", "Espada larga": "Long-Sword",
  "Esgrima": "Fencing", "Hacha": "Axe-Attack", "Escudo": "Shield", "Alquimia": "Alchemy", "Fabricación": "Manufacturing", "Martillo": "Hammer", "Fingir muerte": "Pretend-Corpse", "Bastón": "Staff-Attack",
  "Natural": "Natural", "Azul índigo": "Indigo", "Oliva": "Olive", "Dorado": "Gold", "Carmesí": "Crimson", "Verde": "Green", "Gris": "Gray", "Aguamarina": "Aquamarine", "Blanco": "White", "Rojo": "Red", "Azul": "Blue",
  "Marrón": "Brown", "Negro": "Black", "Morado": "Purple",
  "Mina de Aresden": "Aresden Mine", "Cuartel de Aresden": "Aresden Barracks", "Almacén": "Warehouse", "Templo de resurrección": "Resurrection Temple", "Prisión": "Prison", "Torre del mago": "Wizard Tower",
  "Herrería": "Blacksmith", "Sala del gremio": "Guild Hall", "Sala de mando": "Command Hall", "Vestíbulo": "Vestibule", "Galería de los guardianes": "Guardians' Gallery", "Cripta oeste": "West Crypt",
  "Cámara de los pilares": "Pillar Chamber", "Cripta este": "East Crypt", "Galería profunda": "Deep Gallery", "Regresar a Aresfarm": "Return to Aresfarm", "Salida de la cripta": "Crypt exit",
  // ---- atributos de objetos
  "Daño añadido": "Added damage", "Daño extra añadido": "Extra added damage", "Velocidad de ataque -1": "Attack speed -1",
};

const num = "(-?\\d+(?:[.,]\\d+)?)";
const PATTERNS = [
  [/^¡Subes al nivel (\d+)! Tienes 3 puntos para repartir \(botón Level Up\)\.$/, m => `You reach level ${m[1]}! You have 3 points to assign (Level Up button).`],
  [/^Nivel (\d+)$/, m => `Level ${m[1]}`],
  [/^Has matado a (.+)\.$/, m => `You killed ${m[1] === "un monstruo" ? "a monster" : m[1]}.`],
  [/^Recoges (\d+) de oro\.$/, m => `You pick up ${m[1]} gold.`],
  [/^Recoges: (.+)\.$/, m => `You pick up: ${m[1]}.`],
  [/^¡Objeto único! (.+)\.$/, m => `Unique item! ${m[1]}.`],
  [/^¡Objeto raro! (.+)\.$/, m => `Rare item! ${m[1]}.`],
  [/^Usas (.+)\.$/, m => `You use ${m[1]}.`],
  [/^Equipas (.+)\.$/, m => `You equip ${m[1]}.`],
  [/^Te quitas (.+)\.$/, m => `You take off ${m[1]}.`],
  [/^Ordenas a (.+) atacar a (.+)\.$/, m => `You order ${m[1] === "tu compañero" ? "your companion" : m[1]} to attack ${t(m[2]) === m[2] ? m[2] : t(m[2])}.`],
  [/^Recall: quédate quieto (\d+) segundos…$/, m => `Recall: stand still for ${m[1]} seconds…`],
  [/^No se puede: recall en recarga: (\d+) s\.$/, m => `Cannot: recall is cooling down: ${m[1]} s.`],
  [/^No puedes equiparlo: (.+)\.$/, m => `You cannot equip it: ${t(m[1])}.`],
  [/^No puedes lanzarlo: (.+)\.$/, m => `You cannot cast it: ${t(m[1])}.`],
  [/^No puedes usar el portal: (.+)\.$/, m => `You cannot use the portal: ${t(m[1])}.`],
  [/^No puedes aprenderlo: (.+)\.$/, m => `You cannot learn it: ${t(m[1])}.`],
  [/^Aprendes (.+)\.$/, m => `You learn ${m[1]}.`],
  [/^Entras en (.+)\.$/, m => `You enter ${t(m[1])}.`],
  [/^Estás (.+)\.$/, m => `You are ${t(m[1])}.`],
  [/^Ya no estás (.+)\.$/, m => `You are no longer ${t(m[1])}.`],
  [/^No tienes pociones de (HP|MP|SP)\.$/, m => `You have no ${m[1]} potions.`],
  [/^necesita (\d+) puntos en la rama$/, m => `needs ${m[1]} points in the branch`],
  [/^nombre no válido \(1 a 12 letras o cifras\)$/, () => "invalid name (1 to 12 letters or digits)"],
  [/^No se puede: (.+)\.$/, m => `Cannot do that: ${t(m[1])}.`],
  [/^(.+) aprende (.+) \((\d+)\)\.$/, m => `${m[1]} learns ${m[2]} (${m[3]}).`],
  [/^Has reiniciado los talentos de (.+) por (\d+) de oro\.$/, m => `You reset ${m[1]}'s talents for ${m[2]} gold.`],
  [/^Tu compañero se llama ahora (.+)\.$/, m => `Your companion is now called ${m[1]}.`],
  [/^(.+) te acompaña\.$/, m => `${m[1]} follows you.`],
  [/^No tienes (.+)\.$/, m => `You do not have ${m[1]}.`],
  [/^Atajo asignado a \[(.+)\]\.$/, m => `Shortcut assigned to [${m[1]}].`],
  [/^No hay nada asignado a \[(.+)\]\. Usa un objeto o hechizo y pulsa Ctrl\+(.+) para asignarlo\.$/, m => `Nothing is assigned to [${m[1]}]. Use an item or spell and press Ctrl+${m[2]} to assign it.`],
  [/^Esto reemplaza el progreso de (.+) con el del archivo\. ¿Seguir\?$/, m => `This replaces the progress of ${m[1]} with the one in the file. Continue?`],
  [/^Cargando gráficos… (.*)$/, m => `Loading graphics… ${m[1]}`],
  [/^No se pudieron cargar los datos \((.*)\)\. Abre la prueba con «Abrir prueba web\.bat», no con doble clic en el HTML\.$/, m => `Could not load the data (${m[1]}). Open the test with “Abrir prueba web.bat”, not by double-clicking the HTML.`],
  [/^Falta el gráfico (.+)\. Recarga la página\.$/, m => `Graphic ${m[1]} is missing. Reload the page.`],
  [/^No se pudo cargar (.+)$/, m => `Could not load ${m[1]}`],
  [/^Puntos por repartir: (\d+)$/, m => `Points to assign: ${m[1]}`],
  [/^Puntos para repartir: (.+)$/, m => `Points to assign: ${m[1]}`],
  [/^Tu instancia sigue abierta: (\d+) de (\d+) esqueletos restantes\. Puedes continuar o reiniciarla con otro mapa y enemigos nuevos\.$/, m => `Your instance is still open: ${m[1]} of ${m[2]} skeletons left. You can continue or restart it with a new map and new enemies.`],
  [/^Nivel (\d+) \/ (\d+)( · JEFE)?$/, m => `Level ${m[1]} / ${m[2]}${m[3] ? " · BOSS" : ""}`],
  [/^Cripta · nivel (\d+) · (.+)$/, m => `Crypt · level ${m[1]} · ${t(m[2])}`], [/^Cámara del (.+)$/, m => `Chamber of the ${t(m[1][0].toUpperCase() + m[1].slice(1))}`], [/^Bajar al nivel (\d+)$/, m => `Go down to level ${m[1]}`],
  [/^Has llegado hasta el nivel (\d+) de (\d+)\. ¿Quieres reiniciar la cripta desde el nivel 1 o continuar en el nivel (\d+)\?$/, m => `You have reached level ${m[1]} of ${m[2]}. Restart the crypt from level 1 or continue at level ${m[3]}?`], [/^Continuar en el nivel (\d+)$/, m => `Continue at level ${m[1]}`],
  [/^(.+) \(cerrado\)$/, m => `${t(m[1])} (closed)`],
  [/^(.+) \((.+) nv (\d+)\) · (Inconsciente|Herido|Sano)$/, m => `${m[1]} (${m[2]} lv ${m[3]}) · ${t(m[4])}`], [/^(.+) nv (\d+)  (\d+)\/(\d+)$/, m => `${m[1]} lv ${m[2]}  ${m[3]}/${m[4]}`], [/^(.+) nv (\d+)$/, m => `${m[1]} lv ${m[2]}`],
  [/^Has (revivido|curado) a (.+) por (\d+) de oro\.$/, m => `You ${m[1] === "revivido" ? "revived" : "healed"} ${m[2]} for ${m[3]} gold.`], [/^Compras la bola de (.+) \((.+)\) por (\d+) de oro\.$/, m => `You buy the ${m[1]} ball (${m[2]}) for ${m[3]} gold.`],
  [/^(.+) está en paz: solo te sigue\.$/, m => `${m[1]} is at peace: it only follows you.`], [/^(.+) ataca todo lo que ve\.$/, m => `${m[1]} attacks everything it sees.`], [/^(.+) ataca el objetivo marcado\.$/, m => `${m[1]} attacks the marked target.`],
  [/^Aprendes la habilidad (.+) \((\d+)%\)\.$/, m => `You learn the skill ${m[1]} (${m[2]}%).`], [/^(.+): (Attack|Peace) \(click\)$/, m => `${m[1]}: ${m[2]} (click)`],
  [/^Daño crítico \+(\d+)$/, m => `Critical damage +${m[1]}`], [/^Daño de veneno \+(\d+)$/, m => `Poison damage +${m[1]}`],
  [/^(\d+) % más ligero$/, m => `${m[1]}% lighter`], [/^Probabilidad de lanzar magia \+(\d+) %$/, m => `Spell casting probability +${m[1]}%`],
  [/^Convierte (\d+) % del daño en MP$/, m => `Converts ${m[1]}% of damage to MP`], [/^Probabilidad de crítico \+(\d+) %$/, m => `Critical chance +${m[1]}%`],
  [/^Resistencia al veneno \+(\d+) %$/, m => `Poison resistance +${m[1]}%`], [/^Probabilidad de acierto \+(\d+)$/, m => `Hit probability +${m[1]}`],
  [/^Recuperación de (HP|SP|MP) (\d+) %$/, m => `${m[1]} recovery ${m[2]}%`], [/^Resistencia mágica \+(\d+) %$/, m => `Magic resistance +${m[1]}%`],
  [/^Absorción (física|mágica) \+(\d+) %$/, m => `${m[1] === "física" ? "Physical" : "Magic"} absorption +${m[2]}%`], [/^Daño de ataques seguidos \+(\d+)$/, m => `Combo damage +${m[1]}`],
  [/^Oro \+(\d+) %$/, m => `Gold +${m[1]}%`], [/^Daño (\d+d\d+.*)$/, m => `Damage ${m[1].replace("grandes", "large")}`],
  [/^demasiado pesado \(fuerza (\d+)\)$/, m => `too heavy (strength ${m[1]})`], [/^Habilidad (\d+)$/, m => `Skill ${m[1]}`],
  [new RegExp("^Daño " + num + "–" + num + "$"), m => `Damage ${m[1]}–${m[2]}`],
];
void num;

const cache = new Map();
export function t(s) {
  if (lang !== "en" || typeof s !== "string" || s.length < 2) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  let out = EN[s];
  if (out === undefined) {
    const key = s.trim();
    if (key !== s && EN[key] !== undefined) out = s.replace(key, EN[key]);
    else for (const [re, fn] of PATTERNS) { const m = re.exec(key); if (m) { out = fn(m); break; } }
  }
  if (out === undefined) out = s;
  if (cache.size < 4000) cache.set(s, out);
  return out;
}

export const getLang = () => lang;
export function onLang(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setLang(l) {
  if (l !== "en" && l !== "es") return;
  lang = l; cache.clear();
  try { localStorage.setItem(LS, l); } catch {}
  document.documentElement.lang = l;
  translateDom(document.body);
  for (const fn of listeners) fn(l);
}

// ---- DOM: nodos de texto y atributos; los originales se guardan para poder volver a español
const orig = new WeakMap();
const ATTRS = ["title", "placeholder", "aria-label"];
function textNode(n) {
  if (!orig.has(n)) { if (lang !== "en") return; orig.set(n, n.nodeValue); }
  const o = orig.get(n), tr = lang === "en" ? t(o) : o;
  if (n.nodeValue !== tr) n.nodeValue = tr;
}
function attrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute?.(a)) continue;
    const key = "i18n_" + a;
    if (!el[key]) { if (lang !== "en") continue; el[key] = el.getAttribute(a); }
    const tr = lang === "en" ? t(el[key]) : el[key];
    if (el.getAttribute(a) !== tr) el.setAttribute(a, tr);
  }
}
export function translateDom(root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n = w.currentNode;
  while (n) {
    if (n.nodeType === 3) { if (n.nodeValue.trim() && !/^(STYLE|SCRIPT)$/.test(n.parentNode?.nodeName)) textNode(n); }
    else if (n.nodeType === 1) attrs(n);
    n = w.nextNode();
  }
}
let obs = null;
export function startDomTranslation() {
  document.documentElement.lang = lang;
  translateDom(document.body);
  if (obs) return;
  obs = new MutationObserver(muts => {
    if (lang !== "en") return;
    obs.disconnect();
    for (const m of muts) {
      if (m.type === "characterData") { orig.delete(m.target); textNode(m.target); }
      else if (m.type === "childList") for (const n of m.addedNodes) translateDom(n.nodeType === 3 ? n.parentNode : n);
      else if (m.type === "attributes") { delete m.target["i18n_" + m.attributeName]; attrs(m.target); }
    }
    obs.observe(document.body, cfg);
  });
  const cfg = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS };
  obs.observe(document.body, cfg);
}
