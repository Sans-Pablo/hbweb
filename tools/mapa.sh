#!/usr/bin/env bash
# Regenera docs/MAPA.md: una línea por módulo (primer comentario del fichero) + tamaño. Sirve para NO explorar el código a ciegas.
cd "$(dirname "$0")/.." || exit 1
{
echo "# Mapa del código"; echo
echo "Generado por \`tools/mapa.sh\` (no editar a mano). Cada línea: fichero · líneas · para qué sirve (primer comentario del fichero)."; echo
for d in web/src/shared web/src/shared/systems web/src/client server tests tools; do
  echo "## $d"; echo
  for f in $d/*.js $d/*.mjs $d/*.py; do
    [ -e "$f" ] || continue
    c=$(grep -m1 -E '^(//|#[^!])' "$f" | sed -E 's/^(\/\/|#) ?//' | cut -c1-140)
    echo "- \`$(basename "$f")\` · $(wc -l <"$f") · $c"
  done; echo
done
} > docs/MAPA.md
echo "docs/MAPA.md: $(wc -l < docs/MAPA.md) líneas"
