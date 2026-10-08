#!/usr/bin/env python3
"""Servidor estático de desarrollo: multihilo, SIN caché y con keep-alive.

- HTTP/1.1 con keep-alive: el navegador reutiliza conexiones en vez de abrir
  una por cada módulo, lo que evita los ERR_CONNECTION_RESET al refrescar.
- Sin caché: evita mezclar módulos viejos y nuevos.
- Tolera desconexiones del navegador sin volcar trazas.

Uso:  cd app && python3 tools/serve.py 8777
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Sirve siempre desde la carpeta app/ (padre de tools/), sin depender del cwd.
APP_DIR = str(Path(__file__).resolve().parent.parent)

# Favicon mínimo (SVG) para que el navegador no pida /favicon.ico y falle con 404.
FAVICON = (
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
    b'<rect width="24" height="24" rx="5" fill="#2e6f9e"/>'
    b'<path d="M12 7v5l3 2" stroke="#fff" stroke-width="2" fill="none" '
    b'stroke-linecap="round" stroke-linejoin="round"/></svg>'
)


class DevHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive: menos conexiones, menos resets

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        if self.path == "/favicon.ico":
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(FAVICON)))
            self.end_headers()
            self.wfile.write(FAVICON)
            return
        super().do_GET()

    def handle_one_request(self):
        # El navegador cierra conexiones keep-alive al refrescar; no es un error.
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError):
            self.close_connection = True

    def log_message(self, *args):
        pass  # silencioso


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer.request_queue_size = 128
    httpd = ThreadingHTTPServer(("", port), lambda *a: DevHandler(*a, directory=APP_DIR))
    print(f"Sirviendo {APP_DIR} en http://localhost:{port}  (sin caché, keep-alive, multihilo)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()
