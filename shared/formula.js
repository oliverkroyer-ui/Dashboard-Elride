// Formelmotor til maritime beregninger.
// Sikker: egen parser, ingen eval. Bruges både af serveren (kontrol) og browseren (beregnere).
// Vinkelfunktioner regner i grader, fordi det er sådan navigatører arbejder.
(function (root) {
'use strict';

const FUNCS = {
  sqrt: { n: 1, f: Math.sqrt, label: '√' },
  abs: { n: 1, f: Math.abs },
  sin: { n: 1, f: (x) => Math.sin((x * Math.PI) / 180) },
  cos: { n: 1, f: (x) => Math.cos((x * Math.PI) / 180) },
  tan: { n: 1, f: (x) => Math.tan((x * Math.PI) / 180) },
  asin: { n: 1, f: (x) => (Math.asin(x) * 180) / Math.PI },
  acos: { n: 1, f: (x) => (Math.acos(x) * 180) / Math.PI },
  atan: { n: 1, f: (x) => (Math.atan(x) * 180) / Math.PI },
  ln: { n: 1, f: Math.log },
  log: { n: 1, f: Math.log10 },
  exp: { n: 1, f: Math.exp },
  round: { n: 1, f: Math.round },
  min: { n: -1, f: Math.min },
  max: { n: -1, f: Math.max },
};
const CONSTS = { pi: Math.PI };
const IDENT = /[A-Za-zÆØÅæøåΔΘθρλφμ_][A-Za-zÆØÅæøåΔΘθρλφμ_0-9]*/y;

class FormulaError extends Error {}

// ---------- Tokenizer ----------
function tokenize(src) {
  const s = String(src || '').replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/≤/g, '<=').replace(/≥/g, '>=');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/y; m.lastIndex = i;
      const r = m.exec(s);
      if (!r || !r[0]) throw new FormulaError(`Ugyldigt tal ved position ${i + 1}`);
      out.push({ t: 'num', v: parseFloat(r[0]) }); i += r[0].length; continue;
    }
    IDENT.lastIndex = i;
    const id = IDENT.exec(s);
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    const two = s.slice(i, i + 2);
    if (two === '<=' || two === '>=') { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^(),;<>'.includes(c)) { out.push({ t: 'op', v: c === ';' ? ',' : c }); i++; continue; }
    throw new FormulaError(`Tegnet “${c}” kan ikke bruges i en formel`);
  }
  return out;
}

// ---------- Parser (rekursiv nedstigning) ----------
function parse(src) {
  const toks = tokenize(src);
  if (!toks.length) throw new FormulaError('Formlen er tom');
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
  const expect = (v) => { if (!isOp(v)) throw new FormulaError(`Mangler “${v}”`); p++; };

  function comparison() {
    let a = additive();
    for (const op of ['<=', '>=', '<', '>']) if (isOp(op)) { p++; return { t: 'bin', op, a, b: additive() }; }
    return a;
  }
  function additive() {
    let a = term();
    while (isOp('+') || isOp('-')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: term() }; }
    return a;
  }
  function term() {
    let a = unary();
    while (isOp('*') || isOp('/')) { const op = toks[p++].v; a = { t: 'bin', op, a, b: unary() }; }
    return a;
  }
  function unary() {
    if (isOp('-')) { p++; return { t: 'neg', a: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power() {
    const a = primary();
    if (isOp('^')) { p++; return { t: 'bin', op: '^', a, b: unary() }; }
    return a;
  }
  function primary() {
    const tk = peek();
    if (!tk) throw new FormulaError('Formlen slutter for tidligt');
    if (tk.t === 'num') { p++; return { t: 'num', v: tk.v }; }
    if (tk.t === 'id') {
      p++;
      if (isOp('(')) {
        const fn = tk.v.toLowerCase();
        if (!FUNCS[fn]) throw new FormulaError(`Ukendt funktion “${tk.v}”`);
        p++;
        const args = [];
        if (!isOp(')')) { args.push(comparison()); while (isOp(',')) { p++; args.push(comparison()); } }
        expect(')');
        if (FUNCS[fn].n > 0 && args.length !== FUNCS[fn].n) throw new FormulaError(`${fn}() skal have ${FUNCS[fn].n} værdi`);
        return { t: 'call', f: fn, args };
      }
      if (Object.prototype.hasOwnProperty.call(CONSTS, tk.v)) return { t: 'const', n: tk.v };
      return { t: 'var', n: tk.v };
    }
    if (isOp('(')) { p++; const e = comparison(); expect(')'); return { t: 'paren', a: e }; }
    throw new FormulaError(`Uventet “${tk.v}”`);
  }

  const ast = comparison();
  if (p < toks.length) throw new FormulaError(`Uventet “${toks[p].v}” efter formlen`);
  return ast;
}

function variables(ast, out = new Set()) {
  if (!ast) return out;
  if (ast.t === 'var') out.add(ast.n);
  if (ast.a) variables(ast.a, out);
  if (ast.b) variables(ast.b, out);
  if (ast.args) ast.args.forEach((x) => variables(x, out));
  return out;
}

function evaluate(ast, vals) {
  switch (ast.t) {
    case 'num': return ast.v;
    case 'const': return CONSTS[ast.n];
    case 'var': {
      const v = vals[ast.n];
      if (typeof v !== 'number' || !isFinite(v)) throw new FormulaError(`Mangler værdi for ${ast.n}`);
      return v;
    }
    case 'paren': return evaluate(ast.a, vals);
    case 'neg': return -evaluate(ast.a, vals);
    case 'call': return FUNCS[ast.f].f(...ast.args.map((x) => evaluate(x, vals)));
    case 'bin': {
      const a = evaluate(ast.a, vals), b = evaluate(ast.b, vals);
      switch (ast.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': if (b === 0) throw new FormulaError('Division med nul'); return a / b;
        case '^': return Math.pow(a, b);
        case '<': return a < b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
      }
    }
  }
  throw new FormulaError('Ukendt udtryk');
}

// ---------- Visning ----------
function fmtNum(n, decimals = 3) {
  if (!isFinite(n)) return '–';
  const d = Math.max(0, Math.min(10, decimals));
  let s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  if (d > 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  const [i, f] = s.split('.');
  const neg = i.startsWith('-');
  const digits = neg ? i.slice(1) : i;
  const grouped = digits.length > 4 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : digits;
  return (neg ? '−' : '') + grouped + (f ? ',' + f : '');
}
// Tal skrevet med dansk komma → number
function parseNum(s) {
  if (typeof s === 'number') return s;
  const t = String(s || '').trim().replace(/\s/g, '').replace(/−/g, '-');
  if (!t) return NaN;
  const norm = /,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t;
  return /^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(norm) ? parseFloat(norm) : NaN;
}

const PREC = { '<': 0, '>': 0, '<=': 0, '>=': 0, '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
const OPSHOW = { '*': ' · ', '/': ' / ', '+': ' + ', '-': ' − ', '^': '^', '<': ' < ', '>': ' > ', '<=': ' ≤ ', '>=': ' ≥ ' };
// leaf(n) bestemmer hvordan en variabel vises (symbol eller indsat værdi)
function show(ast, leaf, parentPrec = -1, rightSide = false) {
  let s, prec = 9;
  switch (ast.t) {
    case 'num': s = fmtNum(ast.v, 6); break;
    case 'const': s = 'π'; break;
    case 'var': s = leaf(ast.n); break;
    case 'paren': s = '(' + show(ast.a, leaf) + ')'; break;
    case 'neg': s = '−' + show(ast.a, leaf, 3); prec = 3; break;
    case 'call': s = (ast.f === 'sqrt' ? '√' : ast.f) + '(' + ast.args.map((x) => show(x, leaf)).join('; ') + ')'; break;
    case 'bin':
      prec = PREC[ast.op];
      s = show(ast.a, leaf, prec, false) + OPSHOW[ast.op] + show(ast.b, leaf, prec, true);
      break;
  }
  const needs = prec < parentPrec || (rightSide && prec === parentPrec && prec !== 9 && (ast.op === '-' || ast.op === '/'));
  return needs ? '(' + s + ')' : s;
}

const unitSuffix = (u) => (!u ? '' : /^[°′″%‰]/.test(u) ? u : ' ' + u);

// Mellemregninger: symbolsk → indsatte værdier → delresultater → resultat
function steps(formula, vals) {
  const ast = parse(formula.expression);
  const vars = Object.fromEntries((formula.variables || []).map((v) => [v.symbol, v]));
  const label = (n) => (vars[n] && vars[n].display) || n;
  const unit = (n) => unitSuffix(vars[n] && vars[n].unit);
  const res = formula.result || {};
  const lhs = res.display || res.symbol || 'Resultat';
  const out = [];
  out.push({ kind: 'formel', text: `${lhs} = ${show(ast, label)}` });
  out.push({ kind: 'indsat', text: `${lhs} = ${show(ast, (n) => fmtNum(vals[n], 6) + unit(n))}` });
  // delresultater: evaluer de største deludtryk under roden
  const partial = (node) => {
    if (node.t === 'bin') {
      const sides = [node.a, node.b].map((x) => (x.t === 'num' || x.t === 'var' || x.t === 'const' ? x : { t: 'num', v: evaluate(x, vals) }));
      return { ...node, a: sides[0], b: sides[1] };
    }
    if (node.t === 'paren') return partial(node.a);
    if (node.t === 'call') return { ...node, args: node.args.map((x) => (x.t === 'num' ? x : { t: 'num', v: evaluate(x, vals) })) };
    if (node.t === 'neg') return { t: 'neg', a: { t: 'num', v: evaluate(node.a, vals) } };
    return node;
  };
  const mid = show(partial(ast), (n) => fmtNum(vals[n], 6));
  const value = evaluate(ast, vals);
  const final = `${lhs} = ${fmtNum(value, res.decimals != null ? res.decimals : 3)}${unitSuffix(res.unit)}`;
  if (mid !== show(ast, (n) => fmtNum(vals[n], 6)) && mid !== fmtNum(value, 6)) out.push({ kind: 'mellem', text: `${lhs} = ${mid}` });
  out.push({ kind: 'resultat', text: final });
  return { value, steps: out };
}

// Beregn med kontrol af input og advarsler
function calculate(formula, rawInputs) {
  const vals = {}, problems = [];
  for (const v of formula.variables || []) {
    const n = parseNum(rawInputs[v.symbol]);
    if (isNaN(n)) { problems.push({ level: 'fejl', symbol: v.symbol, text: `Skriv et tal for ${v.label || v.symbol}` }); continue; }
    if (v.min != null && n < v.min) problems.push({ level: 'advarsel', symbol: v.symbol, text: `${v.label || v.symbol} er usædvanligt lav (under ${fmtNum(v.min)} ${v.unit || ''})` });
    if (v.max != null && n > v.max) problems.push({ level: 'advarsel', symbol: v.symbol, text: `${v.label || v.symbol} er usædvanligt høj (over ${fmtNum(v.max)} ${v.unit || ''})` });
    vals[v.symbol] = n;
  }
  if (problems.some((p) => p.level === 'fejl')) return { ok: false, problems };
  try {
    const r = steps(formula, vals);
    if (!isFinite(r.value)) return { ok: false, problems: [{ level: 'fejl', text: 'Resultatet kan ikke beregnes med de værdier (fx kvadratrod af et negativt tal).' }] };
    const scope = { ...vals, [formula.result.symbol]: r.value };
    for (const w of formula.warnings || []) {
      try { if (evaluate(parse(w.when), scope)) problems.push({ level: 'advarsel', text: w.text }); } catch (e) { /* ugyldig regel springes over */ }
    }
    return { ok: true, value: r.value, steps: r.steps, problems };
  } catch (e) {
    return { ok: false, problems: [{ level: 'fejl', text: e.message }] };
  }
}

// Kontrol af en formel: syntaks, variabler, enheder, testeksempel og advarselsregler
function check(formula) {
  const issues = [];
  let ast;
  try { ast = parse(formula.expression); } catch (e) { return [{ level: 'fejl', text: `Formlen kan ikke læses: ${e.message}` }]; }
  const used = variables(ast);
  const declared = new Set((formula.variables || []).map((v) => v.symbol));
  for (const n of used) if (!declared.has(n)) issues.push({ level: 'fejl', text: `Variablen ${n} bruges i formlen, men er ikke beskrevet` });
  for (const v of formula.variables || []) {
    if (!used.has(v.symbol)) issues.push({ level: 'advarsel', text: `Variablen ${v.symbol} er beskrevet, men bruges ikke i formlen` });
    if (!v.unit) issues.push({ level: 'advarsel', text: `${v.symbol} mangler en enhed` });
    if (v.default == null || v.default === '') issues.push({ level: 'advarsel', text: `${v.symbol} mangler en eksempelværdi` });
  }
  if (!formula.result || !formula.result.symbol) issues.push({ level: 'fejl', text: 'Resultatet mangler et symbol' });
  else if (!formula.result.unit) issues.push({ level: 'advarsel', text: 'Resultatet mangler en enhed' });
  const t = formula.test;
  if (!t || t.expected == null || t.expected === '') issues.push({ level: 'advarsel', text: 'Der er intet kontroleksempel – tilføj et regnet eksempel med kendt facit' });
  else {
    const vals = {};
    for (const n of used) vals[n] = parseNum(t.inputs && t.inputs[n]);
    try {
      const got = evaluate(ast, vals), exp = parseNum(t.expected);
      const tol = Math.max(1e-6, Math.abs(exp) * 0.005);
      if (Math.abs(got - exp) > tol) issues.push({ level: 'fejl', text: `Kontroleksemplet passer ikke: formlen giver ${fmtNum(got, 4)}, men facit er ${fmtNum(exp, 4)}` });
    } catch (e) { issues.push({ level: 'fejl', text: `Kontroleksemplet kan ikke regnes: ${e.message}` }); }
  }
  for (const w of formula.warnings || []) {
    try { parse(w.when); } catch (e) { issues.push({ level: 'advarsel', text: `Advarselsreglen “${w.when}” kan ikke læses` }); }
  }
  return issues;
}

const api = { unitSuffix, parse, variables, evaluate, steps, calculate, check, fmtNum, parseNum, show, FormulaError, FUNCS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.PortalFormula = api;
})(this);
