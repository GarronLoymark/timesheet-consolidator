# Reporte semanal de horas

Aplicación 100% en el navegador para consolidar los timesheets semanales y
descargar el Excel de entrega. **Los archivos nunca salen de tu equipo**: todo
el procesamiento ocurre en el navegador (privacidad RNF-01).

## Cómo ejecutar

No necesita build ni Node. Solo un servidor con PHP (el backend se construye en PHP):

```bash
php -S localhost:8777 app/tools/router.php
```

El router sirve la app **sin caché** (para que al refrescar no se mezclen
módulos viejos y nuevos), responde el favicon y ya ejecuta endpoints `.php`
cuando se agreguen. Luego abre <http://localhost:8777/index.html>.

> Para publicarla, copia la carpeta `app/` a cualquier hosting con PHP
> (Nginx + PHP-FPM, Apache, un recurso compartido interno, etc.).

## Uso

1. Arrastra los `.xlsx` / `.xlsm` exportados del timesheet (uno o varios equipos).
2. Elige la semana (por defecto, la más reciente) o un rango personalizado.
3. Revisa **Validación**, **Horas PM** e **Incidencias**.
4. Pulsa **Descargar Excel** para obtener `Timesheet <semana>.xlsx` con fórmulas.
5. Ajusta la **Configuración** (parámetros, palabras clave, roster, alias) si hace
   falta; se guarda en tu navegador.

## Estructura

```
app/
├─ index.html              # la aplicación
├─ src/
│  ├─ core/                # lógica de negocio pura (sin DOM ni red)
│  │  ├─ text.js  dates.js  parse.js  weeks.js
│  │  ├─ jobcodes.js  rules.js  compute.js  excel.js
│  │  └─ index.js          # punto de entrada del core
│  ├─ ui/                  # interfaz (carga, semana, tablas, config)
│  ├─ config.js            # carga de la configuración inicial
│  └─ styles.css
├─ config/                 # configuración y Job Codes iniciales
├─ vendor/                 # SheetJS 0.20.3 y ExcelJS 4.4 (alojados localmente)
└─ test/
   ├─ tests.html           # corre las pruebas en el navegador
   ├─ run.js  harness.js
   └─ fixtures/            # datos reales de octubre 2026 (no versionar sin anonimizar)
```

## Pruebas

Abre <http://localhost:8777/test/tests.html>. Verifica el core contra los valores
esperados de `docs/05-casos-de-prueba.md` usando los datos reales (casos 2, 3, 4,
6, 7 y detección de semanas). Objetivo: **todo en verde**.

## Notas técnicas

- Lectura de Excel: **SheetJS 0.20.3** (lee valores cacheados de fórmulas). Se
  evita la 0.18.5 por las CVE-2023-30533 y CVE-2024-22363.
- Escritura: **ExcelJS 4.4** con fórmulas, estilos, formato condicional y
  validación de datos. El libro usa `fullCalcOnLoad` y solo funciones de
  Excel 2010+ (`SUMIFS`, `COUNTIFS`, `SUMPRODUCT`, `IFERROR`, `VLOOKUP`,
  `SEARCH`, `TEXT`). Genera 2.621 fórmulas con la semana 1 (Caso 8).
- Las reglas de negocio están descritas en `files/timesheet-report-docs/docs/`.
