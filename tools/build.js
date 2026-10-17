// cases/ 정리본을 읽어 (1) data/cases.json (2) README.md 의 분야별 목록 (3) docs/ 공개 사이트를 만든다.
// 사용법: node tools/build.js
// 외부 패키지 없이 동작한다. 정리본은 CLAUDE.md 형식(제목·표·한눈에·절 제목·인용 블록)만 쓴다고 가정한다.
const fs = require("fs"), path = require("path");

const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FIELDS = ["민사", "형사", "행정", "가사"];
const REPO = "https://github.com/nackboom/supreme-court-decisions";

// ── 1. 정리본 → 메타데이터 ──
function parseCase(file) {
  const md = fs.readFileSync(file, "utf8");
  const key = path.basename(file, ".md");
  const folder = path.basename(path.dirname(file));
  const title = (md.match(/^# (.+)$/m) || [, ""])[1];
  const row = name => {                                   // 표의 "| 항목 | 내용 |"
    const m = md.match(new RegExp(`^\\|\\s*${name}\\s*\\|\\s*(.+?)\\s*\\|\\s*$`, "m"));
    return m ? m[1].replace(/\*\*/g, "") : "";
  };
  const glance = (md.split(/^## 한눈에.*$/m)[1] || "").split(/^## /m)[0];
  const bullet = label => ((glance.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`)) || [, ""])[1]).trim();
  const dm = title.match(/대법원 (\d{4})\. (\d{1,2})\. (\d{1,2})\./);
  const date = dm ? `${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}` : "";
  const check = (md.match(/인용 (\d+)개 중 (\d+)개 (?:원문 )?일치/) || []);
  return {
    key, folder, title, date, year: date.slice(0, 4),
    kind: /전원합의체 결정/.test(title) ? "결정" : "판결",
    caseNo: row("법원·선고일·사건번호").replace(/^대법원 .*?(?:선고|자) /, "").replace(/ 전원합의체.*$/, ""),
    caseName: row("사건명"), field: row("분야"), overruled: row("종전 판례 변경"),
    issue: bullet("쟁점"), result: bullet("결론"), opinions: bullet("의견 구성"),
    quotes: check[1] ? +check[1] : null, quotesOk: check[2] ? +check[2] : null,
    path: `cases/${folder}/${key}.md`, page: `cases/${key}.html`
  };
}

// ── 2. 정리본 Markdown → HTML(이 저장소 형식에 필요한 만큼만) ──
function inline(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // 원문 파일 경로는 저장소의 해당 파일로 연결
    .replace(/`(raw\/[^`]+\.md)`/g, (m, p) => `<a href="${REPO}/blob/main/${encodeURI(p)}"><code>${p}</code></a>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[요약\]/g, '<span class="tag">요약</span>').replace(/\[정리 기준 메모\]/g, '<span class="tag memo">정리 기준 메모</span>');
}
function mdToHtml(md) {
  const out = [], lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^# /.test(l)) out.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (/^## /.test(l)) out.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (/^### /.test(l)) out.push(`<h3>${inline(l.slice(4))}</h3>`);
    else if (/^> /.test(l)) out.push(`<blockquote>${esc(l.slice(2))}</blockquote>`);   // 원문 인용은 강조 없이 그대로
    else if (/^— /.test(l)) out.push(`<p class="loc">${inline(l)}</p>`);
    else if (/^\|/.test(l)) {                                                         // 표
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = r => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const body = rows.slice(2).map(r => `<tr>${cells(r).map((c, k) => k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`).join("")}</tr>`);
      out.push(`<table>${body.join("")}</table>`);
    } else if (/^- /.test(l)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(`<li>${inline(lines[i++].slice(2))}</li>`);
      i--; out.push(`<ul>${items.join("")}</ul>`);
    } else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join("\n");
}

const CSS = `
:root{--ink:#1f2328;--sub:#59636e;--line:#d0d7de;--bg:#fff;--soft:#f6f8fa;--accent:#0b5cad;--quote:#f3f7fc}
@media (prefers-color-scheme:dark){:root{--ink:#e6edf3;--sub:#9198a1;--line:#3d444d;--bg:#0d1117;--soft:#151b23;--accent:#4493f8;--quote:#111a26}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;line-height:1.75}
main{max-width:920px;margin:0 auto;padding:28px 16px 64px}a{color:var(--accent)}
h1{font-size:1.45rem;line-height:1.4}h2{font-size:1.15rem;margin-top:2rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:.93rem}th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}th{background:var(--soft);white-space:nowrap}
blockquote{margin:10px 0 2px;padding:9px 13px;background:var(--quote);border-left:4px solid var(--accent)}
.loc{color:var(--sub);font-size:.86rem;margin:0 0 12px}.tag{font-size:.75rem;background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:0 5px;color:var(--sub)}
.memo{border-style:dashed}code{background:var(--soft);padding:1px 5px;border-radius:4px;font-size:.88em}
.note{color:var(--sub);font-size:.88rem}.filters{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.filters select,.filters input{font:inherit;padding:6px 9px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink)}
.filters input{flex:1;min-width:180px}.list td:first-child{white-space:nowrap}
@media (max-width:640px){.hide-m{display:none}th{white-space:normal}}`;

const page = (title, body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>${CSS}</style></head><body><main>${body}</main></body></html>\n`;

// ── 실행 ──
const cases = walk("cases").filter(f => f.endsWith(".md")).map(parseCase)
  .sort((a, b) => b.date.localeCompare(a.date));
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/cases.json", JSON.stringify(cases, null, 1));

// README 의 목록 부분(표지 사이)만 바꾼다
const table = FIELDS.map(f => {
  const rows = cases.filter(c => c.folder === f);
  if (!rows.length) return "";
  return `### ${f} (${rows.length}건)\n\n| 선고일 | 사건 | 쟁점 | 종전 판례 변경 |\n|---|---|---|---|\n` +
    rows.map(c => `| ${c.date} | [${c.caseNo} ${c.kind}](${encodeURI(c.path)}) | ${c.issue.replace(/\|/g, "\\|")} | ${c.overruled.split(" — ")[0]} |`).join("\n");
}).filter(Boolean).join("\n\n");
if (fs.existsSync("README.md")) {
  const r = fs.readFileSync("README.md", "utf8");
  fs.writeFileSync("README.md", r.replace(/<!-- 목록 시작 -->[\s\S]*<!-- 목록 끝 -->/, `<!-- 목록 시작 -->\n\n${table}\n\n<!-- 목록 끝 -->`));
}

// 사이트: 판결별 페이지 + 목록 페이지
fs.mkdirSync("docs/cases", { recursive: true });
for (const c of cases) {
  const md = fs.readFileSync(c.path, "utf8");
  fs.writeFileSync(`docs/${c.page}`, page(c.title, `<p><a href="../">← 전체 목록</a></p>${mdToHtml(md)}
<p class="note">판결문 인용은 국가법령정보센터(법제처) 공개 데이터와 글자 단위로 대조했습니다. 인용할 때는 원문을 직접 확인하십시오.</p>`));
}
const opts = (arr, label) => `<option value="">${label} 전체</option>` + arr.map(v => `<option>${v}</option>`).join("");
const years = [...new Set(cases.map(c => c.year))].sort().reverse();
const rowsHtml = cases.map(c => `<tr data-f="${c.folder}" data-y="${c.year}" data-t="${esc([c.caseNo, c.caseName, c.issue, c.result, c.field].join(" "))}">
<td>${c.date}</td><td><a href="${encodeURI(c.page)}">${esc(c.caseNo)}</a><br><span class="note">${esc(c.caseName)} · ${c.kind}</span></td>
<td>${esc(c.issue)}</td><td class="hide-m">${esc(c.field)}</td><td class="hide-m">${esc(c.overruled.split(" — ")[0])}</td></tr>`).join("");
fs.writeFileSync("docs/index.html", page("대법원 전원합의체 판결·결정 정리", `
<h1>대법원 전원합의체 판결·결정 정리 (2021. 1. ~ )</h1>
<p>쟁점·사실관계·다수의견·종전 판례 변경·별개·반대의견을 판결문 원문 그대로 인용해 정리했습니다. 모든 인용은 법제처 공개 원문과 글자 단위로 대조했습니다. <span class="note">총 ${cases.length}건</span></p>
<p class="note"><a href="${REPO}">저장소 보기</a> — 원문 파일·정리 기준·변경 이력</p>
<div class="filters"><select id="f">${opts(FIELDS, "분야")}</select><select id="y">${opts(years, "연도")}</select><input id="q" type="search" placeholder="사건번호·사건명·쟁점 검색"></div>
<table class="list"><thead><tr><th>선고일</th><th>사건</th><th>쟁점</th><th class="hide-m">분야</th><th class="hide-m">종전 판례 변경</th></tr></thead><tbody id="rows">${rowsHtml}</tbody></table>
<p class="note" id="cnt"></p>
<p class="note">정리본은 연습·참고용입니다. 인용할 때는 반드시 판결문 원문을 직접 확인하십시오. 판결문 원문: 국가법령정보센터(법제처) 판례 공개 데이터.</p>
<script>
const f=document.getElementById("f"),y=document.getElementById("y"),q=document.getElementById("q"),rows=[...document.querySelectorAll("#rows tr")],cnt=document.getElementById("cnt");
function apply(){const t=q.value.trim();let n=0;rows.forEach(r=>{const ok=(!f.value||r.dataset.f===f.value)&&(!y.value||r.dataset.y===y.value)&&(!t||r.dataset.t.includes(t));r.hidden=!ok;if(ok)n++});cnt.textContent=n+"건 표시";}
[f,y,q].forEach(e=>e.addEventListener("input",apply));apply();
</script>`));
console.log(`정리본 ${cases.length}건 → data/cases.json, docs/(${cases.length}쪽 + 목록)${fs.existsSync("README.md") ? ", README 목록" : ""}`);
