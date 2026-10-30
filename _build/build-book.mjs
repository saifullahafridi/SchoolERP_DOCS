// Builds guide.html: the whole user guide as one book page (cover, contents, every chapter).
// Run from the repo root:  node _build/build-book.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { Marked } from 'marked';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = f => readFileSync(root + f, 'utf8').replace(/\r\n/g, '\n');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = s => s.replace(/<[^>]+>/g, '');
const slug = s => stripTags(s).toLowerCase().replace(/&#?\w+;/g, '').replace(/[^\w\- ]/g, '').trim().replace(/ /g, '-');

const chapterFiles = readdirSync(root).filter(f => /^\d\d-.*\.md$/.test(f)).sort();
const chapterId = f => 'ch' + f.slice(0, 2);

// "05-fees.md#x" -> "#ch05-x", "05-fees.md" -> "#ch05", "README.md" -> "#contents"
function rewriteHref(href) {
  const m = href.match(/^(\d\d)-[^#]*\.md(?:#(.*))?$/);
  if (m) return m[2] ? `#ch${m[1]}-${m[2]}` : `#ch${m[1]}`;
  if (/^README\.md/.test(href)) return '#contents';
  return href;
}

function render(md, prefix, toc) {
  const seen = {};
  const renderer = {
    heading(text, level) {
      let id = slug(text);
      seen[id] = (seen[id] ?? -1) + 1;
      if (seen[id]) id += '-' + seen[id];
      id = `${prefix}-${id}`;
      if (level === 2) toc.push({ id, title: stripTags(text) });
      return `<h${level + 1} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${text}</h${level + 1}>\n`;
    },
    link(href, title, text) {
      const h = rewriteHref(href);
      const ext = /^https?:/.test(h) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${esc(h)}"${title ? ` title="${esc(title)}"` : ''}${ext}>${text}</a>`;
    },
    image(href, title, text) {
      return `<figure><img src="${esc(href)}" alt="${esc(text)}" loading="lazy"><figcaption>${esc(text)}</figcaption></figure>`;
    },
    table(header, body) {
      return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
    },
  };
  const marked = new Marked({ gfm: true, renderer });
  return marked.parse(md);
}

// Front matter from README: intro paragraphs + the sections after "Contents"
const readme = read('README.md');
const bookTitle = readme.match(/^# (.+)$/m)[1];
const intro = readme.split(/^## Contents$/m)[0].replace(/^# .+\n/, '').replace(/^📖.*\n?/m, '').trim();
const afterContents = readme.split(/^## Contents$/m)[1].replace(/^[\s\S]*?(?=^## )/m, '');
const introToc = [];
const introHtml = render(afterContents, 'ch00', introToc);

const chapters = chapterFiles.map((f, i) => {
  let md = read(f);
  md = md.replace(/^\[User Guide\]\(README\.md\).*\n+/, '');          // breadcrumb
  md = md.replace(/\n-{3,}\n+(Previous|Next|Back)[^\n]*\n*$/, '\n');   // prev/next footer
  const title = md.match(/^# (.+)$/m)[1];
  md = md.replace(/^# .+\n/m, '');
  const toc = [];
  const id = chapterId(f);
  const html = render(md, id, toc);
  return { id, num: i + 1, title, html, toc };
});

const chapterNav = c => {
  const prev = chapters[c.num - 2], next = chapters[c.num];
  return `<nav class="pager">${prev ? `<a href="#${prev.id}" class="prev"><small>Previous chapter</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="#${next.id}" class="next"><small>Next chapter</small>${esc(next.title)}</a>` : `<a href="#cover" class="next"><small>The end</small>Back to the start</a>`}</nav>`;
};

const sideToc = [
  `<li><a href="#ch00">Before you start</a><ul>${introToc.map(s => `<li><a href="#${s.id}">${s.title}</a></li>`).join('')}</ul></li>`,
  ...chapters.map(c => `<li><a href="#${c.id}"><span class="n">${c.num}</span>${esc(c.title)}</a><ul>${c.toc.map(s => `<li><a href="#${s.id}">${s.title}</a></li>`).join('')}</ul></li>`),
].join('\n');

const contentsPage = chapters.map(c => `
  <li><a href="#${c.id}"><span class="n">Chapter ${c.num}</span><span class="t">${esc(c.title)}</span></a>
    <ol>${c.toc.map(s => `<li><a href="#${s.id}">${s.title}</a></li>`).join('')}</ol></li>`).join('');

const totalImages = chapters.reduce((n, c) => n + (c.html.match(/<figure>/g) || []).length, 0);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SchoolERP User Guide</title>
<meta name="description" content="How to use every screen of MY School, in one book with screenshots.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #fbfaf7; --paper: #ffffff; --ink: #1f2328; --muted: #5f6670; --line: #e6e2d9;
  --accent: #1d5fa8; --accent-soft: #e8f0fa; --side: #f4f1ea; --shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.05);
  --serif: "Literata", Georgia, serif; --sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #15171a; --paper: #1c1f23; --ink: #e6e6e3; --muted: #a0a6ad; --line: #2e3238;
  --accent: #7fb2ee; --accent-soft: #1f2d3d; --side: #181a1e; --shadow: 0 1px 3px rgba(0,0,0,.4);
}}
:root[data-theme="dark"] {
  --bg: #15171a; --paper: #1c1f23; --ink: #e6e6e3; --muted: #a0a6ad; --line: #2e3238;
  --accent: #7fb2ee; --accent-soft: #1f2d3d; --side: #181a1e; --shadow: 0 1px 3px rgba(0,0,0,.4);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 72px; }
body { margin: 0; overflow-x: hidden; background: var(--bg); color: var(--ink); font: 17px/1.7 var(--serif); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* top bar */
.topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 16px;
  background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); font-family: var(--sans); }
.topbar .brand { font-weight: 600; font-size: 15px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topbar .where { color: var(--muted); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.btn { font: 500 14px var(--sans); color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 8px; padding: 6px 12px; cursor: pointer; white-space: nowrap; }
.btn:hover { border-color: var(--accent); }
#menuBtn { display: none; }
.progress { position: absolute; left: 0; bottom: -1px; height: 2px; background: var(--accent); width: 0; }

/* layout */
.layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); }
.side { position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; background: var(--side); border-right: 1px solid var(--line);
  padding: 20px 12px 40px; font: 14px/1.45 var(--sans); }
.side ol { list-style: none; margin: 0; padding: 0; }
.side > ol > li > a { display: flex; gap: 8px; padding: 7px 10px; border-radius: 6px; color: var(--ink); font-weight: 500; }
.side .n { color: var(--muted); min-width: 18px; font-variant-numeric: tabular-nums; }
.side ul { list-style: none; margin: 0 0 6px; padding: 0 0 0 36px; display: none; }
.side li.open > ul { display: block; }
.side ul a { display: block; padding: 4px 8px; border-radius: 6px; color: var(--muted); }
.side a:hover { background: var(--accent-soft); text-decoration: none; }
.side a.active { color: var(--accent); background: var(--accent-soft); }

main { padding: 0 24px 80px; }
.page { max-width: 820px; margin: 32px auto; background: var(--paper); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 56px 64px; }

/* cover */
.cover { text-align: center; padding: 96px 48px; }
.cover .kicker { font: 600 13px var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
.cover h1 { font-size: 52px; line-height: 1.1; margin: 16px 0 8px; }
.cover .sub { font-size: 20px; color: var(--muted); margin: 0 0 40px; }
.cover .lead { text-align: left; max-width: 600px; margin: 0 auto; }
.cover .facts { display: flex; justify-content: center; gap: 32px; margin: 40px 0 32px; font-family: var(--sans); color: var(--muted); font-size: 14px; flex-wrap: wrap; }
.cover .facts b { display: block; font-size: 28px; color: var(--ink); font-family: var(--serif); }

/* contents */
.contents h2 { font-size: 34px; margin: 0 0 24px; }
.contents > ol { list-style: none; padding: 0; margin: 0; }
.contents > ol > li { border-top: 1px solid var(--line); padding: 14px 0; }
.contents > ol > li > a { display: flex; gap: 16px; align-items: baseline; color: var(--ink); font-weight: 600; font-size: 19px; }
.contents .n { font: 600 12px var(--sans); color: var(--accent); text-transform: uppercase; letter-spacing: .08em; min-width: 82px; }
.contents ol ol { list-style: none; padding: 4px 0 0 98px; margin: 0; columns: 2; column-gap: 24px; font: 14px/1.6 var(--sans); }
.contents ol ol a { color: var(--muted); }

/* chapter */
.chapter-head { border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 28px; }
.chapter-head .label { font: 600 13px var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
.chapter-head h2 { font-size: 38px; line-height: 1.15; margin: 8px 0 0; }
.page h3 { font-size: 25px; line-height: 1.3; margin: 44px 0 12px; }
.page h4 { font-size: 19px; margin: 28px 0 8px; }
.anchor { float: left; margin-left: -1em; width: 1em; color: var(--muted); opacity: 0; font-weight: 400; }
h3:hover .anchor, h4:hover .anchor { opacity: .6; text-decoration: none; }
.page p, .page li { hyphens: auto; }
.page code { font-size: .88em; background: var(--accent-soft); padding: 1px 5px; border-radius: 4px; }
.page blockquote { margin: 20px 0; padding: 12px 18px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 8px 8px 0; }
.page blockquote p { margin: 0; }
figure { margin: 24px 0 28px; }
figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; cursor: zoom-in; background: #fff; }
figcaption { font: 13px var(--sans); color: var(--muted); text-align: center; margin-top: 8px; }
.table-wrap { overflow-x: auto; margin: 20px 0; }
table { border-collapse: collapse; width: 100%; font: 15px/1.5 var(--sans); }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-weight: 600; background: var(--side); }
hr { border: 0; border-top: 1px solid var(--line); margin: 32px 0; }
.pager { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); font-family: var(--sans); }
.pager a { display: block; border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; color: var(--ink); font-weight: 500; }
.pager a:hover { border-color: var(--accent); text-decoration: none; }
.pager small { display: block; color: var(--muted); font-size: 12px; font-weight: 400; }
.pager .next { text-align: right; }

/* lightbox */
.lightbox { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.85); display: none; align-items: center; justify-content: center; padding: 24px; cursor: zoom-out; }
.lightbox.show { display: flex; }
.lightbox img { max-width: 100%; max-height: 100%; border-radius: 6px; }
.scrim { display: none; }

@media (max-width: 960px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .topbar { gap: 8px; }
  .topbar .brand { flex: 1; min-width: 0; }
  #printBtn { display: none; }
  #menuBtn { display: inline-block; }
  .side { position: fixed; top: 56px; left: 0; bottom: 0; height: auto; width: min(320px, 86vw); z-index: 25; transform: translateX(-100%); transition: transform .2s; }
  body.menu-open .side { transform: none; }
  body.menu-open .scrim { display: block; position: fixed; inset: 56px 0 0; background: rgba(0,0,0,.35); z-index: 20; }
  main { padding: 0 16px 60px; }
  .page { padding: 32px 22px; margin: 16px auto; border-radius: 10px; }
  .cover { padding: 56px 22px; }
  .cover h1 { font-size: 36px; }
  .chapter-head h2 { font-size: 30px; }
  .contents ol ol { columns: 1; padding-left: 0; }
  .contents > ol > li > a { flex-direction: column; gap: 2px; }
  .topbar .where { display: none; }
  body { font-size: 16px; }
}
@media print {
  .topbar, .side, .pager, .lightbox, .scrim { display: none !important; }
  .layout { display: block; } main { padding: 0; }
  body { background: #fff; color: #000; font-size: 11pt; }
  .page { border: 0; box-shadow: none; margin: 0; padding: 0; max-width: none; page-break-after: always; }
  figure, table { page-break-inside: avoid; }
  h3, h4 { page-break-after: avoid; }
  a { color: inherit; }
}
</style>
</head>
<body>
<header class="topbar">
  <button class="btn" id="menuBtn" aria-label="Open chapters">☰ Chapters</button>
  <a class="brand" href="#cover">${esc(bookTitle)}</a>
  <span class="where" id="where"></span>
  <button class="btn" id="printBtn" title="Print or save the whole book as PDF">Print / PDF</button>
  <button class="btn" id="themeBtn" aria-label="Switch light or dark">◐</button>
  <div class="progress" id="progress"></div>
</header>
<div class="scrim" id="scrim"></div>
<div class="layout">
<aside class="side" id="side">
  <ol>
    <li><a href="#cover">Cover</a></li>
    <li><a href="#contents">Contents</a></li>
    ${sideToc}
  </ol>
</aside>
<main>
  <section class="page cover" id="cover" data-title="Cover">
    <div class="kicker">User Guide</div>
    <h1>${esc(bookTitle.replace(/\s*—\s*User Guide$/, ''))}</h1>
    <p class="sub">How to use every screen, step by step</p>
    <div class="lead">${render(intro, 'cover', [])}</div>
    <div class="facts"><div><b>${chapters.length}</b>chapters</div><div><b>${chapters.reduce((n, c) => n + c.toc.length, 0)}</b>topics</div><div><b>${totalImages}</b>screenshots</div></div>
    <a class="btn" href="#contents">Start reading ↓</a>
  </section>

  <section class="page contents" id="contents" data-title="Contents">
    <h2>Contents</h2>
    <ol>
      <li><a href="#ch00"><span class="n">Start here</span><span class="t">Before you start</span></a>
        <ol>${introToc.map(s => `<li><a href="#${s.id}">${s.title}</a></li>`).join('')}</ol></li>
      ${contentsPage}
    </ol>
  </section>

  <section class="page chapter" id="ch00" data-title="Before you start">
    <div class="chapter-head"><div class="label">Start here</div><h2>Before you start</h2></div>
    ${introHtml}
    <nav class="pager"><span></span><a href="#${chapters[0].id}" class="next"><small>Chapter 1</small>${esc(chapters[0].title)}</a></nav>
  </section>

${chapters.map(c => `  <section class="page chapter" id="${c.id}" data-title="Chapter ${c.num} · ${esc(c.title)}">
    <div class="chapter-head"><div class="label">Chapter ${c.num}</div><h2>${esc(c.title)}</h2></div>
    ${c.html}
    ${chapterNav(c)}
  </section>`).join('\n\n')}
</main>
</div>
<div class="lightbox" id="lightbox"><img alt=""></div>
<script>
(function () {
  var root = document.documentElement;
  try { var t = localStorage.getItem('theme'); if (t) root.setAttribute('data-theme', t); } catch (e) {}
  document.getElementById('themeBtn').onclick = function () {
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  };
  document.getElementById('printBtn').onclick = function () { window.print(); };

  var body = document.body;
  document.getElementById('menuBtn').onclick = function () { body.classList.toggle('menu-open'); };
  document.getElementById('scrim').onclick = function () { body.classList.remove('menu-open'); };
  document.querySelectorAll('.side a').forEach(function (a) { a.addEventListener('click', function () { body.classList.remove('menu-open'); }); });

  var lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img');
  document.querySelectorAll('figure img').forEach(function (img) {
    img.addEventListener('click', function () { lbImg.src = img.src; lbImg.alt = img.alt; lb.classList.add('show'); });
  });
  lb.onclick = function () { lb.classList.remove('show'); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('show'); });

  // Highlight where the reader is in the sidebar
  var links = {};
  document.querySelectorAll('.side a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  var targets = Array.prototype.slice.call(document.querySelectorAll('section.page, section.page h3[id]'));
  var where = document.getElementById('where'), bar = document.getElementById('progress'), current = null;
  function update() {
    var y = window.scrollY + 90, active = targets[0];
    for (var i = 0; i < targets.length; i++) { if (targets[i].offsetTop <= y) active = targets[i]; else break; }
    var max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
    if (active === current) return;
    current = active;
    var section = active.closest('section.page');
    document.querySelectorAll('.side a.active').forEach(function (a) { a.classList.remove('active'); });
    document.querySelectorAll('.side li.open').forEach(function (li) { li.classList.remove('open'); });
    var chap = links[section.id];
    if (chap) { chap.classList.add('active'); chap.parentElement.classList.add('open'); }
    var sub = links[active.id];
    if (sub && sub !== chap) sub.classList.add('active');
    var vis = sub || chap;
    if (vis && !body.classList.contains('menu-open')) {
      var side = document.getElementById('side'), r = vis.getBoundingClientRect(), sr = side.getBoundingClientRect();
      if (r.top < sr.top + 40 || r.bottom > sr.bottom - 40) side.scrollTop += r.top - sr.top - sr.height / 3;
    }
    where.textContent = section.getAttribute('data-title') || '';
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
</script>
</body>
</html>
`;

writeFileSync(root + 'guide.html', html);
console.log(`guide.html: ${chapters.length} chapters, ${totalImages} screenshots, ${(html.length / 1024).toFixed(0)} KB`);
