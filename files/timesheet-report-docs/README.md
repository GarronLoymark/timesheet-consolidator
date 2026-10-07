# Reporte semanal de horas (Timesheet Report)

Aplicación web interna que automatiza el reporte semanal de horas de los equipos de desarrollo. Reemplaza el proceso manual actual, en el que cada PM:

1. Extrae del timesheet las horas que los DEVs registran a diario.
2. Las pega en un Excel donde se consolidan las horas de todos los equipos.
3. Revisa que cada miembro tenga entre 40 y 45 horas en la semana.
4. Aplica reglas sobre las horas de los DEVs para calcular las horas del PM.
5. Entrega el consolidado (pestañas "Week" del archivo *TimesheetReport for the client*).

La aplicación hace todo esto en un solo paso. El PM sube los exports del timesheet de todos los equipos, elige la semana, revisa alertas e incidencias, y descarga un Excel listo para entregar.

> Existe un prototipo funcional en `referencia/prototipo.html`, con su lógica en `referencia/core.js`. **Es la referencia de comportamiento:** ante cualquier duda sobre una regla, la implementación nueva debe producir los mismos resultados que el prototipo con los mismos datos (ver `docs/05-casos-de-prueba.md`).

---

## Contenido de esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `README.md` | Visión general, funcionalidad y requisitos técnicos (este archivo). |
| `docs/01-stack.md` | Stack de tecnologías recomendado y por qué. |
| `docs/02-flujo-de-trabajo.md` | Flujo de uso semanal, flujo de procesamiento de datos y plan de desarrollo por fases. |
| `docs/03-reglas-de-negocio.md` | **Toda la lógica del timesheet:** lectura, normalización, validación de horas, cálculo de horas del PM e incidencias. |
| `docs/04-excel-de-salida.md` | Especificación exacta del Excel que se descarga (pestañas, columnas y fórmulas). |
| `docs/05-casos-de-prueba.md` | Casos de prueba con valores esperados tomados de datos reales. |
| `docs/06-pendientes-y-decisiones.md` | Decisiones ya tomadas con el negocio y puntos que siguen abiertos. |
| `config/config-inicial.json` | Configuración inicial: equipos, PMs, tipos de recurso, parámetros, palabras clave y alias. |
| `config/jobcodes.json` | Lista inicial de Job Codes (232 códigos), tomada de la pestaña `JobCodes` del archivo del cliente. |
| `referencia/core.js` | Lógica del prototipo (JavaScript puro, sin DOM). |
| `referencia/prototipo.html` | Prototipo completo en un solo archivo. |

---

## Glosario

| Término | Significado |
|---|---|
| **Timesheet / export** | Archivo Excel que cada PM exporta. Tiene una pestaña por persona con las columnas `Client`, `Task Name`, `Comments`, `Type of task`, `Date`, `Resource`, `Hours`. |
| **Job Code** | Valor de la columna `Client`. Puede ser un cliente (`BFF`, `FBNYC`…) o un código interno que empieza con `RKD` (`RKD MTG`, `RKD TRAIN`, `RKD PTO`…). |
| **Recurso fijo** | DEV de tiempo completo. Debe registrar entre 8 y 9 h por día hábil. |
| **Recurso on demand** | DEV por demanda. No tiene mínimo diario: solo se suman sus horas de la semana, incluido el fin de semana. |
| **PM** | Project Manager del equipo. Sus horas no se registran: se calculan con la regla del equipo. |
| **Tarea que cuenta** | Línea del timesheet que entra en el reparto de horas del PM. Cada línea es una tarea. |
| **Jornada normal / alta** | 8 h o 9 h de PM por día, según cuánto trabajó el equipo ese día. |

---

## Funcionalidad

### F1. Carga de archivos
- Arrastrar o seleccionar uno o varios `.xlsx` a la vez: los exports de todos los equipos se consolidan juntos.
- Si un archivo trae una pestaña `JobCodes`, se usa para actualizar la lista guardada de Job Codes.
- Si el archivo es el consolidado del cliente (solo pestañas `Week…`, `Detail…` y `JobCodes`), únicamente se extraen los Job Codes.
- Mostrar la lista de archivos cargados, con la opción de quitar cada uno.
- **Los timesheets no se guardan en el servidor.** Se procesan en memoria en el navegador.

### F2. Selección de semana
- Detectar las semanas presentes en los datos. Una semana va de lunes a domingo y se recorta al mes calendario: por ejemplo, del jueves 1 al domingo 4 de octubre.
- Etiqueta de la semana con el formato del archivo del cliente, usando el primer y el último día hábil: `1-2 OCT`, `5-9 OCT`.
- Por defecto se selecciona la semana más reciente. Permitir también un rango personalizado (desde/hasta).

### F3. Validación de horas por recurso
- Tabla agrupada por equipo, con una fila por persona y una columna por día del rango (los fines de semana se muestran sombreados).
- **Fijos:** mínimo = días hábiles × 8 h; máximo = días hábiles × 9 h. Estado `OK`, `Faltan X h` o `Excede X h`. Cada día hábil fuera del rango 8–9 h se marca en rojo.
- **On demand:** solo el total de la semana, con fines de semana incluidos. Sin estado de error.
- También aparecen las personas del roster que no tienen ninguna hora en la semana.

### F4. Cálculo de horas del PM
- Tabla por equipo y día hábil: PM, DEVs fijos con horas, promedio por DEV fijo, horas del PM (8 o 9), tareas que cuentan y horas por tarea.
- Las reglas completas están en `docs/03-reglas-de-negocio.md`, sección 10.

### F5. Incidencias de datos
- Lista agrupada por tipo, con archivo, pestaña, número de fila y detalle, para que el PM corrija en el origen.
- Tipos: filas incompletas, filas sin horas, posibles subtotales, duplicados, Job Codes inexistentes, personas que no están en el roster, recursos fijos con horas en fin de semana, filas propias de un PM excluidas y pestañas vacías.
- Si hay personas que no están en el roster, ofrecer el botón "Agregar" para incluirlas en la configuración.

### F6. Resumen
Indicadores de la semana: etiqueta, número de registros y de personas, recursos fijos fuera de rango, horas on demand, horas PM calculadas y número de incidencias.

### F7. Descarga del Excel
- Botón "Descargar Excel", que genera `Timesheet <etiqueta>.xlsx`.
- El archivo usa **fórmulas, no valores fijos**. Si el PM marca un ajuste manual o cambia un parámetro dentro del Excel, todo se recalcula. La especificación completa está en `docs/04-excel-de-salida.md`.
- Las columnas B a I de la pestaña `Consolidado` coinciden con las pestañas `Week` del archivo del cliente, para poder copiar y pegar directamente.

### F8. Configuración compartida
Todos los PMs usan la misma configuración. Se guarda en el servidor y se puede editar desde la aplicación:

- **Parámetros:** mínimo y máximo de horas por día (8 y 9), umbral para la jornada alta del PM (8.5), horas PM en jornada normal (8) y en jornada alta (9).
- **Equipos (roster):** persona, equipo, PM del equipo, tipo (`Fijo`, `On demand`, `PM`, `No incluir`) y si sus tareas cuentan para el PM (`Sí`/`No`).
- **Palabras clave** de las reuniones que cuentan para el PM.
- **Alias de Job Codes:** "como lo escriben" → "código correcto".
- **Lista de Job Codes.**

Los cambios se guardan solos, con autosave y un indicador de estado. Se recomienda guardar un historial de cambios (quién, cuándo, qué).

---

## Requisitos técnicos

### Funcionales clave
| ID | Requisito |
|---|---|
| RT-01 | Leer `.xlsx` y `.xlsm` con varias pestañas, de hasta unas 30 pestañas por unas 2.300 filas cada una, en menos de 3 s en un equipo de oficina. |
| RT-02 | Leer los **valores cacheados** de las celdas con fórmula. Algunas pestañas calculan `Client` con `=LEFT(Task Name, 5)`. |
| RT-03 | Ubicar la fila de encabezados de cada pestaña dentro de las primeras 5 filas y mapear las columnas **por nombre**, no por posición. |
| RT-04 | Fechas: interpretar el número de serie de Excel como fecha local, sin desplazamiento de zona horaria (epoch 1899-12-30). |
| RT-05 | Toda la lógica de negocio debe vivir en un módulo puro (sin DOM ni red), con pruebas unitarias. Ver `docs/01-stack.md`. |
| RT-06 | Comparaciones de horas redondeadas a 2 decimales, para evitar errores de punto flotante: `15.999999999999996` debe dar `OK`. |
| RT-07 | El Excel de salida debe abrir sin errores de fórmula en Excel 365 y forzar el recálculo al abrir (`fullCalcOnLoad`). |
| RT-08 | El Excel de salida usa solo funciones compatibles con Excel 2010+: `SUMIFS`, `COUNTIFS`, `SUMPRODUCT`, `IFERROR`, `VLOOKUP`, `INDEX`, `MATCH`, `SEARCH`, `TEXT`. **No** usar funciones dinámicas como `FILTER`, `UNIQUE` o `XLOOKUP`. |

### No funcionales
| ID | Requisito |
|---|---|
| RNF-01 | **Privacidad:** los timesheets nunca salen del navegador. El servidor solo almacena configuración y Job Codes. |
| RNF-02 | **Acceso:** solo usuarios de la organización, con SSO corporativo. Roles mínimos: `Admin` y `PM` (ver `docs/06`). |
| RNF-03 | Interfaz en español. Responsive y usable en una laptop de 1280 px. Tablas anchas con scroll horizontal propio. |
| RNF-04 | Accesibilidad básica: navegación por teclado, foco visible y contraste AA. |
| RNF-05 | Errores de lectura o de guardado mostrados con un mensaje claro de qué pasó y cómo resolverlo, nunca de forma silenciosa. |
| RNF-06 | Los parámetros y reglas que el negocio puede cambiar (horas, umbral, palabras clave, alias) se manejan como configuración, nunca en el código. |

### Criterios de aceptación generales
1. Con los archivos de octubre 2026 y la configuración de `config/`, la aplicación produce **exactamente** los valores de `docs/05-casos-de-prueba.md`.
2. El Excel descargado, abierto en Excel, muestra los mismos números que la pantalla.
3. Durante 2 semanas en paralelo con el proceso manual, las diferencias están todas explicadas por incidencias de datos o por reglas acordadas.

---

## Cómo empezar (para el desarrollador)

1. Leer `docs/03-reglas-de-negocio.md` completo antes de escribir código.
2. Abrir `referencia/prototipo.html` en Claude o en un navegador para ver el comportamiento esperado. Fuera de Claude, la configuración compartida y la descarga no funcionan, pero sí el cálculo y la vista previa.
3. Implementar primero el módulo `core` con sus pruebas (`docs/05`), y después la interfaz.
4. Pedir al negocio los archivos de ejemplo reales (`10_TimesheetReport - Oct26 (team timesheet).xlsx` y `10_TimesheetReport - OCT26 for the client.xlsx`) y **anonimizarlos** antes de guardarlos como fixtures en el repositorio.
