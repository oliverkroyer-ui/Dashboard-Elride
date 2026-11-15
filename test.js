// Enkel API-test uden afhængigheder:  npm test
'use strict';
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.DB_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mns-')), 'db.json');
const { createServer, loadDb } = require('./server');

(async () => {
  loadDb(true);
  const server = createServer().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, cookie) => {
    const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json(), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  const login = async (u, p) => (await call('POST', '/api/login', { username: u, password: p })).cookie;

  try {
    assert.strictEqual((await call('GET', '/api/dashboard')).status, 401, 'kræver login');
    assert.strictEqual((await call('POST', '/api/login', { username: 'anna', password: 'forkert' })).status, 401);

    const anna = await login('anna', 'elev123');
    const lars = await login('lars', 'laerer123');
    const mette = await login('mette', 'laerer123');

    const dash = (await call('GET', '/api/dashboard', null, anna)).data;
    assert.ok(['Navigation', 'Skibsteknik', 'Søret'].every((n) => dash.subjects.some((s) => s.name === n)), 'eleven ser kernefagene');

    // Skema: lærer tilføjer lektion i eget fag, eleven ser den
    assert.strictEqual((await call('POST', '/api/subjects/s-nav/lessons', { weekday: 3, start: '14:00', end: '13:00' }, lars)).status, 400);
    const les = (await call('POST', '/api/subjects/s-nav/lessons', { weekday: 3, start: '14:00', end: '15:30', room: 'Simulator' }, lars)).data;
    assert.ok((await call('GET', '/api/schedule', null, anna)).data.lessons.some((l) => l.id === les.id));
    assert.strictEqual((await call('POST', '/api/subjects/s-tek/lessons', { weekday: 1, start: '08:00', end: '09:00' }, lars)).status, 403);

    // Beskeder: kun mellem elev og lærer med fælles fag
    assert.strictEqual((await call('POST', '/api/messages', { toId: 'u4', body: 'hej' }, anna)).status, 403, 'elev → elev ikke tilladt');
    assert.strictEqual((await call('POST', '/api/messages', { toId: 'u1', body: 'Hej Lars' }, anna)).status, 201);
    const lt = (await call('GET', '/api/messages', null, lars)).data.threads.find((t) => t.contact.username === 'anna');
    assert.ok(lt.unread >= 1 && lt.messages.some((m) => m.body === 'Hej Lars'));
    await call('POST', '/api/messages/read/u3', null, lars);
    assert.strictEqual((await call('GET', '/api/messages', null, lars)).data.threads.find((t) => t.contact.username === 'anna').unread, 0);

    // Færgenavigatør-elev har færgefagene, men ikke Søret
    const freja = await login('freja', 'elev123');
    const fd = (await call('GET', '/api/dashboard', null, freja)).data;
    assert.ok(fd.subjects.some((s) => s.name === 'El-drift') && !fd.subjects.some((s) => s.name === 'Søret'));
    assert.strictEqual((await call('GET', '/api/subjects/s-ret', null, freja)).status, 403);

    // Elev må ikke oprette materialer
    assert.strictEqual((await call('POST', '/api/subjects/s-nav/materials', { title: 'x' }, anna)).status, 403);
    // Lærer kun i egne fag
    assert.strictEqual((await call('POST', '/api/subjects/s-tek/materials', { title: 'x' }, lars)).status, 403);

    // Lærer opretter opgave → elev afleverer → lærer bedømmer → elev ser karakter
    const a = (await call('POST', '/api/subjects/s-ret/assignments', { title: 'Regel 15', description: 'Forklar regel 15', due: new Date(Date.now() + 864e5).toISOString() }, lars)).data;
    const sub = await call('POST', `/api/assignments/${a.id}/submissions`, { text: 'Skibet med det andet om styrbord skal vige.' }, anna);
    assert.strictEqual(sub.status, 201);
    assert.strictEqual((await call('POST', `/api/submissions/${sub.data.id}/grade`, { grade: '11' }, lars)).status, 400, 'kun 7-trinsskala');
    assert.strictEqual((await call('POST', `/api/submissions/${sub.data.id}/grade`, { grade: '12' }, mette)).status, 403, 'mette underviser ikke i søret');
    assert.strictEqual((await call('POST', `/api/submissions/${sub.data.id}/grade`, { grade: '12', feedback: 'Super' }, lars)).status, 200);
    assert.strictEqual((await call('POST', `/api/assignments/${a.id}/submissions`, { text: 'ændring' }, anna)).status, 409, 'låst efter bedømmelse');

    const grades = (await call('GET', '/api/dashboard', null, anna)).data.grades;
    assert.ok(grades.some((g) => g.assignmentId === a.id && g.grade === '12'));

    const book = (await call('GET', '/api/subjects/s-ret/gradebook', null, lars)).data;
    assert.ok(book.rows.find((r) => r.student.username === 'anna').cells.some((c) => c.grade === '12'));

    const peter = await login('peter', 'laerer123');
    const admin = await login('admin', 'admin123');

    // ---- Udgaver: eleven ser kun udgivet indhold ----
    assert.ok(!(await call('GET', '/api/books', null, freja)).data.books.some((b) => b.id === 'b-el'), 'uudgivet bog er skjult for elev');
    assert.strictEqual((await call('GET', '/api/books/b-el', null, freja)).status, 404);
    let ret = (await call('GET', '/api/books/b-ret', null, anna)).data;
    assert.strictEqual(ret.viewing.version, '2.3');
    assert.ok(!ret.chapters.some((c) => c.id === 'c-ret4'), 'kladdekapitel er ikke med i udgaven');
    assert.strictEqual((await call('GET', '/api/books/b-ret/chapters/c-ret4', null, anna)).status, 404);

    // Underviseren retter et udgivet kapitel – eleven ser stadig den udgivne tekst
    assert.strictEqual((await call('PUT', '/api/chapters/c-ret1', { content: 'x' }, mette)).status, 403, 'kun egne fag');
    await call('PUT', '/api/chapters/c-ret1', { content: 'Ny indledning til søvejsreglerne.' }, lars);
    let annaCh = (await call('GET', '/api/books/b-ret/chapters/c-ret1', null, anna)).data;
    assert.ok(annaCh.content.includes('COLREG'), 'eleven ser ikke ufærdige ændringer');
    const revs = (await call('GET', '/api/chapters/c-ret1', null, lars)).data.revisions;
    assert.ok(revs.length >= 1);
    await call('POST', '/api/chapters/c-ret1/restore/0', null, lars);
    assert.ok((await call('GET', '/api/chapters/c-ret1', null, lars)).data.content.includes('COLREG'), 'gendannelse virker');

    // ---- Formler: kontrol finder fejl, beregning virker ----
    const fx = (await call('GET', '/api/formulas', null, lars)).data.formulas;
    assert.ok(fx.find((f) => f.key === 'gm').issues.length === 0, 'GM-formlen er fejlfri');
    assert.ok(fx.find((f) => f.key === 'kraengning-gammel').issues.some((i) => i.level === 'fejl'), 'fejl i gammel formel opdages');
    const check = (await call('POST', '/api/assistant', { command: 'tjek-formler' }, lars)).data;
    assert.ok(check.broken.some((b) => b.ref === '{{formel:trim-gammel}}'), 'henvisning til ukendt formel opdages');
    const tasks = (await call('POST', '/api/assistant', { command: 'opgaver', category: 'stabilitet', count: 5, seed: 7 }, mette)).data.tasks;
    assert.strictEqual(tasks.length, 5); assert.ok(tasks[0].answer.includes('='));

    // ---- Lovændring: forslag → godkend → én ændring opdaterer alle kapitler ----
    const change = (await call('GET', '/api/legal/changes/lc-demo1', null, lars)).data;
    const kinds = change.proposals.map((p) => p.kind);
    assert.ok(['kilde', 'fakta', 'tekst', 'gennemse'].every((k) => kinds.includes(k)), 'alle forslagstyper laves: ' + kinds);
    assert.strictEqual((await call('POST', `/api/proposals/${change.proposals[0].id}/decide`, { decision: 'godkend' }, anna)).status, 403, 'elever kan ikke godkende');
    for (const p of change.proposals) {
      const r = await call('POST', `/api/proposals/${p.id}/decide`, { decision: 'godkend' }, lars);
      assert.strictEqual(r.status, 200, JSON.stringify(r.data));
    }
    const after = (await call('GET', '/api/legal', null, lars)).data;
    assert.strictEqual(after.changes.find((c) => c.id === 'lc-demo1').status, 'afsluttet');
    assert.ok(after.log.length >= change.proposals.length, 'ændringerne er dokumenteret');
    assert.ok(after.log.some((l) => l.source.includes('STCW') && l.effectiveFrom === '2027-07-01'), 'dokumentation har kilde og dato');
    const ret3 = (await call('GET', '/api/chapters/c-ret3', null, lars)).data;
    assert.ok(ret3.content.includes('{{fakta:hvile-7d}}'), 'fritekst er erstattet med henvisning');
    assert.strictEqual(ret3.refs.facts['hvile-7d'].value, '80');
    // Eleven ser stadig den gamle udgave, indtil der udgives
    annaCh = (await call('GET', '/api/books/b-ret/chapters/c-ret2', null, anna)).data;
    assert.strictEqual(annaCh.refs.facts['hvile-7d'].value, '77');

    // ---- Udgiv ny version → eleven får besked og kan se ændringerne ----
    const pending = (await call('GET', '/api/books/b-ret/pending', null, lars)).data;
    assert.ok(pending.changes.some((c) => c.chapterId === 'c-ret2'), 'godkendte centrale oplysninger kommer automatisk med');
    assert.ok(!pending.changes.some((c) => c.chapterId === 'c-ret3'), 'tekstændringer kræver, at kapitlet er markeret klar');
    await call('PUT', '/api/chapters/c-ret3', { ready: true }, lars);
    const pending2 = (await call('GET', '/api/books/b-ret/pending', null, lars)).data;
    assert.ok(pending2.changeCount >= 2 && pending2.next.minor === '2.4', JSON.stringify(pending2.next));
    const pub = await call('POST', '/api/books/b-ret/publish', { kind: 'minor', notes: 'Nye krav til hviletid' }, lars);
    assert.strictEqual(pub.status, 201); assert.strictEqual(pub.data.version, '2.4');
    assert.strictEqual((await call('POST', '/api/books/b-ret/publish', { kind: 'minor' }, lars)).status, 409, 'kan ikke udgive uden ændringer');
    const notes = (await call('GET', '/api/notifications', null, anna)).data;
    assert.ok(notes.notifications.some((n) => n.text.includes('version 2.4')), 'eleven får besked');
    const diff = (await call('GET', `/api/editions/${pub.data.id}/changes`, null, anna)).data;
    assert.strictEqual(diff.previous, '2.3');
    assert.ok(JSON.stringify(diff.changes).includes('80'), 'ændringslisten viser den nye værdi');
    annaCh = (await call('GET', '/api/books/b-ret/chapters/c-ret2', null, anna)).data;
    assert.strictEqual(annaCh.refs.facts['hvile-7d'].value, '80');
    // Ét kapitel kan udgives alene
    await call('PUT', '/api/chapters/c-ret4', { content: 'Skibsføreren har det overordnede ansvar.' }, lars);
    const one = await call('POST', '/api/books/b-ret/publish', { scope: 'kapitel', chapterId: 'c-ret4' }, lars);
    assert.strictEqual(one.data.version, '2.5'); assert.strictEqual(one.data.scope, 'kapitel');

    // ---- Elev: søg, bogmærke, noter, læst ----
    const found = (await call('GET', '/api/search?q=hviletid', null, anna)).data.results;
    assert.ok(found.some((r) => r.chapterId === 'c-ret2'));
    assert.strictEqual((await call('POST', '/api/bookmarks', { bookId: 'b-ret', chapterId: 'c-ret2', label: 'Hviletid' }, anna)).status, 201);
    await call('PUT', '/api/notes/c-ret2', { bookId: 'b-ret', text: 'Spørg til eksamen' }, anna);
    const mine = (await call('GET', '/api/bookmarks', null, anna)).data;
    assert.ok(mine.bookmarks.some((b) => b.label === 'Hviletid') && mine.notes.some((n) => n.text === 'Spørg til eksamen'));
    assert.strictEqual((await call('POST', '/api/chapters/c-ret2/read', {}, anna)).status, 200);
    assert.strictEqual((await call('POST', '/api/chapters/c-ret2/read', {}, freja)).status, 403, 'freja har ikke Søret');
    // PDF kun hvis underviseren tillader det
    assert.strictEqual((await call('GET', '/api/books/b-stab/export', null, anna)).status, 403);
    assert.strictEqual((await call('GET', '/api/books/b-ret/export', null, anna)).status, 200);

    // ---- Central oplysning ændres ét sted ----
    const facts = (await call('GET', '/api/facts', null, mette)).data.facts;
    const rho = facts.find((f) => f.key === 'rho-salt');
    assert.ok(rho.usage.length >= 1);
    await call('PUT', `/api/facts/${rho.id}`, { value: '1,026', why: 'test' }, mette);
    assert.strictEqual((await call('GET', '/api/chapters/c-stab3', null, mette)).data.refs.facts['rho-salt'].value, '1,026');

    // ---- Import, ny bog og administration ----
    const nb = (await call('POST', '/api/subjects/s-el/books', { title: 'Ladeanlæg' }, peter)).data;
    const imp = await call('POST', `/api/books/${nb.id}/import`, { fileName: 'noter.docx', chapters: [{ title: 'Intro', content: 'Hej' }, { title: 'Del', content: 'x', level: 2 }] }, peter);
    assert.strictEqual(imp.data.created, 2);
    const nbView = (await call('GET', `/api/books/${nb.id}`, null, peter)).data;
    assert.ok(nbView.chapters[1].parentId === nbView.chapters[0].id, 'underkapitel ved import');
    assert.strictEqual((await call('POST', '/api/admin/users', { name: 'X', username: 'xlaerer', role: 'teacher', password: 'hemmelig123' }, lars)).status, 403, 'kun admin opretter undervisere');
    const newStudent = await call('POST', '/api/admin/users', { name: 'Ny Elev', username: 'nyelev', role: 'student', password: 'hemmelig123' }, lars);
    assert.strictEqual(newStudent.status, 201);
    const grp = await call('POST', '/api/admin/groups', { name: 'Hold B', studentIds: [newStudent.data.id], subjectIds: ['s-nav'] }, lars);
    assert.strictEqual(grp.status, 201);
    const ny = await login('nyelev', 'hemmelig123');
    assert.ok((await call('GET', '/api/books', null, ny)).data.books.some((b) => b.id === 'b-nav'), 'gruppen giver adgang til fagets bøger');
    assert.strictEqual((await call('POST', '/api/admin/products', { name: 'x' }, lars)).status, 403);
    assert.strictEqual((await call('POST', '/api/admin/products', { name: 'Pakke', kind: 'fagpakke', price: 99 }, admin)).status, 201);
    assert.ok((await call('GET', '/api/me/data', null, anna)).data.notes.length >= 1, 'indsigt i egne data');

    // Redigér alt: fag, materialer, opgaver
    assert.strictEqual((await call('PUT', '/api/subjects/s-nav', { description: 'Ny beskrivelse', color: '#123456' }, lars)).status, 200);
    assert.strictEqual((await call('PUT', '/api/subjects/s-nav', { color: 'rød' }, lars)).status, 400);
    assert.strictEqual((await call('PUT', '/api/materials/m1', { title: 'Opdateret', content: 'x' }, lars)).status, 200);
    assert.strictEqual((await call('PUT', '/api/materials/m1', { title: 'x' }, anna)).status, 403);
    const ov = (await call('GET', '/api/teacher/overview', null, lars)).data;
    assert.ok(ov.books.length >= 2 && ov.formulas.count >= 9);
    assert.strictEqual((await call('GET', '/api/teacher/overview', null, anna)).status, 403);

    // Path traversal
    const r = await fetch(base + '/..%2fserver.js');
    assert.ok(!(await r.text()).includes('createServer'), 'ingen adgang til filer uden for public/');

    console.log('✔ Alle tests bestået');
  } catch (e) {
    console.error('✘', e.message); process.exitCode = 1;
  } finally { server.close(); }
})();
