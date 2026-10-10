// 정리본의 형식·표 칸을 원문과 기계로 맞춰 본다(인용 대조는 check_quotes.js 가 따로 한다).
// 사용법: node tools/audit.js
// 점검: 절 구성, 판결/결정 제목 표기(선고/자), 사건명 = 원문 제목, 원심 사건번호가 원문에 있는지,
//       5절 의견 소제목의 대법관 이름이 원문 끝 서명란에 있는지
const fs = require("fs"), path = require("path");

const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const norm = s => s.replace(/\s+/g, " ").trim();
const raw = Object.fromEntries(walk("raw").map(f => [path.basename(f, ".md"), fs.readFileSync(f, "utf8")]));
const NEED = ["## 한눈에", "## 1. 사실관계", "## 2. 쟁점", "## 3. 대법원 판단", "## 4. 종전 판례 변경",
  "## 5. 별개", "## 6. 주문", "## 원문 대조 결과"];

const issues = [];
for (const f of walk("cases").filter(f => f.endsWith(".md"))) {
  const k = path.basename(f, ".md"), md = fs.readFileSync(f, "utf8"), r = raw[k];
  if (!r) { issues.push(`${k}: 원문 없음`); continue; }
  const R = norm(r);
  const row = name => {
    const line = md.split(/\r?\n/).find(l => l.startsWith(`| ${name} |`));
    return line ? line.split("|")[2].trim().replace(/\*\*/g, "") : "";
  };

  const lack = NEED.filter(h => !md.includes(h));
  if (lack.length) issues.push(`${k}: 빠진 절 ${lack.join(", ")}`);

  const isDecision = /전원합의체 결정/.test((r.match(/판결유형: (.+)/) || [, ""])[1]);
  const title = md.split(/\r?\n/)[0];
  if (isDecision && !/\. 자 /.test(title)) issues.push(`${k}: 결정인데 제목에 "자" 없음`);
  if (!isDecision && !/ 선고 /.test(title)) issues.push(`${k}: 판결인데 제목에 "선고" 없음`);

  const rawName = norm((r.match(/^# (.+)$/m) || [, ""])[1]);
  if (norm(row("사건명")) !== rawName) issues.push(`${k}: 사건명 다름 — 표 "${row("사건명")}" / 원문 "${rawName}"`);

  const lower = row("원심");
  const nums = lower.match(/\d{4}[가-힣]{1,3}\d+/g) || [];
  if (!nums.length) issues.push(`${k}: 원심 칸에 사건번호 없음 — "${lower}"`);
  nums.forEach(n => { if (!R.includes(n)) issues.push(`${k}: 원심 사건번호 ${n} 원문에 없음`); });

  const sign = norm(r.slice(-500));
  const sec = (md.split("## 5. 별개")[1] || "").split("## 6.")[0];
  for (const h of sec.match(/^\*\*.+\*\*.*$/gm) || []) {
    // "대법관" 바로 뒤에서 시작해 쉼표·가운뎃점으로 이어지는 이름만 뽑는다(괄호 안 일반 낱말 제외)
    const names = [];
    for (const m of h.matchAll(/대법관\s+((?:[가-힣]{2,4}(?:\s*[,·/]\s*(?:대법관\s+)?|\s*$|(?=[)\s])))+)/g))
      m[1].split(/[,·/]/).map(s => s.replace(/대법관/, "").trim()).filter(s => /^[가-힣]{2,4}$/.test(s)).forEach(s => names.push(s));
    names.forEach(nm => { if (!sign.includes(nm)) issues.push(`${k}: 5절 대법관 "${nm}" 서명란에 없음`); });
  }


  // 원문 판시사항의 모든 항목([1], [2] …)이 2절에 원문 그대로 인용되었는지
  const psRaw = (r.split("## 판시사항")[1] || "").split("## 판결요지")[0];
  const psItems = psRaw.split(/\n(?=\s*\[\d+\])/).map(norm).filter(Boolean);
  const sec2 = norm((md.split("## 2. 쟁점")[1] || "").split("## 3.")[0]);
  psItems.filter(it => !sec2.includes(it)).forEach(it => issues.push(`${k}: 판시사항 ${(it.match(/^\[\d+\]/) || ["(번호 없음)"])[0]} 이 2절에 없음`));

  // 원문 결론부 "이 판결(결정)에는 … 의견이 있는 외에는 …" 문장의 대법관이 모두 5절에 나오는지(의견 누락 점검)
  const opinionSentence = R.match(/이 (?:판결|결정)에는[^.]*?(?:의견이 있는 외에는|의견이 있다|의견이 있고)[^.]*\./g) || [];
  const secText = norm(sec);
  for (const s of opinionSentence)
    for (const m of s.matchAll(/대법관 ([가-힣]{2,3}?)(?=의|,|\s|과 |와 )/g))
      if (!secText.includes(m[1])) issues.push(`${k}: 결론부 의견 문장의 대법관 "${m[1]}"이 5절에 없음`);
}
console.log(issues.length ? issues.join("\n") : "점검 이상 없음");
console.log(`점검 ${walk("cases").filter(f => f.endsWith(".md")).length}건, 지적 ${issues.length}건`);
