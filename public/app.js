// Marstal Navigationsskole – portal (klient)
'use strict';

const state = { user: null, grades: [] };
const app = document.getElementById('app');

// ---------- Hjælpere ----------
// h('div.card', {onclick}, children...) – bygger DOM sikkert (ingen innerHTML).
function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'accent') el.style.setProperty('--accent', v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/api/login') { state.user = null; location.hash = '#/login'; }
  if (!res.ok) throw new Error(data.error || 'Noget gik galt');
  return data;
}

let toastTimer;
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (isError ? ' error' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function dueInfo(iso) {
  const d = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  if (d < 0) return h('span.pill.bad', `Overskredet (${fmtDate(iso)})`);
  if (d <= 3) return h('span.pill.warn', d === 0 ? 'Afleveres i dag' : `Om ${d} dag${d === 1 ? '' : 'e'}`);
  return h('span.pill', `Frist ${fmtDate(iso)}`);
}
const isTeacher = () => state.user && state.user.role === 'teacher';
const formData = (form) => Object.fromEntries(new FormData(form).entries());
function linkify(url) { return url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Åbn link ↗') : null; }

function render(...nodes) { app.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false)); window.scrollTo(0, 0); }
function loading() { render(h('p.muted', 'Indlæser …')); }

// Formular der sender data og kalder onDone ved succes.
function submitForm(form, fn, okMsg) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try { await fn(formData(form)); if (okMsg) toast(okMsg); }
    catch (err) { toast(err.message, true); }
    finally { if (btn) btn.disabled = false; }
  });
  return form;
}

// ---------- Topbar ----------
function updateChrome() {
  const bar = document.getElementById('topbar');
  if (!state.user) { bar.hidden = true; return; }
  bar.hidden = false;
  document.getElementById('userName').textContent = state.user.name;
  document.getElementById('roleBadge').textContent = isTeacher() ? 'Lærer' : 'Elev';
  const nav = document.getElementById('topnav');
  const current = location.hash || '#/';
  const links = [['#/', isTeacher() ? 'Lærerportal' : 'Elevportal'], ['#/fag', 'Mine fag']];
  if (!isTeacher()) links.push(['#/karakterer', 'Karakterer']);
  links.push(['#/skolen', 'Skolen & uddannelser']);
  nav.replaceChildren(...links.map(([href, label]) =>
    h('a', { href, class: (current === href || (href !== '#/' && current.startsWith(href))) ? 'active' : '' }, label)));
}
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('POST', '/api/logout').catch(() => {});
  state.user = null; location.hash = '#/login';
});

// ---------- Login ----------
function viewLogin() {
  let role = 'student';
  const err = h('div.error');
  const userInput = h('input', { name: 'username', autocomplete: 'username', required: true, placeholder: 'f.eks. anna' });
  const passInput = h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const roleBtns = ['student', 'teacher'].map((r) => h('button', {
    type: 'button', class: r === role ? 'active' : '',
    onclick: (e) => {
      role = r; roleBtns.forEach((b) => b.classList.remove('active')); e.currentTarget.classList.add('active');
      userInput.placeholder = r === 'teacher' ? 'f.eks. lars' : 'f.eks. anna';
    },
  }, r === 'teacher' ? '🧭 Lærerportal' : '🎓 Elevportal'));

  const form = h('form.form',
    h('div.role-switch', roleBtns),
    h('label', 'Brugernavn', userInput),
    h('label', 'Adgangskode', passInput),
    err,
    h('button.btn', { type: 'submit' }, 'Log ind'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    try {
      const { user } = await api('POST', '/api/login', formData(form));
      if (user.role !== role) {
        err.textContent = `Denne bruger er ${user.role === 'teacher' ? 'lærer' : 'elev'} – du sendes til ${user.role === 'teacher' ? 'lærerportalen' : 'elevportalen'}.`;
        await new Promise((r) => setTimeout(r, 1100));
      }
      await boot('#/');
    } catch (ex) { err.textContent = ex.message; }
  });

  render(h('div.login-wrap', h('div.card.login-card',
    h('div.logo', h('img', { src: '/favicon.svg', alt: '', width: 44, height: 44 }),
      h('div', h('h1', 'Marstal Navigationsskole'), h('div.muted.small', 'Portal for elever og lærere'))),
    form,
    h('div.demo', h('strong', 'Demo-brugere'), h('br'),
      'Elever: anna, jonas, freja – adgangskode ', h('code', 'elev123'), h('br'),
      'Lærere: lars, mette, peter – adgangskode ', h('code', 'laerer123')),
    h('p.small.center', h('a', { href: '#/skolen' }, 'Om skolen, uddannelser og kurser →')),
    h('p.small.muted.center', 'Ellenet 10, 5960 Marstal · +45 62 53 10 75 · marnav@marnav.dk'))));
  userInput.focus();
}

// ---------- Forside / dashboard ----------
function subjectCard(s) {
  const meta = [h('span.pill', `${s.materialCount} materialer`), h('span.pill', `${s.assignmentCount} opgaver`)];
  if (isTeacher()) {
    meta.push(h('span.pill', `${s.studentCount} elever`));
    if (s.ungraded) meta.push(h('span.pill.warn', `${s.ungraded} til bedømmelse`));
  } else if (s.openAssignments) meta.push(h('span.pill.warn', `${s.openAssignments} ikke afleveret`));
  return h('a.card.subject-card', { href: `#/fag/${s.id}`, accent: s.color },
    h('div.code', s.code), h('h3', s.name),
    h('p.muted.small', s.description),
    h('div.small.muted', 'Underviser: ', s.teachers.join(', ')),
    h('div.meta', meta));
}

function announcementList(items, showSubject) {
  if (!items.length) return h('p.empty', 'Ingen opslag endnu.');
  return h('ul.list', items.map((n) => h('li',
    h('div.row', h('strong', n.title), h('span.muted.small', fmtDate(n.createdAt))),
    showSubject ? h('div.small.muted', n.subjectName, ' · ', n.author) : h('div.small.muted', n.author),
    h('p.prewrap', n.body))));
}

async function viewDashboard() {
  loading();
  const d = await api('GET', '/api/dashboard');
  const hello = h('div.hero',
    h('h1', `Velkommen, ${state.user.name.split(' ')[0]}`),
    h('p', isTeacher() ? 'Lærerportal – overblik over dine fag, afleveringer og opslag.' : `Elevportal · ${state.user.className || ''}`),
    !isTeacher() && state.user.educationId && h('p.small', h('a.hero-link', { href: `#/skolen/${state.user.educationId}` }, `Om din uddannelse: ${state.user.education} →`)));

  let left;
  if (isTeacher()) {
    left = h('div.card',
      h('h2', 'Afleveringer der venter på bedømmelse'),
      d.toGrade.length ? h('ul.list', d.toGrade.map((x) => h('li',
        h('div.row', h('div', h('strong', x.studentName), ' – ', x.assignmentTitle, h('div.small.muted', x.subjectName, ' · afleveret ', fmtDateTime(x.submittedAt))),
          h('a.btn.small', { href: `#/opgave/${x.assignmentId}` }, 'Bedøm'))))) : h('p.empty', 'Alt er bedømt 🎉'));
  } else {
    left = h('div.card',
      h('h2', 'Kommende afleveringer'),
      d.upcoming.length ? h('ul.list', d.upcoming.map((a) => h('li',
        h('div.row', h('div', h('a', { href: `#/fag/${a.subjectId}/opgaver` }, a.title), h('div.small.muted', a.subjectName)), dueInfo(a.due))))) : h('p.empty', 'Du har ingen udestående opgaver.'),
      d.grades.length ? [h('h2', 'Seneste karakterer'), h('ul.list', d.grades.slice(0, 4).map((g) => h('li',
        h('div.row', h('div', h('strong', g.assignmentTitle), h('div.small.muted', g.subjectName)), h('span.grade-big', g.grade)))))] : null);
  }

  render(hello,
    h('div.grid.two', left, h('div.card', h('h2', 'Seneste opslag'), announcementList(d.announcements, true))),
    h('div.section-title', h('h2', 'Mine fag')),
    h('div.grid.subjects', d.subjects.map(subjectCard)));
}

async function viewSubjects() {
  loading();
  const d = await api('GET', '/api/dashboard');
  render(h('div.section-title', h('h1', 'Mine fag')), h('div.grid.subjects', d.subjects.map(subjectCard)));
}

// ---------- Fagside ----------
async function viewSubject(id, tab = 'opslag') {
  loading();
  const s = await api('GET', `/api/subjects/${id}`);
  const reload = (t) => viewSubject(id, t);
  const tabs = [['opslag', 'Opslag'], ['materialer', 'Materialer'], ['opgaver', 'Opgaver']];
  if (isTeacher()) tabs.push(['elever', 'Elever'], ['karakterbog', 'Karakterbog']);
  if (!tabs.some(([k]) => k === tab)) tab = 'opslag';

  const body = h('div');
  const tabBar = h('div.tabs', tabs.map(([k, label]) => h('button', {
    type: 'button', class: k === tab ? 'active' : '',
    onclick: () => { history.replaceState(null, '', `#/fag/${id}/${k}`); reload(k); },
  }, label)));

  const views = {
    opslag: () => [
      isTeacher() && creator('Nyt opslag', [
        h('label', 'Titel', h('input', { name: 'title', required: true })),
        h('label', 'Tekst', h('textarea', { name: 'body', required: true })),
      ], (data) => api('POST', `/api/subjects/${id}/announcements`, data).then(() => reload('opslag')), 'Opslaget er offentliggjort'),
      h('div.card', s.announcements.length ? h('ul.list', s.announcements.map((n) => h('li',
        h('div.row', h('strong', n.title), h('span.muted.small', fmtDate(n.createdAt))),
        h('div.small.muted', n.author), h('p.prewrap', n.body),
        isTeacher() && deleteBtn(`/api/announcements/${n.id}`, () => reload('opslag'))))) : h('p.empty', 'Ingen opslag endnu.')),
    ],
    materialer: () => [
      isTeacher() && creator('Upload nyt materiale', [
        h('label', 'Titel', h('input', { name: 'title', required: true })),
        h('label', 'Indhold / noter', h('textarea', { name: 'content' })),
        h('label', 'Link (valgfrit)', h('input', { name: 'link', type: 'url', placeholder: 'https://…' })),
      ], (data) => api('POST', `/api/subjects/${id}/materials`, data).then(() => reload('materialer')), 'Materialet er tilføjet'),
      s.materials.length ? s.materials.map((m) => h('div.card',
        h('div.row', h('h3', '📘 ', m.title), h('span.muted.small', fmtDate(m.createdAt))),
        m.content && h('p.prewrap', m.content),
        h('div.actions', linkify(m.link), isTeacher() && deleteBtn(`/api/materials/${m.id}`, () => reload('materialer'))))) : h('div.card', h('p.empty', 'Ingen materialer endnu.')),
    ],
    opgaver: () => [
      isTeacher() && creator('Opret ny opgave', [
        h('label', 'Titel', h('input', { name: 'title', required: true })),
        h('label', 'Beskrivelse', h('textarea', { name: 'description', required: true })),
        h('label', 'Afleveringsfrist', h('input', { name: 'due', type: 'datetime-local', required: true })),
      ], (data) => api('POST', `/api/subjects/${id}/assignments`, { ...data, due: new Date(data.due).toISOString() }).then(() => reload('opgaver')), 'Opgaven er oprettet'),
      s.assignments.length ? s.assignments.map((a) => assignmentCard(a, () => reload('opgaver'))) : h('div.card', h('p.empty', 'Ingen opgaver endnu.')),
    ],
    elever: () => h('div.card', h('h2', `Elever (${s.students.length})`), h('div.table-wrap', h('table',
      h('thead', h('tr', h('th', 'Navn'), h('th', 'Brugernavn'), h('th', 'Hold'))),
      h('tbody', s.students.map((st) => h('tr', h('td', st.name), h('td', st.username), h('td', st.className || '–'))))))),
    karakterbog: () => gradebook(id),
  };

  body.append(...[views[tab]()].flat().filter(Boolean));
  body.classList.add('stack');
  render(
    h('div.hero.subject-hero', { accent: s.color },
      h('div.small', h('a', { href: '#/fag', class: 'backlink' }, '← Mine fag')),
      h('h1', `${s.code} · ${s.name}`), h('p', s.description), h('p.small', 'Underviser: ', s.teachers.join(', '))),
    tabBar, body);
  document.querySelectorAll('.backlink').forEach((a) => a.style.setProperty('color', '#fff'));
}

function creator(title, fields, onSubmit, okMsg) {
  const form = submitForm(h('form.form', fields, h('div.actions', h('button.btn', { type: 'submit' }, 'Gem'))), onSubmit, okMsg);
  return h('details.card.creator', h('summary', '＋ ', title), form);
}

function deleteBtn(url, after) {
  return h('button.btn.danger.small', {
    type: 'button',
    onclick: async () => {
      if (!confirm('Er du sikker på, at du vil slette dette?')) return;
      try { await api('DELETE', url); toast('Slettet'); after(); } catch (e) { toast(e.message, true); }
    },
  }, 'Slet');
}

function assignmentCard(a, reload) {
  const head = h('div.row', h('h3', '📝 ', a.title), dueInfo(a.due));
  const desc = h('p.prewrap', a.description);
  if (isTeacher()) {
    return h('div.card', head, desc,
      h('div.actions',
        h('span.pill', `${a.submissionCount}/${a.studentCount} afleveret`),
        a.ungraded ? h('span.pill.warn', `${a.ungraded} til bedømmelse`) : null,
        h('a.btn.small', { href: `#/opgave/${a.id}` }, 'Se afleveringer'),
        deleteBtn(`/api/assignments/${a.id}`, reload)));
  }
  const sub = a.mySubmission;
  if (sub && sub.grade != null) {
    return h('div.card', head, desc,
      h('div.row', h('div', h('strong', 'Din besvarelse'), h('div.small.muted', 'Afleveret ', fmtDateTime(sub.submittedAt))), h('div', h('span.muted.small', 'Karakter '), h('span.grade-big', sub.grade))),
      h('div.submission-text', sub.text),
      sub.feedback && h('p', h('strong', 'Feedback: '), sub.feedback));
  }
  const form = submitForm(h('form.form',
    h('label', sub ? 'Din besvarelse (du kan rette indtil den er bedømt)' : 'Din besvarelse',
      h('textarea', { name: 'text', required: true, value: sub ? sub.text : '' })),
    h('div.actions', h('button.btn', { type: 'submit' }, sub ? 'Opdater aflevering' : 'Aflever'),
      sub && h('span.pill.ok', `Afleveret ${fmtDateTime(sub.submittedAt)}`))),
  (data) => api('POST', `/api/assignments/${a.id}/submissions`, data).then(reload), 'Din opgave er afleveret ✔');
  return h('div.card', head, desc, form);
}

function gradebook(id) {
  const wrap = h('div.card', h('p.muted', 'Indlæser karakterbog …'));
  (async () => {
    const g = await api('GET', `/api/subjects/${id}/gradebook`);
    if (!g.assignments.length) { wrap.replaceChildren(h('p.empty', 'Ingen opgaver endnu.')); return; }
    wrap.replaceChildren(h('h2', 'Karakterbog'), h('div.table-wrap', h('table',
      h('thead', h('tr', h('th', 'Elev'), g.assignments.map((a) => h('th', h('a', { href: `#/opgave/${a.id}` }, a.title))))),
      h('tbody', g.rows.map((r) => h('tr', h('td', r.student.name),
        r.cells.map((c) => h('td.grade', c.grade != null ? c.grade : c.submitted ? h('span.pill.warn', 'Afventer') : h('span.muted', '–')))))))));
  })().catch((e) => wrap.replaceChildren(h('p.error', e.message)));
  return wrap;
}

// ---------- Lærer: bedøm afleveringer ----------
async function viewAssignment(id) {
  loading();
  const d = await api('GET', `/api/assignments/${id}/submissions`);
  const a = d.assignment;
  render(
    h('div.small', h('a', { href: `#/fag/${a.subjectId}/opgaver` }, `← ${a.subjectName}`)),
    h('div.section-title', h('div', h('h1', a.title), h('div.muted', a.subjectName)), dueInfo(a.due)),
    h('div.card', h('p.prewrap', a.description)),
    h('div.section-title', h('h2', 'Afleveringer')),
    h('div.stack', d.rows.map((r) => gradeCard(r, () => viewAssignment(id)))));
}

function gradeCard({ student, submission: sub }, reload) {
  if (!sub) return h('div.card', h('div.row', h('strong', student.name), h('span.pill.bad', 'Ikke afleveret')));
  const select = h('select', { name: 'grade', required: true },
    h('option', { value: '' }, 'Vælg karakter …'),
    state.grades.map((g) => h('option', { value: g, selected: sub.grade === g }, g)));
  const form = submitForm(h('form.form',
    h('div.grid.two', h('label', 'Karakter (7-trinsskala)', select),
      h('label', 'Feedback til eleven', h('textarea', { name: 'feedback', value: sub.feedback || '' }))),
    h('div.actions', h('button.btn', { type: 'submit' }, sub.grade != null ? 'Opdater bedømmelse' : 'Gem bedømmelse'))),
  (data) => api('POST', `/api/submissions/${sub.id}/grade`, data).then(reload), `Bedømmelse gemt for ${student.name}`);
  return h('div.card',
    h('div.row', h('div', h('strong', student.name), h('div.small.muted', 'Afleveret ', fmtDateTime(sub.submittedAt))),
      sub.grade != null ? h('span.grade-big', sub.grade) : h('span.pill.warn', 'Afventer bedømmelse')),
    h('div.submission-text', sub.text), form);
}

// ---------- Elev: karakteroversigt ----------
async function viewGrades() {
  loading();
  const d = await api('GET', '/api/dashboard');
  const numeric = d.grades.map((g) => Number(g.grade));
  const avg = numeric.length ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1).replace('.', ',') : '–';
  render(
    h('div.section-title', h('h1', 'Mine karakterer'), h('div', h('span.muted', 'Gennemsnit '), h('span.grade-big', avg))),
    h('div.card', d.grades.length ? h('div.table-wrap', h('table',
      h('thead', h('tr', h('th', 'Fag'), h('th', 'Opgave'), h('th', 'Bedømt'), h('th', 'Karakter'), h('th', 'Feedback'))),
      h('tbody', d.grades.map((g) => h('tr',
        h('td', h('a', { href: `#/fag/${g.subjectId}/opgaver` }, g.subjectName)), h('td', g.assignmentTitle),
        h('td', fmtDate(g.gradedAt)), h('td.grade', g.grade), h('td', g.feedback || '–'))))))
      : h('p.empty', 'Du har ikke fået nogen karakterer endnu.')));
}

// ---------- Skolen & uddannelser (fra marnav.dk) ----------
const fmtKr = (n) => n.toLocaleString('da-DK') + ' kr.';
const fmtCourseDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate(d) : d);
const ext = (href, label) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);
const bullets = (items) => items.length ? h('ul.bullets', items.map((x) => h('li', x))) : null;

async function viewSchool(focusId) {
  loading();
  const sc = await api('GET', '/api/school');
  const c = sc.contact;
  const groups = [...new Set(sc.educations.map((e) => e.level))];
  const eduCard = (e) => h('details.card.edu', { id: `edu-${e.id}`, open: e.id === focusId },
    h('summary', h('div', h('div.small.muted', e.level), h('h3', e.name), h('div.small', e.duration))),
    h('p', e.summary),
    e.requirements.length ? [h('h4', 'Optagelseskrav'), bullets(e.requirements)] : null,
    e.outcome.length ? [h('h4', 'Det giver uddannelsen'), bullets(e.outcome)] : null,
    e.extra.length ? [h('h4', 'Godt at vide'), bullets(e.extra)] : null,
    h('div.actions', ext(e.url, 'Læs mere på marnav.dk ↗'), ext(c.applyUrl, 'Ansøg om optagelse ↗')));

  render(
    !state.user && h('p.small', h('a', { href: '#/login' }, '← Til login')),
    h('div.hero',
      h('h1', c.name), h('p', c.tagline),
      h('p.small.contact', c.address, ' · ', c.phone, ' · ', ext(`mailto:${c.email}`, c.email)),
      h('div.actions.hero-actions', ext(c.applyUrl, 'Ansøg om optagelse ↗'), ext(c.website, 'marnav.dk ↗'))),
    groups.map((g) => [h('div.section-title', h('h2', g === 'Navigatøruddannelse' ? 'Navigatøruddannelser' : g === 'Fleksibelt forløb' ? 'Fleksible forløb' : g)),
      h('div.grid.subjects', sc.educations.filter((e) => e.level === g).map(eduCard))]),
    h('div.grid.two.spaced',
      h('div.card', h('h2', 'Praktisk'), bullets(sc.practical)),
      h('div.card', h('h2', 'Åbent hus'), h('ul.list', sc.events.map((ev) => h('li', h('div.row', h('span', ev.title), ext(ev.url, fmtDate(ev.date) + ' ↗'))))))),
    h('div.section-title', h('h2', 'Kurser'), ext(sc.coursesUrl, 'Se hele kursuskataloget og tilmeld dig ↗')),
    h('div.card', h('div.table-wrap', h('table',
      h('thead', h('tr', h('th', 'Kursus'), h('th', 'Start'), h('th', 'Varighed'), h('th', 'Pris (ekskl. moms)'))),
      h('tbody', sc.courses.map((k) => h('tr', h('td', k.name), h('td', fmtCourseDate(k.date)), h('td', k.days), h('td', fmtKr(k.price))))))),
      h('p.small.muted', 'Spørgsmål om kurser: ', ext(`mailto:${c.courseEmail}`, c.courseEmail))),
    h('p.small.muted', `Kilde: ${sc.source.url} – hentet ${fmtDate(sc.source.fetched)}. Tjek altid skolens hjemmeside for de nyeste oplysninger.`));
  if (focusId) { const el = document.getElementById(`edu-${focusId}`); if (el) el.scrollIntoView({ block: 'center' }); }
}

// ---------- Router ----------
async function router() {
  const hash = location.hash || '#/';
  if (!state.user) {
    updateChrome();
    if (hash.startsWith('#/skolen')) return viewSchool(hash.split('/')[2]).catch((e) => render(h('p.error', e.message)));
    if (hash !== '#/login') location.hash = '#/login'; else viewLogin();
    return;
  }
  if (hash === '#/login') { location.hash = '#/'; return; }
  updateChrome();
  const parts = hash.slice(2).split('/').filter(Boolean);
  try {
    if (!parts.length) await viewDashboard();
    else if (parts[0] === 'fag' && parts[1]) await viewSubject(parts[1], parts[2]);
    else if (parts[0] === 'fag') await viewSubjects();
    else if (parts[0] === 'opgave' && parts[1] && isTeacher()) await viewAssignment(parts[1]);
    else if (parts[0] === 'karakterer' && !isTeacher()) await viewGrades();
    else if (parts[0] === 'skolen') await viewSchool(parts[1]);
    else render(h('div.card', h('h1', 'Siden findes ikke'), h('a', { href: '#/' }, 'Til forsiden')));
  } catch (e) {
    render(h('div.card', h('h2', 'Der opstod en fejl'), h('p.error', e.message), h('a', { href: '#/' }, 'Til forsiden')));
  }
}

async function boot(target) {
  try { const me = await api('GET', '/api/me'); state.user = me.user; state.grades = me.grades; }
  catch { state.user = null; }
  if (target && location.hash !== target) location.hash = target; else router();
}
window.addEventListener('hashchange', router);
boot();
