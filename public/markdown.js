// Lille, sikker markdown-visning til lærebøger.
// Al tekst escapes først; kun tags vi selv laver kommer igennem, og links/billeder skal være http(s).
'use strict';

function mdEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mdInline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

function mdToHtml(src) {
  const lines = mdEscape(String(src || '').replace(/\r\n?/g, '\n')).split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${mdInline(para.join(' '))}</p>`); para = []; } };
  const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const code = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i]);
      out.push(`<pre><code>${code.join('\n')}</code></pre>`);
      continue;
    }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { flush(); const lvl = Math.min(m[1].length + 1, 5); out.push(`<h${lvl}>${mdInline(m[2])}</h${lvl}>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
      i--;
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${
        rows.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^&gt;\s?/.test(line)) {
      flush();
      const q = [];
      for (; i < lines.length && /^&gt;\s?/.test(lines[i]); i++) q.push(lines[i].replace(/^&gt;\s?/, ''));
      i--;
      out.push(`<blockquote>${mdInline(q.join(' '))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${mdInline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

function md(src) {
  const div = document.createElement('div');
  div.className = 'md';
  div.innerHTML = mdToHtml(src);
  return div;
}

// ---------- Indhold med henvisninger ----------
// {{fakta:nøgle}} → værdi, {{kilde:nøgle}} → kildehenvisning, {{formel:nøgle}} → interaktiv beregner.
// refs = { facts, formulas, sources } – enten et låst øjebliksbillede (udgave) eller live (kladde).
const REF_TOKEN = /\{\{(fakta|formel|kilde):([A-Za-z0-9_-]+)\}\}/g;
function renderDoc(src, refs, opts = {}) {
  refs = refs || { facts: {}, formulas: {}, sources: {} };
  const root = md(src);
  // Afsnit, der kun består af én formel, bliver til en blok
  root.querySelectorAll('p').forEach((p) => {
    const m = /^\s*\{\{formel:([A-Za-z0-9_-]+)\}\}\s*$/.exec(p.textContent);
    if (m) p.replaceWith(refNode('formel', m[1], refs, opts, true));
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) if (/\{\{(fakta|formel|kilde):/.test(walker.currentNode.nodeValue)) hits.push(walker.currentNode);
  for (const node of hits) {
    const frag = document.createDocumentFragment();
    let last = 0;
    const text = node.nodeValue;
    for (const m of text.matchAll(REF_TOKEN)) {
      frag.append(text.slice(last, m.index), refNode(m[1], m[2], refs, opts, false));
      last = m.index + m[0].length;
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  // Overskrifter får ankre, så de kan bogmærkes og linkes
  root.querySelectorAll('h2, h3, h4').forEach((hd, i) => { hd.id = 'afsnit-' + (i + 1); });
  return root;
}
function refNode(kind, key, refs, opts, block) {
  if (kind === 'fakta') {
    const f = refs.facts[key];
    if (!f) return h('span.ref.ref-missing', { title: 'Ukendt central oplysning' }, `[${key}]`);
    return h('span.ref.ref-fact', { title: `${f.label} – central oplysning${opts.teacher ? ' (rettes under Centrale oplysninger)' : ''}` }, `${f.value}${f.unit ? ' ' + f.unit : ''}`);
  }
  if (kind === 'kilde') {
    const s = refs.sources[key];
    if (!s) return h('span.ref.ref-missing', `[ukendt kilde: ${key}]`);
    const chip = h('button.ref.ref-source', { type: 'button', 'aria-expanded': 'false', title: `${s.sourceTitle} ${s.ref}` }, icon('scale', 14), ` ${s.source} ${s.ref}`);
    const pop = h('span.source-pop', { hidden: true },
      h('strong', `${s.source} ${s.ref}${s.title ? ' – ' + s.title : ''}`), h('span.source-text', s.text),
      s.validFrom ? h('span.small.muted', `Gælder fra ${s.validFrom}`) : null,
      s.url ? h('a.small', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, 'Officiel kilde ↗') : null);
    chip.addEventListener('click', () => { pop.hidden = !pop.hidden; chip.setAttribute('aria-expanded', String(!pop.hidden)); });
    return h('span.ref-wrap', chip, pop);
  }
  const f = refs.formulas[key];
  if (!f) return h(block ? 'div.ref.ref-missing.block' : 'span.ref.ref-missing', `Formlen “${key}” findes ikke i formelbiblioteket`);
  return typeof formulaWidget === 'function' ? formulaWidget(f, { compact: !block }) : h('span', f.name);
}
