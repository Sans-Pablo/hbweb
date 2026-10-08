"""Servidor local para la versión web. Igual que `python -m http.server`, pero fuerza el tipo
de los .js (algunos Windows los sirven como text/plain y el navegador no carga los módulos)
y escucha en toda la red local para poder entrar desde el móvil.

    python tools/serve.py [puerto]
"""
import http.server
import os
import sys

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
        ".wav": "audio/wav", ".mp3": "audio/mpeg", ".png": "image/png", ".bin": "application/octet-stream",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    # soporte de "Range" para que el navegador pueda saltar dentro de la música
    # (http.server no lo trae; sin él, cambiar de versión la reinicia desde el principio)
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not rng.startswith("bytes=") or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a, _, b = rng[6:].split(",")[0].partition("-")
        try:
            start = int(a) if a else max(0, size - int(b))
            end = int(b) if a and b else size - 1
        except ValueError:
            return super().send_head()
        if start >= size:
            self.send_response(416); self.send_header("Content-Range", "bytes */%d" % size); self.end_headers()
            return None
        end = min(end, size - 1)
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_remaining", None)
        if left is None:
            return super().copyfile(source, outputfile)
        self._remaining = None
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")      # recargar siempre la última versión
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print("Sirviendo %s en http://0.0.0.0:%d/" % (os.path.abspath(WEB), port))
    http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
