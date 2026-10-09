#!/usr/bin/env bash
# Entrega completa en un comando:  tools/release.sh 0.25.0 "Nombre" "mensaje del commit"
# Comprueba que CHANGELOG y news.json mencionan la versión, sube web/data/version.json, regenera docs/MAPA.md, pasa todos los tests,
# hace commit (con los trailers), pull --rebase, push y espera a que el CI publique. Imprime la versión publicada al final.
set -e
cd "$(dirname "$0")/.."
v="$1"; name="$2"; msg="${3:-v$v $name}"
[ -n "$v" ] && [ -n "$name" ] || { echo "uso: tools/release.sh X.Y.Z \"Nombre\" [\"mensaje\"]"; exit 1; }
grep -q "## $v" docs/CHANGELOG.md || { echo "✗ falta «## $v» en docs/CHANGELOG.md"; exit 1; }
grep -q "v$v" web/data/news.json || { echo "✗ falta una entrada «v$v» en web/data/news.json"; exit 1; }
echo "{\"version\": \"$v\", \"name\": \"$name\", \"date\": \"$(date +%F)\"}" > web/data/version.json
tools/mapa.sh >/dev/null
tools/test.sh
git add -A
git commit -q -m "v$v $msg

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PcjV2utGChnwb1EzsfPttA"
git pull -q --rebase origin main
git push -q origin main
sleep 15
id=$(gh run list --repo Sans-Pablo/hbweb --limit 1 --json databaseId -q '.[0].databaseId')
for i in 1 2 3 4 5 6; do
  s=$(gh run view "$id" --repo Sans-Pablo/hbweb --json status,conclusion -q '.status+" "+.conclusion')
  case "$s" in "completed success") echo "✓ CI publicado: v$v «$name» → https://sans-pablo.github.io/hbweb/ (verifica data/version.json?v=N con WebFetch)"; exit 0;;
    completed*) echo "✗ CI falló: $s (gh run view $id --log-failed)"; exit 1;; esac
  sleep 20
done
echo "… CI sigue en curso (run $id); repite: gh run view $id --repo Sans-Pablo/hbweb"
