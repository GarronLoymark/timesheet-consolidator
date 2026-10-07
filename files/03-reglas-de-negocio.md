# 03 · Reglas de negocio

Este documento contiene **toda la lógica del reporte**. Las secciones siguen el mismo orden que el flujo de procesamiento de `02-flujo-de-trabajo.md` (sección B). La implementación de referencia es `referencia/core.js`.

Convenciones del documento:
- `limpiar(x)`: convertir a texto, reemplazar cualquier secuencia de espacios en blanco por un solo espacio y quitar espacios al inicio y al final.
- `clave(x)`: `limpiar(x)` en minúsculas y sin tildes (normalización NFD, quitando los diacríticos). Se usa para comparar nombres.
- Las horas se comparan **redondeadas a 2 decimales**.

---

## 1. Lectura de libros

- Se procesan **todas las pestañas** de cada archivo cargado.
- Se leen los **valores cacheados** de las celdas. Si una celda tiene fórmula, se usa su resultado y no la fórmula. Caso real: en las pestañas de Joselyn y Charlie, `Client` es `=LEFT(Task Name, 5)`.
- Un archivo puede tener además una pestaña llamada `JobCodes` (comparada con `clave`). Si la tiene, de la fila 2 en adelante se lee la columna A (cliente) y la columna B (código numérico), y se omiten las filas sin alguno de los dos valores. Esa lista **reemplaza** la lista guardada.
- Si un archivo tiene `JobCodes` y todas sus pestañas con datos se llaman `Week…` o `Detail…`, es el consolidado del cliente: solo se toman sus Job Codes y no se procesan sus filas.

## 2. Encabezados y columnas

- Dentro de las **primeras 5 filas** de la pestaña, se busca una fila que contenga celdas cuyo `clave` sea `client` y `hours`. Esa es la fila de encabezados.
- Las columnas se ubican **por nombre**, nunca por posición: `client`, `task name`, `comments`, `type of task`, `date`, `resource`, `hours`. En los archivos reales los datos empiezan en la columna B, y algunas pestañas tienen columnas extra a la derecha (tablas dinámicas, leyendas) que se ignoran.
- Si una pestaña no tiene esa fila de encabezados, se ignora completa (por ejemplo, `Sheet1`).

## 3. Clasificación de cada fila

Para cada fila debajo del encabezado, en este orden:

| Condición | Resultado |
|---|---|
| Sin Task Name, sin Client, sin Resource y sin Date | **Vacía:** se ignora sin aviso. |
| Sin Task Name y sin Client, pero con Hours > 0 | **Subtotal:** se ignora. Si su fecha cae en la semana, genera la incidencia *"Fila sin Client ni Task Name con horas: no se incluye (¿subtotal u horas sin descripción?)"*. |
| Sin Task Name y sin Client, y sin horas | Se ignora sin aviso. |
| Sin Date válida o sin Resource | **Incompleta:** se ignora y genera la incidencia *"Fila incompleta (sin fecha o sin Resource): no se incluye"*. Como no tiene fecha, aparece en todas las semanas. |
| Resto | **Fila de datos.** Si Hours no es numérico, se toma como 0 y genera *"Fila sin horas (se toma como 0)"*. |

Aclaraciones:
- Los subtotales manuales que los DEVs ponen al final de cada día (por ejemplo `=SUM(H2:H12)` o `8` escritos solo en la columna Hours) caen en la primera fila de la tabla y se ignoran. **El caso peligroso es una fila con fecha y Resource pero sin descripción:** antes se sumaba como horas reales. Caso real: Cristian, filas 116 y 117 (ver `05`).
- **Fecha:** si la celda es numérica, se trata como número de serie de Excel y se convierte con `fecha = 1899-12-30 + serie días`, en UTC y sin zona horaria. Si es un objeto fecha, se toman año, mes y día locales. Cualquier otro valor se considera fecha inválida.
- Textos: `Client`, `Task Name`, `Comments`, `Type of task` y `Resource` pasan por `limpiar`. Por ejemplo, `"Maria Paula "` queda `"Maria Paula"`.
- Se guarda el **origen** de cada fila (archivo, pestaña y número de fila en Excel) para las incidencias y para la columna "Origen" del Excel.

## 4. Semanas

- **Semanas disponibles:** para cada fecha con datos, se calcula el lunes y el domingo de su semana y se recortan al mes de esa fecha. Por ejemplo, la semana del 1 de octubre de 2026 (jueves) queda del 1 al 4 de octubre. Las semanas iguales se agrupan y se ordenan cronológicamente.
- **Semana por defecto:** la más reciente.
- **Rango personalizado:** cualquier `desde ≤ hasta`.
- **Días hábiles:** los días de lunes a viernes dentro del rango. Los feriados todavía no se manejan (ver `06`).
- **Etiqueta:** `<día del primer hábil>-<día del último hábil> <MES>`, con el mes en mayúsculas de tres letras en español (`ENE FEB MAR ABR MAY JUN JUL AGO SEP OCT NOV DIC`). Ejemplos: `1-2 OCT`, `5-9 OCT`, `26-30 OCT`.
- Solo se procesan las filas cuya fecha está dentro del rango.

## 5. Personas y roster

Cada fila se asocia a una persona del roster comparando `clave(Resource)` con `clave(dev)`. Así, `"Cristian Villamizar "` coincide con `Cristian Villamizar` y `Agustin` coincide con `Agustín`. En el reporte se usa siempre el nombre tal como está en el roster.

| Tipo | Validación de horas | Sus filas | Sus tareas en el reparto del PM |
|---|---|---|---|
| **Fijo** | 8–9 h por día hábil | Entran al consolidado | Sí (salvo `cuentaPM = No`) |
| **On demand** | Solo el total semanal, incluido el fin de semana | Entran al consolidado | Sí (salvo `cuentaPM = No`), solo en días hábiles |
| **PM** | No se valida | **Se excluyen.** Genera la incidencia *"N filas propias de X (PM) no se incluyen"*. | — (sus horas se calculan) |
| **No incluir** | No aparece | Se excluyen sin incidencia | — |

- **PM del equipo:** el primer valor no vacío de la columna `pm` entre las personas de ese equipo. Si no hay ninguno, el PM es `PM SIN ASIGNAR`.
- **Persona que no está en el roster:** sus filas entran como `Fijo`, con equipo `SIN EQUIPO`, y genera la incidencia *"X no está en Equipos"*, con la opción de agregarla.
- **`cuentaPM = No`:** la persona sí se valida, pero ninguna de sus filas cuenta como tarea para el PM.

Configuración vigente (`config/config-inicial.json`):

| Equipo | PM | Fijos | On demand |
|---|---|---|---|
| Web | Maribel Víquez | Esteban Trejos, Juan Felipe, Tony Aguilar | — |
| Standard | Maria Jose Navarrete | Yatziry Pacheco, Jesús López, Cristian Villamizar, Jonathan Villamizar | — |
| QA | Minor Cascante (tipo `PM`) | Carlos Cancines, Agustín Cattáneo, Silvio Jaime, Ester Soto, Maria Paula, Alfonso Rodriguez, De Francisco Nicolas | Andres Rockbrand |
| Email | Guillermo Quesada | Warner Garron, Kevin Blanco Picado, Cesar Jesus, Andres Cordero, Allan Gamboa | Jorge Cerdas, Joselyn Jimenez |
| Ops | — (tipo `No incluir`) | Juanita Gómez Moreno, Daniela Sarmiento, Valentina Bulla, Liam, Catalina Santilli | — |

## 6. Normalización del Job Code (columna Client)

En este orden:
1. `c = limpiar(Client)`. Si queda vacío, se usan los primeros 5 caracteres de Task Name, con `limpiar` aplicado.
2. Se quitan los `:` finales. Por ejemplo, `CGMOH:` queda `CGMOH`.
3. `C = mayúsculas(c)`.
4. Si `C` está en la tabla de **alias** (comparando en mayúsculas), se usa el código correcto del alias. Alias vigente: `HCPFB → HCSFL`.
5. Si `C` empieza con `RKD`, se usa `C`. Así se unifican variantes como `RKD MtgInt` → `RKD MTGINT`, `RKD Mtg` → `RKD MTG` o `RKD Train` → `RKD TRAIN`. Caso especial: `RKD MTG INT` → `RKD MTGINT`.
6. Si `C` está en la lista de Job Codes, se usa `C`. Si no, se deja `c` como estaba y se genera *"Job Code "c" no existe en JobCodes"*.

Códigos mal escritos detectados en octubre: `GBD` (debería ser GDB), `NFNMS` (MFNMS), `BRF` (BRIF), `HVRSTR` (HRVSTR), `hHLOAZ`, `RKD INT`. Hay también códigos que no están en la lista: `OSCM`, `TSAGA`, `TFBFL`. La aplicación **no** corrige estos casos sola. Se resuelven agregando alias o actualizando la lista de Job Codes.

## 7. ¿La tarea cuenta para el PM? (columna "Cuenta PM (auto)")

**Cada línea del timesheet es una tarea.** Reglas, en orden:

1. Si la persona tiene `cuentaPM = No` → **No**.
2. Si el Job Code **no** empieza con `RKD` → **Sí**. Todo el trabajo de clientes cuenta.
3. Si el Job Code es `RKD MTG` o `RKD MTGINT` → **Sí, solo si** es una reunión de las que cuentan:
   - Daily meetings.
   - Reuniones con PM, Lead o el equipo.
   - Reuniones con el equipo de Ops.

   Como la columna `Type of task` casi siempre dice solo "Meeting", la reunión se identifica por **palabras clave**:
   - `texto = " " + minúsculas(Type of task + " " + Task Name + " " + Comments) + " "`
   - Cuenta si alguna palabra clave no vacía, en minúsculas, aparece como subcadena de `texto`.
   - Palabras clave vigentes: `daily`, ` stand up`, `standup`, ` ops`, ` pm `, ` lead`, ` team`.
   - **Los espacios forman parte de la palabra clave.** ` pm ` exige espacios a los lados para no coincidir dentro de otras palabras, y ` ops` evita coincidir con "workshops".
4. Cualquier otro Job Code `RKD` (`RKD TRAIN`, `RKD PTO`, `RKD HOL`, `RKD IDLE`, `RKD MC`, `RKD DS`, `RKD INT`…) → **No**.

Decisión confirmada con el negocio: **los daily meetings sí cuentan como tarea.** Ojo: en el consolidado manual de la semana 1, Maribel no los contó y usó 8/17 = 0.4705 h por tarea. Con la regla confirmada salen 18 tareas y 0.4444 h. La aplicación sigue la regla confirmada.

**Ajuste manual:** en el Excel de salida, el PM puede escribir `Sí` o `No` en "Ajuste manual" para cualquier fila de DEV. La regla final es `si ajuste ≠ vacío → ajuste; si no → auto`. En la aplicación web este ajuste no existe por ahora; se hace en el Excel.

Ejemplos reales:

| Job Code | Task Name / Type / Comments | Resultado | Por qué |
|---|---|---|---|
| RKD MTG | Daily Scrum / Meeting | Sí | contiene `daily` |
| RKD MTG | Daily Meeting Standard Team / Meeting | Sí | `daily` y ` team` |
| RKD MTGINT | Meetings Vendor Only… / Daily Meeting | Sí | `daily` |
| RKD MTG | Ops Team: Weekly Team Meeting | Sí | ` ops` y ` team` |
| RKD MTG | Loymark + Ops: Weekly Capacity Meeting | Sí | ` ops` |
| RKD Mtg | Meetings RKD & Vendor… / meeting with ops | Sí | ` ops` |
| RKD MTGINT | Meetings Vendor Only… / Internal Meeting / New checklist app review | No | ninguna palabra clave |
| RKD MTG | Loymark meeting / Meeting | No | ninguna palabra clave (revisar con el negocio si es un daily) |
| RKD MTG | ATLFB Widget / Meeting | No | ninguna palabra clave |
| RKD TRAIN | Lightboxes training | No | RKD que no es reunión |
| BFF | Homepage Banner Publish | Sí | no es RKD |

## 8. Duplicados e incidencias

**Duplicados:** dos filas de datos de la **misma pestaña** con el mismo Job Code normalizado, Task Name, Comments, fecha y horas. La segunda (y las siguientes) generan *"Posible duplicado de la fila N (se está sumando)"*. **Se siguen sumando**, porque hay duplicados legítimos (por ejemplo, dos publicaciones de banner iguales el mismo día). El PM decide y corrige en el origen.

Catálogo completo de incidencias:

| Incidencia | Efecto en los datos |
|---|---|
| Fila incompleta (sin fecha o sin Resource) | Fila excluida |
| Fila sin horas | Se cuenta con 0 h |
| Fila sin Client ni Task Name con horas (¿subtotal?) | Fila excluida |
| Posible duplicado de la fila N | Se suma igual |
| Job Code "X" no existe en JobCodes | Se incluye; en el Excel, `Job #` = `NO EXISTE` |
| "X" no está en Equipos | Se incluye como Fijo / SIN EQUIPO |
| Recurso fijo con horas en fin de semana | Se suma al total semanal |
| N filas propias de X (PM) no se incluyen | Filas excluidas |
| Pestaña sin registros | Ninguno. No se reporta si el nombre de la pestaña coincide con una persona `No incluir` (por nombre completo o primer nombre). |

Cada incidencia lleva archivo, pestaña, fila y un detalle corto (día, Task Name truncado a unos 80 caracteres y horas, cuando aplica).

## 9. Validación de horas

Para cada persona del roster que no sea `PM` ni `No incluir`, más cualquier persona sin roster que tenga filas:

- `horas[día]` = suma de Hours de sus filas de datos en ese día.
- `total` = suma de todos los días del rango, incluido el fin de semana.
- **Fijo:**
  - `mínimo = díasHábiles × minDia` y `máximo = díasHábiles × maxDia` (por defecto 8 y 9; en Q4 se permiten semanas de 45 h).
  - Estado: `Faltan (mínimo − total) h` si `total < mínimo`, `Excede (total − máximo) h` si `total > máximo`, y `OK` en otro caso. Las diferencias se muestran con 2 decimales.
  - Cada día hábil con `horas < minDia` o `horas > maxDia` se marca en rojo. Un día con 0 h también se marca.
- **On demand:** sin mínimo ni máximo. Estado: `On demand: X h en la semana`.
- Orden: por equipo, primero los fijos y luego los on demand, y alfabético dentro de cada grupo.

## 10. Horas del PM

Se calculan **por equipo y por día hábil** del rango. En fines de semana no se generan horas de PM, aunque un on demand haya trabajado.

Para cada `(equipo, día)`:

| Campo | Cálculo |
|---|---|
| `devsFijos` | Número de personas **Fijo** del equipo con `horas[día] > 0` |
| `horasFijos` | Suma de horas de esas personas ese día |
| `promedio` | `horasFijos / devsFijos`, o 0 si `devsFijos = 0` |
| `tareas` | Número de filas de datos del equipo ese día con regla final = **Sí**. Incluye las tareas de los on demand. |
| `horasPM` | 0 si `tareas = 0`. Si no, `pmAlta` (9) cuando `promedio ≥ umbral` (8.5), y `pmNormal` (8) en otro caso. |
| `horasPorTarea` | `horasPM / tareas` |

Notas:
- El promedio usa **solo los fijos**, para que un on demand que trabajó 1 h no baje el promedio del equipo.
- El reparto **no se redondea**: la suma diaria es exactamente 8 o 9. El Excel muestra 2 decimales. En el proceso manual se truncaba a 4 decimales y se ajustaba la última fila (0.4705 × 16 + 0.48). Ver `06`.
- **Filas del PM en el consolidado:** por cada fila de DEV con `cuentaPM ≠ No` cuyo Job Code no es `RKD`, o es `RKD MTG` o `RKD MTGINT`, se agrega una fila espejo con los mismos Client, Task Name, Comments, Type of task y Date. En esa fila, `Resource` = PM del equipo y `Hours` = `horasPorTarea` de ese equipo y día si la regla final de la fila origen es Sí, y 0 si no. Las reuniones que no cuentan generan una fila espejo con 0 h, para que el ajuste manual a Sí funcione en el Excel. Las filas de fin de semana quedan en 0.

## 11. Salida

- **Vista previa en pantalla:** resumen (F6), Validación (sección 9), Horas PM (sección 10) e Incidencias (sección 8).
- **Excel:** ver `04-excel-de-salida.md`. Debe reproducir con fórmulas los mismos resultados de las secciones 7, 9 y 10.
