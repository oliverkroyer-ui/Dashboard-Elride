// Modul: administration – brugere, elevgrupper (hold), fag og produkter/adgangspakker.
// Adgangsniveauer: administrator > underviser > elev.
//   Administrator: alt.  Underviser: egne fag, oprette fag, elever og hold.  Elev: egen læsning.
(function (root) {
'use strict';

function install(ctx) {
  const { route, reply, HttpError, str, requireRole, subjectFor, mySubjects, nameOf, newId, saveDb, publicUser, isStaff } = ctx;
  const db = () => ctx.db;
  const ROLES = ['student', 'teacher', 'admin'];
  const requireAdmin = (u) => { requireRole(u); if (u.role !== 'admin') throw new HttpError(403, 'Kun administratorer har adgang til dette'); };

  route('GET', '/api/admin/overview', ({ user }) => {
    requireRole(user, 'teacher');
    const subs = mySubjects(user);
    const visibleUsers = user.role === 'admin' ? db().users : db().users.filter((u) => u.role === 'student' || u.id === user.id);
    return reply(200, {
      isAdmin: user.role === 'admin',
      users: visibleUsers.map((u) => ({ ...publicUser(u), subjects: db().subjects.filter((s) => s.studentIds.includes(u.id) || s.teacherIds.includes(u.id)).map((s) => s.code) })),
      teachers: db().users.filter((u) => u.role !== 'student').map(publicUser),
      subjects: (user.role === 'admin' ? db().subjects : subs).map((s) => ({ id: s.id, code: s.code, name: s.name, color: s.color, teachers: s.teacherIds.map(nameOf), studentIds: s.studentIds })),
      groups: db().groups.map((g) => ({ ...g, students: g.studentIds.map(nameOf), subjectNames: g.subjectIds.map((id) => (db().subjects.find((s) => s.id === id) || {}).name).filter(Boolean) })),
      products: db().products,
      commerce: db().settings && db().settings.commerce ? db().settings.commerce : { enabled: false },
    });
  });

  // ---------- Brugere ----------
  route('POST', '/api/admin/users', ({ user, body }) => {
    requireRole(user, 'teacher');
    const role = ROLES.includes(body.role) ? body.role : 'student';
    if (role !== 'student' && user.role !== 'admin') throw new HttpError(403, 'Kun administratorer kan oprette undervisere');
    const username = str(body.username, 'brugernavn', { max: 40 }).toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new HttpError(400, 'Brugernavnet må kun indeholde små bogstaver, tal, punktum og bindestreg (mindst 3 tegn)');
    if (db().users.some((u) => u.username === username)) throw new HttpError(409, 'Brugernavnet er optaget');
    const password = str(body.password, 'adgangskode', { max: 200 });
    if (password.length < 8) throw new HttpError(400, 'Adgangskoden skal være mindst 8 tegn');
    const u = { id: newId('u'), username, name: str(body.name, 'navn', { max: 100 }), role, className: str(body.className, 'hold', { max: 100, required: false }), password: ctx.hashPassword(password) };
    db().users.push(u);
    ctx.logActivity(user, null, `Oprettede ${role === 'student' ? 'eleven' : role === 'admin' ? 'administratoren' : 'underviseren'} ${u.name}`, '#/admin');
    saveDb();
    return reply(201, publicUser(u));
  });
  route('PUT', '/api/admin/users/:id', ({ user, params, body }) => {
    requireAdmin(user);
    const u = db().users.find((x) => x.id === params.id);
    if (!u) throw new HttpError(404, 'Brugeren findes ikke');
    if (body.name !== undefined) u.name = str(body.name, 'navn', { max: 100 });
    if (body.className !== undefined) u.className = str(body.className, 'hold', { max: 100, required: false });
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) throw new HttpError(400, 'Ukendt rolle');
      if (u.id === user.id && body.role !== 'admin') throw new HttpError(400, 'Du kan ikke fjerne din egen administratorrolle');
      u.role = body.role;
    }
    if (body.password) { if (String(body.password).length < 8) throw new HttpError(400, 'Adgangskoden skal være mindst 8 tegn'); u.password = ctx.hashPassword(String(body.password)); }
    saveDb();
    return reply(200, publicUser(u));
  });
  route('DELETE', '/api/admin/users/:id', ({ user, params }) => {
    requireAdmin(user);
    if (params.id === user.id) throw new HttpError(400, 'Du kan ikke slette dig selv');
    const u = db().users.find((x) => x.id === params.id);
    if (!u) throw new HttpError(404, 'Brugeren findes ikke');
    // Persondata: fjern brugerens personlige data sammen med brugeren
    db().users = db().users.filter((x) => x.id !== u.id);
    for (const s of db().subjects) { s.studentIds = s.studentIds.filter((x) => x !== u.id); s.teacherIds = s.teacherIds.filter((x) => x !== u.id); }
    for (const g of db().groups) g.studentIds = g.studentIds.filter((x) => x !== u.id);
    for (const k of ['reads', 'bookmarks', 'notes', 'notifications']) db()[k] = db()[k].filter((x) => x.userId !== u.id);
    db().submissions = db().submissions.filter((x) => x.studentId !== u.id);
    db().messages = db().messages.filter((m) => m.fromId !== u.id && m.toId !== u.id);
    ctx.logActivity(user, null, `Slettede brugeren ${u.name} og brugerens personlige data`, '#/admin');
    saveDb();
    return reply(200, { ok: true });
  });
  // Indsigt: en bruger kan hente alle sine egne data (GDPR art. 15)
  route('GET', '/api/me/data', ({ user }) => {
    requireRole(user);
    const mine = (k) => db()[k].filter((x) => x.userId === user.id);
    return reply(200, {
      user: publicUser(user), notes: mine('notes'), bookmarks: mine('bookmarks'), reads: mine('reads'),
      submissions: db().submissions.filter((x) => x.studentId === user.id),
      messages: db().messages.filter((m) => m.fromId === user.id || m.toId === user.id),
    });
  });

  // ---------- Fag ----------
  route('POST', '/api/admin/subjects', ({ user, body }) => {
    requireRole(user, 'teacher');
    const code = str(body.code, 'fagkode', { max: 8 }).toUpperCase();
    if (db().subjects.some((s) => s.code === code)) throw new HttpError(409, 'Fagkoden er allerede i brug');
    const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : '#134a7a';
    const teacherIds = user.role === 'admin' && Array.isArray(body.teacherIds) && body.teacherIds.length ? body.teacherIds.filter((id) => db().users.some((u) => u.id === id && isStaff(u))) : [user.id];
    const s = { id: newId('s-'), code, name: str(body.name, 'navn', { max: 100 }), description: str(body.description, 'beskrivelse', { max: 1000, required: false }), color, teacherIds, studentIds: [] };
    db().subjects.push(s);
    ctx.logActivity(user, s.id, `Oprettede faget ${s.code} · ${s.name}`, `#/fag/${s.id}`);
    saveDb();
    return reply(201, s);
  });
  route('POST', '/api/admin/subjects/:id/students', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const s = subjectFor(user, params.id);
    const ids = (Array.isArray(body.studentIds) ? body.studentIds : []).filter((id) => db().users.some((u) => u.id === id && u.role === 'student'));
    s.studentIds = [...new Set(ids)];
    saveDb();
    return reply(200, { ok: true, count: s.studentIds.length });
  });

  // ---------- Elevgrupper (hold) ----------
  // En gruppe samler elever og giver dem adgang til de valgte fag på én gang.
  function applyGroup(g) {
    for (const s of db().subjects) if (g.subjectIds.includes(s.id)) s.studentIds = [...new Set([...s.studentIds, ...g.studentIds])];
  }
  function readGroup(user, body) {
    const allowedSubjects = new Set(mySubjects(user).map((s) => s.id));
    return {
      name: str(body.name, 'navn', { max: 100 }),
      studentIds: (Array.isArray(body.studentIds) ? body.studentIds : []).filter((id) => db().users.some((u) => u.id === id && u.role === 'student')),
      subjectIds: (Array.isArray(body.subjectIds) ? body.subjectIds : []).filter((id) => allowedSubjects.has(id)),
    };
  }
  route('POST', '/api/admin/groups', ({ user, body }) => {
    requireRole(user, 'teacher');
    const g = { id: newId('g'), ...readGroup(user, body), createdBy: user.id };
    db().groups.push(g); applyGroup(g);
    ctx.logActivity(user, null, `Oprettede elevgruppen ${g.name} (${g.studentIds.length} elever)`, '#/admin');
    saveDb();
    return reply(201, g);
  });
  route('PUT', '/api/admin/groups/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const g = db().groups.find((x) => x.id === params.id);
    if (!g) throw new HttpError(404, 'Gruppen findes ikke');
    Object.assign(g, readGroup(user, body)); applyGroup(g);
    saveDb();
    return reply(200, g);
  });
  route('DELETE', '/api/admin/groups/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    db().groups = db().groups.filter((x) => x.id !== params.id); saveDb();
    return reply(200, { ok: true });
  });

  // ---------- Produkter og adgangspakker (forberedt til salg – ingen betaling i version 1) ----------
  const KINDS = ['bog', 'fagpakke', 'abonnement', 'licens', 'eksamenspakke'];
  function readProduct(body) {
    return {
      name: str(body.name, 'navn', { max: 150 }), kind: KINDS.includes(body.kind) ? body.kind : 'bog',
      description: str(body.description, 'beskrivelse', { max: 1000, required: false }),
      price: Math.max(0, Number(body.price) || 0), interval: ['engang', 'måned', 'år'].includes(body.interval) ? body.interval : 'engang',
      bookIds: Array.isArray(body.bookIds) ? body.bookIds.filter((id) => db().books.some((b) => b.id === id)) : [],
      subjectIds: Array.isArray(body.subjectIds) ? body.subjectIds.filter((id) => db().subjects.some((s) => s.id === id)) : [],
      active: !!body.active,
    };
  }
  route('POST', '/api/admin/products', ({ user, body }) => {
    requireAdmin(user);
    const p = { id: newId('p'), ...readProduct(body), createdAt: new Date().toISOString() };
    db().products.push(p); saveDb();
    return reply(201, p);
  });
  route('PUT', '/api/admin/products/:id', ({ user, params, body }) => {
    requireAdmin(user);
    const p = db().products.find((x) => x.id === params.id);
    if (!p) throw new HttpError(404, 'Produktet findes ikke');
    Object.assign(p, readProduct(body)); saveDb();
    return reply(200, p);
  });
  route('DELETE', '/api/admin/products/:id', ({ user, params }) => {
    requireAdmin(user);
    db().products = db().products.filter((x) => x.id !== params.id); saveDb();
    return reply(200, { ok: true });
  });
}

const mod = { install };
if (typeof module !== 'undefined' && module.exports) module.exports = mod;
else (root.PortalModules = root.PortalModules || []).push(mod);
})(this);
