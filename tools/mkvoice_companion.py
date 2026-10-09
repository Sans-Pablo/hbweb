"""Añade a web/data/voice.json la sección «companion» (diálogos entre el personaje y su mascota). Idempotente.
    python3 tools/mkvoice_companion.py
Cada línea lleva es/en; las del compañero se anteponen con el sonido de su especie (voice.js). `tone` = w/j/d como en el resto."""
import json, os
P = os.path.join(os.path.dirname(__file__), "..", "web", "data", "voice.json")
L = lambda es, en, tone=None: {"es": es, "en": en, **({"tone": [tone]} if tone else {})}
X = lambda me, pet: {"me": me, "pet": pet}
d = json.load(open(P, encoding="utf-8"))
d["companion"] = {
  "noise": {
    "Slime": L("¡Splash!", "Splash!"), "Giant-Ant": L("¡Clic clic!", "Click click!"), "Amphis": L("¡Sssss!", "Sssss!"),
    "Orc": L("¡Grrr!", "Grrr!"), "Skeleton": L("*cric cric*", "*clack clack*"), "Clay-Golem": L("*ruuum*", "*rumble*"),
    "Stone-Golem": L("*ruuum*", "*rumble*"), "Orc-Mage": L("¡Hmpf!", "Hmpf!"), "Hellbound": L("¡Grraaah!", "Grraaah!"),
    "Cyclops": L("¡Uuuargh!", "Uuuargh!"), "Troll": L("¡Grunt!", "Grunt!"), "Orge": L("¡Ugh!", "Ugh!")},
  "summon": X([L("¡Ven aquí, compañero!", "Come here, partner!", "d"), L("Es hora de cazar juntos.", "Time to hunt together.", "w"), L("¡A trabajar, equipo!", "Let's get to work, team!", "j")],
              [L("¡Listo para pelear!", "Ready to fight!"), L("¡Aquí estoy!", "Here I am!"), L("¿A quién machacamos hoy?", "Who are we smashing today?")]),
  "dismiss": X([L("Descansa un rato.", "Take a rest.", "w"), L("Vuelve a la bola, buen trabajo.", "Back to the ball, good work.", "d")],
               [L("Vale… ¡avísame cuando haya pelea!", "Okay… call me when there's a fight!"), L("Me echaré una siesta.", "I'll take a nap.")]),
  "levelup": X([L("¡Qué fuerte te estás poniendo!", "You're getting so strong!", "j"), L("Buen trabajo, sigue así.", "Good job, keep it up.", "w")],
               [L("¡He subido de nivel!", "I leveled up!"), L("¡Ahora pego más fuerte!", "Now I hit harder!"), L("¡Gracias por entrenarme!", "Thanks for training me!")]),
  "faint": X([L("¡No! Aguanta… te recupero enseguida.", "No! Hang in there… I'll get you back soon.", "w"), L("Perdona, me pasé de valiente.", "Sorry, I got too brave.", "d")],
             [L("Auch… me han dado fuerte.", "Ouch… they hit me hard."), L("No me sueltes…", "Don't leave me…")]),
  "lowhp": X([L("¡Cuidado, retírate un poco!", "Careful, fall back a bit!", "w"), L("¡Aguanta, voy a por ellos!", "Hold on, I'll get them!", "d")],
             [L("¡Me están dando duro!", "They're hitting me hard!"), L("Me queda poca vida…", "I'm low on health…")]),
  "kill": X([L("¡Bien hecho!", "Well done!", "d"), L("Esa fue buena.", "That was a good one.", "j")],
            [L("¡Otro menos!", "One less!"), L("¡Fácil!", "Easy!"), L("¿Viste eso?", "Did you see that?")]),
  "hurt": X([L("¡Eh! ¡Con mi compañero no os metáis!", "Hey! Leave my partner alone!", "d")],
            [L("¡Eso dolió!", "That hurt!")]),
  "chat": [
    X(L("¿Todo bien por ahí?", "All good over there?", "w"), L("Todo bien, jefe.", "All good, boss.")),
    X(L("¿Tienes hambre?", "Are you hungry?", "j"), L("¡Siempre!", "Always!")),
    X(L("¿Qué opinas de este sitio?", "What do you think of this place?", "w"), L("Huele a pelea. Me gusta.", "Smells like a fight. I like it.")),
    X(L("Eres el mejor compañero.", "You're the best partner.", "j"), L("¡Y tú el mejor entrenador!", "And you're the best trainer!")),
    X(L("¿Listo para lo que venga?", "Ready for whatever comes?", "d"), L("¡Siempre listo!", "Always ready!")),
    X(L("No te alejes mucho.", "Don't wander off.", "w"), L("Voy pegado a ti.", "I'm right behind you.")),
    X(L("¿Cansado?", "Tired?", "j"), L("Solo si tú lo estás.", "Only if you are.")),
    X(L("Un día seremos leyendas.", "One day we'll be legends.", "d"), L("¡Con estadísticas compartidas!", "With shared stats!")),
  ],
}
json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", len(d["companion"]["chat"]))
