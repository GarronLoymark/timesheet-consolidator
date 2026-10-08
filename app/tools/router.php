<?php
// Servidor de desarrollo PHP para la app (sirve estáticos SIN caché y ejecuta .php).
// Sin caché: evita que el navegador mezcle módulos viejos y nuevos al refrescar.
// Uso:  cd app && php -S localhost:8777 tools/router.php
//   (o)  php -S localhost:8777 /ruta/app/tools/router.php

$docroot = realpath(__DIR__ . '/..'); // carpeta app/
$path = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');

// Favicon mínimo embebido (evita el 404 de /favicon.ico).
if ($path === '/favicon.ico') {
    header('Content-Type: image/svg+xml');
    header('Cache-Control: no-store');
    echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
       . '<rect width="24" height="24" rx="5" fill="#2e6f9e"/>'
       . '<path d="M12 7v5l3 2" stroke="#fff" stroke-width="2" fill="none" '
       . 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return true;
}

if ($path === '/' || $path === '') {
    $path = '/index.html';
}

$full = realpath($docroot . $path);

// Seguridad: el archivo debe existir y quedar DENTRO de app/ (evita path traversal).
if ($full === false
    || strncmp($full, $docroot . DIRECTORY_SEPARATOR, strlen($docroot) + 1) !== 0
    || !is_file($full)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo '404 Not Found';
    return true;
}

$ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));

// Endpoints del backend: dejar que PHP los ejecute (definen sus propios headers).
if ($ext === 'php') {
    require $full;
    return true;
}

$types = [
    'html'  => 'text/html; charset=utf-8',
    'js'    => 'text/javascript; charset=utf-8',
    'mjs'   => 'text/javascript; charset=utf-8',
    'css'   => 'text/css; charset=utf-8',
    'json'  => 'application/json; charset=utf-8',
    'svg'   => 'image/svg+xml',
    'png'   => 'image/png',
    'ico'   => 'image/x-icon',
    'woff2' => 'font/woff2',
    'xlsx'  => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Content-Length: ' . filesize($full));
readfile($full);
return true;
