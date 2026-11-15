// Undervisningsbøger: bibliotek, læser (udgaver), editor (arbejdskopi), udgivelse,
// ændringsoversigt, import af PDF/Word og eksport til PDF.
'use strict';

const wordsIn = (s) => (String(s).match(/\S+/g) || []).length;
const readMinutes = (words) => Math.max(1, Math.round(words / 180));
function progressBar(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = h('div.progress', { role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': `${pct}% læst` }, h('span'));
  bar.firstChild.style.setProperty('width', pct + '%');
  return bar;
}
const STATUS = {
  'ny': ['pill.warn', 'Ny – ikke udgivet'], 'ændret': ['pill.info', 'Ændret siden udgivelse'],
  'opdateret indhold': ['pill.info', 'Opdateret oplysning/formel'], 'udgivet': ['pill.ok', 'Udgivet'],
};
const statusPill = (st) => { const [cls, label] = STATUS[st] || ['pill', st]; return h('span.' + cls, label); };
const versionPill = (e) => (e ? h('span.pill.version', `v${e.version}`) : h('span.pill.warn', 'Ikke udgivet'));
const isRecent = (iso, days = 14) => iso && Date.now() - new Date(iso) < days * 86400000;

// Hash-adresser med parametre: #/bog/b-ret/c-ret2?udgave=e1
function hashQuery() { const q = (location.hash.split('?')[1] || ''); return Object.fromEntries(new URLSearchParams(q)); }

// Indlæs et bibliotek fra cdnjs første gang, det skal bruges
const loadedScripts = {};
function loadScript(src) {
  if (!loadedScripts[src]) loadedScripts[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Kunne ikke hente ' + src.split('/').slice(-3, -1).join(' ')));
    document.head.appendChild(s);
  });
  return loadedScripts[src];
}
const LIB = {
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfworker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
};

// ---------- Diff-visning ----------
function renderDiff(diff, opts = {}) {
  const ctxLines = opts.context == null ? 1 : opts.context;
  const out = h('div.diff');
  const blocks = diff.blocks;
  blocks.forEach((b, i) => {
    if (b.type === 'same') {
      const near = blocks.slice(Math.max(0, i - ctxLines), i + ctxLines + 1).some((x) => x.type !== 'same');
      if (!near) { if (out.lastChild && !out.lastChild.classList.contains('diff-gap')) out.append(h('div.diff-gap', '⋯')); return; }
      if (b.text.trim() && !/^\s*\|?[\s:|-]+\|?\s*$/.test(b.text)) out.append(h('div.diff-line.same', b.text));
      return;
    }
    if (b.type === 'add') return out.append(h('div.diff-line.add', h('span.diff-mark', '+'), h('ins', b.text)));
    if (b.type === 'del') return out.append(h('div.diff-line.del', h('span.diff-mark', '−'), h('del', b.text)));
    out.append(h('div.diff-line.mod', h('span.diff-mark', '~'), b.words.map((w) => (w.t === '+' ? h('ins', w.s) : w.t === '-' ? h('del', w.s) : w.s))));
  });
  if (!blocks.some((b) => b.type !== 'same')) out.append(h('p.small.muted', 'Ingen tekstændringer.'));
  return out;
}

// ---------- Bibliotek ----------
function bookCover(b) {
  const meta = isTeacher()
    ? [versionPill(b.edition), b.pending ? h('span.pill.info', `${b.pending} ændring${b.pending === 1 ? '' : 'er'} i arbejdskopien`) : h('span.pill', 'Ingen ventende ændringer'), b.hidden ? h('span.pill.bad', 'Skjult for elever') : null]
    : [versionPill(b.edition), isRecent(b.edition && b.edition.publishedAt) ? h('span.pill.new', 'Ny version') : null, h('span.pill', `${b.readCount}/${b.chapterCount} læst`)];
  return h('div.book', { accent: b.color },
    h('a.book-cover', { href: `#/bog/${b.id}` },
      h('div.book-spine'),
      h('div.book-body',
        h('div.code', b.subjectCode, ' · ', b.subjectName),
        h('h3', b.title),
        b.description ? h('p.small.muted', b.description) : null,
        !isTeacher() ? progressBar(b.readCount, b.chapterCount) : null,
        h('div.meta', meta))),
    isTeacher() ? h('div.book-actions',
      h('a.btn.small', { href: `#/rediger-bog/${b.id}` }, icon('pencil', 16), 'Redigér'),
      b.pending ? h('a.btn.small.accent', { href: `#/udgiv/${b.id}` }, icon('rocket', 16), 'Udgiv') : null,
      h('a.btn.ghost.small', { href: `#/bog/${b.id}` }, icon('eye', 16), 'Se som elev')) : null);
}
function newBookForm(subjects, presetSubjectId) {
  return creator('Ny undervisningsbog', [
    h('label', 'Fag', h('select', { name: 'subjectId', required: true },
      subjects.map((s) => h('option', { value: s.id, selected: s.id === presetSubjectId }, `${s.code} · ${s.name}`)))),
    h('label', 'Titel', h('input', { name: 'title', required: true, placeholder: 'fx Radar og ARPA' })),
    h('label', 'Kort beskrivelse', h('textarea', { name: 'description', rows: 2 })),
  ], async (data) => {
    const b = await api('POST', `/api/subjects/${data.subjectId}/books`, data);
    location.hash = `#/rediger-bog/${b.id}`;
  }, 'Bogen er oprettet – skriv det første kapitel eller importér et dokument');
}
async function viewLibrary() {
  loading();
  const [{ books }, d] = await Promise.all([api('GET', '/api/books'), api('GET', '/api/dashboard')]);
  render(
    h('div.section-title', h('div', h('h1', isTeacher() ? 'Mine undervisningsmaterialer' : 'Mine bøger'),
      h('p.muted', isTeacher() ? 'Du arbejder i en arbejdskopi. Eleverne ser kun den seneste udgivne version.' : 'Bøgerne til dine fag – altid i den nyeste udgave.'))),
    isTeacher() ? newBookForm(d.subjects) : null,
    books.length ? h('div.grid.books', books.map(bookCover)) : h('div.card', h('p.empty', isTeacher() ? 'Ingen bøger endnu – opret den første ovenfor.' : 'Dine undervisere har ikke udgivet nogen bøger endnu.')));
}

// ---------- Læser (udgivet version) ----------
async function viewBook(bookId, chapterId) {
  loading();
  const q = hashQuery();
  const b = await api('GET', `/api/books/${bookId}${q.udgave ? '?edition=' + encodeURIComponent(q.udgave) : ''}`);
  // Underviseren får arbejdskopien fra /api/books/:id – til læsning bruges den udgivne version
  let book = b;
  if (isTeacher() && b.mode === 'arbejdskopi') {
    if (!b.edition) { render(h('div.card', h('h1', b.title), h('p', 'Bogen er ikke udgivet endnu, så eleverne kan ikke se den.'), h('a.btn', { href: `#/rediger-bog/${b.id}` }, 'Gå til redigering'))); return; }
    book = await api('GET', `/api/books/${bookId}?edition=${b.edition.id}`);
  }
  const ed = book.viewing || book.edition;
  const qs = q.udgave ? `?udgave=${q.udgave}` : '';
  const chapter = chapterId ? await api('GET', `/api/books/${bookId}/chapters/${chapterId}${q.udgave ? '?edition=' + q.udgave : ''}`) : null;
  const done = book.chapters.filter((c) => c.read).length;

  const toc = h('nav.card.toc', { 'aria-label': 'Indhold' },
    h('a.small', { href: '#/boeger' }, '← Alle bøger'),
    h('h2', book.title),
    h('div.row', versionPill(ed), ed ? h('a.small', { href: `#/aendringer/${ed.id}` }, icon('compare', 14), ' Se ændringer') : null),
    !isTeacher() ? [h('div.small.muted', `${done} af ${book.chapters.length} kapitler læst`), progressBar(done, book.chapters.length)] : null,
    h('ol.toc-list', book.chapters.map((c) => h('li', { class: [chapter && chapter.id === c.id ? 'current' : '', c.parentId ? 'sub' : ''].join(' ') },
      h('a', { href: `#/bog/${book.id}/${c.id}${qs}` },
        h('span.toc-num', c.number), h('span.toc-title', c.title),
        c.changed ? h('span.dot', { title: `Ændret i version ${ed.version}` }) : null,
        c.read ? h('span.toc-check', { title: 'Læst' }, icon('check', 15)) : null)))),
    book.pdfAllowed || isTeacher() ? h('button.btn.ghost.small', { type: 'button', onclick: () => exportPdf(book.id, { edition: ed && ed.id }) }, icon('download', 16), 'Download PDF') : null,
    isTeacher() ? h('a.btn.small', { href: `#/rediger-bog/${book.id}` }, icon('pencil', 16), 'Redigér bogen') : null);

  let main;
  if (!chapter) {
    const next = book.chapters.find((c) => !c.read) || book.chapters[0];
    main = h('article.card.reader',
      h('div.code', book.subjectCode, ' · ', book.subjectName),
      h('h1', book.title),
      book.description ? h('p.lead', book.description) : null,
      ed ? h('p.small.muted', `Version ${ed.version} · udgivet ${fmtDate(ed.publishedAt)} af ${ed.publishedBy} · ${book.chapters.length} kapitler`) : null,
      ed && ed.notes ? h('div.release-note', h('strong', `Nyt i version ${ed.version}`), h('p.prewrap', ed.notes)) : null,
      next ? h('div.actions', h('a.btn', { href: `#/bog/${book.id}/${next.id}${qs}` }, icon('book', 18), !isTeacher() && done && done < book.chapters.length ? 'Fortsæt læsning' : 'Start læsning')) : null,
      book.editions && book.editions.length > 1 ? h('details.card.history', h('summary', icon('history', 16), ` Tidligere versioner (${book.editions.length})`),
        h('ul.list', book.editions.map((e) => h('li.row', h('div', h('strong', `Version ${e.version}`), h('div.small.muted', `${fmtDate(e.publishedAt)} · ${e.changeCount} ændring${e.changeCount === 1 ? '' : 'er'}`)),
          h('div.actions', h('a.btn.ghost.small', { href: `#/aendringer/${e.id}` }, 'Ændringer'), h('a.btn.ghost.small', { href: `#/bog/${book.id}?udgave=${e.id}` }, 'Læs denne version')))))) : null);
  } else {
    const noteBox = h('textarea.note-input', { rows: 4, placeholder: 'Dine egne noter til kapitlet – kun du kan se dem.', value: chapter.note, 'aria-label': 'Personlig note' });
    const noteStatus = h('span.small.muted');
    let nt;
    noteBox.addEventListener('input', () => {
      noteStatus.textContent = 'Gemmer …'; clearTimeout(nt);
      nt = setTimeout(async () => { try { await api('PUT', `/api/notes/${chapter.id}`, { bookId: book.id, text: noteBox.value }); noteStatus.textContent = 'Gemt'; } catch (e) { noteStatus.textContent = e.message; } }, 700);
    });
    const doc = renderDoc(chapter.content, chapter.refs, { teacher: isTeacher() });
    // Bogmærke ved hver overskrift
    if (!isTeacher()) doc.querySelectorAll('h2, h3').forEach((hd) => {
      hd.append(h('button.icon-btn.bm-btn', { type: 'button', title: 'Bogmærk afsnittet', 'aria-label': `Bogmærk ${hd.textContent}`,
        onclick: async () => { try { await api('POST', '/api/bookmarks', { bookId: book.id, chapterId: chapter.id, anchor: hd.id, label: `${chapter.title}: ${hd.textContent}` }); toast('Bogmærke gemt'); } catch (e) { toast(e.message, true); } } }, icon('bookmark', 15)));
    });
    const readBtn = !isTeacher() ? h('button.btn', {
      type: 'button', class: chapter.read ? 'ghost' : '',
      onclick: async () => {
        try {
          await api('POST', `/api/chapters/${chapter.id}/read`, { read: !chapter.read });
          if (!chapter.read && chapter.next) location.hash = `#/bog/${book.id}/${chapter.next.id}${qs}`; else viewBook(book.id, chapter.id);
        } catch (e) { toast(e.message, true); }
      },
    }, icon('check', 18), chapter.read ? 'Læst – fortryd' : chapter.next ? 'Læst – næste kapitel' : 'Markér som læst') : null;
    main = h('article.card.reader', { accent: chapter.color },
      isTeacher() ? h('div.notice.small', icon('eye', 16), `Du ser version ${ed.version}, som eleverne ser den.`, h('a', { href: `#/rediger-kapitel/${chapter.id}` }, ' Redigér arbejdskopien →')) : null,
      chapter.changedInThisEdition ? h('div.notice.small.info', icon('compare', 16), `Kapitlet er ændret i version ${ed.version}. `, h('a', { href: `#/aendringer/${ed.id}` }, 'Se hvad der er ændret')) : null,
      h('div.row', h('div.small.muted', `Kapitel ${chapter.number}`),
        !isTeacher() ? h('button.btn.ghost.small', { type: 'button', onclick: async () => { try { await api('POST', '/api/bookmarks', { bookId: book.id, chapterId: chapter.id, label: chapter.title }); toast('Bogmærke gemt'); } catch (e) { toast(e.message, true); } } }, icon('bookmark', 16), 'Bogmærk') : null),
      h('h1', chapter.title),
      h('p.small.muted', `${readMinutes(wordsIn(chapter.content))} min. læsning · version ${ed.version}`),
      doc,
      !isTeacher() ? h('div.note-card', h('div.row', h('strong', icon('note', 16), ' Mine noter'), noteStatus), noteBox) : null,
      h('div.reader-nav',
        chapter.prev ? h('a.btn.ghost', { href: `#/bog/${book.id}/${chapter.prev.id}${qs}` }, '← ', chapter.prev.title) : h('span'),
        readBtn,
        chapter.next ? h('a.btn.ghost', { href: `#/bog/${book.id}/${chapter.next.id}${qs}` }, chapter.next.title, ' →') : h('span')));
  }
  render(h('div.reader-layout', { accent: book.color }, toc, main));
  const anchor = q.afsnit && document.getElementById(q.afsnit);
  if (anchor) anchor.scrollIntoView({ block: 'start' });
}

// ---------- Ændringer i en udgave ----------
async function viewChanges(editionId) {
  loading();
  const d = await api('GET', `/api/editions/${editionId}/changes`);
  api('POST', '/api/notifications/read', {}).then(() => updateChrome()).catch(() => {});
  render(
    h('div.small', h('a', { href: `#/bog/${d.book.id}` }, `← ${d.book.title}`)),
    h('div.hero.changes-hero', { accent: d.book.color },
      h('div.small', d.previous ? `Siden version ${d.previous}` : 'Første udgave'),
      h('h1', `${d.book.title} – version ${d.edition.version}`),
      h('p', `Udgivet ${fmtDate(d.edition.publishedAt)} af ${d.edition.publishedBy} · ${d.edition.changeCount} ændring${d.edition.changeCount === 1 ? '' : 'er'}${d.edition.scope === 'kapitel' ? ' · enkelt kapitel' : ''}`)),
    d.edition.notes ? h('div.card.release-note', h('strong', 'Underviserens noter'), h('p.prewrap', d.edition.notes)) : null,
    h('div.legend.small', h('span', h('ins', 'tilføjet')), h('span', h('del', 'fjernet'))),
    d.changes.length ? d.changes.map((c) => h('section.card.change-card',
      h('div.row', h('h2', c.title), h('div.actions', h('span.pill', c.kind), c.kind !== 'fjernet' ? h('a.btn.ghost.small', { href: `#/bog/${d.book.id}/${c.chapterId}` }, 'Læs kapitlet') : null)),
      c.oldTitle ? h('p.small.muted', `Tidligere titel: ${c.oldTitle}`) : null,
      renderDiff(c.diff))) : h('div.card', h('p.empty', 'Ingen ændringer i forhold til forrige version.')));
}

// ---------- Bog-editor (arbejdskopi) ----------
async function viewBookEditor(bookId) {
  loading();
  const b = await api('GET', `/api/books/${bookId}`);
  const reload = () => viewBookEditor(bookId);
  const tops = b.chapters.filter((c) => !c.parentId);
  const pendingCount = b.chapters.filter((c) => c.status !== 'udgivet').length;

  const move = (c, dir) => api('POST', `/api/chapters/${c.id}/move`, { dir }).then(reload).catch((e) => toast(e.message, true));
  const toggleReady = (c, on) => api('PUT', `/api/chapters/${c.id}`, { ready: on }).then(reload).catch((e) => toast(e.message, true));
  const rows = b.chapters.map((c) => {
    const sibs = b.chapters.filter((x) => (x.parentId || null) === (c.parentId || null));
    const i = sibs.indexOf(c);
    return h('li', { class: c.parentId ? 'sub' : '' }, h('div.chapter-row',
      h('div.chapter-order',
        h('button.icon-btn', { type: 'button', title: 'Flyt op', 'aria-label': 'Flyt op', disabled: i === 0, onclick: () => move(c, -1) }, icon('up', 15)),
        h('button.icon-btn', { type: 'button', title: 'Flyt ned', 'aria-label': 'Flyt ned', disabled: i === sibs.length - 1, onclick: () => move(c, 1) }, icon('down', 15))),
      h('div.chapter-info',
        h('a', { href: `#/rediger-kapitel/${c.id}` }, h('strong', `${c.number} ${c.title}`)),
        h('div.small.muted', `${c.words} ord · rettet ${fmtDateTime(c.updatedAt)} af ${c.updatedBy}`)),
      statusPill(c.status),
      c.status !== 'udgivet' ? h('label.ready-toggle', h('input', { type: 'checkbox', checked: c.ready, onchange: (e) => toggleReady(c, e.target.checked) }), 'Klar til udgivelse') : null,
      h('div.actions',
        h('a.btn.small', { href: `#/rediger-kapitel/${c.id}` }, icon('pencil', 15), 'Skriv'),
        deleteBtn(`/api/chapters/${c.id}`, reload))));
  });

  const addChapter = submitForm(h('form.form.inline-form',
    h('input', { name: 'title', required: true, placeholder: 'Titel på nyt kapitel', 'aria-label': 'Titel på nyt kapitel' }),
    h('select', { name: 'parentId', 'aria-label': 'Placering' }, h('option', { value: '' }, 'Hovedkapitel'), tops.map((t) => h('option', { value: t.id }, `Underkapitel af ${t.number} ${t.title}`))),
    h('button.btn', { type: 'submit' }, icon('plus', 18), 'Tilføj')),
  async (data) => { const c = await api('POST', `/api/books/${b.id}/chapters`, data); location.hash = `#/rediger-kapitel/${c.id}`; }, 'Kapitlet er oprettet');

  const settings = submitForm(h('form.form',
    h('label', 'Titel', h('input', { name: 'title', required: true, value: b.title })),
    h('label', 'Beskrivelse', h('textarea', { name: 'description', rows: 3, value: b.description || '' })),
    h('label.check', h('input', { type: 'checkbox', name: 'pdfAllowed', checked: b.pdfAllowed }), 'Elever må downloade bogen som PDF'),
    h('label.check', h('input', { type: 'checkbox', name: 'hidden', checked: b.hidden }), 'Skjul bogen for elever'),
    h('div.actions', h('button.btn', { type: 'submit' }, 'Gem oplysninger'))),
  (data) => api('PUT', `/api/books/${b.id}`, { title: data.title, description: data.description, pdfAllowed: !!data.pdfAllowed, hidden: !!data.hidden }).then(reload), 'Bogen er gemt');

  render(
    h('div.small', h('a', { href: '#/boeger' }, '← Mine undervisningsmaterialer')),
    h('div.section-title',
      h('div', h('div.code', { accent: b.color }, b.subjectCode, ' · ', b.subjectName), h('h1', b.title),
        h('div.row.gap', versionPill(b.edition), b.edition ? h('span.small.muted', `udgivet ${fmtDate(b.edition.publishedAt)}`) : null)),
      h('div.actions',
        h('a.btn.ghost', { href: `#/importer/${b.id}` }, icon('upload', 18), 'Importér dokument'),
        h('button.btn.ghost', { type: 'button', onclick: () => exportPdf(b.id, { draft: true }) }, icon('download', 18), 'PDF af kladde'),
        b.edition ? h('a.btn.ghost', { href: `#/bog/${b.id}` }, icon('eye', 18), 'Se som elev') : null,
        h('a.btn.accent', { href: `#/udgiv/${b.id}` }, icon('rocket', 18), 'Udgiv ny version'))),
    pendingCount ? h('div.card.notice.info', icon('pencil', 18), h('div', h('strong', `${pendingCount} kapitl${pendingCount === 1 ? '' : 'er'} er ændret i forhold til version ${b.edition ? b.edition.version : '–'}`),
      h('div.small', 'Eleverne ser ingen af ændringerne, før du udgiver. Markér kapitlerne “Klar til udgivelse”, når de er færdige. Ændrede centrale oplysninger og formler kommer automatisk med.'))) : null,
    h('div.editor-grid',
      h('div.card.stack', h('h2', 'Kapitler'), b.chapters.length ? h('ol.chapter-list', rows) : h('p.empty', 'Bogen har ingen kapitler endnu. Tilføj et eller importér et dokument.'), addChapter),
      h('div.stack',
        h('div.card', h('h2', 'Udgivelser'), b.editions.length ? h('ul.list', b.editions.map((e) => h('li.row',
          h('div', h('strong', `Version ${e.version}`), h('div.small.muted', `${fmtDate(e.publishedAt)} · ${e.publishedBy} · ${e.changeCount} ændring${e.changeCount === 1 ? '' : 'er'}${e.scope === 'kapitel' ? ' · enkelt kapitel' : ''}`)),
          h('a.btn.ghost.small', { href: `#/aendringer/${e.id}` }, 'Se ændringer')))) : h('p.empty', 'Ikke udgivet endnu.')),
        h('div.card', h('h2', 'Oplysninger'), settings),
        h('div.card.danger-zone', h('h2', 'Slet bogen'), h('p.small.muted', 'Sletter bogen med alle kapitler, udgaver og elevernes noter.'), deleteBtn(`/api/books/${b.id}`, () => { location.hash = '#/boeger'; })))));
}

// ---------- Udgiv ny version ----------
async function viewPublish(bookId) {
  loading();
  const q = hashQuery();
  const scope = q.kapitel ? 'kapitel' : 'bog';
  const d = await api('GET', `/api/books/${bookId}/pending?scope=${scope}${q.kapitel ? '&chapterId=' + q.kapitel : ''}`);
  let kind = 'minor';
  const notes = h('textarea', { rows: 4, value: d.suggestedNotes, 'aria-label': 'Udgivelsesnoter' });
  const btn = h('button.btn.accent.big', { type: 'button', disabled: !d.changeCount }, icon('rocket', 20), `Udgiv version ${d.next.minor}`);
  const radios = h('div.version-choice', [['minor', `Mindre opdatering · ${d.current || '–'} → ${d.next.minor}`, 'Rettelser og opdateringer'], ['major', `Ny udgave · ${d.current || '–'} → ${d.next.major}`, 'Større omskrivning eller nyt skoleår']].map(([k, label, sub]) =>
    h('label.radio-card', h('input', { type: 'radio', name: 'kind', value: k, checked: k === kind, onchange: () => { kind = k; btn.lastChild.textContent = `Udgiv version ${d.next[k]}`; } }), h('span', h('strong', label), h('span.small.muted', sub)))));
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const e = await api('POST', `/api/books/${bookId}/publish`, { kind, notes: notes.value, scope, chapterId: q.kapitel });
      render(h('div.card.success-card',
        h('div.success-icon', icon('check', 36)),
        h('h1', `Version ${e.version} er udgivet`),
        h('ol.done-steps',
          h('li', icon('check', 16), 'Den nye version er gemt'),
          h('li', icon('check', 16), `${e.changeCount} ændring${e.changeCount === 1 ? '' : 'er'} er registreret`),
          h('li', icon('check', 16), 'Elevportalen er opdateret'),
          h('li', icon('check', 16), `${e.notified} elev${e.notified === 1 ? '' : 'er'} har fået besked`),
          h('li', icon('check', 16), 'Tidligere versioner er bevaret i historikken')),
        h('div.actions', h('a.btn', { href: `#/aendringer/${e.id}` }, 'Se ændringerne, som eleverne ser dem'), h('a.btn.ghost', { href: `#/rediger-bog/${bookId}` }, 'Tilbage til bogen'))));
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  const markReady = (c) => api('PUT', `/api/chapters/${c.id}`, { ready: true }).then(() => viewPublish(bookId)).catch((e) => toast(e.message, true));
  render(
    h('div.small', h('a', { href: `#/rediger-bog/${bookId}` }, `← ${d.book.title}`)),
    h('div.section-title', h('div', h('h1', scope === 'kapitel' ? 'Udgiv ét kapitel' : 'Udgiv ny version'), h('p.muted', `${d.book.title} · nuværende version ${d.current || 'ingen'}`))),
    h('div.editor-grid',
      h('div.stack',
        h('h2', `Det her ser eleverne efter udgivelsen (${d.changeCount} ændring${d.changeCount === 1 ? '' : 'er'})`),
        d.changes.length ? d.changes.map((c) => h('details.card.change-card', { open: d.changes.length <= 3 },
          h('summary.row', h('strong', c.title), h('span.pill', c.kind)), renderDiff(c.diff))) : h('div.card', h('p.empty', 'Der er ingen ændringer, der er klar til udgivelse.'))),
      h('div.stack.sticky-side',
        scope === 'bog' && d.notReady.length ? h('div.card', h('h2', 'Ikke markeret klar'), h('p.small.muted', 'Disse kapitler har ændringer, men kommer ikke med, før de er markeret klar:'),
          h('ul.list', d.notReady.map((c) => h('li.row', h('a', { href: `#/rediger-kapitel/${c.id}` }, c.title), h('button.btn.ghost.small', { type: 'button', onclick: () => markReady(c) }, 'Markér klar'))))) : null,
        h('div.card.form', h('h2', 'Version'), radios, h('label', 'Udgivelsesnoter til eleverne', notes), btn))));
}

// ---------- Kapitel-editor ----------
const MD_TOOLS = [
  ['H2', 'Overskrift', '\n## ', ''], ['H3', 'Underoverskrift', '\n### ', ''], ['B', 'Fed', '**', '**'], ['I', 'Kursiv', '*', '*'],
  ['•', 'Punktliste', '\n- ', ''], ['1.', 'Nummereret liste', '\n1. ', ''], ['❝', 'Citat / huskeregel', '\n> ', ''],
  ['Tabel', 'Tabel', '\n| Kolonne 1 | Kolonne 2 |\n|---|---|\n| ', ' |  |\n'], ['Link', 'Link', '[', '](https://)'], ['Billede', 'Billede (adresse)', '![Beskrivelse](', 'https://)'],
];
async function viewChapterEditor(chapterId) {
  loading();
  const [c, refsList] = await Promise.all([api('GET', `/api/chapters/${chapterId}`), api('GET', '/api/references')]);
  let saved = { title: c.title, content: c.content };
  let refs = c.refs, ready = c.ready;
  const titleIn = h('input.title-input', { value: c.title, 'aria-label': 'Kapitlets titel', required: true });
  const ta = h('textarea.md-input', { value: c.content, spellcheck: true, 'aria-label': 'Kapitlets tekst' });
  const preview = h('div.md-preview');
  const status = h('span.save-status.small');
  const counter = h('span.small.muted');
  const dirty = () => titleIn.value !== saved.title || ta.value !== saved.content;
  const tokenKey = (t) => (t.match(/\{\{(fakta|formel|kilde):[A-Za-z0-9_-]+\}\}/g) || []).sort().join('|');
  let lastTokens = tokenKey(c.content);

  async function refresh() {
    const tk = tokenKey(ta.value);
    if (tk !== lastTokens) { lastTokens = tk; try { refs = await api('POST', '/api/references/resolve', { content: ta.value }); } catch (e) { /* behold gamle */ } }
    setKids(preview, h('h1', titleIn.value || 'Uden titel'), renderDoc(ta.value, refs, { teacher: true }));
    const w = wordsIn(ta.value);
    counter.textContent = `${w} ord · ca. ${readMinutes(w)} min. læsning`;
    status.textContent = dirty() ? '● Ikke gemt' : `Gemt ${fmtDateTime(c.updatedAt)}`;
    status.classList.toggle('unsaved', dirty());
  }
  let t;
  const schedule = () => { clearTimeout(t); t = setTimeout(refresh, 250); };
  ta.addEventListener('input', schedule); titleIn.addEventListener('input', schedule);

  async function save(extra = {}, quiet = false) {
    try {
      const r = await api('PUT', `/api/chapters/${c.id}`, { title: titleIn.value, content: ta.value, ...extra });
      saved = { title: titleIn.value, content: ta.value }; c.updatedAt = r.updatedAt; ready = r.ready; c.status = r.status;
      if (!quiet) toast('Kapitlet er gemt');
      refresh(); drawState(); loadHistory();
      return true;
    } catch (e) { toast(e.message, true); return false; }
  }
  const insert = (before, after = '') => {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
    ta.setRangeText(before + sel + after, s, e, 'end');
    if (!sel && after) ta.setSelectionRange(s + before.length, s + before.length);
    ta.focus(); schedule();
  };
  ta.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); save(); }
    if ((e.ctrlKey || e.metaKey) && k === 'b') { e.preventDefault(); insert('**', '**'); }
    if ((e.ctrlKey || e.metaKey) && k === 'i') { e.preventDefault(); insert('*', '*'); }
  });

  // Indsæt henvisninger: central oplysning, formel eller retskilde
  const picker = h('div.ref-picker', { hidden: true });
  function openPicker(kind) {
    const items = kind === 'fakta' ? refsList.facts.map((f) => [f.key, f.label, `${f.value} ${f.unit || ''}`])
      : kind === 'formel' ? refsList.formulas.map((f) => [f.key, f.name, f.category])
        : refsList.provisions.map((p) => [p.key, `${p.source} ${p.ref}`, p.title]);
    const filter = h('input', { placeholder: 'Søg …', 'aria-label': 'Søg' });
    const list = h('ul.list.pick-list');
    const draw = () => setKids(list, ...items.filter((i) => i.join(' ').toLowerCase().includes(filter.value.toLowerCase())).map(([key, a, b]) =>
      h('li', h('button.pick', { type: 'button', onclick: () => { insert(`{{${kind}:${key}}}`); picker.hidden = true; } }, h('strong', a), h('span.small.muted', b)))));
    filter.addEventListener('input', draw); draw();
    setKids(picker, h('div.row', h('strong', { fakta: 'Indsæt central oplysning', formel: 'Indsæt formel (beregner)', kilde: 'Indsæt retskilde' }[kind]),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Luk', onclick: () => { picker.hidden = true; } }, icon('x', 16))),
    h('p.small.muted', kind === 'fakta' ? 'Værdien hentes fra ét sted. Ret den under Centrale oplysninger, så opdateres den overalt.' : kind === 'formel' ? 'Formlen vises som en beregner for eleverne og opdateres, når du retter den i formelbiblioteket.' : 'Henvisningen viser bestemmelsens ordlyd og bruges til at finde berørte kapitler ved lovændringer.'),
    filter, list);
    picker.hidden = false; filter.focus();
  }
  const toolbar = h('div.md-toolbar', { role: 'toolbar', 'aria-label': 'Formatering' },
    MD_TOOLS.map(([label, title, before, after]) => h('button', { type: 'button', title, 'aria-label': title, onclick: () => insert(before, after) }, label)),
    h('span.tool-sep'),
    h('button.ins', { type: 'button', onclick: () => openPicker('fakta') }, icon('checks', 14), ' Oplysning'),
    h('button.ins', { type: 'button', onclick: () => openPicker('formel') }, icon('sigma', 14), ' Formel'),
    h('button.ins', { type: 'button', onclick: () => openPicker('kilde') }, icon('scale', 14), ' Retskilde'),
    h('button.ins.ai', { type: 'button', title: 'Få et forslag til en mere forståelig formulering af det markerede afsnit', onclick: explainSelection }, icon('sparkles', 14), ' Forklar enklere'));

  // AI: forklar det markerede mere forståeligt – vises som forslag, underviseren beslutter
  const aiBox = h('div.ai-box', { hidden: true });
  async function explainSelection() {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const text = (ta.value.slice(s, e) || '').trim();
    if (text.length < 20) { toast('Markér det afsnit, der skal forklares enklere (mindst en sætning).', true); return; }
    aiBox.hidden = false;
    setKids(aiBox, h('div.row', h('strong', icon('sparkles', 16), ' AI-forslag'), h('span.small.muted', 'Tænker …')));
    try {
      const r = await aiRun('forklar', { text });
      setKids(aiBox, 
        h('div.row', h('strong', icon('sparkles', 16), ' AI-forslag – gennemlæs før du bruger det'), h('button.icon-btn', { type: 'button', 'aria-label': 'Luk', onclick: () => { aiBox.hidden = true; } }, icon('x', 16))),
        r.note ? h('p.small.muted', r.note) : null,
        renderDiff(PortalDiff.diffText(text, r.text), { context: 3 }),
        h('div.actions',
          h('button.btn.small', { type: 'button', onclick: () => { if (ta.value.slice(s, e).trim() !== text) { toast('Teksten er ændret siden – markér afsnittet igen.', true); return; } ta.setRangeText(r.text, s, e, 'select'); schedule(); aiBox.hidden = true; toast('Forslaget er indsat – husk at gemme'); } }, 'Erstat det markerede'),
          h('button.btn.ghost.small', { type: 'button', onclick: () => { aiBox.hidden = true; } }, 'Kassér')));
    } catch (err) { setKids(aiBox, h('p.error', err.message)); }
  }

  const stateBox = h('div.chapter-state');
  function drawState() {
    setKids(stateBox, statusPill(c.status), c.publishedVersion ? h('span.small.muted', `Eleverne ser versionen fra ${c.publishedVersion}`) : h('span.small.muted', 'Ikke udgivet endnu'),
      h('label.ready-toggle', h('input', { type: 'checkbox', checked: ready, onchange: (e) => save({ ready: e.target.checked }, true).then(() => toast(e.target.checked ? 'Markeret klar til næste udgivelse' : 'Ikke længere markeret klar')) }), 'Klar til udgivelse'));
  }
  const parentSel = h('select', { 'aria-label': 'Placering', onchange: (e) => save({ parentId: e.target.value }, true).then(() => toast('Placeringen er ændret')) },
    h('option', { value: '' }, 'Hovedkapitel'), c.parents.map((p) => h('option', { value: p.id, selected: c.parentId === p.id }, `Underkapitel af “${p.title}”`)));

  const split = h('div.md-split', { class: 'show-write' }, h('div.md-pane', toolbar, picker, aiBox, ta), h('div.md-pane.preview-pane', preview));
  const modeTabs = h('div.tabs.mode-tabs', [['write', 'Skriv'], ['preview', 'Forhåndsvis']].map(([k, label]) => h('button', {
    type: 'button', class: k === 'write' ? 'active' : '',
    onclick: (e) => { split.classList.toggle('show-write', k === 'write'); split.classList.toggle('show-preview', k === 'preview'); modeTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === e.currentTarget)); },
  }, label)));

  const historyHolder = h('div');
  const historyView = h('div');
  async function loadHistory() {
    const fresh = await api('GET', `/api/chapters/${c.id}`).catch(() => null);
    const revs = fresh ? fresh.revisions : c.revisions;
    setKids(historyHolder, h('details.card.history', { open: !!historyHolder.querySelector('details[open]') },
      h('summary', icon('history', 16), ` Versionshistorik (${revs.length})`),
      revs.length ? h('ul.list', revs.map((r) => {
        let armed = false;
        const restore = h('button.btn.small.ghost', { type: 'button', onclick: async () => {
          if (!armed) { armed = true; restore.textContent = 'Klik igen for at gendanne'; return; }
          if (dirty()) await save({}, true);
          try { await api('POST', `/api/chapters/${c.id}/restore/${r.index}`); toast('Versionen er gendannet'); viewChapterEditor(c.id); } catch (e) { toast(e.message, true); }
        } }, 'Gendan');
        return h('li.row', h('div', h('strong', fmtDateTime(r.savedAt)), h('div.small.muted', `${r.savedBy} · ${r.words} ord${r.why ? ' · ' + r.why : ''}`)),
          h('div.actions', h('button.btn.small.ghost', { type: 'button', onclick: async () => {
            const v = await api('GET', `/api/chapters/${c.id}/revisions/${r.index}`);
            setKids(historyView, h('div.card', h('div.row', h('strong', `Forskel fra versionen ${fmtDateTime(v.savedAt)} til nu`), h('button.btn.ghost.small', { type: 'button', onclick: () => setKids(historyView, ) }, 'Luk')), renderDiff(v.diff, { context: 2 })));
          } }, 'Sammenlign'), restore));
      })) : h('p.empty.small', 'Hver gang du gemmer en ændring, gemmes den forrige version her.'), historyView));
  }

  render(
    h('div.small', h('a', { href: `#/rediger-bog/${c.bookId}` }, `← ${c.bookTitle}`)),
    h('div.editor-head',
      titleIn,
      h('div.actions', status,
        c.publishedVersion ? h('a.btn.ghost', { href: `#/bog/${c.bookId}/${c.id}`, onclick: async (e) => { if (dirty()) { e.preventDefault(); if (await save({}, true)) location.hash = `#/bog/${c.bookId}/${c.id}`; } } }, icon('eye', 18), 'Udgivet version') : null,
        h('button.btn.ghost', { type: 'button', onclick: () => save() }, 'Gem'),
        h('button.btn.accent', { type: 'button', onclick: async () => { if (await save({}, true)) location.hash = `#/udgiv/${c.bookId}?kapitel=${c.id}`; } }, icon('rocket', 18), 'Udgiv kun dette kapitel'))),
    h('div.row.chapter-meta', stateBox, parentSel),
    modeTabs, split,
    h('div.row.editor-foot', counter, h('span.small.muted', 'Ctrl/⌘+S gemmer · Ændringer gemmes automatisk, når du forlader siden · Eleverne ser intet, før du udgiver')),
    historyHolder);
  drawState(); refresh(); loadHistory();
  const leave = () => { window.removeEventListener('hashchange', leave); if (dirty()) save({}, true); };
  window.addEventListener('hashchange', leave);
}

// ---------- Import af PDF, Word og tekst ----------
function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  const inline = (n) => [...n.childNodes].map((x) => x.nodeType === 3 ? x.nodeValue : x.nodeName === 'STRONG' || x.nodeName === 'B' ? `**${inline(x)}**` : x.nodeName === 'EM' || x.nodeName === 'I' ? `*${inline(x)}*` : inline(x)).join('');
  for (const el of doc.body.children) {
    const t = el.nodeName;
    if (/^H[1-6]$/.test(t)) out.push('#'.repeat(Math.min(Number(t[1]), 3)) + ' ' + el.textContent.trim());
    else if (t === 'UL' || t === 'OL') out.push([...el.children].map((li, i) => (t === 'OL' ? `${i + 1}. ` : '- ') + inline(li).trim()).join('\n'));
    else if (t === 'TABLE') {
      const rows = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim().replace(/\|/g, '/')));
      if (rows.length) out.push([`| ${rows[0].join(' | ')} |`, `|${rows[0].map(() => '---').join('|')}|`, ...rows.slice(1).map((r) => `| ${r.join(' | ')} |`)].join('\n'));
    } else { const s = inline(el).trim(); if (s) out.push(s); }
  }
  return out.join('\n\n');
}
async function extractText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) {
    await loadScript(LIB.mammoth);
    const r = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToMarkdown(r.value);
  }
  if (name.endsWith('.pdf')) {
    await loadScript(LIB.pdfjs);
    const lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = LIB.pdfworker;
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      // Saml tekststumper til linjer ud fra deres lodrette position
      const lines = []; let y = null, cur = '';
      for (const it of tc.items) {
        const ny = it.transform ? Math.round(it.transform[5]) : y;
        if (y !== null && ny !== y) { lines.push(cur.trim()); cur = ''; }
        cur += it.str + (it.hasEOL ? '' : ''); y = ny;
      }
      if (cur.trim()) lines.push(cur.trim());
      pages.push(lines.join('\n'));
    }
    return pages.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  }
  return file.text();
}
// Del teksten i kapitler ud fra overskrifter (markdown, nummererede eller "Kapitel 3")
function splitChapters(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const isHeading = (l) => {
    const s = l.trim();
    if (!s || s.length > 90) return null;
    let m;
    if ((m = /^(#{1,3})\s+(.+)$/.exec(s))) return { level: m[1].length >= 2 && /^#{2}/.test(s) && lines.some((x) => /^#\s/.test(x.trim())) ? 2 : 1, title: m[2] };
    if ((m = /^(kapitel|afsnit)\s+(\d+)[.:]?\s*(.*)$/i.exec(s))) return { level: 1, title: s };
    if ((m = /^(\d+)\.(\d+)\.?\s+([A-ZÆØÅ].{2,})$/.exec(s))) return { level: 2, title: s };
    if ((m = /^(\d+)\.?\s+([A-ZÆØÅ][^.!?]{2,})$/.exec(s)) && !/[.,;:]$/.test(s)) return { level: 1, title: s };
    if (/^[A-ZÆØÅ0-9][A-ZÆØÅ0-9 ,\-–]{4,60}$/.test(s) && /[A-ZÆØÅ]{3}/.test(s)) return { level: 1, title: s.charAt(0) + s.slice(1).toLowerCase() };
    return null;
  };
  const chapters = []; let cur = null;
  for (const l of lines) {
    const hd = isHeading(l);
    if (hd) { cur = { title: hd.title.replace(/^#+\s*/, ''), level: hd.level, lines: [] }; chapters.push(cur); continue; }
    if (!cur) { cur = { title: 'Indledning', level: 1, lines: [] }; chapters.push(cur); }
    cur.lines.push(l);
  }
  return chapters.map((c) => ({ title: c.title.slice(0, 200), level: c.level, content: c.lines.join('\n').trim(), include: true })).filter((c) => c.content || c.title);
}
// Find henvisninger i importeret tekst, som bør kobles til retskilder og formler
function detectRefs(text) {
  const rules = (text.match(/\bregel\s+\d+/gi) || []).length;
  const paragraphs = (text.match(/§\s*\d+/g) || []).length;
  const conventions = (text.match(/\b(SOLAS|MARPOL|STCW|COLREG|ISM|ISPS|MLC)\b/g) || []).length;
  const formulas = (text.split('\n').filter((l) => /^[A-Za-zΔθ][\w₀-₉]*\s*=\s*[^=]+$/.test(l.trim()) && l.length < 80)).length;
  return { rules, paragraphs, conventions, formulas };
}
async function viewImport(bookId) {
  const b = await api('GET', `/api/books/${bookId}`);
  const fileIn = h('input', { type: 'file', accept: '.pdf,.docx,.txt,.md', 'aria-label': 'Vælg fil' });
  const paste = h('textarea', { rows: 6, placeholder: 'Eller indsæt tekst her (fx kopieret fra en PDF) …' });
  const result = h('div.stack');
  let fileName = '';
  async function analyse(text) {
    const chapters = splitChapters(text);
    const refs = detectRefs(text);
    setKids(result, 
      h('div.card.notice.info', icon('file', 18), h('div', h('strong', `${chapters.length} kapitler fundet i ${fileName || 'teksten'}`),
        h('div.small', `${refs.paragraphs} paragrafhenvisninger · ${refs.rules} regelhenvisninger · ${refs.conventions} konventionsnavne · ${refs.formulas} mulige formler. `,
          'Efter importen kan du koble dem til retskilder og formelbiblioteket, så de fremover opdateres automatisk.'))),
      h('div.card', h('h2', 'Gennemse kapitlerne'), h('p.small.muted', 'Ret titler, vælg niveau, og fravælg det, der ikke skal med. Alt importeres som kladder – eleverne ser intet, før du udgiver.'),
        h('ol.import-list', chapters.map((c) => h('li.import-row',
          h('input', { type: 'checkbox', checked: c.include, 'aria-label': 'Medtag', onchange: (e) => { c.include = e.target.checked; } }),
          h('input', { value: c.title, 'aria-label': 'Titel', oninput: (e) => { c.title = e.target.value; } }),
          h('select', { 'aria-label': 'Niveau', onchange: (e) => { c.level = Number(e.target.value); } }, h('option', { value: 1, selected: c.level === 1 }, 'Kapitel'), h('option', { value: 2, selected: c.level === 2 }, 'Underkapitel')),
          h('span.small.muted', `${wordsIn(c.content)} ord`)))),
        h('div.actions', h('button.btn.accent', { type: 'button', onclick: async () => {
          const list = chapters.filter((c) => c.include && c.title.trim());
          try { const r = await api('POST', `/api/books/${bookId}/import`, { fileName, chapters: list }); toast(`${r.created} kapitler er importeret som kladder`); location.hash = `#/rediger-bog/${bookId}`; }
          catch (e) { toast(e.message, true); }
        } }, icon('upload', 18), 'Importér som kladder'))));
  }
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    fileName = f.name;
    setKids(result, h('div.card', h('p.muted', `Læser ${f.name} …`)));
    try { analyse(await extractText(f)); } catch (e) { setKids(result, h('div.card', h('p.error', `Kunne ikke læse filen: ${e.message}. Prøv at kopiere teksten ind i feltet i stedet.`))); }
  });
  render(
    h('div.small', h('a', { href: `#/rediger-bog/${bookId}` }, `← ${b.title}`)),
    h('div.section-title', h('div', h('h1', 'Importér dokument'), h('p.muted', 'Hent dit eksisterende materiale ind fra PDF, Word (.docx) eller tekst. Systemet deler det i kapitler ud fra overskrifterne.'))),
    h('div.card.form', h('label', 'Fil (PDF, Word eller tekst)', fileIn), paste,
      h('div.actions', h('button.btn.ghost', { type: 'button', onclick: () => { fileName = 'indsat tekst'; if (paste.value.trim()) analyse(paste.value); } }, 'Analysér den indsatte tekst'))),
    result);
}

// ---------- Eksport til PDF ----------
// PDF'en bygges i browseren med jsPDF ud fra den udgivne version (eller kladden).
const PDF_MAP = { 'Δ': 'Delta', 'θ': 'theta', 'ρ': 'rho', 'λ': 'lambda', 'φ': 'phi', 'μ': 'my', '₀': '0', '₁': '1', '₂': '2', '−': '-', '·': '*', '≤': '<=', '≥': '>=', '√': 'sqrt', '→': '->', '←': '<-', '❝': '"', '✔': '', '⋯': '...', ' ': ' ' };
const pdfSafe = (s) => String(s).replace(/[^\x20-\x7e -ÿ–—‘’“”…€\n]/g, (c) => (PDF_MAP[c] != null ? PDF_MAP[c] : ''));
async function exportPdf(bookId, opts = {}) {
  toast('Laver PDF …');
  try {
    const qs = opts.draft ? '?draft=1' : opts.edition ? `?edition=${opts.edition}` : '';
    const [d] = await Promise.all([api('GET', `/api/books/${bookId}/export${qs}`), loadScript(LIB.jspdf)]);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 20, CW = W - 2 * M, BOTTOM = 280;
    let y = M;
    const page = () => { doc.addPage(); y = M + 6; };
    const need = (hgt) => { if (y + hgt > BOTTOM) page(); };
    const text = (s, size = 10.5, style = 'normal', indent = 0, gap = 1.6) => {
      doc.setFont('helvetica', style); doc.setFontSize(size);
      for (const line of doc.splitTextToSize(pdfSafe(s), CW - indent)) { need(size * 0.45); doc.text(line, M + indent, y); y += size * 0.45; }
      y += gap;
    };
    // Forside
    doc.setFillColor(11, 46, 79); doc.rect(0, 0, W, 90, 'F');
    doc.setTextColor(242, 193, 78); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(pdfSafe('MARSTAL NAVIGATIONSSKOLE · ' + (d.subject || '').toUpperCase()), M, 30);
    doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.text(doc.splitTextToSize(pdfSafe(d.title), CW), M, 50);
    doc.setTextColor(30, 40, 50); doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    y = 110; if (d.description) text(d.description, 12);
    text(`${d.label} · ${d.author}`, 10, 'normal'); text(`Udskrevet ${new Date().toLocaleDateString('da-DK')}`, 9);
    // Indholdsfortegnelse
    page(); text('Indhold', 18, 'bold', 0, 4);
    for (const c of d.chapters) text(`${c.number}  ${c.title}`, 11, c.parentId ? 'normal' : 'bold', c.parentId ? 8 : 0, 0.8);
    // Kapitler
    const formulaLines = (f) => {
      let expr = f.expression; try { expr = PortalFormula.show(PortalFormula.parse(f.expression), (n) => (f.variables.find((v) => v.symbol === n) || {}).display || n); } catch (e) { /* rå */ }
      return [`${f.result.display || f.result.symbol} = ${expr}`, ...f.variables.map((v) => `   ${v.display || v.symbol}: ${v.label || ''}${v.unit ? ' [' + v.unit + ']' : ''}`)];
    };
    const sourcesUsed = new Map();
    for (const c of d.chapters) {
      page();
      text(`${c.number}  ${c.title}`, c.parentId ? 15 : 18, 'bold', 0, 3);
      const resolved = c.content.replace(/\{\{(fakta|formel|kilde):([A-Za-z0-9_-]+)\}\}/g, (all, kind, key) => {
        if (kind === 'fakta') { const f = d.refs.facts[key]; return f ? `${f.value}${f.unit ? ' ' + f.unit : ''}` : all; }
        if (kind === 'kilde') { const s = d.refs.sources[key]; if (s) sourcesUsed.set(key, s); return s ? `(${s.source} ${s.ref})` : all; }
        return `\n\n@@FORMEL:${key}@@\n\n`;
      });
      const el = md(resolved);
      for (const node of el.children) {
        const tag = node.nodeName;
        const fm = /^@@FORMEL:([\w-]+)@@$/.exec(node.textContent.trim());
        if (fm) {
          const f = d.refs.formulas[fm[1]]; if (!f) continue;
          const lines = formulaLines(f);
          need(8 + lines.length * 5);
          doc.setDrawColor(19, 74, 122); doc.setFillColor(238, 244, 250);
          doc.roundedRect(M, y - 4, CW, 7 + lines.length * 5, 2, 2, 'FD');
          text(`Formel: ${f.name}`, 10.5, 'bold', 3, 0.5);
          lines.forEach((l, i) => text(l, i ? 9.5 : 11, i ? 'normal' : 'bold', 3, 0.3));
          y += 4; continue;
        }
        if (/^H[2-5]$/.test(tag)) { y += 2; text(node.textContent, tag === 'H2' ? 14 : 12, 'bold', 0, 1.5); }
        else if (tag === 'UL' || tag === 'OL') [...node.children].forEach((li, i) => text(`${tag === 'OL' ? i + 1 + '.' : '•'}  ${li.textContent}`, 10.5, 'normal', 4, 0.8));
        else if (tag === 'BLOCKQUOTE') { doc.setDrawColor(242, 193, 78); doc.setLineWidth(1); const y0 = y - 3; text(node.textContent, 10.5, 'italic', 5, 1); doc.line(M + 1, y0, M + 1, y - 2); doc.setLineWidth(0.2); }
        else if (tag === 'PRE') text(node.textContent, 9.5, 'normal', 4);
        else if (tag === 'HR') { need(4); doc.line(M, y, W - M, y); y += 4; }
        else if (node.querySelector && node.querySelector('table')) {
          for (const tr of node.querySelectorAll('tr')) { const cells = [...tr.children].map((td) => td.textContent.trim()); text(cells.join('   |   '), 10, tr.parentNode.nodeName === 'THEAD' ? 'bold' : 'normal', 2, 0.6); }
          y += 2;
        } else text(node.textContent, 10.5);
      }
    }
    if (sourcesUsed.size) {
      page(); text('Retskilder', 18, 'bold', 0, 4);
      for (const s of sourcesUsed.values()) { text(`${s.source} ${s.ref}${s.title ? ' – ' + s.title : ''}`, 11, 'bold', 0, 0.5); text(s.text, 10); if (s.url) text(s.url, 8.5); }
    }
    // Sidehoved og -fod
    const n = doc.getNumberOfPages();
    for (let i = 2; i <= n; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 120, 130);
      doc.text(pdfSafe(`${d.title} · ${d.label}`), M, 12); doc.text(`Side ${i} af ${n}`, W - M, 290, { align: 'right' }); doc.text('Marstal Navigationsskole', M, 290);
      doc.setTextColor(30, 40, 50);
    }
    const filename = `${d.title.replace(/[^\wæøåÆØÅ -]+/g, '').trim() || 'bog'} ${opts.draft ? 'kladde' : d.label.split(' ·')[0]}.pdf`;
    const blob = doc.output('blob');
    await offerDownload(filename, blob);
  } catch (e) { toast(e.message, true); }
}
// Gem en fil: i demoen via Claude-visningens download-funktion, ellers som et almindeligt link
async function offerDownload(filename, blob) {
  if (window.PORTAL_DEMO && window.claude && window.claude.use) {
    const dl = await window.claude.use('downloads');
    if (!dl) throw new Error('Download er ikke tilgængelig i denne visning');
    try { await dl.save({ filename, data: blob }); toast('PDF er gemt'); }
    catch (e) { if (e.code !== 'declined') throw new Error('Kunne ikke gemme filen (' + (e.code || 'fejl') + ')'); }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('PDF er hentet');
}
