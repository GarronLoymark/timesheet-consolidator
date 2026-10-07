# 06 · Decisiones y pendientes

## Decisiones confirmadas con el negocio

| # | Decisión |
|---|---|
| D1 | Cada línea del timesheet cuenta como una tarea. |
| D2 | Los Job Codes que no son RKD cuentan todos para el PM. |
| D3 | De los RKD, solo cuentan `RKD MTG` y `RKD MTGINT`, y solo si son daily meetings, reuniones con PM, Lead o el equipo, o reuniones con Ops. |
| D4 | **Los daily meetings sí cuentan.** En el consolidado manual de la semana 1 no se contaron; la regla confirmada prevalece. |
| D5 | El PM recibe 8 o 9 h por día según lo que trabajó el equipo. En Q4 se permiten semanas de 45 h. |
| D6 | Cada equipo tiene un solo PM: Web → Maribel Víquez, Standard → Maria Jose Navarrete, QA → Minor Cascante, Email → Guillermo Quesada. |
| D7 | Los recursos fijos deben tener entre 40 y 45 h en una semana completa (8–9 h por día hábil). |
| D8 | Los recursos on demand se cuentan, pero no se validan contra 8–9 h. Solo importa su total semanal, incluido el fin de semana. |
| D9 | Las tareas de fin de semana de los on demand no generan horas de PM. |
| D10 | El equipo de Ops (Juanita, Daniela, Valentina, Liam, Catalina) no se incluye en el reporte por ahora (tipo `No incluir`). |
| D11 | Alfonso Rodriguez, De Francisco Nicolas y Agustín Cattáneo pertenecen a QA. |
| D12 | Se elige una aplicación web, y no una plantilla de Power Query. |
| D13 | Se consolidan los exports de todos los equipos en un solo reporte. |

## Pendientes

| # | Tema | Situación actual | Qué falta |
|---|---|---|---|
| P1 | **Minor Cascante como PM** | Tipo `PM`: sus filas propias se excluyen (116 en la semana 1, en su mayoría "Task assignment" de 0.09 h) y sus horas se calculan con la regla. | Confirmación del propio Minor. Si prefiere usar sus registros reales, se cambia su tipo en la configuración y no hace falta tocar código. |
| P2 | **Redondeo del reparto** | Sin redondeo: la suma diaria es exacta. | Confirmar si el cliente necesita valores con 2 o 4 decimales que sumen exacto. Si es así, implementar un "ajuste en la última fila" como en el proceso manual. |
| P3 | **Feriados** | Los días hábiles son de lunes a viernes, sin feriados. Si alguien registra `RKD HOL` o `RKD PTO`, esas horas suman a su validación. | Definir si se carga un calendario de feriados (CR, COL, US) que reduzca el mínimo y el máximo y no genere horas PM. |
| P4 | **Permisos de edición de la configuración** | En el prototipo, cualquier usuario edita todo. | Decidir si los PMs editan solo el roster de su equipo y un Admin edita parámetros, palabras clave y alias. |
| P5 | **"Loymark meeting"** | Lo registran varios del equipo de QA a diario (0.25 h), pero no coincide con ninguna palabra clave, así que no cuenta. | Confirmar si es un daily. Si lo es, agregar `loymark` a las palabras clave. |
| P6 | **Personas del archivo del cliente que no están en el timesheet** | En el consolidado del cliente aparecen recursos que no vienen en el export de equipos, por ejemplo Greyce Belushi con `RKD DS`. | Definir si la aplicación debe recibir otro export o si quedan fuera del alcance. |
| P7 | **Job Codes faltantes o mal escritos** | Se reportan como incidencia (`OSCM`, `TSAGA`, `TFBFL`, `GBD`, `NFNMS`, `BRF`, `RKD INT`…). | El negocio debe agregarlos a la lista o crear los alias correspondientes. |
| P8 | **Semanas que cruzan de mes** | Se recortan al mes, igual que las pestañas Week del archivo del cliente. | Confirmar que se mantiene así. |
| P9 | **Ajuste manual dentro de la aplicación** | Hoy el ajuste Sí/No por fila se hace en el Excel descargado. | Evaluar si se agrega en la UI y si se guarda en el servidor por semana. |
| P10 | **Historial de reportes generados** | No se guarda nada de los timesheets. | Decidir si se guarda un resumen por semana (totales por persona y por PM) para auditoría, cuidando la privacidad. |

## Cómo cambiar una regla

1. Acordar el cambio con el negocio y anotarlo en la tabla de decisiones.
2. Actualizar `03-reglas-de-negocio.md`, y también `04-excel-de-salida.md` si cambia una fórmula.
3. Agregar o ajustar el caso en `05-casos-de-prueba.md` **antes** de cambiar el código.
4. Implementar el cambio en `core` y verificar que todas las pruebas, incluido el recálculo del Excel, sigan en verde.
