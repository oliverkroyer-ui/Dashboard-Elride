// Modul: centrale oplysninger (fakta), retskilder og formelbibliotek.
// Kapitler henviser til dem med {{fakta:nøgle}}, {{kilde:nøgle}} og {{formel:nøgle}},
// så en ændring ét sted slår igennem alle steder.
(function (root) {
'use strict';
const Formula = (typeof module !== 'undefined' && module.exports) ? require('../shared/formula') : root.PortalFormula;

const REF_RE = /\{\{(fakta|formel|kilde):([A-Za-z0-9_-]+)\}\}/g;
const KEY_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

function install(ctx) {
  const { route, reply, HttpError, str, requireRole, nameOf, newId, saveDb } = ctx;
  const now = () => new Date().toISOString();

  // Find alle henvisninger i en tekst
  function refsIn(text) {
    const out = { fakta: new Set(), formel: new Set(), kilde: new Set() };
    for (const m of String(text || '').matchAll(REF_RE)) out[m[1]].add(m[2]);
    return out;
  }
  // Hvilke kapitler bruger en given henvisning?
  function usage(kind, key) {
    const token = `{{${kind}:${key}}}`;
    return ctx.db.chapters.filter((c) => c.content.includes(token)).map((c) => {
      const b = ctx.db.books.find((x) => x.id === c.bookId) || {};
      return { chapterId: c.id, chapterTitle: c.title, bookId: b.id, bookTitle: b.title };
    });
  }
  const provisionByKey = (key) => {
    for (const s of ctx.db.sources) { const p = s.provisions.find((x) => x.key === key); if (p) return { source: s, provision: p }; }
    return null;
  };
  // Øjebliksbillede af alt, en tekst henviser til (bruges ved udgivelse og visning af kladder)
  function snapshotFor(texts) {
    const all = { fakta: new Set(), formel: new Set(), kilde: new Set() };
    for (const t of texts) { const r = refsIn(t); for (const k of Object.keys(all)) r[k].forEach((x) => all[k].add(x)); }
    const facts = {}, formulas = {}, sources = {};
    for (const key of all.fakta) { const f = ctx.db.facts.find((x) => x.key === key); if (f) facts[key] = { label: f.label, value: f.value, unit: f.unit || '', sourceKey: f.sourceKey || '' }; }
    for (const key of all.formel) { const f = ctx.db.formulas.find((x) => x.key === key); if (f) formulas[key] = publicFormula(f); }
    for (const key of all.kilde) {
      const hit = provisionByKey(key);
      if (hit) sources[key] = { ref: hit.provision.ref, title: hit.provision.title, text: hit.provision.text, validFrom: hit.provision.validFrom || '', source: hit.source.short, sourceTitle: hit.source.title, url: hit.provision.url || hit.source.url };
    }
    return { facts, formulas, sources };
  }
  // Tekst med henvisninger skrevet ud – bruges til sammenligning af udgaver, søgning og PDF
  function resolveText(text, snap) {
    return String(text || '').replace(REF_RE, (all, kind, key) => {
      if (kind === 'fakta') { const f = snap.facts[key]; return f ? `${f.value}${f.unit ? ' ' + f.unit : ''}` : `[ukendt oplysning: ${key}]`; }
      if (kind === 'kilde') { const s = snap.sources[key]; return s ? `(${s.source} ${s.ref})` : `[ukendt kilde: ${key}]`; }
      const f = snap.formulas[key];
      return f ? `[Formel: ${f.name}: ${f.result.symbol} = ${f.expression}]` : `[ukendt formel: ${key}]`;
    });
  }
  function publicFormula(f) {
    return { key: f.key, name: f.name, category: f.category, expression: f.expression, result: f.result, variables: f.variables, explanation: f.explanation || '', warnings: f.warnings || [], test: f.test || null };
  }
  ctx.refsIn = refsIn; ctx.usage = usage; ctx.snapshotFor = snapshotFor; ctx.resolveText = resolveText; ctx.provisionByKey = provisionByKey; ctx.publicFormula = publicFormula;
  ctx.REF_RE = REF_RE;

  // ---------- Centrale oplysninger ----------
  route('GET', '/api/facts', ({ user }) => {
    requireRole(user, 'teacher');
    return reply(200, { facts: ctx.db.facts.map((f) => ({ ...f, usage: usage('fakta', f.key), updatedByName: nameOf(f.updatedBy) })) });
  });
  route('POST', '/api/facts', ({ user, body }) => {
    requireRole(user, 'teacher');
    const key = str(body.key, 'nøgle', { max: 60 }).toLowerCase();
    if (!KEY_RE.test(key)) throw new HttpError(400, 'Nøglen må kun indeholde små bogstaver, tal og bindestreg');
    if (ctx.db.facts.some((f) => f.key === key)) throw new HttpError(409, 'Der findes allerede en oplysning med den nøgle');
    const f = { id: newId('f'), key, label: str(body.label, 'navn', { max: 200 }), value: str(body.value, 'værdi', { max: 500 }), unit: str(body.unit, 'enhed', { max: 30, required: false }), note: str(body.note, 'note', { max: 1000, required: false }), sourceKey: str(body.sourceKey, 'kilde', { max: 60, required: false }), updatedAt: now(), updatedBy: user.id, history: [] };
    ctx.db.facts.push(f);
    ctx.logActivity(user, null, `Oprettede den centrale oplysning “${f.label}”`, '#/oplysninger');
    saveDb();
    return reply(201, f);
  });
  // Opdatér en central oplysning – alle kapitler, der henviser til den, opdateres automatisk
  function setFact(user, f, value, why, extra = {}) {
    f.history.unshift({ value: f.value, unit: f.unit, at: f.updatedAt, by: f.updatedBy, why: f.lastWhy || '' });
    f.history = f.history.slice(0, 50);
    f.value = value; f.updatedAt = now(); f.updatedBy = user.id; f.lastWhy = why || '';
    Object.assign(f, extra);
  }
  ctx.setFact = setFact;
  route('PUT', '/api/facts/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const f = ctx.db.facts.find((x) => x.id === params.id);
    if (!f) throw new HttpError(404, 'Oplysningen findes ikke');
    const value = str(body.value, 'værdi', { max: 500 });
    const changed = value !== f.value;
    if (body.label !== undefined) f.label = str(body.label, 'navn', { max: 200 });
    if (body.unit !== undefined) f.unit = str(body.unit, 'enhed', { max: 30, required: false });
    if (body.note !== undefined) f.note = str(body.note, 'note', { max: 1000, required: false });
    if (body.sourceKey !== undefined) f.sourceKey = str(body.sourceKey, 'kilde', { max: 60, required: false });
    if (changed) {
      const used = usage('fakta', f.key);
      setFact(user, f, value, str(body.why, 'begrundelse', { max: 500, required: false }));
      ctx.logActivity(user, null, `Ændrede “${f.label}” fra ${f.history[0].value} til ${value} – opdateret i ${used.length} kapitler`, '#/oplysninger');
    }
    saveDb();
    return reply(200, { ...f, usage: usage('fakta', f.key) });
  });
  route('DELETE', '/api/facts/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const f = ctx.db.facts.find((x) => x.id === params.id);
    if (!f) throw new HttpError(404, 'Oplysningen findes ikke');
    const used = usage('fakta', f.key);
    if (used.length) throw new HttpError(409, `Oplysningen bruges i ${used.length} kapitler og kan ikke slettes`);
    ctx.db.facts = ctx.db.facts.filter((x) => x.id !== f.id); saveDb();
    return reply(200, { ok: true });
  });

  // ---------- Retskilder ----------
  route('GET', '/api/sources', ({ user }) => {
    requireRole(user, 'teacher');
    return reply(200, { sources: ctx.db.sources.map((s) => ({ ...s, provisions: s.provisions.map((p) => ({ ...p, usage: usage('kilde', p.key) })) })) });
  });
  route('POST', '/api/sources', ({ user, body }) => {
    requireRole(user, 'teacher');
    const s = { id: newId('src'), short: str(body.short, 'kort navn', { max: 40 }), title: str(body.title, 'titel', { max: 300 }), kind: str(body.kind, 'type', { max: 60, required: false }) || 'Regelsæt', authority: str(body.authority, 'myndighed', { max: 100, required: false }), url: ctx.safeLink(body.url), watch: body.watch !== false, provisions: [] };
    ctx.db.sources.push(s); saveDb();
    return reply(201, s);
  });
  route('POST', '/api/sources/:id/provisions', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const s = ctx.db.sources.find((x) => x.id === params.id);
    if (!s) throw new HttpError(404, 'Kilden findes ikke');
    const key = str(body.key, 'nøgle', { max: 60 }).toLowerCase();
    if (!KEY_RE.test(key)) throw new HttpError(400, 'Nøglen må kun indeholde små bogstaver, tal og bindestreg');
    if (provisionByKey(key)) throw new HttpError(409, 'Nøglen er allerede i brug');
    const p = { key, ref: str(body.ref, 'henvisning', { max: 80 }), title: str(body.title, 'titel', { max: 200, required: false }), text: str(body.text, 'tekst', { max: 5000 }), validFrom: str(body.validFrom, 'gyldig fra', { max: 20, required: false }), url: ctx.safeLink(body.url), history: [] };
    s.provisions.push(p); saveDb();
    return reply(201, p);
  });
  route('PUT', '/api/provisions/:key', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const hit = provisionByKey(params.key);
    if (!hit) throw new HttpError(404, 'Bestemmelsen findes ikke');
    const p = hit.provision;
    const text = str(body.text, 'tekst', { max: 5000 });
    if (text !== p.text) { p.history.unshift({ text: p.text, validFrom: p.validFrom, at: now(), by: user.id }); p.text = text; }
    if (body.validFrom !== undefined) p.validFrom = str(body.validFrom, 'gyldig fra', { max: 20, required: false });
    if (body.ref !== undefined) p.ref = str(body.ref, 'henvisning', { max: 80 });
    ctx.logActivity(user, null, `Opdaterede ${hit.source.short} ${p.ref}`, '#/kilder');
    saveDb();
    return reply(200, p);
  });

  // ---------- Formelbibliotek ----------
  const withMeta = (f) => ({ ...f, issues: Formula.check(f), usage: usage('formel', f.key), updatedByName: nameOf(f.updatedBy) });
  function readFormula(body, existing = {}) {
    const vars = Array.isArray(body.variables) ? body.variables : [];
    const f = {
      name: str(body.name, 'navn', { max: 200 }),
      category: str(body.category, 'emne', { max: 80, required: false }) || 'Andet',
      expression: str(body.expression, 'formel', { max: 500 }),
      result: {
        symbol: str(body.result && body.result.symbol, 'resultatets symbol', { max: 20 }),
        display: str(body.result && body.result.display, 'visning', { max: 20, required: false }),
        label: str(body.result && body.result.label, 'resultatets navn', { max: 120, required: false }),
        unit: str(body.result && body.result.unit, 'enhed', { max: 20, required: false }),
        decimals: Math.max(0, Math.min(6, Number(body.result && body.result.decimals) || 2)),
      },
      variables: vars.slice(0, 20).map((v) => ({
        symbol: str(v.symbol, 'symbol', { max: 20 }), display: str(v.display, 'visning', { max: 20, required: false }),
        label: str(v.label, 'navn', { max: 120, required: false }), unit: str(v.unit, 'enhed', { max: 20, required: false }),
        default: v.default === '' || v.default == null ? null : Formula.parseNum(v.default),
        min: v.min === '' || v.min == null ? null : Formula.parseNum(v.min), max: v.max === '' || v.max == null ? null : Formula.parseNum(v.max),
      })),
      explanation: str(body.explanation, 'forklaring', { max: 5000, required: false }),
      warnings: (Array.isArray(body.warnings) ? body.warnings : []).filter((w) => w && w.when && w.text).slice(0, 10).map((w) => ({ when: str(w.when, 'regel', { max: 200 }), text: str(w.text, 'tekst', { max: 300 }) })),
      test: body.test && body.test.expected !== '' && body.test.expected != null ? { inputs: Object.fromEntries(Object.entries(body.test.inputs || {}).map(([k, v]) => [k, Formula.parseNum(v)])), expected: Formula.parseNum(body.test.expected) } : null,
    };
    try { Formula.parse(f.expression); } catch (e) { throw new HttpError(400, 'Formlen kan ikke læses: ' + e.message); }
    return { ...existing, ...f };
  }
  route('GET', '/api/formulas', ({ user }) => {
    requireRole(user, 'teacher');
    return reply(200, { formulas: ctx.db.formulas.map(withMeta) });
  });
  route('GET', '/api/formulas/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const f = ctx.db.formulas.find((x) => x.id === params.id || x.key === params.id);
    if (!f) throw new HttpError(404, 'Formlen findes ikke');
    return reply(200, withMeta(f));
  });
  route('POST', '/api/formulas', ({ user, body }) => {
    requireRole(user, 'teacher');
    const key = str(body.key, 'nøgle', { max: 60 }).toLowerCase();
    if (!KEY_RE.test(key)) throw new HttpError(400, 'Nøglen må kun indeholde små bogstaver, tal og bindestreg');
    if (ctx.db.formulas.some((f) => f.key === key)) throw new HttpError(409, 'Der findes allerede en formel med den nøgle');
    const f = readFormula(body, { id: newId('fx'), key, history: [], updatedAt: now(), updatedBy: user.id });
    ctx.db.formulas.push(f);
    ctx.logActivity(user, null, `Oprettede formlen “${f.name}”`, `#/formler/${f.id}`);
    saveDb();
    return reply(201, withMeta(f));
  });
  route('PUT', '/api/formulas/:id', ({ user, params, body }) => {
    requireRole(user, 'teacher');
    const old = ctx.db.formulas.find((x) => x.id === params.id);
    if (!old) throw new HttpError(404, 'Formlen findes ikke');
    const next = readFormula(body, old);
    const snap = JSON.stringify(ctx.publicFormula(old));
    if (snap !== JSON.stringify(ctx.publicFormula(next))) {
      next.history = [{ ...ctx.publicFormula(old), at: old.updatedAt, by: old.updatedBy }, ...(old.history || [])].slice(0, 30);
      next.updatedAt = now(); next.updatedBy = user.id;
      const used = usage('formel', old.key);
      ctx.logActivity(user, null, `Opdaterede formlen “${next.name}” – slår igennem i ${used.length} kapitler`, `#/formler/${old.id}`);
    }
    Object.assign(old, next);
    saveDb();
    return reply(200, withMeta(old));
  });
  route('DELETE', '/api/formulas/:id', ({ user, params }) => {
    requireRole(user, 'teacher');
    const f = ctx.db.formulas.find((x) => x.id === params.id);
    if (!f) throw new HttpError(404, 'Formlen findes ikke');
    const used = usage('formel', f.key);
    if (used.length) throw new HttpError(409, `Formlen bruges i ${used.length} kapitler og kan ikke slettes`);
    ctx.db.formulas = ctx.db.formulas.filter((x) => x.id !== f.id); saveDb();
    return reply(200, { ok: true });
  });
  // Henvisningsværktøj til editoren: alt der kan indsættes
  route('GET', '/api/references', ({ user }) => {
    requireRole(user, 'teacher');
    return reply(200, {
      facts: ctx.db.facts.map((f) => ({ key: f.key, label: f.label, value: f.value, unit: f.unit })),
      formulas: ctx.db.formulas.map((f) => ({ key: f.key, name: f.name, category: f.category })),
      provisions: ctx.db.sources.flatMap((s) => s.provisions.map((p) => ({ key: p.key, ref: p.ref, title: p.title, source: s.short }))),
    });
  });
  // Løs henvisninger for en kladde (lærerens forhåndsvisning)
  route('POST', '/api/references/resolve', ({ user, body }) => {
    requireRole(user, 'teacher');
    return reply(200, snapshotFor([str(body.content, 'indhold', { max: 200000, required: false })]));
  });
}

const mod = { install, REF_RE };
if (typeof module !== 'undefined' && module.exports) module.exports = mod;
else (root.PortalModules = root.PortalModules || []).push(mod);
})(this);
