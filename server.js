// Marstal Navigationsskole – elev- og lærerportal
// Kører uden eksterne pakker:  node server.js   →  http://localhost:3000
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { seed } = require('./seed');
const { createApi } = require('./api');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SHARED_DIR = path.join(__dirname, 'shared');
const SESSION_MAX_AGE = 8 * 60 * 60; // sekunder

// ---------- Adgangskoder (scrypt) ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

// ---------- AI (valgfri): Claude via det officielle Anthropic SDK ----------
// Slås til ved at sætte ANTHROPIC_API_KEY (eller ANTHROPIC_AUTH_TOKEN). Uden nøgle kører
// portalen fint – de faste assistent-kommandoer er lokale, kun sprogopgaver kræver AI.
const AI_MODEL = process.env.PORTAL_AI_MODEL || 'claude-opus-5-5';
let Anthropic = null, aiClient = null;
if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
  try { Anthropic = require('@anthropic-ai/sdk'); Anthropic = Anthropic.default || Anthropic; aiClient = new Anthropic(); }
  catch (e) { console.warn('AI er slået fra: @anthropic-ai/sdk er ikke installeret (kør npm install).'); }
}
async function askClaude({ system, prompt, schema }) {
  let res;
  try {
    res = await aiClient.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // hvis modellen afviser, prøver API'et automatisk en anden model
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new api.HttpError(502, 'AI-nøglen blev afvist. Tjek ANTHROPIC_API_KEY.');
    if (err instanceof Anthropic.RateLimitError) throw new api.HttpError(429, 'AI er travlt optaget lige nu. Prøv igen om lidt.');
    if (err instanceof Anthropic.APIError) throw new api.HttpError(502, `AI-tjenesten svarede med en fejl (${err.status}).`);
    throw new api.HttpError(502, 'Kunne ikke få forbindelse til AI-tjenesten.');
  }
  if (res.stop_reason === 'refusal') throw new api.HttpError(422, 'AI ville ikke besvare denne opgave.');
  if (res.stop_reason === 'max_tokens') throw new api.HttpError(502, 'AI-svaret blev for langt. Prøv med et kortere afsnit.');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { throw new api.HttpError(502, 'AI-svaret kunne ikke læses.'); }
}

// ---------- Officielle retskilder (valgfri) ----------
// Retsinformation har et REST-API til dokumenter, der er ændret inden for et tidsrum
// (Civilstyrelsens vejledning "Retsinformation REST API", v1.3). Højst ét kald pr. 10 sek.
// Sæt RETSINFORMATION_HARVEST_URL til endepunktet fra vejledningen. Svarets felter
// mappes nedenfor og skal efterprøves mod den aktuelle vejledning før drift.
async function retsinformationFeed({ sources }) {
  const url = process.env.RETSINFORMATION_HARVEST_URL;
  if (!url) return [];
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Retsinformation svarede ${res.status}`);
  const items = await res.json();
  const watched = sources.filter((s) => s.watch !== false).map((s) => s.title.toLowerCase().split(/[\s(]/)[0]);
  return (Array.isArray(items) ? items : []).filter((it) => {
    const title = String(it.title || it.titel || '').toLowerCase();
    return watched.some((w) => w && title.includes(w));
  }).map((it) => ({
    externalId: 'ri-' + (it.accessionNumber || it.accessionsnummer || it.id),
    origin: 'retsinformation',
    title: String(it.title || it.titel || 'Ændret dokument på Retsinformation'),
    summary: 'Fundet automatisk på Retsinformation. Åbn dokumentet, sammenlign og angiv den nye ordlyd, før forslag kan laves.',
    url: it.accessionNumber ? `https://www.retsinformation.dk/eli/accn/${it.accessionNumber}` : 'https://www.retsinformation.dk/',
    provisionKey: '', oldText: '', newText: '', effectiveFrom: '',
  }));
}

// ---------- API med JSON-fil som database ----------
const api = createApi({
  hashPassword, verifyPassword, seed,
  ai: aiClient ? askClaude : null, aiModel: aiClient ? AI_MODEL : null,
  legalFeed: process.env.RETSINFORMATION_HARVEST_URL ? retsinformationFeed : null,
  randomHex: (n) => crypto.randomBytes(n).toString('hex'),
  load: () => (fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : null),
  save: (db) => {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  },
});
const loadDb = (reset) => api.loadDb(reset);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new api.HttpError(413, 'For stor forespørgsel')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new api.HttpError(400, 'Ugyldig JSON')); }
    });
    req.on('error', reject);
  });
}

// ---------- Statiske filer ----------
const MIME = { '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
function serveStatic(req, res, pathname) {
  // Delte biblioteker (formelmotor, diff) bruges både af server og browser
  const base = pathname.startsWith('/shared/') ? SHARED_DIR : PUBLIC_DIR;
  const rel = pathname.startsWith('/shared/') ? pathname.slice('/shared'.length) : pathname;
  let file = path.normalize(path.join(base, rel === '/' ? 'index.html' : rel));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    // cdnjs: PDF-læsning (pdf.js), Word-læsning (mammoth) og PDF-eksport (jsPDF) indlæses først, når de bruges
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; connect-src 'self' https://cdnjs.cloudflare.com; manifest-src 'self'",
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- Server ----------
function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    try {
      if (!pathname.startsWith('/api/')) return serveStatic(req, res, decodeURIComponent(pathname));
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
      const out = await api.handle(req.method, pathname, body, m && m[1], Object.fromEntries(searchParams));
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      if (out.sid) headers['Set-Cookie'] = `sid=${out.sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`;
      if (out.clearSid) headers['Set-Cookie'] = 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
      res.writeHead(out.status, headers);
      res.end(JSON.stringify(out.data));
    } catch (err) {
      res.writeHead(err.status || 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.status ? err.message : 'Der opstod en fejl på serveren' }));
    }
  });
}

if (require.main === module) {
  loadDb(process.argv.includes('--reset'));
  if (process.argv.includes('--reset')) console.log('Databasen er nulstillet med demodata.');
  createServer().listen(PORT, HOST, () => {
    console.log(`\n⚓ Marstal Navigationsskole – portal kører på http://localhost:${PORT}\n`);
    console.log(`   AI: ${aiClient ? 'slået til (' + AI_MODEL + ')' : 'slået fra – sæt ANTHROPIC_API_KEY for at bruge AI-forslag'}`);
    console.log('   Administrator: admin (adgangskode admin123)');
    console.log('   Lærere: lars · mette · peter  (adgangskode laerer123)');
    console.log('   Elever: anna · jonas · freja  (adgangskode elev123)\n');
  });
}

module.exports = { createServer, loadDb };
