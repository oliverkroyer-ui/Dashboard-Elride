// Lærebøger: bibliotek, læser og editor (lærere skriver og vedligeholder bøgerne).
'use strict';

const wordsIn = (s) => (String(s).match(/\S+/g) || []).length;
const readMinutes = (words) => Math.max(1, Math.round(words / 180));
function progressBar(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = h('div.progress', { role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span'));
  bar.firstChild.style.setProperty('width', pct + '%');
  return bar;
}
const statusPill = (published) => (published ? h('span.pill.ok', 'Udgivet') : h('span.pill.warn', 'Kladde'));

// Bogomslag til bibliotek og fagside
function bookCover(b) {
  const meta = isTeacher()
    ? [statusPill(b.published), h('span.pill', `${b.chapterCount} kapitler`), b.draftChapters ? h('span.pill.warn', `${b.draftChapters} kladder`) : null]
    : [h('span.pill', `${b.readCount}/${b.chapterCount} læst`)];
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
      h('a.btn.ghost.small', { href: `#/bog/${b.id}` }, icon('eye', 16), 'Læs')) : null);
}

function newBookForm(subjects, presetSubjectId) {
  return creator('Ny lærebog', [
    h('label', 'Fag', h('select', { name: 'subjectId', required: true },
      subjects.map((s) => h('option', { value: s.id, selected: s.id === presetSubjectId }, `${s.code} · ${s.name}`)))),
    h('label', 'Titel', h('input', { name: 'title', required: true, placeholder: 'f.eks. Radar og ARPA' })),
    h('label', 'Kort beskrivelse', h('textarea', { name: 'description', rows: 2 })),
  ], async (data) => {
    const b = await api('POST', `/api/subjects/${data.subjectId}/books`, data);
    location.hash = `#/rediger-bog/${b.id}`;
  }, 'Lærebogen er oprettet – tilføj det første kapitel');
}

// ---------- Bibliotek ----------
async function viewLibrary() {
  loading();
  const [{ books }, d] = await Promise.all([api('GET', '/api/books'), api('GET', '/api/dashboard')]);
  render(
    h('div.section-title', h('div', h('h1', 'Lærebøger'),
      h('p.muted', isTeacher() ? 'Skriv, opdatér og udgiv bøgerne til dine fag. Eleverne ser kun det, du har udgivet.' : 'Bøgerne til dine fag. Markér kapitler som læst, så du kan følge med i din fremgang.'))),
    isTeacher() ? newBookForm(d.subjects) : null,
    books.length ? h('div.grid.books', books.map(bookCover)) : h('div.card', h('p.empty', isTeacher() ? 'Ingen lærebøger endnu – opret den første ovenfor.' : 'Dine lærere har ikke udgivet nogen lærebøger endnu.')));
}

// ---------- Læser ----------
async function viewBook(bookId, chapterId) {
  loading();
  const b = await api('GET', `/api/books/${bookId}`);
  const chapter = chapterId ? await api('GET', `/api/chapters/${chapterId}`) : null;
  const done = b.chapters.filter((c) => c.read).length;

  const toc = h('nav.card.toc',
    h('a.small', { href: '#/boeger' }, '← Alle lærebøger'),
    h('h2', b.title),
    !isTeacher() ? [h('div.small.muted', `${done} af ${b.chapters.length} kapitler læst`), progressBar(done, b.chapters.length)] : statusPill(b.published),
    b.chapters.length ? h('ol.toc-list', b.chapters.map((c) => h('li', { class: chapter && chapter.id === c.id ? 'current' : '' },
      h('a', { href: `#/bog/${b.id}/${c.id}` },
        h('span', c.title),
        c.read ? h('span.toc-check', { title: 'Læst' }, icon('check', 16)) : null,
        isTeacher() && !c.published ? h('span.pill.warn', 'Kladde') : null))))
      : h('p.empty.small', 'Ingen kapitler endnu.'),
    isTeacher() ? h('a.btn.small', { href: `#/rediger-bog/${b.id}` }, icon('pencil', 16), 'Redigér bogen') : null);

  let main;
  if (!chapter) {
    const first = b.chapters[0];
    const nextUnread = b.chapters.find((c) => !c.read) || first;
    main = h('article.card.reader',
      h('div.code', b.subjectCode, ' · ', b.subjectName),
      h('h1', b.title),
      b.description ? h('p.lead', b.description) : null,
      h('p.small.muted', `${b.chapters.length} kapitler · ${readMinutes(b.chapters.reduce((n, c) => n + c.words, 0))} min. læsning · af ${b.author}`),
      first ? h('div.actions', h('a.btn', { href: `#/bog/${b.id}/${(isTeacher() ? first : nextUnread).id}` }, icon('book', 18),
        !isTeacher() && done && done < b.chapters.length ? 'Fortsæt læsning' : 'Start læsning')) : null);
  } else {
    const readBtn = !isTeacher() ? h('button.btn', {
      type: 'button', class: chapter.read ? 'ghost' : '',
      onclick: async () => {
        try {
          await api('POST', `/api/chapters/${chapter.id}/read`, { read: !chapter.read });
          if (!chapter.read && chapter.next) location.hash = `#/bog/${b.id}/${chapter.next.id}`;
          else viewBook(b.id, chapter.id);
          toast(chapter.read ? 'Markeret som ikke læst' : 'Kapitlet er markeret som læst');
        } catch (e) { toast(e.message, true); }
      },
    }, icon('check', 18), chapter.read ? 'Læst – fortryd' : chapter.next ? 'Markér som læst og gå videre' : 'Markér som læst') : null;
    main = h('article.card.reader', { accent: chapter.color },
      h('div.row', h('div.small.muted', `Kapitel ${chapter.number} af ${chapter.total}`),
        isTeacher() ? h('div.actions', statusPill(chapter.published), h('a.btn.small', { href: `#/rediger-kapitel/${chapter.id}` }, icon('pencil', 16), 'Redigér kapitel')) : null),
      h('h1', chapter.title),
      h('p.small.muted', `${readMinutes(wordsIn(chapter.content))} min. læsning · opdateret ${fmtDate(chapter.updatedAt)} af ${chapter.updatedBy}`),
      md(chapter.content),
      h('div.reader-nav',
        chapter.prev ? h('a.btn.ghost', { href: `#/bog/${b.id}/${chapter.prev.id}` }, '← ', chapter.prev.title) : h('span'),
        readBtn,
        chapter.next ? h('a.btn.ghost', { href: `#/bog/${b.id}/${chapter.next.id}` }, chapter.next.title, ' →') : h('span')));
  }
  render(h('div.reader-layout', { accent: b.color }, toc, main));
}

// ---------- Bog-editor (lærer) ----------
async function viewBookEditor(bookId) {
  loading();
  const b = await api('GET', `/api/books/${bookId}`);
  const reload = () => viewBookEditor(bookId);

  const meta = submitForm(h('form.form',
    h('label', 'Titel', h('input', { name: 'title', required: true, value: b.title })),
    h('label', 'Beskrivelse', h('textarea', { name: 'description', rows: 3, value: b.description || '' })),
    h('div.actions', h('button.btn', { type: 'submit' }, 'Gem bogens oplysninger'))),
  (data) => api('PUT', `/api/books/${b.id}`, data).then(reload), 'Bogen er gemt');

  const publishBtn = h('button.btn', {
    type: 'button', class: b.published ? 'ghost' : '',
    onclick: async () => {
      try { await api('PUT', `/api/books/${b.id}`, { published: !b.published }); toast(b.published ? 'Bogen er nu en kladde' : 'Bogen er udgivet til eleverne'); reload(); }
      catch (e) { toast(e.message, true); }
    },
  }, b.published ? 'Træk tilbage (gør til kladde)' : 'Udgiv bogen');

  const move = (c, dir) => api('POST', `/api/chapters/${c.id}/move`, { dir }).then(reload).catch((e) => toast(e.message, true));
  const chapterList = b.chapters.length ? h('ol.chapter-list', b.chapters.map((c, i) => h('li',
    h('div.chapter-row',
      h('div.chapter-order',
        h('button.icon-btn', { type: 'button', title: 'Flyt op', 'aria-label': 'Flyt op', disabled: i === 0, onclick: () => move(c, -1) }, icon('up', 16)),
        h('button.icon-btn', { type: 'button', title: 'Flyt ned', 'aria-label': 'Flyt ned', disabled: i === b.chapters.length - 1, onclick: () => move(c, 1) }, icon('down', 16))),
      h('div.chapter-info',
        h('a', { href: `#/rediger-kapitel/${c.id}` }, h('strong', `${i + 1}. ${c.title}`)),
        h('div.small.muted', `${c.words} ord · opdateret ${fmtDateTime(c.updatedAt)}`)),
      statusPill(c.published),
      h('div.actions',
        h('a.btn.small', { href: `#/rediger-kapitel/${c.id}` }, icon('pencil', 16), 'Skriv'),
        deleteBtn(`/api/chapters/${c.id}`, reload)))))) : h('p.empty', 'Bogen har ingen kapitler endnu.');

  const addChapter = submitForm(h('form.form.inline-form',
    h('input', { name: 'title', required: true, placeholder: 'Titel på nyt kapitel', 'aria-label': 'Titel på nyt kapitel' }),
    h('button.btn', { type: 'submit' }, icon('plus', 18), 'Tilføj kapitel')),
  async (data) => { const c = await api('POST', `/api/books/${b.id}/chapters`, data); location.hash = `#/rediger-kapitel/${c.id}`; }, 'Kapitlet er oprettet');

  render(
    h('div.small', h('a', { href: '#/studio' }, '← Lærerstudio'), ' · ', h('a', { href: '#/boeger' }, 'Lærebøger')),
    h('div.section-title', h('div', h('div.code', { accent: b.color }, b.subjectCode, ' · ', b.subjectName), h('h1', b.title)),
      h('div.actions', statusPill(b.published), h('a.btn.ghost', { href: `#/bog/${b.id}` }, icon('eye', 18), 'Vis som elev'), publishBtn)),
    h('div.editor-grid',
      h('div.card.stack', h('h2', 'Kapitler'), chapterList, addChapter,
        h('p.small.muted', 'Eleverne ser kun kapitler, der er udgivet, og kun hvis bogen er udgivet.')),
      h('div.stack',
        h('div.card', h('h2', 'Oplysninger'), meta),
        h('div.card.danger-zone', h('h2', 'Slet bogen'), h('p.small.muted', 'Sletter bogen med alle kapitler og elevernes læsestatus.'),
          deleteBtn(`/api/books/${b.id}`, () => { location.hash = '#/boeger'; })))));
}

// ---------- Kapitel-editor (lærer) ----------
const MD_TOOLS = [
  ['H2', 'Overskrift', '\n## ', ''],
  ['H3', 'Underoverskrift', '\n### ', ''],
  ['B', 'Fed', '**', '**'],
  ['I', 'Kursiv', '*', '*'],
  ['•', 'Punktliste', '\n- ', ''],
  ['1.', 'Nummereret liste', '\n1. ', ''],
  ['❝', 'Citat / huskeregel', '\n> ', ''],
  ['{ }', 'Kode / formel', '\n```\n', '\n```\n'],
  ['Tabel', 'Tabel', '\n| Kolonne 1 | Kolonne 2 |\n|---|---|\n| ', ' |  |\n'],
  ['Link', 'Link', '[', '](https://)'],
  ['Billede', 'Billede (URL)', '![Beskrivelse](', 'https://)'],
];

async function viewChapterEditor(chapterId) {
  loading();
  const c = await api('GET', `/api/chapters/${chapterId}`);
  let saved = { title: c.title, content: c.content };
  let published = c.published;

  const titleIn = h('input.title-input', { value: c.title, 'aria-label': 'Kapitlets titel', required: true });
  const ta = h('textarea.md-input', { value: c.content, spellcheck: true, 'aria-label': 'Kapitlets tekst (markdown)' });
  const preview = h('div.md-preview');
  const status = h('span.save-status.small.muted');
  const counter = h('span.small.muted');
  const dirty = () => titleIn.value !== saved.title || ta.value !== saved.content;

  function refresh() {
    preview.replaceChildren(h('h1', titleIn.value || 'Uden titel'), md(ta.value));
    const w = wordsIn(ta.value);
    counter.textContent = `${w} ord · ca. ${readMinutes(w)} min. læsning`;
    status.textContent = dirty() ? '● Ikke gemt' : `Gemt ${fmtDateTime(c.updatedAt)}`;
    status.classList.toggle('unsaved', dirty());
  }
  let t;
  const schedule = () => { clearTimeout(t); t = setTimeout(refresh, 120); };
  ta.addEventListener('input', schedule); titleIn.addEventListener('input', schedule);

  async function save(extra = {}, quiet = false) {
    try {
      const r = await api('PUT', `/api/chapters/${c.id}`, { title: titleIn.value, content: ta.value, ...extra });
      saved = { title: titleIn.value, content: ta.value };
      c.updatedAt = r.updatedAt; published = r.published;
      api('GET', `/api/chapters/${c.id}`).then((fresh) => renderHistory(fresh.revisions, !!revisions.querySelector('details[open]'))).catch(() => {});
      if (!quiet) toast('Kapitlet er gemt');
      refresh(); updatePublish(); return true;
    } catch (e) { toast(e.message, true); return false; }
  }

  const insert = (before, after) => {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
    ta.setRangeText(before + sel + after, s, e, 'end');
    if (!sel) ta.setSelectionRange(s + before.length, s + before.length);
    ta.focus(); schedule();
  };
  const toolbar = h('div.md-toolbar', { role: 'toolbar', 'aria-label': 'Formatering' },
    MD_TOOLS.map(([label, title, before, after]) => h('button', { type: 'button', title, 'aria-label': title, onclick: () => insert(before, after) }, label)));

  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); insert('**', '**'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); insert('*', '*'); }
  });

  const pubBtn = h('button.btn', { type: 'button', onclick: () => save({ published: !published }) });
  const statePill = h('span');
  function updatePublish() {
    pubBtn.textContent = published ? 'Gør til kladde' : 'Gem og udgiv';
    pubBtn.classList.toggle('ghost', published);
    statePill.replaceChildren(statusPill(published));
  }

  // Skift mellem skriv/forhåndsvis på smalle skærme
  const split = h('div.md-split', { class: 'show-write' },
    h('div.md-pane', toolbar, ta),
    h('div.md-pane.preview-pane', preview));
  const modeTabs = h('div.tabs.mode-tabs', [['write', 'Skriv'], ['preview', 'Forhåndsvis']].map(([k, label]) => h('button', {
    type: 'button', class: k === 'write' ? 'active' : '',
    onclick: (e) => {
      split.classList.toggle('show-write', k === 'write'); split.classList.toggle('show-preview', k === 'preview');
      modeTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === e.currentTarget));
    },
  }, label)));

  // Versionshistorik
  const historyBox = h('div.stack');
  const revisions = h('div');
  function renderHistory(revs, open) {
  revisions.replaceChildren(h('details.card.history', { open },
    h('summary', icon('history', 18), ` Versionshistorik (${revs.length})`),
    revs.length ? h('ul.list', revs.map((r) => {
      let armed = false;
      const restore = h('button.btn.small.ghost', {
        type: 'button',
        onclick: async () => {
          if (!armed) { armed = true; restore.textContent = 'Klik igen for at gendanne'; return; }
          if (dirty()) await save({}, true);
          try { await api('POST', `/api/chapters/${c.id}/restore/${r.index}`); toast('Versionen er gendannet'); viewChapterEditor(c.id); }
          catch (e) { toast(e.message, true); }
        },
      }, 'Gendan');
      return h('li', h('div.row',
        h('div', h('strong', fmtDateTime(r.savedAt)), h('div.small.muted', `${r.savedBy} · ${r.words} ord · “${r.title}”`)),
        h('div.actions',
          h('button.btn.small.ghost', {
            type: 'button',
            onclick: async () => {
              const v = await api('GET', `/api/chapters/${c.id}/revisions/${r.index}`);
              historyBox.replaceChildren(h('div.card.revision-view', h('div.row', h('strong', `Version fra ${fmtDateTime(v.savedAt)}`),
                h('button.btn.small.ghost', { type: 'button', onclick: () => historyBox.replaceChildren() }, 'Luk')), h('h2', v.title), md(v.content)));
            },
          }, 'Vis'),
          restore)));
    })) : h('p.empty.small', 'Ingen tidligere versioner endnu. Hver gang du gemmer en ændring, gemmes den forrige version her.'),
    historyBox));
  }
  renderHistory(c.revisions, false);

  render(
    h('div.small', h('a', { href: `#/rediger-bog/${c.bookId}` }, `← ${c.bookTitle}`)),
    h('div.editor-head',
      titleIn,
      h('div.actions', statePill, status,
        h('a.btn.ghost', {
          href: `#/bog/${c.bookId}/${c.id}`,
          onclick: async (e) => { if (dirty()) { e.preventDefault(); if (await save({}, true)) location.hash = `#/bog/${c.bookId}/${c.id}`; } },
        }, icon('eye', 18), 'Vis som elev'),
        h('button.btn.ghost', { type: 'button', onclick: () => save() }, 'Gem'), pubBtn)),
    modeTabs, split,
    h('div.row.editor-foot', counter, h('span.small.muted', 'Ctrl/⌘+S gemmer · Ctrl/⌘+B fed · Ctrl/⌘+I kursiv · Ændringer gemmes automatisk, når du forlader siden')),
    revisions);
  updatePublish(); refresh();

  // Gem automatisk, når læreren forlader editoren med ændringer.
  const leave = () => { window.removeEventListener('hashchange', leave); if (dirty()) save({}, true); };
  window.addEventListener('hashchange', leave);
}
