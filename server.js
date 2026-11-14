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

// ---------- API med JSON-fil som database ----------
const api = createApi({
  hashPassword, verifyPassword, seed,
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
  let file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; worker-src 'self'; manifest-src 'self'",
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- Server ----------
function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      if (!pathname.startsWith('/api/')) return serveStatic(req, res, decodeURIComponent(pathname));
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
      const out = api.handle(req.method, pathname, body, m && m[1]);
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
    console.log('   Lærere: lars · mette · peter  (adgangskode laerer123)');
    console.log('   Elever: anna · jonas · freja  (adgangskode elev123)\n');
  });
}

module.exports = { createServer, loadDb };
