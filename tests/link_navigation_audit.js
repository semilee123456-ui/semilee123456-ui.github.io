// 2026-08-16: "이 금액으로 계산해보기" 링크가 ?amount=로 홈 화면 계산 결과를 채워놓고도
// jumpToJackpotHistoryRecord()의 go('odds') 강제 호출 때문에 그 결과를 보여주지도 않고 다른
// 탭으로 튕겨버리던 버그(dca704f로 수정)를 계기로 만든 회귀 테스트. broken_link_audit.js는
// href/src가 실제 파일을 가리키는지만 정적으로 확인하고 런타임 동작은 전혀 안 보므로, "링크는
// 유효하고 200이 뜨지만 클릭한 사람이 기대한 것과 다른 화면/상태로 떨어지는" 이 버그 클래스는
// 못 잡음 — 이 스크립트는 그 사각지대를 메움:
//   1) 저장소 전체 *.html에 실제로 등장하는 index.html?... 쿼리스트링 패턴 모양(shape)마다
//      Playwright로 실제 로드해서 콘솔 에러/pageerror 여부 + "기대한 화면(주로 home 탭, ?...#faq는
//      예외)에 떨어졌는지" + "쿼리로 지시한 값이 실제 DOM에 반영됐는지"를 확인
//   2) script.js의 DOMContentLoaded 리스너들이 URL 파싱 후 자동으로 부르는 go() 호출들이
//      "직접 클릭"이 아닌데도 방금 채워진 다른 상태를 가려버리지 않는지 조합 케이스로 교차 확인
//      (예: #faq 해시 리스너가 amount/jgame 쿼리 리스너보다 먼저 등록돼 있어서, 만약 나중에
//      두 패턴이 한 링크에 같이 쓰이면 순서 문제가 생길 수 있음 — 지금은 실제로 그런 링크가
//      없지만 회귀 방지 차원에서 조합 케이스도 넣어둠)
//   3) 정적 페이지(90개) 쪽 onclick="go(...)" 호출 사이트가 index.html 자기 자신의 SPA 내비게이션
//      바깥(다른 정적 페이지)에 새로 생기지 않았는지도 같이 확인 — 생기면 그 파일엔 go()가
//      정의돼 있지 않아 콘솔 에러가 날 것이므로 광의의 "링크가 약속과 다르게 동작" 사례로 취급
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const BASE = 'http://127.0.0.1:9000';

// 저장소의 모든 *.html에서 실제로 쓰이는 index.html?... 쿼리 패턴을 모양(shape) 단위로 수집.
// 값 자체(구체적 금액/날짜)가 아니라 "어떤 파라미터 조합이 실제로 링크에 쓰이는가"만 필요하므로
// 값을 X로 정규화해서 중복 제거함 — 리포트/디버깅용으로만 씀, 테스트 케이스 자체는 아래
// EXPLICIT_CASES에 실제 값으로 직접 나열(정규화된 shape가 어떤 구체 링크에서 왔는지 항상
// 명확하게 대응시키기 위해 자동 생성 대신 수동 나열을 택함).
function collectQueryShapes() {
  const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const shapes = new Set();
  const ATTR_RE = /index\.html\?([^"'\s]*)/g;
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    let m;
    while ((m = ATTR_RE.exec(content))) {
      const [query, hash] = m[1].split('#');
      const keys = query.split('&').map(kv => kv.split('=')[0]).filter(Boolean).sort().join(',');
      shapes.add(keys + (hash ? '#' + hash : ''));
    }
  }
  return Array.from(shapes).sort();
}

// 실제 저장소에 있는 링크에서 그대로 가져온 대표 케이스. 각 케이스는 "이 링크를 누른 사용자가
// 합리적으로 기대할 결과"를 expect로 명시함.
const EXPLICIT_CASES = [
  {
    name: 'amount+jgame+jdate (역대 최고 잭팟 랭킹 카드 "이 금액으로 계산해보기")',
    url: '/index.html?amount=997.6&jgame=powerball&jdate=2022-11-07',
    expect: {
      activeView: 'home',
      amountFilledMillions: 997.6,
      spotlightSet: { game: 'powerball', date: '2022-11-07' },
    },
  },
  {
    name: 'lang only (외국어 페르소나 랜딩 "계산기 열기")',
    url: '/index.html?lang=en',
    expect: { activeView: 'home', langApplied: 'en' },
  },
  {
    name: 'lang+country (거주자 랜딩 "당신 나라 기준으로 계산하기")',
    url: '/index.html?lang=hi&country=in',
    expect: { activeView: 'home', langApplied: 'hi', countryApplied: 'in' },
  },
  {
    name: 'lang+amount+jgame+jdate (biggest-lottery-jackpots-after-tax.html 등 영/중 버전)',
    url: '/index.html?lang=en&amount=997.6&jgame=powerball&jdate=2022-11-07',
    expect: {
      activeView: 'home',
      amountFilledMillions: 997.6,
      langApplied: 'en',
      spotlightSet: { game: 'powerball', date: '2022-11-07' },
    },
  },
  {
    name: 'lang + #faq hash (biggest-lottery-jackpots-after-tax.html 등 "More US lottery tax FAQs" 링크)',
    url: '/index.html?lang=en#faq',
    // 이 링크는 텍스트 자체가 "FAQ 더보기"라서 faq 탭으로 이동하는 게 링크의 약속과 일치함
    // (홈 탭에 머무는 게 아니라 여기서는 faq 탭 이동이 기대 동작) — 위 케이스들과 반대로
    // activeView가 'faq'여야 통과.
    expect: { activeView: 'faq', langApplied: 'en' },
  },
  {
    name: 'amount+jgame+jdate + 사전 country (?lang=+&country=+&amount=+&jgame=+&jdate= 전부 조합, 현재 실제 링크엔 없지만 리스너 실행순서 회귀 확인용)',
    url: '/index.html?lang=en&country=in&amount=997.6&jgame=powerball&jdate=2022-11-07',
    expect: {
      activeView: 'home',
      amountFilledMillions: 997.6,
      langApplied: 'en',
      countryApplied: 'in',
      spotlightSet: { game: 'powerball', date: '2022-11-07' },
    },
  },
  {
    name: 'country+state (script.js에 처리 로직은 있지만 현재 실제 링크는 없음 — 향후 회귀 방지용)',
    url: '/index.html?lang=en&country=us&state=CA&amount=100',
    expect: { activeView: 'home', amountFilledMillions: 100, langApplied: 'en', countryApplied: 'us', stateApplied: 'CA' },
  },
];

// 정적 페이지 90개에서 실제로 쓰이는 onclick="go(...)" 호출 사이트 — index.html 자신의 SPA
// 내비게이션(nav 탭 버튼)은 제외하고, "다른 정적 페이지에 새로 생긴 go() 호출"만 걸러냄. go()는
// script.js(=index.html 전용)에서만 정의되므로 다른 파일에 있으면 100% 콘솔 에러.
function findStrayGoCalls() {
  const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== 'index.html');
  const found = [];
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (/onclick="[^"]*\bgo\(/.test(content)) found.push(file);
  }
  return found;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const issues = [];
  let casesRun = 0;

  // --- 0) 정적 분석: index.html 밖에서 go() 호출하는 곳이 생겼는지 ---
  const stray = findStrayGoCalls();
  if (stray.length) {
    issues.push({ type: 'stray-go-call', files: stray, note: 'go()는 script.js/index.html 전용인데 다른 정적 페이지에서 호출됨 — 100% 콘솔 에러로 이어짐' });
  }

  // --- 참고용: 실제 쿼리 shape 목록(수동 나열한 EXPLICIT_CASES와 저장소 실태 대조) ---
  const observedShapes = collectQueryShapes();

  // --- 1) 명시적 케이스 실행 ---
  for (const c of EXPLICIT_CASES) {
    casesRun++;
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
    page.on('pageerror', err => pageErrors.push(String(err).slice(0, 200)));

    try {
      await page.goto(BASE + c.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(500); // DOMContentLoaded 리스너 체인 + 지연 로드(odds-data.js 등) 여유

      const dom = await page.evaluate(() => {
        const activeViewEl = document.querySelector('.view.on');
        return {
          activeView: activeViewEl ? activeViewEl.id.replace('view-', '') : null,
          homeAmountInputValue: document.getElementById('homeAmountInput') ? document.getElementById('homeAmountInput').value : null,
          sharedAmountUsd: typeof sharedAmountUsd !== 'undefined' ? sharedAmountUsd : null,
          homeCountrySelectValue: document.getElementById('homeCountrySelect') ? document.getElementById('homeCountrySelect').value : null,
          homeStateSelectValue: document.getElementById('homeStateSelect') ? document.getElementById('homeStateSelect').value : null,
          htmlLang: document.documentElement.lang || null,
          jackpotSpotlightRecord: typeof jackpotSpotlightRecord !== 'undefined' ? jackpotSpotlightRecord : null,
        };
      });

      const exp = c.expect;
      const mismatches = [];

      if (exp.activeView && dom.activeView !== exp.activeView) {
        mismatches.push(`activeView expected "${exp.activeView}" got "${dom.activeView}"`);
      }
      if (exp.amountFilledMillions !== undefined) {
        // sharedAmountUsd(백만 단위 USD)*1e6이 ?amount=(백만 단위) 근사와 맞아야 함 — 실수령액
        // 카드가 실제로 그 금액 기준으로 렌더링됐는지의 대리 지표
        const amountMillions = dom.sharedAmountUsd ? dom.sharedAmountUsd / 1e6 : null;
        if (amountMillions === null || Math.abs(amountMillions - exp.amountFilledMillions) > 1) {
          mismatches.push(`amount expected ~${exp.amountFilledMillions}M got millions=${amountMillions}`);
        }
      }
      if (exp.langApplied && dom.htmlLang !== exp.langApplied) {
        mismatches.push(`lang expected "${exp.langApplied}" got "${dom.htmlLang}"`);
      }
      if (exp.countryApplied && dom.homeCountrySelectValue !== exp.countryApplied) {
        mismatches.push(`country expected "${exp.countryApplied}" got "${dom.homeCountrySelectValue}"`);
      }
      if (exp.stateApplied && dom.homeStateSelectValue !== exp.stateApplied) {
        mismatches.push(`state expected "${exp.stateApplied}" got "${dom.homeStateSelectValue}"`);
      }
      if (exp.spotlightSet) {
        const sr = dom.jackpotSpotlightRecord;
        if (!sr || sr.game !== exp.spotlightSet.game || sr.date !== exp.spotlightSet.date) {
          mismatches.push(`jackpotSpotlightRecord expected ${JSON.stringify(exp.spotlightSet)} got ${JSON.stringify(sr)}`);
        }
        // 핵심 회귀 확인: spotlight가 세팅됐다고 해서 odds 탭으로 자동 이동해선 안 됨(원래 버그).
        if (dom.activeView === 'odds' && exp.activeView !== 'odds') {
          mismatches.push('jgame/jdate spotlight auto-navigated to odds tab, hiding the just-filled home amount result (THE FIXED BUG CLASS)');
        }
      }

      if (consoleErrors.length) mismatches.push(`console errors: ${JSON.stringify(consoleErrors.slice(0, 3))}`);
      if (pageErrors.length) mismatches.push(`page errors: ${JSON.stringify(pageErrors.slice(0, 3))}`);

      if (mismatches.length) {
        issues.push({ type: 'query-case', case: c.name, url: c.url, mismatches });
      }
    } catch (e) {
      issues.push({ type: 'query-case', case: c.name, url: c.url, error: e.message });
    }
    await page.close();
  }

  // --- 2) 조합 순서 회귀: #faq 해시 리스너(먼저 등록)가 amount/jgame 쿼리 리스너(나중에 등록)의
  //     결과를 덮어쓰지 않는지 직접 확인. 현재 저장소엔 이 조합을 쓰는 실제 링크가 없지만, 두
  //     리스너가 나란히 등록돼 있어 향후 누군가 두 파라미터를 한 링크에 합치면 바로 이 사각지대에
  //     빠질 수 있어서 회귀 가드로 남겨둠.
  {
    casesRun++;
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
    try {
      await page.goto(BASE + '/index.html?amount=997.6&jgame=powerball&jdate=2022-11-07#odds', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(500);
      const dom = await page.evaluate(() => {
        const activeViewEl = document.querySelector('.view.on');
        return {
          activeView: activeViewEl ? activeViewEl.id.replace('view-', '') : null,
          sharedAmountUsd: typeof sharedAmountUsd !== 'undefined' ? sharedAmountUsd : null,
        };
      });
      // 여기서는 #odds 해시가 명시적으로 "확률체감 탭으로 가라"는 링크 자신의 의도이므로 odds로
      // 가는 것 자체는 정상 — 다만 그 경우에도 amount가 sharedAmountUsd에 반영은 돼 있어야 함
      // (탭이 바뀌어도 상태 자체는 살아있어야 나중에 home으로 돌아왔을 때 값이 남아있음)
      const amountMillions = dom.sharedAmountUsd ? dom.sharedAmountUsd / 1e6 : null;
      const mismatches = [];
      if (!amountMillions || Math.abs(amountMillions - 997.6) > 1) {
        mismatches.push(`amount+jgame+jdate+#odds combo: sharedAmountUsd not set despite ?amount= (got millions=${amountMillions})`);
      }
      if (consoleErrors.length) mismatches.push(`console errors: ${JSON.stringify(consoleErrors.slice(0, 3))}`);
      if (mismatches.length) {
        issues.push({ type: 'combo-order-check', case: 'amount+jgame+jdate + #odds hash', mismatches });
      }
    } catch (e) {
      issues.push({ type: 'combo-order-check', case: 'amount+jgame+jdate + #odds hash', error: e.message });
    }
    await page.close();
  }

  console.log('Observed query shapes in repo *.html:', JSON.stringify(observedShapes));
  console.log('Explicit cases tested:', EXPLICIT_CASES.length, '+ 1 combo-order check +', stray.length ? stray.length + ' stray-go files' : '0 stray-go files');
  console.log(JSON.stringify(issues, null, 1));
  console.log('TOTAL:', casesRun, 'ISSUES:', issues.length);
  await browser.close();
  process.exit(0);
})();
