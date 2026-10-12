import { CHAINS } from "../shared/systems/evolutions.js";
// Idiomas: español (el texto del código) e inglés. `t(texto)` traduce el texto en español a inglés cuando el idioma es "en";
// los textos que ya están en inglés (los del juego original) se dejan tal cual. Las frases con datos van en PATTERNS.
// El DOM se traduce solo (nodos de texto y atributos) y se restaura al volver a español.
const LS = "hbweb.lang";
let lang = "es";
try { lang = localStorage.getItem(LS) || (/^en/i.test(navigator.language || "") ? "en" : "es"); } catch {}
if (lang !== "en" && lang !== "es") lang = "es";
const listeners = new Set();

const EN = {
  "Gail solo evoluciona compañeros de quien ha vencido al Rey dorado": "Gail only evolves companions of those who defeated the Golden King",
  "Nivel": "Level", "Cripta nivel": "Crypt level", "Nivel del compañero": "Companion level", "Nivel del summon": "Summon level", "Misión": "Quest", "Línea de misiones completada": "Quest line complete", "Eres un maestro de tu camino.": "You are a master of your path.", "Diario de misiones": "Quest journal", "Misión cumplida": "Quest complete", "de oro": "gold",
  "Guerrero": "Warrior", "Mago": "Mage", "Invocador": "Summoner", "ya tienes un summon de esa especie: deben ser distintos": "you already have a summon of that species: they must be different",
  "elige Healer, Buffer o Aura": "choose Healer, Buffer or Aura",
  // ---- 0.50.7
  "el oro no se puede tirar: usa el intercambio": "gold can't be dropped: use trade",
  "Elige un summon de escuela (Orc fuego, Pixie hielo, Skeleton rayo) y enséñale hechizos con tu Int y tu oro.": "Choose a school summon (Orc fire, Pixie ice, Skeleton lightning) and teach it spells with your Int and gold.",
  "Todo": "All", "Grupo": "Party", "Clan": "Guild", "Sistema": "System",
  // ---- modo online (server/server.mjs, connection.js, main.js)
  " · conectados: ": " · online: ", "El servidor es de otra versión del juego. Recarga la página (Ctrl+F5) o espera a que se actualice.": "The server runs a different version of the game. Reload the page (Ctrl+F5) or wait for the update.",
  "El servidor no está disponible ahora mismo: prueba local (un jugador, se guarda en este navegador).": "The server is not available right now: local test (single player, saved in this browser).",
  "Tu cuenta y tu personaje se guardan en el servidor: puedes entrar desde cualquier dispositivo.": "Your account and character are saved on the server: you can log in from any device.",
  "Usuario o contraseña incorrectos.": "Wrong username or password.", "Ese usuario ya existe.": "That username already exists.", "El usuario debe tener de 3 a 16 letras, números, _ o -.": "The username must have 3 to 16 letters, numbers, _ or -.",
  "La contraseña debe tener de 6 a 64 caracteres.": "The password must have 6 to 64 characters.", "Demasiados intentos. Espera unos minutos.": "Too many attempts. Wait a few minutes.",
  "Demasiadas cuentas creadas desde tu conexión. Inténtalo más tarde.": "Too many accounts created from your connection. Try again later.", "El servidor está lleno.": "The server is full.",
  "Crea tu personaje.": "Create your character.", "Has entrado desde otro sitio.": "You logged in from somewhere else.", "Estás silenciado.": "You are muted.", "Sin respuesta.": "No response.",
  "El servidor se apaga.": "The server is shutting down.", "El servidor se reinicia. Vuelve a entrar en un minuto.": "The server is restarting. Log back in in a minute.", "Cuenta bloqueada.": "Account blocked.", "Bloqueado.": "Blocked.",
  "Nombre de personaje no válido.": "Invalid character name.", "Ese nombre de personaje ya está en uso.": "That character name is already in use.",
  "no tienes maná para invocarlo (": "not enough mana to summon it (",
  "tu cliente es la v": "your client is v",
  "¡Aviso! El servidor está en otra versión que tu cliente: puede que lo nuevo no funcione (por ejemplo, comprar bolas nuevas). Reinicia el servidor o recarga la página (Ctrl+F5).": "Warning! The server runs a different version than your client: new features may not work (e.g. buying new balls). Restart the server or reload the page (Ctrl+F5).",
  "Inicia sesión primero.": "Log in first.",
  "Se cortó la conexión con el servidor.": "The connection to the server was lost.", "Dirección del servidor no válida.": "Invalid server address.", "Error del servidor.": "Server error.",
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
  "Bando": "Side", "Personalidad": "Personality", "Prudente": "Cautious", "Bromista": "Joker", "Decidido": "Bold",
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
  "Guardar ahora": "Save now", "Repetir tutorial": "Repeat tutorial", "Exportar copia": "Export backup", "Importar copia": "Import backup", "Cerrar sesión": "Log out", "Clásico": "Classic", "Idioma": "Language",
  "Has muerto": "You died", "Reaparecer": "Respawn",
  "Clic izquierdo: andar (correr si el modo correr está activo) · sobre ti: recoger": "Left click: walk (run if run mode is on) · on yourself: pick up",
  "Clic derecho: atacar al monstruo adyacente ·": "Right click: attack the adjacent monster ·", "+clic izquierdo: ir a atacar": "+left click: go and attack",
  "ayuda ·": "help ·", "personaje ·": "character ·", "mochila ·": "bag ·", "magia ·": "magic ·", "sistema": "system", ": atajos (asigna con": ": shortcuts (assign with", "lo último usado) ·": "the last one used) ·",
  ": hechizo elegido": ": selected spell", "poción de vida ·": "health potion ·", "poción de maná": "mana potion", "combate/paz ·": "combat/peace ·", "ataque seguro ·": "safe attack ·", "último mensaje": "last message",
  "correr ·": "run ·", "ataque automático ·": "auto attack ·", "mapa ·": "map ·", "sonido ·": "sound ·", "susurro": "whisper", "Uso: /to nombre texto": "Usage: /to name text", "no hay nadie con ese nombre": "nobody with that name", "o cualquier letra: escribir ·": "or any letter: type ·", ": cerrar": ": close",
  "junto a un portal de la cripta (añadido de esta versión)": "next to a crypt portal (added in this version)",
  "Escribe y pulsa Intro (Esc para cancelar)": "Type and press Enter (Esc to cancel)", "Chat de grupo ($): solo tu grupo": "Party chat ($): your party only", "Grito (!): todo el mapa, nivel > 10": "Shout (!): whole map, level > 10", "Chat de bando (~): tu nación": "Side chat (~): your nation", "Chat de guild (@): tu guild": "Guild chat (@): your guild", "No hay nadie cerca a quien invitar.": "Nobody close enough to invite.", "nivel insuficiente para este canal": "level too low for this channel", "Correr (": "Run (", "Mostrar mapa (": "Show map (", "Sonido (": "Sound (", "Mejoras de esta versión": "Enhancements in this version",
  // ---- diálogos
  "No hay misiones en esta versión.": "There are no quests in this version.", "No hay grupos en esta versión.": "There are no parties in this version.",
  "1. Clic en un objeto: pon su precio (✔).": "1. Click an item: set its price (✔).", "2. Pulsa «Abrir tienda». Ok cierra sin abrir.": "2. Press «Open stall». Ok closes without opening.", "Abrir tienda": "Open stall", "Rótulo del puesto (máx. 24 letras):": "Stall sign (max. 24 letters):", "Cancelar": "Cancel", "Primero elige algún objeto de la lista y ponle precio.": "First pick an item from the list and set its price.", "Tienda": "Stall", "Precio:": "Price:", "Tu precio:": "Your price:", "c/u": "each", "Tienes": "You have", "Ficha del objeto": "Item details", "Pasa el ratón sobre un objeto para ver su sprite, sus estadísticas y cómo se compara con lo que llevas puesto.": "Hover an item to see its sprite, its stats and how it compares with what you wear.", "▲ Mejor que lo que llevas": "▲ Better than what you wear", "▼ Peor que lo que llevas": "▼ Worse than what you wear", "= Igual que lo que llevas": "= Same as what you wear", "Los puestos solo se pueden montar dentro de un warehouse.": "Stalls can only be set up inside a warehouse.", "Tu puesto se ha cerrado: lo que quedaba (objetos y oro) vuelve a ti.": "Your stall has closed: what was left (items and gold) is returned to you.", "aquí no se pueden abrir puestos (solo en los warehouses)": "stalls cannot be opened here (only in warehouses)", "no puedes abrir un puesto junto a una entrada o teletransporte": "you cannot open a stall next to an entrance or teleport", "ya tienes un puesto abierto": "you already have a stall open", 
  "No hay mejora de objetos en esta versión.": "Item upgrades are not available in this version.", "Aprende la habilidad de fabricación para usar el manual.": "Learn the manufacturing skill to use the manual.",
  "Ataque automático": "Auto attack", "Panel de estados (DR/MR)": "Status panel (DR/MR)", "Cursor clásico": "Classic cursor", "Sprites y terreno HD": "HD sprites and terrain", "Luz y viñeta": "Light and vignette", "Magia libre (sin MP)": "Free magic (no MP)",
  "Ver casillas bloqueadas": "Show blocked tiles", "Clic derecho: cerrar": "Right click: close", "Esa habilidad aún no se puede usar en esta versión.": "That skill cannot be used yet in this version.",
  "el hechizo falla": "the spell fails", "Galerías de la cripta": "Crypt galleries", "¡Cripta despejada! Recoge el botín y regresa (E).": "Crypt cleared! Collect the loot and go back (E).",
  "Volver a la cripta": "Back to the crypt", "Pantalón": "Trousers", "Probabilidad de acierto": "Hit probability", "Defensa añadida": "Added defense", "Recuperación de HP": "HP recovery",
  "Recuperación de SP": "SP recovery", "Recuperación de MP": "MP recovery", "Resistencia mágica": "Magic resistance", "Resistencia al veneno": "Poison resistance", "Absorción física": "Physical absorption",
  "Absorción mágica": "Magic absorption", "Daño de ataques seguidos": "Combo damage", "Ahorro de MP": "MP saving", "Ahorro de MP del summon": "Summon MP saving", "Probabilidad de lanzar magia": "Spell casting probability", "Daño convertido en MP": "Damage converted to MP",
  "Probabilidad de crítico": "Critical chance", "Experiencia": "Experience", "Oro": "Gold", "Arrástralo sobre la bola o usa el doble clic con el compañero fuera.": "Drag it onto the ball, or double-click it with your companion out.", "Le gusta": "Likes", "No come": "Refuses", "Daño": "Damage", "Sin puntos para repartir": "No points to assign", "Bonos del equipo": "Equipment bonuses",
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
  "Puesto": "Stall", "Montar un puesto": "Set up a stall", "Tu puesto": "Your stall", "Elige qué vender (máx. 8)": "Choose what to sell (max 8)", "No queda nada a la venta.": "Nothing left for sale.", "Recoger oro": "Collect gold", "Cerrar puesto": "Close stall", "Recuperas objetos y oro": "You get back items and gold", "Clic en una fila para comprar (Ctrl = toda la pila). Comisión 0.": "Click a row to buy (Ctrl = whole stack). 0 commission.", "Cobras con «Recoger oro». Seguirá abierto aunque te desconectes.": "Collect with «Collect gold». It stays open even if you log off.", "Tu objeto a la venta (precio por unidad)": "Your item for sale (price per unit)", "Tu puesto está abierto: sigue vendiendo aunque te desconectes.": "Your stall is open: it keeps selling while you are offline.", "No tienes oro suficiente.": "You do not have enough gold.", "No cabe en tu mochila.": "It does not fit in your bag.", "Acércate al puesto.": "Get closer to the stall.", "Un puesto admite hasta 8 objetos.": "A stall holds up to 8 items.", "Monta el puesto junto a ti": "Sets the stall up next to you",
  "Apuestas · Arena": "Betting · Arena", "Combate": "Fight", "Historial": "History", "Solo miras: la casa se queda un 10 %.": "You only watch: the house keeps 10%.", "Subir apuesta": "Raise bet", "Bajar apuesta": "Lower bet", "Apuesta máxima": "Maximum bet", "Otro retador": "Another challenger", "Se genera otro combate": "Generates another fight", "Cambiar de compañero": "Change companion", "Elige otro de tus compañeros": "Pick another of your companions", "Últimos combates": "Latest fights", "Neto": "Net", "Aún no has apostado.": "You have not bet yet.", "Necesitas un compañero (bola) sano para combatir.": "You need a healthy companion (ball) to fight.", "Hay un combate en curso…": "A fight is in progress…", "acércate al corredor de apuestas": "get close to the bookmaker", "cargando la arena, inténtalo de nuevo en un momento": "loading the arena, try again in a moment", "no hay sitio en la arena": "no room in the arena", "hay un combate en curso": "a fight is in progress", "esa oferta ya no existe": "that offer no longer exists", "apuesta fuera de límites": "bet out of limits",
  "Panel de estados activado (aura del summon).": "Status panel enabled (summon aura).",
  "acércate al mago": "get close to the mage", "no hay puntos que recuperar": "there are no points to recover", "Hospital de compañeros": "Companion hospital", "Curar o revivir compañeros": "Heal or revive companions", "Bolas de prueba": "Test balls", "Cuidados": "Care", "Bolas": "Balls", "Caramelos": "Candies", "Curar: por punto de vida · Revivir: caro": "Heal: per hit point · Revive: expensive", "Bolas de prueba (nivel 1)": "Test balls (level 1)", "Oro": "Gold",
  "Granjero: aquí tienes todas las semillas y el Manual de Cultivo.": "Farmer: here are all the seeds and the Farming Manual.",
  "Usa el manual para aprender Farming; la azada se compra en la herrería. Siembra la bolsa de semillas en tierra libre y cosecha con la azada.": "Use the manual to learn Farming; the hoe is sold at the blacksmith. Sow a seed bag on free ground and harvest with the hoe.",
  "CUIDADOS: cura a los heridos (2 de oro por punto de vida) o revive a los caídos (más caro).": "CARE: heals the wounded (2 gold per HP) or revives the fallen (costs more).", "EVOLUCIÓN: Orc, Pixie y Skeleton nivel 50+ pasan a Demon, Frost y Liche (nivel 1).": "EVOLUTION: level 50+ Orc, Pixie and Skeleton become Demon, Frost and Liche (level 1).", "BOLAS: compra una bola de nivel 1; previsualiza antes.": "BALLS: buy a level 1 ball; preview it first.", "CARAMELOS: rojo vida, azul maná, verde revive. Arrástralos al compañero.": "CANDIES: red life, blue mana, green revives. Drag them onto your companion.", "COMIDA: la de la granja da mejoras permanentes; arrástrala al compañero o a su bola.": "FOOD: farm produce gives permanent boosts; drag it onto the companion or its ball.", "DOOMY: Healer (verde) cura, Buff (amarillo) protege, Aura (azul) regenera.": "DOOMY: Healer (green) heals, Buff (yellow) protects, Aura (blue) regenerates.", "Ayuda": "Help", "No llevas ninguna bola de compañero.": "You carry no companion ball.", "Un caído no se invoca hasta revivirlo.": "A fallen one cannot be summoned until revived.", "Inconsciente": "Unconscious", "Herido": "Wounded", "Sano": "Healthy", "ATQ": "ATK", "PAZ": "PCE",
  "los hechizos son de tu compañero": "spells belong to your companion", "Los hechizos son de tu compañero (F10: talentos).": "Spells belong to your companion (F10: talents).",
  "solo existen Aresfarm y las criptas": "only Aresfarm and the crypts exist", "sin puntos de talento": "no talent points", "ya está al máximo": "already at maximum",
  "enséñasela a tu summon en el Mago de la torre": "teach it to your summon at the Sorcerer in the tower", "elige primero un summon de escuela (fuego, hielo o rayo)": "first choose a school summon (fire, ice or lightning)", "esa magia no es de la escuela de tu summon": "that spell is not from your summon's school", "tu summon ya la conoce": "your summon already knows it", "solo se lanza la magia de la escuela de tu summon": "only your summon school's magic can be cast", "tu summon no domina esa magia": "your summon does not master that spell",
  "esa magia es de los summons de apoyo": "that spell belongs to the support summons", "tu summon no tiene maná": "your summon has no mana", "necesita nivel 50": "needs level 50", "esta especie no tiene versión superior": "this species has no higher form", "primero hay que revivirlo": "revive it first", "guárdalo antes": "store it first",
  "necesitas un summon de la escuela Fire": "you need a Fire school summon", "necesitas un summon de la escuela Ice": "you need an Ice school summon", "necesitas un summon de la escuela Lightning": "you need a Lightning school summon",
  "no existe": "does not exist", "tu compañero no puede mejorar más con esto": "your companion cannot improve any further with this", " gana +1 de vida máxima.": " gains +1 max health.", " gana +1 de maná máximo.": " gains +1 max mana.", " gana +1 de ataque.": " gains +1 attack.", "tu compañero no está inconsciente": "your companion is not unconscious", "tu compañero está inconsciente: necesita el caramelo verde": "your companion is unconscious: it needs the green candy", "tu compañero ya tiene la vida completa": "your companion already has full health", "invoca al compañero para darle maná": "summon your companion to give it mana", "tu compañero ya tiene el maná completo": "your companion already has full mana", "ya eligió otra clase": "this Dummy already has another class", "no es para este compañero": "not for this companion", "no hay talentos que reiniciar": "no talents to reset", "no tienes compañero": "you have no companion",
  "acércate a la enfermera": "get close to the nurse", "no necesita cuidados": "needs no care", "no disponible": "not available", "tu compañero está inconsciente: llévalo al hospital de compañeros": "your companion is unconscious: take it to the companion hospital",
  "ya conoces esa habilidad": "you already know that skill", "no tienes compañero": "you have no companion", "no tienes compañero fuera": "your companion is not out", "objetivo no válido": "invalid target",
  "Shift + clic derecho sobre un monstruo para que tu compañero lo ataque.": "Shift + click a monster to make your companion attack it.",
  "¡Nivel despejado! Recoge el botín y baja por el portal (E).": "Level cleared! Collect the loot and take the portal down (E).", "¡Nivel despejado!": "Level cleared!",
  "¡Nivel despejado! Baja por el portal (E).": "Level cleared! Take the portal down (E).", "¡Cripta despejada! Busca la salida (E).": "Crypt cleared! Find the exit (E).",
  "mata a todos los esqueletos para continuar": "kill all the skeletons to continue", "ya no estás en el grupo de esta cripta: te sacan fuera": "you are no longer in this crypt's party: you are taken out", "no hay más niveles": "there are no more levels", "faltan los datos de la cripta; recarga la página": "crypt data is missing; reload the page",
  "en la arena solo se mira": "in the arena you can only watch", "no estás en un grupo": "you are not in a party", "los hechizos están cerrados": "spells are closed", "Los hechizos están cerrados.": "Spells are closed.",
  "Info de objetos del suelo": "Ground item info", "Info de objetos del suelo (atributos y precio)": "Ground item info (stats and price)",
  "Salir de la cripta": "Leave the crypt", "Salida de la cripta · ¡victoria!": "Crypt exit · victory!", "Reiniciar (nivel 1)": "Restart (level 1)",
  "Salas olvidadas": "Forgotten Halls", "Laberinto de osarios": "Ossuary Maze", "Galerías concéntricas": "Concentric Galleries", "Islas sobre el lago": "Islands on the Lake", "Sala de los pilares": "Pillar Hall", "Cruce de las cuatro criptas": "Crossing of the Four Crypts",
  "Rey esqueleto carmesí": "Crimson Skeleton King", "Rey esqueleto umbrío": "Umbral Skeleton King", "Rey esqueleto glacial": "Glacial Skeleton King", "Rey esqueleto dorado": "Golden Skeleton King",
  "Para asignar un atajo usa primero un objeto o un hechizo, luego pulsa Ctrl+": "To assign a shortcut, first use an item or a spell, then press Ctrl+",
  // ---- equipo de clase y báculos (v0.62.0)
  "Solo para: ": "Only for: ", "nivel 50 necesario": "level 50 required",
  "solo para Guerrero": "warriors only", "solo para Mago": "mages only", "solo para Invocador": "summoners only",
  "solo para Guerrero / Mago": "warriors and mages only", "solo para Guerrero / Invocador": "warriors and summoners only", "solo para Mago / Invocador": "mages and summoners only",
  "necesitas la Ice Wand en la mano": "you need the Ice Wand in your hand", "necesitas el Darkness Staff en la mano": "you need the Darkness Staff in your hand", "necesitas el Hero Staff en la mano": "you need the Hero Staff in your hand", "necesitas el Psychic Controller en la mano": "you need the Psychic Controller in your hand",
  "Báculo maestro: ": "Master staff: ", "Báculo de escuela: ": "School staff: ", "controla a Frost": "controls Frost", "controla al Liche": "controls the Lich", "controla al Demon": "controls the Demon", "controla a Beholder, Centaurus y Stalker": "controls Beholder, Centaurus and Stalker",
  // ---- motivos de rechazo (servidor)
  "demasiado rápido": "too fast", "sin objetivo": "no target", "no tienes": "you do not have it", "sin puntos": "no points", "mapa no disponible": "map not available", "cargando el mapa, vuelve a intentarlo": "loading the map, try again", "ocupado o muerto": "busy or dead",
  "acércate al portal": "get close to the portal", "faltan los datos de los esqueletos; recarga la página": "skeleton data is missing; reload the page", "no se puede equipar": "cannot be equipped",
  "solo para hombres": "males only", "solo para mujeres": "females only", "nada que recoger": "nothing to pick up", "sin oro": "no gold", "no se puede usar": "cannot be used", "no implementado": "not implemented",
  "no existe": "does not exist", "ya la conoces": "you already know it", "no se vende": "not for sale", "oro insuficiente": "not enough gold", "no conoces ese hechizo": "you do not know that spell",
  "aún no disponible": "not available yet", "quítate el escudo y las armas a dos manos": "take off the shield and two-handed weapons", "solo se lanza con las manos libres o con una varita": "can only be cast with free hands or a wand",
  "maná insuficiente": "not enough mana", "demasiado lejos": "too far", "zona segura": "safe zone", "bloqueado": "blocked", "ocupado": "busy", "lejos": "too far", "paralizado": "paralyzed", "demasiado pesado (fuerza ": "too heavy (strength ",
  // ---- estados
  "paralizado": "paralyzed", "congelado": "frozen", "protegido": "protected", "invisible": "invisible", "en furia": "berserk", "envenenado": "poisoned", "confuso": "confused", "bajo una ilusión": "under an illusion", "con la armadura rota": "with broken armor", "inhibido": "inhibited",
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
  [/^Reinicias tus estadísticas: recuperas (\d+) puntos para repartir \((\d+) de oro\)\.$/, m => `You reset your stats: you recover ${m[1]} points to distribute (${m[2]} gold).`],
  [/^¡Subes al nivel (\d+)! Tienes 3 puntos para repartir \(botón Level Up\)\.$/, m => `You reach level ${m[1]}! You have 3 points to assign (Level Up button).`],
  [/^Nivel (\d+)$/, m => `Level ${m[1]}`],
  [/^Has matado a (.+)\.$/, m => `You killed ${m[1] === "un monstruo" ? "a monster" : m[1]}.`],
  [/^Recoges (\d+) de oro\.$/, m => `You pick up ${m[1]} gold.`],
  [/^Precio por unidad de (.+):$/, m => `Price per unit of ${m[1]}:`],
  [/^Recoges: (.+)\.$/, m => `You pick up: ${m[1]}.`],
  [/^Puesto: (.+) \(([+-]?[\d.]+) (daño medio|defensa)\)$/, m => `Equipped: ${m[1]} (${m[2]} ${m[3] === "defensa" ? "defence" : "avg. damage"})`],
  [/^Ranura libre: nada puesto$/, () => "Slot free: nothing equipped"],
  [/^Comida de compañero: revive a tu compañero inconsciente.$/, () => "Companion food: revives your fainted companion."],
  [/^Comida de compañero: \+1 (vida máxima|maná máximo|daño) permanente\.$/, m => `Companion food: +1 permanent ${{ "vida máxima": "max health", "maná máximo": "max mana", "daño": "damage" }[m[1]]}.`],
  [/^Comida de compañero: cura (\d+) de vida\.$/, m => `Companion food: heals ${m[1]} health.`], [/^Comida de compañero: devuelve (\d+) de maná\.$/, m => `Companion food: restores ${m[1]} mana.`],
  [/^(.+): le encanta \(\+50 %\)$/, m => `${m[1]}: loves it (+50 %)`], [/^(.+): lo rechaza$/, m => `${m[1]}: refuses it`],
  [/^Bolsa de semillas: doble clic para sembrar en tierra de cultivo \(habilidad de Agricultura (\d+)\)\.$/, m => `Seed bag: double-click to sow on farmland (Farming skill ${m[1]}).`],
  [/^Apostar por (.+)$/, m => `Bet on ${m[1]}`], [/^Si gana, cobras (\d+) de oro$/, m => `If it wins you collect ${m[1]} gold`],
  [/^Apuesta: (\d+) de oro {2}\((\d+) – (\d+)\)$/, m => `Bet: ${m[1]} gold (${m[2]} – ${m[3]})`],
  [/^(.+) nv (\d+) · (.+) · (\d+) %$/, m => `${m[1]} lv ${m[2]} · ${m[3] === "sin rama" ? "no branch" : m[3]} · ${m[4]} %`],
  [/^Ganada · (.+) vs (.+)$/, m => `Won · ${m[1]} vs ${m[2]}`], [/^Perdida · (.+) vs (.+)$/, m => `Lost · ${m[1]} vs ${m[2]}`], [/^Apostaste (\d+) por (.+)$/, m => `You bet ${m[1]} on ${m[2]}`],
  [/^Premio de la casa por la victoria de tu compañero: \+(\d+) de oro\.$/, m => `House prize for your companion's victory: +${m[1]} gold.`],
  [/^(.+) entrena en la arena: \+(\d+) de experiencia\.$/, m => `${m[1]} trains in the arena: +${m[2]} experience.`],
  [/^Apuestas (\d+) de oro por (.+) \(x([\d.]+)\)\. ¡Que empiece el combate!$/, m => `You bet ${m[1]} gold on ${m[2]} (x${m[3]}). Let the fight begin!`],
  [/^¡Has ganado (\d+) de oro! \((.+)\)$/, m => `You won ${m[1]} gold! (${m[2].replace("apuesta pendiente cobrada", "pending bet collected")})`],
  [/^Has perdido (\d+) de oro\. \((.+)\)$/, m => `You lost ${m[1]} gold. (${m[2]})`],
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
  [/^Vas casi al límite de peso \((.+)\): vende o tira lo que no uses\.$/, m => `You are close to your weight limit (${m[1]}): sell or drop what you don't use.`],
  [/^Tu mochila está casi llena \((.+)\): vende o tira lo que no uses\.$/, m => `Your bag is almost full (${m[1]}): sell or drop what you don't use.`],
  [/^Aprendes (.+)\.$/, m => `You learn ${m[1]}.`],
  [/^(.+) aprende ([^()]+)\.$/, m => `${m[1]} learns ${m[2]}.`], [/^Int (\d+) necesaria$/, m => `Int ${m[1]} needed`], [/^tu summon necesita nivel (\d+)$/, m => `your summon needs level ${m[1]}`],
  [/^Entras en (.+)\.$/, m => `You enter ${t(m[1])}.`],
  [/^Estás (.+)\.$/, m => `You are ${t(m[1])}.`],
  [/^Ya no estás (.+)\.$/, m => `You are no longer ${t(m[1])}.`],
  [/^No tienes pociones de (HP|MP|SP)\.$/, m => `You have no ${m[1]} potions.`],
  [/^necesita (\d+) puntos en la rama$/, m => `needs ${m[1]} points in the branch`],
  [/^nombre no válido \(1 a 12 letras o cifras\)$/, () => "invalid name (1 to 12 letters or digits)"],
  [/^No se puede: (.+)\.$/, m => `Cannot do that: ${t(m[1])}.`],
  [/^(.+) aprende (.+) \((\d+)\)\.$/, m => `${m[1]} learns ${m[2]} (${m[3]}).`],
  [/^tu summon necesita nivel (\d+)$/, m => `your summon needs level ${m[1]}`], [/^necesita nivel (\d+)$/, m => `needs level ${m[1]}`],
  [/^(.+) vuelve en sí con (\d+) de vida\.$/, m => `${m[1]} comes back with ${m[2]} HP.`],
  [/^(.+) no quiere comer eso$/, m => `${m[1]} does not want to eat that`],
  [/^(.+) gana +(d+) de (vida máxima|maná máximo|ataque).$/, m => `${m[1]} gains +${m[2]} ${({ "vida máxima": "max HP", "maná máximo": "max MP", ataque: "attack" })[m[3]]}.`],
  [/^(.+) recupera (\d+) de (vida|maná)\.$/, m => `${m[1]} recovers ${m[2]} ${m[3] === "vida" ? "HP" : "MP"}.`],
  [/^Has reiniciado los talentos de (.+) por (\d+) de oro\.$/, m => `You reset ${m[1]}'s talents for ${m[2]} gold.`],
  [/^Tu compañero se llama ahora (.+)\.$/, m => `Your companion is now called ${m[1]}.`],
  [/^(.+) te acompaña\.$/, m => `${m[1]} follows you.`],
  [/^(.+) está a punto de cambiar de tamaño…$/, m => `${m[1]} is about to change size…`],
  [/^(.+) vuelve más grande\.$/, m => `${m[1]} comes back bigger.`],
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
  [/^Cripta compartida · nivel (d+) · (.+)$/, m => `Shared crypt · level ${m[1]} · ${t(m[2])}`], [/^Cripta · nivel (\d+) · (.+)$/, m => `Crypt · level ${m[1]} · ${t(m[2])}`], [/^Cámara del (.+)$/, m => `Chamber of the ${t(m[1][0].toUpperCase() + m[1].slice(1))}`], [/^Bajar al nivel (\d+)$/, m => `Go down to level ${m[1]}`],
  [/^Has llegado hasta el nivel (\d+) de (\d+)\. ¿Quieres reiniciar la cripta desde el nivel 1 o continuar en el nivel (\d+)\?$/, m => `You have reached level ${m[1]} of ${m[2]}. Restart the crypt from level 1 or continue at level ${m[3]}?`], [/^Continuar en el nivel (\d+)$/, m => `Continue at level ${m[1]}`],
  [/^(.+) \(cerrado\)$/, m => `${t(m[1])} (closed)`],
  [/^(.+) \((.+) nv (\d+)\) · (Inconsciente|Herido|Sano)$/, m => `${m[1]} (${m[2]} lv ${m[3]}) · ${t(m[4])}`], [/^(.+) nv (\d+)  (\d+)\/(\d+)$/, m => `${m[1]} lv ${m[2]}  ${m[3]}/${m[4]}`], [/^(.+) nv (\d+)$/, m => `${m[1]} lv ${m[2]}`],
  [/^Recompensa por derrotar a (.+): (\d+) de oro\.$/, m => `Bounty for defeating ${m[1]}: ${m[2]} gold.`], [/^Has (revivido|curado) a (.+) por (\d+) de oro\.$/, m => `You ${m[1] === "revivido" ? "revived" : "healed"} ${m[2]} for ${m[3]} gold.`], [/^(.+) ha evolucionado: (.+) → (.+) \(nivel 1\)\.$/, m => `${m[1]} has evolved: ${m[2]} → ${m[3]} (level 1).`], [/^Compras (\d+) × (.+) por (\d+) de oro\.$/, m => `You buy ${m[1]} × ${m[2]} for ${m[3]} gold.`], [/^Compras la bola de (.+) \((.+)\) por (\d+) de oro\.$/, m => `You buy the ${m[1]} ball (${m[2]}) for ${m[3]} gold.`],
  [/^(.+) está en paz: solo te sigue\.$/, m => `${m[1]} is at peace: it only follows you.`], [/^(.+) ataca todo lo que ve\.$/, m => `${m[1]} attacks everything it sees.`], [/^(.+) ataca el objetivo marcado\.$/, m => `${m[1]} attacks the marked target.`],
  [/^Aprendes la habilidad (.+) \((\d+)%\)\.$/, m => `You learn the skill ${m[1]} (${m[2]}%).`], [/^(.+): (Attack|Peace) \(click\)$/, m => `${m[1]}: ${m[2]} (click)`],
  [/^Daño crítico \+(\d+)$/, m => `Critical damage +${m[1]}`], [/^Daño de veneno \+(\d+)$/, m => `Poison damage +${m[1]}`],
  [/^(\d+) % más ligero$/, m => `${m[1]}% lighter`], [/^Probabilidad de lanzar magia \+(\d+) %$/, m => `Spell casting probability +${m[1]}%`],
  [/^Convierte (\d+) % del daño en MP$/, m => `Converts ${m[1]}% of damage to MP`], [/^Probabilidad de crítico \+(\d+) %$/, m => `Critical chance +${m[1]}%`],
  [/^Venta ([\d,]+) oro$/, m => `Sells for ${m[1]} gold`],
  [/^Ahorro de maná (\d+) %$/, m => `Mana saving ${m[1]}%`], [/^Daño físico \+(\d+)$/, m => `Physical damage +${m[1]}`], [/^Defensa \+(\d+)$/, m => `Defense +${m[1]}`],
  [/^Protección contra (luz|fuego|hielo|veneno) (\d+) %$/, m => `${{ luz: "Light", fuego: "Fire", hielo: "Ice", veneno: "Poison" }[m[1]]} protection ${m[2]}%`],
  [/^Resistencia al veneno \+(\d+) %$/, m => `Poison resistance +${m[1]}%`], [/^Probabilidad de acierto \+(\d+)$/, m => `Hit probability +${m[1]}`],
  [/^Recuperación de (HP|SP|MP) (\d+) %$/, m => `${m[1]} recovery ${m[2]}%`], [/^Resistencia mágica \+(\d+) %$/, m => `Magic resistance +${m[1]}%`],
  [/^Absorción (física|mágica) \+(\d+) %$/, m => `${m[1] === "física" ? "Physical" : "Magic"} absorption +${m[2]}%`], [/^Daño de ataques seguidos \+(\d+)$/, m => `Combo damage +${m[1]}`],
  [/^Oro \+(\d+) %$/, m => `Gold +${m[1]}%`], [/^Daño (\d+d\d+.*)$/, m => `Damage ${m[1].replace("grandes", "large")}`],
  [/^demasiado pesado \(fuerza (\d+)\)$/, m => `too heavy (strength ${m[1]})`], [/^Habilidad (\d+)$/, m => `Skill ${m[1]}`],
  [/^una fuerza antigua te impide bajar: cumple tus misiones (nivel máx. (d+))$/, m => "an ancient force stops you from descending: complete your quests (max level " + m[1] + ")"],
  [new RegExp("^Daño " + num + "–" + num + "$"), m => `Damage ${m[1]}–${m[2]}`],
];
void num;
// ---- cadenas añadidas (auditoría tools/i18n_audit.mjs)
Object.assign(EN, {
  "Guardar círculo": "Save circle", "Volumen de la música": "Music volume", "Menú clásico": "Classic menu",
  "Tu compañero": "Your companion", " está en paz: solo te sigue.": " is at peace: it only follows you.", "el objetivo": "the target", " de maná.": " mana.",
  "¡Objeto único! ": "Unique item! ", "¡Objeto raro! ": "Rare item! ",
  "Caramelo: cura la vida de tu compañero.": "Candy: heals your companion's health.", "Caramelo: devuelve maná a tu compañero.": "Candy: restores your companion's mana.",
  "Caramelo: revive a tu compañero inconsciente.": "Candy: revives your fainted companion.", "vida máxima": "max health", "maná máximo": "max mana",
  "revive a tu compañero inconsciente.": "revives your fainted companion.",
  "Suelta el tinte encima del objeto que quieres teñir.": "Drop the dye onto the item you want to dye.", "No hay ningún jugador cerca.": "There is no player nearby.",
  "Has revivido a ": "You revived ", "Has curado a ": "You healed ",
  "sigue al líder": "follows the leader", "Elige uno para verlo jugar en vivo (solo se mira; su chat interno aparece en la ventana de chat).": "Pick one to watch them play live (view only; their inner chat shows in the chat window).",
  "Todos los bandos": "All sides", "Siguiendo a su líder": "Following their leader", "Yendo a la cripta": "Heading to the crypt", "En la cripta": "In the crypt", "De expedición": "On an expedition",
  "Capítulo 1 · Despertar": "Chapter 1 · Awakening", "Capítulo 2 · El pacto": "Chapter 2 · The pact", "Capítulo 3 · Ascensión": "Chapter 3 · Ascension",
  "Nivel 1 → nivel 50": "Level 1 → level 50", "Pelea cuerpo a cuerpo y comparte tu experiencia.": "Fights in melee and shares your experience.",
  "¿Seguro? Pulsa de nuevo": "Sure? Press again", "¡Me atacan!": "I'm under attack!",
  "Res. mágica": "Magic res.", "Nivel medio de objetos": "Average item level", "Más cazados": "Most hunted", "Cripta: más profundo / reyes": "Crypt: deepest / kings", "Con quién habla más": "Who talks the most",
  "faltan los datos de la cripta": "crypt data is missing", "mapa no disponible (puede estar cargándose)": "map unavailable (it may still be loading)",
  "Falta la paleta de la cripta": "The crypt palette is missing", "No hay ventana válida en los mapas originales": "No valid window in the original maps",
  "Sigo sin poder llegar: vuelvo a la ciudad.": "I still can't get there: heading back to town.", "No consigo alcanzar a mi líder: dejo el grupo.": "I can't reach my leader: leaving the party.",
  "cañón de cristal": "glass cannon", "esa especie no existe en los datos (Orc-Mage no está en NPC.cfg)": "that species does not exist in the data (Orc-Mage is not in NPC.cfg)", "casilla no válida": "invalid slot",
  "cazar en la granja": "hunt on the farm", "bajar a la cripta": "go down to the crypt",
  "¡Aguanta, que te remiendo!": "Hang on, I'll patch you up!", "¡Ya voy, ya voy!": "Coming, coming!", "¡Esto me deja sin brillo!": "This drains my glow!",
  "¡Toda la luz que tengo para ti!": "All the light I have for you!", "¡No te me mueras ahora!": "Don't you die on me now!", "¡Escudo arriba, jefe!": "Shield up, boss!",
  "Te cubro las espaldas.": "I've got your back.", "¡Que la magia rebote!": "Let the magic bounce back!", "Protección mágica, por si acaso.": "Magic protection, just in case.",
  "¡A darles con todo!": "Hit them with everything!", "¡Rabia, rabia, rabia!": "Rage, rage, rage!", "Os cuido a todos desde aquí.": "I'll look after you all from here.",
  "Pegaos a mí, que os protejo.": "Stick close, I'll protect you.", "¡TODO LO QUE TENGO, AHORA!": "EVERYTHING I HAVE, NOW!", "¡Vamos todos juntos!": "All together now!",
  "¡Levántate, aún no hemos terminado!": "Get up, we're not done yet!", "¡De pie, que yo soy un espíritu y sigo aquí!": "On your feet, I'm a spirit and I'm still here!",
  "¡Ni se te ocurra quedarte ahí tumbado!": "Don't you dare stay lying there!",
  "¡Que soy de luz, no me peguen!": "I'm made of light, don't hit me!", "¡Me estoy apagando!": "I'm fading out!", "¡Auxilio, me desvanezco!": "Help, I'm vanishing!",
  "¡Me atacan! ¡Me atacan!": "I'm being attacked! I'm being attacked!", "Qué tranquilo está esto... demasiado.": "It's so quiet here... too quiet.",
  "¿Alguien ha oído ese susurro? Me da cosa.": "Did anyone hear that whisper? It creeps me out.", "Me han dicho que los espíritus también tienen sueños.": "I've heard spirits have dreams too.",
  "Aquí me tienes, listo para lo que sea.": "Here I am, ready for anything.", "¡NOOO! ¡Aguanta, voy!": "NOOO! Hang on, I'm coming!", "¡Jefe! ¡No te vayas!": "Boss! Don't go!",
  "tu aliado": "your ally", "para invocar a un summon de apoyo necesitas un báculo en la mano": "to summon a support summon you need a staff in hand",
  "los viajeros no pueden fundar guilds": "travelers cannot found guilds", "nombre no válido (3-20 letras, cifras, espacio, _ o -)": "invalid name (3-20 letters, digits, space, _ or -)",
  "solo el Guildmaster invita": "only the Guildmaster invites", "el guild está lleno": "the guild is full", "solo el Guildmaster disuelve el guild": "only the Guildmaster disbands the guild",
  "solo el Guildmaster expulsa": "only the Guildmaster expels", "no es de tu guild": "not in your guild", "solo el Guildmaster elige los colores": "only the Guildmaster picks the colors", "no tienes guild": "you have no guild",
  "hasta mañana!": "see you tomorrow!", "ya estoy aquí": "I'm here", "qué me he perdido?": "what did I miss?", "me llaman al teléfono": "I'm getting a phone call", "voy a por un café": "going for a coffee",
  "perdón, ya volví": "sorry, I'm back", "qué calor hace hoy": "it's so hot today", "alguien sabe dónde se consigue buen equipo?": "does anyone know where to get good gear?",
  "me duele el dedo de tanto clicar": "my finger hurts from all the clicking", "esto de subir de nivel no se acaba nunca": "this leveling never ends", "ayer vi un jefe enorme en la cripta": "yesterday I saw a huge boss in the crypt",
  "los slimes ya me dan pena": "I feel sorry for the slimes now", "quién se apunta a Promise Land?": "who's up for Promise Land?", "tengo la mochila hecha un lío": "my backpack is a mess",
  "qué buen día para cazar": "what a great day to hunt", "los orcos pegan fuerte, cuidado": "orcs hit hard, careful",
  "elige el objeto que quieres teñir": "pick the item you want to dye", "ese tinte no sirve para este objeto": "that dye doesn't work on this item",
  "Charlando con el guild": "Chatting with the guild", "sin caña": "no fishing rod", "no llego a la orilla": "can't reach the shore",
  "¡Que arda todo!": "Let it all burn!", "¡Cenizas y gritos!": "Ashes and screams!", "¡El infierno responde!": "Hell answers!", "El invierno ha llegado…": "Winter has come…", "Frío eterno:": "Eternal cold:",
  "Las sombras obedecen…": "The shadows obey…", "Tu alma es mía.": "Your soul is mine.", "¡Allá voy!": "Here I come!", "¡Toma esto!": "Take this!", "¡Con todo mi poder!": "With all my power!",
  "Prueba de que has sobrevivido al campo.": "Proof that you survived the field.", "Abre las criptas hasta el rey carmesí.": "Clear the crypts up to the crimson king.",
  "Corazón Carmesí": "Crimson Heart", "Trofeo del Rey esqueleto carmesí.": "Trophy of the crimson Skeleton King.", "Abre las criptas hasta el nivel 10.": "Clear the crypts up to level 10.",
  "Corazón Umbrío": "Umbral Heart", "Trofeo del Rey esqueleto umbrío.": "Trophy of the umbral Skeleton King.", "Abre las criptas hasta el nivel 15.": "Clear the crypts up to level 15.",
  "¡Se acaba la paciencia, los golpes duelen cada vez más!": "Patience runs out, the blows hurt more and more!",
});
// plantillas con {datos}: se convierten en patrones
const TPL = [
  ["¡Empieza el combate! {a} contra {b}.", "The fight begins! {a} versus {b}."], ["¡Se abre el telón! {a} y {b} se miden.", "The curtain rises! {a} and {b} size each other up."],
  ["¡Primera sangre para {x}!", "First blood for {x}!"], ["¡{x} golpea primero!", "{x} strikes first!"], ["¡Golpe crítico de {x}!", "Critical hit by {x}!"], ["¡Qué golpe de {x}!", "What a blow by {x}!"],
  ["¡{x} suelta un Power Strike!", "{x} unleashes a Power Strike!"], ["¡{x} lanza {s}!", "{x} casts {s}!"], ["¡{x} se cubre con Guard!", "{x} covers up with Guard!"], ["¡{x} entra en Frenzy!", "{x} goes into a Frenzy!"],
  ["¡{x} recupera el aliento!", "{x} catches their breath!"], ["¡{x} está al límite!", "{x} is at the limit!"], ["¡{x} tambalea, le queda muy poca vida!", "{x} staggers, barely any health left!"],
  ["¡Remontada! {x} le da la vuelta al combate.", "Comeback! {x} turns the fight around."], ["¡{x} gana el combate!", "{x} wins the fight!"], ["¡Victoria de {x}!", "Victory for {x}!"],
  ["¡Ahí viene un {mn}! ¡Yo no he visto nada!", "Here comes a {mn}! I saw nothing!"], ["Eh... ¿ese {mn} viene hacia aquí?", "Uh... is that {mn} coming this way?"],
  ["¡{who} está fatal! ¡Aguanta!", "{who} is in bad shape! Hang on!"], ["¡Cuidado con {who}, que no llega!", "Watch out for {who}, they're not going to make it!"],
  ["¡Un {mn} me persigue! ¡Mamá!", "A {mn} is chasing me! Mommy!"], ["¡Cuidado! ¡{mn} a la vista!", "Careful! {mn} in sight!"],
];
for (const [es, en] of TPL) {
  const re = new RegExp("^" + es.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, "(.+)") + "$");
  const order = [...es.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
  PATTERNS.push([re, m => en.replace(/\{(\w+)\}/g, (_, k) => m[order.indexOf(k) + 1] ?? "")]);
}


for (const c of CHAINS) EN[c.es] = c.en;                                               // fichas de las especies superiores: salen de la tabla de evoluciones (shared/systems/evolutions.js)
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
