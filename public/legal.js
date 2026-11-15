// Søret og lovændringer: overvågning, gennemgang af forslag med godkendelse,
// dokumentation – samt centrale oplysninger og retskilder (rettes ét sted).
'use strict';

const KIND_INFO = {
  kilde: ['scale', 'Retskilde', 'Ordlyden i kildebiblioteket opdateres. Alle kapitler, der citerer bestemmelsen, viser den nye tekst.'],
  fakta: ['checks', 'Central oplysning', 'Én godkendelse opdaterer værdien i alle kapitler, der bruger den.'],
  tekst: ['file', 'Tekst i kapitel', 'Afsnittet i kapitlet rettes i arbejdskopien. Du kan rette forslaget, før du godkender.'],
  gennemse: ['eye', 'Gennemlæsning', 'Kapitlet citerer bestemmelsen. Læs det igennem, og markér det som gennemset.'],
};

async function viewLegal() {
  loading();
  const d = await api('GET', '/api/legal');
  const open = d.changes.filter((c) => c.status !== 'afsluttet' && c.status !== 'afvist');
  const done = d.changes.filter((c) => c.status === 'afsluttet' || c.status === 'afvist');
  const checkBtn = h('button.btn', { type: 'button', onclick: async () => {
    checkBtn.disabled = true;
    try { const r = await api('POST', '/api/legal/check'); toast(r.added ? `${r.added} ny ændring fundet` : `Ingen nye ændringer${r.note ? ' – ' + r.note : ''}`, !!r.note); viewLegal(); }
    catch (e) { toast(e.message, true); checkBtn.disabled = false; }
  } }, icon('search', 18), 'Søg efter ændringer nu');

  const changeCard = (c) => h('a.card.change-item', { href: `#/lovaendringer/${c.id}` },
    h('div.row', h('div', h('strong', c.title), c.source ? h('div.small.muted', `${c.source.short} ${c.source.ref}${c.effectiveFrom ? ' · gælder fra ' + c.effectiveFrom : ''}`) : null),
      h('div.actions', c.demo ? h('span.pill.bad', 'Fiktiv demo') : null, h('span.pill', { class: c.status === 'afsluttet' ? 'ok' : c.status === 'afvist' ? '' : 'warn' }, c.status))),
    c.summary ? h('p.small', c.summary) : null,
    h('div.row.small.muted', h('span', `Fundet ${fmtDate(c.detectedAt)} · ${c.origin === 'demo' ? 'demo' : c.origin === 'manuel' ? 'registreret manuelt' : 'Retsinformation'}`),
      c.counts.total ? h('span', `${c.counts.open} af ${c.counts.total} forslag venter`) : h('span', 'Ikke analyseret endnu')),
    c.affectedBooks.length ? h('div.meta', c.affectedBooks.map((b) => h('span.pill', b.title))) : null);

  const manual = creator('Registrér en ændring manuelt', [
    h('p.small.muted', 'Brug fx, når du læser om en ny bekendtgørelse i et nyhedsbrev fra Søfartsstyrelsen.'),
    h('label', 'Titel', h('input', { name: 'title', required: true, placeholder: 'fx Ny bekendtgørelse om ...' })),
    h('label', 'Bestemmelse i kildebiblioteket (valgfri)', h('select', { name: 'provisionKey' }, h('option', { value: '' }, '– ingen –'))),
    h('label', 'Ny ordlyd', h('textarea', { name: 'newText', rows: 3 })),
    h('div.grid.two', h('label', 'Gælder fra', h('input', { name: 'effectiveFrom', type: 'date' })), h('label', 'Link til kilden', h('input', { name: 'url', type: 'url', placeholder: 'https://www.retsinformation.dk/...' }))),
    h('label', 'Værdier, der ændres (én pr. linje:  gammel => ny)', h('textarea', { name: 'repl', rows: 2, placeholder: '77 timer => 80 timer' })),
  ], async (data) => {
    const replacements = String(data.repl || '').split('\n').map((l) => l.split('=>').map((x) => x.trim())).filter((p) => p[0] && p[1]).map(([from, to]) => ({ from, to }));
    const c = await api('POST', '/api/legal/changes', { ...data, replacements });
    location.hash = `#/lovaendringer/${c.id}`;
  }, 'Ændringen er registreret');
  // fyld bestemmelser i valglisten
  api('GET', '/api/references').then((r) => {
    const sel = manual.querySelector('select[name=provisionKey]');
    r.provisions.forEach((p) => sel.append(h('option', { value: p.key }, `${p.source} ${p.ref} – ${p.title}`)));
  }).catch(() => {});

  render(
    h('div.section-title', h('div', h('h1', 'Søret og lovændringer'), h('p.muted', 'Systemet holder øje med dine retskilder, finder de steder i dit materiale, der påvirkes, og foreslår rettelser. Intet ændres uden din godkendelse.'))),
    h('div.editor-grid',
      h('div.stack',
        h('h2', `Til behandling (${open.length})`),
        open.length ? open.map(changeCard) : h('div.card', h('p.empty', 'Ingen ændringer venter. Godt arbejde.')),
        manual,
        done.length ? [h('h2', 'Behandlet'), done.map(changeCard)] : null),
      h('div.stack.sticky-side',
        h('div.card', h('h2', 'Overvågning'),
          h('p.small', d.monitor && d.monitor.lastCheck ? `Sidst tjekket ${fmtDateTime(d.monitor.lastCheck)}` : 'Ikke tjekket endnu'),
          h('ul.list.small', d.watched.map((s) => h('li', h('strong', s.short), ` – ${s.title}`, h('div.muted', `${s.authority || ''} · ${s.provisions} bestemmelser i dit bibliotek`)))),
          checkBtn, h('p.small.muted', 'Danske regler hentes fra Retsinformations åbne API. IMO-regler (SOLAS, STCW, COLREG) har intet åbent API og registreres manuelt eller via nyhedsbreve.'),
          h('a.small', { href: '#/kilder' }, 'Administrér retskilder →')),
        h('div.card', h('h2', 'Dokumentation'), d.log.length ? h('ul.list.small', d.log.slice(0, 8).map((l) => h('li',
          h('div', h('span.pill', { class: l.decision === 'godkendt' ? 'ok' : '' }, l.decision), ' ', l.title),
          h('div.muted', `${fmtDateTime(l.at)} · ${l.byName}${l.source ? ' · ' + l.source : ''}${l.effectiveFrom ? ' · gælder fra ' + l.effectiveFrom : ''}${l.aiAssisted ? ' · AI-assisteret' : ''}`)))) : h('p.empty.small', 'Endnu ingen beslutninger.'),
        d.log.length ? h('a.small', { href: '#/dokumentation' }, 'Se hele loggen →') : null))));
}

async function viewLegalLog() {
  loading();
  const d = await api('GET', '/api/legal');
  render(
    h('div.small', h('a', { href: '#/lovaendringer' }, '← Lovændringer')),
    h('div.section-title', h('div', h('h1', 'Dokumentation af ændringer'), h('p.muted', 'Hver beslutning gemmes med kilde, dato og den tekst, der blev godkendt.'))),
    h('div.card', h('div.table-wrap', h('table',
      h('thead', h('tr', h('th', 'Dato'), h('th', 'Beslutning'), h('th', 'Hvad'), h('th', 'Kilde'), h('th', 'Gælder fra'), h('th', 'Af'))),
      h('tbody', d.log.map((l) => h('tr', h('td.small', fmtDateTime(l.at)), h('td', h('span.pill', { class: l.decision === 'godkendt' ? 'ok' : '' }, l.decision)),
        h('td', h('div', l.title), l.after ? h('div.small.muted', `Ny tekst: ${l.after.slice(0, 120)}${l.after.length > 120 ? ' …' : ''}`) : null, l.comment ? h('div.small', `Kommentar: ${l.comment}`) : null),
        h('td.small', l.sourceUrl ? h('a', { href: l.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, l.source || 'Kilde') : l.source), h('td.small', l.effectiveFrom || '–'), h('td.small', `${l.byName}${l.aiAssisted ? ' (AI-assisteret)' : ''}`))))))));
}

async function viewLegalChange(id) {
  loading();
  const c = await api('GET', `/api/legal/changes/${id}`);
  const reload = () => viewLegalChange(id);
  const decided = c.proposals.filter((p) => p.status !== 'afventer').length;

  function proposalCard(p) {
    const [ic, label, help] = KIND_INFO[p.kind];
    const editable = p.status === 'afventer' && p.kind !== 'gennemse';
    const ta = editable ? h('textarea.proposal-text', { rows: p.kind === 'tekst' ? 4 : p.kind === 'kilde' ? 3 : 1, value: p.after, 'aria-label': 'Foreslået tekst' }) : null;
    const diffBox = h('div', p.diff ? renderDiff(p.diff, { context: 2 }) : null);
    if (ta) ta.addEventListener('input', () => setKids(diffBox, renderDiff(PortalDiff.diffText(p.before, ta.value), { context: 2 })));
    const aiNote = h('div.small.muted', p.aiNote ? `AI: ${p.aiNote}` : '');
    const decide = async (decision) => {
      try { await api('POST', `/api/proposals/${p.id}/decide`, { decision, after: ta ? ta.value : undefined }); toast(decision === 'godkend' ? 'Godkendt og ført ind' : 'Afvist'); reload(); }
      catch (e) { toast(e.message, true); }
    };
    const aiBtn = p.kind === 'tekst' && p.status === 'afventer' ? h('button.btn.ghost.small', { type: 'button', onclick: async () => {
      aiBtn.disabled = true; aiNote.textContent = 'AI læser den gamle og nye bestemmelse og afsnittet …';
      try {
        const r = await aiRun('lovforslag', { oldText: c.oldText, newText: c.newText, text: p.before });
        ta.value = r.text; ta.dispatchEvent(new Event('input'));
        aiNote.textContent = `AI: ${r.note}`;
        await api('PUT', `/api/proposals/${p.id}`, { after: r.text, generatedBy: 'ai', aiNote: r.note });
      } catch (e) { aiNote.textContent = e.message; }
      aiBtn.disabled = false;
    } }, icon('sparkles', 15), 'Lad AI foreslå formulering') : null;
    return h('section.card.proposal', { class: 'p-' + p.status },
      h('div.row', h('div.proposal-kind', icon(ic, 18), h('div', h('strong', p.title), h('div.small.muted', label + ' · ' + help))),
        h('span.pill', { class: p.status === 'godkendt' ? 'ok' : p.status === 'afvist' ? '' : 'warn' }, p.status)),
      p.affects && p.affects.length ? h('div.small', icon('book', 14), ` Påvirker: `, p.affects.map((a, i) => [i ? ', ' : '', h('a', { href: `#/rediger-kapitel/${a.chapterId}` }, `${a.bookTitle}: ${a.chapterTitle}`)])) : null,
      p.rationale ? h('p.small', p.rationale) : null,
      p.kind !== 'gennemse' ? diffBox : null,
      ta ? h('label.small', 'Rettelse, der godkendes (du kan redigere den)', ta) : null,
      aiNote,
      p.status === 'afventer' ? h('div.actions',
        h('button.btn', { type: 'button', onclick: () => decide('godkend') }, icon('check', 16), p.kind === 'gennemse' ? 'Markér som gennemset' : 'Godkend'),
        p.kind !== 'gennemse' ? h('button.btn.ghost', { type: 'button', onclick: () => decide('afvis') }, 'Afvis') : null,
        aiBtn,
        p.kind === 'gennemse' && p.affects[0] ? h('a.btn.ghost.small', { href: `#/rediger-kapitel/${p.affects[0].chapterId}` }, 'Åbn kapitlet') : null)
        : h('p.small.muted', `${p.status === 'godkendt' ? 'Godkendt' : 'Afvist'} ${fmtDateTime(p.decidedAt)} af ${p.decidedByName}${p.generatedBy === 'ai' ? ' · AI-assisteret' : ''}`));
  }

  const kinds = ['fakta', 'kilde', 'tekst', 'gennemse'];
  render(
    h('div.small', h('a', { href: '#/lovaendringer' }, '← Lovændringer')),
    c.demo ? h('div.card.notice.bad', icon('alert', 20), h('div', h('strong', 'Fiktiv ændring – kun til afprøvning'), h('div.small', 'Dette er ikke gældende ret. Eksemplet viser arbejdsgangen fra ændring til udgivelse.'))) : null,
    h('div.section-title', h('div', h('h1', c.title),
      h('p.muted', [c.source ? `${c.source.short} ${c.source.ref}` : null, c.effectiveFrom ? `gælder fra ${c.effectiveFrom}` : null, `fundet ${fmtDate(c.detectedAt)}`].filter(Boolean).join(' · '))),
      h('div.actions', c.url ? h('a.btn.ghost', { href: c.url, target: '_blank', rel: 'noopener noreferrer' }, 'Officiel kilde ↗') : null,
        c.status !== 'afsluttet' && c.status !== 'afvist' ? h('button.btn.ghost', { type: 'button', onclick: async () => { await api('POST', `/api/legal/changes/${c.id}/dismiss`, {}); toast('Ændringen er afvist – intet blev ændret'); location.hash = '#/lovaendringer'; } }, 'Afvis hele ændringen') : null)),
    h('ol.stepper', h('li.done', 'Ændring fundet'), h('li', { class: 'done' }, 'Berørt materiale fundet'),
      h('li', { class: decided === c.proposals.length ? 'done' : 'current' }, `Gennemgå forslag (${decided}/${c.proposals.length})`),
      h('li', { class: decided === c.proposals.length ? 'current' : '' }, 'Udgiv berørte bøger')),
    c.textDiff ? h('div.card', h('h2', 'Hvad er ændret i bestemmelsen?'), c.summary ? h('p.small', c.summary) : null, renderDiff(c.textDiff, { context: 3 })) : null,
    decided === c.proposals.length && c.affectedBooks.length ? h('div.card.notice.ok', icon('check', 20), h('div',
      h('strong', 'Alle forslag er behandlet. Ændringerne ligger nu i arbejdskopien.'),
      h('div.small', 'Eleverne ser dem, når du udgiver en ny version af de berørte bøger:'),
      h('div.actions', c.affectedBooks.map((b) => h('a.btn.accent.small', { href: `#/udgiv/${b.id}` }, icon('rocket', 15), `Udgiv ${b.title}`))))) : null,
    kinds.map((k) => {
      const list = c.proposals.filter((p) => p.kind === k);
      return list.length ? [h('h2', { fakta: 'Centrale oplysninger', kilde: 'Retskilden', tekst: 'Tekst i kapitler', gennemse: 'Kapitler der bør gennemlæses' }[k]), list.map(proposalCard)] : null;
    }));
}

// ---------- Centrale oplysninger ----------
async function viewFacts() {
  loading();
  const { facts } = await api('GET', '/api/facts');
  const reload = () => viewFacts();
  render(
    h('div.section-title', h('div', h('h1', 'Centrale oplysninger'), h('p.muted', 'Tal og fakta, der bruges mange steder. Ret værdien her – så opdateres den i alle kapitler.'))),
    creator('Ny central oplysning', [
      h('div.grid.two', h('label', 'Navn', h('input', { name: 'label', required: true, placeholder: 'fx Mindste fribord' })), h('label', 'Nøgle (bruges i teksten)', h('input', { name: 'key', required: true, placeholder: 'fx mindste-fribord', pattern: '[a-z0-9-]+' }))),
      h('div.grid.three', h('label', 'Værdi', h('input', { name: 'value', required: true })), h('label', 'Enhed', h('input', { name: 'unit' })), h('label', 'Note', h('input', { name: 'note' }))),
    ], (data) => api('POST', '/api/facts', data).then(reload), 'Oplysningen er oprettet'),
    h('div.card', h('div.table-wrap', h('table.facts-table',
      h('thead', h('tr', h('th', 'Oplysning'), h('th', 'Værdi'), h('th', 'Bruges i'), h('th', 'Senest ændret'), h('th', ''))),
      h('tbody', facts.map((f) => {
        const val = h('input.fact-value', { value: f.value, 'aria-label': `Værdi for ${f.label}` });
        const why = h('input', { placeholder: 'Begrundelse (valgfri)', 'aria-label': 'Begrundelse' });
        const save = h('button.btn.small', { type: 'button', onclick: async () => {
          try { const r = await api('PUT', `/api/facts/${f.id}`, { value: val.value, why: why.value }); toast(`Opdateret i ${r.usage.length} kapitl${r.usage.length === 1 ? '' : 'er'}`); reload(); } catch (e) { toast(e.message, true); }
        } }, 'Gem');
        return h('tr',
          h('td', h('strong', f.label), h('div.small.muted', h('code', `{{fakta:${f.key}}}`)), f.note ? h('div.small.muted', f.note) : null),
          h('td', h('div.fact-edit', val, h('span.small', f.unit || '')), h('div.fact-edit', why, save)),
          h('td.small', f.usage.length ? h('details', h('summary', `${f.usage.length} kapitl${f.usage.length === 1 ? '' : 'er'}`), h('ul', f.usage.map((u) => h('li', h('a', { href: `#/rediger-kapitel/${u.chapterId}` }, `${u.bookTitle}: ${u.chapterTitle}`))))) : h('span.muted', 'Ikke brugt')),
          h('td.small', fmtDate(f.updatedAt), h('div.muted', f.updatedByName), f.history.length ? h('details', h('summary', 'Historik'), h('ul', f.history.map((x) => h('li', `${x.value} ${x.unit || ''} – ${fmtDate(x.at)}${x.why ? ' (' + x.why + ')' : ''}`)))) : null),
          h('td', f.usage.length ? null : deleteBtn(`/api/facts/${f.id}`, reload)));
      }))))));
}

// ---------- Retskilder ----------
async function viewSources() {
  loading();
  const { sources } = await api('GET', '/api/sources');
  const reload = () => viewSources();
  render(
    h('div.small', h('a', { href: '#/lovaendringer' }, '← Lovændringer')),
    h('div.section-title', h('div', h('h1', 'Retskilder'), h('p.muted', 'Bestemmelser, dine kapitler henviser til. De bruges til at finde berørt materiale, når reglerne ændres.'))),
    creator('Ny retskilde', [
      h('div.grid.two', h('label', 'Kort navn', h('input', { name: 'short', required: true, placeholder: 'fx SOLAS' })), h('label', 'Myndighed', h('input', { name: 'authority', placeholder: 'fx IMO / Søfartsstyrelsen' }))),
      h('label', 'Titel', h('input', { name: 'title', required: true })), h('label', 'Link', h('input', { name: 'url', type: 'url' })),
    ], (data) => api('POST', '/api/sources', data).then(reload), 'Kilden er oprettet'),
    sources.map((s) => h('section.card.stack',
      h('div.row', h('div', h('h2', `${s.short} – ${s.title}`), h('div.small.muted', [s.kind, s.authority].filter(Boolean).join(' · '))), s.url ? h('a.small', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, 'Officiel kilde ↗') : null),
      s.provisions.length ? h('ul.list', s.provisions.map((p) => h('li',
        h('div.row', h('div', h('strong', `${p.ref}${p.title ? ' – ' + p.title : ''}`), h('div.small.muted', h('code', `{{kilde:${p.key}}}`), ` · bruges i ${p.usage.length} kapitl${p.usage.length === 1 ? '' : 'er'}${p.validFrom ? ' · gælder fra ' + p.validFrom : ''}`))),
        h('p.small', p.text)))) : h('p.empty.small', 'Ingen bestemmelser endnu.'),
      creator(`Tilføj bestemmelse til ${s.short}`, [
        h('div.grid.three', h('label', 'Henvisning', h('input', { name: 'ref', required: true, placeholder: 'fx Regel 19' })), h('label', 'Titel', h('input', { name: 'title' })), h('label', 'Nøgle', h('input', { name: 'key', required: true, placeholder: 'fx colreg-19' }))),
        h('label', 'Ordlyd (kort gengivelse)', h('textarea', { name: 'text', required: true, rows: 3 })),
      ], (data) => api('POST', `/api/sources/${s.id}/provisions`, data).then(reload), 'Bestemmelsen er tilføjet'))));
}
