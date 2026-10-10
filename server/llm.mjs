// Voz opcional de los habitantes: genera texto en personaje (charla) y opiniones de probador (informe) con un modelo de lenguaje.
//  - Por defecto Ollama en ESTE PC (http://127.0.0.1:11434, gratis, sin internet): `ollama pull llama3.2:3b`. El lanzador lo instala y lo
//    arranca si puede. Esta función existe SIEMPRE: si el modelo no está disponible devuelve null y los habitantes usan sus frases propias;
//    cada minuto vuelve a comprobar, así que en cuanto Ollama arranca (o se instala) empieza a funcionar sin reiniciar el servidor.
//  - Opcional: API de Anthropic (HB_LLM=anthropic y ANTHROPIC_API_KEY en el entorno; la clave NO se guarda en el repositorio).
//  - Ajustes: server/config.json → "llm": {"provider":"ollama|anthropic|off","model":"…","url":"…"}; o HB_LLM / HB_LLM_MODEL / HB_LLM_URL.
// Límites: una petición a la vez, ≥1,5 s entre peticiones y ≤20 por minuto, con tiempo máximo de 12 s.
export function openLlm(cfg = {}, env = process.env, log = console.log) {
  const provider = String(env.HB_LLM || cfg.provider || "ollama").toLowerCase();
  const model = env.HB_LLM_MODEL || cfg.model || (provider === "anthropic" ? "claude-haiku-5-5" : "llama3.2:3b");
  const url = (env.HB_LLM_URL || cfg.url || "http://127.0.0.1:11434").replace(/\/$/, "");
  const key = env.ANTHROPIC_API_KEY || "";
  const timeout = (ms, f) => { const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms); return f(ac.signal).finally(() => clearTimeout(t)); };
  let busy = false, last = 0, model2 = model, checkedAt = -1e9, warned = "";
  const stamps = [];
  const state = { ready: false, provider, model: model2, status: "" };
  const note = m => { if (warned !== m) { warned = m; log("[llm] " + m); } };
  async function probe() {
    if (provider === "off") { state.status = "desactivado"; return false; }
    if (provider === "anthropic") { if (!key) { note("HB_LLM=anthropic pero falta ANTHROPIC_API_KEY."); state.status = "falta clave"; return false; } state.ready = true; state.status = "Anthropic " + model2; note("API de Anthropic con " + model2 + " (de pago)"); return true; }
    if (provider !== "ollama") { note("proveedor desconocido: " + provider); return false; }
    try {
      const r = await timeout(1500, signal => fetch(url + "/api/tags", { signal })), names = ((await r.json()).models || []).map(m => m.name);
      if (!names.length) { state.ready = false; state.status = "Ollama sin modelos"; note("Ollama está en marcha pero sin modelos: ejecuta «ollama pull " + model + "». Mientras, frases propias."); return false; }
      model2 = names.find(n => n === model) || names.find(n => n.startsWith(model.split(":")[0])) || names[0];
      state.ready = true; state.model = model2; state.status = "Ollama " + model2; note("Ollama activo con el modelo " + model2 + " (local, sin coste)"); return true;
    } catch { state.ready = false; state.status = "Ollama no responde"; note("Ollama no responde en " + url + ": los habitantes usan sus frases propias y reintentan cada minuto (ollama.com, gratis)."); return false; }
  }
  const clean = t => String(t || "").replace(/[\r\n]+/g, " ").replace(/^["'«»\s]+|["'«»\s]+$/g, "").replace(/\*[^*]*\*/g, "").replace(/\s+/g, " ").trim();
  const prompt = ({ who, lang, system, task }) => {
    const es = lang !== "en";
    if (task === "feedback") return es
      ? `Eres un jugador-probador de un RPG online de fantasía (port web de Helbreath). Te paso tus estadísticas de las últimas partidas. Da UNA sugerencia concreta de diseño o balance que se apoye en una cifra de esas estadísticas (qué falla o qué cambiarías y por qué), en español, máximo 180 caracteres. No menciones nombres de personajes, ni emojis ni comillas.`
      : `You are a playtester of a fantasy online RPG (a web port of Helbreath). I give you your stats from recent play. Give ONE concrete design or balance suggestion that cites a number from those stats (what is wrong or what you would change, and why), in English, max 180 characters. No character names, no emojis or quotes.`;
    return es
      ? `Eres ${who}, un habitante de Aresfarm en un videojuego de fantasía. ${system} Responde en español con UNA sola frase corta (máximo 90 caracteres), en personaje, sin emojis ni comillas. Si alguien te pregunta sinceramente si eres una IA o un bot, admítelo con naturalidad.`
      : `You are ${who}, a resident of Aresfarm in a fantasy video game. ${system} Reply in English with ONE short sentence (max 90 characters), in character, no emojis or quotes. If someone sincerely asks whether you are an AI or a bot, admit it naturally.`;
  };
  const ask = async req => {
    const now = Date.now();
    if (!state.ready && now - checkedAt > 60000) { checkedAt = now; await probe(); }
    ask.ready = state.ready;
    if (!state.ready || busy) return null;
    while (stamps.length && now - stamps[0] > 60000) stamps.shift();
    if (now - last < 1500 || stamps.length >= 20) return null;
    busy = true; last = now; stamps.push(now);
    const sys = prompt(req), user = req.from + ": " + String(req.text).slice(0, 300), fb = req.task === "feedback", max = fb ? 180 : 110;
    try {
      if (provider === "ollama") {
        const r = await timeout(12000, signal => fetch(url + "/api/chat", { method: "POST", signal, headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: model2, stream: false, options: { num_predict: fb ? 80 : 50, temperature: 0.8 }, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) }));
        return clean((await r.json()).message?.content).slice(0, max) || null;
      }
      const r = await timeout(12000, signal => fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: model2, max_tokens: fb ? 90 : 60, system: sys, messages: [{ role: "user", content: user }] }) }));
      return clean((await r.json()).content?.[0]?.text).slice(0, max) || null;
    } catch { state.ready = false; checkedAt = Date.now(); ask.ready = false; return null; } finally { busy = false; }
  };
  ask.ready = undefined; ask.state = state;                  // undefined = aún sin comprobar (se intenta); false = no disponible
  probe().then(() => { ask.ready = state.ready; setInterval(() => { if (!state.ready) probe().then(() => { ask.ready = state.ready; }); }, 60000).unref?.(); });
  return ask;
}
