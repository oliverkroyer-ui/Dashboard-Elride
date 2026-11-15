// Administration: brugere, elevgrupper (hold), fag og produkter/adgangspakker.
'use strict';

async function viewAdmin(tab = 'brugere') {
  loading();
  const d = await api('GET', '/api/admin/overview');
  const reload = (t) => viewAdmin(t || tab);
  const tabs = [['brugere', 'Brugere'], ['grupper', 'Elevgrupper'], ['fag', 'Fag'], ['produkter', 'Produkter og adgang']];
  const students = d.users.filter((u) => u.role === 'student');
  const roleName = { student: 'Elev', teacher: 'Underviser', admin: 'Administrator' };
  const checks = (name, items, selected, label) => h('fieldset.check-grid', h('legend', label),
    items.map((it) => h('label.check', h('input', { type: 'checkbox', name, value: it.id, checked: selected.includes(it.id) }), it.label)));
  const picked = (form, name) => [...form.querySelectorAll(`input[name=${name}]:checked`)].map((x) => x.value);

  const views = {
    brugere: () => [
      creator(d.isAdmin ? 'Opret bruger' : 'Opret elev', [
        h('div.grid.two', h('label', 'Navn', h('input', { name: 'name', required: true })), h('label', 'Brugernavn', h('input', { name: 'username', required: true, pattern: '[a-z0-9._-]{3,40}', placeholder: 'små bogstaver' }))),
        h('div.grid.three',
          h('label', 'Midlertidig adgangskode', h('input', { name: 'password', required: true, minLength: 8, type: 'text' })),
          h('label', 'Hold / klasse', h('input', { name: 'className' })),
          d.isAdmin ? h('label', 'Rolle', h('select', { name: 'role' }, Object.entries(roleName).map(([k, v]) => h('option', { value: k }, v)))) : null),
      ], (data) => api('POST', '/api/admin/users', data).then(() => reload()), 'Brugeren er oprettet'),
      h('div.card', h('div.table-wrap', h('table',
        h('thead', h('tr', h('th', 'Navn'), h('th', 'Brugernavn'), h('th', 'Rolle'), h('th', 'Hold'), h('th', 'Fag'), d.isAdmin ? h('th', '') : null)),
        h('tbody', d.users.map((u) => h('tr', h('td', u.name), h('td', h('code', u.username)), h('td', h('span.pill', roleName[u.role])), h('td.small', u.className || '–'), h('td.small', u.subjects.join(', ') || '–'),
          d.isAdmin ? h('td', u.id === state.user.id ? null : deleteBtn(`/api/admin/users/${u.id}`, () => reload())) : null)))))),
      h('p.small.muted', 'Persondata: når en bruger slettes, slettes også brugerens noter, bogmærker, afleveringer og beskeder. Brugere kan selv hente alle deres data.'),
    ],
    grupper: () => [
      creator('Ny elevgruppe', [
        h('label', 'Navn', h('input', { name: 'name', required: true, placeholder: 'fx Kystskipper januar 2027' })),
        checks('studentIds', students.map((u) => ({ id: u.id, label: `${u.name}${u.className ? ' · ' + u.className : ''}` })), [], 'Elever'),
        checks('subjectIds', d.subjects.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` })), [], 'Giver adgang til fag'),
      ], (data, form) => api('POST', '/api/admin/groups', { name: data.name, studentIds: picked(form, 'studentIds'), subjectIds: picked(form, 'subjectIds') }).then(() => reload()), 'Gruppen er oprettet, og eleverne har fået adgang'),
      d.groups.length ? d.groups.map((g) => h('div.card', h('div.row', h('h3', g.name), deleteBtn(`/api/admin/groups/${g.id}`, () => reload())),
        h('p.small', h('strong', 'Elever: '), g.students.join(', ') || '–'), h('p.small', h('strong', 'Fag: '), g.subjectNames.join(', ') || '–'))) : h('div.card', h('p.empty', 'Ingen grupper endnu.')),
    ],
    fag: () => [
      creator('Opret nyt fag', [
        h('div.grid.three', h('label', 'Fagkode', h('input', { name: 'code', required: true, maxLength: 8, placeholder: 'fx RAD' })), h('label', 'Navn', h('input', { name: 'name', required: true, placeholder: 'fx Radar og ARPA' })), h('label', 'Farve', h('input', { name: 'color', type: 'color', value: '#134a7a' }))),
        h('label', 'Beskrivelse', h('textarea', { name: 'description', rows: 2 })),
      ], (data) => api('POST', '/api/admin/subjects', data).then(() => reload()), 'Faget er oprettet'),
      h('div.grid.subjects', d.subjects.map((s) => h('div.card.subject-edit', { accent: s.color }, h('div.code', s.code), h('h3', s.name),
        h('p.small.muted', `Underviser: ${s.teachers.join(', ') || '–'} · ${s.studentIds.length} elever`),
        h('div.actions', h('a.btn.ghost.small', { href: `#/fag/${s.id}` }, 'Åbn fag'))))),
    ],
    produkter: () => [
      h('div.card.notice.info', icon('shield', 18), h('div', h('strong', 'Betaling er ikke slået til i version 1'),
        h('div.small', 'Her kan du allerede nu beskrive bøger, fagpakker, abonnementer og skolelicenser med pris og indhold. Når betaling kobles på, bruges de samme produkter til at styre adgang.'))),
      d.isAdmin ? creator('Nyt produkt', [
        h('div.grid.two', h('label', 'Navn', h('input', { name: 'name', required: true })), h('label', 'Type', h('select', { name: 'kind' }, ['bog', 'fagpakke', 'abonnement', 'licens', 'eksamenspakke'].map((k) => h('option', { value: k }, k))))),
        h('div.grid.two', h('label', 'Pris (kr.)', h('input', { name: 'price', type: 'number', min: 0 })), h('label', 'Betales', h('select', { name: 'interval' }, ['engang', 'måned', 'år'].map((k) => h('option', { value: k }, k))))),
        h('label', 'Beskrivelse', h('textarea', { name: 'description', rows: 2 })),
      ], (data) => api('POST', '/api/admin/products', data).then(() => reload()), 'Produktet er oprettet') : h('p.small.muted', 'Kun administratorer kan ændre produkter.'),
      h('div.card', h('div.table-wrap', h('table',
        h('thead', h('tr', h('th', 'Produkt'), h('th', 'Type'), h('th', 'Pris'), h('th', 'Status'), d.isAdmin ? h('th', '') : null)),
        h('tbody', d.products.map((p) => h('tr', h('td', h('strong', p.name), h('div.small.muted', p.description)), h('td', p.kind),
          h('td.num', `${p.price.toLocaleString('da-DK')} kr.${p.interval !== 'engang' ? ' / ' + p.interval : ''}`), h('td', p.active ? h('span.pill.ok', 'Aktiv') : h('span.pill', 'Kladde')),
          d.isAdmin ? h('td', deleteBtn(`/api/admin/products/${p.id}`, () => reload())) : null)))))),
    ],
  };
  if (!views[tab]) tab = 'brugere';
  render(
    h('div.section-title', h('div', h('h1', 'Administration'), h('p.muted', d.isAdmin ? 'Du er administrator og kan styre alle brugere, fag og produkter.' : 'Som underviser kan du oprette elever, elevgrupper og nye fag.'))),
    h('div.tabs', tabs.map(([k, label]) => h('button', { type: 'button', class: k === tab ? 'active' : '', onclick: () => { history.replaceState(null, '', `#/admin/${k}`); viewAdmin(k); } }, label))),
    h('div.stack', views[tab]()));
}
