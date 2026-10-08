"""Añade la revisión del despliegue a módulos ESM y entradas HTML para evitar mezclar entregas."""
import re
import sys
from pathlib import Path

IMPORT = re.compile(r'''((?:from\s+|import\s*)["'])(\.[^"'?]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?(["'])''')
SCRIPT = re.compile(r'''(\bsrc\s*=\s*["'])([^"'?]+\.js)(?:\?v=[a-zA-Z0-9_-]+)?(["'])''')


def version_web(root, revision):
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", revision):
        raise ValueError("Revisión inválida")
    count = 0
    for path in Path(root).rglob("*"):
        if path.suffix not in (".html", ".js"):
            continue
        source = path.read_text(encoding="utf-8")
        text = IMPORT.sub(lambda m: m[1] + m[2] + "?v=" + revision + m[3], source)
        if path.suffix == ".html":
            text = SCRIPT.sub(lambda m: m[1] + m[2] + "?v=" + revision + m[3], text)
        if text != source:
            path.write_text(text, encoding="utf-8")
            count += 1
    return count


if __name__ == "__main__":
    print(f"Módulos versionados: {version_web(sys.argv[1], sys.argv[2])}")
