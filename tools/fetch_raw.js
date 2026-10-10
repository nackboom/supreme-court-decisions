// 법제처 판례 본문(JSON)을 받아 raw/연도/사건번호.md 로 저장한다. 내용은 고치지 않고 <br/> 만 줄바꿈으로 바꾼다.
// 사용법: node tools/fetch_raw.js <판례일련번호> [<판례일련번호> ...]   (법제처 OC 는 환경변수 LAW_OC)
const https = require("https"), fs = require("fs"), path = require("path");
const OC = process.env.LAW_OC;
if (!OC) { console.error("환경변수 LAW_OC(법제처 API 아이디)가 필요합니다."); process.exit(2); }

// 응답을 Buffer 로 모아 한 번에 해독(한글이 조각 경계에서 깨지지 않게)
const get = u => new Promise((res, rej) => https.get(u, r => {
  const c = []; r.on("data", x => c.push(x)); r.on("end", () => res(Buffer.concat(c).toString("utf8")));
}).on("error", rej));
const clean = s => (s || "").replace(/<br\s*\/?>/gi, "\n").replace(/[ \t]+\n/g, "\n").trim();

(async () => {
  for (const id of process.argv.slice(2)) {
    const j = JSON.parse(await get(`https://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=prec&ID=${id}&type=JSON`));
    const p = j.PrecService;
    const no = p["사건번호"], ymd = p["선고일자"];          // 예: 20260521
    const key = no.replace(/,\s*/g, "_");                // 병합 사건번호의 쉼표·공백은 파일 이름에서 _ 로
    const out = [
      `> 국가법령정보센터(법제처) 판례 공개 데이터를 그대로 옮긴 것임 — 판례 일련번호 ${id}`,
      ``,
      `# ${p["사건명"]}`,
      ``,
      `- 법원: ${p["법원명"]}`,
      `- 선고일: ${ymd}`,
      `- 사건번호: ${no}`,
      `- 판결유형: ${p["판결유형"]}`,
      ``,
      `## 판시사항`, ``, clean(p["판시사항"]), ``,
      `## 판결요지`, ``, clean(p["판결요지"]), ``,
      `## 참조조문`, ``, clean(p["참조조문"]), ``,
      `## 참조판례`, ``, clean(p["참조판례"]), ``,
      `## 판례내용`, ``, clean(p["판례내용"]), ``
    ].join("\n");
    const dir = path.join("raw", ymd.slice(0, 4));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${key}.md`), out);
    console.log("저장", path.join(dir, `${key}.md`), out.length, "자");
  }
})().catch(e => { console.error("오류", e.message); process.exit(1); });
