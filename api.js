// Rohub – portalens API-logik.
// Miljøneutral: bruges af server.js (Node) og af browser-demoen (build-demo.js).
(function (root) {
'use strict';

function createApi(env) {
  // env: { hashPassword, verifyPassword, randomHex, load() -> db|null, save(db), seed(hashPassword) -> db }
  let db;
  const sessions = new Map(); // token -> { userId, expires }
  const newId = (prefix) => `${prefix}${env.randomHex(6)}`;
  const saveDb = () => env.save(db);
  function loadDb(reset = false) {
    db = reset ? null : env.load();
    if (db) { db.monitor = db.monitor || null; for (const k of ['lessons', 'messages', 'books', 'chapters', 'reads', 'activity', 'editions', 'facts', 'sources', 'formulas', 'legalChanges', 'proposals', 'changeLog', 'notifications', 'bookmarks', 'notes', 'groups', 'products']) db[k] = db[k] || []; }
    else { db = env.seed(env.hashPassword); saveDb(); }
    runSeedScript();
  }
  const hashPassword = env.hashPassword, verifyPassword = env.verifyPassword;
  const reply = (status, data, extra = {}) => ({ status, data, ...extra });
  function userFromSid(sid) {
    const s = sid && sessions.get(sid);
    if (!s || s.expires < Date.now()) { if (s) sessions.delete(sid); return null; }
    s.expires = Date.now() + SESSION_TTL_MS;
    return db.users.find((u) => u.id === s.userId) || null;
  }

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 timer
const GRADES = ['12', '10', '7', '4', '02', '00', '-3']; // 7-trinsskalaen

const publicUser = (u) => u && ({ id: u.id, username: u.username, name: u.name, role: u.role, className: u.className || null });

// ---------- Hjælpere ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
function str(v, field, { max = 5000, required = true } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `Feltet "${field}" skal udfyldes`);
  if (s.length > max) throw new HttpError(400, `Feltet "${field}" er for langt`);
  return s;
}
function safeLink(v) {
  const s = str(v, 'link', { max: 500, required: false });
  if (s && !/^https?:\/\//i.test(s)) throw new HttpError(400, 'Link skal starte med http:// eller https://');
  return s;
}
// Administrator har altid samme rettigheder som en underviser.
const isStaff = (u) => !!u && (u.role === 'teacher' || u.role === 'admin');
function requireRole(user, role) {
  if (!user) throw new HttpError(401, 'Du skal være logget ind');
  if (role === 'teacher' ? !isStaff(user) : role && user.role !== role) throw new HttpError(403, 'Du har ikke adgang til dette');
}
function subjectFor(user, subjectId) {
  const s = db.subjects.find((x) => x.id === subjectId);
  if (!s) throw new HttpError(404, 'Faget findes ikke');
  const member = user.role === 'admin' || (isStaff(user) ? s.teacherIds.includes(user.id) : s.studentIds.includes(user.id));
  if (!member) throw new HttpError(403, 'Du er ikke tilknyttet dette fag');
  return s;
}
function mySubjects(user) {
  if (user.role === 'admin') return db.subjects.slice();
  return db.subjects.filter((s) => (isStaff(user) ? s.teacherIds : s.studentIds).includes(user.id));
}
const nameOf = (id) => (db.users.find((u) => u.id === id) || {}).name || 'Ukendt';
const byDateDesc = (k) => (a, b) => (b[k] || '').localeCompare(a[k] || '');

function subjectSummary(s, user) {
  const assignments = db.assignments.filter((a) => a.subjectId === s.id);
  const base = {
    id: s.id, code: s.code, name: s.name, color: s.color, description: s.description,
    teachers: s.teacherIds.map(nameOf),
    materialCount: db.materials.filter((m) => m.subjectId === s.id).length,
    assignmentCount: assignments.length,
  };
  if (isStaff(user)) {
    base.studentCount = s.studentIds.length;
    base.ungraded = db.submissions.filter((x) => x.grade == null && assignments.some((a) => a.id === x.assignmentId)).length;
  } else {
    const mine = db.submissions.filter((x) => x.studentId === user.id && assignments.some((a) => a.id === x.assignmentId));
    base.openAssignments = assignments.filter((a) => !mine.some((m) => m.assignmentId === a.id)).length;
  }
  return base;
}

function assignmentView(a, user, subject) {
  const out = { ...a, author: nameOf(a.authorId) };
  if (user.role === 'student') {
    const sub = db.submissions.find((x) => x.assignmentId === a.id && x.studentId === user.id);
    out.mySubmission = sub || null;
  } else {
    const subs = db.submissions.filter((x) => x.assignmentId === a.id);
    out.submissionCount = subs.length;
    out.ungraded = subs.filter((x) => x.grade == null).length;
    out.studentCount = subject.studentIds.length;
  }
  return out;
}

// ---------- API-ruter ----------
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};

route('POST', '/api/login', ({ body }) => {
  const username = str(body.username, 'brugernavn', { max: 100 }).toLowerCase();
  const password = str(body.password, 'adgangskode', { max: 200 });
  const user = db.users.find((u) => u.username === username);
  if (!user || !verifyPassword(password, user.password)) throw new HttpError(401, 'Forkert brugernavn eller adgangskode');
  const token = env.randomHex(32);
  sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_TTL_MS });
  return reply(200, { user: publicUser(user) }, { sid: token });
});

route('POST', '/api/logout', ({ sid }) => {
  if (sid) sessions.delete(sid);
  return reply(200, { ok: true }, { clearSid: true });
});

route('GET', '/api/me', ({ user }) => {
  requireRole(user);
  return reply(200, { user: publicUser(user), grades: GRADES });
});

route('GET', '/api/dashboard', ({ user }) => {
  requireRole(user);
  const subs = mySubjects(user);
  const subjectIds = new Set(subs.map((s) => s.id));
  const subjectName = (id) => (db.subjects.find((s) => s.id === id) || {}).name;
  const announcements = db.announcements.filter((n) => subjectIds.has(n.subjectId)).sort(byDateDesc('createdAt')).slice(0, 5)
    .map((n) => ({ ...n, subjectName: subjectName(n.subjectId), author: nameOf(n.authorId) }));
  const assignments = db.assignments.filter((a) => subjectIds.has(a.subjectId));
  const today = ((new Date().getDay() + 6) % 7) + 1; // 1 = mandag … 7 = søndag
  const out = {
    subjects: subs.map((s) => subjectSummary(s, user)), announcements,
    today, todayLessons: lessonsFor(user).filter((l) => l.weekday === today),
    unreadMessages: db.messages.filter((m) => m.toId === user.id && !m.read).length,
  };

  if (user.role === 'student') {
    const mine = db.submissions.filter((x) => x.studentId === user.id);
    out.upcoming = assignments.filter((a) => !mine.some((m) => m.assignmentId === a.id))
      .sort((a, b) => a.due.localeCompare(b.due))
      .map((a) => ({ ...a, subjectName: subjectName(a.subjectId) }));
    out.grades = mine.filter((x) => x.grade != null).sort(byDateDesc('gradedAt')).map((x) => {
      const a = db.assignments.find((y) => y.id === x.assignmentId) || {};
      return { ...x, assignmentTitle: a.title, subjectId: a.subjectId, subjectName: subjectName(a.subjectId) };
    });
  } else {
    out.toGrade = db.submissions.filter((x) => x.grade == null && assignments.some((a) => a.id === x.assignmentId))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
      .map((x) => {
        const a = assignments.find((y) => y.id === x.assignmentId);
        return { ...x, studentName: nameOf(x.studentId), assignmentTitle: a.title, subjectId: a.subjectId, subjectName: subjectName(a.subjectId) };
      });
  }
  return reply(200, out);
});

route('GET', '/api/subjects/:id', ({ user, params }) => {
  requireRole(user);
  const s = subjectFor(user, params.id);
  const out = {
    ...subjectSummary(s, user),
    materials: db.materials.filter((m) => m.subjectId === s.id).sort(byDateDesc('createdAt')).map((m) => ({ ...m, author: nameOf(m.authorId) })),
    assignments: db.assignments.filter((a) => a.subjectId === s.id).sort((a, b) => a.due.localeCompare(b.due)).map((a) => assignmentView(a, user, s)),
    announcements: db.announcements.filter((n) => n.subjectId === s.id).sort(byDateDesc('createdAt')).map((n) => ({ ...n, author: nameOf(n.authorId) })),
    books: ctx.booksForSubject(user, s.id),
  };
  if (isStaff(user)) {
    out.students = s.studentIds.map((id) => publicUser(db.users.find((u) => u.id === id))).filter(Boolean);
  }
  return reply(200, out);
});

// Lærer: opret indhold
route('POST', '/api/subjects/:id/materials', ({ user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const m = { id: newId('m'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), content: str(body.content, 'indhold', { required: false }), link: safeLink(body.link), createdAt: new Date().toISOString(), authorId: user.id };
  db.materials.push(m); logActivity(user, s.id, `Tilføjede materialet “${m.title}”`, `#/fag/${s.id}/materialer`); saveDb();
  return reply(201, m);
});

route('POST', '/api/subjects/:id/assignments', ({ user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const due = new Date(str(body.due, 'afleveringsfrist', { max: 40 }));
  if (isNaN(due)) throw new HttpError(400, 'Ugyldig afleveringsfrist');
  const a = { id: newId('a'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), description: str(body.description, 'beskrivelse'), due: due.toISOString(), createdAt: new Date().toISOString(), authorId: user.id };
  db.assignments.push(a); logActivity(user, s.id, `Oprettede opgaven “${a.title}”`, `#/fag/${s.id}/opgaver`); saveDb();
  return reply(201, a);
});

route('POST', '/api/subjects/:id/announcements', ({ user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const n = { id: newId('n'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), body: str(body.body, 'tekst'), createdAt: new Date().toISOString(), authorId: user.id };
  db.announcements.push(n); logActivity(user, s.id, `Skrev opslaget “${n.title}”`, `#/fag/${s.id}`); saveDb();
  return reply(201, n);
});

// Lærer: slet indhold
for (const [coll, label] of [['materials', 'Materialet'], ['assignments', 'Opgaven'], ['announcements', 'Opslaget']]) {
  route('DELETE', `/api/${coll}/:id`, ({ user, params }) => {
    requireRole(user, 'teacher');
    const item = db[coll].find((x) => x.id === params.id);
    if (!item) throw new HttpError(404, `${label} findes ikke`);
    subjectFor(user, item.subjectId);
    db[coll] = db[coll].filter((x) => x.id !== item.id);
    if (coll === 'assignments') db.submissions = db.submissions.filter((x) => x.assignmentId !== item.id);
    saveDb();
    return reply(200, { ok: true });
  });
}

// Elev: aflever opgave (kan genafleveres indtil den er bedømt)
route('POST', '/api/assignments/:id/submissions', ({ user, params, body }) => {
  requireRole(user, 'student');
  const a = db.assignments.find((x) => x.id === params.id);
  if (!a) throw new HttpError(404, 'Opgaven findes ikke');
  subjectFor(user, a.subjectId);
  const text = str(body.text, 'besvarelse', { max: 20000 });
  let sub = db.submissions.find((x) => x.assignmentId === a.id && x.studentId === user.id);
  if (sub && sub.grade != null) throw new HttpError(409, 'Opgaven er allerede bedømt og kan ikke ændres');
  if (sub) { sub.text = text; sub.submittedAt = new Date().toISOString(); }
  else {
    sub = { id: newId('sub'), assignmentId: a.id, studentId: user.id, text, submittedAt: new Date().toISOString(), grade: null, feedback: '', gradedAt: null };
    db.submissions.push(sub);
  }
  saveDb();
  return reply(201, sub);
});

// Lærer: se afleveringer og giv karakter
route('GET', '/api/assignments/:id/submissions', ({ user, params }) => {
  requireRole(user, 'teacher');
  const a = db.assignments.find((x) => x.id === params.id);
  if (!a) throw new HttpError(404, 'Opgaven findes ikke');
  const s = subjectFor(user, a.subjectId);
  const rows = s.studentIds.map((sid) => ({
    student: publicUser(db.users.find((u) => u.id === sid)),
    submission: db.submissions.find((x) => x.assignmentId === a.id && x.studentId === sid) || null,
  }));
  return reply(200, { assignment: { ...a, subjectName: s.name }, rows });
});

route('POST', '/api/submissions/:id/grade', ({ user, params, body }) => {
  requireRole(user, 'teacher');
  const sub = db.submissions.find((x) => x.id === params.id);
  if (!sub) throw new HttpError(404, 'Afleveringen findes ikke');
  const a = db.assignments.find((x) => x.id === sub.assignmentId);
  subjectFor(user, a.subjectId);
  if (!GRADES.includes(body.grade)) throw new HttpError(400, 'Vælg en karakter fra 7-trinsskalaen');
  sub.grade = body.grade;
  sub.feedback = str(body.feedback, 'feedback', { required: false });
  sub.gradedAt = new Date().toISOString();
  sub.gradedBy = user.id;
  saveDb();
  return reply(200, sub);
});

// Lærer: karakteroversigt for et fag
route('GET', '/api/subjects/:id/gradebook', ({ user, params }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const assignments = db.assignments.filter((a) => a.subjectId === s.id).sort((a, b) => a.due.localeCompare(b.due));
  const rows = s.studentIds.map((sid) => ({
    student: publicUser(db.users.find((u) => u.id === sid)),
    cells: assignments.map((a) => {
      const sub = db.submissions.find((x) => x.assignmentId === a.id && x.studentId === sid);
      return sub ? { submitted: true, grade: sub.grade } : { submitted: false, grade: null };
    }),
  }));
  return reply(200, { subject: { id: s.id, name: s.name }, assignments: assignments.map((a) => ({ id: a.id, title: a.title, due: a.due })), rows });
});

// ---------- Skema ----------
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function lessonsFor(user) {
  const subs = mySubjects(user);
  return db.lessons.filter((l) => subs.some((s) => s.id === l.subjectId))
    .map((l) => {
      const s = subs.find((x) => x.id === l.subjectId);
      return { ...l, subjectName: s.name, subjectCode: s.code, color: s.color, teacher: nameOf(l.teacherId) };
    })
    .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}
route('GET', '/api/schedule', ({ user }) => {
  requireRole(user);
  return reply(200, { lessons: lessonsFor(user) });
});
route('POST', '/api/subjects/:id/lessons', ({ user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const weekday = Number(body.weekday);
  if (!(weekday >= 1 && weekday <= 5)) throw new HttpError(400, 'Vælg en ugedag (mandag–fredag)');
  const start = str(body.start, 'starttid', { max: 5 }), end = str(body.end, 'sluttid', { max: 5 });
  if (!TIME_RE.test(start) || !TIME_RE.test(end) || end <= start) throw new HttpError(400, 'Ugyldigt tidsrum');
  const l = { id: newId('l'), subjectId: s.id, weekday, start, end, room: str(body.room, 'lokale', { max: 80, required: false }), teacherId: user.id };
  db.lessons.push(l); saveDb();
  return reply(201, l);
});
route('DELETE', '/api/lessons/:id', ({ user, params }) => {
  requireRole(user, 'teacher');
  const l = db.lessons.find((x) => x.id === params.id);
  if (!l) throw new HttpError(404, 'Lektionen findes ikke');
  subjectFor(user, l.subjectId);
  db.lessons = db.lessons.filter((x) => x.id !== l.id); saveDb();
  return reply(200, { ok: true });
});

// ---------- Beskeder (elev ↔ lærer i fælles fag) ----------
function contactsOf(user) {
  const ids = new Set();
  for (const s of mySubjects(user)) (isStaff(user) ? s.studentIds : s.teacherIds).forEach((id) => ids.add(id));
  ids.delete(user.id);
  return [...ids].map((id) => db.users.find((u) => u.id === id)).filter(Boolean);
}
route('GET', '/api/messages', ({ user }) => {
  requireRole(user);
  const threads = contactsOf(user).map((c) => {
    const msgs = db.messages.filter((m) => (m.fromId === user.id && m.toId === c.id) || (m.fromId === c.id && m.toId === user.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      contact: publicUser(c),
      subjects: mySubjects(user).filter((s) => [...s.teacherIds, ...s.studentIds].includes(c.id)).map((s) => s.name),
      unread: msgs.filter((m) => m.toId === user.id && !m.read).length,
      last: msgs[msgs.length - 1] || null,
      messages: msgs.map((m) => ({ ...m, mine: m.fromId === user.id })),
    };
  }).sort((a, b) => (b.last ? b.last.createdAt : '').localeCompare(a.last ? a.last.createdAt : '') || a.contact.name.localeCompare(b.contact.name));
  return reply(200, { threads });
});
route('POST', '/api/messages', ({ user, body }) => {
  requireRole(user);
  const to = contactsOf(user).find((c) => c.id === body.toId);
  if (!to) throw new HttpError(403, 'Du kan kun skrive til dine lærere/elever');
  const m = { id: newId('msg'), fromId: user.id, toId: to.id, body: str(body.body, 'besked', { max: 5000 }), createdAt: new Date().toISOString(), read: false };
  db.messages.push(m); saveDb();
  return reply(201, m);
});
route('POST', '/api/messages/read/:contactId', ({ user, params }) => {
  requireRole(user);
  let n = 0;
  for (const m of db.messages) if (m.toId === user.id && m.fromId === params.contactId && !m.read) { m.read = true; n++; }
  if (n) saveDb();
  return reply(200, { ok: true, marked: n });
});

  // ---------- Ændringslog (Lærerstudio) ----------
  function logActivity(user, subjectId, text, link) {
    db.activity.unshift({ id: newId('act'), at: new Date().toISOString(), userId: user.id, subjectId, text, link: link || '' });
    db.activity = db.activity.slice(0, 200);
  }

  // ---------- Redigér eksisterende indhold (lærer) ----------
  const COLOR_RE = /^#[0-9a-f]{6}$/i;
  route('PUT', '/api/subjects/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const s = subjectFor(user, params.id);
    if (body.name !== undefined) s.name = str(body.name, 'navn', { max: 100 });
    if (body.code !== undefined) s.code = str(body.code, 'fagkode', { max: 8 }).toUpperCase();
    if (body.description !== undefined) s.description = str(body.description, 'beskrivelse', { max: 1000, required: false });
    if (body.color !== undefined) { if (!COLOR_RE.test(body.color)) throw new HttpError(400, 'Ugyldig farve'); s.color = body.color; }
    logActivity(user, s.id, `Opdaterede faget ${s.name}`, `#/fag/${s.id}`);
    saveDb();
    return reply(200, s);
  });
  route('PUT', '/api/materials/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const m = db.materials.find((x) => x.id === params.id);
    if (!m) throw new HttpError(404, 'Materialet findes ikke');
    subjectFor(user, m.subjectId);
    m.title = str(body.title, 'titel', { max: 200 });
    m.content = str(body.content, 'indhold', { required: false, max: 20000 });
    m.link = safeLink(body.link);
    m.updatedAt = new Date().toISOString();
    logActivity(user, m.subjectId, `Redigerede materialet “${m.title}”`, `#/fag/${m.subjectId}/materialer`);
    saveDb();
    return reply(200, m);
  });
  route('PUT', '/api/assignments/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const a = db.assignments.find((x) => x.id === params.id);
    if (!a) throw new HttpError(404, 'Opgaven findes ikke');
    subjectFor(user, a.subjectId);
    const due = new Date(str(body.due, 'afleveringsfrist', { max: 40 }));
    if (isNaN(due)) throw new HttpError(400, 'Ugyldig afleveringsfrist');
    a.title = str(body.title, 'titel', { max: 200 });
    a.description = str(body.description, 'beskrivelse');
    a.due = due.toISOString();
    a.updatedAt = new Date().toISOString();
    logActivity(user, a.subjectId, `Redigerede opgaven “${a.title}”`, `#/fag/${a.subjectId}/opgaver`);
    saveDb();
    return reply(200, a);
  });
  route('PUT', '/api/announcements/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const n = db.announcements.find((x) => x.id === params.id);
    if (!n) throw new HttpError(404, 'Opslaget findes ikke');
    subjectFor(user, n.subjectId);
    n.title = str(body.title, 'titel', { max: 200 });
    n.body = str(body.body, 'tekst');
    n.updatedAt = new Date().toISOString();
    logActivity(user, n.subjectId, `Redigerede opslaget “${n.title}”`, `#/fag/${n.subjectId}`);
    saveDb();
    return reply(200, n);
  });
  route('PUT', '/api/lessons/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const l = db.lessons.find((x) => x.id === params.id);
    if (!l) throw new HttpError(404, 'Lektionen findes ikke');
    subjectFor(user, l.subjectId);
    const weekday = Number(body.weekday);
    if (!(weekday >= 1 && weekday <= 5)) throw new HttpError(400, 'Vælg en ugedag (mandag–fredag)');
    const start = str(body.start, 'starttid', { max: 5 }), end = str(body.end, 'sluttid', { max: 5 });
    if (!TIME_RE.test(start) || !TIME_RE.test(end) || end <= start) throw new HttpError(400, 'Ugyldigt tidsrum');
    Object.assign(l, { weekday, start, end, room: str(body.room, 'lokale', { max: 80, required: false }) });
    saveDb();
    return reply(200, l);
  });

  // ---------- Moduler ----------
  // Hvert modul får en fælles værktøjskasse (ctx) og registrerer sine egne ruter.
  // Nye funktioner tilføjes som nye moduler uden at røre kernen.
  const ctx = {
    get db() { return db; }, env, route, reply, HttpError, str, safeLink, requireRole, subjectFor, mySubjects,
    nameOf, newId, saveDb, logActivity, publicUser, isStaff, byDateDesc, hashPassword,
  };
  const modules = (typeof module !== 'undefined' && module.exports)
    ? ['content', 'books', 'legal', 'assistant', 'admin'].map((m) => require('./modules/' + m))
    : (root.PortalModules || []);
  modules.forEach((m) => m.install(ctx));

  // Startdata kan indeholde et lille "manuskript" (udgivelser og redigeringer), så
  // demoen starter med en rigtig udgavehistorik. Køres én gang efter indlæsning.
  function runSeedScript() {
    if (!db.seedScript) return;
    for (const step of db.seedScript) {
      const user = db.users.find((u) => u.id === step.by);
      if (step.publish) ctx.publishBook(user, db.books.find((b) => b.id === step.publish), step);
      if (step.edit) { const c = db.chapters.find((x) => x.id === step.edit); ctx.saveRevision(c, user, step.why); Object.assign(c, step.set); if (step.at) c.updatedAt = step.at; }
    }
    delete db.seedScript;
    saveDb();
  }

  // Kør en API-forespørgsel: returnerer { status, data, sid?, clearSid? }
  // Svaret kan være et løfte (fx AI-kald); kalderen skal derfor afvente det.
  function handle(method, pathname, body, sid, query = {}) {
    const fail = (err) => {
      if (!(err instanceof HttpError)) console.error(err);
      return reply(err.status || 500, { error: err instanceof HttpError ? err.message : 'Der opstod en fejl på serveren' });
    };
    try {
      for (const r of routes) {
        const m = r.method === method && r.re.exec(pathname);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const out = r.handler({ user: userFromSid(sid), params, body: body || {}, sid, query: query || {} });
        return out && typeof out.then === 'function' ? out.catch(fail) : out;
      }
      throw new HttpError(404, 'Ukendt adresse');
    } catch (err) { return fail(err); }
  }

  // Bruges af browser-demoen til at genoprette et login efter genindlæsning.
  function sessionFor(userId) {
    if (!db.users.some((u) => u.id === userId)) return null;
    const token = env.randomHex(32);
    sessions.set(token, { userId, expires: Date.now() + SESSION_TTL_MS });
    return token;
  }
  function userIdFor(sid) { const u = userFromSid(sid); return u ? u.id : null; }

  return { handle, loadDb, sessionFor, userIdFor, HttpError };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createApi };
else root.PortalApi = { createApi };
})(this);
