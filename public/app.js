// Marstal Navigationsskole – portal (klient)
'use strict';

const state = { user: null, grades: [], unread: 0 };
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
  const links = [['#/', 'Forside'], ['#/skema', 'Skema'], ['#/fag', 'Mine fag'], ['#/beskeder', 'Beskeder']];
  if (!isTeacher()) links.push(['#/karakterer', 'Karakterer']);
  const badge = h('span.badge', { hidden: !state.unread }, String(state.unread || ''));
  nav.replaceChildren(...links.map(([href, label]) =>
    h('a', { href, class: (current === href || (href !== '#/' && current.startsWith(href))) ? 'active' : '' }, label, href === '#/beskeder' ? badge : null)));
  refreshUnread(badge);
}
async function refreshUnread(badge) {
  try {
    const { threads } = await api('GET', '/api/messages');
    state.unread = threads.reduce((n, t) => n + t.unread, 0);
    badge.textContent = String(state.unread); badge.hidden = !state.unread;
  } catch { /* ignore */ }
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
      'Lærere: lars, mette, peter – adgangskode ', h('code', 'laerer123')))));
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
    h('p', isTeacher() ? 'Lærerportal – overblik over dine fag, afleveringer og opslag.' : `Elevportal · ${state.user.className || ''}`));
  const todayCard = h('div.card',
    h('div.row', h('h2', `I dag · ${WEEKDAYS[d.today - 1] || ''}`), h('a.small', { href: '#/skema' }, 'Hele ugen →')),
    d.todayLessons.length ? h('ul.list', d.todayLessons.map(lessonItem)) : h('p.empty', d.today > 5 ? 'Weekend – ingen undervisning.' : 'Ingen lektioner i dag.'),
    d.unreadMessages ? h('p', h('a.btn.small', { href: '#/beskeder' }, `✉ ${d.unreadMessages} ulæst${d.unreadMessages === 1 ? '' : 'e'} besked${d.unreadMessages === 1 ? '' : 'er'}`)) : null);

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
    h('div.grid.two', h('div.stack', todayCard, left), h('div.card', h('h2', 'Seneste opslag'), announcementList(d.announcements, true))),
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
  const tabs = [['opslag', 'Opslag'], ['materialer', 'Materialer'], ['opgaver', 'Opgaver'], ['skema', 'Skema']];
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
    skema: () => subjectSchedule(id, () => reload('skema')),
  };

  body.append(...[views[tab]()].flat(Infinity).filter(Boolean));
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

// Slet med bekræftelse i selve knappen (første klik spørger, andet klik sletter).
function deleteBtn(url, after) {
  let armed = false, timer;
  const btn = h('button.btn.danger.small', {
    type: 'button',
    onclick: async () => {
      if (!armed) {
        armed = true; btn.textContent = 'Klik igen for at slette';
        timer = setTimeout(() => { armed = false; btn.textContent = 'Slet'; }, 4000);
        return;
      }
      clearTimeout(timer);
      try { await api('DELETE', url); toast('Slettet'); after(); } catch (e) { toast(e.message, true); }
    },
  }, 'Slet');
  return btn;
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

// ---------- Skema ----------
const WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
function lessonItem(l) {
  return h('li.lesson', { accent: l.color },
    h('div.row', h('div', h('strong', `${l.start}–${l.end}`), h('div', h('a', { href: `#/fag/${l.subjectId}` }, l.subjectName))),
      h('span.pill', l.subjectCode)),
    h('div.small.muted', [l.room, l.teacher].filter(Boolean).join(' · ')));
}

async function viewSchedule() {
  loading();
  const { lessons } = await api('GET', '/api/schedule');
  const today = ((new Date().getDay() + 6) % 7) + 1;
  render(
    h('div.section-title', h('h1', 'Mit skema'), h('span.muted', isTeacher() ? 'Dine lektioner' : state.user.className || '')),
    h('div.week', WEEKDAYS.slice(0, 5).map((day, i) => {
      const ls = lessons.filter((l) => l.weekday === i + 1);
      return h('div.card.day', { class: i + 1 === today ? 'today' : '' },
        h('h3', day, i + 1 === today ? h('span.pill.ok', 'I dag') : null),
        ls.length ? h('ul.list', ls.map(lessonItem)) : h('p.empty.small', 'Ingen lektioner'));
    })),
    isTeacher() ? h('p.small.muted', 'Tilføj eller fjern lektioner under fanen “Skema” i det enkelte fag.') : null);
}

function subjectSchedule(id, reload) {
  const wrap = h('div.stack', h('div.card', h('p.muted', 'Indlæser skema …')));
  (async () => {
    const { lessons } = await api('GET', '/api/schedule');
    const mine = lessons.filter((l) => l.subjectId === id);
    const list = h('div.card', h('h2', 'Ugentlige lektioner'),
      mine.length ? h('ul.list', mine.map((l) => h('li', h('div.row',
        h('div', h('strong', `${WEEKDAYS[l.weekday - 1]} ${l.start}–${l.end}`), h('div.small.muted', [l.room, l.teacher].filter(Boolean).join(' · '))),
        isTeacher() ? deleteBtn(`/api/lessons/${l.id}`, reload) : null)))) : h('p.empty', 'Ingen lektioner i skemaet.'));
    wrap.replaceChildren(...[
      isTeacher() && creator('Tilføj lektion', [
        h('div.grid.three',
          h('label', 'Ugedag', h('select', { name: 'weekday', required: true }, WEEKDAYS.slice(0, 5).map((d, i) => h('option', { value: i + 1 }, d)))),
          h('label', 'Fra', h('input', { name: 'start', type: 'time', required: true, value: '08:15' })),
          h('label', 'Til', h('input', { name: 'end', type: 'time', required: true, value: '09:45' }))),
        h('label', 'Lokale', h('input', { name: 'room', placeholder: 'f.eks. Simulatorbygningen' })),
      ], (data) => api('POST', `/api/subjects/${id}/lessons`, data).then(reload), 'Lektionen er tilføjet'),
      list].filter(Boolean));
  })().catch((e) => wrap.replaceChildren(h('p.error', e.message)));
  return wrap;
}

// ---------- Beskeder ----------
async function viewMessages(contactId) {
  loading();
  const { threads } = await api('GET', '/api/messages');
  if (!contactId && threads.length) contactId = (threads.find((t) => t.unread) || threads[0]).contact.id;
  const t = threads.find((x) => x.contact.id === contactId);
  if (t && t.unread) { await api('POST', `/api/messages/read/${t.contact.id}`).catch(() => {}); t.unread = 0; updateChrome(); }

  const list = h('div.card.threads', h('h2', isTeacher() ? 'Elever' : 'Lærere'),
    threads.length ? h('ul.list', threads.map((x) => h('li', { class: x.contact.id === contactId ? 'selected' : '' },
      h('a.thread', { href: `#/beskeder/${x.contact.id}` },
        h('div.row', h('strong', x.contact.name), x.unread ? h('span.badge', String(x.unread)) : null),
        h('div.small.muted', x.last ? (x.last.mine ? 'Dig: ' : '') + x.last.body.slice(0, 60) : x.subjects.join(', ')))))) : h('p.empty', 'Ingen kontakter.'));

  let convo;
  if (!t) convo = h('div.card', h('p.empty', 'Vælg en person for at skrive.'));
  else {
    const box = h('div.messages', t.messages.length ? t.messages.map((m) => h('div.msg', { class: m.mine ? 'mine' : '' },
      h('div.prewrap', m.body), h('div.small.meta', fmtDateTime(m.createdAt)))) : h('p.empty', 'Ingen beskeder endnu – skriv den første.'));
    const form = submitForm(h('form.form.compose',
      h('textarea', { name: 'body', required: true, placeholder: `Skriv til ${t.contact.name} …` }),
      h('div.actions', h('button.btn', { type: 'submit' }, 'Send'))),
    (data) => api('POST', '/api/messages', { toId: t.contact.id, body: data.body }).then(() => viewMessages(t.contact.id)), 'Besked sendt');
    convo = h('div.card.convo',
      h('div', h('h2', t.contact.name), h('div.small.muted', [t.contact.role === 'teacher' ? 'Lærer' : t.contact.className, t.subjects.join(', ')].filter(Boolean).join(' · '))),
      box, form);
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 0);
  }
  render(h('div.section-title', h('h1', 'Beskeder')), h('div.msg-layout', list, convo));
}

// ---------- Router ----------
async function router() {
  const hash = location.hash || '#/';
  if (!state.user) {
    updateChrome();
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
    else if (parts[0] === 'skema') await viewSchedule();
    else if (parts[0] === 'beskeder') await viewMessages(parts[1]);
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
