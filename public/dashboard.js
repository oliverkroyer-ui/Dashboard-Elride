// Underviserens overblik og fælles sider: søgning, noter, notifikationer og "Mere".
'use strict';

async function viewTeacherDashboard() {
  loading();
  const [o, d] = await Promise.all([api('GET', '/api/teacher/overview'), api('GET', '/api/dashboard')]);
  const tile = (href, ic, value, label, sub, tone) => h('a.stat', { href, class: tone || '' }, h('div.stat-top', icon(ic, 18), h('span.stat-value', String(value))), h('div.stat-label', label), sub ? h('div.small.muted', sub) : null);
  const card = (title, href, linkText, ...body) => h('section.card.dash-card', h('div.row', h('h2', title), href ? h('a.small', { href }, linkText || 'Se alle →') : null), ...body);
  render(
    h('div.hero.teacher-hero',
      h('h1', `God dag, ${state.user.name.split(' ')[0]}`),
      h('p', o.legal.length ? `Der er ${o.legal.length} mulig${o.legal.length === 1 ? '' : 'e'} regelændring${o.legal.length === 1 ? '' : 'er'}, der venter på dig.` : 'Dit materiale er opdateret – ingen regelændringer venter.'),
      h('div.actions.hero-actions',
        o.legal.length ? h('a.btn.accent', { href: `#/lovaendringer/${o.legal[0].id}` }, icon('scale', 18), 'Gennemgå lovændring') : null,
        h('a.btn.on-dark', { href: '#/boeger' }, icon('library', 18), 'Mine materialer'),
        h('a.btn.on-dark', { href: '#/assistent' }, icon('sparkles', 18), 'Spørg assistenten'))),
    h('div.stats',
      tile('#/boeger', 'library', o.books.length, 'Undervisningsbøger', `${o.books.filter((b) => b.edition).length} udgivet`),
      tile('#/lovaendringer', 'scale', o.legal.length, 'Foreslåede lovændringer', o.legal.length ? 'venter på godkendelse' : 'ingen venter', o.legal.length ? 'attention' : ''),
      tile('#/boeger', 'pencil', o.editingCount, 'Under redigering', 'kapitler ændret siden udgivelse'),
      tile('#/formler', 'sigma', o.formulas.count, 'Formler i biblioteket', o.formulas.withErrors ? `${o.formulas.withErrors} med fejl` : 'alle kontrolleret', o.formulas.withErrors ? 'attention' : ''),
      tile('#/admin/grupper', 'users', o.students.count, 'Elever med adgang', `${o.students.groups} elevgrupper`)),
    h('div.dash-grid',
      card('Mine undervisningsmaterialer', '#/boeger', 'Alle bøger →',
        h('ul.list', o.books.map((b) => h('li.row', h('div', h('a', { href: `#/rediger-bog/${b.id}` }, h('strong', b.title)), h('div.small.muted', `${b.subjectCode} · ${b.chapterCount} kapitler`)),
          h('div.actions', versionPill(b.edition), b.pending ? h('a.pill.info', { href: `#/udgiv/${b.id}` }, `${b.pending} klar/ændret`) : null))))),
      card('Foreslåede lovændringer', '#/lovaendringer', 'Overvågning →',
        o.legal.length ? h('ul.list', o.legal.map((c) => h('li', h('a', { href: `#/lovaendringer/${c.id}` }, h('strong', c.title)),
          h('div.small.muted', `${c.open ? c.open + ' forslag venter' : 'Ny – ikke gennemgået endnu'}${c.effectiveFrom ? ' · gælder fra ' + c.effectiveFrom : ''}`), c.demo ? h('span.pill.bad', 'Fiktiv demo') : null))) : h('p.empty', 'Ingen ændringer venter.'),
        h('div.actions', h('a.btn.ghost.small', { href: '#/oplysninger' }, icon('checks', 15), 'Centrale oplysninger'), h('a.btn.ghost.small', { href: '#/kilder' }, icon('scale', 15), 'Retskilder'))),
      card('Materialer under redigering', null, null,
        o.editing.length ? h('ul.list', o.editing.map((c) => h('li.row', h('div', h('a', { href: `#/rediger-kapitel/${c.chapterId}` }, c.title), h('div.small.muted', `${c.bookTitle} · ${fmtDateTime(c.updatedAt)}`)),
          h('div.actions', statusPill(c.status), c.ready ? h('span.pill.ok', 'Klar') : null)))) : h('p.empty', 'Alt er udgivet.')),
      card('Seneste udgivelser', null, null,
        o.recent.length ? h('ul.list', o.recent.map((e) => h('li.row', h('div', h('strong', `${e.bookTitle} ${e.version}`), h('div.small.muted', `${fmtDate(e.publishedAt)} · ${e.changeCount} ændring${e.changeCount === 1 ? '' : 'er'}`)),
          h('a.btn.ghost.small', { href: `#/aendringer/${e.id}` }, 'Ændringer')))) : h('p.empty', 'Ingen udgivelser endnu.')),
      card('Elever og adgang', '#/admin', 'Administration →',
        h('ul.list', o.students.subjects.map((s) => h('li.row', h('a', { href: `#/fag/${s.id}` }, h('span.code', { accent: s.color }, s.code), ' ', s.name), h('span.small.muted', `${s.students} elever`))))),
      card('Formelbibliotek', '#/formler', 'Åbn bibliotek →',
        h('p', `${o.formulas.count} formler inden for ${o.formulas.categories.join(', ')}.`),
        o.formulas.withErrors ? h('div.notice.warn.small', icon('alert', 16), `${o.formulas.withErrors} formel${o.formulas.withErrors === 1 ? '' : 'er'} har fejl i kontroleksemplet.`) : h('div.notice.ok.small', icon('shield', 16), 'Alle formler er kontrolleret.'),
        h('div.actions', h('a.btn.ghost.small', { href: '#/formler/ny' }, icon('plus', 15), 'Ny formel')))),
    h('div.grid.two.spaced',
      d.toGrade.length ? h('div.card', h('h2', 'Afleveringer til bedømmelse'), h('ul.list', d.toGrade.slice(0, 5).map((x) => h('li.row', h('div', h('strong', x.studentName), ' – ', x.assignmentTitle, h('div.small.muted', x.subjectName)), h('a.btn.small', { href: `#/opgave/${x.assignmentId}` }, 'Bedøm'))))) : null,
      h('div.card', h('h2', 'Seneste aktivitet'), h('ul.list.activity', o.activity.map((a) => h('li', a.link ? h('a', { href: a.link }, a.text) : a.text, h('div.small.muted', `${a.user} · ${fmtDateTime(a.at)}`)))))));
}

async function viewSearch() {
  const q = hashQuery().q || '';
  const input = h('input.search-input', { type: 'search', value: q, placeholder: 'Søg i dine bøger – fx hviletid, GM, regel 15', 'aria-label': 'Søg' });
  const results = h('div.stack', { 'aria-live': 'polite' });
  let t;
  async function run() {
    const term = input.value.trim();
    history.replaceState(null, '', `#/soeg${term ? '?q=' + encodeURIComponent(term) : ''}`);
    if (term.length < 2) { setKids(results, h('p.muted', 'Skriv mindst to bogstaver.')); return; }
    const r = await api('GET', `/api/search?q=${encodeURIComponent(term)}`);
    setKids(results, r.results.length ? h('ul.list.card.search-results', r.results.map((x) => h('li', h('a', { href: x.link }, h('strong', x.title)), h('span.pill', x.kind), x.bookTitle ? h('span.small.muted', ` · ${x.bookTitle}`) : null, h('p.small', x.snippet))))
      : h('div.card', h('p.empty', `Ingen resultater for “${term}”.`)));
  }
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  render(h('div.section-title', h('h1', 'Søg')), h('div.search-box', icon('search', 20), input), results);
  input.focus(); if (q) run();
}

async function viewMyNotes() {
  loading();
  const { bookmarks, notes } = await api('GET', '/api/bookmarks');
  render(
    h('div.section-title', h('div', h('h1', 'Mine noter og bogmærker'), h('p.muted', 'Kun du kan se dem.'))),
    h('div.grid.two',
      h('div.card', h('h2', icon('bookmark', 18), ' Bogmærker'), bookmarks.length ? h('ul.list', bookmarks.map((b) => h('li.row',
        h('div', h('a', { href: `#/bog/${b.bookId}/${b.chapterId}${b.anchor ? '?afsnit=' + b.anchor : ''}` }, b.label), h('div.small.muted', `${b.bookTitle} · ${fmtDate(b.at)}`)),
        deleteBtn(`/api/bookmarks/${b.id}`, () => viewMyNotes())))) : h('p.empty', 'Tryk på bogmærke-ikonet ved en overskrift for at gemme et afsnit.')),
      h('div.card', h('h2', icon('note', 18), ' Noter'), notes.length ? h('ul.list', notes.map((n) => h('li',
        h('a', { href: `#/bog/${n.bookId}/${n.chapterId}` }, h('strong', n.chapterTitle)), h('div.small.muted', `${n.bookTitle} · ${fmtDate(n.updatedAt)}`), h('p.prewrap', n.text)))) : h('p.empty', 'Skriv noter nederst i hvert kapitel.'))));
}

async function viewNotifications() {
  loading();
  const { notifications } = await api('GET', '/api/notifications');
  render(
    h('div.section-title', h('h1', 'Notifikationer'), notifications.some((n) => !n.read) ? h('button.btn.ghost', { type: 'button', onclick: async () => { await api('POST', '/api/notifications/read', {}); updateChrome(); viewNotifications(); } }, 'Markér alle som læst') : null),
    h('div.card', notifications.length ? h('ul.list', notifications.map((n) => h('li.row', { class: n.read ? '' : 'unread' },
      h('div', icon(n.kind === 'udgave' ? 'rocket' : n.kind === 'lov' ? 'scale' : 'bell', 16), ' ', h('a', { href: n.link, onclick: () => api('POST', '/api/notifications/read', { id: n.id }).catch(() => {}) }, n.text), h('div.small.muted', fmtDateTime(n.at))),
      n.read ? null : h('span.pill.new', 'Ny')))) : h('p.empty', 'Ingen notifikationer.')));
}

function viewMore() {
  const tile = (href, ic, title, sub) => h('a.card.more-tile', { href }, icon(ic, 24), h('strong', title), h('span.small.muted', sub));
  render(h('div.section-title', h('h1', 'Mere')), h('div.grid.more-grid',
    isTeacher() ? [
      tile('#/assistent', 'sparkles', 'Assistent', 'Find, kontrollér og lav opgaver'),
      tile('#/oplysninger', 'checks', 'Centrale oplysninger', 'Ret ét sted – opdateres overalt'),
      tile('#/kilder', 'scale', 'Retskilder', 'Bestemmelser dit materiale bygger på'),
      tile('#/dokumentation', 'shield', 'Dokumentation', 'Log over godkendte ændringer'),
      tile('#/fag', 'layers', 'Fag', 'Opslag, materialer og opgaver'),
      tile('#/admin', 'users', 'Administration', 'Elever, grupper, fag og produkter'),
    ] : [
      tile('#/mine-noter', 'bookmark', 'Noter og bogmærker', 'Dine egne noter'),
      tile('#/fag', 'layers', 'Mine fag', 'Opslag, materialer og opgaver'),
      tile('#/karakterer', 'award', 'Karakterer', 'Bedømmelser og feedback'),
    ],
    tile('#/skema', 'calendar', 'Skema', 'Ugens lektioner'),
    tile('#/beskeder', 'chat', 'Beskeder', 'Skriv med undervisere og elever'),
    tile('#/notifikationer', 'bell', 'Notifikationer', 'Nye udgaver og ændringer')));
}
