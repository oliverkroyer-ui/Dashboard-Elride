// Marstal Navigationsskole – portalens API-logik.
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
    if (db) { for (const k of ['lessons', 'messages', 'books', 'chapters', 'reads', 'activity']) db[k] = db[k] || []; }
    else { db = env.seed(env.hashPassword); saveDb(); }
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
function requireRole(user, role) {
  if (!user) throw new HttpError(401, 'Du skal være logget ind');
  if (role && user.role !== role) throw new HttpError(403, 'Du har ikke adgang til dette');
}
function subjectFor(user, subjectId) {
  const s = db.subjects.find((x) => x.id === subjectId);
  if (!s) throw new HttpError(404, 'Faget findes ikke');
  const member = user.role === 'teacher' ? s.teacherIds.includes(user.id) : s.studentIds.includes(user.id);
  if (!member) throw new HttpError(403, 'Du er ikke tilknyttet dette fag');
  return s;
}
function mySubjects(user) {
  return db.subjects.filter((s) => (user.role === 'teacher' ? s.teacherIds : s.studentIds).includes(user.id));
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
  if (user.role === 'teacher') {
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
    books: db.books.filter((b) => b.subjectId === s.id && (user.role === 'teacher' || b.published)).map((b) => bookSummary(user, b)),
  };
  if (user.role === 'teacher') {
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
  for (const s of mySubjects(user)) (user.role === 'teacher' ? s.studentIds : s.teacherIds).forEach((id) => ids.add(id));
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

  // ---------- Lærebøger ----------
  const MAX_REVISIONS = 30;
  function canSeeBook(user, b) {
    subjectFor(user, b.subjectId);
    if (user.role !== 'teacher' && !b.published) throw new HttpError(404, 'Bogen findes ikke');
  }
  function bookOr404(id) {
    const b = db.books.find((x) => x.id === id);
    if (!b) throw new HttpError(404, 'Bogen findes ikke');
    return b;
  }
  function chapterOr404(id) {
    const c = db.chapters.find((x) => x.id === id);
    if (!c) throw new HttpError(404, 'Kapitlet findes ikke');
    return c;
  }
  function visibleChapters(user, bookId) {
    return db.chapters.filter((c) => c.bookId === bookId && (user.role === 'teacher' || c.published)).sort((a, b) => a.order - b.order);
  }
  function bookSummary(user, b) {
    const s = db.subjects.find((x) => x.id === b.subjectId) || {};
    const chs = visibleChapters(user, b.id);
    const out = {
      id: b.id, subjectId: b.subjectId, subjectName: s.name, subjectCode: s.code, color: s.color,
      title: b.title, description: b.description, published: b.published,
      chapterCount: chs.length, updatedAt: b.updatedAt, author: nameOf(b.authorId),
    };
    if (user.role === 'teacher') out.draftChapters = chs.filter((c) => !c.published).length;
    else out.readCount = chs.filter((c) => db.reads.some((r) => r.userId === user.id && r.chapterId === c.id)).length;
    return out;
  }
  function touchBook(user, b) { b.updatedAt = new Date().toISOString(); b.updatedBy = user.id; }

  route('GET', '/api/books', ({ user }) => {
    requireRole(user);
    const ids = new Set(mySubjects(user).map((s) => s.id));
    const books = db.books.filter((b) => ids.has(b.subjectId) && (user.role === 'teacher' || b.published))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map((b) => bookSummary(user, b));
    return reply(200, { books });
  });
  route('POST', '/api/subjects/:id/books', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const s = subjectFor(user, params.id);
    const now = new Date().toISOString();
    const b = { id: newId('b'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), description: str(body.description, 'beskrivelse', { max: 1000, required: false }), published: false, authorId: user.id, createdAt: now, updatedAt: now, updatedBy: user.id };
    db.books.push(b);
    logActivity(user, s.id, `Oprettede lærebogen “${b.title}”`, `#/rediger-bog/${b.id}`);
    saveDb();
    return reply(201, b);
  });
  route('GET', '/api/books/:id', ({ user, params }) => {
    requireRole(user);
    const b = bookOr404(params.id);
    canSeeBook(user, b);
    const chapters = visibleChapters(user, b.id).map((c) => ({
      id: c.id, title: c.title, order: c.order, published: c.published, updatedAt: c.updatedAt,
      words: (c.content.match(/\S+/g) || []).length,
      read: user.role === 'student' ? db.reads.some((r) => r.userId === user.id && r.chapterId === c.id) : undefined,
    }));
    return reply(200, { ...bookSummary(user, b), chapters, canEdit: user.role === 'teacher' });
  });
  route('PUT', '/api/books/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    if (body.title !== undefined) b.title = str(body.title, 'titel', { max: 200 });
    if (body.description !== undefined) b.description = str(body.description, 'beskrivelse', { max: 1000, required: false });
    if (body.published !== undefined) {
      b.published = !!body.published;
      logActivity(user, b.subjectId, `${b.published ? 'Udgav' : 'Trak'} lærebogen “${b.title}”${b.published ? '' : ' tilbage'}`, `#/bog/${b.id}`);
    } else logActivity(user, b.subjectId, `Opdaterede lærebogen “${b.title}”`, `#/rediger-bog/${b.id}`);
    touchBook(user, b);
    saveDb();
    return reply(200, b);
  });
  route('DELETE', '/api/books/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    const chapterIds = new Set(db.chapters.filter((c) => c.bookId === b.id).map((c) => c.id));
    db.books = db.books.filter((x) => x.id !== b.id);
    db.chapters = db.chapters.filter((c) => c.bookId !== b.id);
    db.reads = db.reads.filter((r) => !chapterIds.has(r.chapterId));
    logActivity(user, b.subjectId, `Slettede lærebogen “${b.title}”`);
    saveDb();
    return reply(200, { ok: true });
  });

  // Kapitler
  route('POST', '/api/books/:id/chapters', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    const siblings = db.chapters.filter((c) => c.bookId === b.id);
    const now = new Date().toISOString();
    const c = {
      id: newId('c'), bookId: b.id, order: siblings.reduce((m, x) => Math.max(m, x.order), 0) + 1,
      title: str(body.title, 'titel', { max: 200 }), content: str(body.content, 'indhold', { required: false, max: 200000 }),
      published: false, createdAt: now, updatedAt: now, updatedBy: user.id, revisions: [],
    };
    db.chapters.push(c);
    touchBook(user, b);
    logActivity(user, b.subjectId, `Tilføjede kapitlet “${c.title}” i “${b.title}”`, `#/rediger-kapitel/${c.id}`);
    saveDb();
    return reply(201, c);
  });
  route('GET', '/api/chapters/:id', ({ user, params }) => {
    requireRole(user);
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    canSeeBook(user, b);
    if (user.role !== 'teacher' && !c.published) throw new HttpError(404, 'Kapitlet findes ikke');
    const chs = visibleChapters(user, b.id);
    const i = chs.findIndex((x) => x.id === c.id);
    const out = {
      id: c.id, bookId: b.id, bookTitle: b.title, subjectId: b.subjectId, color: (db.subjects.find((s) => s.id === b.subjectId) || {}).color,
      title: c.title, content: c.content, published: c.published, order: c.order,
      number: i + 1, total: chs.length, updatedAt: c.updatedAt, updatedBy: nameOf(c.updatedBy),
      prev: chs[i - 1] ? { id: chs[i - 1].id, title: chs[i - 1].title } : null,
      next: chs[i + 1] ? { id: chs[i + 1].id, title: chs[i + 1].title } : null,
    };
    if (user.role === 'teacher') out.revisions = c.revisions.map((r, idx) => ({ index: idx, title: r.title, savedAt: r.savedAt, savedBy: nameOf(r.savedBy), words: (r.content.match(/\S+/g) || []).length }));
    else out.read = db.reads.some((r) => r.userId === user.id && r.chapterId === c.id);
    return reply(200, out);
  });
  route('PUT', '/api/chapters/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    const title = body.title !== undefined ? str(body.title, 'titel', { max: 200 }) : c.title;
    const content = body.content !== undefined ? str(body.content, 'indhold', { required: false, max: 200000 }) : c.content;
    if (title !== c.title || content !== c.content) {
      c.revisions.unshift({ title: c.title, content: c.content, savedAt: c.updatedAt, savedBy: c.updatedBy });
      c.revisions = c.revisions.slice(0, MAX_REVISIONS);
      c.title = title; c.content = content;
      c.updatedAt = new Date().toISOString(); c.updatedBy = user.id;
      logActivity(user, b.subjectId, `Redigerede kapitlet “${c.title}” i “${b.title}”`, `#/rediger-kapitel/${c.id}`);
    }
    if (body.published !== undefined && !!body.published !== c.published) {
      c.published = !!body.published;
      logActivity(user, b.subjectId, `${c.published ? 'Udgav' : 'Gjorde kladde af'} kapitlet “${c.title}”`, `#/rediger-kapitel/${c.id}`);
    }
    touchBook(user, b);
    saveDb();
    return reply(200, { id: c.id, title: c.title, published: c.published, updatedAt: c.updatedAt, revisionCount: c.revisions.length });
  });
  route('GET', '/api/chapters/:id/revisions/:index', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    subjectFor(user, bookOr404(c.bookId).subjectId);
    const r = c.revisions[Number(params.index)];
    if (!r) throw new HttpError(404, 'Versionen findes ikke');
    return reply(200, { ...r, savedBy: nameOf(r.savedBy) });
  });
  route('POST', '/api/chapters/:id/restore/:index', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    const r = c.revisions[Number(params.index)];
    if (!r) throw new HttpError(404, 'Versionen findes ikke');
    c.revisions.unshift({ title: c.title, content: c.content, savedAt: c.updatedAt, savedBy: c.updatedBy });
    c.revisions = c.revisions.slice(0, MAX_REVISIONS);
    c.title = r.title; c.content = r.content; c.updatedAt = new Date().toISOString(); c.updatedBy = user.id;
    touchBook(user, b);
    logActivity(user, b.subjectId, `Gendannede en tidligere version af “${c.title}”`, `#/rediger-kapitel/${c.id}`);
    saveDb();
    return reply(200, { ok: true });
  });
  route('POST', '/api/chapters/:id/move', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    const chs = db.chapters.filter((x) => x.bookId === b.id).sort((x, y) => x.order - y.order);
    const i = chs.indexOf(c), j = i + (Number(body.dir) < 0 ? -1 : 1);
    if (j >= 0 && j < chs.length) { const o = chs[j].order; chs[j].order = c.order; c.order = o; touchBook(user, b); saveDb(); }
    return reply(200, { ok: true });
  });
  route('DELETE', '/api/chapters/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    db.chapters = db.chapters.filter((x) => x.id !== c.id);
    db.reads = db.reads.filter((r) => r.chapterId !== c.id);
    touchBook(user, b);
    logActivity(user, b.subjectId, `Slettede kapitlet “${c.title}” fra “${b.title}”`, `#/rediger-bog/${b.id}`);
    saveDb();
    return reply(200, { ok: true });
  });
  route('POST', '/api/chapters/:id/read', ({ user, params, body }) => {
    requireRole(user, 'student');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    canSeeBook(user, b);
    if (!c.published) throw new HttpError(404, 'Kapitlet findes ikke');
    db.reads = db.reads.filter((r) => !(r.userId === user.id && r.chapterId === c.id));
    if (body.read !== false) db.reads.push({ userId: user.id, chapterId: c.id, at: new Date().toISOString() });
    saveDb();
    return reply(200, { ok: true, read: body.read !== false });
  });

  // ---------- Lærerstudio ----------
  route('GET', '/api/studio', ({ user }) => {
    requireRole(user, 'teacher');
    const subs = mySubjects(user);
    const ids = new Set(subs.map((s) => s.id));
    const books = db.books.filter((b) => ids.has(b.subjectId));
    const bookIds = new Set(books.map((b) => b.id));
    const chapters = db.chapters.filter((c) => bookIds.has(c.bookId));
    const stats = {
      books: books.length, publishedBooks: books.filter((b) => b.published).length,
      chapters: chapters.length, draftChapters: chapters.filter((c) => !c.published).length,
      words: chapters.reduce((n, c) => n + (c.content.match(/\S+/g) || []).length, 0),
      materials: db.materials.filter((m) => ids.has(m.subjectId)).length,
      assignments: db.assignments.filter((a) => ids.has(a.subjectId)).length,
      lessons: db.lessons.filter((l) => ids.has(l.subjectId)).length,
    };
    const readers = (b) => {
      const s = db.subjects.find((x) => x.id === b.subjectId);
      const chs = chapters.filter((c) => c.bookId === b.id && c.published);
      if (!chs.length || !s.studentIds.length) return 0;
      const done = s.studentIds.filter((sid) => chs.every((c) => db.reads.some((r) => r.userId === sid && r.chapterId === c.id))).length;
      return Math.round((done / s.studentIds.length) * 100);
    };
    return reply(200, {
      stats,
      subjects: subs.map((s) => ({ id: s.id, code: s.code, name: s.name, color: s.color, description: s.description, studentCount: s.studentIds.length })),
      books: books.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map((b) => ({ ...bookSummary(user, b), completion: readers(b) })),
      activity: db.activity.filter((a) => ids.has(a.subjectId)).slice(0, 25).map((a) => ({ ...a, user: nameOf(a.userId), subjectName: (db.subjects.find((s) => s.id === a.subjectId) || {}).name })),
    });
  });

  // Kør en API-forespørgsel: returnerer { status, data, sid?, clearSid? }
  function handle(method, pathname, body, sid) {
    try {
      for (const r of routes) {
        const m = r.method === method && r.re.exec(pathname);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        return r.handler({ user: userFromSid(sid), params, body: body || {}, sid });
      }
      throw new HttpError(404, 'Ukendt adresse');
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      return reply(err.status || 500, { error: err instanceof HttpError ? err.message : 'Der opstod en fejl på serveren' });
    }
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
