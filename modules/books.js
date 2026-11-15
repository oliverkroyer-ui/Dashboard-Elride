// Modul: undervisningsbøger, kapitler (med underkapitler), udgaver, elevlæsning,
// søgning, bogmærker, noter, notifikationer og underviserens overblik.
//
// Princip: underviseren arbejder altid i en arbejdskopi. Eleverne læser kun
// den seneste UDGAVE – et låst øjebliksbillede med tekst, oplysninger, formler
// og retskilder, som det så ud, da underviseren trykkede "Udgiv".
(function (root) {
'use strict';
const Diff = (typeof module !== 'undefined' && module.exports) ? require('../shared/diff') : root.PortalDiff;

function install(ctx) {
  const { route, reply, HttpError, str, requireRole, subjectFor, mySubjects, nameOf, newId, saveDb, isStaff } = ctx;
  const db = () => ctx.db;
  const now = () => new Date().toISOString();
  const words = (s) => (String(s || '').match(/\S+/g) || []).length;
  const MAX_REVISIONS = 40;

  const bookOr404 = (id) => { const b = db().books.find((x) => x.id === id); if (!b) throw new HttpError(404, 'Bogen findes ikke'); return b; };
  const chapterOr404 = (id) => { const c = db().chapters.find((x) => x.id === id); if (!c) throw new HttpError(404, 'Kapitlet findes ikke'); return c; };
  const editionsOf = (bookId) => db().editions.filter((e) => e.bookId === bookId).sort((a, b) => a.major - b.major || a.minor - b.minor);
  const latestEdition = (bookId) => { const e = editionsOf(bookId); return e[e.length - 1] || null; };
  const subjectOf = (b) => db().subjects.find((s) => s.id === b.subjectId) || {};
  const workingChapters = (bookId) => db().chapters.filter((c) => c.bookId === bookId).sort((a, b) => a.order - b.order);
  // Kapitler i læserækkefølge: hovedkapitel efterfulgt af dets underkapitler
  function ordered(list) {
    const tops = list.filter((c) => !c.parentId || !list.some((x) => x.id === c.parentId)).sort((a, b) => a.order - b.order);
    const out = [];
    for (const t of tops) { out.push(t); list.filter((c) => c.parentId === t.id).sort((a, b) => a.order - b.order).forEach((c) => out.push(c)); }
    return out;
  }
  function numbering(list) {
    const nums = {}; let top = 0; const sub = {};
    for (const c of ordered(list)) {
      if (!c.parentId || !nums[c.parentId]) { top++; nums[c.id] = String(top); }
      else { sub[c.parentId] = (sub[c.parentId] || 0) + 1; nums[c.id] = `${nums[c.parentId]}.${sub[c.parentId]}`; }
    }
    return nums;
  }

  // Elever ser en bog, når den har mindst én udgave og ikke er skjult
  function canRead(user, b) {
    subjectFor(user, b.subjectId);
    if (!isStaff(user) && (b.hidden || !latestEdition(b.id))) throw new HttpError(404, 'Bogen findes ikke');
  }

  // ---------- Status for arbejdskopien i forhold til seneste udgave ----------
  function chapterStatus(c, latest) {
    if (!latest) return 'ny';
    const pub = latest.chapters.find((x) => x.id === c.id);
    if (!pub) return 'ny';
    if (pub.title !== c.title || pub.content !== c.content || (pub.parentId || null) !== (c.parentId || null)) return 'ændret';
    // Har en central oplysning, formel eller retskilde, som kapitlet bruger, ændret sig siden udgivelsen?
    const snap = ctx.snapshotFor([c.content]);
    const old = latest.refs || { facts: {}, formulas: {}, sources: {} };
    for (const k of Object.keys(snap.facts)) if (!old.facts[k] || old.facts[k].value !== snap.facts[k].value) return 'opdateret indhold';
    for (const k of Object.keys(snap.formulas)) if (JSON.stringify(old.formulas[k]) !== JSON.stringify(snap.formulas[k])) return 'opdateret indhold';
    for (const k of Object.keys(snap.sources)) if (!old.sources[k] || old.sources[k].text !== snap.sources[k].text) return 'opdateret indhold';
    return 'udgivet';
  }

  // Udgavens tekst med henvisninger skrevet ud – grundlaget for ændringslisten
  const resolvedChapters = (chapters, refs) => chapters.map((c) => ({ ...c, resolved: ctx.resolveText(c.content, refs) }));
  function compare(prev, next) {
    const a = prev ? resolvedChapters(prev.chapters, prev.refs) : [];
    const b = resolvedChapters(next.chapters, next.refs);
    const changes = [];
    for (const c of b) {
      const old = a.find((x) => x.id === c.id);
      if (!old) { changes.push({ chapterId: c.id, title: c.title, kind: 'nyt kapitel', hunks: 1, diff: Diff.diffText('', c.resolved) }); continue; }
      const d = Diff.diffText(old.resolved, c.resolved);
      const titleChanged = old.title !== c.title;
      if (d.changes || titleChanged) changes.push({ chapterId: c.id, title: c.title, oldTitle: titleChanged ? old.title : undefined, kind: 'ændret', hunks: d.changes + (titleChanged ? 1 : 0), diff: d });
    }
    for (const c of a) if (!b.some((x) => x.id === c.id)) changes.push({ chapterId: c.id, title: c.title, kind: 'fjernet', hunks: 1, diff: Diff.diffText(c.resolved, '') });
    return changes;
  }
  // Det, der ville blive udgivet nu (scope 'bog' eller ét kapitel)
  function prospective(b, scope, chapterId) {
    const prev = latestEdition(b.id);
    const work = workingChapters(b.id);
    let chapters;
    const pick = (c) => ({ id: c.id, parentId: c.parentId || null, order: c.order, title: c.title, content: c.content });
    if (scope === 'kapitel') {
      const c = work.find((x) => x.id === chapterId);
      if (!c) throw new HttpError(404, 'Kapitlet findes ikke');
      chapters = (prev ? prev.chapters.slice() : []).filter((x) => x.id !== c.id).concat([pick(c)]);
    } else {
      chapters = [];
      for (const c of work) {
        if (c.ready) chapters.push(pick(c));
        else { const old = prev && prev.chapters.find((x) => x.id === c.id); if (old) chapters.push(old); }
      }
    }
    chapters = ordered(chapters);
    const refs = ctx.snapshotFor(chapters.map((c) => c.content));
    return { prev, chapters, refs };
  }
  const summarize = (changes) => changes.map(({ diff, ...rest }) => ({ ...rest, added: diff.added, removed: diff.removed }));
  const editionMeta = (e) => e && ({ id: e.id, version: e.version, publishedAt: e.publishedAt, publishedBy: nameOf(e.publishedBy), notes: e.notes, scope: e.scope, changeCount: e.changeCount, changes: e.changes });

  // ---------- Opsummering af bøger ----------
  function bookSummary(user, b) {
    const s = subjectOf(b);
    const latest = latestEdition(b.id);
    const out = {
      id: b.id, subjectId: b.subjectId, subjectName: s.name, subjectCode: s.code, color: s.color,
      title: b.title, description: b.description, pdfAllowed: !!b.pdfAllowed, hidden: !!b.hidden,
      edition: editionMeta(latest), published: !!latest, author: nameOf(b.authorId), updatedAt: b.updatedAt,
    };
    if (isStaff(user)) {
      const work = workingChapters(b.id);
      const st = work.map((c) => chapterStatus(c, latest));
      out.chapterCount = work.length;
      out.pending = st.filter((x) => x !== 'udgivet').length;
      out.draftChapters = st.filter((x) => x === 'ny').length;
    } else {
      const chs = latest ? latest.chapters : [];
      out.chapterCount = chs.length;
      out.readCount = chs.filter((c) => db().reads.some((r) => r.userId === user.id && r.chapterId === c.id)).length;
    }
    return out;
  }
  ctx.bookSummary = bookSummary;
  ctx.booksForSubject = (user, subjectId) => db().books
    .filter((b) => b.subjectId === subjectId && (isStaff(user) || (!b.hidden && latestEdition(b.id))))
    .map((b) => bookSummary(user, b));

  route('GET', '/api/books', ({ user }) => {
    requireRole(user);
    const ids = new Set(mySubjects(user).map((s) => s.id));
    const books = db().books.filter((b) => ids.has(b.subjectId) && (isStaff(user) || (!b.hidden && latestEdition(b.id))))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map((b) => bookSummary(user, b));
    return reply(200, { books });
  });

  route('POST', '/api/subjects/:id/books', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const s = subjectFor(user, params.id);
    const b = { id: newId('b'), subjectId: s.id, title: str(body.title, 'titel', { max: 200 }), description: str(body.description, 'beskrivelse', { max: 1000, required: false }), pdfAllowed: true, hidden: false, authorId: user.id, createdAt: now(), updatedAt: now(), updatedBy: user.id };
    db().books.push(b);
    ctx.logActivity(user, s.id, `Oprettede bogen “${b.title}”`, `#/rediger-bog/${b.id}`);
    saveDb();
    return reply(201, b);
  });

  // Bog: underviseren får arbejdskopien med status; eleven får den udgivne udgave
  route('GET', '/api/books/:id', ({ user, params, query }) => {
    requireRole(user);
    const b = bookOr404(params.id);
    canRead(user, b);
    const latest = latestEdition(b.id);
    const editions = editionsOf(b.id).slice().reverse().map(editionMeta);
    const base = { ...bookSummary(user, b), editions };
    const wantEdition = query.edition ? db().editions.find((e) => e.id === query.edition && e.bookId === b.id) : null;
    if (isStaff(user) && !wantEdition) {
      const work = workingChapters(b.id);
      const nums = numbering(work);
      return reply(200, { ...base, mode: 'arbejdskopi', chapters: ordered(work).map((c) => ({
        id: c.id, parentId: c.parentId || null, number: nums[c.id], title: c.title, ready: !!c.ready,
        status: chapterStatus(c, latest), words: words(c.content), updatedAt: c.updatedAt, updatedBy: nameOf(c.updatedBy),
      })) });
    }
    const e = wantEdition || latest;
    if (!e) return reply(200, { ...base, mode: 'udgave', chapters: [] });
    const nums = numbering(e.chapters);
    return reply(200, { ...base, mode: 'udgave', viewing: editionMeta(e), chapters: ordered(e.chapters).map((c) => ({
      id: c.id, parentId: c.parentId || null, number: nums[c.id], title: c.title, words: words(c.content),
      read: db().reads.some((r) => r.userId === user.id && r.chapterId === c.id),
      changed: (e.changes || []).some((x) => x.chapterId === c.id),
    })) });
  });

  route('PUT', '/api/books/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    if (body.title !== undefined) b.title = str(body.title, 'titel', { max: 200 });
    if (body.description !== undefined) b.description = str(body.description, 'beskrivelse', { max: 1000, required: false });
    if (body.pdfAllowed !== undefined) b.pdfAllowed = !!body.pdfAllowed;
    if (body.hidden !== undefined) b.hidden = !!body.hidden;
    b.updatedAt = now(); b.updatedBy = user.id;
    saveDb();
    return reply(200, b);
  });
  route('DELETE', '/api/books/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    const ids = new Set(db().chapters.filter((c) => c.bookId === b.id).map((c) => c.id));
    db().books = db().books.filter((x) => x.id !== b.id);
    db().chapters = db().chapters.filter((c) => c.bookId !== b.id);
    db().editions = db().editions.filter((e) => e.bookId !== b.id);
    db().reads = db().reads.filter((r) => !ids.has(r.chapterId));
    db().bookmarks = db().bookmarks.filter((x) => x.bookId !== b.id);
    ctx.logActivity(user, b.subjectId, `Slettede bogen “${b.title}”`);
    saveDb();
    return reply(200, { ok: true });
  });

  // ---------- Kapitler (arbejdskopi) ----------
  function newChapter(user, b, { title, content = '', parentId = null }) {
    const siblings = db().chapters.filter((c) => c.bookId === b.id);
    if (parentId && !siblings.some((c) => c.id === parentId && !c.parentId)) throw new HttpError(400, 'Underkapitler kan kun ligge under et hovedkapitel');
    const c = {
      id: newId('c'), bookId: b.id, parentId: parentId || null, order: siblings.reduce((m, x) => Math.max(m, x.order), 0) + 1,
      title, content, ready: false, createdAt: now(), updatedAt: now(), updatedBy: user.id, revisions: [],
    };
    db().chapters.push(c);
    return c;
  }
  route('POST', '/api/books/:id/chapters', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    const c = newChapter(user, b, { title: str(body.title, 'titel', { max: 200 }), content: str(body.content, 'indhold', { required: false, max: 200000 }), parentId: body.parentId || null });
    b.updatedAt = now();
    ctx.logActivity(user, b.subjectId, `Tilføjede kapitlet “${c.title}” i “${b.title}”`, `#/rediger-kapitel/${c.id}`);
    saveDb();
    return reply(201, c);
  });
  // Import: mange kapitler på én gang (tekst er allerede trukket ud af PDF/Word i browseren)
  route('POST', '/api/books/:id/import', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    const list = Array.isArray(body.chapters) ? body.chapters.slice(0, 200) : [];
    if (!list.length) throw new HttpError(400, 'Der er ingen kapitler at importere');
    let lastTop = null; const created = [];
    for (const x of list) {
      const c = newChapter(user, b, { title: str(x.title, 'titel', { max: 200 }), content: str(x.content, 'indhold', { required: false, max: 200000 }), parentId: x.level === 2 && lastTop ? lastTop.id : null });
      if (!c.parentId) lastTop = c;
      created.push(c.id);
    }
    ctx.logActivity(user, b.subjectId, `Importerede ${created.length} kapitler fra “${str(body.fileName, 'fil', { max: 200, required: false }) || 'dokument'}” til “${b.title}”`, `#/rediger-bog/${b.id}`);
    saveDb();
    return reply(201, { created: created.length });
  });

  route('GET', '/api/chapters/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    const latest = latestEdition(b.id);
    const pub = latest && latest.chapters.find((x) => x.id === c.id);
    return reply(200, {
      id: c.id, bookId: b.id, bookTitle: b.title, subjectId: b.subjectId, color: subjectOf(b).color, parentId: c.parentId,
      title: c.title, content: c.content, ready: !!c.ready, status: chapterStatus(c, latest), updatedAt: c.updatedAt, updatedBy: nameOf(c.updatedBy),
      publishedVersion: pub ? latest.version : null, refs: ctx.snapshotFor([c.content]),
      parents: workingChapters(b.id).filter((x) => !x.parentId && x.id !== c.id).map((x) => ({ id: x.id, title: x.title })),
      revisions: c.revisions.map((r, i) => ({ index: i, title: r.title, savedAt: r.savedAt, savedBy: nameOf(r.savedBy), words: words(r.content), why: r.why || '' })),
    });
  });
  function saveRevision(c, user, why) {
    c.revisions.unshift({ title: c.title, content: c.content, savedAt: c.updatedAt, savedBy: c.updatedBy, why: c.lastWhy || '' });
    c.revisions = c.revisions.slice(0, MAX_REVISIONS);
    c.updatedAt = now(); c.updatedBy = user.id; c.lastWhy = why || '';
  }
  ctx.saveRevision = saveRevision;
  route('PUT', '/api/chapters/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    const title = body.title !== undefined ? str(body.title, 'titel', { max: 200 }) : c.title;
    const content = body.content !== undefined ? str(body.content, 'indhold', { required: false, max: 200000 }) : c.content;
    if (title !== c.title || content !== c.content) {
      saveRevision(c, user, str(body.why, 'begrundelse', { max: 300, required: false }));
      c.title = title; c.content = content;
      ctx.logActivity(user, b.subjectId, `Redigerede “${c.title}” i “${b.title}”`, `#/rediger-kapitel/${c.id}`);
    }
    if (body.ready !== undefined) c.ready = !!body.ready;
    if (body.parentId !== undefined) {
      const pid = body.parentId || null;
      if (pid && (pid === c.id || db().chapters.some((x) => x.parentId === c.id))) throw new HttpError(400, 'Et kapitel med underkapitler kan ikke selv blive underkapitel');
      if (pid && !db().chapters.some((x) => x.id === pid && x.bookId === b.id && !x.parentId)) throw new HttpError(400, 'Ugyldigt hovedkapitel');
      c.parentId = pid;
    }
    b.updatedAt = now();
    saveDb();
    return reply(200, { id: c.id, title: c.title, ready: c.ready, updatedAt: c.updatedAt, status: chapterStatus(c, latestEdition(b.id)), revisionCount: c.revisions.length });
  });
  route('GET', '/api/chapters/:id/revisions/:index', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    subjectFor(user, bookOr404(c.bookId).subjectId);
    const r = c.revisions[Number(params.index)];
    if (!r) throw new HttpError(404, 'Versionen findes ikke');
    return reply(200, { ...r, savedBy: nameOf(r.savedBy), diff: Diff.diffText(r.content, c.content) });
  });
  route('POST', '/api/chapters/:id/restore/:index', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    const r = c.revisions[Number(params.index)];
    if (!r) throw new HttpError(404, 'Versionen findes ikke');
    saveRevision(c, user, 'Før gendannelse');
    c.title = r.title; c.content = r.content;
    ctx.logActivity(user, b.subjectId, `Gendannede en tidligere version af “${c.title}”`, `#/rediger-kapitel/${c.id}`);
    saveDb();
    return reply(200, { ok: true });
  });
  route('POST', '/api/chapters/:id/move', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    const sibs = db().chapters.filter((x) => x.bookId === b.id && (x.parentId || null) === (c.parentId || null)).sort((x, y) => x.order - y.order);
    const i = sibs.indexOf(c), j = i + (Number(body.dir) < 0 ? -1 : 1);
    if (j >= 0 && j < sibs.length) { const o = sibs[j].order; sibs[j].order = c.order; c.order = o; saveDb(); }
    return reply(200, { ok: true });
  });
  route('DELETE', '/api/chapters/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = chapterOr404(params.id);
    const b = bookOr404(c.bookId);
    subjectFor(user, b.subjectId);
    db().chapters = db().chapters.filter((x) => x.id !== c.id).map((x) => (x.parentId === c.id ? { ...x, parentId: null } : x));
    ctx.logActivity(user, b.subjectId, `Slettede kapitlet “${c.title}” fra arbejdskopien af “${b.title}”`, `#/rediger-bog/${b.id}`);
    saveDb();
    return reply(200, { ok: true });
  });

  // ---------- Udgivelse ----------
  route('GET', '/api/books/:id/pending', ({ user, params, query }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    const p = prospective(b, query.scope === 'kapitel' ? 'kapitel' : 'bog', query.chapterId);
    const changes = compare(p.prev, p);
    const prevV = p.prev ? p.prev.version : null;
    return reply(200, {
      book: { id: b.id, title: b.title }, current: prevV, next: { minor: nextVersion(p.prev, 'minor'), major: nextVersion(p.prev, 'major') },
      changeCount: changes.reduce((n, c) => n + c.hunks, 0), changes,
      // Kapitler med egne tekstændringer, der ikke er markeret klar. (Ændrede centrale oplysninger og formler kommer automatisk med.)
      notReady: workingChapters(b.id).filter((c) => !c.ready && ['ny', 'ændret'].includes(chapterStatus(c, p.prev))).map((c) => ({ id: c.id, title: c.title, status: chapterStatus(c, p.prev) })),
      suggestedNotes: changes.map((c) => `${c.kind === 'nyt kapitel' ? 'Nyt kapitel' : c.kind === 'fjernet' ? 'Fjernet' : 'Opdateret'}: ${c.title}`).join('\n'),
    });
  });
  function nextVersion(prev, kind) {
    if (!prev) return '1.0';
    return kind === 'major' ? `${prev.major + 1}.0` : `${prev.major}.${prev.minor + 1}`;
  }
  route('POST', '/api/books/:id/publish', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const b = bookOr404(params.id);
    subjectFor(user, b.subjectId);
    const e = publishBook(user, b, body);
    return reply(201, { ...editionMeta(e), notified: subjectOf(b).studentIds.length });
  });
  // Udgiv: gem øjebliksbillede, registrér ændringer, opdatér elevportalen, giv besked, bevar historik
  function publishBook(user, b, body) {
    const s = subjectOf(b);
    const scope = body.scope === 'kapitel' ? 'kapitel' : 'bog';
    const p = prospective(b, scope, body.chapterId);
    const changes = compare(p.prev, p);
    const changeCount = changes.reduce((n, c) => n + c.hunks, 0);
    if (!changeCount) throw new HttpError(409, 'Der er ingen ændringer at udgive');
    const kind = body.kind === 'major' ? 'major' : 'minor';
    const version = body.version || nextVersion(p.prev, kind);
    const [major, minor] = version.split('.').map(Number);
    const e = {
      id: newId('e'), bookId: b.id, version, major, minor, scope, publishedAt: body.at || now(), publishedBy: user.id,
      notes: str(body.notes, 'udgivelsesnoter', { max: 3000, required: false }),
      chapters: p.chapters, refs: p.refs, changeCount, changes: summarize(changes),
    };
    db().editions.push(e);
    // Udgivne kapitler er ikke længere "klar" – næste udgivelse starter forfra
    for (const c of workingChapters(b.id)) if (scope === 'bog' || c.id === body.chapterId) c.ready = false;
    b.updatedAt = now();
    const what = scope === 'kapitel' ? `kapitlet “${(p.chapters.find((c) => c.id === body.chapterId) || {}).title}”` : 'hele bogen';
    if (!body.silent) ctx.logActivity(user, b.subjectId, `Udgav “${b.title}” version ${version} (${what}) med ${changeCount} ændring${changeCount === 1 ? '' : 'er'}`, `#/aendringer/${e.id}`);
    for (const sid of s.studentIds) {
      db().notifications.push({ id: newId('nt'), userId: sid, at: body.at || now(), read: !!body.silent, kind: 'udgave',
        text: `${b.title} – version ${version} er udgivet. Der er ${changeCount} ændring${changeCount === 1 ? '' : 'er'} siden sidste version.`, link: `#/aendringer/${e.id}` });
    }
    saveDb();
    return e;
  }
  ctx.publishBook = publishBook;
  // Hvad er ændret i en udgave (i forhold til den forrige)?
  route('GET', '/api/editions/:id/changes', ({ user, params }) => {
    requireRole(user);
    const e = db().editions.find((x) => x.id === params.id);
    if (!e) throw new HttpError(404, 'Udgaven findes ikke');
    const b = bookOr404(e.bookId);
    canRead(user, b);
    const list = editionsOf(b.id);
    const prev = list[list.indexOf(e) - 1] || null;
    return reply(200, { book: { id: b.id, title: b.title, color: subjectOf(b).color }, edition: editionMeta(e), previous: prev ? prev.version : null, changes: compare(prev, e) });
  });

  // ---------- Elev: læs et kapitel i en udgave ----------
  route('GET', '/api/books/:id/chapters/:cid', ({ user, params, query }) => {
    requireRole(user);
    const b = bookOr404(params.id);
    canRead(user, b);
    const e = (query.edition && db().editions.find((x) => x.id === query.edition && x.bookId === b.id)) || latestEdition(b.id);
    if (!e) throw new HttpError(404, 'Bogen er ikke udgivet endnu');
    const list = ordered(e.chapters);
    const i = list.findIndex((c) => c.id === params.cid);
    if (i < 0) throw new HttpError(404, 'Kapitlet findes ikke i denne udgave');
    const c = list[i];
    const nums = numbering(e.chapters);
    const used = ctx.refsIn(c.content);
    const pickRefs = (obj, keys) => Object.fromEntries([...keys].filter((k) => obj[k]).map((k) => [k, obj[k]]));
    const note = db().notes.find((n) => n.userId === user.id && n.chapterId === c.id);
    return reply(200, {
      id: c.id, bookId: b.id, bookTitle: b.title, color: subjectOf(b).color, title: c.title, content: c.content, number: nums[c.id],
      edition: editionMeta(e), pdfAllowed: !!b.pdfAllowed,
      refs: { facts: pickRefs(e.refs.facts, used.fakta), formulas: pickRefs(e.refs.formulas, used.formel), sources: pickRefs(e.refs.sources, used.kilde) },
      prev: list[i - 1] ? { id: list[i - 1].id, title: list[i - 1].title } : null,
      next: list[i + 1] ? { id: list[i + 1].id, title: list[i + 1].title } : null,
      read: db().reads.some((r) => r.userId === user.id && r.chapterId === c.id),
      changedInThisEdition: (e.changes || []).some((x) => x.chapterId === c.id),
      note: note ? note.text : '',
      bookmarks: db().bookmarks.filter((x) => x.userId === user.id && x.chapterId === c.id),
    });
  });
  route('POST', '/api/chapters/:id/read', ({ user, params, body }) => {
    requireRole(user, 'student');
    const e = db().editions.find((x) => x.chapters.some((c) => c.id === params.id));
    if (!e) throw new HttpError(404, 'Kapitlet findes ikke');
    canRead(user, bookOr404(e.bookId));
    db().reads = db().reads.filter((r) => !(r.userId === user.id && r.chapterId === params.id));
    if (body.read !== false) db().reads.push({ userId: user.id, chapterId: params.id, at: now() });
    saveDb();
    return reply(200, { ok: true, read: body.read !== false });
  });

  // ---------- Bogmærker og noter (personlige) ----------
  route('GET', '/api/bookmarks', ({ user }) => {
    requireRole(user);
    const list = db().bookmarks.filter((x) => x.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).map((x) => {
      const b = db().books.find((y) => y.id === x.bookId) || {};
      return { ...x, bookTitle: b.title };
    });
    const notes = db().notes.filter((n) => n.userId === user.id && n.text).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((n) => {
      const b = db().books.find((y) => y.id === n.bookId) || {};
      const e = latestEdition(n.bookId);
      const c = e && e.chapters.find((y) => y.id === n.chapterId);
      return { ...n, bookTitle: b.title, chapterTitle: c ? c.title : '(kapitlet findes ikke længere)' };
    });
    return reply(200, { bookmarks: list, notes });
  });
  route('POST', '/api/bookmarks', ({ user, body }) => {
    requireRole(user);
    const b = bookOr404(body.bookId);
    canRead(user, b);
    const x = { id: newId('bm'), userId: user.id, bookId: b.id, chapterId: str(body.chapterId, 'kapitel', { max: 40 }), anchor: str(body.anchor, 'afsnit', { max: 80, required: false }), label: str(body.label, 'navn', { max: 200 }), at: now() };
    db().bookmarks.push(x); saveDb();
    return reply(201, x);
  });
  route('DELETE', '/api/bookmarks/:id', ({ user, params }) => {
    requireRole(user);
    db().bookmarks = db().bookmarks.filter((x) => !(x.id === params.id && x.userId === user.id)); saveDb();
    return reply(200, { ok: true });
  });
  route('PUT', '/api/notes/:chapterId', ({ user, params, body }) => {
    requireRole(user);
    const text = str(body.text, 'note', { max: 20000, required: false });
    db().notes = db().notes.filter((n) => !(n.userId === user.id && n.chapterId === params.chapterId));
    if (text) db().notes.push({ id: newId('no'), userId: user.id, bookId: str(body.bookId, 'bog', { max: 40 }), chapterId: params.chapterId, text, updatedAt: now() });
    saveDb();
    return reply(200, { ok: true });
  });

  // ---------- Søgning ----------
  route('GET', '/api/search', ({ user, query }) => {
    requireRole(user);
    const q = String(query.q || '').trim().toLowerCase();
    if (q.length < 2) return reply(200, { q, results: [] });
    const terms = q.split(/\s+/).filter(Boolean);
    const hit = (text) => terms.every((t) => text.toLowerCase().includes(t));
    const snippet = (text) => {
      const plain = text.replace(/[#>*`|_]/g, ' ').replace(/\s+/g, ' ');
      const i = plain.toLowerCase().indexOf(terms[0]);
      const s = Math.max(0, i - 70);
      return (s > 0 ? '… ' : '') + plain.slice(s, s + 220) + (plain.length > s + 220 ? ' …' : '');
    };
    const results = [];
    const ids = new Set(mySubjects(user).map((s) => s.id));
    for (const b of db().books.filter((x) => ids.has(x.subjectId))) {
      if (isStaff(user)) {
        const snap = ctx.snapshotFor(workingChapters(b.id).map((c) => c.content));
        for (const c of workingChapters(b.id)) {
          const text = ctx.resolveText(c.content, snap);
          if (hit(c.title + ' ' + text)) results.push({ kind: 'kapitel', bookId: b.id, bookTitle: b.title, chapterId: c.id, title: c.title, snippet: snippet(text), link: `#/rediger-kapitel/${c.id}` });
        }
      } else {
        const e = latestEdition(b.id);
        if (!e || b.hidden) continue;
        for (const c of e.chapters) {
          const text = ctx.resolveText(c.content, e.refs);
          if (hit(c.title + ' ' + text)) results.push({ kind: 'kapitel', bookId: b.id, bookTitle: b.title, chapterId: c.id, title: c.title, snippet: snippet(text), link: `#/bog/${b.id}/${c.id}` });
        }
      }
    }
    if (isStaff(user)) {
      for (const f of db().facts) if (hit(`${f.label} ${f.value} ${f.unit} ${f.key}`)) results.push({ kind: 'oplysning', title: f.label, snippet: `${f.value} ${f.unit || ''} · bruges i ${ctx.usage('fakta', f.key).length} kapitler`, link: '#/oplysninger' });
      for (const f of db().formulas) if (hit(`${f.name} ${f.expression} ${f.category} ${f.key}`)) results.push({ kind: 'formel', title: f.name, snippet: `${f.result.symbol} = ${f.expression}`, link: `#/formler/${f.id}` });
      for (const s of db().sources) for (const p of s.provisions) if (hit(`${s.short} ${p.ref} ${p.title} ${p.text}`)) results.push({ kind: 'retskilde', title: `${s.short} ${p.ref}`, snippet: p.text.slice(0, 200), link: '#/kilder' });
    }
    return reply(200, { q, results: results.slice(0, 60) });
  });
  ctx.searchWorking = (q) => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const c of db().chapters) {
      const b = db().books.find((x) => x.id === c.bookId) || {};
      const paras = c.content.split(/\n\s*\n/);
      paras.forEach((para, i) => {
        if (terms.every((t) => para.toLowerCase().includes(t))) out.push({ bookId: b.id, bookTitle: b.title, chapterId: c.id, chapterTitle: c.title, paragraph: i, text: para.slice(0, 400) });
      });
    }
    return out;
  };

  // ---------- Elevens formelsamling: formler fra de udgivne bøger ----------
  route('GET', '/api/formula-collection', ({ user }) => {
    requireRole(user);
    const ids = new Set(mySubjects(user).map((s) => s.id));
    const seen = new Map();
    for (const b of db().books.filter((x) => ids.has(x.subjectId) && !x.hidden)) {
      const e = latestEdition(b.id);
      if (e) for (const [k, f] of Object.entries(e.refs.formulas)) if (!seen.has(k)) seen.set(k, f);
    }
    return reply(200, { formulas: [...seen.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)) });
  });

  // ---------- Notifikationer ----------
  route('GET', '/api/notifications', ({ user }) => {
    requireRole(user);
    const list = db().notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
    return reply(200, { notifications: list, unread: list.filter((n) => !n.read).length });
  });
  route('POST', '/api/notifications/read', ({ user, body }) => {
    requireRole(user);
    for (const n of db().notifications) if (n.userId === user.id && (!body.id || n.id === body.id)) n.read = true;
    saveDb();
    return reply(200, { ok: true });
  });
  ctx.notifyStaff = (text, link, kind = 'info') => {
    for (const u of db().users.filter((x) => isStaff(x))) db().notifications.push({ id: newId('nt'), userId: u.id, at: now(), read: false, kind, text, link });
  };

  // ---------- PDF-eksport (data; selve PDF'en laves i browseren) ----------
  route('GET', '/api/books/:id/export', ({ user, params, query }) => {
    requireRole(user);
    const b = bookOr404(params.id);
    canRead(user, b);
    if (!isStaff(user) && !b.pdfAllowed) throw new HttpError(403, 'Underviseren har ikke åbnet for PDF-download af denne bog');
    let chapters, refs, label;
    if (isStaff(user) && query.draft) {
      chapters = ordered(workingChapters(b.id)).map((c) => ({ id: c.id, parentId: c.parentId, title: c.title, content: c.content }));
      refs = ctx.snapshotFor(chapters.map((c) => c.content)); label = 'Kladde – ikke udgivet';
    } else {
      const e = (query.edition && db().editions.find((x) => x.id === query.edition)) || latestEdition(b.id);
      if (!e) throw new HttpError(404, 'Bogen er ikke udgivet endnu');
      chapters = ordered(e.chapters); refs = e.refs; label = `Version ${e.version} · udgivet ${e.publishedAt.slice(0, 10)}`;
    }
    const nums = numbering(chapters);
    return reply(200, { title: b.title, description: b.description, subject: subjectOf(b).name, label, author: nameOf(b.authorId), chapters: chapters.map((c) => ({ ...c, number: nums[c.id] })), refs });
  });

  // ---------- Underviserens overblik ----------
  route('GET', '/api/teacher/overview', ({ user }) => {
    requireRole(user, 'teacher');
    const subs = mySubjects(user);
    const ids = new Set(subs.map((s) => s.id));
    const books = db().books.filter((b) => ids.has(b.subjectId)).map((b) => bookSummary(user, b));
    const editing = [];
    for (const b of db().books.filter((x) => ids.has(x.subjectId))) {
      const latest = latestEdition(b.id);
      for (const c of workingChapters(b.id)) {
        const st = chapterStatus(c, latest);
        if (st !== 'udgivet') editing.push({ chapterId: c.id, title: c.title, bookId: b.id, bookTitle: b.title, status: st, ready: !!c.ready, updatedAt: c.updatedAt });
      }
    }
    editing.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const recent = db().editions.filter((e) => books.some((b) => b.id === e.bookId)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 5)
      .map((e) => ({ ...editionMeta(e), bookTitle: (db().books.find((b) => b.id === e.bookId) || {}).title }));
    const studentIds = new Set(subs.flatMap((s) => s.studentIds));
    const Formula = (typeof module !== 'undefined' && module.exports) ? require('../shared/formula') : root.PortalFormula;
    const formulaIssues = db().formulas.map((f) => ({ id: f.id, name: f.name, issues: Formula.check(f) })).filter((f) => f.issues.some((i) => i.level === 'fejl'));
    return reply(200, {
      books, editing: editing.slice(0, 12), editingCount: editing.length, recent,
      legal: db().legalChanges.filter((c) => c.status !== 'afsluttet' && c.status !== 'afvist').map((c) => ({ id: c.id, title: c.title, detectedAt: c.detectedAt, effectiveFrom: c.effectiveFrom, demo: !!c.demo, open: db().proposals.filter((p) => p.changeId === c.id && p.status === 'afventer').length })),
      students: { count: studentIds.size, groups: db().groups.length, subjects: subs.map((s) => ({ id: s.id, code: s.code, name: s.name, color: s.color, students: s.studentIds.length })) },
      formulas: { count: db().formulas.length, withErrors: formulaIssues.length, categories: [...new Set(db().formulas.map((f) => f.category))] },
      facts: db().facts.length,
      activity: db().activity.slice(0, 8).map((a) => ({ ...a, user: nameOf(a.userId) })),
    });
  });
  ctx.latestEdition = latestEdition; ctx.workingChapters = workingChapters; ctx.chapterStatus = chapterStatus; ctx.compare = compare; ctx.prospective = prospective;
}

const mod = { install };
if (typeof module !== 'undefined' && module.exports) module.exports = mod;
else (root.PortalModules = root.PortalModules || []).push(mod);
})(this);
