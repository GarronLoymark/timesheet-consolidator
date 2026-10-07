# 04 · Excel de salida

- **Nombre del archivo:** `Timesheet <etiqueta>.xlsx`. Por ejemplo, `Timesheet 1-2 OCT.xlsx`.
- **Pestañas, en este orden:** `Consolidado`, `Validacion`, `Horas PM`, `Incidencias`, `Parametros`, `Equipos`, `JobCodes`.
- **Requisitos generales:**
  - Fuente Arial 10.
  - Encabezados en blanco y negrita sobre azul `#1F3864`.
  - Celdas editables por el usuario con relleno amarillo `#FFF2CC`.
  - Filas del PM con relleno verde `#E2EFDA`.
  - Alertas en rojo `#F8CBAD` y estados correctos en verde `#C6EFCE`.
  - Recalcular al abrir (`calcProperties.fullCalcOnLoad = true`).
  - Usar **solo** funciones de Excel 2010+ (ver RT-08 en el README).

En las fórmulas, `{r}` es el número de fila actual y `CR(X)` es el rango de la columna X del Consolidado, desde la primera hasta la última fila de datos: `Consolidado!$X$3:$X$<última>`.

---

## Parametros

| Celda | Contenido |
|---|---|
| A1 | Título "Parámetros del reporte" |
| A3/B3 | Semana desde (fecha, `dd/mm/yyyy`) |
| A4/B4 | Semana hasta |
| A5/**B5** | Horas mínimas por día (recurso fijo): `minDia` |
| A6/**B6** | Horas máximas por día: `maxDia` |
| A7/**B7** | Umbral de promedio para la jornada alta del PM: `umbral` |
| A8/**B8** | Horas PM, jornada normal: `pmNormal` |
| A9/**B9** | Horas PM, jornada alta: `pmAlta` |
| A12–A13 | Título y explicación de las palabras clave |
| **A14:A53** | 40 celdas amarillas con las palabras clave, incluidas las vacías, para que se puedan agregar más |

Las celdas B5 a B9 y A14:A53 son editables, y las demás pestañas las referencian con referencias absolutas.

## Equipos y JobCodes
- **Equipos:** copia en valores del roster (persona, equipo, PM, tipo, si sus tareas cuentan). Es informativa; la fuente de verdad es la configuración de la aplicación.
- **JobCodes:** columnas A `Client` y B `JobCode`, con encabezado en la fila 1. Rango usado por el Consolidado: `JobCodes!$A$2:$B$<n+1>`.

## Consolidado

- Fila 1: B1 = etiqueta de la semana, en negrita tamaño 12.
- Fila 2: encabezados desde la columna B.
- Datos desde la fila 3: **primero todas las filas DEV** (ordenadas por equipo, tipo, persona y fecha), **después todas las filas PM**.
- Autofiltro en B2:P<última> y paneles inmovilizados en la fila 2.

| Col | Encabezado | Fila DEV | Fila PM |
|---|---|---|---|
| B | Job # | `=IFERROR(VLOOKUP(C{r},JobCodes!$A$2:$B$n,2,0),"NO EXISTE")` | igual |
| C | Client | Job Code normalizado (valor) | igual al origen |
| D | Task Name | valor | igual al origen |
| E | Comments | valor | igual al origen |
| F | Type of task | valor | igual al origen |
| G | Date | fecha (`dd/mm/yyyy`) | igual al origen |
| H | Resource | nombre del roster | PM del equipo |
| I | Hours | valor | `=IF(O{r}="Sí",SUMIFS('Horas PM'!$I:$I,'Horas PM'!$A:$A,J{r},'Horas PM'!$B:$B,G{r}),0)` |
| J | Equipo | valor | valor |
| K | Tipo recurso | `Fijo` / `On demand` | `PM` |
| L | Tipo fila | `DEV` | `PM` |
| M | Cuenta PM (auto) | fórmula abajo, o `"No"` en valor si la persona tiene `cuentaPM = No` | vacío |
| N | Ajuste manual (Sí/No) | vacío, amarillo, con validación de lista `"Sí,No"` | vacío |
| O | Cuenta PM final | `=IF(N{r}<>"",N{r},M{r})` | `=O{fila origen}` |
| P | Origen | `<pestaña> fila <n>` | `Fila <fila origen>` |

**Fórmula de la columna M (Cuenta PM auto):**

```
=IF(LEFT(UPPER(TRIM(C{r})),3)<>"RKD","Sí",
  IF(OR(UPPER(TRIM(C{r}))="RKD MTG",UPPER(TRIM(C{r}))="RKD MTGINT"),
    IF(SUMPRODUCT((Parametros!$A$14:$A$53<>"")
        *ISNUMBER(SEARCH(LOWER(Parametros!$A$14:$A$53),
                         " "&LOWER(F{r}&" "&D{r}&" "&E{r})&" ")))>0,"Sí","No"),
    "No"))
```

`(rango<>"")` es necesario porque `SEARCH("", texto)` devuelve 1 y haría que todo cuente.

Las filas PM solo se generan para filas DEV de personas con `cuentaPM ≠ No` cuyo Job Code no empieza con RKD, o es `RKD MTG` o `RKD MTGINT`.

Formato condicional: B igual a `"NO EXISTE"` → rojo.

## Validacion

- A1: título.
- Fila 2: a partir de la columna D, una fecha por cada día del rango (gris, tamaño 8). Las fórmulas la usan como criterio.
- Fila 3: encabezados `Recurso | Equipo | Tipo | <Jue 01/10> … | Total | Mínimo | Máximo | Estado`.
- Desde la fila 4: una fila por persona (sección 9 de las reglas). Las columnas de fin de semana van con relleno gris claro.

| Columna | Fórmula |
|---|---|
| Día (D…) | `=SUMIFS(CR(I),CR(H),$A{r},CR(G),<col>$2,CR(L),"DEV")` |
| Total | `=SUM(D{r}:<últimoDía>{r})` |
| Mínimo | `=IF($C{r}="On demand","",<díasHábiles>*Parametros!$B$5)` |
| Máximo | `=IF($C{r}="On demand","",<díasHábiles>*Parametros!$B$6)` |
| Estado | `=IF($C{r}="On demand","On demand: "&TEXT(T,"0.00")&" h en la semana",IF(T<Min,"Faltan "&TEXT(Min-T,"0.00")&" h",IF(T>Max,"Excede "&TEXT(T-Max,"0.00")&" h","OK")))` |

Formato condicional:
- Cada columna de **día hábil**: `AND($C4="Fijo",OR(X4<Parametros!$B$5,X4>Parametros!$B$6))` → rojo.
- Estado: igual a `"OK"` → verde; `AND($C4="Fijo",<Estado>4<>"OK")` → rojo.

Paneles inmovilizados en la columna C y la fila 3.

## Horas PM

Fila 1: encabezados. Desde la fila 2: una fila por cada `(equipo, día hábil)`, ordenadas por equipo y fecha. Al final, una fila TOTAL.

| Col | Encabezado | Contenido |
|---|---|---|
| A | Equipo | valor |
| B | Fecha | fecha |
| C | PM | valor |
| D | DEVs fijos con horas | `=COUNTIFS(Validacion!$B$4:$B$n,A{r},Validacion!$C$4:$C$n,"Fijo",Validacion!<colDía>$4:<colDía>$n,">0")` |
| E | Horas de los fijos | `=SUMIFS(CR(I),CR(J),A{r},CR(G),B{r},CR(K),"Fijo",CR(L),"DEV")` |
| F | Promedio por DEV fijo | `=IFERROR(E{r}/D{r},0)` |
| G | Horas PM del día | `=IF(H{r}=0,0,IF(F{r}>=Parametros!$B$7,Parametros!$B$9,Parametros!$B$8))` |
| H | Tareas que cuentan | `=COUNTIFS(CR(J),A{r},CR(G),B{r},CR(L),"DEV",CR(O),"Sí")` |
| I | Horas PM por tarea | `=IFERROR(G{r}/H{r},0)` |
| J | Control: total asignado | `=SUMIFS(CR(I),CR(J),A{r},CR(G),B{r},CR(L),"PM")` |

- **Fila TOTAL:** suma de E, G, H y J.
- **Formato condicional:** `ROUND(J2,2)<>ROUND(G2,2)` → rojo. Avisa si el reparto no cuadra.

## Incidencias

Columnas `Archivo | Pestaña | Fila | Incidencia | Detalle`, una fila por incidencia (sección 8 de las reglas).

---

## Verificación automática (CI)

1. Generar el Excel con los fixtures.
2. Recalcularlo con LibreOffice headless (`soffice --headless --convert-to xlsx`, o una macro de recálculo).
3. Verificar que no hay celdas con `#NAME?`, `#VALUE!`, `#REF!`, `#DIV/0!` ni `#N/A`.
4. Comparar Validacion y Horas PM contra la salida del `core` con una tolerancia de 0.005.
