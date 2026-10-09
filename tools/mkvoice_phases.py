"""Añade a web/data/voice.json (sección «companion») las órdenes de ataque y los diálogos por etapa de nivel y por especie. Idempotente.
    python3 tools/mkvoice_companion.py && python3 tools/mkvoice_phases.py
  attack    : el personaje manda atacar (Alt + clic) y el compañero contesta; {t} = nombre del objetivo.
  stage     : charla según la etapa del compañero (baby 1-9, young 10-24, veteran 25-39, elite 40-50).
  milestone : frase al alcanzar el nivel 10, 25, 40 o 50.
  species   : charla propia de cada especie (se mezcla con la de su etapa)."""
import json, os
P = os.path.join(os.path.dirname(__file__), "..", "web", "data", "voice.json")
L = lambda es, en, tone=None: {"es": es, "en": en, **({"tone": [tone]} if tone else {})}
X = lambda me, pet: {"me": me, "pet": pet}
d = json.load(open(P, encoding="utf-8"))
c = d["companion"]
c["attack"] = X(
  [L("¡Ataca a {t}!", "Attack {t}!", "d"), L("Ve a por {t}, yo te cubro.", "Go for {t}, I've got your back.", "w"), L("¿Ves a {t}? ¡Dale un buen recuerdo de mi parte!", "See {t}? Give it my regards!", "j"), L("Ese de ahí: {t}. ¡A él!", "That one: {t}. Get it!", "d")],
  [L("¡A por {t}!", "Going for {t}!"), L("¡Entendido, jefe!", "Understood, boss!"), L("¡{t} no sabe lo que le espera!", "{t} has no idea what's coming!"), L("¡Voy!", "On my way!")])
c["stage"] = {
  "baby": [
    X(L("Todavía eres pequeño, quédate cerca de mí.", "You're still small, stay close to me.", "w"), L("¡Pero soy valiente!", "But I'm brave!")),
    X(L("¿Cómo te sientes, cachorro?", "How are you feeling, little one?", "j"), L("¡Con ganas de crecer!", "Eager to grow!")),
    X(L("Cada monstruo que cae te hace más fuerte.", "Every monster that falls makes you stronger.", "d"), L("Entonces ¡a por muchos más!", "Then let's get lots more!")),
    X(L("Cuidado, aún eres frágil.", "Careful, you're still fragile.", "w"), L("Pero crezco rápido, ¿verdad?", "But I'm growing fast, right?"))],
  "young": [
    X(L("Ya no eres un cachorro.", "You're not a pup anymore.", "j"), L("¡Y ya llego a los sitios altos!", "And I can reach the high places now!")),
    X(L("Pegas cada vez más fuerte.", "You hit harder every day.", "d"), L("He estado practicando.", "I've been practicing.")),
    X(L("¿Has pensado en qué rama de talentos elegir?", "Have you thought about which talent branch to take?", "w"), L("Sorpréndeme: ¡quiero ser útil!", "Surprise me: I want to be useful!")),
    X(L("Vamos bien de equipo, ¿no crees?", "We make a good team, don't you think?", "j"), L("¡El mejor!", "The best!"))],
  "veteran": [
    X(L("Eres todo un veterano.", "You're quite the veteran.", "d"), L("Y aún me queda mucho por demostrar.", "And I still have plenty to prove.")),
    X(L("Nadie diría que empezaste siendo pequeño.", "No one would guess you started out small.", "j"), L("Yo sí lo recuerdo. Gracias por no rendirte conmigo.", "I remember. Thanks for not giving up on me.")),
    X(L("Los jefes de la cripta ya no te asustan, ¿verdad?", "The crypt bosses don't scare you anymore, right?", "w"), L("Con un buen plan, no.", "Not with a good plan.")),
    X(L("Cuando quieras, bajamos a la cripta.", "Whenever you like, we go down to the crypt.", "d"), L("¡Estoy listo!", "I'm ready!"))],
  "elite": [
    X(L("Casi no puedo creer lo lejos que hemos llegado.", "I can hardly believe how far we've come.", "w"), L("Yo tampoco. Y aquí seguimos.", "Neither can I. And here we still are.")),
    X(L("Eres una leyenda de Aresfarm.", "You're a legend of Aresfarm.", "j"), L("Sin ti no habría leyenda.", "There'd be no legend without you.")),
    X(L("Pocos llegan a tu poder.", "Few reach your power.", "d"), L("Tú me enseñaste todo.", "You taught me everything.")),
    X(L("Cuando termine la cripta, ¿qué sigue?", "When the crypt is done, what's next?", "w"), L("Lo que sea, juntos.", "Whatever it is, together."))]}
c["milestone"] = {
  "10": X([L("¡Nivel 10! Ya no eres un recién nacido.", "Level 10! You're no newborn anymore.", "j"), L("Has crecido. Estoy orgulloso.", "You've grown. I'm proud.", "w")], [L("¡Ahora sí me miran con respeto!", "Now they look at me with respect!"), L("¡Siento que ya puedo con todo!", "I feel like I can take anything!")]),
  "25": X([L("¡Nivel 25! Ya eres un veterano.", "Level 25! You're a veteran now.", "d"), L("Mírate: ya tienes cicatrices de guerra.", "Look at you: war scars already.", "j")], [L("Y las que me faltan.", "And more to come."), L("¡Esto es solo el principio!", "This is only the beginning!")]),
  "40": X([L("¡Nivel 40! Ya eres de élite.", "Level 40! You're elite now.", "d"), L("Cuarenta niveles… increíble.", "Forty levels… incredible.", "w")], [L("Gracias por no dejarme atrás.", "Thanks for not leaving me behind."), L("¡Los jefes que se preparen!", "The bosses had better get ready!")]),
  "50": X([L("¡Nivel 50! Has alcanzado tu tamaño real.", "Level 50! You've reached your full size.", "w"), L("¡Cincuenta! No hay quien te pare.", "Fifty! Nothing can stop you.", "j")], [L("¡Soy imparable!", "I'm unstoppable!"), L("¡Este es mi tamaño de verdad!", "This is my real size!")])}
S = lambda a, b: X(L(*a), L(*b))
c["species"] = {
  "Slime": [S(("Dejas un rastro pegajoso por todas partes.", "You leave a sticky trail everywhere."), ("¡Es mi estilo!", "It's my style!"))],
  "Giant-Ant": [S(("Siempre tan trabajador, ¿eh?", "Always so hardworking, huh?"), ("¡Una hormiga nunca descansa!", "An ant never rests!"))],
  "Amphis": [S(("Cuidado con ese veneno, no lo apuntes a mí.", "Careful with that venom, don't aim it at me."), ("Sssólo a los malos.", "Onlyyy at the bad guys."))],
  "Orc": [S(("Un orco leal vale por diez.", "One loyal orc is worth ten."), ("¡Por la tribu… es decir, por nosotros!", "For the tribe… I mean, for us!"))],
  "Skeleton": [S(("Tu traqueteo no me deja dormir.", "Your rattling won't let me sleep."), ("Es que me duelen los huesos.", "My bones ache."))],
  "Clay-Golem": [S(("Con cuidado de no agrietarte.", "Careful not to crack."), ("Aguanto lo que haga falta.", "I can take whatever comes."))],
  "Stone-Golem": [S(("Eres más duro que las paredes de la cripta.", "You're tougher than the crypt walls."), ("Y más terco también.", "And more stubborn too."))],
  "Orc-Mage": [S(("¿Qué hechizo toca hoy?", "Which spell is it today?"), ("¡Sorpresa!", "Surprise!"))],
  "Hellbound": [S(("Huele a azufre cuando te enfadas.", "You smell of sulfur when you're angry."), ("Es mi perfume.", "It's my perfume."))],
  "Cyclops": [S(("¿Con un solo ojo ves bien el peligro?", "Can you see danger well with one eye?"), ("Mejor que tú con dos.", "Better than you with two."))],
  "Troll": [S(("¿Te regeneras ya la herida?", "Is that wound healing yet?"), ("Un poco de paciencia y ya está.", "A bit of patience and it's gone."))],
  "Orge": [S(("Cuidado con los techos bajos.", "Watch out for low ceilings."), ("¡Ya me di en la cabeza!", "I already bumped my head!"))]}
json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok")
