// AI-assistent til underviseren.
// Faste kommandoer kører lokalt; sprogopgaver går til Claude. Svar er altid forslag.
'use strict';

// Kør en AI-opgave: i demoen direkte fra browseren via Claude-visningen, ellers via serveren.
async function aiRun(task, input) {
  if (window.PORTAL_DEMO) {
    const sample = window.claude && window.claude.use ? await window.claude.use('sample') : null;
    if (!sample) throw new Error('AI er ikke tilgængelig i denne visning. Åbn portalen i Claude for at bruge AI-forslag.');
    if (task === 'fri') input = { ...input, context: (await api('GET', '/api/ai/context')).context };
    const p = window.PortalPrompts[task](input);
    try {
      return await sample.json(`${p.system}\n\n${p.prompt}\n\nSvar udelukkende med JSON, der passer til dette skema:\n${JSON.stringify(p.schema)}`, { modelTier: 'default' });
    } catch (e) {
      const msg = { not_granted: 'Du har ikke givet portalen lov til at bruge Claude.', rate_limited: 'Claude er travlt optaget – prøv igen om lidt.' }[e.code];
      throw new Error(msg || 'AI kunne ikke svare: ' + (e.message || e.code));
    }
  }
  return api('POST', '/api/ai', { task, input });
}
async function aiAvailable() {
  if (window.PORTAL_DEMO) return !!(window.claude && window.claude.use && await window.claude.use('sample'));
  try { return (await api('GET', '/api/ai/status')).server; } catch { return false; }
}

async function viewAssistant() {
  const out = h('div.stack.assistant-out', { 'aria-live': 'polite' });
  const aiState = h('span.pill', 'Tjekker AI …');
  aiAvailable().then((ok) => { aiState.className = 'pill ' + (ok ? 'ok' : 'warn'); aiState.textContent = ok ? 'AI tilsluttet (Claude)' : 'AI ikke tilsluttet – faste kommandoer virker'; });
  const show = (...nodes) => { setKids(out, ...nodes.flat().filter(Boolean)); out.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const busy = (msg) => show(h('div.card', h('p.muted', msg)));
  const run = (cmd, body) => api('POST', '/api/assistant', { command: cmd, ...body });

  async function find(q) {
    if (!q.trim()) return;
    busy(`Søger efter “${q}” i alt dit materiale …`);
    const r = await run('find', { query: q });
    show(h('div.card', h('h2', `“${q}” – ${r.hits.length} sted${r.hits.length === 1 ? '' : 'er'} i kapitlerne`),
      r.hits.length ? h('ul.list', r.hits.map((x) => h('li', h('a', { href: `#/rediger-kapitel/${x.chapterId}` }, h('strong', `${x.bookTitle}: ${x.chapterTitle}`)), h('p.small.muted', x.text.slice(0, 220))))) : h('p.empty', 'Ikke fundet i kapitlernes tekst.'),
      r.facts.length ? [h('h3', 'Centrale oplysninger'), h('ul.list', r.facts.map((f) => h('li', h('strong', f.label), ` = ${f.value} ${f.unit || ''} · bruges i ${f.usage.length} kapitler`)))] : null,
      r.provisions.length ? [h('h3', 'Retskilder'), h('ul.list', r.provisions.map((p) => h('li', h('strong', `${p.source} ${p.ref}`), ` · citeret i ${p.usage.length} kapitler`, h('div.small.muted', p.usage.map((u) => u.chapterTitle).join(', ')))))] : null));
  }
  async function checkFormulas() {
    busy('Kontrollerer formler, enheder, kontroleksempler og henvisninger …');
    const r = await run('tjek-formler');
    const bad = r.report.filter((f) => f.issues.length);
    show(h('div.card', h('h2', 'Kontrol af formler'),
      h('p', `${r.report.length} formler kontrolleret · ${bad.filter((f) => f.issues.some((i) => i.level === 'fejl')).length} med fejl · ${r.broken.length} ødelagte henvisninger · ${r.unitClashes.length} symboler med forskellige enheder`),
      bad.length ? h('ul.list', bad.map((f) => h('li', h('a', { href: `#/formler/${f.id}` }, h('strong', f.name)), h('ul.calc-problems', f.issues.map((i) => h('li', { class: i.level }, icon(i.level === 'fejl' ? 'x' : 'alert', 15), i.text)))))) : h('p', 'Alle formler er i orden.'),
      r.broken.length ? [h('h3', 'Henvisninger til noget, der ikke findes'), h('ul.list', r.broken.map((b) => h('li', h('a', { href: `#/rediger-kapitel/${b.chapterId}` }, b.chapterTitle), ': ', h('code', b.ref))))] : null,
      r.unitClashes.length ? [h('h3', 'Samme symbol med forskellige enheder'), h('p.small.muted', 'Ikke nødvendigvis en fejl, men tjek at det er meningen.'), h('ul.list', r.unitClashes.map((u) => h('li', h('code', u.symbol), ': ', u.units.join(' / '))))] : null));
  }
  async function changes() {
    busy('Sammenligner arbejdskopierne med de seneste udgaver …');
    const r = await run('aendringer');
    show(r.books.map((b) => h('div.card', h('div.row', h('h2', b.title), h('span.pill', b.version ? `v${b.version}` : 'ikke udgivet')),
      b.pending.length ? h('ul.list', b.pending.map((c) => h('li.row', h('a', { href: `#/rediger-kapitel/${c.id}` }, c.title), h('div.actions', statusPill(c.status), c.ready ? h('span.pill.ok', 'Klar') : h('span.pill', 'Ikke klar'))))) : h('p.empty.small', 'Ingen ændringer siden sidste udgave.'),
      b.readyChanges.length ? h('a.btn.small.accent', { href: `#/udgiv/${b.id}` }, icon('rocket', 15), `Udgiv ${b.readyChanges.length} ændrede kapitler`) : null)));
  }
  async function exercises(category, count) {
    busy('Laver regneopgaver ud fra formelbiblioteket …');
    const r = await run('opgaver', { category, count });
    const d = await api('GET', '/api/dashboard');
    const showFacit = h('input', { type: 'checkbox' });
    const list = h('ol.exercise-list', r.tasks.map((t) => h('li', h('p', t.question.replace(/^Opgave \d+: /, '')), h('div.facit', { hidden: true }, h('ol.calc-steps', t.steps.map((s) => h('li', h('code', s)))), t.warnings.length ? h('p.small.muted', t.warnings.join(' ')) : null))));
    showFacit.addEventListener('change', () => list.querySelectorAll('.facit').forEach((f) => { f.hidden = !showFacit.checked; }));
    const subjSel = h('select', { 'aria-label': 'Fag' }, d.subjects.map((s) => h('option', { value: s.id }, `${s.code} · ${s.name}`)));
    show(h('div.card', h('h2', `${r.tasks.length} regneopgaver${category ? ' om ' + category : ''}`),
      h('label.check', showFacit, 'Vis facit og mellemregninger'), list,
      h('div.actions', subjSel, h('button.btn', { type: 'button', onclick: async () => {
        try {
          await api('POST', `/api/subjects/${subjSel.value}/assignments`, { title: `Regneopgaver${category ? ': ' + category : ''}`, description: r.tasks.map((t) => t.question).join('\n\n'), due: new Date(Date.now() + 7 * 86400000).toISOString() });
          toast('Opgaven er lagt ud til eleverne med frist om en uge');
        } catch (e) { toast(e.message, true); }
      } }, icon('send', 16), 'Giv som opgave (uden facit)'))));
  }
  async function explain(text) {
    if (text.trim().length < 20) { toast('Indsæt et afsnit på mindst en sætning', true); return; }
    busy('Claude skriver et mere forståeligt forslag …');
    try {
      const r = await aiRun('forklar', { text });
      show(h('div.card', h('h2', icon('sparkles', 18), ' Forslag – gennemlæs før brug'), r.note ? h('p.small.muted', r.note) : null, renderDoc(r.text, null),
        h('h3', 'Forskel fra originalen'), renderDiff(PortalDiff.diffText(text, r.text), { context: 3 })));
    } catch (e) { show(h('div.card', h('p.error', e.message))); }
  }
  async function ask(q) {
    if (!q.trim()) return;
    busy('Claude læser dit materiale og svarer …');
    try { const r = await aiRun('fri', { question: q }); show(h('div.card', h('h2', 'Svar'), renderDoc(r.text, null), h('p.small.muted', 'Svaret er baseret på dit eget materiale. Tjek altid juridiske oplysninger mod den officielle kilde.'))); }
    catch (e) { show(h('div.card', h('p.error', e.message))); }
  }

  const findIn = h('input', { placeholder: 'fx STCW, regel 15, hviletid, 77 timer', 'aria-label': 'Hvad skal findes?' });
  const catIn = h('input', { placeholder: 'fx stabilitet', value: 'stabilitet', 'aria-label': 'Emne' });
  const countIn = h('input', { type: 'number', min: 1, max: 10, value: 5, 'aria-label': 'Antal', class: 'num-input' });
  const explainIn = h('textarea', { rows: 4, placeholder: 'Indsæt et afsnit fra dit materiale …', 'aria-label': 'Afsnit' });
  const askIn = h('textarea', { rows: 2, placeholder: 'fx Hvilke kapitler bør jeg opdatere før næste skoleår?', 'aria-label': 'Spørgsmål' });
  const cmd = (ic, title, desc, ...controls) => h('div.card.cmd-card', h('div.cmd-head', icon(ic, 20), h('div', h('strong', title), h('div.small.muted', desc))), ...controls);
  const onEnter = (el, fn) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn(); } });
  onEnter(findIn, () => find(findIn.value));

  render(
    h('div.section-title', h('div', h('h1', 'Assistent'), h('p.muted', 'Lad assistenten finde, kontrollere og foreslå. Du har altid den endelige kontrol – intet ændres uden din godkendelse.')), aiState),
    h('div.grid.cmd-grid',
      cmd('search', 'Find alle steder, hvor noget er omtalt', 'Søger i kapitler, centrale oplysninger og retskilder.', h('div.inline-form', findIn, h('button.btn', { type: 'button', onclick: () => find(findIn.value) }, 'Find'))),
      cmd('shield', 'Kontrollér om mine formler er konsistente', 'Tjekker variabler, enheder, kontroleksempler og ødelagte henvisninger.', h('button.btn', { type: 'button', onclick: checkFormulas }, 'Kontrollér nu')),
      cmd('compare', 'Vis alle ændringer siden sidste udgave', 'For hver bog: hvad er ændret, og hvad er klar til udgivelse.', h('button.btn', { type: 'button', onclick: changes }, 'Vis ændringer')),
      cmd('calculator', 'Lav nye regneopgaver', 'Bygget på formelbiblioteket – med facit og mellemregninger.', h('div.inline-form', countIn, catIn, h('button.btn', { type: 'button', onclick: () => exercises(catIn.value, countIn.value) }, 'Lav opgaver'))),
      cmd('scale', 'Opdatér mine noter ud fra en ny bekendtgørelse', 'Gennemgå de foreslåede ændringer og godkend dem én for én.', h('a.btn', { href: '#/lovaendringer' }, 'Gå til lovændringer')),
      cmd('sparkles', 'Forklar et afsnit mere forståeligt', 'Claude omskriver uden at ændre fagligt indhold. (Kræver AI)', explainIn, h('button.btn', { type: 'button', onclick: () => explain(explainIn.value) }, 'Lav forslag')),
      cmd('chat', 'Spørg om dit materiale', 'Frit spørgsmål – Claude svarer ud fra dine bøger, oplysninger og formler. (Kræver AI)', askIn, h('button.btn', { type: 'button', onclick: () => ask(askIn.value) }, 'Spørg'))),
    out);
}
