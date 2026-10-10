// cases/ 아래 정리본의 인용문(> 로 시작하는 줄)이 같은 사건번호의 raw/ 원문에 글자 그대로 있는지 대조한다.
// 사용법: node tools/check_quotes.js              (전체)
//        node tools/check_quotes.js 2018다296229   (한 건)
//        node tools/check_quotes.js --write       (전부 일치한 파일은 끝의 "## 원문 대조 결과" 줄을 실제 숫자로 갱신)
const fs = require("fs"), path = require("path");

// 줄바꿈·연속 공백만 하나로 맞추고 글자는 바꾸지 않음
const norm = s => s.replace(/\s+/g, " ").trim();
const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

const args = process.argv.slice(2);
const write = args.includes("--write");
const only = args.find(a => !a.startsWith("--"));
const d = new Date();
const today = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
const BT = "`";

const rawIndex = Object.fromEntries(walk("raw").map(f => [path.basename(f, ".md"), f]));
let totalQ = 0, totalOk = 0, failFiles = 0;

for (const file of walk("cases").filter(f => f.endsWith(".md"))) {
  const no = path.basename(file, ".md");
  if (only && no !== only) continue;
  if (!rawIndex[no]) { console.log(`✗ ${no}: 원문 파일 없음`); failFiles++; continue; }
  const raw = norm(fs.readFileSync(rawIndex[no], "utf8"));
  const md = fs.readFileSync(file, "utf8");
  const quotes = md.split(/\r?\n/).filter(l => l.startsWith("> ")).map(l => l.slice(2));
  const bad = quotes.filter(q => !raw.includes(norm(q)));
  totalQ += quotes.length; totalOk += quotes.length - bad.length;
  console.log(`${bad.length ? "✗" : "✓"} ${no}: 인용 ${quotes.length}개 중 ${quotes.length - bad.length}개 일치`);
  bad.forEach(q => console.log(`    불일치 — ${q.slice(0, 50)}…`));
  if (bad.length) { failFiles++; continue; }
  if (write) {
    // 결과 줄을 실제 숫자로 다시 쓴다(손으로 적은 숫자와 어긋나지 않게)
    const rawPath = rawIndex[no].split(path.sep).join("/");
    const line = `인용 ${quotes.length}개 중 ${quotes.length}개 원문 일치 — ${BT}tools/check_quotes.js${BT}로 ${BT}${rawPath}${BT}와 대조(${today})`;
    const head = md.split(/^## 원문 대조 결과.*$/m)[0].replace(/\s*$/, "");
    fs.writeFileSync(file, `${head}\n\n## 원문 대조 결과\n\n${line}\n`);
  }
}
console.log(`합계: 인용 ${totalQ}개 중 ${totalOk}개 일치 / 불일치 파일 ${failFiles}개`);
process.exit(failFiles ? 1 : 0);
