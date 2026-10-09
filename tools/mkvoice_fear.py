"""Añade a web/data/voice.json la sección «fear»: el miedo creciente del personaje y su compañero dentro de la cripta de esqueletos. Idempotente.
    python3 tools/mkvoice_fear.py
Cinco etapas según el nivel de la cripta (voice.js fearStage): 0 inquieto (1-3), 1 nervioso (4-7), 2 asustado (8-12), 3 aterrado (13-17), 4 pánico (18-20).
Cada categoría es una lista de 5 listas (una por etapa):
  enter   : al entrar en el nivel                      idle    : charla de fondo (cada 20-45 s)
  monster : un monstruo cerca ({t} = su nombre)        boss    : el jefe a la vista
  ghost   : un fantasma se levanta                     kill    : tras matar
  lowhp   : poca vida                                  chat    : charla con el compañero (pares me/pet)
  attack  : orden de ataque (pares me/pet, {t} = objetivo)
Tonos: w prudente, j bromista, d decidido."""
import json, os
P = os.path.join(os.path.dirname(__file__), "..", "web", "data", "voice.json")
L = lambda es, en, tone=None: {"es": es, "en": en, **({"tone": [tone]} if tone else {})}
X = lambda me, pet: {"me": me, "pet": pet}
W, J, D = "w", "j", "d"

enter = [
  [L("Qué silencio… demasiado silencio.", "So quiet… too quiet.", W), L("Bonito sitio. Si te gusta el moho.", "Nice place. If you like mold.", J), L("Despacio. Los ojos bien abiertos.", "Slowly. Eyes wide open.", D)],
  [L("Huele a cerrado… y a algo peor.", "It smells stale… and worse.", W), L("Seguro que abajo hay mejor ambiente. Seguro.", "I'm sure it's livelier further down. Sure.", J), L("Sigo adelante. Aunque no me guste.", "I keep going. Even if I don't like it.", D)],
  [L("No debería estar aquí. Lo siento en los huesos.", "I shouldn't be here. I feel it in my bones.", W), L("Ya no tiene gracia… ¿o la tenía?", "It's not funny anymore… was it ever?", J), L("Adelante. Aunque me tiemblen las piernas.", "Forward. Even if my legs shake.", D)],
  [L("Cada nivel es peor. Cada nivel.", "Every level is worse. Every one.", W), L("Ya no hago chistes. Fíjate en lo grave que es.", "I've stopped joking. Notice how bad it is.", J), L("Respira. Un paso. Otro paso.", "Breathe. One step. Another step.", D)],
  [L("Por favor, que sea el último nivel. Por favor.", "Please let this be the last level. Please.", W), L("Si salgo de esta, me hago granjero.", "If I get out of this, I'm becoming a farmer.", J), L("No pienso morir aquí. No pienso morir aquí.", "I won't die here. I won't die here.", D)]]

idle = [
  [L("Algo gotea en algún sitio.", "Something is dripping somewhere.", W), L("Juraría que esa sombra se movió.", "I swear that shadow moved.", W), L("Solo son huesos. Solo huesos.", "Just bones. Just bones.", J), L("No me gusta cómo suena mi respiración aquí.", "I don't like how my breathing sounds here.", D)],
  [L("¿Has oído eso? …No, nada.", "Did you hear that? …No, nothing.", W), L("Las paredes crujen. Seguro que es la humedad.", "The walls creak. Surely the damp.", J), L("Si no miro atrás, no me siguen.", "If I don't look back, they won't follow.", J), L("Mantén la calma. Mantén la calma.", "Stay calm. Stay calm.", D)],
  [L("Hay susurros. Hay susurros entre las piedras.", "There are whispers. Whispers between the stones.", W), L("Quiero volver a la granja. Quiero ver una gallina.", "I want to go back to the farm. I want to see a chicken.", J), L("Siento ojos en la nuca.", "I feel eyes on the back of my neck.", D), L("Esta oscuridad me aprieta el pecho.", "This darkness squeezes my chest.", W)],
  [L("Todo me mira. Las paredes, el techo, todo.", "Everything is watching me. The walls, the ceiling, everything.", W), L("Me tiemblan las manos. No puedo parar.", "My hands are shaking. I can't stop them.", D), L("¿Y si no hay salida? No, hay salida. ¿Verdad?", "What if there's no way out? No, there is. Right?", J), L("Cada sombra tiene dientes.", "Every shadow has teeth.", W)],
  [L("No puedo más. No puedo más.", "I can't take any more. I can't.", W), L("Se ríen. Los huesos se ríen de mí.", "They're laughing. The bones are laughing at me.", J), L("Un paso más. Solo uno más. Siempre uno más.", "One more step. Just one more. Always one more.", D), L("Mamá, quiero salir.", "Mom, I want out.", J)]]

monster = [
  [L("Hay un {t} ahí delante…", "There's a {t} ahead…", W), L("Vaya, un {t}. Qué ilusión.", "Well, a {t}. How thrilling.", J), L("{t} a la vista. Calma.", "{t} in sight. Stay calm.", D)],
  [L("¿Eso es un {t}? Sí… es un {t}.", "Is that a {t}? Yes… it's a {t}.", W), L("Un {t}. Seguro que es tímido.", "A {t}. I bet it's shy.", J), L("{t}. Sin pánico. Sin pánico.", "{t}. No panic. No panic.", D)],
  [L("¡Un {t}! ¡Y se acerca!", "A {t}! And it's coming closer!", W), L("Hola, {t}. Yo no he sido.", "Hello, {t}. It wasn't me.", J), L("{t}… agarra bien el arma.", "{t}… grip your weapon.", D)],
  [L("¡Otro {t}! ¿Cuántos más hay?", "Another {t}! How many more are there?", W), L("Por favor, {t}, hoy no.", "Please, {t}, not today.", J), L("{t}. Me tiemblan las rodillas, pero voy.", "{t}. My knees shake, but I'm going.", D)],
  [L("¡{t}! ¡No, no, no!", "{t}! No, no, no!", W), L("Si me quedo muy quieto, {t} no me ve. Funciona.", "If I stay very still, the {t} can't see me. It works.", J), L("¡{t}! ¡Que venga! ¡Que venga ya!", "{t}! Let it come! Let it come now!", D)]]

boss = [
  [L("Eso es… mucho más grande que los demás.", "That's… much bigger than the others.", W), L("Un jefe. Claro, siempre hay un jefe.", "A boss. Of course there's always a boss.", J), L("El rey. Tiene que caer.", "The king. He has to fall.", D)],
  [L("Es enorme. Es enorme y nos ha visto.", "He's huge. He's huge and he's seen us.", W), L("¿Podemos pedir cita para otro día?", "Can we book another day?", J), L("Piensa. Todo jefe tiene un punto débil.", "Think. Every boss has a weak spot.", D)],
  [L("Los huesos del rey crujen como una tormenta.", "The king's bones crack like a storm.", W), L("Si nos mata, ¿cobramos el seguro?", "If he kills us, do we get the insurance?", J), L("No retrocedas. No retrocedas ahora.", "Don't back off. Don't back off now.", D)],
  [L("Su sola mirada me paraliza.", "His mere gaze paralyses me.", W), L("Es el momento de rezar. A quien sea.", "Time to pray. To anyone.", J), L("Es él o nosotros. Es él o nosotros.", "It's him or us. It's him or us.", D)],
  [L("No… no… es peor de lo que imaginaba.", "No… no… it's worse than I imagined.", W), L("Adiós, mundo cruel. Adiós, gallinas.", "Goodbye, cruel world. Goodbye, chickens.", J), L("Si caigo, que sea de frente.", "If I fall, let it be facing him.", D)]]

ghost = [
  [L("¿Eso… se ha levantado?", "Did that… just get back up?", W), L("Los muertos no deberían volver. Es de mala educación.", "The dead shouldn't come back. It's rude.", J), L("No se queda muerto. Vale.", "It won't stay dead. Fine.", D)],
  [L("¡Se ha levantado! ¡Es transparente!", "It got up! It's see-through!", W), L("Un fantasma. Lo que faltaba.", "A ghost. Just what we needed.", J), L("Cuidado: lo que parece muerto no lo está.", "Careful: what looks dead isn't.", D)],
  [L("Los muertos vuelven. Los muertos vuelven.", "The dead are coming back. The dead are coming back.", W), L("Hasta los fantasmas me ponen nervioso ya.", "Even ghosts make me nervous now.", J), L("Hay que matarlo dos veces. Pues dos veces.", "We have to kill it twice. So, twice.", D)],
  [L("¡No acaban nunca! ¡Se levantan y se levantan!", "They never end! They keep getting up!", W), L("Si hasta la muerte falla, ¿en qué confiar?", "If even death fails, what can you trust?", J), L("Una vez más. Caerá una vez más.", "Once more. It will fall once more.", D)],
  [L("¡Los fantasmas! ¡Me atraviesan! ¡Me atraviesan!", "The ghosts! They're passing through me!", W), L("Soy un fantasma más. Estoy muerto de miedo.", "I'm a ghost too. I'm scared to death.", J), L("No miro. No miro. Solo golpeo.", "I don't look. I don't look. I just strike.", D)]]

kill = [
  [L("Uno menos. ¿Cuántos quedan?", "One less. How many are left?", W), L("Ja… sigo vivo.", "Ha… still alive.", J), L("Bien. El siguiente.", "Good. Next.", D)],
  [L("Uno menos. Me tiemblan las manos.", "One less. My hands are shaking.", W), L("Está muerto. ¿Está muerto? Está muerto.", "He's dead. Is he dead? He's dead.", J), L("Cae. Respira. Otro.", "He falls. Breathe. Another.", D)],
  [L("Lo he matado… y aun así no me siento a salvo.", "I killed it… and I still don't feel safe.", W), L("Uno menos. Quedan cien. Genial.", "One less. A hundred to go. Great.", J), L("Sigue en pie. Sigue en pie.", "Keep standing. Keep standing.", D)],
  [L("Cae uno y aparecen tres. Siempre.", "One falls and three appear. Always.", W), L("No lo celebro: me da miedo celebrar.", "I'm not celebrating: I'm afraid to.", J), L("No pares. Si paras, piensas.", "Don't stop. If you stop, you think.", D)],
  [L("¡Muerto! ¿Y los demás? ¿Dónde están los demás?", "Dead! And the others? Where are the others?", W), L("Ja, ja… ja… no me queda risa.", "Ha, ha… ha… I've no laugh left.", J), L("Sigo vivo. Sigo vivo. Sigo vivo.", "Still alive. Still alive. Still alive.", D)]]

lowhp = [
  [L("Estoy herido… no puedo seguir así.", "I'm hurt… I can't go on like this.", W), L("Esto no estaba en el folleto.", "This wasn't in the brochure.", J), L("Aguanta… aguanta.", "Hold on… hold on.", D)],
  [L("Sangro. ¿Me han visto sangrar?", "I'm bleeding. Did they see me bleed?", W), L("Me duele. Y todavía quedan niveles. Genial.", "It hurts. And there are still levels left. Great.", J), L("No es nada. Vendajes. Calma.", "It's nothing. Bandages. Calm.", D)],
  [L("Voy a morir aquí abajo, lo sé.", "I'm going to die down here, I know it.", W), L("Si muero, que alguien cuide mis gallinas.", "If I die, someone look after my chickens.", J), L("Solo es un arañazo. Solo un arañazo…", "Just a scratch. Just a scratch…", D)],
  [L("Veo borroso… las sombras se acercan.", "My vision blurs… the shadows are closing in.", W), L("Qué manera tan tonta de acabar.", "What a silly way to end.", J), L("De pie. De pie. Levántate.", "On your feet. On your feet. Get up.", D)],
  [L("¡No quiero morir aquí! ¡No quiero!", "I don't want to die here! I don't!", W), L("Adiós. Si alguien me oye: adiós.", "Goodbye. If anyone hears me: goodbye.", J), L("Un golpe más… solo uno más…", "One more blow… just one more…", D)]]

chat = [
  [X(L("¿Lo oyes?", "Do you hear that?"), L("Solo el viento… creo.", "Only the wind… I think.")), X(L("No te alejes de mí.", "Don't stray from me."), L("No pienso moverme de aquí.", "I'm not moving from here.")), X(L("Si pasa algo, me avisas.", "If anything happens, tell me."), L("Tú grita primero.", "You scream first."))],
  [X(L("Estás temblando.", "You're trembling."), L("Es el frío. Solo el frío.", "It's the cold. Just the cold.")), X(L("Quédate pegado a mí.", "Stay close to me."), L("Más pegado imposible.", "Closer is impossible.")), X(L("Me ha parecido ver algo.", "I thought I saw something."), L("Mejor no me lo cuentes.", "Better not tell me."))],
  [X(L("¿Tú también quieres irte?", "Do you want to leave too?"), L("Hace rato.", "Ages ago.")), X(L("Dime que todo va a salir bien.", "Tell me everything will be fine."), L("Todo va a salir bien… eso espero.", "Everything will be fine… I hope.")), X(L("Las paredes se mueven.", "The walls are moving."), L("No mires las paredes.", "Don't look at the walls."))],
  [X(L("No me sueltes, por favor.", "Don't let go of me, please."), L("No pienso soltarte. Jamás.", "I won't let go. Ever.")), X(L("Estoy muerto de miedo.", "I'm scared to death."), L("Yo también… pero estoy contigo.", "Me too… but I'm with you.")), X(L("Hay algo detrás de nosotros.", "There's something behind us."), L("No me digas eso. No me lo digas.", "Don't say that. Don't."))],
  [X(L("Prométeme que salimos de esta.", "Promise me we get out of this."), L("Lo prometo. Lo prometo. Lo prometo.", "I promise. I promise. I promise.")), X(L("No te separes ni un paso.", "Not one step apart."), L("¡Ni aunque me empujen!", "Not even if they push me!")), X(L("Si me pasa algo, corre.", "If something happens to me, run."), L("No. Tú no me dejarías.", "No. You wouldn't leave me."))]]

attack = [
  [X([L("Ve a por {t}… despacio.", "Go for {t}… slowly.")][0], L("¿Yo primero? Está bien…", "Me first? All right…")), X(L("¡Ataca a {t}!", "Attack {t}!"), L("¡Allá voy! … ¿Tú vienes, no?", "Here I go! … You're coming, right?"))],
  [X(L("{t}. Ataca. Yo te cubro… de cerca.", "{t}. Attack. I've got your back… from close by."), L("Cúbreme bien, ¿eh?", "Cover me well, okay?")), X(L("Venga, a por {t}.", "Come on, get {t}."), L("Voy… voy… ya voy…", "I'm going… going… on my way…"))],
  [X(L("Ataca a {t}… por favor.", "Attack {t}… please."), L("¿Tiene que ser {t}?", "Does it have to be {t}?")), X(L("¡Contra {t}! ¡Con todo!", "Against {t}! Everything you've got!"), L("¡Con todo! ¡Y con los ojos cerrados!", "Everything! And eyes closed!"))],
  [X(L("{t}… no hay otra opción. Ataca.", "{t}… there's no other way. Attack."), L("Lo haré. Pero me tiembla todo.", "I will. But I'm shaking all over.")), X(L("¡A por {t}! ¡Por los dos!", "Get {t}! For both of us!"), L("¡Por los dos! ¡Mamá!", "For both of us! Mommy!"))],
  [X(L("¡{t}! ¡Acaba con {t}!", "{t}! Finish {t}!"), L("¡No quiero! ¡Pero lo haré!", "I don't want to! But I'll do it!")), X(L("¡Ahora o nunca contra {t}!", "Now or never against {t}!"), L("¡Ahora! ¡O nunca! ¡Ahora!", "Now! Or never! Now!"))]]

d = json.load(open(P, encoding="utf-8"))
d["fear"] = {"enter": enter, "idle": idle, "monster": monster, "boss": boss, "ghost": ghost, "kill": kill, "lowhp": lowhp, "chat": chat, "attack": attack}
json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", {k: [len(s) for s in v] for k, v in d["fear"].items()})
