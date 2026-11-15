// Sammenligning af tekst mellem to udgaver: linje for linje, og ord for ord i ændrede linjer.
(function (root) {
'use strict';

// Længste fælles delsekvens → liste af operationer ('=', '-', '+')
function lcsOps(a, b, eq = (x, y) => x === y) {
  const n = a.length, m = b.length;
  // Skær fælles start og slut fra, så tabellen bliver lille
  let s = 0; while (s < n && s < m && eq(a[s], b[s])) s++;
  let e = 0; while (e < n - s && e < m - s && eq(a[n - 1 - e], b[m - 1 - e])) e++;
  const A = a.slice(s, n - e), B = b.slice(s, m - e);
  const W = B.length + 1;
  const dp = new Uint32Array((A.length + 1) * W);
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      dp[i * W + j] = eq(A[i], B[j]) ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    }
  }
  const ops = [];
  for (let k = 0; k < s; k++) ops.push(['=', a[k]]);
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (eq(A[i], B[j])) { ops.push(['=', A[i]]); i++; j++; }
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) { ops.push(['-', A[i]]); i++; }
    else { ops.push(['+', B[j]]); j++; }
  }
  while (i < A.length) ops.push(['-', A[i++]]);
  while (j < B.length) ops.push(['+', B[j++]]);
  for (let k = n - e; k < n; k++) ops.push(['=', a[k]]);
  return ops;
}

function diffWords(oldLine, newLine) {
  const tok = (s) => s.match(/\s+|[^\s]+/g) || [];
  const ops = lcsOps(tok(oldLine), tok(newLine));
  const out = [];
  for (const [t, s] of ops) {
    const last = out[out.length - 1];
    if (last && last.t === t) last.s += s; else out.push({ t, s });
  }
  return out;
}

// Returnerer blokke: {type:'same'|'add'|'del'|'mod', text|words} og antal ændringer (sammenhængende hunks)
function diffText(oldText, newText) {
  const a = String(oldText || '').split('\n'), b = String(newText || '').split('\n');
  const ops = lcsOps(a, b);
  const blocks = [];
  let hunks = 0, added = 0, removed = 0;
  for (let k = 0; k < ops.length;) {
    if (ops[k][0] === '=') { blocks.push({ type: 'same', text: ops[k][1] }); k++; continue; }
    // Saml en sammenhængende ændring: alle slettede og tilføjede linjer, før teksten er ens igen
    const dels = [], adds = [];
    while (k < ops.length && ops[k][0] !== '=') { (ops[k][0] === '-' ? dels : adds).push(ops[k][1]); k++; }
    const D = dels.filter((l) => l.trim()), A = adds.filter((l) => l.trim());
    if (D.length || A.length) hunks++;
    // Par linjerne i rækkefølge, så en rettet linje vises med ord-markering
    const pairs = Math.min(D.length, A.length);
    for (let i = 0; i < pairs; i++) { blocks.push({ type: 'mod', words: diffWords(D[i], A[i]) }); added++; removed++; }
    for (let i = pairs; i < D.length; i++) { blocks.push({ type: 'del', text: D[i] }); removed++; }
    for (let i = pairs; i < A.length; i++) { blocks.push({ type: 'add', text: A[i] }); added++; }
  }
  // changes = antal ændrede linjer (en rettet linje tæller én gang) – det tal eleven ser
  return { blocks, hunks, added, removed, changes: blocks.filter((b) => b.type !== 'same').length };
}

const api = { lcsOps, diffWords, diffText };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.PortalDiff = api;
})(this);
