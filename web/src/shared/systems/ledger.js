// Libro de oro: único punto por el que cambia p.gold (monitor económico, fase 1; docs/sistemas/economia.md).
// Registra cada movimiento como evento económico {seq, time, reason, cls, delta, actor, artificial, bal}.
// No es un evento de juego: no va a w.events ni a los clientes; sale por w.econHook(w, ev) (el servidor lo persiste).
// cls: "faucet" (crea oro), "sink" (lo destruye) o "transfer" (solo lo mueve; el total no cambia).
// Determinista: sin Date.now ni Math.random (el tiempo es w.time y el orden es w.econSeq).

// Jugadores que no son economía real (bots, residentes, depuración): sus movimientos se marcan artificial.
const isArtificial = p => !!(p.bot || p.resident || p.isBot || p.kind === "citizen");

export function gold(w, p, delta, reason, opts = {}) {
  delta = Math.trunc(delta);
  if (!delta || !Number.isFinite(delta)) return 0;
  p.gold = (p.gold || 0) + delta;
  if (w.econHook) {
    const cls = opts.cls || (delta > 0 ? "faucet" : "sink");
    w.econSeq = (w.econSeq || 0) + 1;
    w.econHook(w, {
      seq: w.econSeq, time: w.time, reason, cls, delta,
      actor: p.name || String(p.id), actorId: p.id,
      peer: opts.peer || null,
      artificial: opts.artificial ?? (opts.debug ? "debug" : isArtificial(p) ? "bot" : null),
      bal: p.gold,
    });
  }
  return delta;
}
