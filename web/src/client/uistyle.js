// Estilo común de todas las ventanas del cliente (Win de window.js, ClassicDialog y cuadros sueltos de gui.js): una sola fuente,
// un tamaño mínimo legible, la paleta de tinta sobre el marco de madera/piedra y las medidas de maquetación compartidas.
// El marco, los botones y los textos de los cuadros originales NO se tocan: esto solo unifica lo propio del port.
// Ver docs/sistemas/ventanas.md.
export const FONT_FAMILY = "Tahoma, Verdana, sans-serif";   // la del cliente original (GDI); se mantiene para conservar el estilo Helbreath
export const MIN_SIZE = 10;                                  // por debajo de 10 px el texto del lienzo no se lee: gui.text lo sube a este mínimo
export const font = (size = 12, bold = false) => (bold ? "bold " : "") + Math.max(MIN_SIZE, size) + "px " + FONT_FAMILY;

// Medidas compartidas (coordenadas locales de la ventana, que ocupa su marco completo).
export const LAYOUT = {
  titleY: 15,     // título centrado sobre la barra superior del marco (igual en Win y en ClassicDialog)
  padX: 22,       // margen lateral del área útil de una Win
  padTop: 38,     // primera línea útil bajo la barra del título
  padBottom: 26,  // hueco que deja el borde inferior del marco
  gap: 6,         // separación entre elementos contiguos
  rowH: 18,       // alto de fila de una tabla de texto de 12 px
  btnH: 20,       // alto del botón de piedra y de los campos
};

// Tinta sobre el fondo claro (madera) de los cuadros clásicos, con contraste suficiente.
export const INK = "#2d1919", DARK = "#040032", WHITE = "#fff", RED = "#c31919";
export const GOOD = "#1a6b1a", DIM = "#5a4636", BLUE = "#2a4ea8";

// Bola de botón (cerrar / minimizar / restaurar) con el mismo diseño que las bolas plateadas del marco de las ventanas: esfera de plata
// con brillo arriba a la izquierda y filete oscuro; el glifo va grabado en marrón (rojizo para cerrar). Común a `Win` y a los cuadros heredados (gui.js).
export function drawFrameBall(c, cx, cy, glyph, over) {
  const bad = glyph === "x", r = 7;
  const g = c.createRadialGradient(cx - 2.2, cy - 2.6, 0.5, cx, cy, r + 1);
  if (over) { g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, bad ? "#f0b8a8" : "#f3e6c0"); g.addColorStop(1, bad ? "#a8452f" : "#8e7440"); }
  else { g.addColorStop(0, "#f4f2ee"); g.addColorStop(0.4, "#b9b4aa"); g.addColorStop(1, "#4d463c"); }
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = g; c.fill(); c.strokeStyle = "#2a2014"; c.lineWidth = 1; c.stroke();
  c.strokeStyle = bad ? "#6a1a10" : "#3a2c14"; c.lineWidth = 1.7; c.lineCap = "round"; c.beginPath();
  if (glyph === "x") { c.moveTo(cx - 2.6, cy - 2.6); c.lineTo(cx + 2.6, cy + 2.6); c.moveTo(cx + 2.6, cy - 2.6); c.lineTo(cx - 2.6, cy + 2.6); }
  else if (glyph === "-") { c.moveTo(cx - 3, cy - 0.5); c.lineTo(cx + 3, cy - 0.5); }
  else c.rect(cx - 2.5, cy - 2.5, 5, 5);
  c.stroke(); c.lineWidth = 1; c.lineCap = "butt";
}
