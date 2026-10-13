#!/usr/bin/env python3
"""Herramientas de rendimiento (docs/sistemas/rendimiento-sprites.md): presupuestos coherentes, base presente y auditoría funcionando."""
import json, subprocess, sys, tempfile, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
B = json.loads((ROOT / "tools/perf/budget.json").read_text())
assert set(B["sheets"]) == {"max_decoded_bytes", "max_disk_bytes", "max_side"}, "presupuesto de hojas incompleto"
assert 0 < B["regression_tolerance"] < 1
for grp in ("scenarios", "gpu_scenarios"):
    for sc, lims in B[grp].items():
        assert sc in ("boot", "walk", "teleport"), sc
        assert all(k.endswith("_max") and v > 0 for k, v in lims.items()), (grp, sc)
base = json.loads((ROOT / "tools/perf/baseline.json").read_text())
assert {"boot", "walk", "teleport"} <= set(base["scenarios"]), "baseline.json incompleta"
assert base["scenarios"]["boot"]["decoded_bytes"] > 0
try:
    import PIL  # noqa: F401
except ImportError:
    print("OK perf_tools (sin Pillow: auditoría omitida)"); sys.exit(0)
with tempfile.TemporaryDirectory() as t:
    f = os.path.join(t, "a.json")
    r = subprocess.run([sys.executable, str(ROOT / "tools/sprite_audit.py"), "--dir", "ui", "--json", f], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    a = json.loads(Path(f).read_text())
    assert a["sheets"] and all(s["dec"] == s["w"] * s["h"] * 4 for s in a["sheets"]), "la memoria decodificada debe ser ancho*alto*4"
print("OK perf_tools")
