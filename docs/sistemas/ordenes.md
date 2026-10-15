# Órdenes a los bots (orders.js)

INVENTO del port (sin equivalente en el original). Glosario determinista, sin modelo, que se aplica antes del LLM en `residents.js` (`obey`).

| Frase (es/en) | Resultado |
|---|---|
| «vamos a matar/cazar/farmear/limpiar X», «let's kill/hunt/farm X» | el bot te sigue (10 min) y solo ataca a X (`p.bot.only` = nombre de NPC.cfg) |
| «vamos a hacer EK», «let's do EK» | te sigue y solo ataca jugadores enemigos (`only="@ek"`) |

- X se resuelve con `ALIAS` (español/inglés) o con el nombre exacto de NPC.cfg. El test comprueba que todos los alias existen en npc.json.
- Criatura desconocida: el bot pregunta «¿cómo se llama la criatura?» (60 s). Un nombre válido → caza; «no» (≤2 palabras) → cancela; otra cosa → ticket y «sigo sin entenderlo».
- Ticket: `adv.order` → `bugs.add({kind:"order"})` (ip "bot-orders"): «el bot X no entendió esto del player Y: «…»». Se ve en web/menu.html.
- `only` solo se aplica con dueño (`pickTarget` en bot.js); se limpia al expirar el seguimiento y en `CH.leave`.
- Test: `tests/orders.test.mjs`.
