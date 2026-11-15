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
 "book": "<path d=\"M12 5v16\"></path> <path d=\"M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0 -1.999 -2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0 -4 -2H4a2 2 0 0 0 -2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4 -2z\"></path>",
 "rocket": "<path d=\"M12 15v5s3.03 -0.55 4 -2c1.08 -1.62 0 -5 0 -5\"></path> <path d=\"M4.5 16.5c-1.5 1.26 -2 5 -2 5s3.74 -0.5 5 -2c0.71 -0.84 0.7 -2.13 -0.09 -2.91a2.18 2.18 0 0 0 -2.91 -0.09\"></path> <path d=\"M9 12a22 22 0 0 1 2 -3.95A12.88 12.88 0 0 1 22 2c0 2.72 -0.78 7.5 -6 11a22.4 22.4 0 0 1 -4 2z\"></path> <path d=\"M9 12H4s0.55 -3.03 2 -4c1.62 -1.08 5 0.05 5 0.05\"></path>",
 "scale": "<path d=\"M12 3v18\"></path> <path d=\"m19 8 3 8a5 5 0 0 1 -6 0zV7\"></path> <path d=\"M3 7h1a17 17 0 0 0 8 -2 17 17 0 0 0 8 2h1\"></path> <path d=\"m5 8 3 8a5 5 0 0 1 -6 0zV7\"></path> <path d=\"M7 21h10\"></path>",
 "checks": "<path d=\"M13 5h8\"></path> <path d=\"M13 12h8\"></path> <path d=\"M13 19h8\"></path> <path d=\"m3 17 2 2 4 -4\"></path> <path d=\"m3 7 2 2 4 -4\"></path>",
 "note": "<path d=\"M13.4 2H6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.4\"></path> <path d=\"M2 6h4\"></path> <path d=\"M2 10h4\"></path> <path d=\"M2 14h4\"></path> <path d=\"M2 18h4\"></path> <path d=\"M21.378 5.626a1 1 0 1 0 -3.004 -3.004l-5.01 5.012a2 2 0 0 0 -0.506 0.854l-0.837 2.87a0.5 0.5 0 0 0 0.62 0.62l2.87 -0.837a2 2 0 0 0 0.854 -0.506z\"></path>",
 "alert": "<path d=\"m21.73 18 -8 -14a2 2 0 0 0 -3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73 -3\"></path> <path d=\"M12 9v4\"></path> <path d=\"M12 17h0.01\"></path>",
 "calculator": "<path d=\"M6 2h12s2 0 2 2v16s0 2 -2 2H6s-2 0 -2 -2V4s0 -2 2 -2\"></path> <path d=\"m8 6 8 0\"></path> <path d=\"m16 14 0 4\"></path> <path d=\"M16 10h0.01\"></path> <path d=\"M12 10h0.01\"></path> <path d=\"M8 10h0.01\"></path> <path d=\"M12 14h0.01\"></path> <path d=\"M8 14h0.01\"></path> <path d=\"M12 18h0.01\"></path> <path d=\"M8 18h0.01\"></path>",
 "download": "<path d=\"M12 15V3\"></path> <path d=\"M21 15v4a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2v-4\"></path> <path d=\"m7 10 5 5 5 -5\"></path>",
 "sigma": "<path d=\"M18 7V5a1 1 0 0 0 -1 -1H6.5a0.5 0.5 0 0 0 -0.4 0.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a0.5 0.5 0 0 0 0.4 0.8H17a1 1 0 0 0 1 -1v-2\"></path>",
 "x": "<path d=\"M18 6 6 18\"></path> <path d=\"m6 6 12 12\"></path>",
 "grid": "<path d=\"M4 3h5s1 0 1 1v5s0 1 -1 1H4s-1 0 -1 -1V4s0 -1 1 -1\"></path> <path d=\"M15 3h5s1 0 1 1v5s0 1 -1 1h-5s-1 0 -1 -1V4s0 -1 1 -1\"></path> <path d=\"M15 14h5s1 0 1 1v5s0 1 -1 1h-5s-1 0 -1 -1v-5s0 -1 1 -1\"></path> <path d=\"M4 14h5s1 0 1 1v5s0 1 -1 1H4s-1 0 -1 -1v-5s0 -1 1 -1\"></path>",
 "bell": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"></path> <path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 0.74 -1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499 -1.411 5.956 -2.738 7.326\"></path>",
 "shield": "<path d=\"M20 13c0 5 -3.5 7.5 -7.66 8.95a1 1 0 0 1 -0.67 -0.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1 -1c2 0 4.5 -1.2 6.24 -2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"></path> <path d=\"m9 12 2 2 4 -4\"></path>",
 "compare": "<path d=\"M15 18a3 3 0 1 0 6 0 3 3 0 1 0 -6 0\"></path> <path d=\"M3 6a3 3 0 1 0 6 0 3 3 0 1 0 -6 0\"></path> <path d=\"M13 6h3a2 2 0 0 1 2 2v7\"></path> <path d=\"M11 18H8a2 2 0 0 1 -2 -2V9\"></path>",
 "send": "<path d=\"M14.536 21.686a0.5 0.5 0 0 0 0.937 -0.024l6.5 -19a0.496 0.496 0 0 0 -0.635 -0.635l-19 6.5a0.5 0.5 0 0 0 -0.024 0.937l7.93 3.18a2 2 0 0 1 1.112 1.11z\"></path> <path d=\"m21.854 2.147 -10.94 10.939\"></path>",
 "users": "<path d=\"M16 21v-2a4 4 0 0 0 -4 -4H6a4 4 0 0 0 -4 4v2\"></path> <path d=\"M16 3.128a4 4 0 0 1 0 7.744\"></path> <path d=\"M22 21v-2a4 4 0 0 0 -3 -3.87\"></path> <path d=\"M5 7a4 4 0 1 0 8 0 4 4 0 1 0 -8 0\"></path>",
 "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0 -1.594 1.594l-1.051 5.558a1 1 0 0 1 -1.966 0l-1.051 -5.558a2 2 0 0 0 -1.594 -1.594l-5.558 -1.051a1 1 0 0 1 0 -1.966l5.558 -1.051a2 2 0 0 0 1.594 -1.594z\"></path> <path d=\"M20 2v4\"></path> <path d=\"M22 4h-4\"></path> <path d=\"M2 20a2 2 0 1 0 4 0 2 2 0 1 0 -4 0\"></path>",
 "search": "<path d=\"m21 21 -4.34 -4.34\"></path> <path d=\"M3 11a8 8 0 1 0 16 0 8 8 0 1 0 -16 0\"></path>",
 "file": "<path d=\"M6 22a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h8a2.4 2.4 0 0 1 1.704 0.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1 -2 2z\"></path> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\"></path> <path d=\"M10 9H8\"></path> <path d=\"M16 13H8\"></path> <path d=\"M16 17H8\"></path>",
 "upload": "<path d=\"M12 3v12\"></path> <path d=\"m17 8 -5 -5 -5 5\"></path> <path d=\"M21 15v4a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2v-4\"></path>",
 "bookmark": "<path d=\"M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1 -1.496 0.868l-4.512 -2.578a2 2 0 0 0 -1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2 -2z\"></path>"
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

// Udskift et elements indhold. Pakker lister ud og springer tomme værdier over.
function setKids(el, ...nodes) {
  el.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
  return el;
}
