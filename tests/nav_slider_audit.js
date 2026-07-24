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
    const precisionCheck = await page.evaluate(() => {
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
