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
