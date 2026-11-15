// Formler: interaktiv beregner (elever og undervisere), formelbibliotek og formeleditor.
'use strict';

const FX = window.PortalFormula;
const varLabel = (v) => v.display || v.symbol;

// ---------- Beregner ----------
// Viser formlen, lader brugeren indtaste værdier og viser mellemregninger, resultat og advarsler.
function formulaWidget(f, opts = {}) {
  let ast = null;
  try { ast = FX.parse(f.expression); } catch (e) { return h('div.ref.ref-missing.block', `Formlen “${f.name}” kan ikke læses: ${e.message}`); }
  const labels = Object.fromEntries(f.variables.map((v) => [v.symbol, varLabel(v)]));
  const lhs = f.result.display || f.result.symbol;
  const symbolic = `${lhs} = ${FX.show(ast, (n) => labels[n] || n)}`;
  const inputs = {};
  const out = h('div.calc-out', { 'aria-live': 'polite' });
  function run() {
    const raw = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
    const r = FX.calculate(f, raw);
    for (const [k, el] of Object.entries(inputs)) el.classList.toggle('invalid', r.problems.some((p) => p.symbol === k && p.level === 'fejl'));
    setKids(out, 
      r.ok ? h('ol.calc-steps', r.steps.map((s) => h('li', { class: 'step-' + s.kind }, h('span.step-label', { formel: 'Formel', indsat: 'Indsæt', mellem: 'Udregn', resultat: 'Resultat' }[s.kind]), h('code', s.text)))) : null,
      r.problems.length ? h('ul.calc-problems', r.problems.map((p) => h('li', { class: p.level }, icon(p.level === 'fejl' ? 'x' : 'alert', 16), p.text))) : null);
  }
  const fields = h('div.calc-fields', f.variables.map((v) => {
    const id = `fx-${f.key}-${v.symbol}-${Math.random().toString(36).slice(2, 7)}`;
    const input = h('input', { id, inputMode: 'decimal', value: v.default != null ? FX.fmtNum(v.default, 6).replace(/\./g, '') : '', autocomplete: 'off', oninput: run });
    inputs[v.symbol] = input;
    return h('label.calc-field', { for: id }, h('span.calc-sym', varLabel(v)), h('span.calc-name', v.label || ''), h('span.calc-input', input, v.unit ? h('span.calc-unit', v.unit) : null));
  }));
  const body = h('div.calc-body',
    h('div.calc-formula', h('code', symbolic)),
    f.explanation ? h('p.small.muted', f.explanation) : null,
    fields, out,
    h('div.actions', h('button.btn.ghost.small', { type: 'button', onclick: () => { for (const v of f.variables) inputs[v.symbol].value = v.default != null ? FX.fmtNum(v.default, 6).replace(/\./g, '') : ''; run(); } }, 'Nulstil eksempel')));
  run();
  const head = h('div.calc-head', icon('calculator', 18), h('strong', f.name), f.category ? h('span.pill', f.category) : null);
  if (opts.compact) return h('details.calc.inline-calc', h('summary', icon('calculator', 15), ` ${f.name}: `, h('code', symbolic)), body);
  return h('section.calc', { 'aria-label': `Beregner: ${f.name}` }, head, body);
}

// ---------- Elev: formelsamling ----------
async function viewFormulaCollection() {
  loading();
  const { formulas } = await api('GET', '/api/formula-collection');
  const cats = [...new Set(formulas.map((f) => f.category))];
  render(
    h('div.section-title', h('div', h('h1', 'Formelsamling'), h('p.muted', 'Alle formler fra dine udgivne bøger – med beregner og mellemregninger.'))),
    formulas.length ? cats.map((c) => [h('h2.cat-title', c), h('div.grid.calc-grid', formulas.filter((f) => f.category === c).map((f) => formulaWidget(f)))]) : h('div.card', h('p.empty', 'Der er ingen formler i dine bøger endnu.')));
}

// ---------- Underviser: formelbibliotek ----------
async function viewFormulaLibrary() {
  loading();
  const { formulas } = await api('GET', '/api/formulas');
  const cats = [...new Set(formulas.map((f) => f.category))].sort();
  const errors = formulas.filter((f) => f.issues.some((i) => i.level === 'fejl'));
  render(
    h('div.section-title',
      h('div', h('h1', 'Formelbibliotek'), h('p.muted', 'Hver formel findes ét sted. Når du retter den her, opdateres den i alle kapitler, der bruger den.')),
      h('div.actions', h('a.btn', { href: '#/formler/ny' }, icon('plus', 18), 'Ny formel'))),
    errors.length ? h('div.card.notice.warn', icon('alert', 20), h('div', h('strong', `${errors.length} formel${errors.length === 1 ? '' : 'er'} har fejl`), h('div.small', errors.map((f) => f.name).join(' · ')))) : h('div.card.notice.ok', icon('shield', 20), h('div', h('strong', 'Alle formler er kontrolleret'), h('div.small', 'Testeksemplerne giver det forventede facit.'))),
    cats.map((c) => [h('h2.cat-title', c), h('div.card', h('ul.list.formula-list', formulas.filter((f) => f.category === c).map((f) => {
      const err = f.issues.filter((i) => i.level === 'fejl').length, warn = f.issues.filter((i) => i.level === 'advarsel').length;
      let shown = f.expression; try { shown = FX.show(FX.parse(f.expression), (n) => (f.variables.find((v) => v.symbol === n) || {}).display || n); } catch (e) { /* vis rå tekst */ }
      return h('li', h('a.formula-row', { href: `#/formler/${f.id}` },
        h('div', h('strong', f.name), h('div', h('code', `${f.result.display || f.result.symbol} = ${shown}`))),
        h('div.actions',
          err ? h('span.pill.bad', `${err} fejl`) : warn ? h('span.pill.warn', `${warn} bemærkning${warn === 1 ? '' : 'er'}`) : h('span.pill.ok', 'OK'),
          h('span.pill', `Bruges i ${f.usage.length} kapitl${f.usage.length === 1 ? '' : 'er'}`))));
    })))]));
}

// ---------- Underviser: formeleditor ----------
async function viewFormulaEditor(id) {
  loading();
  const isNew = id === 'ny';
  const f = isNew ? { key: '', name: '', category: 'Stabilitet', expression: '', result: { symbol: '', display: '', label: '', unit: '', decimals: 2 }, variables: [], explanation: '', warnings: [], test: null, usage: [], history: [] }
    : await api('GET', `/api/formulas/${id}`);
  const state = JSON.parse(JSON.stringify(f));
  state.test = state.test || { inputs: {}, expected: '' };

  const issuesBox = h('div');
  const previewBox = h('div');
  const varsBox = h('div.var-table');
  const testBox = h('div.test-grid');
  const exprIn = h('input.expr-input', { value: state.expression, placeholder: 'fx  KM - KG   eller   atan(w * d / (Delta * GM))', spellcheck: false, autocomplete: 'off', 'aria-label': 'Formel' });
  const exprMsg = h('div.small');

  function syncVars() {
    let syms = [];
    try { syms = [...FX.variables(FX.parse(state.expression))]; exprMsg.textContent = syms.length ? `Variabler fundet: ${syms.join(', ')}` : ''; exprMsg.className = 'small muted'; }
    catch (e) { exprMsg.textContent = e.message; exprMsg.className = 'small error'; return; }
    // Tilføj nye variabler automatisk; behold beskrivelser for eksisterende
    for (const s of syms) if (!state.variables.some((v) => v.symbol === s)) state.variables.push({ symbol: s, display: '', label: '', unit: '', default: null, min: null, max: null });
    state.variables = state.variables.filter((v) => syms.includes(v.symbol) || v.label);
  }
  const cell = (v, k, ph, w) => h('input', { value: v[k] == null ? '' : (typeof v[k] === 'number' ? FX.fmtNum(v[k], 6).replace(/\./g, '') : v[k]), placeholder: ph, 'aria-label': `${ph} for ${v.symbol}`, class: w || '',
    oninput: (e) => { v[k] = ['default', 'min', 'max'].includes(k) ? (e.target.value === '' ? null : FX.parseNum(e.target.value)) : e.target.value; refresh(false); } });
  function drawVars() {
    setKids(varsBox, 
      h('div.var-row.var-head', h('span', 'Symbol'), h('span', 'Vis som'), h('span', 'Beskrivelse'), h('span', 'Enhed'), h('span', 'Eksempel'), h('span', 'Min'), h('span', 'Maks')),
      state.variables.map((v) => h('div.var-row', h('code', v.symbol), cell(v, 'display', 'fx Δ', 'short'), cell(v, 'label', 'Hvad er det?'), cell(v, 'unit', 'm, t, °', 'short'), cell(v, 'default', 'tal', 'short'), cell(v, 'min', '', 'short'), cell(v, 'max', '', 'short'))),
      state.variables.length ? null : h('p.small.muted', 'Skriv formlen ovenfor – variablerne dukker op her af sig selv.'));
    setKids(testBox, 
      state.variables.map((v) => h('label', h('span', `${varLabel(v)} =`), h('input', { value: state.test.inputs[v.symbol] == null ? '' : FX.fmtNum(state.test.inputs[v.symbol], 6).replace(/\./g, ''), oninput: (e) => { state.test.inputs[v.symbol] = FX.parseNum(e.target.value); refresh(false); } }))),
      h('label', h('span', `Facit: ${state.result.display || state.result.symbol || 'resultat'} =`), h('input', { value: state.test.expected === '' || state.test.expected == null ? '' : FX.fmtNum(state.test.expected, 6).replace(/\./g, ''), oninput: (e) => { state.test.expected = e.target.value === '' ? '' : FX.parseNum(e.target.value); refresh(false); } })));
  }
  function payload() {
    const t = state.test.expected === '' || state.test.expected == null ? null : state.test;
    return { ...state, test: t };
  }
  function refresh(redraw = true) {
    syncVars();
    if (redraw) drawVars();
    const p = payload();
    const issues = p.expression ? FX.check(p) : [{ level: 'advarsel', text: 'Skriv en formel' }];
    setKids(issuesBox, issues.length
      ? h('ul.calc-problems', issues.map((i) => h('li', { class: i.level }, icon(i.level === 'fejl' ? 'x' : 'alert', 16), i.text)))
      : h('div.notice.ok.small', icon('shield', 18), 'Formlen er gennemtjekket: variabler, enheder og testeksempel stemmer.'));
    let ok = false; try { FX.parse(p.expression); ok = !!p.result.symbol; } catch (e) { ok = false; }
    setKids(previewBox, ok ? formulaWidget({ ...p, name: p.name || 'Forhåndsvisning' }) : h('p.empty', 'Forhåndsvisningen vises, når formel og resultatsymbol er udfyldt.'));
  }
  exprIn.addEventListener('input', () => { state.expression = exprIn.value; refresh(true); });
  const txt = (k, label, ph, obj = state) => h('label', label, h('input', { value: obj[k] == null ? '' : obj[k], placeholder: ph || '', oninput: (e) => { obj[k] = e.target.value; refresh(false); } }));

  const warnBox = h('div.stack');
  function drawWarnings() {
    setKids(warnBox, ...state.warnings.map((w, i) => h('div.warn-row',
      h('input', { value: w.when, placeholder: 'Betingelse, fx  GM < 0.15', oninput: (e) => { w.when = e.target.value; refresh(false); }, 'aria-label': 'Betingelse' }),
      h('input', { value: w.text, placeholder: 'Besked til eleven', oninput: (e) => { w.text = e.target.value; }, 'aria-label': 'Besked' }),
      h('button.icon-btn', { type: 'button', title: 'Fjern', 'aria-label': 'Fjern advarsel', onclick: () => { state.warnings.splice(i, 1); drawWarnings(); refresh(false); } }, icon('x', 16)))),
    h('button.btn.ghost.small', { type: 'button', onclick: () => { state.warnings.push({ when: '', text: '' }); drawWarnings(); } }, icon('plus', 16), 'Tilføj advarsel'));
  }

  async function save() {
    try {
      const body = payload();
      if (isNew && !body.key) body.key = (body.name || 'formel').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
      const r = isNew ? await api('POST', '/api/formulas', body) : await api('PUT', `/api/formulas/${f.id}`, body);
      toast(isNew ? 'Formlen er oprettet' : `Formlen er gemt${r.usage.length ? ` – opdateret i ${r.usage.length} kapitler` : ''}`);
      if (isNew) location.hash = `#/formler/${r.id}`; else viewFormulaEditor(f.id);
    } catch (e) { toast(e.message, true); }
  }

  render(
    h('div.small', h('a', { href: '#/formler' }, '← Formelbibliotek')),
    h('div.section-title', h('h1', isNew ? 'Ny formel' : f.name), h('div.actions',
      !isNew ? deleteBtn(`/api/formulas/${f.id}`, () => { location.hash = '#/formler'; }) : null,
      h('button.btn', { type: 'button', onclick: save }, 'Gem formel'))),
    !isNew && f.usage.length ? h('div.card.notice', icon('book', 18), h('div', h('strong', `Bruges i ${f.usage.length} kapitl${f.usage.length === 1 ? '' : 'er'}`), h('div.small', f.usage.map((u) => `${u.bookTitle}: ${u.chapterTitle}`).join(' · '), ' – ændringer slår igennem alle steder ved næste udgivelse.'))) : null,
    h('div.editor-grid',
      h('div.stack',
        h('div.card.form', h('h2', '1. Navn og formel'),
          h('div.grid.two', txt('name', 'Navn', 'fx Metacenterhøjde'), txt('category', 'Emne', 'fx Stabilitet')),
          h('label', 'Formel (højre side af lighedstegnet)', exprIn), exprMsg,
          h('p.small.muted', 'Brug + − * / ^ og parenteser. Funktioner: sqrt, sin, cos, tan, asin, acos, atan (grader), abs, ln, log, min, max.'),
          h('div.grid.three', txt('symbol', 'Resultatets symbol', 'fx GM', state.result), txt('display', 'Vis som', 'fx θ', state.result), txt('unit', 'Enhed', 'fx m', state.result)),
          h('div.grid.two', txt('label', 'Hvad beregnes?', 'fx metacenterhøjden', state.result),
            h('label', 'Decimaler', h('input', { type: 'number', min: 0, max: 6, value: state.result.decimals, oninput: (e) => { state.result.decimals = Number(e.target.value); refresh(false); } })))),
        h('div.card.form', h('h2', '2. Variabler'), varsBox),
        h('div.card.form', h('h2', '3. Kontroleksempel'), h('p.small.muted', 'Et regnet eksempel med kendt facit. Systemet tjekker, at formlen altid giver dette resultat.'), testBox),
        h('div.card.form', h('h2', '4. Advarsler til eleven (valgfrit)'), h('p.small.muted', 'Vises, når resultatet ser forkert eller farligt ud. Brug resultatets symbol, fx  GM < 0.15'), warnBox),
        h('div.card.form', h('h2', '5. Forklaring'), h('textarea', { rows: 3, value: state.explanation, oninput: (e) => { state.explanation = e.target.value; } }))),
      h('div.stack.sticky-side',
        h('div.card', h('h2', 'Kontrol'), issuesBox),
        h('div', h('h2', 'Sådan ser eleven den'), previewBox),
        !isNew ? h('div.card', h('h2', 'Brug i et kapitel'), h('p.small', 'Skriv ', h('code', `{{formel:${f.key}}}`), ' i teksten – eller vælg formlen under “Indsæt” i kapiteleditoren.')) : null,
        !isNew && f.history && f.history.length ? h('details.card', h('summary', icon('history', 16), ` Tidligere versioner (${f.history.length})`),
          h('ul.list', f.history.map((v) => h('li', h('div.small.muted', fmtDateTime(v.at)), h('code', `${v.result.symbol} = ${v.expression}`))))) : null)));
  drawWarnings(); refresh(true);
}
