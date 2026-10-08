#!/usr/bin/env python3
"""Servidor estático de desarrollo: multihilo y SIN caché.
Evita que el navegador mezcle módulos viejos y nuevos al refrescar.
Uso:  cd app && python3 tools/serve.py 8777
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    httpd = ThreadingHTTPServer(("", port), NoCacheHandler)
    print(f"Sirviendo en http://localhost:{port}  (sin caché, multihilo)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()
