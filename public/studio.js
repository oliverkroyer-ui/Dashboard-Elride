// Lærerstudio: lærerens værksted til at skrive og vedligeholde alt indhold.
'use strict';

function statTile(label, value, sub, href) {
  return h(href ? 'a.stat' : 'div.stat', href ? { href } : null,
    h('div.stat-value', String(value)), h('div.stat-label', label), sub ? h('div.small.muted', sub) : null);
}

function subjectEditCard(s, reload) {
  const view = h('div.card.subject-edit', { accent: s.color },
    h('div.row',
      h('div', h('div.code', s.code), h('h3', s.name)),
      h('button.btn.small.ghost', { type: 'button', onclick: () => view.replaceWith(form) }, icon('pencil', 16), 'Redigér fag')),
    h('p.small.muted', s.description || 'Ingen beskrivelse.'),
    h('div.actions',
      h('a.btn.small.ghost', { href: `#/fag/${s.id}` }, 'Åbn fag'),
      h('a.btn.small.ghost', { href: `#/fag/${s.id}/boeger` }, 'Lærebøger'),
      h('a.btn.small.ghost', { href: `#/fag/${s.id}/skema` }, 'Skema'),
      h('span.pill', `${s.studentCount} elever`)));
  const form = submitForm(h('form.card.form',
    h('div.grid.three',
      h('label', 'Fagkode', h('input', { name: 'code', required: true, maxLength: 8, value: s.code })),
      h('label', 'Navn', h('input', { name: 'name', required: true, value: s.name })),
      h('label', 'Farve', h('input', { name: 'color', type: 'color', value: s.color }))),
    h('label', 'Beskrivelse (vises for eleverne)', h('textarea', { name: 'description', rows: 3, value: s.description || '' })),
    h('div.actions', h('button.btn', { type: 'submit' }, 'Gem fag'),
      h('button.btn.ghost', { type: 'button', onclick: () => form.replaceWith(view) }, 'Annullér'))),
  (data) => api('PUT', `/api/subjects/${s.id}`, data).then(reload), 'Faget er opdateret');
  return view;
}

async function viewStudio() {
  loading();
  const d = await api('GET', '/api/studio');
  const st = d.stats;
  const reload = () => viewStudio();

  const booksTable = d.books.length ? h('div.table-wrap', h('table.studio-table',
    h('thead', h('tr', h('th', 'Lærebog'), h('th', 'Fag'), h('th', 'Status'), h('th', 'Kapitler'), h('th', 'Elever færdige'), h('th', 'Opdateret'), h('th', ''))),
    h('tbody', d.books.map((b) => h('tr',
      h('td', h('a', { href: `#/rediger-bog/${b.id}` }, h('strong', b.title))),
      h('td', h('span.code', { accent: b.color }, b.subjectCode)),
      h('td', statusPill(b.published)),
      h('td.num', String(b.chapterCount), b.draftChapters ? h('span.small.muted', ` (${b.draftChapters} kladde${b.draftChapters === 1 ? '' : 'r'})`) : null),
      h('td', b.published ? [progressBar(b.completion, 100), h('span.small.muted', `${b.completion}%`)] : h('span.muted', '–')),
      h('td.small.muted', fmtDate(b.updatedAt)),
      h('td', h('div.actions', h('a.btn.small', { href: `#/rediger-bog/${b.id}` }, icon('pencil', 16), 'Redigér'),
        h('a.btn.small.ghost', { href: `#/bog/${b.id}` }, icon('eye', 16)))))))))
    : h('p.empty', 'Du har ingen lærebøger endnu.');

  render(
    h('div.hero.studio-hero',
      h('div.studio-badge', icon('code', 18), 'Lærerstudio'),
      h('h1', 'Byg og vedligehold dit undervisningsindhold'),
      h('p', 'Skriv lærebøger kapitel for kapitel, opdatér materialer, opgaver og fag – og se hvordan eleverne kommer igennem stoffet.')),
    h('div.stats',
      statTile('Lærebøger', st.books, `${st.publishedBooks} udgivet`, '#/boeger'),
      statTile('Kapitler', st.chapters, st.draftChapters ? `${st.draftChapters} kladder` : 'alle udgivet'),
      statTile('Ord skrevet', st.words.toLocaleString('da-DK'), 'i dine lærebøger'),
      statTile('Materialer', st.materials, 'i dine fag', '#/fag'),
      statTile('Opgaver', st.assignments, 'i dine fag', '#/fag'),
      statTile('Lektioner', st.lessons, 'pr. uge', '#/skema')),
    h('div.section-title', h('h2', 'Lærebøger')),
    newBookForm(d.subjects),
    h('div.card', booksTable),
    h('div.grid.two.spaced',
      h('div.stack', h('h2', 'Dine fag'), d.subjects.map((s) => subjectEditCard(s, reload))),
      h('div.stack', h('h2', 'Ændringslog'),
        h('div.card', d.activity.length ? h('ul.list.activity', d.activity.map((a) => h('li',
          h('div', a.link ? h('a', { href: a.link }, a.text) : a.text),
          h('div.small.muted', `${a.user} · ${a.subjectName || ''} · ${fmtDateTime(a.at)}`)))) : h('p.empty', 'Ingen ændringer endnu.')))));
}
