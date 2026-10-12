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
# estado del último workflow por la API pública de GitHub (sin `gh`: no está instalado; el repo es público)
api="https://api.github.com/repos/Sans-Pablo/hbweb/actions/runs?per_page=1"
last() { curl -fsS -H "Accept: application/vnd.github+json" "$api" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=(JSON.parse(d).workflow_runs||[])[0];console.log(r?r.id+" "+r.status+" "+(r.conclusion||"-"):"? ? ?")})'; }
for i in 1 2 3 4 5 6; do
  read -r id st co < <(last 2>/dev/null || echo "? ? ?")
  case "$st $co" in "completed success") echo "✓ CI publicado: v$v «$name» → https://sans-pablo.github.io/hbweb/ (verifica data/version.json?v=N)"; exit 0;;
    completed*) echo "✗ CI falló: $st $co (https://github.com/Sans-Pablo/hbweb/actions/runs/$id)"; exit 1;; esac
  sleep 20
done
echo "… CI sigue en curso o sin respuesta de la API (run $id); mira https://github.com/Sans-Pablo/hbweb/actions"
