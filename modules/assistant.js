// Modul: assistent til underviseren.
// Faste kommandoer kører lokalt (hurtigt, gratis, forudsigeligt):
//   find · tjek formler · ændringer siden sidste udgave · regneopgaver
// Sprogopgaver (forklar enklere, forslag til lovtekst, frie spørgsmål) går til Claude
// via env.ai på serveren – eller direkte fra browseren i demoen.
// AI'en ændrer aldrig indhold selv: svar vises som forslag, underviseren beslutter.
(function (root) {
'use strict';
const Formula = (typeof module !== 'undefined' && module.exports) ? require('../shared/formula') : root.PortalFormula;

// Prompter deles af server og browser, så de to veje opfører sig ens
const PROMPTS = {
  forklar: (x) => ({
    system: 'Du er en erfaren underviser på en dansk navigationsskole. Du omskriver fagtekst, så elever forstår den bedre, uden at ændre fagligt indhold. Bevar alle tal, enheder, paragraffer og regelhenvisninger præcist som i originalen. Bevar markdown-formatering og alle {{...}}-henvisninger uændret. Skriv på dansk.',
    prompt: `Omskriv dette afsnit, så det er lettere at forstå for en elev på ${x.level || 'kystskipper-/skibsførerniveau'}. Brug korte sætninger og gerne et konkret eksempel fra søen.\n\nAfsnit:\n"""\n${x.text}\n"""`,
    schema: { type: 'object', properties: { text: { type: 'string', description: 'Den omskrevne tekst i markdown' }, note: { type: 'string', description: 'Kort note til underviseren om hvad der er ændret' } }, required: ['text', 'note'], additionalProperties: false },
  }),
  lovforslag: (x) => ({
    system: 'Du hjælper en underviser på en dansk navigationsskole med at holde undervisningsmateriale i søret opdateret. Du foreslår kun ændringer, der følger direkte af den nye bestemmelse. Du opfinder aldrig regler, tal eller paragraffer. Bevar markdown og alle {{...}}-henvisninger. Hvis afsnittet ikke skal ændres, returnér det uændret og sig det. Skriv på dansk.',
    prompt: `Den gamle bestemmelse:\n"""\n${x.oldText}\n"""\n\nDen nye bestemmelse:\n"""\n${x.newText}\n"""\n\nAfsnit fra undervisningsmaterialet:\n"""\n${x.text}\n"""\n\nForeslå en opdateret version af afsnittet.`,
    schema: { type: 'object', properties: { text: { type: 'string', description: 'Det opdaterede afsnit' }, note: { type: 'string', description: 'Begrundelse: hvad er ændret og hvorfor, med henvisning til bestemmelsen' }, changed: { type: 'boolean' } }, required: ['text', 'note', 'changed'], additionalProperties: false },
  }),
  fri: (x) => ({
    system: 'Du er assistent for en underviser på Marstal Navigationsskole, der underviser i søret, navigation og skibsteknik. Du svarer kort, præcist og på dansk. Hvis spørgsmålet handler om gældende ret, gør du opmærksom på, at svaret skal tjekkes mod den officielle kilde (Retsinformation, Søfartsstyrelsen, IMO). Du har kun adgang til det materiale, der står nedenfor.',
    prompt: `Underviserens materiale (oversigt):\n${x.context}\n\nSpørgsmål: ${x.question}`,
    schema: { type: 'object', properties: { text: { type: 'string', description: 'Svaret i markdown' } }, required: ['text'], additionalProperties: false },
  }),
};

function install(ctx) {
  const { route, reply, HttpError, str, requireRole, mySubjects, saveDb } = ctx;
  const db = () => ctx.db;

  // ---------- Status for AI ----------
  route('GET', '/api/ai/status', ({ user }) => {
    requireRole(user, 'teacher');
    return reply(200, { server: !!ctx.env.ai, model: ctx.env.aiModel || null });
  });
  // Sprogopgaver på serveren (Claude via det officielle SDK – se server.js)
  route('POST', '/api/ai', async ({ user, body }) => {
    requireRole(user, 'teacher');
    if (!ctx.env.ai) throw new HttpError(503, 'AI er ikke slået til på serveren. Sæt ANTHROPIC_API_KEY og genstart portalen.');
    const task = str(body.task, 'opgave', { max: 30 });
    if (!PROMPTS[task]) throw new HttpError(400, 'Ukendt AI-opgave');
    const input = body.input || {};
    if (task === 'fri') input.context = contextSummary(user);
    const p = PROMPTS[task](input);
    const out = await ctx.env.ai(p);
    return reply(200, out);
  });

  function contextSummary(user) {
    const ids = new Set(mySubjects(user).map((s) => s.id));
    const lines = [];
    for (const b of db().books.filter((x) => ids.has(x.subjectId))) {
      lines.push(`Bog: ${b.title}`);
      for (const c of ctx.workingChapters(b.id)) lines.push(`  - ${c.title}: ${c.content.replace(/\s+/g, ' ').slice(0, 300)}`);
    }
    lines.push('Centrale oplysninger: ' + db().facts.map((f) => `${f.label} = ${f.value} ${f.unit || ''}`).join('; '));
    lines.push('Formler: ' + db().formulas.map((f) => `${f.name}: ${f.result.symbol} = ${f.expression}`).join('; '));
    return lines.join('\n').slice(0, 30000);
  }
  route('GET', '/api/ai/context', ({ user }) => { requireRole(user, 'teacher'); return reply(200, { context: contextSummary(user) }); });

  // ---------- Lokale kommandoer ----------
  route('POST', '/api/assistant', ({ user, body }) => {
    requireRole(user, 'teacher');
    const cmd = str(body.command, 'kommando', { max: 30 });
    if (cmd === 'find') {
      const q = str(body.query, 'søgeord', { max: 200 });
      const hits = ctx.searchWorking(q);
      const facts = db().facts.filter((f) => `${f.label} ${f.value} ${f.key}`.toLowerCase().includes(q.toLowerCase()));
      const provisions = db().sources.flatMap((s) => s.provisions.filter((p) => `${s.short} ${p.ref} ${p.title} ${p.text}`.toLowerCase().includes(q.toLowerCase())).map((p) => ({ ...p, source: s.short, usage: ctx.usage('kilde', p.key) })));
      return reply(200, { kind: 'find', query: q, hits, facts: facts.map((f) => ({ ...f, usage: ctx.usage('fakta', f.key) })), provisions });
    }
    if (cmd === 'tjek-formler') {
      const report = db().formulas.map((f) => ({ id: f.id, name: f.name, key: f.key, issues: Formula.check(f), usage: ctx.usage('formel', f.key).length }));
      // Henvisninger til formler, oplysninger og kilder, der ikke findes
      const broken = [];
      for (const c of db().chapters) {
        for (const m of c.content.matchAll(ctx.REF_RE)) {
          const [, kind, key] = m;
          const ok = kind === 'fakta' ? db().facts.some((f) => f.key === key) : kind === 'formel' ? db().formulas.some((f) => f.key === key) : !!ctx.provisionByKey(key);
          if (!ok) broken.push({ chapterId: c.id, chapterTitle: c.title, ref: m[0] });
        }
      }
      // Samme størrelse med forskellige enheder på tværs af formler
      const units = {};
      for (const f of db().formulas) for (const v of f.variables) { (units[v.symbol] = units[v.symbol] || new Set()).add(v.unit || '?'); }
      const unitClashes = Object.entries(units).filter(([, u]) => u.size > 1).map(([sym, u]) => ({ symbol: sym, units: [...u] }));
      return reply(200, { kind: 'tjek-formler', report, broken, unitClashes });
    }
    if (cmd === 'aendringer') {
      const ids = new Set(mySubjects(user).map((s) => s.id));
      const books = db().books.filter((b) => ids.has(b.subjectId)).map((b) => {
        const p = ctx.prospective(b, 'bog');
        const changes = ctx.compare(p.prev, p);
        const allPending = ctx.workingChapters(b.id).map((c) => ({ id: c.id, title: c.title, status: ctx.chapterStatus(c, p.prev), ready: !!c.ready })).filter((c) => c.status !== 'udgivet');
        return { id: b.id, title: b.title, version: p.prev ? p.prev.version : null, readyChanges: changes.map(({ diff, ...r }) => r), pending: allPending };
      });
      return reply(200, { kind: 'aendringer', books });
    }
    if (cmd === 'opgaver') {
      const n = Math.max(1, Math.min(10, Number(body.count) || 5));
      const cat = str(body.category, 'emne', { max: 80, required: false }).toLowerCase();
      const pool = db().formulas.filter((f) => !cat || f.category.toLowerCase().includes(cat) || f.name.toLowerCase().includes(cat)).filter((f) => !Formula.check(f).some((i) => i.level === 'fejl'));
      if (!pool.length) throw new HttpError(404, 'Der er ingen fejlfri formler inden for det emne');
      let seed = Number(body.seed) || Date.now();
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const tasks = [];
      for (let i = 0; i < n; i++) {
        const f = pool[i % pool.length];
        const inputs = {};
        for (const v of f.variables) {
          const base = v.default != null ? v.default : 1;
          const spread = Math.abs(base) * 0.25 || 1;
          let val = base + (rnd() * 2 - 1) * spread;
          if (v.min != null) val = Math.max(v.min, val);
          if (v.max != null) val = Math.min(v.max, val);
          const mag = Math.abs(base) >= 1000 ? 10 : Math.abs(base) >= 100 ? 1 : Math.abs(base) >= 10 ? 0.1 : 0.01;
          inputs[v.symbol] = Math.round(val / mag) * mag;
        }
        const r = Formula.calculate(f, inputs);
        if (!r.ok) { i--; if (tasks.length > 50) break; continue; }
        const given = f.variables.map((v) => `${v.label || v.symbol} (${v.display || v.symbol}) = ${Formula.fmtNum(inputs[v.symbol], 3)}${Formula.unitSuffix(v.unit)}`).join(', ');
        tasks.push({
          formula: f.name, formulaKey: f.key,
          question: `Opgave ${tasks.length + 1}: Beregn ${f.result.label || f.result.symbol}${f.result.unit ? ` i ${f.result.unit}` : ''}, når ${given}.`,
          answer: r.steps[r.steps.length - 1].text, steps: r.steps.map((s) => s.text), warnings: r.problems.map((p) => p.text),
        });
      }
      return reply(200, { kind: 'opgaver', tasks });
    }
    throw new HttpError(400, 'Ukendt kommando');
  });
}

const mod = { install, PROMPTS };
if (typeof module !== 'undefined' && module.exports) module.exports = mod;
else { (root.PortalModules = root.PortalModules || []).push(mod); root.PortalPrompts = PROMPTS; }
})(this);
