// Decisión de juego al volver a la cripta con progreso guardado: continuar donde se quedó o reiniciar desde el nivel 1.
export function chooseDungeon(conn, info) {
  if (document.getElementById("dungeon-choice")) return;
  const dialog = document.createElement("dialog");
  dialog.id = "dungeon-choice";
  dialog.style.cssText = "background:#211d22;color:#e8dcc3;border:1px solid #756959;padding:24px;max-width:440px;font:14px Tahoma,sans-serif";
  const title = document.createElement("h2"); title.textContent = "Cripta de esqueletos";
  const text = document.createElement("p");
  text.textContent = `Has llegado hasta el nivel ${info.deepest} de ${info.total}. ¿Quieres reiniciar la cripta desde el nivel 1 o continuar en el nivel ${info.deepest}?`;
  dialog.append(title, text);
  for (const [label, restart] of [["Continuar en el nivel " + info.deepest, false], ["Reiniciar (nivel 1)", true], ["Cancelar", null]]) {
    const button = document.createElement("button"); button.textContent = label;
    button.style.cssText = "margin:8px 8px 0 0;padding:8px 12px;background:#393039;color:#e8dcc3;border:1px solid #756959;cursor:pointer";
    button.onclick = () => {
      dialog.close(); dialog.remove();
      if (restart !== null) conn.send({ t: "portal", portal: info.portal || "mid-entry", restart });
    };
    dialog.append(button);
  }
  dialog.addEventListener("cancel", () => dialog.remove(), { once: true });
  // No dejar que atajos o letras del diálogo activen órdenes en el mundo.
  dialog.addEventListener("keydown", e => e.stopPropagation());
  document.body.append(dialog); dialog.showModal();
}
