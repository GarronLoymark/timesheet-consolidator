// Feriados nacionales sugeridos por país para 2026. Son una ayuda: el PM los
// agrega con un clic y puede editarlos/quitarlos. Las fechas movibles (Semana
// Santa y, en Colombia, la ley Emiliani) ya están calculadas para 2026.

export const COUNTRIES = [
  { code: "CR", label: "Costa Rica" },
  { code: "CO", label: "Colombia" },
  { code: "US", label: "Estados Unidos" },
];

export const HOLIDAYS_2026 = {
  CR: [
    { fecha: "2026-01-01", nombre: "Año Nuevo" },
    { fecha: "2026-04-02", nombre: "Jueves Santo" },
    { fecha: "2026-04-03", nombre: "Viernes Santo" },
    { fecha: "2026-04-11", nombre: "Día de Juan Santamaría" },
    { fecha: "2026-05-01", nombre: "Día del Trabajo" },
    { fecha: "2026-07-25", nombre: "Anexión del Partido de Nicoya" },
    { fecha: "2026-08-02", nombre: "Virgen de los Ángeles" },
    { fecha: "2026-08-15", nombre: "Día de la Madre" },
    { fecha: "2026-09-15", nombre: "Día de la Independencia" },
    { fecha: "2026-12-01", nombre: "Abolición del Ejército" },
    { fecha: "2026-12-25", nombre: "Navidad" },
  ],
  CO: [
    { fecha: "2026-01-01", nombre: "Año Nuevo" },
    { fecha: "2026-01-12", nombre: "Día de los Reyes Magos" },
    { fecha: "2026-03-23", nombre: "Día de San José" },
    { fecha: "2026-04-02", nombre: "Jueves Santo" },
    { fecha: "2026-04-03", nombre: "Viernes Santo" },
    { fecha: "2026-05-01", nombre: "Día del Trabajo" },
    { fecha: "2026-05-18", nombre: "Ascensión del Señor" },
    { fecha: "2026-06-08", nombre: "Corpus Christi" },
    { fecha: "2026-06-15", nombre: "Sagrado Corazón" },
    { fecha: "2026-06-29", nombre: "San Pedro y San Pablo" },
    { fecha: "2026-07-20", nombre: "Día de la Independencia" },
    { fecha: "2026-08-07", nombre: "Batalla de Boyacá" },
    { fecha: "2026-08-17", nombre: "Asunción de la Virgen" },
    { fecha: "2026-10-12", nombre: "Día de la Raza" },
    { fecha: "2026-11-02", nombre: "Día de Todos los Santos" },
    { fecha: "2026-11-16", nombre: "Independencia de Cartagena" },
    { fecha: "2026-12-08", nombre: "Inmaculada Concepción" },
    { fecha: "2026-12-25", nombre: "Navidad" },
  ],
  US: [
    { fecha: "2026-01-01", nombre: "New Year's Day" },
    { fecha: "2026-01-19", nombre: "Martin Luther King Jr. Day" },
    { fecha: "2026-02-16", nombre: "Presidents' Day" },
    { fecha: "2026-05-25", nombre: "Memorial Day" },
    { fecha: "2026-06-19", nombre: "Juneteenth" },
    { fecha: "2026-07-03", nombre: "Independence Day (observado)" },
    { fecha: "2026-09-07", nombre: "Labor Day" },
    { fecha: "2026-10-12", nombre: "Columbus Day" },
    { fecha: "2026-11-11", nombre: "Veterans Day" },
    { fecha: "2026-11-26", nombre: "Thanksgiving" },
    { fecha: "2026-12-25", nombre: "Christmas Day" },
  ],
};
