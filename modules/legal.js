// Modul: overvågning af regelændringer, konsekvensanalyse og ændringsforslag.
//
// Arbejdsgang: ændring registreres → systemet finder berørte kapitler, centrale
// oplysninger og retskilder → der laves konkrete forslag → underviseren retter
// og godkender eller afviser hvert forslag → godkendte forslag føres ind i
// arbejdskopien og dokumenteres med kilde og dato. Intet udgives automatisk.
(function (root) {
'use strict';
const Diff = (typeof module !== 'undefined' && module.exports) ? require('../shared/diff') : root.PortalDiff;

function install(ctx) {
  const { route, reply, HttpError, str, requireRole, nameOf, newId, saveDb } = ctx;
  const db = () => ctx.db;
  const now = () => new Date().toISOString();
  const changeOr404 = (id) => { const c = db().legalChanges.find((x) => x.id === id); if (!c) throw new HttpError(404, 'Ændringen findes ikke'); return c; };
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------- Konsekvensanalyse: lav forslag til en ændring ----------
  function analyze(change) {
    if (db().proposals.some((p) => p.changeId === change.id)) return;
    const add = (p) => db().proposals.push({ id: newId('pr'), changeId: change.id, status: 'afventer', createdAt: now(), generatedBy: 'regel', ...p });

    // 1) Retskilden selv: ny ordlyd af bestemmelsen
    const hit = change.provisionKey && ctx.provisionByKey(change.provisionKey);
    if (hit && change.newText && hit.provision.text !== change.newText) {
      add({ kind: 'kilde', target: change.provisionKey, title: `Opdatér ${hit.source.short} ${hit.provision.ref} i kildebiblioteket`,
        before: hit.provision.text, after: change.newText, affects: ctx.usage('kilde', change.provisionKey),
        rationale: 'Bestemmelsens ordlyd er ændret. Når den godkendes, viser alle kapitler, der citerer den, den nye ordlyd.' });
    }
    // 2) Centrale oplysninger, der stammer fra bestemmelsen: ét forslag opdaterer alle kapitler
    for (const fu of change.factUpdates || []) {
      const f = db().facts.find((x) => x.key === fu.key);
      if (!f || f.value === fu.newValue) continue;
      add({ kind: 'fakta', target: f.key, title: `Ret “${f.label}” fra ${f.value} til ${fu.newValue} ${f.unit || ''}`.trim(),
        before: `${f.value} ${f.unit || ''}`.trim(), after: fu.newValue, affects: ctx.usage('fakta', f.key),
        rationale: `Oplysningen er knyttet til ${hit ? hit.source.short + ' ' + hit.provision.ref : 'bestemmelsen'}. Én godkendelse opdaterer den alle steder, den bruges.` });
    }
    // 3) Fritekst i kapitler, der nævner de gamle værdier direkte (uden central oplysning)
    const reps = change.replacements || [];
    if (reps.length) {
      for (const c of db().chapters) {
        const paras = c.content.split(/\n\s*\n/);
        paras.forEach((para, idx) => {
          const plain = para.replace(ctx.REF_RE, '');
          const matching = reps.filter((r) => new RegExp(`(^|[^\\d])${escapeRe(r.from)}`, 'i').test(plain));
          if (!matching.length) return;
          let after = para;
          for (const r of matching) {
            // Hvis værdien findes som central oplysning, foreslås en henvisning i stedet,
            // så næste ændring sker automatisk.
            const replacement = r.factKey && db().facts.some((f) => f.key === r.factKey) ? `{{fakta:${r.factKey}}}${r.suffix ? ' ' + r.suffix : ''}` : r.to;
            after = after.replace(new RegExp(`(^|[^\\d])${escapeRe(r.from)}`, 'gi'), (m, pre) => pre + replacement);
          }
          const b = db().books.find((x) => x.id === c.bookId) || {};
          add({ kind: 'tekst', target: c.id, paragraph: idx, title: `Tekst i “${c.title}” (${b.title || ''})`, before: para, after,
            affects: [{ chapterId: c.id, chapterTitle: c.title, bookId: b.id, bookTitle: b.title }],
            rationale: matching.some((r) => r.factKey) ? 'Teksten nævner den gamle værdi direkte. Forslaget erstatter den med en henvisning til den centrale oplysning, så fremtidige ændringer sker automatisk.' : 'Teksten nævner den gamle værdi direkte.' });
        });
      }
    }
    // 4) Kapitler der citerer bestemmelsen: bør gennemlæses, selv om ingen tekst ændres
    if (change.provisionKey) {
      for (const u of ctx.usage('kilde', change.provisionKey)) {
        if (db().proposals.some((p) => p.changeId === change.id && p.kind === 'tekst' && p.target === u.chapterId)) continue;
        add({ kind: 'gennemse', target: u.chapterId, title: `Gennemse “${u.chapterTitle}” (${u.bookTitle})`, before: '', after: '', affects: [u],
          rationale: 'Kapitlet citerer bestemmelsen. Der er ikke fundet konkret tekst, der skal rettes, men læs afsnittet igennem.' });
      }
    }
    change.status = 'under behandling';
  }

  function decorate(change) {
    const props = db().proposals.filter((p) => p.changeId === change.id);
    const hit = change.provisionKey && ctx.provisionByKey(change.provisionKey);
    return {
      ...change, source: hit ? { short: hit.source.short, title: hit.source.title, ref: hit.provision.ref, url: hit.provision.url || hit.source.url } : null,
      textDiff: change.oldText || change.newText ? Diff.diffText(change.oldText || '', change.newText || '') : null,
      proposals: props.map((p) => ({ ...p, decidedByName: p.decidedBy ? nameOf(p.decidedBy) : null, diff: p.before || p.after ? Diff.diffText(p.before, p.after) : null })),
      counts: { total: props.length, open: props.filter((p) => p.status === 'afventer').length },
      affectedBooks: [...new Map(props.flatMap((p) => p.affects || []).filter((a) => a.bookId).map((a) => [a.bookId, { id: a.bookId, title: a.bookTitle }])).values()],
    };
  }

  // ---------- Ruter ----------
  route('GET', '/api/legal', ({ user }) => {
    requireRole(user, 'teacher');
    const changes = db().legalChanges.slice().sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).map((c) => {
      const d = decorate(c);
      return { id: c.id, title: c.title, summary: c.summary, status: c.status, detectedAt: c.detectedAt, effectiveFrom: c.effectiveFrom, origin: c.origin, demo: !!c.demo, source: d.source, counts: d.counts, affectedBooks: d.affectedBooks };
    });
    return reply(200, {
      changes,
      watched: db().sources.filter((s) => s.watch !== false).map((s) => ({ id: s.id, short: s.short, title: s.title, authority: s.authority, url: s.url, provisions: s.provisions.length })),
      monitor: db().monitor || { lastCheck: null },
      log: db().changeLog.slice(0, 30).map((l) => ({ ...l, byName: nameOf(l.by) })),
    });
  });
  route('GET', '/api/legal/changes/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const c = changeOr404(params.id);
    analyze(c); saveDb();
    return reply(200, decorate(c));
  });

  // Søg efter nye ændringer. Rigtige kilder kobles på via env.legalFeed (se server.js);
  // i demoen ligger der en fiktiv ændring klar til afprøvning.
  route('POST', '/api/legal/check', async ({ user }) => {
    requireRole(user, 'teacher');
    let found = [], note = '';
    if (ctx.env.legalFeed) {
      try { found = await ctx.env.legalFeed({ since: (db().monitor && db().monitor.lastCheck) || null, sources: db().sources }); }
      catch (e) { note = 'Kunne ikke hente fra den officielle kilde: ' + e.message; }
    }
    for (const q of (db().demoFeed || []).splice(0)) found.push(q);
    let added = 0;
    for (const f of found) {
      if (db().legalChanges.some((c) => c.externalId && c.externalId === f.externalId)) continue;
      const c = { id: newId('lc'), status: 'ny', detectedAt: now(), ...f };
      db().legalChanges.push(c); added++;
      ctx.notifyStaff(`Mulig regelændring: ${c.title}`, `#/lovaendringer/${c.id}`, 'lov');
    }
    db().monitor = { lastCheck: now(), lastResult: added, note };
    saveDb();
    return reply(200, { added, note, lastCheck: db().monitor.lastCheck });
  });
  // Registrér en ændring manuelt (fx fra et nyhedsbrev fra Søfartsstyrelsen)
  route('POST', '/api/legal/changes', ({ user, body }) => {
    requireRole(user, 'teacher');
    const c = {
      id: newId('lc'), status: 'ny', detectedAt: now(), origin: 'manuel',
      title: str(body.title, 'titel', { max: 300 }), summary: str(body.summary, 'resumé', { max: 3000, required: false }),
      provisionKey: str(body.provisionKey, 'bestemmelse', { max: 60, required: false }),
      oldText: str(body.oldText, 'gammel tekst', { max: 10000, required: false }), newText: str(body.newText, 'ny tekst', { max: 10000, required: false }),
      effectiveFrom: str(body.effectiveFrom, 'gyldig fra', { max: 20, required: false }), url: ctx.safeLink(body.url),
      replacements: (Array.isArray(body.replacements) ? body.replacements : []).filter((r) => r && r.from).slice(0, 20).map((r) => ({ from: str(r.from, 'fra', { max: 200 }), to: str(r.to, 'til', { max: 200, required: false }) })),
      factUpdates: (Array.isArray(body.factUpdates) ? body.factUpdates : []).filter((r) => r && r.key && r.newValue).slice(0, 20),
    };
    if (!c.oldText && c.provisionKey) { const hit = ctx.provisionByKey(c.provisionKey); if (hit) c.oldText = hit.provision.text; }
    db().legalChanges.push(c);
    ctx.logActivity(user, null, `Registrerede regelændringen “${c.title}”`, `#/lovaendringer/${c.id}`);
    saveDb();
    return reply(201, c);
  });

  // Underviseren kan rette forslaget (fx med AI-hjælp) før godkendelse
  route('PUT', '/api/proposals/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const p = db().proposals.find((x) => x.id === params.id);
    if (!p) throw new HttpError(404, 'Forslaget findes ikke');
    if (p.status !== 'afventer') throw new HttpError(409, 'Forslaget er allerede behandlet');
    p.after = str(body.after, 'forslag', { max: 20000, required: false });
    if (body.generatedBy === 'ai') { p.generatedBy = 'ai'; p.aiNote = str(body.aiNote, 'AI-begrundelse', { max: 2000, required: false }); }
    else p.editedBy = user.id;
    saveDb();
    return reply(200, p);
  });

  // Godkend eller afvis. Kun her ændres indholdet – og altid af en underviser.
  route('POST', '/api/proposals/:id/decide', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const p = db().proposals.find((x) => x.id === params.id);
    if (!p) throw new HttpError(404, 'Forslaget findes ikke');
    if (p.status !== 'afventer') throw new HttpError(409, 'Forslaget er allerede behandlet');
    const change = changeOr404(p.changeId);
    const approve = body.decision === 'godkend';
    const after = body.after !== undefined ? str(body.after, 'tekst', { max: 20000, required: false }) : p.after;
    const comment = str(body.comment, 'kommentar', { max: 1000, required: false });
    const hit = change.provisionKey && ctx.provisionByKey(change.provisionKey);
    const why = `Regelændring: ${change.title}${change.effectiveFrom ? ` (gælder fra ${change.effectiveFrom})` : ''}`;
    if (approve) {
      if (p.kind === 'kilde') {
        const pv = ctx.provisionByKey(p.target);
        if (!pv) throw new HttpError(404, 'Bestemmelsen findes ikke længere');
        pv.provision.history = pv.provision.history || [];
        pv.provision.history.unshift({ text: pv.provision.text, validFrom: pv.provision.validFrom, at: now(), by: user.id });
        pv.provision.text = after;
        if (change.effectiveFrom) pv.provision.validFrom = change.effectiveFrom;
      } else if (p.kind === 'fakta') {
        const f = db().facts.find((x) => x.key === p.target);
        if (!f) throw new HttpError(404, 'Oplysningen findes ikke længere');
        ctx.setFact(user, f, after, why);
      } else if (p.kind === 'tekst') {
        const c = db().chapters.find((x) => x.id === p.target);
        if (!c) throw new HttpError(404, 'Kapitlet findes ikke længere');
        if (!c.content.includes(p.before)) throw new HttpError(409, 'Afsnittet er ændret, siden forslaget blev lavet. Ret kapitlet direkte, og afvis forslaget.');
        ctx.saveRevision(c, user, why);
        c.content = c.content.replace(p.before, after);
      }
    }
    p.status = approve ? 'godkendt' : 'afvist';
    p.decidedBy = user.id; p.decidedAt = now(); p.finalText = approve ? after : undefined; p.comment = comment;
    // Dokumentation: hvad, hvorfor, hvornår, hvem og hvilken kilde
    db().changeLog.unshift({
      id: newId('log'), at: now(), by: user.id, decision: p.status, kind: p.kind, title: p.title,
      before: p.before, after: approve ? after : '', comment, changeId: change.id, changeTitle: change.title,
      source: hit ? `${hit.source.short} ${hit.provision.ref}` : '', sourceUrl: change.url || (hit && (hit.provision.url || hit.source.url)) || '',
      effectiveFrom: change.effectiveFrom || '', aiAssisted: p.generatedBy === 'ai',
    });
    if (!db().proposals.some((x) => x.changeId === change.id && x.status === 'afventer')) change.status = 'afsluttet';
    ctx.logActivity(user, null, `${approve ? 'Godkendte' : 'Afviste'} forslag: ${p.title}`, `#/lovaendringer/${change.id}`);
    saveDb();
    return reply(200, { ok: true, status: p.status, changeStatus: change.status });
  });
  route('POST', '/api/legal/changes/:id/dismiss', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const c = changeOr404(params.id);
    for (const p of db().proposals.filter((x) => x.changeId === c.id && x.status === 'afventer')) { p.status = 'afvist'; p.decidedBy = user.id; p.decidedAt = now(); }
    c.status = 'afvist';
    db().changeLog.unshift({ id: newId('log'), at: now(), by: user.id, decision: 'afvist', kind: 'ændring', title: c.title, comment: str(body.comment, 'kommentar', { max: 1000, required: false }), changeId: c.id, changeTitle: c.title, source: '', sourceUrl: c.url || '' });
    saveDb();
    return reply(200, { ok: true });
  });
}

const mod = { install };
if (typeof module !== 'undefined' && module.exports) module.exports = mod;
else (root.PortalModules = root.PortalModules || []).push(mod);
})(this);
