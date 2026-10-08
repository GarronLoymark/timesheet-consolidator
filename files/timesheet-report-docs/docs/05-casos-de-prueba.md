# 05 · Casos de prueba

## Datos de prueba

- **Fixture principal:** `10_TimesheetReport - Oct26 (team timesheet).xlsx`, con 29 pestañas, una por persona, y datos del 1 al 7 de octubre de 2026. Se pide al negocio y **se anonimiza** antes de subirlo al repositorio: se reemplazan nombres y URLs, y se conservan horas, fechas, Job Codes, Type of task y la estructura de filas.
- **Configuración:** `config/config-inicial.json` y `config/jobcodes.json`.
- **Semana 1:** del 2026-10-01 al 2026-10-04, etiqueta `1-2 OCT`, 2 días hábiles.

Si se anonimizan los nombres, hay que actualizar el roster de la configuración de prueba con el mismo mapeo.

## Caso 1 · Semanas detectadas

| Desde | Hasta | Etiqueta |
|---|---|---|
| 2026-09-14 | 2026-09-20 | 14-18 SEP (por datos viejos en la pestaña "Charlie") |
| 2026-10-01 | 2026-10-04 | 1-2 OCT |
| 2026-10-05 | 2026-10-11 | 5-9 OCT |

Semana por defecto: `5-9 OCT`.

## Caso 2 · Totales de la semana 1

| Métrica | Esperado |
|---|---|
| Filas DEV incluidas | 405 |
| Filas DEV cuya regla automática es "Sí" | 375 |
| Personas en Validación | 22 (21 con horas; Andres Rockbrand no tiene) |
| Incidencias | 24 |
| Horas PM totales | 66 (8 combinaciones de equipo y día; ver Caso 4) |
| Duplicados detectados | A.Cordero 225, Allan 315 y 320, Carlos C 12, Cristian V. 113 a 115 |

Incidencias esperadas por tipo:

| Tipo | Cantidad |
|---|---|
| Fila incompleta (sin fecha o sin Resource) | 4 |
| Job Code no existe | 5 (BRF, OSCM, RKD INT, NFNMS, GBD) |
| Fila sin horas | 4 (Allan, filas 316 a 319) |
| Fila sin Client ni Task Name con horas | 2 (Cristian V., filas 116 y 117) |
| Posible duplicado | 7 |
| Filas propias del PM excluidas | 1 (Minor Cascante, 116 filas) |
| Pestaña sin registros | 1 (Andres Rockbrand) |

## Caso 3 · Validación (semana 1)

| Persona | Tipo | Jue 01/10 | Vie 02/10 | Sáb 03/10 | Dom 04/10 | Total | Estado |
|---|---|---|---|---|---|---|---|
| Cesar Jesus | Fijo | 10.25 | 8 | – | – | 18.25 | Excede 1.25 h (01/10 pasa de 9) |
| Juan Felipe | Fijo | 8 | 6.5 | – | – | 14.5 | Faltan 1.50 h (02/10 en rojo) |
| Cristian Villamizar | Fijo | 10 | 8 | – | – | 18 | OK (01/10 en rojo por más de 9 h) |
| Allan Gamboa | Fijo | 8.95 | 8 | – | – | 16.95 | OK |
| Alfonso Rodriguez | Fijo | 8 | 8 | – | – | 16 | OK (por redondeo; el valor crudo es 15.999999999999996) |
| Joselyn Jimenez | On demand | 4.5 | – | 3 | 4 | 11.5 | On demand |
| Jorge Cerdas | On demand | 1.75 | 1.2 | – | – | 2.95 | On demand |
| Andres Rockbrand | On demand | – | – | – | – | 0 | On demand |
| Minor Cascante | PM | — | — | — | — | — | No aparece |
| Juanita Gómez Moreno | No incluir | — | — | — | — | — | No aparece |

## Caso 4 · Horas PM (semana 1)

| Equipo | Día | PM | DEVs fijos | Horas fijos | Promedio | Horas PM | Tareas | Por tarea |
|---|---|---|---|---|---|---|---|---|
| Email | 01/10 | Guillermo Quesada | 5 | 43.70 | 8.74 | **9** | 67 | 0.1343 |
| Email | 02/10 | Guillermo Quesada | 5 | 40.00 | 8.00 | 8 | 67 | 0.1194 |
| QA | 01/10 | Minor Cascante | 7 | 56.00 | 8.00 | 8 | 79 | 0.1013 |
| QA | 02/10 | Minor Cascante | 7 | 56.00 | 8.00 | 8 | 88 | 0.0909 |
| Standard | 01/10 | Maria Jose Navarrete | 4 | 34.00 | 8.50 | **9** | 22 | 0.4091 |
| Standard | 02/10 | Maria Jose Navarrete | 4 | 32.00 | 8.00 | 8 | 16 | 0.5000 |
| Web | 01/10 | Maribel Víquez | 3 | 24.00 | 8.00 | 8 | 18 | 0.4444 |
| Web | 02/10 | Maribel Víquez | 3 | 22.50 | 7.50 | 8 | 13 | 0.6154 |

Controles:
- En cada fila, la suma de las horas de las filas PM del Consolidado para ese equipo y día es igual a "Horas PM".
- Las 5 tareas de Joselyn del sábado y el domingo generan filas PM con 0 h.

## Caso 5 · El caso de Cristian (filas ocultas al final de la pestaña)

En la pestaña "Cristian V.", filas 113 a 117, todas con fecha 01/10:

| Fila | Contenido | Resultado esperado |
|---|---|---|
| 113 | RKD MTG · Daily Meeting Standard Team · 0.5 | Se incluye y genera "Posible duplicado de la fila 2" |
| 114 | CGMOH · Out Guarantee… · 0.5 | Se incluye y genera "duplicado de la fila 3" |
| 115 | CGMOH · Thanksgiving… · 1 | Se incluye y genera "duplicado de la fila 4" |
| 116 | solo Date, Resource, 2.5 | Se excluye y genera "Fila sin Client ni Task Name…" |
| 117 | solo Date, Resource, 3 | Se excluye y genera "Fila sin Client ni Task Name…" |

Con esto, Cristian queda con 10 h el 01/10: 8 h reales más 2 h duplicadas.

## Caso 6 · Reglas de "cuenta para el PM" (unitarios)

Usar los ejemplos de la tabla de la sección 7 de `03-reglas-de-negocio.md`. Agregar además:

| Entrada | Esperado |
|---|---|
| RKD MTG · "Implementation review" (sin palabra clave) | No: ` pm ` no coincide dentro de "implementation" |
| RKD MTG · "Sync with PM about scope" | Sí |
| Persona con `cuentaPM = No` y Job Code `BFF` | No |
| Lista de palabras clave con una entrada vacía `""` | La entrada vacía no hace que todo cuente |

## Caso 7 · Normalización

| Entrada (Client · Task Name) | Job Code esperado |
|---|---|
| `RKD MtgInt` | `RKD MTGINT` |
| `RKD Mtg` | `RKD MTG` |
| `RKD Train` | `RKD TRAIN` |
| `CGMOH:` | `CGMOH` |
| `HCPFB` | `HCSFL` (alias) |
| vacío · `BVRPA: Halloween…` | `BVRPA` |
| `NTFB ` (con espacio) | `NTFB` |
| `GBD` | `GBD` + incidencia "no existe" |

## Caso 8 · Excel

- Recalculado con LibreOffice: 0 errores de fórmula. Con el fixture completo de la semana 1, el prototipo genera 2.621 fórmulas.
- Los valores de `Validacion` y `Horas PM` son iguales a los de los casos 3 y 4.
- Cambiar `Parametros!B7` (el umbral) a 9 hace que Email y Standard del 01/10 pasen a 8 h de PM.
- Escribir `No` en "Ajuste manual" de una fila de Web del 01/10 baja las tareas a 17 y las horas por tarea a 0.4706, y la fila PM espejo pasa a 0.
