// Iconos SVG inline (sin dependencias, sin emojis). Trazos con currentColor
// para que hereden el color del contexto. Tamaño por defecto 18px.

const svg = (paths, size = 18) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icon = {
  clock: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  download: (s) => svg('<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/>', s),
  copy: (s) => svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', s),
  upload: (s) => svg('<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>', s),
  check: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>', s),
  alert: (s) => svg('<path d="M12 3l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/>', s),
  calendar: (s) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>', s),
  rows: (s) => svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18"/>', s),
  users: (s) => svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5M21 20a6 6 0 0 0-5-5.9"/>', s),
  userClock: (s) => svg('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 10.5-4"/><circle cx="17.5" cy="16.5" r="4.5"/><path d="M17.5 14.5v2l1.4 1"/>', s),
  settings: (s) => svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5H9.4l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4.2l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>', s),
  trending: (s) => svg('<path d="M3 17l6-6 4 4 7-7"/><path d="M14 7h6v6"/>', s),
  briefcase: (s) => svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', s),
  tasks: (s) => svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M8.5 12l1.5 1.5 3-3"/><path d="M8.5 17l1.5 1.5 3-3"/>', s),
  bars: (s) => svg('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M20 20H3"/>', s),
};
