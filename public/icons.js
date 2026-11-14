// Ikoner: Lucide (ISC-licens) via Streamline – https://lucide.dev
'use strict';
const ICONS = {
 "logout": "<path d=\"m16 17 5 -5 -5 -5\"></path> <path d=\"M21 12H9\"></path> <path d=\"M9 21H5a2 2 0 0 1 -2 -2V5a2 2 0 0 1 2 -2h4\"></path>",
 "down": "<path d=\"M12 5v14\"></path> <path d=\"m19 12 -7 7 -7 -7\"></path>",
 "calendar": "<path d=\"M8 2v3\"></path> <path d=\"M16 2v3\"></path> <path d=\"M5 3h14s2 0 2 2v14s0 2 -2 2H5s-2 0 -2 -2V5s0 -2 2 -2\"></path> <path d=\"M3 9h18\"></path>",
 "history": "<path d=\"M3 12a9 9 0 1 0 9 -9 9.75 9.75 0 0 0 -6.74 2.74L3 8\"></path> <path d=\"M3 3v5h5\"></path> <path d=\"M12 7v5l4 2\"></path>",
 "layers": "<path d=\"M12.83 2.18a2 2 0 0 0 -1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58 -3.9a1 1 0 0 0 0 -1.83z\"></path> <path d=\"M2 12a1 1 0 0 0 0.58 0.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58 -3.9A1 1 0 0 0 22 12\"></path> <path d=\"M2 17a1 1 0 0 0 0.58 0.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58 -3.9A1 1 0 0 0 22 17\"></path>",
 "compass": "<path d=\"M2 12a10 10 0 1 0 20 0 10 10 0 1 0 -20 0\"></path> <path d=\"m16.24 7.76 -1.804 5.411a2 2 0 0 1 -1.265 1.265L7.76 16.24l1.804 -5.411a2 2 0 0 1 1.265 -1.265z\"></path>",
 "plus": "<path d=\"M5 12h14\"></path> <path d=\"M12 5v14\"></path>",
 "chat": "<path d=\"M2.992 16.342a2 2 0 0 1 0.094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413 -0.998a2 2 0 0 1 1.099 0.092 10 10 0 1 0 -4.777 -4.719\"></path>",
 "trash": "<path d=\"M10 11v6\"></path> <path d=\"M14 11v6\"></path> <path d=\"M19 6v14a2 2 0 0 1 -2 2H7a2 2 0 0 1 -2 -2V6\"></path> <path d=\"M3 6h18\"></path> <path d=\"M8 6V4a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2\"></path>",
 "code": "<path d=\"m18 16 4 -4 -4 -4\"></path> <path d=\"m6 8 -4 4 4 4\"></path> <path d=\"m14.5 4 -5 16\"></path>",
 "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0 -0.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 0.696 10.75 10.75 0 0 1 -19.876 0\"></path> <path d=\"M9 12a3 3 0 1 0 6 0 3 3 0 1 0 -6 0\"></path>",
 "up": "<path d=\"m5 12 7 -7 7 7\"></path> <path d=\"M12 19V5\"></path>",
 "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0 -3.986 -3.987L3.842 16.174a2 2 0 0 0 -0.5 0.83l-1.321 4.352a0.5 0.5 0 0 0 0.623 0.622l4.353 -1.32a2 2 0 0 0 0.83 -0.497z\"></path> <path d=\"m15 5 4 4\"></path>",
 "check": "<path d=\"M20 6 9 17l-5 -5\"></path>",
 "home": "<path d=\"M15 21v-8a1 1 0 0 0 -1 -1h-4a1 1 0 0 0 -1 1v8\"></path> <path d=\"M3 10a2 2 0 0 1 0.709 -1.528l7 -6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2z\"></path>",
 "library": "<path d=\"m16 6 4 14\"></path> <path d=\"M12 6v14\"></path> <path d=\"M8 8v12\"></path> <path d=\"M4 4v16\"></path>",
 "award": "<path d=\"m15.477 12.89 1.515 8.526a0.5 0.5 0 0 1 -0.81 0.47l-3.58 -2.687a1 1 0 0 0 -1.197 0l-3.586 2.686a0.5 0.5 0 0 1 -0.81 -0.469l1.514 -8.526\"></path> <path d=\"M6 8a6 6 0 1 0 12 0A6 6 0 1 0 6 8\"></path>",
 "book": "<path d=\"M12 5v16\"></path> <path d=\"M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0 -1.999 -2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0 -4 -2H4a2 2 0 0 0 -2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4 -2z\"></path>"
};
function icon(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}
