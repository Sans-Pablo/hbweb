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

// Bola de botón (cerrar / minimizar / restaurar): cúpula oscura con filete dorado y glifo claro (diseño original de las ventanas). Común a `Win` y a los cuadros heredados (gui.js).
export function drawFrameBall(c, cx, cy, glyph, over) {
  const bad = glyph === "x";
  // v0.85.82 (obs. 42): sin fondo propio; se ve la bola de piedra del marco. El símbolo lleva un contorno oscuro y color vivo para destacar
  if (over) { c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fillStyle = bad ? "rgba(184,55,42,.45)" : "rgba(255,225,160,.25)"; c.fill(); }
  const glyphPath = () => { c.beginPath();
  if (glyph === "x") { c.moveTo(cx - 3, cy - 3); c.lineTo(cx + 3, cy + 3); c.moveTo(cx + 3, cy - 3); c.lineTo(cx - 3, cy + 3); }
  else if (glyph === "-") { c.moveTo(cx - 3.5, cy + 1.5); c.lineTo(cx + 3.5, cy + 1.5); }
  else c.rect(cx - 3, cy - 3, 6, 6); c.stroke(); };
  c.strokeStyle = "rgba(20,10,0,.85)"; c.lineWidth = 3.4; glyphPath();
  c.strokeStyle = bad ? (over ? "#fff" : "#ff7a5a") : (over ? "#fff" : "#ffd75a"); c.lineWidth = 1.6; glyphPath(); c.lineWidth = 1;
}
