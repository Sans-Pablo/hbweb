#!/usr/bin/env bash
# Todos los tests en paralelo; solo imprime los que fallan (con su cola) y un resumen de una línea.
#   tools/test.sh            todos
#   tools/test.sh tutorial   solo los que contengan «tutorial» (sin lentos: usa --fast para saltar net-*)
cd "$(dirname "$0")/.." || exit 1
pat="${1:-}"; [ "$pat" = "--fast" ] && { pat=""; fast=1; }
out=$(mktemp -d); pids=()
for t in tests/*.test.mjs tests/*_test.py; do
  [ -e "$t" ] || continue
  case "$t" in *"$pat"*) ;; *) continue;; esac
  [ -n "$fast" ] && case "$t" in *net-*) continue;; esac
  n=$(basename "$t")
  ( if [[ $t == *.py ]]; then python3 "$t"; else node "$t"; fi ) >"$out/$n.log" 2>&1 &
  pids+=("$! $n")
done
fail=0; total=0
for e in "${pids[@]}"; do
  pid=${e% *}; n=${e#* }; total=$((total+1))
  if ! wait "$pid"; then fail=$((fail+1)); echo "✗ $n"; tail -15 "$out/$n.log" | sed 's/^/    /'; fi
done
rm -rf "$out"
[ $fail -eq 0 ] && echo "OK $total tests" || { echo "FALLAN $fail de $total"; exit 1; }
