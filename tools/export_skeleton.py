"""Añade las animaciones originales de SKE.PAK al manifiesto web existente.

python tools/export_skeleton.py <carpeta SPRITES del cliente> [web/data]
Requiere Pillow, igual que convert.py. No descarga ni modifica paquetes originales.
"""
import json
import sys
from pathlib import Path
from convert import PakFolder, export


def main():
    if len(sys.argv) not in (2, 3):
        raise SystemExit(__doc__)
    source = Path(sys.argv[1])
    target = Path(sys.argv[2]) if len(sys.argv) == 3 else Path("web/data")
    manifest_file = target / "sprites.json"
    manifest = json.loads(manifest_file.read_text())
    pak = PakFolder(str(source))
    if pak.data("SKE") is None:
        raise SystemExit("No se encuentra SKE.PAK en " + str(source))
    (target / "sprites").mkdir(parents=True, exist_ok=True)
    for n in range(40):
        if not export(pak, "SKE", n, str(target / "sprites"), "ske" + str(n), manifest):
            raise SystemExit("Falta la animación " + str(n))
    manifest_file.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    print("Añadidas 40 hojas originales de esqueletos.")


if __name__ == "__main__":
    main()
