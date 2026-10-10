// Tutorial para jugadores nuevos. INVENTO del port (el original no tiene tutorial): guion de diálogos (lore + mecánicas básicas),
// progreso guardado en la partida (p.tut) y las pocas concesiones que necesita la simulación (un monstruo de práctica, un botín
// asegurado, 400 monedas para la tienda y una recompensa final). La detección de objetivos y el dibujado viven en client/tutorial.js.
//
//  p.tut = { i, st, g, claimed }
//    i        paso actual (0..STEPS.length)
//    st       "on" (en curso) | "skip" (saltado) | "done" (terminado). Las partidas antiguas (sin p.tut) arrancan en "done".
//    g        concesiones ya hechas en esta vuelta (dummy, loot): se vacía al repetir el tutorial
//    claimed  concesiones económicas ya cobradas alguna vez (gold, reward): no se repiten al repetir el tutorial
//  Orden `tut` del cliente: { t:"tut", op:"get"|"step"|"skip"|"reset"|"grant", i?, what? }. Respuesta: evento { t:"tutorial", id, st, i, total, claimed }.
//
// Cada paso: { id, lines:[{w,es,en}], goal?:{k,...,es,en,hint}, after?:[líneas], grant? }.
//  w (quién habla): "me" el propio personaje · "g" Gandlf · "s" el tendero · "p" Gail · "k" Kennedy · "n" narrador (sin cara)
//  goal.k: move{n} · run · panel{id} · equip · kill{n} · pickup · use · map{id} · talk{npc} · buy · pet · petuse
//  grant: "dummy" (al empezar el paso) · "loot" (al cumplir el objetivo de matar) · "gold" (al empezar) · "reward" (al empezar el último paso)
import { groundPush } from "./ground.js";
import { newInst } from "./itemsys.js";
import { spawnFrom } from "./npcsys.js";

export const SPEAKERS = {
  me: { npc: null },
  g: { npc: "Gandlf", es: "Gandlf", en: "Gandlf" },
  s: { npc: "ShopKeeper-W", es: "Tendero", en: "Shopkeeper" },
  p: { npc: "Gail", es: "Gail", en: "Gail" },
  k: { npc: "William", es: "Kennedy", en: "Kennedy" },
  n: { npc: null, es: "", en: "" },
};
export const GOAL_KINDS = new Set(["move", "run", "panel", "equip", "kill", "pickup", "use", "map", "talk", "buy", "pet", "petuse"]);
export const GRANTS = new Set(["dummy", "loot", "gold", "reward"]);
export const REWARD = { gold: 500, potions: 3 };       // al terminar el tutorial (una sola vez por personaje)
export const GIFT_GOLD = 400;                          // para que compre algo en la tienda (una sola vez por personaje)
export const SHOP_DOOR = [61, 70];                     // casilla de la farm que lleva a la tienda general (teleports de arefarm.json)

const L = (w, es, en) => ({ w, es, en });

export const STEPS = [
  { id: "welcome", lines: [
    L("g", "¡Despierta, viajero! Has llegado a Aresfarm, las tierras de labranza que Aresden guarda en su frontera.", "Wake up, traveller! You have reached Aresfarm, the farmland Aresden guards on its border."),
    L("me", "¿Dónde estoy? Recuerdo el barco, la tormenta... y poco más.", "Where am I? I remember the ship, the storm... and not much else."),
    L("g", "Soy Gandlf, mago del reino. Tranquilo: el naufragio te dejó con vida y yo te encontré en la orilla.", "I am Gandlf, mage of the kingdom. Rest easy: the wreck left you alive and I found you on the shore."),
    L("g", "Aresden y Elvine llevan siglos en guerra, y a ambos reinos les sobran enemigos. Bajo las ruinas del norte duermen los muertos de una batalla antigua… y últimamente se han movido.", "Aresden and Elvine have been at war for centuries, and both realms have enemies to spare. Beneath the ruins to the north sleep the dead of an ancient battle... and lately they have stirred."),
    L("g", "Necesitamos manos como las tuyas. Pero antes de bajar a las criptas, aprenderás lo básico. Si ya conoces el juego, puedes saltar el tutorial cuando quieras.", "We need hands like yours. But before you go down to the crypts you will learn the basics. If you already know the game you can skip the tutorial whenever you like."),
  ] },
  { id: "move", lines: [
    L("g", "Empieza por lo más sencillo: caminar. Haz clic izquierdo en el suelo y tu personaje irá hasta allí.", "Start with the simplest thing: walking. Left-click on the ground and your character will go there."),
  ], goal: { k: "move", n: 12, es: "Camina unas 12 casillas", en: "Walk about 12 tiles", hint: { es: "Clic izquierdo en el suelo", en: "Left-click on the ground" } },
    after: [L("g", "Muy bien. Con el botón derecho sobre el suelo solo te giras, sin andar.", "Well done. A right-click on the ground only turns you around, without walking.")] },
  { id: "run", lines: [
    L("g", "Un viajero con prisa corre. Pulsa Ctrl + R para alternar entre andar y correr. Correr gasta aguante (la barra verde).", "A traveller in a hurry runs. Press Ctrl + R to switch between walking and running. Running uses stamina (the green bar)."),
  ], goal: { k: "run", es: "Activa el modo correr (Ctrl + R)", en: "Turn on run mode (Ctrl + R)", hint: { es: "Ctrl + R", en: "Ctrl + R" } },
    after: [L("g", "Cuando te canses, vuelve a pulsar Ctrl + R. Y no uses Mayús: aquí no corre.", "When you tire, press Ctrl + R again. And don't use Shift: it doesn't run here.")] },
  { id: "char", lines: [
    L("g", "Ahora conócete a ti mismo. F5 abre tu hoja de personaje: nivel, atributos y resistencias.", "Now get to know yourself. F5 opens your character sheet: level, attributes and resistances."),
  ], goal: { k: "panel", id: 1, es: "Abre el personaje (F5)", en: "Open your character (F5)", hint: { es: "Tecla F5", en: "Key F5" } },
    after: [L("g", "Fuerza para el golpe, Vitalidad para la vida, Destreza para esquivar, Inteligencia y Magia para el maná. Al subir de nivel repartirás puntos.", "Strength for the blow, Vitality for life, Dexterity to dodge, Intelligence and Magic for mana. When you level up you will spend points.")] },
  { id: "bag", lines: [
    L("g", "Tu mochila guarda hasta 50 objetos y todo pesa. Ábrela con F6.", "Your bag holds up to 50 items and everything has weight. Open it with F6."),
  ], goal: { k: "panel", id: 2, es: "Abre la mochila (F6)", en: "Open your bag (F6)", hint: { es: "Tecla F6", en: "Key F6" } } },
  { id: "equip", lines: [
    L("g", "Ahí tienes una daga, pociones y un mapa. Una daga en la mochila no corta nada: equípala arrastrándola sobre tu figura en el cuadro de personaje (F5), o con doble clic.", "There you have a dagger, potions and a map. A dagger in the bag cuts nothing: equip it by dragging it onto your figure in the character window (F5), or by double-clicking."),
  ], goal: { k: "equip", es: "Equipa la daga", en: "Equip the dagger", hint: { es: "Arrastra la daga sobre tu figura", en: "Drag the dagger onto your figure" } },
    after: [L("g", "Cada pieza equipada protege una parte del cuerpo y se gasta con el uso. El herrero las repara.", "Each piece of equipment protects a part of the body and wears out with use. The blacksmith repairs them.")] },
  { id: "fight", grant: "dummy", lines: [
    L("g", "Te he preparado un limo de práctica, aquí cerca. Es torpe y blando: perfecto para empezar.", "I have prepared a practice slime, close by. It is clumsy and soft: perfect to begin with."),
    L("g", "Acércate y ataca con Ctrl + clic izquierdo sobre él. Si lo tienes al lado, vale el clic derecho. Tu barra roja es tu vida: vigílala.", "Get close and attack with Ctrl + left-click on it. If it is right beside you, a right-click will do. Your red bar is your life: watch it."),
  ], goal: { k: "kill", n: 1, es: "Derrota al limo de práctica", en: "Defeat the practice slime", hint: { es: "Ctrl + clic izquierdo sobre el limo", en: "Ctrl + left-click on the slime" } },
    after: [L("me", "¡Lo logré! Y he notado que sube mi experiencia.", "I did it! And I can see my experience rising.")] },
  { id: "loot", grant: "loot", lines: [
    L("g", "Los monstruos sueltan botín. Mira: ha caído algo cerca de ti. Camina hasta ese objeto y recógelo con un clic.", "Monsters drop loot. Look: something has fallen near you. Walk to it and pick it up with a click."),
  ], goal: { k: "pickup", es: "Recoge el objeto del suelo", en: "Pick up the item on the ground", hint: { es: "Clic izquierdo sobre el objeto", en: "Left-click on the item" } },
    after: [L("g", "Si pasas el ratón por encima de un objeto verás sus estadísticas. Los de color raro suelen valer la pena.", "Hover over an item to see its statistics. The oddly coloured ones are usually worth it.")] },
  { id: "potion", lines: [
    L("g", "La poción roja cura vida, la azul maná y la verde aguante. Úsala con doble clic desde la mochila, o con Insert / Supr si la tienes en el atajo.", "The red potion restores life, the blue one mana and the green one stamina. Use it with a double-click from the bag, or with Insert / Delete."),
  ], goal: { k: "use", es: "Usa una poción de la mochila", en: "Use a potion from your bag", hint: { es: "Doble clic sobre la poción (F6)", en: "Double-click the potion (F6)" } },
    after: [L("g", "Cuidado con el hambre: comer a tiempo importa. Y si caes, perderás parte de tu experiencia, así que no te arriesgues sin pociones.", "Mind your hunger: eating in time matters. And if you fall you lose part of your experience, so take no risks without potions.")] },
  { id: "level", lines: [
    L("g", "Cuando tu experiencia llene la barra subirás de nivel (hasta el 50). Aparecerá «Level Up!» en el panel: púlsalo y reparte tus puntos.", "When your experience fills the bar you level up (up to 50). \"Level Up!\" will appear on the panel: click it and spend your points."),
    L("g", "El panel inferior tiene los iconos que más usarás: personaje, compañeros, mochila, habilidades, chat, opciones y el retorno. F1 te recuerda todo esto y las novedades.", "The bottom panel holds the icons you will use most: character, companions, bag, skills, chat, options and recall. F1 reminds you of all this and the news."),
  ] },
  { id: "shopgo", lines: [
    L("g", "Ahora, la ciudad. La tienda general está al oeste de aquí: busca la entrada de madera y pisa el umbral. Te señalaré el camino con una flecha.", "Now, town. The general shop is to the west of here: look for the wooden entrance and step on the threshold. I will point the way with an arrow."),
  ], goal: { k: "map", id: "gshop_1f", at: [61, 70], es: "Entra en la tienda general", en: "Enter the general shop", hint: { es: "Sigue la flecha hacia el oeste", en: "Follow the arrow to the west" } },
    after: [L("n", "Dentro de la tienda no se puede combatir: es zona segura.", "Fighting is not allowed inside the shop: it is a safe zone.")] },
  { id: "shoptalk", lines: [
    L("s", "¡Bienvenido! Soy el tendero. Haz clic en mí y verás mis mercancías.", "Welcome! I am the shopkeeper. Click on me and you will see my wares."),
  ], goal: { k: "talk", npc: "ShopKeeper-W", es: "Habla con el tendero", en: "Talk to the shopkeeper", hint: { es: "Clic izquierdo sobre el tendero", en: "Left-click on the shopkeeper" } } },
  { id: "buy", grant: "gold", lines: [
    L("g", "Toma, 400 monedas de oro de mi bolsillo. Compra algo útil: una poción, una pieza de armadura… Al vender, te pagan menos de lo que costó.", "Here, 400 gold coins from my own pocket. Buy something useful: a potion, a piece of armour... When you sell, they pay you less than it cost."),
  ], goal: { k: "buy", es: "Compra un objeto", en: "Buy an item", hint: { es: "Elige un objeto y pulsa comprar", en: "Pick an item and press buy" } },
    after: [L("s", "¡Buena compra! Vuelve cuando quieras. También hay herrero y almacén en la granja.", "A fine purchase! Come back whenever you like. There is also a blacksmith and a warehouse on the farm.")] },
  { id: "pet", lines: [
    L("p", "¡Hola! Soy Gail, cuido de los compañeros. Aquí, un cazador no va solo: una bola de compañero lleva a un monstruo domado que lucha a tu lado.", "Hi! I am Gail, I look after companions. Here a hunter is never alone: a companion ball holds a tamed monster that fights at your side."),
    L("p", "No se consiguen cazando: se compran aquí, en mi mostrador (pestaña Bolas). Para el tutorial te las dejo a 1 moneda.", "They are not won by hunting: you buy them here, at my counter (Balls tab). For the tutorial I let them go for 1 coin."),
  ], goal: { k: "pet", es: "Compra una bola de compañero a Gail", en: "Buy a companion ball from Gail", hint: { es: "Habla con Gail, pestaña Bolas", en: "Talk to Gail, Balls tab" } } },
  { id: "petuse", lines: [
    L("p", "Ahora úsala: abre la mochila y haz doble clic en la bola. Tu compañero aparecerá a tu lado; vuelve a usarla para guardarlo.", "Now use it: open your bag and double-click the ball. Your companion will appear beside you; use it again to put it away."),
  ], goal: { k: "petuse", es: "Invoca a tu compañero", en: "Summon your companion", hint: { es: "Doble clic sobre la bola (F6)", en: "Double-click the ball (F6)" } },
    after: [L("p", "Con F10 abres sus talentos, y si cae en combate, tráemelo: lo curo por un precio. Alt + clic en un monstruo le ordena atacar.", "F10 opens its talents, and if it falls in battle, bring it to me: I heal it for a price. Alt + click on a monster orders it to attack.")] },
  { id: "arena", lines: [
    L("k", "¿Tu compañero te parece fuerte? Yo soy Kennedy: organizo combates entre summons. Apuesta oro y mira quién gana desde la grada. La casa se queda un diezmo, ¿eh?", "Do you think your companion is strong? I am Kennedy: I organise fights between summons. Bet gold and watch who wins from the stands. The house keeps a tenth, mind."),
  ] },
  { id: "crypt", lines: [
    L("g", "Y ahora lo importante. Al norte de la granja está el teletransportador de las criptas: veinte niveles de esqueletos, cada uno más oscuro y con un jefe al final.", "And now what matters. North of the farm lies the teleporter to the crypts: twenty levels of skeletons, each darker than the last and with a boss at the end."),
    L("g", "Mata a todos los esqueletos de un nivel para abrir el portal que baja. Cuanto más profundo, mejor botín… y más miedo. Los jefes sueltan objetos únicos.", "Kill every skeleton on a level to open the portal down. The deeper you go, the better the loot... and the greater the fear. Bosses drop unique items."),
    L("me", "Veinte niveles de muertos. Qué bien suena eso, dicho en voz alta.", "Twenty levels of the dead. How well that sounds, said out loud."),
    L("g", "Si todo se tuerce, el botón de retorno del panel te devuelve a la granja. Anda, que Aresden cuenta contigo.", "If everything goes wrong, the recall button on the panel brings you back to the farm. Go on, Aresden is counting on you."),
  ] },
  { id: "end", grant: "reward", lines: [
    L("g", "Has terminado tu instrucción. Toma esto como recompensa: 500 monedas y tres pociones. Es todo lo que puedo darte; el resto tendrás que ganarlo.", "Your instruction is complete. Take this as a reward: 500 coins and three potions. It is all I can give you; the rest you must earn."),
    L("g", "Si quieres repetir alguna lección, escribe /tutorial en el chat o usa el botón de Opciones. ¡Buena suerte, viajero!", "If you want to repeat a lesson, type /tutorial in the chat or use the button in Options. Good luck, traveller!"),
  ] },
];
export const TOTAL = STEPS.length;

// ---------------------------------------------------------------- estado de la partida
export const fresh = () => ({ i: 0, st: "on", g: [], claimed: [] });
export const active = p => p.tut?.st === "on";
export function init(p, isNew) { p.tut = isNew ? fresh() : { i: TOTAL, st: "done", g: [], claimed: ["gold", "reward"] }; }
export function restore(p, s) {
  const t = s.tut;
  if (!t || typeof t !== "object") return;                                    // partida antigua: ya conoce el juego
  p.tut = { i: Math.max(0, Math.min(TOTAL, t.i | 0)), st: ["on", "skip", "done"].includes(t.st) ? t.st : "done", g: (t.g || []).filter(x => GRANTS.has(x)), claimed: (t.claimed || []).filter(x => x === "gold" || x === "reward") };
}
export const toSave = p => (p.tut ? { i: p.tut.i, st: p.tut.st, g: [...p.tut.g], claimed: [...p.tut.claimed] } : undefined);

const announce = (w, p) => w.emit({ t: "tutorial", id: p.id, st: p.tut.st, i: p.tut.i, total: TOTAL, claimed: [...p.tut.claimed] });

// Orden del cliente (ver cabecera)
export function command(w, p, cmd) {
  const t = p.tut || (p.tut = { i: TOTAL, st: "done", g: [], claimed: ["gold", "reward"] });
  switch (cmd.op) {
    case "get": announce(w, p); return true;
    case "step": {                                                            // sólo se avanza, nunca se retrocede
      const i = cmd.i | 0;
      if (t.st !== "on" || i <= t.i || i > TOTAL) return w.reject(p, cmd, "paso no válido");
      t.i = i; if (i >= TOTAL) t.st = "done";
      announce(w, p); return true;
    }
    case "skip": if (t.st === "on") t.st = "skip"; announce(w, p); return true;
    case "reset": Object.assign(t, { i: 0, st: "on", g: [] }); announce(w, p); return true;
    case "grant": return grant(w, p, t, cmd);
  }
  return w.reject(p, cmd, "orden de tutorial desconocida");
}

function grant(w, p, t, cmd) {
  const what = String(cmd.what || ""), step = STEPS[t.i];
  if (t.st !== "on" || !step || step.grant !== what || !GRANTS.has(what)) return w.reject(p, cmd, "no toca ahora");
  const once = what === "gold" || what === "reward";
  if (once ? t.claimed.includes(what) : t.g.includes(what)) return w.reject(p, cmd, "ya concedido");
  if (what === "dummy") {
    if (!w.npcDb.Slime) return w.reject(p, cmd, "sin limo");
    const n = spawnFrom(w, { name: "Slime", rect: [p.x + 3, p.y - 2, p.x + 5, p.y + 2], alive: 0, max: 0, respawn: false });
    if (!n) return w.reject(p, cmd, "sin sitio");
    n.noDrop = true; n.tutor = p.id;
    w.emit({ t: "tutdummy", id: p.id, target: n.id });
  } else if (what === "loot") {
    const d = w.data.named("RedPotion"); if (!d) return false;
    const spot = w.freeSpotNear(p.x + 1, p.y, 3) || [p.x, p.y];
    groundPush(w, spot[0], spot[1], newInst(w, d.id));
    w.emit({ t: "tutloot", id: p.id, x: spot[0], y: spot[1] });
  } else if (what === "gold") {
    p.gold += GIFT_GOLD; w.recalc(p);
  } else if (what === "reward") {
    p.gold += REWARD.gold;
    const d = w.data.named("RedPotion");
    for (let k = 0; d && k < REWARD.potions; k++) { const inst = newInst(w, d.id); if (p.bag.length < 50) p.bag.push(inst); else groundPush(w, p.x, p.y, inst); }
    w.recalc(p);
  }
  (once ? t.claimed : t.g).push(what);
  w.emit({ t: "tutgrant", id: p.id, what });
  announce(w, p);
  return true;
}
