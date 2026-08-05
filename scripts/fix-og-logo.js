// og-image-hook*.png (카카오톡/트위터 공유 카드) 좌상단의 로고 아이콘+브랜드 텍스트만
// 찾아서 다시 그리는 스크립트. 이 파일들은 Playwright 스크린샷으로 만든 라스터
// 이미지라 HTML처럼 통째로 텍스트를 바꿔칠 수 없음 — 그래서 "로고 영역만" 픽셀
// 스캔으로 정확히 찾아 배경색으로 지우고 최신 마스코트 SVG로 재합성하는 방식을 씀
// (2026-08-05, index.html 로고를 볼터치·눈 하이라이트 있는 버전으로 바꾼 뒤 og 카드
// 78개+기본 카드가 옛 로고로 남아있던 걸 고치면서 만듦 — 자세한 배경은 HANDOFF.md
// "공유카드(OG 이미지) 로고" 항목 참고).
//
// 사용법:
//   node scripts/fix-og-logo.js                 # 저장소 루트의 og-image-hook*.png 전부
//   node scripts/fix-og-logo.js foo.png bar.png  # 지정한 파일만
//
// 전제:
//   - 로고 영역은 어느 페이지든 아이콘 + 라틴 워드마크 "ChamTax" 고정
//     (한국어 "참택스"를 쓰는 og-image-hook.png 하나는 아이콘 잉크 크기가 다른 파일들과
//     달라(42x25px, 정사각형 필터 범위 밖) 자동 검출 대상에서 자연히 제외됨 — 이미 다른
//     방식으로 고쳐져 있으니 정상. 필요하면 BRAND_TEXT를 바꾸고 아이콘 크기 필터도 맞춰서 쓸 것)
//   - Playwright가 전역 설치돼 있어야 함(이 저장소 package.json엔 없음 — 감사
//     스크립트들과 같은 전제). 이 샌드박스에선
//     `NODE_PATH=/opt/node22/lib/node_modules node scripts/fix-og-logo.js` 로 실행.
//
// 다음에 로고 디자인이 또 바뀌면: 아래 ICON_SVG만 최신 마스코트 마크업으로 바꾸고
// 이 스크립트를 그대로 다시 돌리면 됨 — 위치 검출 로직은 안 건드려도 됨.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// document.fonts.ready can hang indefinitely if the Pretendard CDN fetch stalls
// (seen in some sandboxes) — always race it against a timeout so one flaky
// network request can't hang the whole batch.
async function fontsReadyWithTimeout(page, ms = 5000) {
  await Promise.race([
    page.evaluate(() => document.fonts.ready),
    new Promise(resolve => setTimeout(resolve, ms)),
  ]);
}

const ROOT = path.resolve(__dirname, '..');
const BRAND_TEXT = 'ChamTax';

// index.html 네비게이션 로고(.mascot-mark)와 동일한 SVG. 색상은 라이트 테마 고정값으로
// 박아넣음(--card:#FFFFFF, --teal:#155445, --text-dark:#262420) — OG 카드는 항상
// 라이트 배경이라 다크모드 대응은 필요 없음.
const ICON_SVG = `
  <svg width="ICONSIZE" height="ICONSIZE" viewBox="0 0 28 28" aria-hidden="true">
    <ellipse cx="6.1" cy="10.4" rx="2.7" ry="4" fill="#FFFFFF" stroke="#155445" stroke-width="1.7" transform="rotate(-24 6.1 10.4)"/>
    <ellipse cx="21.9" cy="10.4" rx="2.7" ry="4" fill="#FFFFFF" stroke="#155445" stroke-width="1.7" transform="rotate(24 21.9 10.4)"/>
    <circle cx="14" cy="15.6" r="9.7" fill="#FFFFFF" stroke="#155445" stroke-width="1.8"/>
    <ellipse cx="8.5" cy="17.5" rx="1.6" ry="1.05" fill="#F0A98C" opacity="0.55"/>
    <ellipse cx="19.5" cy="17.5" rx="1.6" ry="1.05" fill="#F0A98C" opacity="0.55"/>
    <circle cx="10.5" cy="14.4" r="1.7" fill="#262420"/>
    <circle cx="11.05" cy="13.85" r="0.5" fill="#fff"/>
    <circle cx="17.5" cy="14.4" r="1.7" fill="#262420"/>
    <circle cx="18.05" cy="13.85" r="0.5" fill="#fff"/>
    <ellipse cx="14" cy="17.75" rx="1.85" ry="1.3" fill="#155445"/>
    <path d="M14 19.1v0.55M8.9 19.9c1.7 3.3 8.6 3.3 10.2 0" fill="none" stroke="#155445" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

// 렌더 크기 43px가 위 SVG를 그렸을 때 잉크 바운딩박스 37x34px를 만든다는 걸 오프스크린
// 캘리브레이션으로 확인함(offset은 렌더박스 좌상단에서 잉크 좌상단까지 거리).
const ICON_RENDER = 43, ICON_OFFX = 3, ICON_OFFY = 7;

// "ChamTax" Pretendard bold 텍스트: fontSize 18->ink height 13px, 22->16px (선형 보정).
function fontSizeForHeight(h) { return Math.round(18 + (h - 13) / 0.75); }

// 자동 검출이 실패하는 파일(로고와 다른 요소가 같은 y범위에 겹치는 경우 등)에 대한
// 수동 좌표 — 필요할 때만 여기에 추가. {iconBox:{minX,minY,maxX,maxY}, textBox:{...}}
const MANUAL_OVERRIDES = {
  'og-image-hook-basics-ur.png': {
    iconBox: { minX: 490, minY: 142, maxX: 527, maxY: 176 },
    textBox: { minX: 544, minY: 156, maxX: 639, maxY: 171 },
  },
};

async function detectLogoBox(page, b64) {
  return page.evaluate((b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const counts = {};
        const full = ctx.getImageData(0, 0, 1200, 630);
        for (let y = 0; y < 630; y += 17) for (let x = 0; x < 1200; x += 13) {
          const i = (y * 1200 + x) * 4;
          const key = full.data[i] + ',' + full.data[i + 1] + ',' + full.data[i + 2];
          counts[key] = (counts[key] || 0) + 1;
        }
        let bg = [244, 245, 247], maxCount = 0;
        for (const k in counts) if (counts[k] > maxCount) { maxCount = counts[k]; bg = k.split(',').map(Number); }
        function distAt(data, i) { return Math.sqrt((data[i] - bg[0]) ** 2 + (data[i + 1] - bg[1]) ** 2 + (data[i + 2] - bg[2]) ** 2); }

        const maxY = 260;
        const region = ctx.getImageData(0, 0, 1200, maxY);
        const rowHas = new Array(maxY).fill(false);
        for (let y = 0; y < maxY; y++) for (let x = 0; x < 1200; x++) {
          const i = (y * 1200 + x) * 4;
          if (distAt(region.data, i) > 60) { rowHas[y] = true; break; }
        }
        let bands = []; let curStart = null, lastY = null;
        for (let y = 0; y < maxY; y++) {
          if (rowHas[y]) { if (curStart === null) curStart = y; lastY = y; }
          else if (curStart !== null && y - lastY > 8) { bands.push([curStart, lastY]); curStart = null; }
        }
        if (curStart !== null) bands.push([curStart, lastY]);

        function tightBBox(x0, x1, y0, y1) {
          let mnX = 9999, mnY = 9999, mxX = 0, mxY = 0;
          const w = x1 - x0 + 1, h = y1 - y0 + 1;
          const d = ctx.getImageData(x0, y0, w, h);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (distAt(d.data, i) > 60) {
              const ax = x + x0, ay = y + y0;
              if (ax < mnX) mnX = ax; if (ax > mxX) mxX = ax;
              if (ay < mnY) mnY = ay; if (ay > mxY) mxY = ay;
            }
          }
          return { minX: mnX, minY: mnY, maxX: mxX, maxY: mxY };
        }

        for (const [by0, by1] of bands) {
          const hpad = 6;
          const y0s = Math.max(0, by0 - hpad), y1s = Math.min(maxY, by1 + hpad);
          const h = y1s - y0s;
          const rowRegion = ctx.getImageData(0, y0s, 1200, h);
          const colHas = new Array(1200).fill(false);
          for (let x = 0; x < 1200; x++) for (let y = 0; y < h; y++) {
            const i = (y * 1200 + x) * 4;
            if (distAt(rowRegion.data, i) > 60) { colHas[x] = true; break; }
          }
          let subs = []; let cs = null, lx = null;
          for (let x = 0; x < 1200; x++) {
            if (colHas[x]) { if (cs === null) cs = x; lx = x; }
            else if (cs !== null && x - lx > 15) { subs.push([cs, lx]); cs = null; }
          }
          if (cs !== null) subs.push([cs, lx]);
          if (subs.length < 2) continue;
          const tight = subs.map(([x0, x1]) => tightBBox(x0, x1, y0s, y1s));
          for (let i = 0; i < tight.length; i++) {
            const s = tight[i];
            const w = s.maxX - s.minX + 1, h2 = s.maxY - s.minY + 1;
            const aspect = w / h2;
            // 아이콘은 정사각형에 가까운 비율(37x34px 실측) — 이 조건으로 로고를
            // 킥커/헤드라인/카드 텍스트와 구분함.
            if (w >= 28 && w <= 48 && h2 >= 26 && h2 <= 42 && aspect >= 0.8 && aspect <= 1.4) {
              const partner = tight[i + 1];
              if (partner) { resolve({ bg, iconBox: s, textBox: partner }); return; }
            }
          }
        }
        resolve({ bg, error: 'not-found' });
      };
      img.src = 'data:image/png;base64,' + b64;
    });
  }, b64);
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length
    ? args
    : fs.readdirSync(ROOT).filter(f => /^og-image-hook.*\.png$/.test(f));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">`);
  await fontsReadyWithTimeout(page);

  const ok = [], skipped = [];
  for (const f of files) {
    const filePath = path.join(ROOT, f);
    if (!fs.existsSync(filePath)) { skipped.push([f, 'file-not-found']); continue; }
    const b64 = fs.readFileSync(filePath).toString('base64');
    let info = MANUAL_OVERRIDES[f];
    if (!info) {
      const detected = await detectLogoBox(page, b64);
      if (detected.error) { skipped.push([f, detected.error]); continue; }
      info = detected;
    } else {
      info = { bg: [244, 245, 247], ...info };
    }
    const { iconBox, textBox, bg } = info;
    const bgColor = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    const maskX = Math.min(iconBox.minX, textBox.minX) - 10;
    const maskY = Math.min(iconBox.minY, textBox.minY) - 10;
    const maskW = Math.max(iconBox.maxX, textBox.maxX) - maskX + 10;
    const maskH = Math.max(iconBox.maxY, textBox.maxY) - maskY + 10;
    const fontSize = fontSizeForHeight(textBox.maxY - textBox.minY + 1);
    const iconSvg = ICON_SVG.replace(/ICONSIZE/g, ICON_RENDER);

    await page.setContent(`
<!doctype html><html><head>
<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1200px;height:630px;overflow:hidden;}
  .wrap{position:relative;width:1200px;height:630px;}
  .wrap img{position:absolute;top:0;left:0;width:1200px;height:630px;}
  .mask{position:absolute;left:${maskX}px;top:${maskY}px;width:${maskW}px;height:${maskH}px;background:${bgColor};}
  .icon{position:absolute;left:${iconBox.minX - ICON_OFFX}px;top:${iconBox.minY - ICON_OFFY}px;}
  .text{position:absolute;left:${textBox.minX}px;top:${textBox.minY - 3}px;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:700;font-size:${fontSize}px;color:#155445;line-height:1;white-space:nowrap;}
</style>
</head><body>
  <div class="wrap">
    <img src="data:image/png;base64,${b64}">
    <div class="mask"></div>
    <div class="icon">${iconSvg}</div>
    <div class="text">${BRAND_TEXT}</div>
  </div>
</body></html>`);
    await fontsReadyWithTimeout(page);
    await page.waitForTimeout(120);
    await page.screenshot({ path: filePath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    ok.push(f);
  }

  await browser.close();
  console.log(`fixed: ${ok.length}`);
  if (skipped.length) {
    console.log(`skipped (needs manual MANUAL_OVERRIDES entry): ${skipped.length}`);
    skipped.forEach(([f, reason]) => console.log(`  ${f}: ${reason}`));
  }
}

main();
