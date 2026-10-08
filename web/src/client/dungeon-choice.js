// Decisión de juego, sin crear ni descartar una instancia hasta elegir una acción.
export function chooseDungeon(conn, info) {
  if (document.getElementById("dungeon-choice")) return;
  const dialog = document.createElement("dialog");
  dialog.id = "dungeon-choice";
  dialog.style.cssText = "background:#211d22;color:#e8dcc3;border:1px solid #756959;padding:24px;max-width:440px;font:14px Tahoma,sans-serif";
  const title = document.createElement("h2"); title.textContent = "Volver a la cripta";
  const text = document.createElement("p");
  text.textContent = `Tu instancia sigue abierta: ${info.remaining} de ${info.total} esqueletos restantes. Puedes continuar o reiniciarla con otro mapa y enemigos nuevos.`;
  dialog.append(title, text);
  for (const [label, restart] of [["Continuar", false], ["Reiniciar", true], ["Cancelar", null]]) {
    const button = document.createElement("button"); button.textContent = label;
    button.style.cssText = "margin:8px 8px 0 0;padding:8px 12px;background:#393039;color:#e8dcc3;border:1px solid #756959;cursor:pointer";
    button.onclick = () => {
      dialog.close(); dialog.remove();
      if (restart !== null) conn.send({ t: "portal", portal: "skeleton-entry", restart });
    };
    dialog.append(button);
  }
  dialog.addEventListener("cancel", () => dialog.remove(), { once: true });
  // No dejar que atajos o letras del diálogo activen órdenes en el mundo.
  dialog.addEventListener("keydown", e => e.stopPropagation());
  document.body.append(dialog); dialog.showModal();
}
