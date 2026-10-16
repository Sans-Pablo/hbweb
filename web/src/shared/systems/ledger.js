// Libro de oro: único punto por el que cambia p.gold (monitor económico, fase 1; docs/sistemas/economia.md).
// Registra cada movimiento como evento económico {seq, time, reason, cls, delta, actor, artificial, bal}.
// No es un evento de juego: no va a w.events ni a los clientes; sale por el sumidero global (setEconSink, el servidor lo persiste) o por w.econHook.
// cls: "faucet" (crea oro), "sink" (lo destruye) o "transfer" (solo lo mueve; el total no cambia).
// Determinista: sin Date.now ni Math.random (el tiempo es w.time y el orden es w.econSeq).

// Jugadores que no son economía real (bots, residentes, depuración): sus movimientos se marcan artificial.
const isArtificial = p => !!(p.bot || p.resident || p.isBot || p.kind === "citizen");

let sink = null, seq = 0;
export const setEconSink = fn => { sink = fn; };         // (w, ev) => void; null lo desactiva

export function gold(w, p, delta, reason, opts = {}) {
  delta = Math.trunc(delta);
  if (!delta || !Number.isFinite(delta)) return 0;
  p.gold = (p.gold || 0) + delta;
  const hook = w.econHook || sink;
  if (hook) {
    const cls = opts.cls || (delta > 0 ? "faucet" : "sink");
    hook(w, {
      seq: ++seq, time: w.time, reason, cls, delta,
      actor: p.name || String(p.id), actorId: p.id,
      peer: opts.peer || null,
      artificial: opts.artificial ?? (opts.debug ? "debug" : isArtificial(p) ? "bot" : null),
      bal: p.gold,
    });
  }
  return delta;
}
