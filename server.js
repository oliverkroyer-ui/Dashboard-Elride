// Marstal Navigationsskole – elev- og lærerportal
// Kører uden eksterne pakker:  node server.js   →  http://localhost:3000
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { seed } = require('./seed');
const school = require('./school');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 timer
const GRADES = ['12', '10', '7', '4', '02', '00', '-3']; // 7-trinsskalaen

// ---------- Adgangskoder ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

// ---------- Database (JSON-fil) ----------
let db;
function loadDb(reset = false) {
  if (!reset && fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db.lessons = db.lessons || [];
    db.messages = db.messages || [];
  } else {
    db = seed(hashPassword);
    saveDb();
  }
}
function saveDb() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
const newId = (prefix) => `${prefix}${crypto.randomBytes(6).toString('hex')}`;

// ---------- Sessioner ----------
const sessions = new Map(); // token -> { userId, expires }
function getUser(req) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p.length === 2)
  );
  const s = sessions.get(cookies.sid);
  if (!s || s.expires < Date.now()) { if (s) sessions.delete(cookies.sid); return null; }
  s.expires = Date.now() + SESSION_TTL_MS;
  return db.users.find((u) => u.id === s.userId) || null;
}
const educationName = (id) => (school.educations.find((e) => e.id === id) || {}).name || null;
const publicUser = (u) => u && ({ id: u.id, username: u.username, name: u.name, role: u.role, className: u.className || null, educationId: u.educationId || null, education: educationName(u.educationId) });

// ---------- Hjælpere ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new HttpError(413, 'For stor forespørgsel')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Ugyldig JSON')); }
    });
    req.on('error', reject);
  });
}
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

route('POST', '/api/login', async (req, res, { body }) => {
  const username = str(body.username, 'brugernavn', { max: 100 }).toLowerCase();
  const password = str(body.password, 'adgangskode', { max: 200 });
  const user = db.users.find((u) => u.username === username);
  if (!user || !verifyPassword(password, user.password)) throw new HttpError(401, 'Forkert brugernavn eller adgangskode');
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_TTL_MS });
  send(res, 200, { user: publicUser(user) }, {
    'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
  });
});

route('POST', '/api/logout', async (req, res) => {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  if (m) sessions.delete(m[1]);
  send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
});

// Elevens egen uddannelse (info fra marnav.dk)
route('GET', '/api/my-education', async (req, res, { user }) => {
  requireRole(user);
  const education = school.educations.find((e) => e.id === user.educationId) || null;
  send(res, 200, { education, contact: school.contact, practical: school.practical, source: school.source });
});

route('GET', '/api/me', async (req, res, { user }) => {
  requireRole(user);
  send(res, 200, { user: publicUser(user), grades: GRADES });
});

route('GET', '/api/dashboard', async (req, res, { user }) => {
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
  send(res, 200, out);
});

route('GET', '/api/subjects/:id', async (req, res, { user, params }) => {
  requireRole(user);
  const s = subjectFor(user, params.id);
  const out = {
    ...subjectSummary(s, user),
    materials: db.materials.filter((m) => m.subjectId === s.id).sort(byDateDesc('createdAt')).map((m) => ({ ...m, author: nameOf(m.authorId) })),
    assignments: db.assignments.filter((a) => a.subjectId === s.id).sort((a, b) => a.due.localeCompare(b.due)).map((a) => assignmentView(a, user, s)),
    announcements: db.announcements.filter((n) => n.subjectId === s.id).sort(byDateDesc('createdAt')).map((n) => ({ ...n, author: nameOf(n.authorId) })),
  };
  if (user.role === 'teacher') {
    out.students = s.studentIds.map((id) => publicUser(db.users.find((u) => u.id === id))).filter(Boolean);
  }
  send(res, 200, out);
});

// Lærer: opret indhold
route('POST', '/api/subjects/:id/materials', async (req, res, { user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const m = { id: newId('m'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), content: str(body.content, 'indhold', { required: false }), link: safeLink(body.link), createdAt: new Date().toISOString(), authorId: user.id };
  db.materials.push(m); saveDb();
  send(res, 201, m);
});

route('POST', '/api/subjects/:id/assignments', async (req, res, { user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const due = new Date(str(body.due, 'afleveringsfrist', { max: 40 }));
  if (isNaN(due)) throw new HttpError(400, 'Ugyldig afleveringsfrist');
  const a = { id: newId('a'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), description: str(body.description, 'beskrivelse'), due: due.toISOString(), createdAt: new Date().toISOString(), authorId: user.id };
  db.assignments.push(a); saveDb();
  send(res, 201, a);
});

route('POST', '/api/subjects/:id/announcements', async (req, res, { user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const n = { id: newId('n'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), body: str(body.body, 'tekst'), createdAt: new Date().toISOString(), authorId: user.id };
  db.announcements.push(n); saveDb();
  send(res, 201, n);
});

// Lærer: slet indhold
for (const [coll, label] of [['materials', 'Materialet'], ['assignments', 'Opgaven'], ['announcements', 'Opslaget']]) {
  route('DELETE', `/api/${coll}/:id`, async (req, res, { user, params }) => {
    requireRole(user, 'teacher');
    const item = db[coll].find((x) => x.id === params.id);
    if (!item) throw new HttpError(404, `${label} findes ikke`);
    subjectFor(user, item.subjectId);
    db[coll] = db[coll].filter((x) => x.id !== item.id);
    if (coll === 'assignments') db.submissions = db.submissions.filter((x) => x.assignmentId !== item.id);
    saveDb();
    send(res, 200, { ok: true });
  });
}

// Elev: aflever opgave (kan genafleveres indtil den er bedømt)
route('POST', '/api/assignments/:id/submissions', async (req, res, { user, params, body }) => {
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
  send(res, 201, sub);
});

// Lærer: se afleveringer og giv karakter
route('GET', '/api/assignments/:id/submissions', async (req, res, { user, params }) => {
  requireRole(user, 'teacher');
  const a = db.assignments.find((x) => x.id === params.id);
  if (!a) throw new HttpError(404, 'Opgaven findes ikke');
  const s = subjectFor(user, a.subjectId);
  const rows = s.studentIds.map((sid) => ({
    student: publicUser(db.users.find((u) => u.id === sid)),
    submission: db.submissions.find((x) => x.assignmentId === a.id && x.studentId === sid) || null,
  }));
  send(res, 200, { assignment: { ...a, subjectName: s.name }, rows });
});

route('POST', '/api/submissions/:id/grade', async (req, res, { user, params, body }) => {
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
  send(res, 200, sub);
});

// Lærer: karakteroversigt for et fag
route('GET', '/api/subjects/:id/gradebook', async (req, res, { user, params }) => {
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
  send(res, 200, { subject: { id: s.id, name: s.name }, assignments: assignments.map((a) => ({ id: a.id, title: a.title, due: a.due })), rows });
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
route('GET', '/api/schedule', async (req, res, { user }) => {
  requireRole(user);
  send(res, 200, { lessons: lessonsFor(user) });
});
route('POST', '/api/subjects/:id/lessons', async (req, res, { user, params, body }) => {
  requireRole(user, 'teacher');
  const s = subjectFor(user, params.id);
  const weekday = Number(body.weekday);
  if (!(weekday >= 1 && weekday <= 5)) throw new HttpError(400, 'Vælg en ugedag (mandag–fredag)');
  const start = str(body.start, 'starttid', { max: 5 }), end = str(body.end, 'sluttid', { max: 5 });
  if (!TIME_RE.test(start) || !TIME_RE.test(end) || end <= start) throw new HttpError(400, 'Ugyldigt tidsrum');
  const l = { id: newId('l'), subjectId: s.id, weekday, start, end, room: str(body.room, 'lokale', { max: 80, required: false }), teacherId: user.id };
  db.lessons.push(l); saveDb();
  send(res, 201, l);
});
route('DELETE', '/api/lessons/:id', async (req, res, { user, params }) => {
  requireRole(user, 'teacher');
  const l = db.lessons.find((x) => x.id === params.id);
  if (!l) throw new HttpError(404, 'Lektionen findes ikke');
  subjectFor(user, l.subjectId);
  db.lessons = db.lessons.filter((x) => x.id !== l.id); saveDb();
  send(res, 200, { ok: true });
});

// ---------- Beskeder (elev ↔ lærer i fælles fag) ----------
function contactsOf(user) {
  const ids = new Set();
  for (const s of mySubjects(user)) (user.role === 'teacher' ? s.studentIds : s.teacherIds).forEach((id) => ids.add(id));
  ids.delete(user.id);
  return [...ids].map((id) => db.users.find((u) => u.id === id)).filter(Boolean);
}
route('GET', '/api/messages', async (req, res, { user }) => {
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
  send(res, 200, { threads });
});
route('POST', '/api/messages', async (req, res, { user, body }) => {
  requireRole(user);
  const to = contactsOf(user).find((c) => c.id === body.toId);
  if (!to) throw new HttpError(403, 'Du kan kun skrive til dine lærere/elever');
  const m = { id: newId('msg'), fromId: user.id, toId: to.id, body: str(body.body, 'besked', { max: 5000 }), createdAt: new Date().toISOString(), read: false };
  db.messages.push(m); saveDb();
  send(res, 201, m);
});
route('POST', '/api/messages/read/:contactId', async (req, res, { user, params }) => {
  requireRole(user);
  let n = 0;
  for (const m of db.messages) if (m.toId === user.id && m.fromId === params.contactId && !m.read) { m.read = true; n++; }
  if (n) saveDb();
  send(res, 200, { ok: true, marked: n });
});

// ---------- Statiske filer ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'",
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- Server ----------
function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      if (!pathname.startsWith('/api/')) return serveStatic(req, res, decodeURIComponent(pathname));
      for (const r of routes) {
        const m = r.method === req.method && r.re.exec(pathname);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
        return await r.handler(req, res, { user: getUser(req), params, body });
      }
      throw new HttpError(404, 'Ukendt adresse');
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      send(res, err.status || 500, { error: err instanceof HttpError ? err.message : 'Der opstod en fejl på serveren' });
    }
  });
}

if (require.main === module) {
  loadDb(process.argv.includes('--reset'));
  if (process.argv.includes('--reset')) console.log('Databasen er nulstillet med demodata.');
  createServer().listen(PORT, HOST, () => {
    console.log(`\n⚓ Marstal Navigationsskole – portal kører på http://localhost:${PORT}\n`);
    console.log('   Lærere: lars / laerer123   ·   mette / laerer123');
    console.log('   Elever: anna / elev123     ·   jonas / elev123   ·   freja / elev123\n');
  });
}

module.exports = { createServer, loadDb };
