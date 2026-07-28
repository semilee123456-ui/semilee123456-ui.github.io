// 2026-07-23 실사용 중 발견된 버그 2건의 재발 방지 회귀 테스트.
// 1) nav의 원형 설정 버튼(🌐)이 비교/확률/도움말 pill 3개와 같은 줄에 안 붙고 혼자 다음 줄로
//    떨어져서 어색하게 떠 보이던 문제 (좁은 폭에서 재현됨).
// 2) 금액 슬라이더(로그 스케일)가 단조 증가하는지, 주요 정수 배수(50/100/...2000)가 실제로
//    도달 가능한지 — 로그 스케일 전환 자체가 잘못되면 특정 구간이 통째로 빠지거나 역행할 수 있음.
const { chromium } = require('playwright');
const navWidths = [300, 320, 344, 360, 375, 390, 412, 428];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const issues = [];

  // --- 1) nav 원형 설정 버튼이 pill들과 같은 줄에 있는지 (한국어 기준) ---
  for (const w of navWidths) {
    const page = await browser.newPage({ viewport: { width: w, height: 300 } });
    try {
      await page.goto('http://127.0.0.1:9000/index.html?lang=ko', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(250);
      const info = await page.evaluate(() => {
        const links = document.querySelector('.menu-links');
        const globe = document.querySelector('.settings-toggle');
        if (!links || !globe) return null;
        const a = links.getBoundingClientRect();
        const b = globe.getBoundingClientRect();
        return { sameRow: Math.abs(a.top - b.top) < 6 };
      });
      if (!info) {
        issues.push({ type: 'nav', width: w, problem: '.menu-links 또는 .settings-toggle을 찾을 수 없음' });
      } else if (!info.sameRow) {
        issues.push({ type: 'nav', width: w, problem: '원형 설정 버튼이 nav 버튼들과 다른 줄에 있음' });
      }
    } catch (e) {
      issues.push({ type: 'nav', width: w, problem: String(e) });
    } finally {
      await page.close();
    }
  }

  // --- 2) 슬라이더 로그 스케일 정합성 (단조성 + 주요 배수 도달 가능 여부) ---
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  try {
    await page.goto('http://127.0.0.1:9000/index.html?lang=ko', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(300);

    const sliderCheck = await page.evaluate(() => {
      const slider = document.getElementById('homeAmountSlider');
      if (!slider || typeof getSliderMillions !== 'function') return { ok: false, reason: 'slider 또는 getSliderMillions 없음' };
      const seen = new Set();
      let prev = -1;
      let monotonicBroken = false;
      for (let pos = 0; pos <= 1000; pos++) {
        slider.value = pos;
        const m = getSliderMillions(slider);
        if (m < prev) monotonicBroken = true;
        prev = m;
        seen.add(m);
      }
      const targets = [50, 100, 200, 300, 500, 1000, 1500, 2000];
      const unreachable = targets.filter(t => !seen.has(t));
      return { ok: true, monotonicBroken, unreachable };
    });

    if (!sliderCheck.ok) {
      issues.push({ type: 'slider', problem: sliderCheck.reason });
    } else {
      if (sliderCheck.monotonicBroken) issues.push({ type: 'slider', problem: '포지션 증가에 따라 금액이 역행하는 구간이 있음' });
      if (sliderCheck.unreachable.length) issues.push({ type: 'slider', problem: `도달 불가능한 주요 배수: ${sliderCheck.unreachable.join(', ')}` });
    }

    // 정밀도 체크: 타이핑으로 300을 넣었을 때, 위치를 ±3 흔들어도 300을 유지하는지
    // (넓은 범위를 로그 스케일 없이 선형으로 다뤘을 때 있었던 원래 문제의 핵심 재현 시나리오)
    // 2026-07-28: 홈 화면 금액 입력 탭에 공용 통화 선택기(sharedInputCurrency)가 생기면서
    // 기본 표시 통화가 KRW로 바뀜 — 이 테스트가 검증하려는 불변식(슬라이더 내부 값은 항상
    // 실제 USD 금액에 매핑돼야 함)은 통화와 무관해야 하므로, 명시적으로 USD를 선택한 뒤
    // "타이핑한 숫자 = Million USD"라는 원래 전제로 정밀도를 확인함(라벨/서식 레이어만 바뀌고
    // 슬라이더 자체의 로그 스케일 매핑은 안 바뀌었는지가 이 테스트의 핵심 불변식).
    const precisionCheck = await page.evaluate(() => {
      if (typeof setSharedInputCurrency === 'function') setSharedInputCurrency('USD');
      const input = document.getElementById('homeAmountInput');
      input.value = '300';
      input.dispatchEvent(new Event('input'));
      const slider = document.getElementById('homeAmountSlider');
      const centerPos = Number(slider.value);
      const results = [];
      for (const delta of [-2, -1, 0, 1, 2]) {
        slider.value = centerPos + delta;
        results.push(getSliderMillions(slider));
      }
      return results;
    });
    const allExactly300 = precisionCheck.every(v => v === 300);
    if (!allExactly300) {
      issues.push({ type: 'slider', problem: `300 주변 ±2 포지션에서 값이 흔들림: ${JSON.stringify(precisionCheck)}` });
    }

    // 통화 변환 불변식(2026-07-28 신규): KRW(기본 표시 통화)로 타이핑한 값이 정확한 USD 백만
    // 단위로 환산되는지 — 슬라이더의 로그 스케일 반올림을 거치지 않고 파서 함수를 직접 호출해서
    // 확인(양자화와 무관하게 환산 공식 자체가 맞는지만 순수하게 검증)
    const currencyCheck = await page.evaluate(() => {
      if (typeof setSharedInputCurrency !== 'function' || typeof parseAmountInputToUsdMillions !== 'function') {
        return { ok: false, reason: 'setSharedInputCurrency 또는 parseAmountInputToUsdMillions 없음' };
      }
      setSharedInputCurrency('KRW');
      const usdMillions = parseAmountInputToUsdMillions('1000'); // 1000억원
      const expected = 1000 * 100 / EXCHANGE_RATE; // 억원 → Million USD
      setSharedInputCurrency('USD'); // 다음 테스트에 영향 없게 원복
      return { ok: true, usdMillions, expected };
    });
    if (!currencyCheck.ok) {
      issues.push({ type: 'currency', problem: currencyCheck.reason });
    } else if (Math.abs(currencyCheck.usdMillions - currencyCheck.expected) > 0.01) {
      issues.push({ type: 'currency', problem: `KRW 입력이 USD 백만 단위로 잘못 환산됨: got ${currencyCheck.usdMillions}, expected ${currencyCheck.expected}` });
    }

    // ===== 소액(만원~수천만원 스케일) 회귀 테스트 (2026-07-28 다섯 번째 후속 세션 신규) =====
    // 사용자가 실사용 중 음성으로 "천원"/"백원"/"천만원" 등을 말했을 때 (1) 소수점 4자리 고정
    // 반올림에 걸려 정확히 0으로 사라지던 문제, (2) 슬라이더 로그축 하한(SLIDER_LOG_FLOOR_M)이
    // 1(Million USD)에 고정돼있어서 그보다 작은 값은 전부 같은 왼쪽 끝 위치로 뭉개져 보이던
    // 문제, 두 가지를 고친 것의 회귀 방지 테스트. 한국어("원") 외에 베트남어("đồng")도 같이
    // 확인해서 통화/언어 무관하게 공용 로직(parseSpokenAmountToMillions 등)이 고쳐졌는지 검증함
    // (VOICE_LOCAL_CURRENCY로 18개 이상 언어가 같은 파이프라인을 타므로, 한국어+베트남어 둘 다
    // 통과하면 나머지 언어도 같은 코드 경로라 안전하다고 봄 — 개별 언어별 검증까지는 과함).
    const smallAmountCheck = await page.evaluate(() => {
      if (typeof parseSpokenAmountToMillions !== 'function' || typeof roundToSignificantFigures !== 'function') {
        return { ok: false, reason: 'parseSpokenAmountToMillions 또는 roundToSignificantFigures 없음' };
      }
      const voiceCases = [
        { label: '천원(ko)', transcript: '천원', lang: 'ko', expectedUsdMillions: 1000 / EXCHANGE_RATE / 1000000 },
        { label: '백원(ko)', transcript: '백원', lang: 'ko', expectedUsdMillions: 100 / EXCHANGE_RATE / 1000000 },
        { label: '만원(ko)', transcript: '만원', lang: 'ko', expectedUsdMillions: 10000 / EXCHANGE_RATE / 1000000 },
        { label: '천만원(ko)', transcript: '천만원', lang: 'ko', expectedUsdMillions: 10000000 / EXCHANGE_RATE / 1000000 },
        // 베트남어: koreanWordsToNumber는 한국어 전용이라 안 걸리고, 숫자+통화 키워드
        // 조합(아라비아 숫자로 말한 것처럼 인식된 경우)으로 처리되는 경로를 검증
        { label: '10000000 đồng(vi)', transcript: '10000000 đồng', lang: 'vi', expectedUsdMillions: 10000000 / EXCHANGE_RATE_VND / 1000000 },
      ];
      const voiceResults = voiceCases.map(c => {
        const millions = parseSpokenAmountToMillions(c.transcript, c.lang);
        const rounded = millions === null ? null : Math.min(roundToSignificantFigures(millions, 4), MAX_INPUT_MILLIONS);
        return { label: c.label, millions, rounded, expected: c.expectedUsdMillions };
      });

      // 슬라이더 하한: 작은 값 2개(천만원 규모·훨씬 더 작은 규모)를 각각 넣었을 때, usdMin이
      // 옛 하한(1)에 고정되지 않고 값에 비례해서 서로 다르게 낮아지는지 + 되읽었을 때 같은
      // 자릿수(같은 order of magnitude)로 복원되는지 확인
      const slider = document.getElementById('homeAmountSlider');
      const smallA = 10000000 / EXCHANGE_RATE / 1000000; // 천만원 규모
      const smallB = 300000 / EXCHANGE_RATE / 1000000; // 30만원 규모(smallA보다 한참 작음)
      setSliderMillions(slider, smallA);
      const usdMinA = Number(slider.dataset.usdMin);
      const posA = Number(slider.value);
      const readBackA = getSliderMillions(slider);
      setSliderMillions(slider, smallB);
      const usdMinB = Number(slider.dataset.usdMin);
      const posB = Number(slider.value);
      const readBackB = getSliderMillions(slider);
      // 원복(다음 테스트에 영향 없게 기본 스케일로)
      setSliderMillions(slider, 100);

      return {
        ok: true,
        voiceResults,
        sliderLogFloor: SLIDER_LOG_FLOOR_M,
        smallA, usdMinA, posA, readBackA,
        smallB, usdMinB, posB, readBackB,
      };
    });

    if (!smallAmountCheck.ok) {
      issues.push({ type: 'small-amount', problem: smallAmountCheck.reason });
    } else {
      smallAmountCheck.voiceResults.forEach(r => {
        if (r.rounded === null || r.rounded <= 0) {
          issues.push({ type: 'small-amount-voice', problem: `"${r.label}"이 반올림 후 0 또는 null이 됨(반올림 전 millions=${r.millions})` });
        } else if (r.expected > 0) {
          const relErr = Math.abs(r.rounded - r.expected) / r.expected;
          if (relErr > 0.2) {
            issues.push({ type: 'small-amount-voice', problem: `"${r.label}" 반올림 결과가 기대값과 20% 넘게 차이남: got ${r.rounded}, expected ${r.expected}` });
          }
        }
      });
      // 안전장치(SLIDER_LOG_FLOOR_M) 자체가 옛 값(1)으로 되돌아가지 않았는지
      if (!(smallAmountCheck.sliderLogFloor < 0.0001)) {
        issues.push({ type: 'small-amount-slider', problem: `SLIDER_LOG_FLOOR_M이 다시 커짐(만원~수천만원 스케일을 못 담을 정도): ${smallAmountCheck.sliderLogFloor}` });
      }
      // 옛 버그: 서로 다른 소액이 항상 같은 usdMin(=1)·같은 위치로 뭉개짐 — 지금은 값에 비례해
      // 서로 달라야 함
      if (smallAmountCheck.usdMinA >= 1 || smallAmountCheck.usdMinB >= 1) {
        issues.push({ type: 'small-amount-slider', problem: `소액인데 usdMin이 옛 하한(1)에 고정됨: usdMinA=${smallAmountCheck.usdMinA}, usdMinB=${smallAmountCheck.usdMinB}` });
      }
      if (smallAmountCheck.usdMinA === smallAmountCheck.usdMinB) {
        issues.push({ type: 'small-amount-slider', problem: `서로 다른 소액(${smallAmountCheck.smallA} vs ${smallAmountCheck.smallB})인데 usdMin이 완전히 같음 — 여전히 고정 바닥에 뭉개지는 것으로 보임` });
      }
      if (smallAmountCheck.posA === smallAmountCheck.posB) {
        issues.push({ type: 'small-amount-slider', problem: `서로 다른 소액인데 슬라이더 핸들 위치(slider.value)가 완전히 같음(둘 다 ${smallAmountCheck.posA}) — 옛 "고정 왼쪽 끝" 버그 재발 의심` });
      }
      // 되읽은 값이 원래 자릿수와 같은 크기(0.3~3배 이내)로 복원되는지 — 로그+양자화 반올림
      // 오차는 감안하되, 자릿수가 통째로 달라지거나(0이 되거나) 하면 이슈로 잡음
      [['A', smallAmountCheck.smallA, smallAmountCheck.readBackA], ['B', smallAmountCheck.smallB, smallAmountCheck.readBackB]].forEach(([label, expected, got]) => {
        if (!(got > 0)) {
          issues.push({ type: 'small-amount-slider', problem: `소액 ${label} 되읽기 결과가 0 이하(got ${got}, expected ≈${expected})` });
        } else {
          const ratio = got / expected;
          if (ratio < 0.3 || ratio > 3) {
            issues.push({ type: 'small-amount-slider', problem: `소액 ${label} 되읽기 결과가 원래 값과 자릿수가 다름: got ${got}, expected ≈${expected}` });
          }
        }
      });
    }
  } catch (e) {
    issues.push({ type: 'slider', problem: String(e) });
  } finally {
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(issues, null, 2));
  console.log('ISSUES:', issues.length);
  process.exit(issues.length ? 1 : 0);
})();
