// Bygger en selvstændig browser-demo af portalen:  npm run demo  →  demo/portal.html
// Samme API-logik (api.js) og frontend (public/) som serveren, men data gemmes i browseren.
'use strict';
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

const css = read('public/styles.css');
const favicon = 'data:image/svg+xml;base64,' + Buffer.from(read('public/favicon.svg')).toString('base64');
const body = read('public/index.html').match(/<body>([\s\S]*?)<script/)[1].replace(/\/favicon\.svg/g, favicon);
const appJs = read('public/app.js').replace(/\/favicon\.svg/g, favicon);

const adapter = `
(function () {
  'use strict';
  var KEY = 'marstal-portal-demo-v1';
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) {} },
  };
  function randomHex(n) {
    var a = new Uint8Array(n); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  // Demo: adgangskoderne er offentlige demo-koder, så de gemmes ukrypteret i browseren.
  var api = PortalApi.createApi({
    seed: PortalSeed.seed,
    hashPassword: function (pw) { return 'demo:' + pw; },
    verifyPassword: function (pw, stored) { return stored === 'demo:' + pw; },
    randomHex: randomHex,
    load: function () { var raw = store.get(KEY + ':db'); try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    save: function (db) { store.set(KEY + ':db', JSON.stringify(db)); },
  });
  api.loadDb(false);

  var ss = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { window.sessionStorage.removeItem(k); } catch (e) {} },
  };
  var sid = ss.get(KEY + ':user') ? api.sessionFor(ss.get(KEY + ':user')) : null;
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    var u = new URL(url, 'http://demo.local');
    if (u.pathname.indexOf('/api/') !== 0) return realFetch(url, opts);
    opts = opts || {};
    var body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (e) {}
    var out = api.handle((opts.method || 'GET').toUpperCase(), u.pathname, body, sid);
    if (out.sid) { sid = out.sid; ss.set(KEY + ':user', api.userIdFor(sid)); }
    if (out.clearSid) { sid = null; ss.del(KEY + ':user'); }
    return Promise.resolve(new Response(JSON.stringify(out.data), { status: out.status, headers: { 'Content-Type': 'application/json' } }));
  };

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.createElement('div');
    bar.className = 'demo-bar';
    var txt = document.createElement('span');
    txt.textContent = 'Demo – det du laver gemmes kun i din egen browser.';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn ghost small'; btn.textContent = 'Nulstil demo';
    var armed = false;
    btn.addEventListener('click', function () {
      if (!armed) { armed = true; btn.textContent = 'Klik igen for at nulstille'; return; }
      store.del(KEY + ':db'); ss.del(KEY + ':user'); api.loadDb(true); sid = null; location.hash = '#/login'; location.reload();
    });
    bar.appendChild(txt); bar.appendChild(btn);
    document.body.appendChild(bar);
  });
})();
`;

const demoCss = `
.demo-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; gap: .75rem; align-items: center; justify-content: center; flex-wrap: wrap;
  padding: .45rem max(16px, env(safe-area-inset-right, 0px)) calc(.45rem + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  background: var(--navy); color: #fff; font-size: .82rem; }
.container { padding-bottom: 5rem; }
.toast { bottom: 3.5rem; }
`;

const fragment = `<title>Marstal Navigationsskole Portal</title>
<style>
${css}
${demoCss}
</style>
${body}
<script>
${read('seed.js')}
</script>
<script>
${read('api.js')}
</script>
<script>
${adapter}
</script>
<script>
${appJs}
</script>
`;
// Helt dokument, så filen også kan åbnes ved at dobbeltklikke på den.
const html = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
${fragment}</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'demo'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'demo', 'portal.html'), html);
// Uden <html>/<head>/<body> – til udgivelse som Claude-artifact (som selv tilføjer dem).
const out = process.argv[2];
if (out) fs.writeFileSync(out, fragment);
console.log('Skrevet: demo/portal.html (' + Math.round(html.length / 1024) + ' kB)');
