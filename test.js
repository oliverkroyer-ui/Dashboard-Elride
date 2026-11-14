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

    // Uddannelsesinfo kræver login og viser elevens egen uddannelse
    assert.strictEqual((await call('GET', '/api/my-education')).status, 401);
    assert.strictEqual((await call('GET', '/api/my-education', null, anna)).data.education.id, 'skibsfoerer');

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

    // Path traversal
    const r = await fetch(base + '/..%2fserver.js');
    assert.ok(!(await r.text()).includes('createServer'), 'ingen adgang til filer uden for public/');

    console.log('✔ Alle tests bestået');
  } catch (e) {
    console.error('✘', e.message); process.exitCode = 1;
  } finally { server.close(); }
})();
