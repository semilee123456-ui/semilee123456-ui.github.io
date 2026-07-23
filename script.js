// ============================================================
// 세금 모델 정의 (단일 기준 — 여기만 고치면 전체 계산기에 반영됨)
// 출처: IRS Instructions for Forms W-2G (2026), Park v. Commissioner 136 T.C. 569 (2011),
//       IRS-Korea Tax Treaty (irs.gov/pub/irs-trty/korea.pdf)
// ============================================================
// 환율 (전역 단일 기준 — 실제 서비스에서는 매일 자동 갱신 필요)
// ============================================================
// 언어 전환 (Phase 1 — 홈 화면 핵심 UI만 영어 지원. 국가비교/확률체감/FAQ는 아직 한국어만 제공)
// ============================================================
// ⚠️ [향후 다국어 확장 시 필독] currentLang은 'ko'|'en' 이진값이고, 아래 I18N 사전도
// 항목당 en 필드 하나만 가짐. 코드 곳곳(약 17곳)에 `currentLang === 'en' ? A : B` 삼항연산이
// 흩어져 있어서, 베트남어·태국어 등을 추가하려면:
//   1) currentLang을 언어 코드로, 토글 버튼을 선택 UI로 변경
//   2) I18N 사전 항목을 { en:'', vi:'', th:'' } 형태로 확장
//   3) 흩어진 `currentLang === 'en' ? A : B` 삼항연산을 전부 사전 조회 방식으로 교체
//   4) 무엇보다, 150개 넘는 문구의 실제 번역 작업이 코드 작업보다 훨씬 큼
// 실제 언어가 확정되기 전엔 구조를 미리 넓히지 않기로 결정함 (2026년 7월) — 근거 없이
// 짐작한 구조가 실제 필요와 안 맞을 위험이 구조를 안 짜두는 비용보다 크다고 판단.
let currentLang = 'ko';
let resultBarAnimatedIn = false; // 홈 실수령/세금 비율 막대가 최초 1회만 0%→목표값 애니메이션되도록 하는 플래그
// 언어 코드 -> Intl 로케일 문자열(숫자 포맷 toLocaleString 등에 공용으로 씀)
const LOCALE_MAP = {
  ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', vi: 'vi-VN', th: 'th-TH', ru: 'ru-RU',
  ar: 'ar-SA', bn: 'bn-BD', km: 'km-KH', hi: 'hi-IN', id: 'id-ID', ja: 'ja-JP',
  kk: 'kk-KZ', ky: 'ky-KG', lo: 'lo-LA', mn: 'mn-MN', my: 'my-MM', ne: 'ne-NP',
  si: 'si-LK', ur: 'ur-PK', uz: 'uz-UZ', fr: 'fr-FR', tl: 'fil-PH',
};
// EPS(고용허가제) 체류자 규모 우선순위대로 정리 — 인구 큰 순서대로 완역해나가는 기준
const ADDITIONAL_LANGS = ['km','ne','id','my','si','uz','mn','kk','ky','ur','bn','lo','ja','ar','hi','fr','tl'];

// I18N 번역 데이터는 언어별 JSON 파일(i18n/<lang>.json)로 분리되어 있고, 실제 화면에 필요한
// 언어 하나만 지연 로드됨 (2026년 7월 리팩터 — 이전엔 22개 언어(약 1.1MB) 전체를 모든 방문자에게
// 무조건 보냈음. 각 JSON은 추출 시점에 폴백까지 미리 반영된 완성 맵이라 런타임에 영어 폴백을
// 따로 조회할 필요 없음 — 없는 키는 그 언어 JSON 생성 단계에서 이미 영어값으로 채워져 있음)
const I18N_CACHE = {}; // { langCode: { key: translatedString } }
let I18N_LOAD_PROMISE = null;

function loadI18nLanguage(lang){
  if (lang === "ko" || I18N_CACHE[lang]) return Promise.resolve();
  return fetch(`i18n/${lang}.json?v=20260721`)
    .then(res => { if (!res.ok) throw new Error("i18n fetch failed: " + res.status); return res.json(); })
    .then(data => { I18N_CACHE[lang] = data; })
    .catch(err => { console.error("[i18n] failed to load", lang, err); });
}

// 언어 드롭다운 선택(onchange) 및 ?lang= URL 파라미터에서 공통으로 사용.
// zh는 1단계(핵심 화면)만 번역돼 있고, 아직 번역 안 된 항목은 resolveI18n()이 undefined를
// 반환해 자동으로 한국어로 폴백됨(2단계에서 항목을 채우면 그대로 반영됨).
// isManual=true는 사용자가 직접 드롭다운 등으로 언어를 골랐다는 뜻 — 이 경우에만 localStorage에
// 저장해서 다음 방문 때도 그 언어를 기억함. 자동 감지(브라우저 언어 기반)로 켜진 언어는 저장하지
// 않아서, 같은 기기를 다른 사람이 다른 언어로 쓰더라도 매번 각자의 브라우저 언어로 새로 감지됨
function setLanguage(lang, isManual){
  if (currentLang === lang) {
    if (isManual) { try { localStorage.setItem('chamtax_lang', lang); } catch (e) {} }
    return;
  }
  currentLang = lang;
  if (isManual) { try { localStorage.setItem('chamtax_lang', lang); } catch (e) {} }
  // 번역 JSON을 불러오는 동안에는 화면이 기존 언어(보통 한국어 기본 텍스트) 그대로 보이다가,
  // 로드가 끝나면 applyTranslations()가 다시 실행되며 새 언어로 바뀜 — 언어 전환 버튼은
  // onclick="setLanguage(...)"처럼 이 Promise를 기다리지 않고 바로 다음 동작(예: 화면 이동)으로
  // 넘어가도 되게 설계되어 있음 (번역 텍스트와 무관한 동작이라 순서 문제 없음)
  loadI18nLanguage(lang).then(() => {
    if (currentLang === lang) applyTranslations();
  });
}

// 방문자의 브라우저/OS 설정 언어(navigator.language)를 기준으로 우리가 지원하는 언어 중
// 가장 먼저 일치하는 걸 찾음 — IP 기반 위치 조회(외부 API 필요, 지역 차단·정확도 이슈 있음) 대신
// 이 방식을 쓰는 이유: 별도 API 호출 없이 항상 즉시 동작하고, 실제로 "그 나라에 있는지"보다
// "그 나라 언어를 쓰는지"가 이 사이트(언어별 세금 정보)에는 더 정확한 신호이기 때문
function detectBrowserLanguage(){
  const candidates = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || navigator.userLanguage || ''];
  const supported = ['ko', 'en', 'zh', 'vi', 'th', 'ru', ...ADDITIONAL_LANGS];
  for (const tag of candidates) {
    const primary = (tag || '').toLowerCase().split('-')[0];
    if (supported.includes(primary)) return primary;
  }
  return null;
}

// 한국어는 I18N_CACHE에 아예 들어있지 않음 (HTML의 기본 텍스트 자체가 한국어라 번역이 필요 없음).
// 그 외 언어는 i18n/<lang>.json이 로드되기 전이면 아직 undefined를 반환하고, 그동안 화면은
// 한국어 기본 텍스트를 그대로 보여줌 — 로드가 끝나면 applyTranslations()가 다시 돌며 갱신됨.
// 폴백(해당 언어에 없는 문구는 영어로)은 i18n/<lang>.json 생성 시점에 이미 반영되어 있으므로
// 여기서는 currentLang 하나만 조회하면 됨.
function resolveI18n(key){
  if (currentLang === 'ko') return undefined;
  const loaded = I18N_CACHE[currentLang];
  return loaded ? loaded[key] : undefined;
}

const RTL_LANGS = ['ar', 'ur']; // 아랍어·우르두어는 오른쪽에서 왼쪽으로 읽는 언어

function applyTranslations(){
  const toggleBtn = document.getElementById('lang-toggle');
  document.documentElement.lang = currentLang;
  document.documentElement.dir = RTL_LANGS.includes(currentLang) ? 'rtl' : 'ltr';
  if (toggleBtn) toggleBtn.value = currentLang;

  const activeView = document.querySelector('.view.on');
  if (activeView) applyCurrentViewTitle(activeView.id.replace('view-', ''));

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = resolveI18n(key) || el.getAttribute('data-i18n-ko') || el.textContent;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const translated = resolveI18n(key);
    if (translated) {
      if (!el.getAttribute('data-i18n-ko-html')) el.setAttribute('data-i18n-ko-html', el.innerHTML);
      el.innerHTML = translated;
    } else {
      const ko = el.getAttribute('data-i18n-ko-html');
      if (ko) el.innerHTML = ko;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!el.getAttribute('data-i18n-ko-placeholder')) el.setAttribute('data-i18n-ko-placeholder', el.placeholder);
    el.placeholder = resolveI18n(key) || el.getAttribute('data-i18n-ko-placeholder');
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (!el.getAttribute('data-i18n-ko-aria-label')) el.setAttribute('data-i18n-ko-aria-label', el.getAttribute('aria-label'));
    el.setAttribute('aria-label', resolveI18n(key) || el.getAttribute('data-i18n-ko-aria-label'));
  });

  // 역대 잭팟 TOP5 링크는 영문 모드일 때 별도로 만들어둔 영어 페이지로 이어지게 함
  // (텍스트만 번역되고 href는 그대로 한국어 페이지를 가리키던 문제 수정)
  const jackpotFullLink = document.getElementById('jackpot-history-full-link');
  if (jackpotFullLink) {
    // vi/th/ru 전용 잭팟 페이지는 없어서 영어 페이지로 폴백(한국어보다 국제 방문자에게 더 유용)
    jackpotFullLink.href = (currentLang === 'ko') ? 'biggest-jackpot-payouts.html'
      : (currentLang === 'zh') ? 'biggest_lottery_jackpots_after_tax_zh.html'
      : 'biggest-lottery-jackpots-after-tax.html';
  }

  // "해외 거주 한국인" 배너 링크도 같은 이유로 언어별 페이지로 이어지게 함 — 이게 없으면
  // 영어 페이지 하나로 고정되어 있어서 한국어·중국어로 보던 사람이 링크를 누르면 갑자기
  // 전부 영어로 된 페이지로 넘어가버리는 문제가 있었음
  const introAbroadLink = document.getElementById('introAbroadLink');
  if (introAbroadLink) {
    // vi/th/ru 전용 페이지는 없어서 영어 페이지로 폴백(한국어보다 국제 방문자에게 더 유용)
    introAbroadLink.href = (currentLang === 'ko') ? 'korean_abroad_us_lottery_tax_ko.html'
      : (currentLang === 'zh') ? 'korean_abroad_us_lottery_tax_zh.html'
      : 'korean-abroad-us-lottery-tax.html';
  }

  // 언어 전환 시 환율 배지의 상태 문구(title)도 항상 다시 반영 (실패/성공/기본 상태와 무관하게 현재 언어로)
  updateExchangeRateBadges(exchangeRateFetchFailed);

  // 언어 전환 시 동적으로 생성되는 텍스트(CTA 버튼, 잭팟 패널, 추첨 카운트다운 등)도 다시 계산해서 갱신.
  // 홈 화면이 켜져 있을 때만 갱신하면, 확률체감 페이지의 잭팟 카드(#jackpot-card-amt 등 — 홈과 ID를
  // 공유함)가 언어 전환 시 갱신되지 않고 예전 언어로 남아있다가, 나중에 환율 자동갱신 등 무관한
  // 이벤트가 발생할 때에야 그 시점의 언어로 갑자기 바뀌어 "언어가 왔다갔다 하는" 것처럼 보이는
  // 버그가 있었음 — 뷰와 무관하게 항상 갱신해서 어느 화면에 있든 즉시 반영되게 함
  updateHomeCalc();
  updateCalc(); // 국가별 비교 화면(나라별 카드·다른 언어로 보기 패널)도 같은 이유로 뷰와 무관하게 항상 갱신 —
                // 이게 빠져있어서 "비교 화면에 머문 채로 언어를 바꾸면 카드는 그대로 예전 언어로 남는" 버그가 있었음
  updateFaqTg2Card(); // FAQ "세금 가이드" 요약 카드도 언어만 바뀌는 경우까지 커버(기준 변경 시엔 filterFaq()에서 이미 호출됨)
  renderFilingDday(); // D-day 문구도 pickLang() 기반이라 언어 전환 시 다시 그려야 함
  applyJackpotData();
  updateDrawCountdown();
  initJackpotCardAmt();
  refreshJackpotDrawerIfOpen();
  updateJcTapLabel();
  updateHiddenMoneyChannelsForLang();
  renderJackpotHistory();
  renderJackpotTakeHomeRanking();
  updateDateLookupUi();
  renderLatestDraw();
  renderPrizeTiers();
  updateLightningGameUi();
  updateMyNumbersUi();
  renderNumberFrequencyStats();
}

// 최초 로드 시, data-i18n 요소들의 원본 한국어를 저장해둠(다시 한국어로 돌아갈 때 쓰기 위함)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.setAttribute('data-i18n-ko', el.textContent);
  });
});

// 다크모드는 기기 설정을 자동으로 따라가지 않고, 이 토글로만 켜고 끔 — 기본은 항상 라이트모드.
// 실제 적용(FOUC 방지)은 head 맨 위 동기 스크립트가 이미 처리했고, 여기선 버튼 아이콘만 그 상태에 맞춤
function syncThemeToggleIcon(){
  const btn = document.getElementById('theme-toggle');
  const iconEl = btn && btn.querySelector('.settings-row-icon');
  const icon = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
  if (iconEl) iconEl.textContent = icon; else if (btn) btn.textContent = icon;
}
function toggleTheme(){
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) { document.documentElement.removeAttribute('data-theme'); try{ localStorage.setItem('theme','light'); }catch(e){} }
  else { document.documentElement.setAttribute('data-theme','dark'); try{ localStorage.setItem('theme','dark'); }catch(e){} }
  syncThemeToggleIcon();
}
document.addEventListener('DOMContentLoaded', syncThemeToggleIcon);

// 글자 크게 보기: 다크모드와 완전히 동일한 구조(opt-in, localStorage 저장, FOUC 방지는 head 스크립트가 처리,
// 여기선 버튼 아이콘만 상태에 맞춤) — 다크모드/고대비 모드와 독립적으로 동시에 켤 수 있음
function syncTextSizeToggleIcon(){
  const btn = document.getElementById('textsize-toggle');
  const iconEl = btn && btn.querySelector('.settings-row-icon');
  const icon = document.documentElement.getAttribute('data-textsize') === 'large' ? '가-' : '가+';
  if (iconEl) iconEl.textContent = icon; else if (btn) btn.textContent = icon;
}
function toggleTextSize(){
  const isLarge = document.documentElement.getAttribute('data-textsize') === 'large';
  if (isLarge) { document.documentElement.removeAttribute('data-textsize'); try{ localStorage.setItem('textSize','normal'); }catch(e){} }
  else { document.documentElement.setAttribute('data-textsize','large'); try{ localStorage.setItem('textSize','large'); }catch(e){} }
  syncTextSizeToggleIcon();
}
document.addEventListener('DOMContentLoaded', syncTextSizeToggleIcon);

// 고대비 모드: 라이트/다크 테마 위에 독립적으로 얹히는 토글(제3의 테마가 아님) — 구조는 위 두 토글과 동일
function syncContrastToggleIcon(){
  const btn = document.getElementById('contrast-toggle');
  const iconEl = btn && btn.querySelector('.settings-row-icon');
  const icon = document.documentElement.getAttribute('data-contrast') === 'high' ? '●' : '◐';
  if (iconEl) iconEl.textContent = icon; else if (btn) btn.textContent = icon;
}
function toggleContrast(){
  const isHigh = document.documentElement.getAttribute('data-contrast') === 'high';
  if (isHigh) { document.documentElement.removeAttribute('data-contrast'); try{ localStorage.setItem('contrast','normal'); }catch(e){} }
  else { document.documentElement.setAttribute('data-contrast','high'); try{ localStorage.setItem('contrast','high'); }catch(e){} }
  syncContrastToggleIcon();
}
document.addEventListener('DOMContentLoaded', syncContrastToggleIcon);

// 설정 패널(details)은 네이티브 열림/닫힘은 공짜로 되지만, 바깥을 눌러도 안 닫히는 건
// 기본 동작이 아니라서 직접 처리 — 패널 안쪽 클릭(언어 선택 등)은 그대로 두고 바깥 클릭만 닫음
document.addEventListener('click', (e) => {
  const menu = document.getElementById('settingsMenu');
  if (menu && menu.open && !menu.contains(e.target)) menu.open = false;
});

let EXCHANGE_RATE = 1487.73; // 기본값(fallback). 중앙은행 고시 기반 기준환율(2026-07-17 확인 — 한국은행 기준금리 인상으로 원화 강세 반영) — 페이지 로드 시 실시간 환율로 자동 갱신을 시도함. 이 기본값은 주기적으로 수동 업데이트 필요
let EXCHANGE_RATE_CNY = 6.77; // 기본값(fallback), USD/CNY (2026-07-17 확인). 중국 거주자 기준 결과에서 위안화 참고 환산용 — KRW와 마찬가지로 실시간 조회 시도, 실패하면 이 기본값 사용
let EXCHANGE_RATE_INR = 87.0; // 기본값(fallback), USD/INR (2026-07-18 확인). 인도 거주자 기준 결과에서 루피 참고 환산용 — KRW와 마찬가지로 실시간 조회 시도, 실패하면 이 기본값 사용
let EXCHANGE_RATE_VND = 26150; // 기본값(fallback), USD/VND (2026-07-18 확인). 베트남 거주자 기준 결과에서 동화 참고 환산용
let EXCHANGE_RATE_IDR = 16650; // 기본값(fallback), USD/IDR (2026-07-18 확인). 인도네시아 거주자 기준 결과에서 루피아 참고 환산용
let EXCHANGE_RATE_PHP = 58.7;  // 기본값(fallback), USD/PHP (2026-07-18 확인). 필리핀 거주자 기준 결과에서 페소 참고 환산용
let EXCHANGE_RATE_THB = 34.2;  // 기본값(fallback), USD/THB (2026-07-18 확인). 태국 거주자 기준 결과에서 바트 참고 환산용
let EXCHANGE_RATE_JPY = 162;    // 기본값(fallback), USD/JPY (2026-07-18 확인)
let EXCHANGE_RATE_RUB = 78.51;  // 기본값(fallback), USD/RUB (2026-07-19 확인) — 변동성이 커서 실시간 조회 실패 시 오차가 클 수 있음
let EXCHANGE_RATE_NPR = 152.7;  // 기본값(fallback), USD/NPR (2026-07-18 확인)
let EXCHANGE_RATE_LKR = 336;    // 기본값(fallback), USD/LKR (2026-07-18 확인)
let EXCHANGE_RATE_UZS = 12050;  // 기본값(fallback), USD/UZS (2026-07-18 확인)
let EXCHANGE_RATE_KZT = 525;    // 기본값(fallback), USD/KZT (2026-07-18 확인)
let EXCHANGE_RATE_KGS = 87;     // 기본값(fallback), USD/KGS (2026-07-18 확인)
let EXCHANGE_RATE_MMK = 2094;   // 기본값(fallback), USD/MMK 공식 환율(2026-07-18 확인) — 실제 시중 환율은 이보다 훨씬 높을 수 있음(외환 통제)
let EXCHANGE_RATE_BDT = 123;    // 기본값(fallback), USD/BDT (2026-07-18 확인)
let EXCHANGE_RATE_PKR = 278;    // 기본값(fallback), USD/PKR (2026-07-18 확인)
let EXCHANGE_RATE_KHR = 4020;   // 기본값(fallback), USD/KHR (2026-07-18 확인)
let EXCHANGE_RATE_MNT = 3590;   // 기본값(fallback), USD/MNT (2026-07-18 확인)
let EXCHANGE_RATE_LAK = 22600;  // 기본값(fallback), USD/LAK (2026-07-18 확인)

// 환율 입력창(표시값)을 실제 계산에 쓰이는 EXCHANGE_RATE와 강제로 맞춰줌.
// 이게 없으면 HTML에 하드코딩된 옛 기본값이 입력창에 남아있는 채로, 실제 계산은
// EXCHANGE_RATE(새 기본값/실시간값)로 되어 "표시 환율"과 "실제 계산 환율"이 어긋나는 문제가 생김
function syncRateInputsDisplay(){
  const homeInput = document.getElementById('home-rate-input');
  const compareInput = document.getElementById('compare-rate-input');
  if (homeInput && document.activeElement !== homeInput) homeInput.value = EXCHANGE_RATE.toLocaleString('ko-KR');
  if (compareInput && document.activeElement !== compareInput) compareInput.value = EXCHANGE_RATE.toLocaleString('ko-KR');
}
let exchangeRateSourceName = null; // 실시간 조회에 성공했을 때, 어느 제공처에서 가져온 값인지 화면에 표시하기 위해 저장
let exchangeRateIsLive = false; // 실시간 fetch 성공 여부 표시용
let exchangeRateFetchFailed = false; // 실시간 fetch를 "시도했지만 실패"했는지 여부 — 이걸 알아야 "기본값을 아직 안 써봤음"과 "가져오려다 실패해서 기본값 씀"을 구분해서 보여줄 수 있음
let isRateManuallyEdited = false; // 유저가 환율을 직접 수정했는지 여부 — true면 비동기 fetch가 뒤늦게 와도 덮어쓰지 않음

// fetch에 타임아웃을 걸어주는 헬퍼 — 해외(느린 회선/일부 API 접속 제한 지역)에서
// 요청이 응답 없이 무한 대기하는 것을 막고, 정해진 시간 안에 실패 처리로 넘어가게 함
function fetchWithTimeout(url, ms){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// 환율 API 후보 목록 — 중앙은행 고시 기반 기준환율(재현성·출처가 명확함)을 우선으로 하고,
// 막히거나(지역 차단) 타임아웃 나면 순서대로 다음 걸 시도. 응답 형식이 달라서 각자 getRate로 KRW/CNY/INR 환율을 뽑아냄
// (두 API 모두 한 번의 응답에 여러 통화 환율을 같이 내려주므로, 별도 API 호출 없이 CNY·INR도 같이 얻을 수 있음)
// KRW 외 참고 환산용 통화가 3개(CNY/INR/VND)에서 19개로 늘어나면서, 소스마다 getRateXxx를 하나하나
// 나열하던 방식은 더 이상 안 맞음 — 통화코드 하나로 공용 getRate(data, code)를 쓰고, 실제로
// module-level EXCHANGE_RATE_XXX 변수에 반영하는 건 아래 CURRENCY_RATE_CONFIG가 담당함
const CURRENCY_RATE_CONFIG = [
  { code: 'CNY', apply: (v) => { EXCHANGE_RATE_CNY = Math.round(v * 10000) / 10000; } }, // 보통 6.xx대라 소수점 넷째자리까지
  { code: 'INR', apply: (v) => { EXCHANGE_RATE_INR = Math.round(v * 100) / 100; } },
  { code: 'VND', apply: (v) => { EXCHANGE_RATE_VND = Math.round(v); } }, // 자릿수가 커서(만 단위) 소수점 없이 정수로
  { code: 'IDR', apply: (v) => { EXCHANGE_RATE_IDR = Math.round(v); } },
  { code: 'PHP', apply: (v) => { EXCHANGE_RATE_PHP = Math.round(v * 100) / 100; } },
  { code: 'THB', apply: (v) => { EXCHANGE_RATE_THB = Math.round(v * 100) / 100; } },
  { code: 'JPY', apply: (v) => { EXCHANGE_RATE_JPY = Math.round(v * 100) / 100; } },
  { code: 'RUB', apply: (v) => { EXCHANGE_RATE_RUB = Math.round(v * 100) / 100; } },
  { code: 'NPR', apply: (v) => { EXCHANGE_RATE_NPR = Math.round(v * 100) / 100; } },
  { code: 'LKR', apply: (v) => { EXCHANGE_RATE_LKR = Math.round(v * 100) / 100; } },
  { code: 'UZS', apply: (v) => { EXCHANGE_RATE_UZS = Math.round(v); } },
  { code: 'KZT', apply: (v) => { EXCHANGE_RATE_KZT = Math.round(v * 100) / 100; } },
  { code: 'KGS', apply: (v) => { EXCHANGE_RATE_KGS = Math.round(v * 100) / 100; } },
  { code: 'MMK', apply: (v) => { EXCHANGE_RATE_MMK = Math.round(v); } },
  { code: 'BDT', apply: (v) => { EXCHANGE_RATE_BDT = Math.round(v * 100) / 100; } },
  { code: 'PKR', apply: (v) => { EXCHANGE_RATE_PKR = Math.round(v * 100) / 100; } },
  { code: 'KHR', apply: (v) => { EXCHANGE_RATE_KHR = Math.round(v); } },
  { code: 'MNT', apply: (v) => { EXCHANGE_RATE_MNT = Math.round(v); } },
  { code: 'LAK', apply: (v) => { EXCHANGE_RATE_LAK = Math.round(v); } },
];
const EXCHANGE_RATE_ALL_CODES = ['KRW', ...CURRENCY_RATE_CONFIG.map(c => c.code)];
const EXCHANGE_RATE_SOURCES = [
  { url: 'https://api.frankfurter.app/latest?from=USD&to=' + EXCHANGE_RATE_ALL_CODES.join(','), getRate: (data, code) => data && data.rates && data.rates[code], name: 'Frankfurter (중앙은행 기준환율)', nameEn: 'Frankfurter (central bank reference rate)' },
  { url: 'https://open.er-api.com/v6/latest/USD', getRate: (data, code) => data && data.rates && data.rates[code], name: 'open.er-api.com', nameEn: 'open.er-api.com' },
];

async function fetchLiveExchangeRate(force){
  // force=true: 유저가 배지를 직접 클릭해서 재시도하는 경우 — 수동 편집 상태였어도 우선권을 줌
  if (isRateManuallyEdited && !force) return;

  for (const source of EXCHANGE_RATE_SOURCES) {
    try {
      const res = await fetchWithTimeout(source.url, 6000); // 6초 안에 응답 없으면 다음 소스로 넘어감
      const data = await res.json();
      const rate = source.getRate(data, 'KRW');
      if (rate) {
        // fetch가 진행되는 동안(최대 약 12초, 소스 2개 × 6초 타임아웃) 사용자가 환율을 직접
        // 수정했을 수 있음 — 맨 위의 isRateManuallyEdited 체크는 fetch 시작 "전"에 한 번만
        // 확인하므로, 진행 중에 수정된 경우를 못 잡아서 사용자 입력이 뒤늦게 덮어써지는
        // 레이스 컨디션이 있었음. await 이후 여기서 한 번 더 확인해서 방지함
        if (isRateManuallyEdited && !force) return false;
        EXCHANGE_RATE = Math.round(rate * 100) / 100; // 소수점 둘째자리까지 유지 (기준환율은 보통 소수점 단위로 고시됨)
        // KRW 외 19개 참고 통화는 CURRENCY_RATE_CONFIG를 돌면서 한 번에 반영 — 응답에 없는 통화(소스에 따라
        // 커버리지가 다름)는 조용히 건너뛰고 기존 기본값을 그대로 유지함
        for (const cfg of CURRENCY_RATE_CONFIG) {
          const v = source.getRate(data, cfg.code);
          if (v) cfg.apply(v);
        }
        exchangeRateSourceName = source;
        exchangeRateIsLive = true;
        exchangeRateFetchFailed = false;
        isRateManuallyEdited = false; // 실시간 값으로 갱신됐으니 수동 편집 플래그 해제

        // 현재 화면에 켜져있는(active) 뷰의 입력값을 원본(source of truth)으로 삼아 동기화.
        // 잘못하면 방문한 적 없는 다른 탭의 기본값(100M)이 공유 상태를 덮어써버리는 레이스 컨디션이 생김.
        const homeIsOn = document.getElementById('view-home').classList.contains('on');
        const compareIsOn = document.getElementById('view-compare').classList.contains('on');
        if (homeIsOn) {
          syncHomeFromShared();
        } else if (compareIsOn) {
          syncCompareFromShared();
        } else {
          // 홈/비교 화면 둘 다 안 보고 있을 때는 화면 갱신 없이 계산 로직만 공유 데이터 기준으로 조용히 갱신
          updateHomeCalc(sharedAmountUsd);
          updateCalc(sharedAmountUsd);
        }
        initJackpotCardAmt();
        refreshJackpotDrawerIfOpen();
        updateExchangeRateBadges();
        return true;
      }
    } catch (e) {
      // 이 소스가 타임아웃/네트워크 오류/지역 차단이면 다음 소스로 계속 시도
    }
  }
  // 모든 소스가 실패한 경우 — 기본값(EXCHANGE_RATE 초기값) 그대로 사용, 계산 자체는 문제없이 계속 작동함
  exchangeRateFetchFailed = true;
  updateExchangeRateBadges(true);
  syncRateInputsDisplay(); // 입력창 표시값을 실제 계산에 쓰인 기본 환율(EXCHANGE_RATE)로 맞춰줌
  if (document.getElementById('view-home').classList.contains('on')) updateHomeCalc();
  return false;
}

// 유저가 환율 배지(아이콘 버튼)를 직접 눌렀을 때 — 그 자리에서 바로 재시도
// 모바일에서는 title(툴팁)이 마우스 오버가 없어서 절대 안 보이므로, 상태 안내는 배지의
// 반짝임 애니메이션으로 전달함 — 재시도가 다시 실패해도 "탭이 씹혔나?" 싶지 않도록, 매번 눈에 띄는 반응을 줌
async function retryLiveExchangeRate(btn){
  const buttons = document.querySelectorAll('.rate-live-badge');
  buttons.forEach(b => {
    b.disabled = true; b.classList.remove('is-live','is-fail','just-retried');
    b.innerHTML = '<span class="spin" aria-hidden="true">🔄</span>';
    b.title = pickLang('환율 확인 중...', 'Checking exchange rate...', '正在查询汇率...', 'Đang kiểm tra tỷ giá...', 'กำลังตรวจสอบอัตราแลกเปลี่ยน...', 'Проверка курса...', {
      km: 'កំពុងពិនិត្យអត្រាប្តូរប្រាក់...', ne: 'विनिमय दर जाँच गर्दै...', id: 'Memeriksa nilai tukar...', my: 'ငွေလဲနှုန်းစစ်ဆေးနေသည်...', si: 'විනිමය අනුපාතය පරීක්ෂා කරමින්...',
      uz: 'Valyuta kursi tekshirilmoqda...', mn: 'Валютын ханшийг шалгаж байна...', kk: 'Валюта бағамы тексерілуде...', ky: 'Валюта курсу текшерилүүдө...', ur: 'زر مبادلہ چیک ہو رہا ہے...',
      bn: 'বিনিময় হার যাচাই করা হচ্ছে...', lo: 'ກຳລັງກວດສອບອັດຕາແລກປ່ຽນ...', ja: '為替レートを確認中...', ar: 'جارٍ التحقق من سعر الصرف...', hi: 'विनिमय दर जाँची जा रही है...', fr: 'Vérification du taux de change...',
      tl: 'Sinusuri ang exchange rate...',
    });
  });
  const minSpinTime = new Promise(resolve => setTimeout(resolve, 500)); // 너무 빨리 끝나면 눌렀는지도 모르게 지나가버려서, 최소 0.5초는 스피너가 보이게 함
  const [ok] = await Promise.all([fetchLiveExchangeRate(true), minSpinTime]);
  if (!ok) updateExchangeRateBadges(true);
  // 성공 시에는 fetchLiveExchangeRate 안에서 updateExchangeRateBadges()가 이미 갱신함

  // 결과가 이전과 같아 보여도(예: 재시도했는데 또 실패) "지금 막 반응했다"는 걸 눈으로 확인할 수 있게 배지를 잠깐 반짝임
  buttons.forEach(b => {
    b.classList.add('just-retried');
    setTimeout(() => b.classList.remove('just-retried'), 450);
  });
}

function updateExchangeRateBadges(failed){
  document.querySelectorAll('.rate-live-badge').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-live','is-fail');
    el.innerHTML = '<span aria-hidden="true">🔄</span>';
    if (failed) {
      el.classList.add('is-fail');
      el.title = pickLang('환율 조회 실패 · 탭해서 재시도', 'Couldn\u2019t fetch live rate · tap to retry', '汇率获取失败 · 点击重试', 'Không lấy được tỷ giá · nhấn để thử lại', 'ดึงอัตราแลกเปลี่ยนไม่สำเร็จ · แตะเพื่อลองใหม่', 'Не удалось получить курс · нажмите, чтобы повторить', {
        km: 'ទាញអត្រាប្តូរប្រាក់មិនបានទេ · ចុចដើម្បីព្យាយាមម្ដងទៀត', ne: 'लाइभ दर ल्याउन सकिएन · पुनः प्रयासको लागि ट्याप गर्नुहोस्', id: 'Gagal mengambil nilai tukar langsung · ketuk untuk coba lagi', my: 'တိုက်ရိုက်နှုန်းရယူ၍မရပါ · ထပ်ကြိုးစားရန်နှိပ်ပါ', si: 'සජීවී අනුපාතය ලබාගත නොහැක · නැවත උත්සාහ කිරීමට තට්ටු කරන්න',
        uz: "Jonli kursni olib bo'lmadi · qayta urinish uchun bosing", mn: 'Шууд ханшийг татаж чадсангүй · дахин оролдохын тулд товшино уу', kk: 'Тікелей бағамды алу мүмкін болмады · қайталау үшін түртіңіз', ky: 'Түз курсту алуу мүмкүн болгон жок · кайра аракет кылуу үчүн басыңыз', ur: 'لائیو ریٹ حاصل نہیں ہو سکا · دوبارہ کوشش کے لیے تھپتھپائیں',
        bn: 'লাইভ রেট আনা যায়নি · আবার চেষ্টা করতে ট্যাপ করুন', lo: 'ດຶງອັດຕາສົດບໍ່ໄດ້ · ແຕະເພື່ອລອງໃໝ່', ja: 'リアルタイムレートの取得に失敗 · タップして再試行', ar: 'تعذّر جلب السعر المباشر · اضغط لإعادة المحاولة', hi: 'लाइव दर नहीं मिल पाई · फिर से कोशिश के लिए टैप करें', fr: 'Échec de récupération du taux en direct · appuyez pour réessayer',
        tl: 'Hindi nakuha ang live rate · i-tap para subukang muli',
      });
    } else if (exchangeRateIsLive) {
      el.classList.add('is-live');
      el.title = pickLang('실시간 환율 적용 중 · 탭하면 새로고침', 'Live exchange rate applied · tap to refresh', '正在使用实时汇率 · 点击刷新', 'Đang áp dụng tỷ giá trực tiếp · nhấn để làm mới', 'ใช้อัตราแลกเปลี่ยนแบบเรียลไทม์ · แตะเพื่อรีเฟรช', 'Применён актуальный курс · нажмите для обновления', {
        km: 'កំពុងអនុវត្តអត្រាផ្ទាល់ · ចុចដើម្បីធ្វើឱ្យស្រស់', ne: 'लाइभ विनिमय दर लागू भयो · ताजा गर्न ट्याप गर्नुहोस्', id: 'Nilai tukar langsung diterapkan · ketuk untuk menyegarkan', my: 'တိုက်ရိုက်နှုန်းအသုံးပြုနေသည် · ပြန်လည်စတင်ရန်နှိပ်ပါ', si: 'සජීවී විනිමය අනුපාතය යොදා ඇත · නැවුම් කිරීමට තට්ටු කරන්න',
        uz: "Jonli valyuta kursi qo'llanildi · yangilash uchun bosing", mn: 'Шууд ханш хэрэглэгдэж байна · шинэчлэхийн тулд товшино уу', kk: 'Тікелей бағам қолданылды · жаңарту үшін түртіңіз', ky: 'Түз курс колдонулду · жаңылоо үчүн басыңыз', ur: 'لائیو زر مبادلہ لاگو ہے · ریفریش کے لیے تھپتھپائیں',
        bn: 'লাইভ বিনিময় হার প্রয়োগ করা হয়েছে · রিফ্রেশ করতে ট্যাপ করুন', lo: 'ນຳໃຊ້ອັດຕາແລກປ່ຽນສົດ · ແຕະເພື່ອໂຫຼດຄືນໃໝ່', ja: 'リアルタイム為替レート適用中 · タップして更新', ar: 'تم تطبيق سعر الصرف المباشر · اضغط للتحديث', hi: 'लाइव विनिमय दर लागू है · रीफ़्रेश के लिए टैप करें', fr: 'Taux de change en direct appliqué · appuyez pour actualiser',
        tl: 'Naka-apply ang live exchange rate · i-tap para i-refresh',
      });
    } else {
      el.title = pickLang('기본값 사용 중 · 탭하면 실시간 환율로 갱신', 'Using default rate · tap to fetch live rate', '正在使用默认汇率 · 点击获取实时汇率', 'Đang dùng tỷ giá mặc định · nhấn để lấy tỷ giá trực tiếp', 'ใช้อัตราแลกเปลี่ยนเริ่มต้น · แตะเพื่อดึงอัตราแบบเรียลไทม์', 'Используется курс по умолчанию · нажмите, чтобы получить актуальный курс', {
        km: 'កំពុងប្រើតម្លៃលំនាំដើម · ចុចដើម្បីទាញអត្រាផ្ទាល់', ne: 'पूर्वनिर्धारित दर प्रयोग हुँदै · लाइभ दर ल्याउन ट्याप गर्नुहोस्', id: 'Menggunakan nilai tukar bawaan · ketuk untuk mengambil nilai tukar langsung', my: 'မူလတန်ဖိုးအသုံးပြုနေသည် · တိုက်ရိုက်နှုန်းရယူရန်နှိပ်ပါ', si: 'පෙරනිමි අනුපාතය භාවිතා කරමින් · සජීවී අනුපාතය ලබාගැනීමට තට්ටු කරන්න',
        uz: "Standart kurs ishlatilmoqda · jonli kursni olish uchun bosing", mn: 'Стандарт ханш хэрэглэж байна · шууд ханш авахын тулд товшино уу', kk: 'Әдепкі бағам қолданылуда · тікелей бағамды алу үшін түртіңіз', ky: 'Демейки курс колдонулууда · түз курсту алуу үчүн басыңыз', ur: 'پہلے سے طے شدہ ریٹ استعمال ہو رہا ہے · لائیو ریٹ حاصل کرنے کے لیے تھپتھپائیں',
        bn: 'ডিফল্ট হার ব্যবহার করা হচ্ছে · লাইভ হার আনতে ট্যাপ করুন', lo: 'ນຳໃຊ້ອັດຕາເລີ່ມຕົ້ນ · ແຕະເພື່ອດຶງອັດຕາສົດ', ja: 'デフォルトレートを使用中 · タップしてリアルタイムレートを取得', ar: 'يُستخدم السعر الافتراضي · اضغط لجلب السعر المباشر', hi: 'डिफ़ॉल्ट दर प्रयोग हो रही है · लाइव दर लाने के लिए टैप करें', fr: 'Taux par défaut utilisé · appuyez pour récupérer le taux en direct',
        tl: 'Ginagamit ang default rate · i-tap para kunin ang live rate',
      });
    }
  });
}

// 홈/국가비교 페이지가 각자 독립된 입력 상태를 갖고 있으면 페이지 이동 시 데이터가 끊기는 문제가 있어
// 실제 "원본 데이터"는 여기 하나만 두고, 두 페이지는 화면에 들어올 때마다 여기서 값을 읽어와 표시한다.
let sharedAmountUsd = 100000000; // 기본 $100M
let sharedCountry = 'kr';
let sharedState = 'AVG';
// 입력창은 처음엔 비워두고 회색 placeholder("예: 100")만 보여주기로 한 디자인 의도가 있는데,
// syncHomeFromShared()가 탭 이동/실시간 환율 갱신 때마다 무조건 sharedAmountUsd(기본값 100)를
// 입력창에 채워 넣어서, 로드 직후(환율 fetch가 끝나자마자) placeholder가 진짜 값 "100"으로
// 바로 덮어써지는 문제가 있었음 — 사용자가 실제로 입력/조작한 적이 있을 때만 채워 넣도록 구분
let isAmountManuallyEdited = false;

function syncHomeFromShared(){
  const millions = sharedAmountUsd / 1000000;
  // 사용자가 아직 아무 것도 입력/조작하지 않았다면 입력창은 비워둔 채(placeholder만 표시) 유지 —
  // 슬라이더·계산 결과는 계속 sharedAmountUsd 기준으로 정상 동기화됨
  if (isAmountManuallyEdited) document.getElementById('homeAmountInput').value = millions;
  const slider = document.getElementById('homeAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.step = (millions % 10 === 0) ? 10 : 1; // 10의 배수가 아니면 step을 풀어줘야 value가 반올림 없이 정확히 반영됨
  slider.min = Math.min(10, Math.round(millions)); // $10M 미만 입력 시 슬라이더 하한도 같이 낮춰 불일치 방지
  slider.value = Math.round(millions);
  document.getElementById('homeCountrySelect').value = sharedCountry;
  document.querySelectorAll('#homeCountryToggle .country-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.country === sharedCountry);
  });
  document.getElementById('homeStateSelect').value = sharedState;
  document.getElementById('home-rate-input').value = EXCHANGE_RATE.toLocaleString('ko-KR');
  updateHomeCalc(sharedAmountUsd);
  filterFaq();
}

// ⚠️ [향후 국가 확장 시 필독] "반대 국가로 전환"은 국가가 딱 2개(kr/us)일 때만 성립하는
// 토글 로직. 3번째 국가(예: 베트남)가 추가되면 "반대"라는 개념 자체가 없어지므로,
// 이 버튼은 토글이 아니라 선택 UI(예: 국가 목록에서 고르기)로 다시 설계해야 함.
function goToCompareWithOppositeCountry(){
  sharedCountry = (sharedCountry === 'us') ? 'kr' : 'us';
  go('compare');
}

function syncCompareFromShared(){
  const millions = sharedAmountUsd / 1000000;
  document.getElementById('amountInput').value = millions;
  const slider = document.getElementById('compareAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.min = Math.min(10, Math.round(millions));
  slider.value = Math.round(millions);
  updateSliderFill(slider);
  document.getElementById('compareStateSelect').value = sharedState;
  document.getElementById('compare-rate-input').value = EXCHANGE_RATE.toLocaleString('ko-KR');
  updateCalc(sharedAmountUsd);
}

// 확률체감 화면 상금표의 "1 / N" 분모(당첨 확률의 역수) 포맷터 — 예전엔 "1 / 1,169만"처럼
// 한국식 만 단위로 하드코딩된 문자열을 언어 구분 없이 그대로 노출해서, 영어·아랍어 등에서도
// "만"이라는 한글 단위가 그대로 섞여 나오는 문제가 있었음. 한국어는 기존처럼 만 단위로,
// 나머지 언어는 formatWon()의 다른 곳과 같은 방식(en-US 콤마 그룹핑)으로 분리함
function formatOddsDenominator(n){
  if (typeof currentLang !== 'undefined' && currentLang === 'ko' && n >= 10000) {
    const man = Math.floor(n / 10000);
    const rest = n - man * 10000;
    return rest === 0 ? man.toLocaleString('ko-KR') + '만' : man.toLocaleString('ko-KR') + '만 ' + rest.toLocaleString('ko-KR');
  }
  return n.toLocaleString('en-US');
}

// ⚠️ [향후 다국가·다통화 확장 시 필독] 이 사이트의 모든 금액 표시(세금 비교표, 잭팟 계산기,
// 역산 계산기 등)가 이 함수 하나를 거치는데, 지금은 "억원"이 고정 접미사로 박혀 있음.
// 베트남 동(₫)·태국 바트 등 다른 통화로 보여주려면 국가별 통화 포맷터로 새로 짜야 하고,
// 코드 곳곳에 "억원"이 리터럴 문자열로도 흩어져 있어(2026년 7월 기준 약 25곳) 같이 찾아 바꿔야 함.
function formatWon(n){
  if (typeof currentLang !== 'undefined' && currentLang === 'en') return formatWonEn(n);
  // 중국어·일본어는 억/亿/億=10^8 단위 체계가 한국과 같아서, 영어처럼 별도 million/billion
  // 변환 없이 접미사만 그 언어 한자로 바꿔주면 됨(중국어·일본어 화자는 이 단위를 그대로 이해함)
  if (typeof currentLang !== 'undefined' && currentLang === 'zh') return formatWonZh(n);
  if (typeof currentLang !== 'undefined' && currentLang === 'ja') return formatWonJa(n);
  // 베트남어·태국어·러시아어는 "억" 단위 체계가 없어서 영어처럼 million/billion 변환이 필요
  if (typeof currentLang !== 'undefined' && currentLang === 'vi') return formatWonVi(n);
  if (typeof currentLang !== 'undefined' && currentLang === 'th') return formatWonTh(n);
  if (typeof currentLang !== 'undefined' && currentLang === 'ru') return formatWonRu(n);
  // ⚠️ 위 5개 언어(en/zh/ja/vi/th/ru) 외의 나머지 모든 언어(크메르어·네팔어·우즈베크어·몽골어·
  // 카자흐어·키르기스어·우르두어·벵골어·라오어·아랍어·힌디어·프랑스어·타갈로그어 등)는 한때
  // 이 분기 어디에도 안 걸려서 "억원"이라는 한국식 단위가 그대로 노출되고 있었음 — "억"은
  // 한국·중국·일본에서만 통용되는 단위라 다른 언어 화자에게는 숫자 크기 자체가 안 와닿는 문제였음.
  // 완벽한 현지 단위(예: 힌디·벵골어의 lakh/crore)까지 만들진 못했지만, 최소한 "억"보다는
  // 훨씬 널리 통하는 영어식 million/billion 표기로 통일해서 최소한의 가독성을 보장함
  if (typeof currentLang !== 'undefined' && currentLang !== 'ko') return formatWonEn(n);
  // "11,218억원"처럼 억 단위 숫자를 3자리 콤마로만 묶으면, 한국어 화자도 조 단위로 넘어갔는지
  // 확인하려면 4자리씩(만/억/조) 다시 끊어 읽어야 해서 한눈에 안 들어옴(사용자가 스크린샷으로 직접
  // 지적) — 1조(=10,000억) 이상이면 뉴스 표기처럼 "1조 1,218억원" 형태로 조 단위를 앞에 분리해서 보여줌
  if (Math.abs(n) >= 10000) {
    const rounded = Math.round(n);
    const jo = Math.trunc(rounded / 10000);
    const eok = rounded - jo * 10000;
    if (eok === 0) return jo.toLocaleString('ko-KR') + '조원';
    return jo.toLocaleString('ko-KR') + '조 ' + eok.toLocaleString('ko-KR') + '억원';
  }
  // 소수점 없이 정수(억원 단위)로 반올림해서 표시 — 읽기 쉽게 + 천단위 콤마
  const numStr = Math.round(n).toLocaleString('ko-KR');
  return numStr + '억원';
}

// 영어 화면에서는 "억"이라는 한국식 단위가 그대로 노출되면 안 되므로, 실제 원화 금액을
// million/billion/trillion 단위의 표준 영어 표기(₩)로 환산해서 보여줌.
// n은 "억" 단위 숫자(예: 6107.8 = 610,780,000,000원)
// million/billion/trillion 단위 표기가 필요한 언어(en/vi/th/ru)가 공유하는 포맷터.
// units는 [million, billion, trillion] 단위 이름, locale은 숫자 그룹핑(콤마 등)에 씀.
function formatWonIntl(n, units, locale){
  const krw = n * 100000000; // 억 → 실제 원화
  const abs = Math.abs(krw);
  let numStr, unit;
  if (abs >= 1e12) {
    numStr = (krw / 1e12).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    unit = units[2];
  } else if (abs >= 1e9) {
    numStr = (krw / 1e9).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    unit = units[1];
  } else {
    numStr = (krw / 1e6).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    unit = units[0];
  }
  return '₩ ' + numStr + ' ' + unit;
}
function formatWonEn(n){ return formatWonIntl(n, ['million', 'billion', 'trillion'], 'en-US'); }
function formatWonVi(n){ return formatWonIntl(n, ['triệu', 'tỷ', 'nghìn tỷ'], 'vi-VN'); }
function formatWonTh(n){ return formatWonIntl(n, ['ล้าน', 'พันล้าน', 'ล้านล้าน'], 'th-TH'); }
function formatWonRu(n){ return formatWonIntl(n, ['млн', 'млрд', 'трлн'], 'ru-RU'); }
// 중국어·일본어도 한국어와 같은 이유(억 단위 숫자를 3자리 콤마로만 묶으면 万亿/兆 단위를 넘었는지
// 한눈에 안 들어옴)로 1조(=10,000억) 이상이면 상위 단위를 앞에 분리해서 보여줌 — usdToKrwLabel()의
// 잭팟 퀵필 라벨에 이미 있던 "N万亿M亿" 표기 방식과 통일함(소수점 근사 대신 정확한 값을 그대로 보여줌)
function formatWonZh(n){
  if (Math.abs(n) >= 10000) {
    const rounded = Math.round(n);
    const zhao = Math.trunc(rounded / 10000);
    const yi = rounded - zhao * 10000;
    if (yi === 0) return zhao.toLocaleString('zh-CN') + '万亿韩元';
    return zhao.toLocaleString('zh-CN') + '万亿' + yi.toLocaleString('zh-CN') + '亿韩元';
  }
  return Math.round(n).toLocaleString('zh-CN') + '亿韩元';
}
function formatWonJa(n){
  if (Math.abs(n) >= 10000) {
    const rounded = Math.round(n);
    const cho = Math.trunc(rounded / 10000);
    const oku = rounded - cho * 10000;
    if (oku === 0) return cho.toLocaleString('ja-JP') + '兆ウォン';
    return cho.toLocaleString('ja-JP') + '兆' + oku.toLocaleString('ja-JP') + '億ウォン';
  }
  return Math.round(n).toLocaleString('ja-JP') + '億ウォン';
}

const TAX_MODEL = {
  us_resident: {
    federal: 0.37      // 연방세 최고구간 (실제: 24% 원천징수 후 최대 37% 정산 — 데모는 단순화해 37% 일괄 적용)
    // 주세는 STATE_TAX_RATES[stateCode]에서 가져다 씀 (AVG 포함, 50개 주+DC 실측 세율 기반)
  },
  nonresident: {
    // 한국 거주자 등 미국 비거주 외국인. 한미 조세조약이 도박·복권 소득을 커버하지 않아
    // IRC 871(a)에 따라 일괄 30% 원천징수가 적용되며, 대부분 이것이 최종세율(추가 정산 없음)
    us_withholding: 0.30
    // 한국 세금은 KOREA_TAX_BRACKETS(종합소득세 누진세율) + FTC로 계산 — 2026-07 국세청 답변 반영
  },
  cn_resident: {
    // 중국 개인소득세법 제3조: 복권 당첨 등 "偶然所得"(우연소득)은 20% 단일 비례세율.
    // 개인소득세법 실시조례 제20조 + 재정부세무총국공고 2020년 제3호: 경외(境外) 우연소득은
    // 경내 종합소득과 합산하지 않고 별도 계산 — 한국의 누진세율 같은 구간 구조가 없음.
    incidental_income_rate: 0.20
    // FTC(경외세액공제)는 한도 내 상계, 초과분은 5년 이월 가능(국가세무총국 공고) — 여기 계산은 당해년도 상계분만 반영
  },
  in_resident: {
    // 인도 소득세법(Income Tax Act 1961) 제115BB조(2026-04-01 시행 신법 ITA 2025 기준 제128조로 이동):
    // 복권·도박·베팅 당첨소득은 공제·면제 전혀 없이 30% 단일세율(flat rate, no deductions/exemptions).
    base_rate: 0.30,
    // 여기에 항상 4% 교육·보건 세스(cess)가 추가로 붙음(세액 기준, 과세표준 기준 아님).
    cess: 0.04,
    // 서차지(surcharge) 15% 상한은 배당소득·제111A/112/112A/115AD조 자본이득에만 적용되는 예외이고,
    // 제115BB조(복권 등 우발소득)는 이 예외 목록에 없어 일반 개인 서차지 구간을 그대로 적용받음(Finance Act
    // First Schedule 확인). 잭팟 규모(₩ 수백억대)는 총소득 5 crore 루피를 항상 넘으므로 최고 구간 적용.
    // 신제도(New Regime, 2023년 예산안 이후 기본 적용)에서는 서차지 상한 자체가 25%로 낮아져 있어(구제도는
    // 37%까지), 별도 공제가 없는 당첨소득만 있는 신고자에게는 신제도가 유리 — 25%를 기본값으로 사용.
    surcharge: 0.25
    // 인도-미국 조세조약(DTAA)에 따라 FTC(외국납부세액공제)로 미국 원천징수분을 인도 세액 한도 내에서 상계 가능.
  },
  vn_resident: {
    // 베트남 개인소득세법 시행규칙 Circular 111/2013/TT-BTC 제15조: 복권 등 상금(trúng thưởng) 소득 10%
    // 단일세율 원천징수. 2026-07-01 시행 신소득세법(Law No.109/2025/QH15)에서 면세 기준액이
    // 1,000만동→2,000만동으로 상향됐지만(세율 10%는 그대로), 잭팟 규모는 이 기준을 항상 훨씬 넘음.
    prize_income_rate: 0.10
    // FTC(외국납부세액공제): 미국-베트남 조세조약 자체는 2015년 서명 후 아직 비준·발효 안 됐지만
    // (베트남은 주요 미국 교역국 중 유일하게 발효된 조세조약이 없음), 그것과 별개로 같은
    // Circular 111/2013/TT-BTC 제26조 제2항이 거주자의 해외 납부세액을 조세조약 여부와 무관하게
    // 베트남 세액 한도 내에서 국내법상 일방적으로 공제해주는 걸 확인함 — FTC 상계 적용.
  },
  id_resident: {
    // 인도네시아 정부령(Peraturan Pemerintah) 132/2000 + 소득세법(PPh) 제4조 2항: 복권 당첨금(hadiah undian)은
    // 공제·누진 구간 없이 25% 단일 최종세율(final tax)이 총액에 적용됨.
    lottery_final_tax_rate: 0.25
    // 인도네시아-미국 조세조약(DTA)에 따라 FTC로 미국 원천징수분을 인도네시아 세액 한도 내에서 상계 가능.
  },
  ph_resident: {
    // 필리핀은 자국(PCSO) 복권 당첨금에만 20% 분리과세(final tax)가 적용되고, 해외(미국 등) 복권
    // 당첨금은 거주자의 종합소득에 합산돼 누진세율(0~35%, TRAIN법/국세법전 제24조 기준)로 과세됨 — 단일세율이 아님.
    // 잭팟 규모(수백억원 수준)는 항상 최고 소득 구간을 초과하므로, 이 계산기는 최고세율 35%로 근사함.
    // ⚠️ 실제로는 누진 구간별 계산이 필요해 정확한 세액과 소폭 차이가 날 수 있는 근사치.
    approx_top_bracket_rate: 0.35
    // 필리핀-미국 조세조약(DTA)에 따라 FTC로 미국 원천징수분을 필리핀 세액 한도 내에서 상계 가능.
  },
  th_resident: {
    // ⚠️ 태국은 자국 복권(정부복권판매처 GLO) 당첨금에는 별도 우대과세(0.5% 원천징수 + 인지세, 종합소득세
    // 면제)가 있지만, 해외에서 받은 복권 당첨금을 태국 거주자가 어떻게 신고해야 하는지는 국세청 명령
    // Paw.161/2566(2023-09-15, 태국 불기 2566년=서기 2023년 — 2024-01-01 이후 태국으로 송금하는
    // 해외소득 전부를 그 해 종합소득에 합산 신고하도록 해석 변경, Paw.162/2566으로 2024-01-01 이전
    // 취득분은 소급 적용 제외) 시행 이후로도 명확한 공식 가이드라인을 찾지 못함. 다만 "태국으로
    // 가져오면 종합소득 합산"이라는 큰 틀은 확인됐으므로, 아래 수치는 태국 개인소득세 최고세율(35%,
    // 순소득 500만 바트 초과 — 잭팟 규모는 항상 초과)을 그대로 가져온 "추정치"로 사용.
    unverified_approx_rate: 0.35
  },
  jp_resident: {
    // 일본은 자국 복권(다카라쿠지)만 「당첨금부증표법」에 따라 완전 비과세이고, 해외 복권은 예외 없이
    // 「일시소득」(一時所得, 소득세법)으로 과세됨(국세청 タックスアンサー No.1490). 일시소득 = (당첨금 −
    // 특별공제 50만엔) × 1/2, 이후 다른 소득과 합산해 누진세율로 과세. 잭팟 규모는 항상 최고구간을
    // 초과하므로, 특별공제(약 400만원 수준, 잭팟 대비 무시 가능)는 생략하고 1/2 포함 × 최고 실효세율로
    // 근사함. 최고 실효세율 = (국세 최고구간 45% × 부흥특별소득세 1.021배) + 지방주민세 10% = 55.945%
    half_inclusion_top_rate: 0.279725 // = 0.55945 × 0.5
  },
  ru_resident: {
    // 러시아 세법(Налоговый кодекс РФ) 제224조 1항: 해외 복권 당첨금은 국내 판촉성 경품에만 적용되는
    // 35% 특별세율(제224조 2항, 자체 판촉 추첨 한정)이 아니라 일반 누진 개인소득세율이 적용되며,
    // 원천징수 없이 본인이 3-NDFL로 직접 신고(제228조). 2025년 개편 기준 5단계 누진(13~22%), 잭팟
    // 규모는 항상 최고구간(연 5천만루블 초과)에 해당.
    top_bracket_rate: 0.22
    // ⚠️ 러시아는 2023년 8월 대통령령 585호로 미-러 조세조약 핵심 조항(이중과세 조정 포함)의 효력을
    // 정지시켰고 미국도 2024년 8월 상호 인정함 — 미국 원천징수세를 러시아 세액에서 공제(FTC)받을 수
    // 있는지 불확실해 UI에 별도 경고 표시함.
  },
  np_resident: {
    // 네팔 소득세법(Income Tax Act 2058, 2002) 제88A조: 복권·증여·상금 등 "우발이득"(windfall gain)은
    // 공제 없이 25% 단일세율(최종세) 적용. 제71조(외국납부세액 조정)에 따라 해외에서 낸 세금을
    // 네팔 평균세율 한도 내에서 상계 가능(조세조약 없이 국내법상 일방적 공제).
    windfall_rate: 0.25
  },
  lk_resident: {
    // ⚠️ 스리랑카 국세법(Inland Revenue Act No.24 of 2017) — 복권·베팅·도박 당첨금은 "이익 및 수익"에
    // 포함돼 일반 누진세율로 과세(자국 지급기관 대상 10% 원천징수(제157·158조)는 해외 지급에는
    // 적용 안 되고 그냥 누진세율로 직접 신고). 2025/26년 개인소득세 최고구간은 36%(과세표준
    // 430만 루피 초과) — 잭팟 규모는 항상 이 구간을 초과.
    // 2025년 4월 세법 개정(Inland Revenue (Amendment) Act No.2 of 2025)으로 해외소득을 스리랑카
    // 은행 계좌로 송금하면 15% 우대세율이 신설됨. 개정법 제3附則 문구 자체는 "any foreign source"로
    // 한정 없이 넓게 쓰여있어 복권 같은 우발이득도 문언상 포함될 여지가 있으나(2026-07-20 후속
    // 검증에서 재확인), KPMG·현지 세무 자문사 등 모든 실무 해설은 하나같이 "해외 용역소득(서비스
    // 수출)" 사례만 다뤄서 실제 적용 범위가 여전히 불확실함. 반대로 기존 복권·도박 당첨금 원천징수
    // 규정(제157·158조)은 "스리랑카에서 보유한 당첨금"을 "스리랑카 원천"으로 명시해, 이 조항 자체가
    // 국내 원천을 전제로 한다는 점은 법 문언상 재확인됨 — 해외 지급 당첨금엔 적용 안 됨. 종합적으로
    // 더 안전한 기존 누진 최고세율(36%)을 그대로 유지함.
    top_bracket_rate: 0.36
  },
  uz_resident: {
    // 우즈베키스탄 세법(Tax Code of the Republic of Uzbekistan) 개인소득세 — 상금·복권 당첨금을
    // 포함한 모든 개인소득에 단일 12% 세율 적용(2023년부터 시행).
    flat_rate: 0.12
  },
  kz_resident: {
    // 카자흐스탄 2026-01-01 시행 신세법(법률 214-VIII, 2025-07-18) 제379조 "당첨금 형태의 소득"
    // (Доход в виде выигрышей) — 근로소득에 새로 도입된 누진세율(10%/15%, 임금 기준)과 별도로,
    // "당첨금"(выигрыш)은 이 조항에 따라 거주자 기준 10% 단일세율 원천징수 그대로 유지됨(비거주자는 20%).
    // 국내 복권 소액(월 계산지수 6배, 약 6만원 이하) 면제는 해외 당첨금에는 적용 안 됨.
    winnings_rate: 0.10
  },
  kg_resident: {
    // 키르기스스탄 세법(Tax Code of the Kyrgyz Republic, 2022) — 당첨금(выигрыш)을 포함한 개인소득에
    // 단일 10% 세율 적용. 해외 지급이라 원천징수 기관이 없어 본인이 직접 신고.
    flat_rate: 0.10
  },
  mm_resident: {
    // 미얀마 소득세법(Income Tax Law 1974, 개정) — 해외 복권 당첨금은 자국 국영복권 전용 규정과
    // 무관하게 "기타 소득"(Income from Other Sources)으로 분류돼 누진세율 적용. 최고구간 25%
    // (7천만 짯 초과) — 잭팟 규모는 항상 이 구간을 초과.
    top_bracket_rate: 0.25
  },
  bd_resident: {
    // 방글라데시 소득세법(Income Tax Act 2023) — 복권·경품 등 당첨소득은 "기타 소득"(Income from
    // Other Sources)으로 분류돼 공제 없이 25% 단일세율 적용.
    flat_rate: 0.25
  },
  pk_resident: {
    // ⚠️ 파키스탄 소득세법(Income Tax Ordinance 2001) 제156조는 복권 등 당첨금에 20%(신고자)~40%
    // (비신고자) 세율을 두지만, 이는 "파키스탄 내 지급기관이 원천징수"하고 그 원천징수액이 최종세
    // (final tax)가 되는 구조라, 미국에서 직접 받는 당첨금(원천징수 기관 없음)에 그대로 적용되는지
    // 불명확함. 파키스탄은 거주자의 전세계소득에 과세하므로 해외 당첨금은 직접 신고 대상이고,
    // 외국납부세액은 제103조로 세액공제 가능(2026-07-20 후속 검증에서 확인) — 이 계산기는 더
    // 안전한 기본값으로 일반 소득세 최고구간(35%)을 사용, UI에도 이 불확실성을 별도 표시함.
    unverified_approx_rate: 0.35,
    // Super Tax(제4C조): 과세소득 5억 루피 초과분에 부과 — 「Finance Act 2026」(2026-07-01 시행)에서
    // 최고세율이 10%→8%로 인하됨(은행·석유가스탐사·비료업종은 10% 유지되나 개인 복권 당첨자는
    // 해당 없음, 2026-07-20 후속 검증에서 확인). 복권 잭팟 규모(루피 환산 시 항상 5억 루피 초과)라
    // 이 계산기가 다루는 범위에서는 사실상 항상 이 최고구간(8%)이 적용된다고 봐도 안전함.
    super_tax_top_rate: 0.08,
    // 서차지: 연소득 1,000만 루피 초과 개인에게 "산출세액"(소득이 아니라 세액 기준) 10% 추가 부과.
    // 급여소득자는 2026-27 회계연도(2026년 7월~)부터 이 서차지가 폐지됐지만, 복권 당첨금은
    // 급여소득이 아니라 "기타소득"으로 분류돼 비급여소득자 기준(폐지 안 됨, 10%)이 적용됨.
    surcharge_on_tax_rate: 0.10
  },
  kh_resident: {
    // ⚠️ 캄보디아 세법(Law on Taxation)에는 급여·사업소득 외 개인의 복권·상금 소득을 과세하는
    // 일반 조항을 찾지 못함(2025년 신설 자본이득세도 부동산·주식 등 특정 자산에만 적용되고 복권은
    // 대상 아님). 명확한 근거가 없어 캄보디아 추가세를 0으로 두고 UI에 이 불확실성을 별도 표시함.
    unverified_rate: 0
  },
  mn_resident: {
    // ⚠️ 몽골 개인소득세법의 베팅·도박성 당첨금 40% 조항은 2025-05-30 몽골 국회가 국내 베팅·온라인도박·
    // 유료복권 전면 금지 법안을 통과시키면서, 관련 세법 조항(소득세법·법인세법·중소기업지원법 등)까지
    // 함께 폐지된 것으로 재확인됨(Parliament of Mongolia 공식 발표 기준 — 폐지된 조항은 카지노 일일
    // 수익에 대한 법인 과세였고, 개인 복권 당첨금 40%는 이와 별개로 애초에 명확한 근거가 없었음).
    // 그 자리를 대신할 "해외 복권 당첨금" 명시 조항은 찾지 못했으나, 근로/사업소득(제10조, 누진
    // 10/15/25%)이나 배당·이자·기타소득(제15.1·16·17.1.2·17.1.3조, 단일 10%) 중 하나로 흡수될 가능성이
    // 높음. 10%는 "확정된 세율"이 아니라 여러 후보 중 가장 근접해 보이는 하나를 잠정적으로 쓰는 것 —
    // UI에 불확실성 표시를 유지함.
    unverified_approx_rate: 0.10
  },
  la_resident: {
    // ⚠️ 라오스 신설 소득세법(No.88/NA, 2026-06-19 관보 게재·2026-07-01 시행) — 복권 당첨소득 5%
    // 단일세율은 이전 법에도 이미 있었고(신규 도입 아님, 2026-07-20 후속 검증에서 정정), 이번 개정으로
    // 달라진 건 "1천만 킵 이하는 비과세"라는 면제 기준이 새로 생긴 것뿐(이전엔 전액 과세). 잭팟
    // 규모 당첨금은 이 기준을 항상 넘기 때문에 계산 결과(5%)에는 영향 없음. 라오스는 미국과
    // 조세조약이 없어 FTC(세액공제)도 적용 안 됨(미국 원천징수세에 이 5%가 그대로 추가됨,
    // 2026-07-20 후속 검증에서 재확인). UI에도 이 불확실성을 별도 표시함.
    unverified_rate: 0.05,
    ftc_available: false
  }
};

// 50개 주 + DC 전체 세율 (2026년 7월 컴파일). 출처: 각 주 세무당국 공식 최고 한계세율(top marginal
// individual income tax rate)을 "거대 당첨금이 최고 구간에 해당한다"는 가정하에 근사치로 사용.
// ⚠️ 매년 주별로 세율 개정이 있어(예: 2026년만 해도 인디애나·켄터키·미시시피·노스캐롤라이나·오하이오 등
// 다수 인하) 실제 신고 전에는 반드시 해당 주 세무당국/복권위원회 공식 자료로 재확인 필요.
const STATE_TAX_RATES = {
  AVG:   { label: '평균', labelEn: 'Average', labelZh: '平均', rate: 0 }, // rate는 아래에서 50개 주+DC 실측치로 다시 계산해서 덮어씀(하드코딩 아님)
  AL:  { label: '앨라배마', labelEn: 'Alabama', labelZh: '阿拉巴马', rate: 0.05 },
  AK:  { label: '알래스카', labelEn: 'Alaska', labelZh: '阿拉斯加', rate: 0.0 },
  AZ:  { label: '애리조나', labelEn: 'Arizona', labelZh: '亚利桑那', rate: 0.025 },
  AR:  { label: '아칸소', labelEn: 'Arkansas', labelZh: '阿肯色', rate: 0.039 },
  CA:  { label: '캘리포니아 (복권 당첨금 면제)', labelEn: 'California (lottery-exempt)', labelZh: '加利福尼亚（彩票免税）', rate: 0.0 },
  CO:  { label: '콜로라도', labelEn: 'Colorado', labelZh: '科罗拉多', rate: 0.044 },
  CT:  { label: '코네티컷', labelEn: 'Connecticut', labelZh: '康涅狄格', rate: 0.0699 },
  DE:  { label: '델라웨어', labelEn: 'Delaware', labelZh: '特拉华', rate: 0.066 },
  FL:  { label: '플로리다', labelEn: 'Florida', labelZh: '佛罗里达', rate: 0.0 },
  GA:  { label: '조지아', labelEn: 'Georgia', labelZh: '佐治亚', rate: 0.0539 },
  HI:  { label: '하와이', labelEn: 'Hawaii', labelZh: '夏威夷', rate: 0.11 },
  ID:  { label: '아이다호', labelEn: 'Idaho', labelZh: '爱达荷', rate: 0.053 },
  IL:  { label: '일리노이', labelEn: 'Illinois', labelZh: '伊利诺伊', rate: 0.0495 },
  IN:  { label: '인디애나', labelEn: 'Indiana', labelZh: '印第安纳', rate: 0.0295 },
  IA:  { label: '아이오와', labelEn: 'Iowa', labelZh: '艾奥瓦', rate: 0.038 },
  KS:  { label: '캔자스', labelEn: 'Kansas', labelZh: '堪萨斯', rate: 0.0558 },
  KY:  { label: '켄터키', labelEn: 'Kentucky', labelZh: '肯塔基', rate: 0.035 },
  LA:  { label: '루이지애나', labelEn: 'Louisiana', labelZh: '路易斯安那', rate: 0.03 },
  ME:  { label: '메인', labelEn: 'Maine', labelZh: '缅因', rate: 0.0915 }, // 2026-01-01 시행 "밀리어네어 서차지"(LD 2212) — 소득 100만 달러 초과분에 2%p 추가되어 기존 7.15%→9.15%로 인상. 잭팟 규모는 항상 이 기준 초과.
  MD:  { label: '메릴랜드', labelEn: 'Maryland', labelZh: '马里兰', rate: 0.065 }, // 2025년 신설 최고세율 6.5%($100만 초과 구간) — 지방(county) 세는 다른 주와 일관되게 미포함
  MA:  { label: '매사추세츠', labelEn: 'Massachusetts', labelZh: '马萨诸塞', rate: 0.09 },
  MI:  { label: '미시간', labelEn: 'Michigan', labelZh: '密歇根', rate: 0.0425 },
  MN:  { label: '미네소타', labelEn: 'Minnesota', labelZh: '明尼苏达', rate: 0.0985 },
  MS:  { label: '미시시피', labelEn: 'Mississippi', labelZh: '密西西比', rate: 0.04 },
  MO:  { label: '미주리', labelEn: 'Missouri', labelZh: '密苏里', rate: 0.047 },
  MT:  { label: '몬태나', labelEn: 'Montana', labelZh: '蒙大拿', rate: 0.0565 },
  NE:  { label: '네브래스카', labelEn: 'Nebraska', labelZh: '内布拉斯加', rate: 0.0455 },
  NV:  { label: '네바다', labelEn: 'Nevada', labelZh: '内华达', rate: 0.0 },
  NH:  { label: '뉴햄프셔', labelEn: 'New Hampshire', labelZh: '新罕布什尔', rate: 0.0 },
  NJ:  { label: '뉴저지', labelEn: 'New Jersey', labelZh: '新泽西', rate: 0.1075 },
  NM:  { label: '뉴멕시코', labelEn: 'New Mexico', labelZh: '新墨西哥', rate: 0.059 },
  NY:  { label: '뉴욕', labelEn: 'New York', labelZh: '纽约', rate: 0.109 },
  NC:  { label: '노스캐롤라이나', labelEn: 'North Carolina', labelZh: '北卡罗来纳', rate: 0.0399 },
  ND:  { label: '노스다코타', labelEn: 'North Dakota', labelZh: '北达科他', rate: 0.0195 },
  OH:  { label: '오하이오', labelEn: 'Ohio', labelZh: '俄亥俄', rate: 0.0275 },
  OK:  { label: '오클라호마', labelEn: 'Oklahoma', labelZh: '俄克拉何马', rate: 0.045 },
  OR:  { label: '오리건', labelEn: 'Oregon', labelZh: '俄勒冈', rate: 0.099 },
  PA:  { label: '펜실베이니아', labelEn: 'Pennsylvania', labelZh: '宾夕法尼亚', rate: 0.0307 },
  RI:  { label: '로드아일랜드', labelEn: 'Rhode Island', labelZh: '罗德岛', rate: 0.0599 },
  SC:  { label: '사우스캐롤라이나', labelEn: 'South Carolina', labelZh: '南卡罗来纳', rate: 0.062 },
  SD:  { label: '사우스다코타', labelEn: 'South Dakota', labelZh: '南达科他', rate: 0.0 },
  TN:  { label: '테네시', labelEn: 'Tennessee', labelZh: '田纳西', rate: 0.0 },
  TX:  { label: '텍사스', labelEn: 'Texas', labelZh: '得克萨斯', rate: 0.0 },
  UT:  { label: '유타', labelEn: 'Utah', labelZh: '犹他', rate: 0.0455 },
  VT:  { label: '버몬트', labelEn: 'Vermont', labelZh: '佛蒙特', rate: 0.0875 },
  VA:  { label: '버지니아', labelEn: 'Virginia', labelZh: '弗吉尼亚', rate: 0.0575 },
  WA:  { label: '워싱턴', labelEn: 'Washington', labelZh: '华盛顿', rate: 0.0 },
  DC:  { label: '워싱턴 D.C.', labelEn: 'Washington D.C.', labelZh: '华盛顿特区', rate: 0.1075 },
  WV:  { label: '웨스트버지니아', labelEn: 'West Virginia', labelZh: '西弗吉尼亚', rate: 0.0482 },
  WI:  { label: '위스콘신', labelEn: 'Wisconsin', labelZh: '威斯康星', rate: 0.0765 },
  WY:  { label: '와이오밍', labelEn: 'Wyoming', labelZh: '怀俄明', rate: 0.0 },
};

// AVG는 임의로 정한 예시치가 아니라, 위 50개 주 + DC의 세율을 단순 평균(가중치 없음 — 인구·복권판매량
// 가중평균은 아님)해서 실제로 계산한 값. 위 표가 갱신되면 재계산 없이 자동으로 같이 따라감
(function computeAvgStateTaxRate(){
  const codes = Object.keys(STATE_TAX_RATES).filter(code => code !== 'AVG');
  const sum = codes.reduce((total, code) => total + STATE_TAX_RATES[code].rate, 0);
  STATE_TAX_RATES.AVG.rate = sum / codes.length;
})();

// 미국 주 이름 17개 언어 버전(AVG 제외, 세율 없이 이름만) — checkRefundPossibility()의 환급 체크리스트 문구와
// 국가별 비교 카드(사이드카드)의 '(주 이름)' 표기에서 함께 재사용함. i18n-source/translations.json의
// state.name.* 키와 동일한 번역을 써서 두 시스템 사이에 표기가 갈리지 않게 함
const STATE_DISPLAY_NAMES_MORE = {
  km: { AL: "អាឡាបាម៉ា", AK: "អាឡាស្កា", AZ: "អារីហ្សូណា", AR: "អាកានសាស់", CA: "កាលីហ្វ័រញ៉ា", CO: "កូឡូរ៉ាដូ", CT: "កូនិកទីខឺត", DE: "ដេឡាវែរ", FL: "ហ្វ្លរីដា", GA: "ហ្សកចា", HI: "ហាវៃអ៊ី", ID: "អៃដាហូ", IL: "អ៊ីលីណយ", IN: "អ៊ីនឌីអាណា", IA: "អៃយូវ៉ា", KS: "កានសាស់", KY: "កិនតាគី", LA: "លូវីស៊ីអាណា", ME: "មែន", MD: "ម៉ែរីឡែន", MA: "ម៉ាសាឈូសិត", MI: "មីឈីហ្គែន", MN: "មីនីសូតា", MS: "មីស៊ីស៊ីពី", MO: "មីសួរី", MT: "ម៉ុនតាណា", NE: "នេប្រាស្កា", NV: "នេវ៉ាដា", NH: "ញូវហែមសៀរ", NJ: "ញូវជឺស៊ី", NM: "ញូវម៉ិចស៊ិកូ", NY: "ញូវយ៉ក", NC: "ខារ៉ូលីណាខាងជើង", ND: "ដាកូតាខាងជើង", OH: "អូហៃអូ", OK: "អុកឡាហូម៉ា", OR: "អូរីហ្គិន", PA: "ប៉េនស៊ីលវេនៀ", RI: "រ៉ូតអាយឡែន", SC: "ខារ៉ូលីណាខាងត្បូង", SD: "ដាកូតាខាងត្បូង", TN: "តេណេស៊ី", TX: "តិចសាស់", UT: "យូថា", VT: "វឺម៉ុន", VA: "វឺជីនៀ", WA: "វ៉ាស៊ីនតោន", DC: "វ៉ាស៊ីនតោន ឌីស៊ី", WV: "វឺជីនៀខាងលិច", WI: "វិសខនស៊ីន", WY: "វ៉ៃអូមីង" },
  ne: { AL: "अलाबामा", AK: "अलास्का", AZ: "एरिजोना", AR: "आर्कान्सास", CA: "क्यालिफोर्निया", CO: "कोलोराडो", CT: "कनेक्टिकट", DE: "डेलावेयर", FL: "फ्लोरिडा", GA: "जर्जिया", HI: "हवाई", ID: "आइडाहो", IL: "इलिनोइस", IN: "इन्डियाना", IA: "आयोवा", KS: "कान्सास", KY: "केन्टकी", LA: "लुइजियाना", ME: "मेन", MD: "मेरील्यान्ड", MA: "म्यासाचुसेट्स", MI: "मिशिगन", MN: "मिनेसोटा", MS: "मिसिसिपी", MO: "मिसुरी", MT: "मोन्टाना", NE: "नेब्रास्का", NV: "नेभाडा", NH: "न्यू ह्याम्पशायर", NJ: "न्यू जर्सी", NM: "न्यू मेक्सिको", NY: "न्युयोर्क", NC: "उत्तर क्यारोलिना", ND: "उत्तर डाकोटा", OH: "ओहायो", OK: "ओक्लाहोमा", OR: "ओरेगन", PA: "पेन्सिलभेनिया", RI: "रोड आइल्यान्ड", SC: "दक्षिण क्यारोलिना", SD: "दक्षिण डाकोटा", TN: "टेनेसी", TX: "टेक्सास", UT: "युटा", VT: "भर्मोन्ट", VA: "भर्जिनिया", WA: "वासिङटन", DC: "वासिङटन डिसी", WV: "पश्चिम भर्जिनिया", WI: "विस्कन्सिन", WY: "वायोमिङ" },
  id: { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "Carolina Utara", ND: "Dakota Utara", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "Carolina Selatan", SD: "Dakota Selatan", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", DC: "Washington D.C.", WV: "Virginia Barat", WI: "Wisconsin", WY: "Wyoming" },
  my: { AL: "အလာဗားမား", AK: "အလာစကာ", AZ: "အရီဇိုနာ", AR: "အာကင်ဆော်", CA: "ကယ်လီဖိုးနီးယား", CO: "ကိုလိုရာဒို", CT: "ကွန်နက်တီကတ်", DE: "ဒယ်လာဝဲ", FL: "ဖလော်ရီဒါ", GA: "ဂျော်ဂျီယာ", HI: "ဟာဝိုင်ယီ", ID: "အိုင်ဒါဟို", IL: "အီလီနွိုက်", IN: "အင်ဒီယာနာ", IA: "အိုင်အိုဝါ", KS: "ကန်စက်စ်", KY: "ကင်တပ်ကီ", LA: "လူဝီစီယားနား", ME: "မိန်း", MD: "မေရီလန်း", MA: "မက်ဆာချူးဆက်", MI: "မီချီဂန်", MN: "မင်နီဆိုးတာ", MS: "မစ္စစ္စပီ", MO: "မစ္စူရီ", MT: "မွန်တာနား", NE: "နက်ဘရက်စကာ", NV: "နီဗားဒါး", NH: "နယူးဟမ်ရှိုင်ယား", NJ: "နယူးဂျာစီ", NM: "နယူးမက္ကဆီကို", NY: "နယူးယောက်", NC: "မြောက်ကယ်ရိုလိုင်းနား", ND: "မြောက်ဒါကိုတာ", OH: "အိုဟိုင်းရို", OK: "အိုကလာဟိုမာ", OR: "အိုရီဂွန်", PA: "ပင်ဆယ်လ်ဗေးနီးယား", RI: "ရိုးဒ်အိုင်လန်း", SC: "တောင်ကယ်ရိုလိုင်းနား", SD: "တောင်ဒါကိုတာ", TN: "တင်နက်ဆီ", TX: "တက္ကဆက်စ်", UT: "ယူတာ", VT: "ဗားမောင့်", VA: "ဗာဂျီးနီးယား", WA: "ဝါရှင်တန်", DC: "ဝါရှင်တန် ဒီစီ", WV: "အနောက်ဗာဂျီးနီးယား", WI: "ဝစ်စကွန်စင်", WY: "ဝိုင်အိုမင်း" },
  si: { AL: "ඇලබාමා", AK: "අලාස්කා", AZ: "ඇරිසෝනා", AR: "ආකන්සාස්", CA: "කැලිෆෝනියා", CO: "කොලරාඩෝ", CT: "කනෙක්ටිකට්", DE: "ඩෙලවෙයාර්", FL: "ෆ්ලොරිඩා", GA: "ජෝර්ජියා", HI: "හවායි", ID: "අයිඩහෝ", IL: "ඉලිනොයිස්", IN: "ඉන්දියානා", IA: "අයෝවා", KS: "කැන්සාස්", KY: "කෙන්ටකි", LA: "ලුයිසියානා", ME: "මේන්", MD: "මේරිලන්ඩ්", MA: "මැසචුසෙට්ස්", MI: "මිචිගන්", MN: "මිනසෝටා", MS: "මිසිසිපි", MO: "මිසූරි", MT: "මොන්ටානා", NE: "නෙබ්‍රාස්කා", NV: "නෙවාඩා", NH: "නිව හැම්ප්ෂයාර්", NJ: "නිව ජර්සි", NM: "නිව මෙක්සිකෝ", NY: "නිව යෝර්ක්", NC: "උතුරු කැරොලිනා", ND: "උතුරු ඩැකෝටා", OH: "ඔහයෝ", OK: "ඔක්ලහෝමා", OR: "ඔරිගන්", PA: "පෙන්සිල්වේනියා", RI: "රෝඩ් අයිලන්ඩ්", SC: "දකුණු කැරොලිනා", SD: "දකුණු ඩැකෝටා", TN: "ටෙනසී", TX: "ටෙක්සාස්", UT: "යූටා", VT: "වර්මොන්ට්", VA: "වර්ජිනියා", WA: "වොෂිංටන්", DC: "වොෂිංටන් ඩීසී", WV: "බටහිර වර්ජිනියා", WI: "විස්කොන්සින්", WY: "වයෝමිං" },
  uz: { AL: "Alabama", AK: "Alyaska", AZ: "Arizona", AR: "Arkanzas", CA: "Kaliforniya", CO: "Kolorado", CT: "Konnektikut", DE: "Delaver", FL: "Florida", GA: "Jorjiya", HI: "Gavayi", ID: "Aydaho", IL: "Illinoys", IN: "Indiana", IA: "Ayova", KS: "Kanzas", KY: "Kentukki", LA: "Luiziana", ME: "Meyn", MD: "Merilend", MA: "Massachusets", MI: "Mishigan", MN: "Minnesota", MS: "Missisipi", MO: "Missuri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "Nyu-Xempshir", NJ: "Nyu-Jersi", NM: "Nyu-Meksiko", NY: "Nyu-York", NC: "Shimoliy Karolina", ND: "Shimoliy Dakota", OH: "Ogayo", OK: "Oklahoma", OR: "Oregon", PA: "Pensilvaniya", RI: "Rod-Aylend", SC: "Janubiy Karolina", SD: "Janubiy Dakota", TN: "Tennessi", TX: "Texas", UT: "Yuta", VT: "Vermont", VA: "Virjiniya", WA: "Vashington", DC: "Vashington (DK)", WV: "Gʻarbiy Virjiniya", WI: "Viskonsin", WY: "Vayoming" },
  mn: { AL: "Алабама", AK: "Аляска", AZ: "Аризона", AR: "Арканзас", CA: "Калифорни", CO: "Колорадо", CT: "Коннектикут", DE: "Делавэр", FL: "Флорида", GA: "Жоржиа", HI: "Хавай", ID: "Айдахо", IL: "Иллинойс", IN: "Индиана", IA: "Айова", KS: "Канзас", KY: "Кентакки", LA: "Луизиана", ME: "Мэйн", MD: "Мэриленд", MA: "Массачусетс", MI: "Мичиган", MN: "Миннесота", MS: "Миссисипи", MO: "Миссури", MT: "Монтана", NE: "Небраска", NV: "Невада", NH: "Нью-Гэмпшир", NJ: "Нью-Жерси", NM: "Нью-Мексико", NY: "Нью-Йорк", NC: "Хойд Каролина", ND: "Хойд Дакота", OH: "Огайо", OK: "Оклахома", OR: "Орегон", PA: "Пенсильвани", RI: "Род-Айленд", SC: "Өмнөд Каролина", SD: "Өмнөд Дакота", TN: "Теннесси", TX: "Техас", UT: "Юта", VT: "Вермонт", VA: "Виржиниа", WA: "Вашингтон", DC: "Вашингтон (ДС)", WV: "Баруун Виржиниа", WI: "Висконсин", WY: "Вайоминг" },
  kk: { AL: "Алабама", AK: "Аляска", AZ: "Аризона", AR: "Арканзас", CA: "Калифорния", CO: "Колорадо", CT: "Коннектикут", DE: "Делавэр", FL: "Флорида", GA: "Джорджия", HI: "Гавайи", ID: "Айдахо", IL: "Иллинойс", IN: "Индиана", IA: "Айова", KS: "Канзас", KY: "Кентукки", LA: "Луизиана", ME: "Мэн", MD: "Мэриленд", MA: "Массачусетс", MI: "Мичиган", MN: "Миннесота", MS: "Миссисипи", MO: "Миссури", MT: "Монтана", NE: "Небраска", NV: "Невада", NH: "Нью-Гэмпшир", NJ: "Нью-Джерси", NM: "Нью-Мексико", NY: "Нью-Йорк", NC: "Солтүстік Каролина", ND: "Солтүстік Дакота", OH: "Огайо", OK: "Оклахома", OR: "Орегон", PA: "Пенсильвания", RI: "Род-Айленд", SC: "Оңтүстік Каролина", SD: "Оңтүстік Дакота", TN: "Теннесси", TX: "Техас", UT: "Юта", VT: "Вермонт", VA: "Вирджиния", WA: "Вашингтон", DC: "Вашингтон (Колумбия округі)", WV: "Батыс Вирджиния", WI: "Висконсин", WY: "Вайоминг" },
  ky: { AL: "Алабама", AK: "Аляска", AZ: "Аризона", AR: "Арканзас", CA: "Калифорния", CO: "Колорадо", CT: "Коннектикут", DE: "Делавэр", FL: "Флорида", GA: "Джорджия", HI: "Гавайи", ID: "Айдахо", IL: "Иллинойс", IN: "Индиана", IA: "Айова", KS: "Канзас", KY: "Кентукки", LA: "Луизиана", ME: "Мэн", MD: "Мэриленд", MA: "Массачусетс", MI: "Мичиган", MN: "Миннесота", MS: "Миссисипи", MO: "Миссури", MT: "Монтана", NE: "Небраска", NV: "Невада", NH: "Нью-Гэмпшир", NJ: "Нью-Жерси", NM: "Нью-Мексико", NY: "Нью-Йорк", NC: "Түндүк Каролина", ND: "Түндүк Дакота", OH: "Огайо", OK: "Оклахома", OR: "Орегон", PA: "Пенсильвания", RI: "Род-Айленд", SC: "Түштүк Каролина", SD: "Түштүк Дакота", TN: "Теннесси", TX: "Техас", UT: "Юта", VT: "Вермонт", VA: "Вирджиния", WA: "Вашингтон", DC: "Вашингтон (Колумбия округу)", WV: "Батыш Вирджиния", WI: "Висконсин", WY: "Вайоминг" },
  ur: { AL: "الاباما", AK: "الاسکا", AZ: "ایریزونا", AR: "آرکنساس", CA: "کیلیفورنیا", CO: "کولوراڈو", CT: "کنیکٹیکٹ", DE: "ڈیلاویئر", FL: "فلوریڈا", GA: "جارجیا", HI: "ہوائی", ID: "آئیڈاہو", IL: "الینوائے", IN: "انڈیانا", IA: "آئیووا", KS: "کینساس", KY: "کینٹکی", LA: "لوزیانا", ME: "مین", MD: "میری لینڈ", MA: "میساچوسٹس", MI: "مشی گن", MN: "مینیسوٹا", MS: "مسیسیپی", MO: "میزوری", MT: "مونٹانا", NE: "نیبراسکا", NV: "نیواڈا", NH: "نیو ہیمپشائر", NJ: "نیو جرسی", NM: "نیو میکسیکو", NY: "نیویارک", NC: "شمالی کیرولائنا", ND: "شمالی ڈکوٹا", OH: "اوہائیو", OK: "اوکلاہوما", OR: "اوریگون", PA: "پنسلوانیا", RI: "رہوڈ آئی لینڈ", SC: "جنوبی کیرولائنا", SD: "جنوبی ڈکوٹا", TN: "ٹینیسی", TX: "ٹیکساس", UT: "یوٹاہ", VT: "ورمونٹ", VA: "ورجینیا", WA: "واشنگٹن", DC: "واشنگٹن ڈی سی", WV: "مغربی ورجینیا", WI: "وسکونسن", WY: "وائیومنگ" },
  bn: { AL: "আলাবামা", AK: "আলাস্কা", AZ: "অ্যারিজোনা", AR: "আরকানসাস", CA: "ক্যালিফোর্নিয়া", CO: "কলোরাডো", CT: "কানেকটিকাট", DE: "ডেলাওয়্যার", FL: "ফ্লোরিডা", GA: "জর্জিয়া", HI: "হাওয়াই", ID: "আইডাহো", IL: "ইলিনয়", IN: "ইন্ডিয়ানা", IA: "আইওয়া", KS: "ক্যানসাস", KY: "কেন্টাকি", LA: "লুইজিয়ানা", ME: "মেইন", MD: "মেরিল্যান্ড", MA: "ম্যাসাচুসেটস", MI: "মিশিগান", MN: "মিনেসোটা", MS: "মিসিসিপি", MO: "মিসৌরি", MT: "মন্টানা", NE: "নেব্রাস্কা", NV: "নেভাডা", NH: "নিউ হ্যাম্পশায়ার", NJ: "নিউ জার্সি", NM: "নিউ মেক্সিকো", NY: "নিউ ইয়র্ক", NC: "উত্তর ক্যারোলিনা", ND: "উত্তর ডাকোটা", OH: "ওহাইও", OK: "ওকলাহোমা", OR: "ওরেগন", PA: "পেনসিলভানিয়া", RI: "রোড আইল্যান্ড", SC: "দক্ষিণ ক্যারোলিনা", SD: "দক্ষিণ ডাকোটা", TN: "টেনেসি", TX: "টেক্সাস", UT: "উটাহ", VT: "ভারমন্ট", VA: "ভার্জিনিয়া", WA: "ওয়াশিংটন", DC: "ওয়াশিংটন ডিসি", WV: "পশ্চিম ভার্জিনিয়া", WI: "উইসকনসিন", WY: "ওয়াইওমিং" },
  lo: { AL: "ອາລາບາມາ", AK: "ອາລາສກາ", AZ: "ອາຣິໂຊນາ", AR: "ອາຄັນຊໍ", CA: "ແຄລິຟໍເນຍ", CO: "ໂຄໂລຣາໂດ", CT: "ຄອນເນັກທິຄັດ", DE: "ເດລາແວ", FL: "ຟລໍຣິດາ", GA: "ຈໍເຈຍ", HI: "ຮາວາຍ", ID: "ໄອດາໂຫ", IL: "ອິລລີນອຍ", IN: "ອິນດີອານາ", IA: "ໄອໂອວາ", KS: "ແຄນຊັດ", KY: "ເຄນທັກກີ", LA: "ລຸຍຊຽນາ", ME: "ເມນ", MD: "ແມຣີແລນ", MA: "ແມສຊາຈູເສດ", MI: "ມິຊິແກນ", MN: "ມິນນິໂຊຕາ", MS: "ມິສຊິສິປີ", MO: "ມິສຊູຣີ", MT: "ມອນທານາ", NE: "ເນແບຣັສກາ", NV: "ເນວາດາ", NH: "ນິວແຮມເຊີ", NJ: "ນິວເຈີຊີ", NM: "ນິວແມັກຊິໂກ", NY: "ນິວຢອກ", NC: "ນອກແຄໂຣໄລນາ", ND: "ນອກດາໂກຕາ", OH: "ໂອໄຮໂອ", OK: "ໂອກລາໂຮມາ", OR: "ໂອເຣກອນ", PA: "ເພັນຊິນເວເນຍ", RI: "ໂຣດໄອແລນ", SC: "ໃຕ້ແຄໂຣໄລນາ", SD: "ໃຕ້ດາໂກຕາ", TN: "ເທັນເນຊີ", TX: "ເທັກຊັດ", UT: "ຢູທາ", VT: "ເວີມອນ", VA: "ເວີຈິເນຍ", WA: "ວໍຊິງຕັນ", DC: "ວໍຊິງຕັນ ດີຊີ", WV: "ເວີຈິເນຍຕາເວັນຕົກ", WI: "ວິສຄອນຊິນ", WY: "ໄວໂອມິງ" },
  ja: { AL: "アラバマ", AK: "アラスカ", AZ: "アリゾナ", AR: "アーカンソー", CA: "カリフォルニア", CO: "コロラド", CT: "コネチカット", DE: "デラウェア", FL: "フロリダ", GA: "ジョージア", HI: "ハワイ", ID: "アイダホ", IL: "イリノイ", IN: "インディアナ", IA: "アイオワ", KS: "カンザス", KY: "ケンタッキー", LA: "ルイジアナ", ME: "メイン", MD: "メリーランド", MA: "マサチューセッツ", MI: "ミシガン", MN: "ミネソタ", MS: "ミシシッピ", MO: "ミズーリ", MT: "モンタナ", NE: "ネブラスカ", NV: "ネバダ", NH: "ニューハンプシャー", NJ: "ニュージャージー", NM: "ニューメキシコ", NY: "ニューヨーク", NC: "ノースカロライナ", ND: "ノースダコタ", OH: "オハイオ", OK: "オクラホマ", OR: "オレゴン", PA: "ペンシルベニア", RI: "ロードアイランド", SC: "サウスカロライナ", SD: "サウスダコタ", TN: "テネシー", TX: "テキサス", UT: "ユタ", VT: "バーモント", VA: "バージニア", WA: "ワシントン", DC: "ワシントンD.C.", WV: "ウェストバージニア", WI: "ウィスコンシン", WY: "ワイオミング" },
  ar: { AL: "ألاباما", AK: "ألاسكا", AZ: "أريزونا", AR: "أركنساس", CA: "كاليفورنيا", CO: "كولورادو", CT: "كونيتيكت", DE: "ديلاوير", FL: "فلوريدا", GA: "جورجيا", HI: "هاواي", ID: "أيداهو", IL: "إلينوي", IN: "إنديانا", IA: "آيوا", KS: "كانساس", KY: "كنتاكي", LA: "لويزيانا", ME: "مين", MD: "ماريلاند", MA: "ماساتشوستس", MI: "ميشيغن", MN: "مينيسوتا", MS: "ميسيسيبي", MO: "ميزوري", MT: "مونتانا", NE: "نبراسكا", NV: "نيفادا", NH: "نيوهامبشير", NJ: "نيوجيرسي", NM: "نيومكسيكو", NY: "نيويورك", NC: "كارولاينا الشمالية", ND: "داكوتا الشمالية", OH: "أوهايو", OK: "أوكلاهوما", OR: "أوريغون", PA: "بنسلفانيا", RI: "رود آيلاند", SC: "كارولاينا الجنوبية", SD: "داكوتا الجنوبية", TN: "تينيسي", TX: "تكساس", UT: "يوتا", VT: "فيرمونت", VA: "فيرجينيا", WA: "واشنطن", DC: "واشنطن العاصمة", WV: "فيرجينيا الغربية", WI: "ويسكونسن", WY: "وايومنغ" },
  hi: { AL: "अलबामा", AK: "अलास्का", AZ: "एरिज़ोना", AR: "अर्कांसस", CA: "कैलिफ़ोर्निया", CO: "कोलोराडो", CT: "कनेक्टिकट", DE: "डेलावेयर", FL: "फ़्लोरिडा", GA: "जॉर्जिया", HI: "हवाई", ID: "इडाहो", IL: "इलिनोइस", IN: "इंडियाना", IA: "आयोवा", KS: "कैनसस", KY: "केंटकी", LA: "लुइज़ियाना", ME: "मेन", MD: "मैरीलैंड", MA: "मैसाचुसेट्स", MI: "मिशिगन", MN: "मिनेसोटा", MS: "मिसिसिपी", MO: "मिसौरी", MT: "मोंटाना", NE: "नेब्रास्का", NV: "नेवादा", NH: "न्यू हैम्पशायर", NJ: "न्यू जर्सी", NM: "न्यू मेक्सिको", NY: "न्यूयॉर्क", NC: "उत्तरी कैरोलिना", ND: "उत्तरी डकोटा", OH: "ओहायो", OK: "ओक्लाहोमा", OR: "ओरेगन", PA: "पेंसिल्वेनिया", RI: "रोड आइलैंड", SC: "दक्षिणी कैरोलिना", SD: "दक्षिणी डकोटा", TN: "टेनेसी", TX: "टेक्सास", UT: "यूटा", VT: "वरमोंट", VA: "वर्जीनिया", WA: "वॉशिंगटन", DC: "वॉशिंगटन डी.सी.", WV: "पश्चिम वर्जीनिया", WI: "विस्कॉन्सिन", WY: "व्योमिंग" },
  fr: { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "Californie", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Floride", GA: "Géorgie", HI: "Hawaï", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiane", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "Nouveau-Mexique", NY: "New York", NC: "Caroline du Nord", ND: "Dakota du Nord", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvanie", RI: "Rhode Island", SC: "Caroline du Sud", SD: "Dakota du Sud", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginie", WA: "Washington", DC: "Washington D.C.", WV: "Virginie-Occidentale", WI: "Wisconsin", WY: "Wyoming" },
  tl: { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", DC: "Washington D.C.", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" },
};

// stateCode 하나를 받아서 위 STATE_DISPLAY_NAMES_MORE의 17개 언어 값을 꺼내 pickLang()의 more 인자로 바로 쓸 수 있는
// { lang: name } 객체를 만들어줌 — buildSameCountMore()와 동일한 패턴
function buildStateNameMore(stateCode){
  const more = {};
  Object.keys(STATE_DISPLAY_NAMES_MORE).forEach(lang => { more[lang] = STATE_DISPLAY_NAMES_MORE[lang][stateCode]; });
  return more;
}

// 2026년 종합소득세 누진세율표 (국세청 기준, 8단계) — 원(KRW) 단위
// 산출세액 = 과세표준 × 세율 - 누진공제액
const KOREA_TAX_BRACKETS = [
  { limit: 14000000,    rate: 0.06, deduction: 0 },
  { limit: 50000000,    rate: 0.15, deduction: 1260000 },
  { limit: 88000000,    rate: 0.24, deduction: 5760000 },
  { limit: 150000000,   rate: 0.35, deduction: 15440000 },
  { limit: 300000000,   rate: 0.38, deduction: 19940000 },
  { limit: 500000000,   rate: 0.40, deduction: 25940000 },
  { limit: 1000000000,  rate: 0.42, deduction: 35940000 },
  { limit: Infinity,    rate: 0.45, deduction: 65940000 },
];

function calcKoreaProgressiveTaxWon(wonAmount){
  for (const b of KOREA_TAX_BRACKETS) {
    if (wonAmount <= b.limit) return Math.max(wonAmount * b.rate - b.deduction, 0);
  }
  return 0;
}

// ⚠️ [향후 국가 확장 시 필독] 새 나라를 추가하는 건 그냥 옵션 하나 늘리는 게 아니라, 그 나라가
// 해외 복권 당첨금을 어떻게 과세하는지(자체 세율표 구조, 미국과의 조세조약 여부, 원천징수 상계 방식 등)를
// 처음부터 리서치해서 완전히 새로운 계산 분기를 만들어야 함. 실제 세법 데이터 없이 구조부터 짜면
// 잘못된 형태로 미리 만들 위험이 있어 데이터가 확정되기 전까진 손대지 않기로 결정함 (2026년 7월).
// 'cn' 분기는 이 원칙대로 공식 자료(개인소득세법 제3조·실시조례 제20조 등) 확인 후 추가함 (2026년 7월).
// 'in' 분기도 동일 원칙대로 공식 자료(소득세법 제115BB조/신법 제128조, 서차지 캡 등) 확인 후 추가함 (2026년 7월).
// currentLang에 따라 번역을 고름. zh가 없으면(2단계 미번역 구간) ko로 폴백.
// vi/th/ru는 호출부 전체가 이미 위치 인자로 다 채워져 있어 그대로 두고, 그 이후 추가되는 언어들은
// 위치 인자를 계속 늘리는 대신 마지막의 선택적 `more` 객체(예: {ar:'...', bn:'...'})로 전달함 —
// 이렇게 하면 새 언어를 추가해도 기존 660개+ 호출부를 전부 다시 고칠 필요가 없음. more에 없으면
// 영어로 폴백(한국어보다 국제 방문자에게 더 유용)
function pickLang(ko, en, zh, vi, th, ru, more){
  if (currentLang === 'zh') return zh || ko;
  if (currentLang === 'en') return en || ko;
  if (currentLang === 'vi') return vi || en || ko;
  if (currentLang === 'th') return th || en || ko;
  if (currentLang === 'ru') return ru || en || ko;
  if (currentLang && currentLang !== 'ko') {
    if (more && more[currentLang]) return more[currentLang];
    return en || ko;
  }
  return ko;
}

// USA Mega 같은 미국 세금 계산기 사이트의 "50개 주 전체 비교표" 벤치마킹 — 지금까지는
// 주(State)를 하나씩 골라야만 세율을 알 수 있었는데, 한 번에 나란히 비교할 수 있게 함.
// 접었을 때는 렌더링 안 해서(펼쳤을 때만 계산) 평소엔 화면이 지저분해지지 않게 함
function getStateLabel(code){
  return resolveI18n('state.name.' + code) || STATE_TAX_RATES[code].label;
}

function renderUsStateCompareTable(amountEok){
  const toggle = document.getElementById('usStateCompareToggle');
  const container = document.getElementById('usStateCompareTable');
  if (!toggle || !container || !toggle.open) return;
  const eok = amountEok !== undefined ? amountEok : ((sharedAmountUsd * EXCHANGE_RATE) / 100000000);
  const currentState = document.getElementById('homeStateSelect').value;
  const rows = Object.keys(STATE_TAX_RATES)
    .filter(code => code !== 'AVG')
    .map(code => {
      const r = calcTakeHome(eok, 'us', code);
      return { code, label: getStateLabel(code), rate: STATE_TAX_RATES[code].rate, final: r.final };
    })
    .sort((a, b) => b.final - a.final);
  container.innerHTML = rows.map(row => {
    const ratePct = (row.rate * 100).toFixed(row.rate * 100 % 1 === 0 ? 0 : 2);
    return `<div class="us-state-row${row.code === currentState ? ' is-current' : ''}"><span class="us-state-row-name">${row.label} <span class="us-state-row-rate">(${ratePct}%)</span></span><span class="us-state-row-amt">${formatWon(row.final)}</span></div>`;
  }).join('');
}

function calcTakeHome(amount, country, stateCode){
  if (country === 'us') {
    const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
    const afterUS = amount * (1 - TAX_MODEL.us_resident.federal);
    const final = amount * (1 - TAX_MODEL.us_resident.federal - stateInfo.rate);
    return {
      afterUS, final,
      label1: pickLang('미국 연방세', 'US Federal Tax', '美国联邦税', 'Thuế liên bang Mỹ', 'ภาษีกลางสหรัฐฯ', 'Федеральный налог США', US_FED_TAX_MORE), val1: '-' + (TAX_MODEL.us_resident.federal * 100) + '%',
      label2: pickLang(`${stateInfo.label} 주세`, `${stateInfo.labelEn} State Tax`, `${stateInfo.labelZh}州税`, `Thuế bang ${stateInfo.labelEn}`, `ภาษีมลรัฐ${stateInfo.labelEn}`, `Налог штата ${stateInfo.labelEn}`, {
        ar: `ضريبة ولاية ${stateInfo.labelEn}`, bn: `${stateInfo.labelEn} অঙ্গরাজ্য কর`, fr: `Impôt de l'État de ${stateInfo.labelEn}`,
        hi: `${stateInfo.labelEn} राज्य कर`, id: `Pajak Negara Bagian ${stateInfo.labelEn}`, ja: `${stateInfo.labelEn}州税`,
        kk: `${stateInfo.labelEn} штат салығы`, km: `ពន្ធរដ្ឋ ${stateInfo.labelEn}`, ky: `${stateInfo.labelEn} штат салыгы`,
        lo: `ພາສີລັດ ${stateInfo.labelEn}`, mn: `${stateInfo.labelEn} мужийн татвар`, my: `${stateInfo.labelEn} ပြည်နယ်အခွန်`,
        ne: `${stateInfo.labelEn} राज्य कर`, si: `${stateInfo.labelEn} ප්‍රාන්ත බද්ද`, tl: `Buwis ng Estado ng ${stateInfo.labelEn}`,
        ur: `${stateInfo.labelEn} ریاستی ٹیکس`, uz: `${stateInfo.labelEn} shtat solig'i`,
      }),
      val2: '-' + (stateInfo.rate * 100).toFixed(stateInfo.rate * 100 % 1 === 0 ? 0 : 2) + '%',
      basisSuffix: pickLang('미국 거주자', 'US resident', '美国居民', 'Cư dân Mỹ', 'ผู้พำนักในสหรัฐฯ', 'Резидент США', buildCountryMore('us'))
    };
  } else if (country === 'cn') {
    // 중국 개인소득세법 제3조: 복권 당첨(偶然所得)은 20% 단일세율. 실시조례 제20조 + 재정부세무총국공고
    // 2020년 제3호: 경외 우연소득은 경내 종합소득과 합산하지 않고 별도 계산(한국처럼 누진세율 구간 없음).
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const chinaCalculatedTaxWon = wonAmount * TAX_MODEL.cn_resident.incidental_income_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, chinaCalculatedTaxWon); // FTC 공제액(한도 내, 초과분은 5년 이월 가능하나 여기 반영 안 함)
    const chinaAdditionalTaxWon = Math.max(chinaCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (chinaAdditionalTaxWon / 100000000);
    const chinaEffectivePct = wonAmount > 0 ? (chinaAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('중국 추가 납부 (FTC 적용)', 'China additional tax (FTC applied)', '中国追加缴税（已抵免FTC）', 'Thuế bổ sung tại Trung Quốc (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของจีน (ใช้ FTC แล้ว)', 'Дополнительный налог в Китае (с учётом FTC)', buildAdditionalTaxMore('cn')),
      val2: chinaAdditionalTaxWon > 0 ? '-' + chinaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('중국 거주자', 'China resident', '中国居民', 'Cư dân Trung Quốc', 'ผู้พำนักในจีน', 'Резидент Китая', buildCountryMore('cn'))
    };
  } else if (country === 'in') {
    // 인도 소득세법 제115BB조(신법 제128조): 복권 당첨소득은 공제·면제 없이 30% 단일세율 + 4% 세스 +
    // 거액(총소득 5 crore 초과) 서차지 25%(신제도 최고 구간). 실효세율 = 30% × 1.25 × 1.04 = 39.00%.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const indiaEffectiveRate = TAX_MODEL.in_resident.base_rate * (1 + TAX_MODEL.in_resident.surcharge) * (1 + TAX_MODEL.in_resident.cess);
    const indiaCalculatedTaxWon = wonAmount * indiaEffectiveRate;
    const ftcCreditWon = Math.min(usWithholdingWon, indiaCalculatedTaxWon); // FTC 공제액(DTAA 기준, 한도 내 상계)
    const indiaAdditionalTaxWon = Math.max(indiaCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (indiaAdditionalTaxWon / 100000000);
    const indiaEffectivePct = wonAmount > 0 ? (indiaAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('인도 추가 납부 (FTC 적용)', 'India additional tax (FTC applied)', '印度追加缴税（已抵免FTC）', 'Thuế bổ sung tại Ấn Độ (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของอินเดีย (ใช้ FTC แล้ว)', 'Дополнительный налог в Индии (с учётом FTC)', buildAdditionalTaxMore('in')),
      val2: indiaAdditionalTaxWon > 0 ? '-' + indiaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('인도 거주자', 'India resident', '印度居民', 'Cư dân Ấn Độ', 'ผู้พำนักในอินเดีย', 'Резидент Индии', buildCountryMore('in'))
    };
  } else if (country === 'vn') {
    // 베트남 개인소득세법 시행규칙 Circular 111/2013/TT-BTC 제15조: 복권 등 상금(trúng thưởng) 소득 10% 단일세율.
    // FTC 근거: 같은 Circular 111/2013/TT-BTC 제26조 제2항 — 거주자가 해외에서 소득세를 낸 경우, 그
    // 세액을 베트남 세액 한도 내에서 공제(조세조약 존재 여부와 무관한 베트남 국내법상 일방적 공제).
    // (2026-07-19 정정: 앞서 "미국-베트남 조세조약 미발효라 FTC 근거 없음"으로 판단해 상계를 없앴었는데,
    // 이 조항이 국내법에 별도로 있다는 걸 재확인해 다시 상계를 반영함 — 미국-베트남 조세조약 자체는
    // 여전히 미발효 상태이지만, 이 FTC는 그 조약과 무관하게 적용됨.)
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const vnCalculatedTaxWon = wonAmount * TAX_MODEL.vn_resident.prize_income_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, vnCalculatedTaxWon); // FTC 공제액(조세조약 아닌 Circular 111/2013 제26조 2항 국내법 기준, 한도 내 상계)
    const vnAdditionalTaxWon = Math.max(vnCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (vnAdditionalTaxWon / 100000000);
    const vnEffectivePct = wonAmount > 0 ? (vnAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('베트남 추가 납부 (FTC 적용)', 'Vietnam additional tax (FTC applied)', '越南追加缴税（已抵免FTC）', 'Thuế bổ sung tại Việt Nam (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของเวียดนาม (ใช้ FTC แล้ว)', 'Дополнительный налог во Вьетнаме (с учётом FTC)', buildAdditionalTaxMore('vn')),
      val2: vnAdditionalTaxWon > 0 ? '-' + vnEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('베트남 거주자', 'Vietnam resident', '越南居民', 'Cư dân Việt Nam', 'ผู้พำนักในเวียดนาม', 'Резидент Вьетнама', buildCountryMore('vn'))
    };
  } else if (country === 'id') {
    // 인도네시아 정부령(PP) 132/2000 + 소득세법(PPh) 제4조 2항: 복권 당첨금(hadiah undian) 25% 단일 최종세율.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const idCalculatedTaxWon = wonAmount * TAX_MODEL.id_resident.lottery_final_tax_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, idCalculatedTaxWon); // FTC 공제액(DTA 기준, 한도 내 상계)
    const idAdditionalTaxWon = Math.max(idCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (idAdditionalTaxWon / 100000000);
    const idEffectivePct = wonAmount > 0 ? (idAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('인도네시아 추가 납부 (FTC 적용)', 'Indonesia additional tax (FTC applied)', '印尼追加缴税（已抵免FTC）', 'Thuế bổ sung tại Indonesia (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของอินโดนีเซีย (ใช้ FTC แล้ว)', 'Дополнительный налог в Индонезии (с учётом FTC)', buildAdditionalTaxMore('id')),
      val2: idAdditionalTaxWon > 0 ? '-' + idEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('인도네시아 거주자', 'Indonesia resident', '印尼居民', 'Cư dân Indonesia', 'ผู้พำนักในอินโดนีเซีย', 'Резидент Индонезии', buildCountryMore('id'))
    };
  } else if (country === 'ph') {
    // 필리핀: 해외 복권 당첨금은 종합소득에 합산돼 누진세율로 과세 — 잭팟 규모는 항상 최고구간(35%)이라 근사 적용.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const phCalculatedTaxWon = wonAmount * TAX_MODEL.ph_resident.approx_top_bracket_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, phCalculatedTaxWon); // FTC 공제액(DTA 기준, 한도 내 상계)
    const phAdditionalTaxWon = Math.max(phCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (phAdditionalTaxWon / 100000000);
    const phEffectivePct = wonAmount > 0 ? (phAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('필리핀 추가 납부 (FTC 적용, 근사치)', 'Philippines additional tax (FTC applied, approximate)', '菲律宾追加缴税（已抵免FTC，估算值）', 'Thuế bổ sung tại Philippines (đã áp dụng FTC, ước tính)', 'ภาษีเพิ่มเติมของฟิลิปปินส์ (ใช้ FTC แล้ว, ค่าประมาณ)', 'Дополнительный налог на Филиппинах (с учётом FTC, приблизительно)', buildAdditionalTaxMore('ph', 'approx')),
      val2: phAdditionalTaxWon > 0 ? '-' + phEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('필리핀 거주자', 'Philippines resident', '菲律宾居民', 'Cư dân Philippines', 'ผู้พำนักในฟิลิปปินส์', 'Резидент Филиппин', buildCountryMore('ph', 'approx'))
    };
  } else if (country === 'th') {
    // ⚠️ 태국: 해외 복권 당첨금에 대한 명확한 공식 과세 기준을 찾지 못해 최고세율(35%)로 추정 계산 —
    // 다른 나라와 달리 확정된 근거가 아니므로 UI에도 별도로 "추정치" 표시를 함께 함.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const thCalculatedTaxWon = wonAmount * TAX_MODEL.th_resident.unverified_approx_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, thCalculatedTaxWon); // FTC 공제액(추정, 한도 내 상계 가정)
    const thAdditionalTaxWon = Math.max(thCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (thAdditionalTaxWon / 100000000);
    const thEffectivePct = wonAmount > 0 ? (thAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('태국 추가 납부 (FTC 적용, 추정치 ⚠️)', 'Thailand additional tax (FTC applied, unverified estimate ⚠️)', '泰国追加缴税（已抵免FTC，估算值⚠️）', 'Thuế bổ sung tại Thái Lan (đã áp dụng FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของไทย (ใช้ FTC แล้ว, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Таиланде (с учётом FTC, неподтверждённая оценка ⚠️)', buildAdditionalTaxMore('th', 'estimate')),
      val2: thAdditionalTaxWon > 0 ? '-' + thEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('태국 거주자 (추정치 ⚠️)', 'Thailand resident (estimate ⚠️)', '泰国居民（估算值⚠️）', 'Cư dân Thái Lan (ước tính ⚠️)', 'ผู้พำนักในไทย (ค่าประมาณ ⚠️)', 'Резидент Таиланда (оценка ⚠️)', buildCountryMore('th', 'estimate'))
    };
  } else if (country === 'jp') {
    // 일본: 해외 복권은 「일시소득」으로 과세, 1/2 포함 후 최고 실효세율(55.945%)로 근사.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const jpCalculatedTaxWon = wonAmount * TAX_MODEL.jp_resident.half_inclusion_top_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, jpCalculatedTaxWon);
    const jpAdditionalTaxWon = Math.max(jpCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (jpAdditionalTaxWon / 100000000);
    const jpEffectivePct = wonAmount > 0 ? (jpAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('일본 추가 납부 (FTC 적용, 미국측 조약 면제 가능 ⚠️)', 'Japan additional tax (FTC applied, possible US treaty exemption ⚠️)', '日本追加缴税（已抵免FTC，美方或有条约免税 ⚠️）', 'Thuế bổ sung tại Nhật Bản (đã áp dụng FTC, có thể được miễn thuế Mỹ theo hiệp định ⚠️)', 'ภาษีเพิ่มเติมของญี่ปุ่น (ใช้ FTC แล้ว, ฝั่งสหรัฐฯ อาจได้รับยกเว้นตามสนธิสัญญา ⚠️)', 'Дополнительный налог в Японии (с учётом FTC, возможно освобождение от налога США по договору ⚠️)', buildAdditionalTaxMore('jp', 'treatyMayExempt')),
      val2: jpAdditionalTaxWon > 0 ? '-' + jpEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('일본 거주자 (조약 면제 가능 ⚠️)', 'Japan resident (possible treaty exemption ⚠️)', '日本居民（或有条约免税 ⚠️）', 'Cư dân Nhật Bản (có thể được miễn theo hiệp định ⚠️)', 'ผู้พำนักในญี่ปุ่น (อาจได้รับยกเว้นตามสนธิสัญญา ⚠️)', 'Резидент Японии (возможно освобождение по договору ⚠️)', buildCountryMore('jp', 'treatyMayExempt'))
    };
  } else if (country === 'ru') {
    // 러시아: 해외 복권은 국내 판촉경품용 35% 특별세율이 아니라 일반 누진세 최고구간(22%) 적용.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const ruCalculatedTaxWon = wonAmount * TAX_MODEL.ru_resident.top_bracket_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, ruCalculatedTaxWon);
    const ruAdditionalTaxWon = Math.max(ruCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (ruAdditionalTaxWon / 100000000);
    const ruEffectivePct = wonAmount > 0 ? (ruAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('러시아 추가 납부 (FTC 적용, 조약 정지로 불확실 ⚠️)', 'Russia additional tax (FTC applied, uncertain due to suspended treaty ⚠️)', '俄罗斯追加缴税（已抵免FTC，条约暂停致不确定⚠️）', 'Thuế bổ sung tại Nga (đã áp dụng FTC, không chắc do hiệp định bị đình chỉ ⚠️)', 'ภาษีเพิ่มเติมของรัสเซีย (ใช้ FTC แล้ว, ไม่แน่นอนจากสนธิสัญญาที่ระงับ ⚠️)', 'Дополнительный налог в России (с учётом FTC, неопределённость из-за приостановки договора ⚠️)', buildAdditionalTaxMore('ru', 'treatySuspended')),
      val2: ruAdditionalTaxWon > 0 ? '-' + ruEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('러시아 거주자 (조약 정지 ⚠️)', 'Russia resident (treaty suspended ⚠️)', '俄罗斯居民（条约暂停⚠️）', 'Cư dân Nga (hiệp định bị đình chỉ ⚠️)', 'ผู้พำนักในรัสเซีย (สนธิสัญญาระงับ ⚠️)', 'Резидент России (договор приостановлен ⚠️)', buildCountryMore('ru', 'treatySuspended'))
    };
  } else if (country === 'np') {
    // 네팔: 「우발이득」(복권·증여·상금) 25% 단일 최종세율.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const npCalculatedTaxWon = wonAmount * TAX_MODEL.np_resident.windfall_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, npCalculatedTaxWon);
    const npAdditionalTaxWon = Math.max(npCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (npAdditionalTaxWon / 100000000);
    const npEffectivePct = wonAmount > 0 ? (npAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('네팔 추가 납부 (FTC 적용)', 'Nepal additional tax (FTC applied)', '尼泊尔追加缴税（已抵免FTC）', 'Thuế bổ sung tại Nepal (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของเนปาล (ใช้ FTC แล้ว)', 'Дополнительный налог в Непале (с учётом FTC)', buildAdditionalTaxMore('np')),
      val2: npAdditionalTaxWon > 0 ? '-' + npEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('네팔 거주자', 'Nepal resident', '尼泊尔居民', 'Cư dân Nepal', 'ผู้พำนักในเนปาล', 'Резидент Непала', buildCountryMore('np'))
    };
  } else if (country === 'lk') {
    // ⚠️ 스리랑카: 해외 복권 당첨금은 일반 누진세율(최고 36%)로 직접 신고 — 단, 2025년 신설된 해외소득
    // 은행송금 15% 우대세율이 복권 같은 우발이득에도 적용되는지 불확실해 더 안전한 36%를 유지함.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const lkCalculatedTaxWon = wonAmount * TAX_MODEL.lk_resident.top_bracket_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, lkCalculatedTaxWon);
    const lkAdditionalTaxWon = Math.max(lkCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (lkAdditionalTaxWon / 100000000);
    const lkEffectivePct = wonAmount > 0 ? (lkAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('스리랑카 추가 납부 (FTC 적용, 추정치 ⚠️)', 'Sri Lanka additional tax (FTC applied, unverified estimate ⚠️)', '斯里兰卡追加缴税（已抵免FTC，估算值⚠️）', 'Thuế bổ sung tại Sri Lanka (đã áp dụng FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของศรีลังกา (ใช้ FTC แล้ว, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Шри-Ланке (с учётом FTC, неподтверждённая оценка ⚠️)', buildAdditionalTaxMore('lk', 'estimate')),
      val2: lkAdditionalTaxWon > 0 ? '-' + lkEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('스리랑카 거주자', 'Sri Lanka resident', '斯里兰卡居民', 'Cư dân Sri Lanka', 'ผู้พำนักในศรีลังกา', 'Резидент Шри-Ланки', buildCountryMore('lk', 'approx'))
    };
  } else if (country === 'uz') {
    // 우즈베키스탄: 모든 개인소득에 단일 12% 세율.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const uzCalculatedTaxWon = wonAmount * TAX_MODEL.uz_resident.flat_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, uzCalculatedTaxWon);
    const uzAdditionalTaxWon = Math.max(uzCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (uzAdditionalTaxWon / 100000000);
    const uzEffectivePct = wonAmount > 0 ? (uzAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('우즈베키스탄 추가 납부 (FTC 적용)', 'Uzbekistan additional tax (FTC applied)', '乌兹别克斯坦追加缴税（已抵免FTC）', 'Thuế bổ sung tại Uzbekistan (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของอุซเบกิสถาน (ใช้ FTC แล้ว)', 'Дополнительный налог в Узбекистане (с учётом FTC)', buildAdditionalTaxMore('uz')),
      val2: uzAdditionalTaxWon > 0 ? '-' + uzEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('우즈베키스탄 거주자', 'Uzbekistan resident', '乌兹别克斯坦居民', 'Cư dân Uzbekistan', 'ผู้พำนักในอุซเบกิสถาน', 'Резидент Узбекистана', buildCountryMore('uz'))
    };
  } else if (country === 'kz') {
    // 카자흐스탄: "당첨금"(выигрыш) 카테고리에 거주자 기준 10% 단일세율.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const kzCalculatedTaxWon = wonAmount * TAX_MODEL.kz_resident.winnings_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, kzCalculatedTaxWon);
    const kzAdditionalTaxWon = Math.max(kzCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (kzAdditionalTaxWon / 100000000);
    const kzEffectivePct = wonAmount > 0 ? (kzAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('카자흐스탄 추가 납부 (FTC 적용)', 'Kazakhstan additional tax (FTC applied)', '哈萨克斯坦追加缴税（已抵免FTC）', 'Thuế bổ sung tại Kazakhstan (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของคาซัคสถาน (ใช้ FTC แล้ว)', 'Дополнительный налог в Казахстане (с учётом FTC)', buildAdditionalTaxMore('kz')),
      val2: kzAdditionalTaxWon > 0 ? '-' + kzEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('카자흐스탄 거주자', 'Kazakhstan resident', '哈萨克斯坦居民', 'Cư dân Kazakhstan', 'ผู้พำนักในคาซัคสถาน', 'Резидент Казахстана', buildCountryMore('kz'))
    };
  } else if (country === 'kg') {
    // 키르기스스탄: 당첨금 포함 모든 개인소득에 단일 10% 세율.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const kgCalculatedTaxWon = wonAmount * TAX_MODEL.kg_resident.flat_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, kgCalculatedTaxWon);
    const kgAdditionalTaxWon = Math.max(kgCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (kgAdditionalTaxWon / 100000000);
    const kgEffectivePct = wonAmount > 0 ? (kgAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('키르기스스탄 추가 납부 (FTC 적용)', 'Kyrgyzstan additional tax (FTC applied)', '吉尔吉斯斯坦追加缴税（已抵免FTC）', 'Thuế bổ sung tại Kyrgyzstan (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของคีร์กีซสถาน (ใช้ FTC แล้ว)', 'Дополнительный налог в Кыргызстане (с учётом FTC)', buildAdditionalTaxMore('kg')),
      val2: kgAdditionalTaxWon > 0 ? '-' + kgEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('키르기스스탄 거주자', 'Kyrgyzstan resident', '吉尔吉斯斯坦居民', 'Cư dân Kyrgyzstan', 'ผู้พำนักในคีร์กีซสถาน', 'Резидент Кыргызстана', buildCountryMore('kg'))
    };
  } else if (country === 'mm') {
    // 미얀마: 해외 복권 당첨금은 "기타 소득"으로 분류돼 누진세율(최고 25%) 적용.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const mmCalculatedTaxWon = wonAmount * TAX_MODEL.mm_resident.top_bracket_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, mmCalculatedTaxWon);
    const mmAdditionalTaxWon = Math.max(mmCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (mmAdditionalTaxWon / 100000000);
    const mmEffectivePct = wonAmount > 0 ? (mmAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('미얀마 추가 납부 (FTC 적용, 근사치)', 'Myanmar additional tax (FTC applied, approximate)', '缅甸追加缴税（已抵免FTC，估算值）', 'Thuế bổ sung tại Myanmar (đã áp dụng FTC, ước tính)', 'ภาษีเพิ่มเติมของเมียนมา (ใช้ FTC แล้ว, ค่าประมาณ)', 'Дополнительный налог в Мьянме (с учётом FTC, приблизительно)', buildAdditionalTaxMore('mm', 'approx')),
      val2: mmAdditionalTaxWon > 0 ? '-' + mmEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('미얀마 거주자', 'Myanmar resident', '缅甸居民', 'Cư dân Myanmar', 'ผู้พำนักในเมียนมา', 'Резидент Мьянмы', buildCountryMore('mm', 'approx'))
    };
  } else if (country === 'bd') {
    // 방글라데시: 복권 등 당첨소득은 "기타 소득"으로 25% 단일세율.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const bdCalculatedTaxWon = wonAmount * TAX_MODEL.bd_resident.flat_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, bdCalculatedTaxWon);
    const bdAdditionalTaxWon = Math.max(bdCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (bdAdditionalTaxWon / 100000000);
    const bdEffectivePct = wonAmount > 0 ? (bdAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('방글라데시 추가 납부 (FTC 적용)', 'Bangladesh additional tax (FTC applied)', '孟加拉国追加缴税（已抵免FTC）', 'Thuế bổ sung tại Bangladesh (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของบังกลาเทศ (ใช้ FTC แล้ว)', 'Дополнительный налог в Бангладеш (с учётом FTC)', buildAdditionalTaxMore('bd')),
      val2: bdAdditionalTaxWon > 0 ? '-' + bdEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('방글라데시 거주자', 'Bangladesh resident', '孟加拉国居民', 'Cư dân Bangladesh', 'ผู้พำนักในบังกลาเทศ', 'Резидент Бангладеш', buildCountryMore('bd'))
    };
  } else if (country === 'pk') {
    // ⚠️ 파키스탄: 복권 원천징수 규정(20~40%)이 자국 지급기관 전제라 적용 여부 불명확 — 일반 소득세
    // 최고구간(35%)으로 추정. 여기에 더해 Super Tax(제4C조, 소득 기준 「Finance Act 2026」 시행
    // 8%)와 서차지(산출세액 기준 10%)가 이 계산기가 다루는 잭팟 규모에서는 사실상 항상 같이 적용됨
    // — GPT/Gemini 교차검증 결과 반영(2026-07-19), Super Tax 세율은 2026-07-20 후속 검증에서
    // 8%로 갱신. FTC(외국납부세액공제)는 미국 원천징수분을 기본세(35%)에서만 상계하고, Super
    // Tax·서차지는 조세조약상 별도 국내세로 간주해 FTC 상계 대상에서 제외함(더 안전한 쪽으로
    // 추정 — 실제로 상계 가능하다면 사용자가 실제 내는 세금은 이보다 적을 수 있음).
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const pkBaseTaxWon = wonAmount * TAX_MODEL.pk_resident.unverified_approx_rate;
    const pkSuperTaxWon = wonAmount * TAX_MODEL.pk_resident.super_tax_top_rate;
    const pkSurchargeWon = pkBaseTaxWon * TAX_MODEL.pk_resident.surcharge_on_tax_rate;
    const pkCalculatedTaxWon = pkBaseTaxWon + pkSuperTaxWon + pkSurchargeWon;
    const ftcCreditWon = Math.min(usWithholdingWon, pkBaseTaxWon);
    const pkAdditionalTaxWon = Math.max(pkCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (pkAdditionalTaxWon / 100000000);
    const pkEffectivePct = wonAmount > 0 ? (pkAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('파키스탄 추가 납부 (FTC 적용, 추정치 ⚠️)', 'Pakistan additional tax (FTC applied, unverified estimate ⚠️)', '巴基斯坦追加缴税（已抵免FTC，估算值⚠️）', 'Thuế bổ sung tại Pakistan (đã áp dụng FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของปากีสถาน (ใช้ FTC แล้ว, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Пакистане (с учётом FTC, неподтверждённая оценка ⚠️)', buildAdditionalTaxMore('pk', 'estimate')),
      val2: pkAdditionalTaxWon > 0 ? '-' + pkEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('파키스탄 거주자 (추정치 ⚠️)', 'Pakistan resident (estimate ⚠️)', '巴基斯坦居民（估算值⚠️）', 'Cư dân Pakistan (ước tính ⚠️)', 'ผู้พำนักในปากีสถาน (ค่าประมาณ ⚠️)', 'Резидент Пакистана (оценка ⚠️)', buildCountryMore('pk', 'estimate'))
    };
  } else if (country === 'kh') {
    // ⚠️ 캄보디아: 개인 복권·상금 소득을 과세하는 명확한 조항을 찾지 못해 추가세 0으로 가정.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const khCalculatedTaxWon = wonAmount * TAX_MODEL.kh_resident.unverified_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, khCalculatedTaxWon);
    const khAdditionalTaxWon = Math.max(khCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (khAdditionalTaxWon / 100000000);
    const khEffectivePct = wonAmount > 0 ? (khAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('캄보디아 추가 납부 (근거 불명확 ⚠️)', 'Cambodia additional tax (no clear basis found ⚠️)', '柬埔寨追加缴税（依据不明⚠️）', 'Thuế bổ sung tại Campuchia (chưa rõ căn cứ ⚠️)', 'ภาษีเพิ่มเติมของกัมพูชา (ไม่พบหลักเกณฑ์ชัดเจน ⚠️)', 'Дополнительный налог в Камбодже (основание неясно ⚠️)', buildAdditionalTaxMore('kh', null, true)),
      val2: khAdditionalTaxWon > 0 ? '-' + khEffectivePct.toFixed(1) + '%' : pickLang('0원 (근거 불명확 ⚠️)', '₩0 (no clear basis found ⚠️)', '0元（依据不明⚠️）', '0 KRW (chưa rõ căn cứ ⚠️)', '0 วอน (ไม่พบหลักเกณฑ์ชัดเจน ⚠️)', '0 вон (основание неясно ⚠️)', ZERO_UNCLEAR_MORE),
      basisSuffix: pickLang('캄보디아 거주자 (추정치 ⚠️)', 'Cambodia resident (estimate ⚠️)', '柬埔寨居民（估算值⚠️）', 'Cư dân Campuchia (ước tính ⚠️)', 'ผู้พำนักในกัมพูชา (ค่าประมาณ ⚠️)', 'Резидент Камбоджи (оценка ⚠️)', buildCountryMore('kh', 'estimate'))
    };
  } else if (country === 'mn') {
    // ⚠️ 몽골: 예전 베팅·도박성 당첨금 40% 조항은 2025년 국내 베팅업 전면 금지 입법 때 함께 폐지됨 확인.
    // 해외 복권 당첨금에 대한 명시 조항이 없어, 기타소득에 적용되는 일반 단일세율 10%를 추정치로 사용.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const mnCalculatedTaxWon = wonAmount * TAX_MODEL.mn_resident.unverified_approx_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, mnCalculatedTaxWon);
    const mnAdditionalTaxWon = Math.max(mnCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (mnAdditionalTaxWon / 100000000);
    const mnEffectivePct = wonAmount > 0 ? (mnAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('몽골 추가 납부 (FTC 적용, 추정치 ⚠️)', 'Mongolia additional tax (FTC applied, unverified estimate ⚠️)', '蒙古追加缴税（已抵免FTC，估算值⚠️）', 'Thuế bổ sung tại Mông Cổ (đã áp dụng FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของมองโกเลีย (ใช้ FTC แล้ว, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Монголии (с учётом FTC, неподтверждённая оценка ⚠️)', buildAdditionalTaxMore('mn', 'estimate')),
      val2: mnAdditionalTaxWon > 0 ? '-' + mnEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('몽골 거주자 (추정치 ⚠️)', 'Mongolia resident (estimate ⚠️)', '蒙古居民（估算值⚠️）', 'Cư dân Mông Cổ (ước tính ⚠️)', 'ผู้พำนักในมองโกเลีย (ค่าประมาณ ⚠️)', 'Резидент Монголии (оценка ⚠️)', buildCountryMore('mn', 'estimate'))
    };
  } else if (country === 'la') {
    // ⚠️ 라오스: 2026년 7월 시행 신설법 5% — 미국과 조세조약이 없어 FTC(세액공제) 적용 안 됨(전액 추가 부담).
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const laAdditionalTaxWon = wonAmount * TAX_MODEL.la_resident.unverified_rate; // FTC 없음 — 원천징수와 별개로 전액 추가
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (laAdditionalTaxWon / 100000000);
    const laEffectivePct = wonAmount > 0 ? (laAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('라오스 추가 납부 (FTC 없음, 추정치 ⚠️)', 'Laos additional tax (no FTC, unverified estimate ⚠️)', '老挝追加缴税（无FTC抵免，估算值⚠️）', 'Thuế bổ sung tại Lào (không có FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของลาว (ไม่มี FTC, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Лаосе (без FTC, неподтверждённая оценка ⚠️)', {
        km: 'ពន្ធបន្ថែមនៅឡាវ (គ្មាន FTC ប៉ាន់ស្មាន ⚠️)', ne: 'लाओसमा थप कर (FTC छैन, अनुमानित ⚠️)', id: 'Pajak tambahan di Laos (tanpa FTC, perkiraan ⚠️)',
        my: 'လာအိုတွင်ထပ်ဆောင်းအခွန် (FTC မရှိ၊ ခန့်မှန်း ⚠️)', si: 'ලාඕසයේ අමතර බද්ද (FTC නැත, ඇස්තමේන්තුගත ⚠️)', uz: "Laosda qo'shimcha soliq (FTC yo'q, taxminiy ⚠️)",
        mn: 'Лаост нэмэлт татвар (FTC байхгүй, тооцоо ⚠️)', kk: 'Лаоста қосымша салық (FTC жоқ, болжам ⚠️)', ky: 'Лаоста кошумча салык (FTC жок, болжол ⚠️)',
        ur: 'لاؤس میں اضافی ٹیکس (کوئی FTC نہیں، تخمینی ⚠️)', bn: 'লাওসে অতিরিক্ত কর (FTC নেই, আনুমানিক ⚠️)', lo: 'ພາສີເພີ່ມເຕີມໃນລາວ (ບໍ່ມີ FTC, ຄາດຄະເນ ⚠️)',
        ja: 'ラオスでの追加納税（FTCなし、推定 ⚠️）', ar: 'ضريبة إضافية في لاوس (بدون FTC، تقديري ⚠️)', hi: 'लाओस में अतिरिक्त कर (कोई FTC नहीं, अनुमानित ⚠️)', fr: 'Taxe supplémentaire au Laos (sans FTC, estimation ⚠️)',
        tl: 'Karagdagang buwis sa Laos (walang FTC, hindi pa nakumpirmang tantiya ⚠️)',
      }),
      val2: laAdditionalTaxWon > 0 ? '-' + laEffectivePct.toFixed(1) + '%' : pickLang('0원', '₩0', '0元', '0 KRW', '0 วอน', '0 вон', { km:'0 វอน', ne:'₩0', id:'₩0', my:'၀ ဝမ်း', si:'0 වොන්', uz:'0 von', mn:'0 вон', kk:'0 вон', ky:'0 вон', ur:'0 وون', bn:'০ ওন', lo:'0 ວອນ', ja:'0ウォン', ar:'0 وون', hi:'₩0', fr:'0 KRW', tl:'₩0' }),
      basisSuffix: pickLang('라오스 거주자 (추정치 ⚠️)', 'Laos resident (estimate ⚠️)', '老挝居民（估算值⚠️）', 'Cư dân Lào (ước tính ⚠️)', 'ผู้พำนักในลาว (ค่าประมาณ ⚠️)', 'Резидент Лаоса (оценка ⚠️)', buildCountryMore('la', 'estimate'))
    };
  } else {
    // 2026-07 국세청 인터넷 상담 답변 기준: 미국 복권은 「복권 및 복권기금법」상 복권이 아니라
    // 무조건 분리과세 대상이 아니며, 종합소득세(누진세율)에 합산 신고. 외국납부세액공제(FTC)로 이중과세 조정.
    // (당첨소득 외 다른 국내 종합소득이 없다고 가정 — 이 경우 FTC 공제한도 ≈ 산출세액 전체에 근접)
    const wonAmount = amount * 100000000; // 억원 -> 원
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const koreaCalculatedTaxWon = calcKoreaProgressiveTaxWon(wonAmount); // 종합소득세 산출세액(국세, FTC 적용 전)
    const ftcCreditWon = Math.min(usWithholdingWon, koreaCalculatedTaxWon); // FTC 공제액(한도 내)
    const koreaAdditionalNationalTaxWon = Math.max(koreaCalculatedTaxWon - ftcCreditWon, 0); // FTC 적용 후 한국에 추가 납부할 국세
    const koreaLocalTaxWon = koreaAdditionalNationalTaxWon * 0.1; // 지방소득세(국세의 10%)
    const koreaTotalTaxWon = koreaAdditionalNationalTaxWon + koreaLocalTaxWon;

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (koreaTotalTaxWon / 100000000);
    const koreaEffectivePct = wonAmount > 0 ? (koreaTotalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)', US_FED_TAX_NONRESIDENT_MORE), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('한국 추가 납부 (FTC 적용)', 'Korea additional tax (FTC applied)', '韩国追加缴税（已抵免FTC）', 'Thuế bổ sung tại Hàn Quốc (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของเกาหลี (ใช้ FTC แล้ว)', 'Дополнительный налог в Корее (с учётом FTC)', buildAdditionalTaxMore('kr')),
      val2: koreaAdditionalNationalTaxWon > 0 ? '-' + koreaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)', ZERO_OFFSET_MORE),
      basisSuffix: pickLang('한국 거주자', 'Korea resident', '韩国居民', 'Cư dân Hàn Quốc', 'ผู้พำนักในเกาหลี', 'Резидент Кореи', buildCountryMore('kr'))
    };
  }
}

async function submitContactForm(e){
  e.preventDefault();
  const form = document.getElementById('contactForm');
  const successMsg = document.getElementById('contactSuccessMsg');
  const errorMsg = document.getElementById('contactErrorMsg');
  successMsg.style.display = 'none';
  errorMsg.style.display = 'none';

  const formData = new FormData(form);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000); // 12초 안에 응답 없으면 타임아웃 처리 (무한 로딩 방지)
    const response = await fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (response.ok) {
      successMsg.style.display = 'block';
      form.reset();
    } else {
      errorMsg.style.display = 'block';
    }
  } catch (err) {
    errorMsg.style.display = 'block';
  }
  return false;
}

// 브라우저 탭 제목 — 뷰가 바뀔 때(go())뿐 아니라 같은 화면에 머문 채로 언어만 바꿀 때도
// (applyTranslations()) 항상 현재 언어로 다시 반영해야 함. 예전엔 go()에서만, 그것도 한국어
// 문구로 고정 세팅해서 영어·중국어로 보고 있어도 화면 전환마다 탭 제목이 한국어로 돌아가던 버그가 있었음
const PAGE_TITLES = {
  home: { ko: '미국 복권 세금 계산기 | 참택스 - 미국 파워볼·메가밀리언즈 실수령액', en: 'US Lottery Tax Calculator | ChamTax — Powerball & Mega Millions Take-Home', zh: '美国彩票税金计算器 | ChamTax — 强力球·超级百万实得金额' },
  compare: { ko: '미국 복권 이중과세·국가별 실수령액 비교 | 참택스', en: 'US Lottery Double Taxation & Country Comparison | ChamTax', zh: '美国彩票双重征税·各国实得金额对比 | ChamTax' },
  odds: { ko: '미국 파워볼 당첨 확률 체감 | 참택스', en: 'US Powerball Odds, Visualized | ChamTax', zh: '美国强力球中奖概率体验 | ChamTax' },
  faq: { ko: '미국 복권 세금 FAQ - 이중과세·원천징수 | 참택스', en: 'US Lottery Tax FAQ — Double Taxation & Withholding | ChamTax', zh: '美国彩票税金FAQ — 双重征税·预扣税 | ChamTax' },
  privacy: { ko: '개인정보처리방침 | 참택스', en: 'Privacy Policy | ChamTax', zh: '隐私政策 | ChamTax' },
  disclaimer: { ko: '면책조항 | 참택스', en: 'Disclaimer | ChamTax', zh: '免责声明 | ChamTax' },
  contact: { ko: '문의하기 | 참택스', en: 'Contact | ChamTax', zh: '联系我们 | ChamTax' }
};

function applyCurrentViewTitle(view){
  const entry = PAGE_TITLES[view];
  if (!entry) return;
  document.title = entry[currentLang] || entry.ko;
}

function go(view){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.getElementById('view-' + view).classList.add('on');
  setupRevealAnimation();
  document.getElementById('nav-compare').classList.toggle('active', view === 'compare');
  document.getElementById('nav-odds').classList.toggle('active', view === 'odds');
  document.getElementById('nav-faq').classList.toggle('active', view === 'faq');
  applyCurrentViewTitle(view);

  // 홈 ↔ 국가비교 이동 시, 어느 쪽에서 왔든 상관없이 항상 공용 상태(sharedAmountUsd/sharedCountry/EXCHANGE_RATE)를
  // 기준으로 화면을 다시 그려서 입력값·환율이 끊기지 않게 함
  if (view === 'home') {
    syncHomeFromShared();
    // 다른 페이지에서 언어를 전환한 뒤 홈으로 돌아오는 경우에도 잭팟 패널·추첨 카운트다운이
    // 항상 현재 언어로 보이도록 재적용 (언어 전환 시점에 홈 화면이 아니면 안 갱신되던 문제)
    applyJackpotData();
    updateDrawCountdown();
    setupStickyResultBadge();
  } else {
    // 홈이 아닌 다른 탭으로 이동하면, IntersectionObserver 콜백이 아직 안 돌았어도
    // 즉시 숨겨서 다른 화면에 실수령액 배지가 잠깐이라도 겹쳐 보이지 않게 함
    const badge = document.getElementById('sticky-result-badge');
    if (badge) badge.classList.remove('is-visible');
  }
  if (view === 'compare') {
    syncCompareFromShared();
  } else if (view === 'faq') {
    // 국가 토글을 한 번도 안 건드린 상태로 FAQ 탭을 바로 누르면 filterFaq()가 아직 한 번도
    // 실행된 적이 없어서, 세금 기준(kr/us/cn)과 무관한 질문까지 전부 보이던 버그가 있었음
    filterFaq();
  } else if (view === 'odds') {
    renderOddsTabDataWhenReady();
  }

  document.querySelector('.page').scrollIntoView({behavior:'smooth', block:'start'});
}

// 확률체감 탭 전용 대용량 데이터(파워볼/메가밀리언즈 역대 당첨번호·잭팟 아카이브, odds-data.js)는
// 홈/비교/FAQ만 보는 방문자에겐 필요 없어서, 이 탭을 처음 열 때만 받아오도록 지연 로드함
// (2026-07-22 성능 개선 — 이 데이터가 script.js 전체 용량의 상당 부분을 차지했음). 로드 전에도
// renderJackpotHistory() 등은 안전하게 호출될 수 있고(각 함수가 데이터 미로드 시 조용히 스킵),
// 로드가 끝나면 여기서 다시 호출해 실제로 채움
let _oddsDataLoadPromise = null;
function ensureOddsDataLoaded(){
  if (_oddsDataLoadPromise) return _oddsDataLoadPromise;
  _oddsDataLoadPromise = new Promise((resolve, reject) => {
    if (typeof JACKPOT_HISTORY !== 'undefined') { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'odds-data.js?v=20260723';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('odds-data.js failed to load'));
    document.head.appendChild(script);
  });
  return _oddsDataLoadPromise;
}

function renderOddsTabDataWhenReady(){
  ensureOddsDataLoaded().then(() => {
    renderJackpotHistory();
    renderJackpotTakeHomeRanking();
    renderNumberFrequencyStats();
  }).catch(err => console.error('[odds-data]', err));
}

// "나는 어떤 경우일까요?" 안내 배너에서 "한국에 살아요" 카드를 누르면, 배너를 접고
// 바로 아래 입력창으로 스크롤해줌 — 이미 홈 화면에 있으니 페이지 이동은 필요 없음
function goToCalculatorInput(){
  const accordion = document.getElementById('introPersonaAccordion');
  if (accordion) accordion.open = false;
  const inputCard = document.querySelector('.input-card');
  if (inputCard) inputCard.scrollIntoView({behavior:'smooth', block:'start'});
}

// "실제로 다른 나라에 살아요" 카드의 US/CN 버튼 — 한국이랑 아무 상관없는 진짜 외국인(예: 순수
// 미국인·중국인)을 위한 원클릭 진입점. 언어와 세금 기준을 그 나라에 맞게 한 번에 맞춰주고
// 계산기로 스크롤함 — 이게 없으면 한국어 화면만 보고 이탈할 위험이 있었음
function goToRealAbroad(country, lang){
  setLanguage(lang, true);
  setHomeCountry(country);
  goToCalculatorInput();
}

// 언어/국가 버튼 그리드를 드롭다운으로 압축한 UI용 — 선택된 <option>의 value를 보고
// 언어 전환(setLanguage) 또는 별도 페이지 이동(location.href) 중 하나로 분기
function goWithLangSelect(selectId){
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const val = sel.value;
  if (val.startsWith('href:')) {
    location.href = val.slice(5);
  } else {
    setLanguage(val, true);
    goToCalculatorInput();
  }
}

// "다른 나라에 살아요" 드롭다운(국가|언어 값)을 goToRealAbroad로 연결
function goRealAbroadFromSelect(selectId){
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const [country, lang] = sel.value.split('|');
  goToRealAbroad(country, lang);
}

function formatAbbreviatedUsd(value){
  if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(0) + 'M';
  return Math.round(value).toLocaleString('en-US');
}

function animateCount(el, target, opts) {
  opts = opts || {};
  const duration = 900;
  const start = performance.now();
  const prefix = opts.prefix || '';
  const suffix = opts.suffix || '';
  const decimals = opts.decimals || 0;
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    const value = target * eased;
    const formatted = opts.abbreviate
      ? formatAbbreviatedUsd(value)
      : decimals > 0
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('en-US');
    el.textContent = prefix + formatted + suffix;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runCountUps() {
  document.querySelectorAll('.countup').forEach(el => {
    const target = Number(el.getAttribute('data-target'));
    animateCount(el, target, { prefix: '$', abbreviate: true });
  });
  document.querySelectorAll('.countup-dec').forEach(el => {
    const target = Number(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    animateCount(el, target, { suffix, decimals: 1 });
  });
}

function usdToKrwLabel(usd){
  const krw = usd * EXCHANGE_RATE;
  if (typeof currentLang !== 'undefined' && currentLang === 'en') {
    return '(≈ ' + formatWonEn(krw / 100000000) + ')';
  }
  if (typeof currentLang !== 'undefined' && currentLang === 'vi') {
    return '(≈ ' + formatWonVi(krw / 100000000) + ')';
  }
  if (typeof currentLang !== 'undefined' && currentLang === 'th') {
    return '(≈ ' + formatWonTh(krw / 100000000) + ')';
  }
  if (typeof currentLang !== 'undefined' && currentLang === 'ru') {
    return '(≈ ' + formatWonRu(krw / 100000000) + ')';
  }
  if (typeof currentLang !== 'undefined' && currentLang === 'ja') {
    return '(≈ ' + formatWonJa(krw / 100000000) + ')';
  }
  // 억 단위로 먼저 반올림한 뒤 조/억을 나누면, "999.6억이 반올림되며 조 단위를 못 넘어가는" 이월 누락 문제가 안 생김
  const totalEok = Math.round(krw / 100000000);
  const 조 = Math.floor(totalEok / 10000);
  const 억 = totalEok % 10000;
  // 중국어도 亿(=억) 단위 체계가 같아서, "조" 자리만 현대 중국어 관행상 "万亿"(만조)으로 표기
  if (typeof currentLang !== 'undefined' && currentLang === 'zh') {
    if (조 > 0 && 억 === 0) return `(约${조}万亿韩元)`;
    if (조 > 0) return `(约${조}万亿${억.toLocaleString('zh-CN')}亿韩元)`;
    return `(约${억.toLocaleString('zh-CN')}亿韩元)`;
  }
  // formatWon()과 같은 원칙: 위에서 처리 안 된 나머지 모든 언어(크메르어·네팔어·우즈베크어·
  // 몽골어·카자흐어·키르기스어·우르두어·벵골어·라오어·아랍어·힌디어·프랑스어·타갈로그어 등)는
  // "억/조"라는 한국식 단위 대신 훨씬 널리 통하는 영어식 million/billion으로 통일함 —
  // 이 함수(usdToKrwLabel)는 formatWon()과 별개라 그 수정이 안 들어가 있었고, 그 결과 이 언어들의
  // 잭팟 퀵필 버튼에서만 "억원"이 그대로 노출되고 있었음
  if (typeof currentLang !== 'undefined' && currentLang !== 'ko') {
    return '(≈ ' + formatWonEn(krw / 100000000) + ')';
  }
  if (조 > 0 && 억 === 0) return `(약 ${조}조원)`;
  if (조 > 0) return `(약 ${조}조 ${억.toLocaleString('ko-KR')}억원)`;
  return `(약 ${억.toLocaleString('ko-KR')}억원)`;
}

function getJackpotKRW(){
  const usd = Number(document.getElementById('jp-powerball').getAttribute('data-target'));
  return usd * EXCHANGE_RATE;
}

// 놓친 돈 체크리스트의 5개 채널 링크 — 한국 사이트는 전부 주민등록번호 인증이 필요한
// 한국 국내 시스템이라, 한국 연고가 없는 영어권 사용자에게는 그대로 도움이 안 됨.
// 그래서 영어 모드에서는 실제 미국에서 통용되는 자산 찾기 서비스로 링크 자체를 바꿔줌
// (href·아이콘·출처명 모두 교체, 텍스트는 data-i18n으로 별도 처리)
const HIDDEN_MONEY_CHANNELS_EN = {
  hometax:   { href: 'https://www.irs.gov/refunds', icon: '🏛️', sub: 'IRS.gov' },
  gov24:     { href: 'https://www.usa.gov/unclaimed-money', icon: '🏢', sub: 'USA.gov' },
  fine:      { href: 'https://www.missingmoney.com', icon: '💰', sub: 'MissingMoney' },
  health:    { href: 'https://www.unclaimedretirementbenefits.com', icon: '💼', sub: 'Unclaimed Retirement' },
  cardpoint: { href: 'https://www.treasurydirect.gov/indiv/tools/treasuryhunt.htm', icon: '🏦', sub: 'TreasuryDirect' },
};
const HIDDEN_MONEY_CHANNELS_KO = {
  hometax:   { href: 'https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=42&tm2lIdx=4203000000&tm3lIdx=4203010000', icon: '🏛️', sub: 'Hometax' },
  gov24:     { href: 'https://www.gov.kr/portal/service/serviceInfo/174100000054', icon: '🏢', sub: 'Gov24' },
  fine:      { href: 'https://fine.fss.or.kr/fine/main/contents.do?menuNo=900032', icon: '💰', sub: 'FSS Fine' },
  health:    { href: 'https://www.nhis.or.kr/nhis/minwon/retrieveHwangub.do', icon: '🏥', sub: 'NHIS' },
  cardpoint: { href: 'https://www.cardpoint.or.kr', icon: '💳', sub: 'Yeosin Finance' },
};
function updateHiddenMoneyChannelsForLang(){
  const isEnHm = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const map = isEnHm ? HIDDEN_MONEY_CHANNELS_EN : HIDDEN_MONEY_CHANNELS_KO;
  Object.keys(map).forEach(site => {
    const a = document.getElementById('refund-site-' + site);
    if (!a) return;
    a.href = map[site].href;
    const iconEl = a.querySelector('.refund-link-btn-icon');
    if (iconEl) iconEl.textContent = map[site].icon;
    const subEl = a.querySelector('.refund-link-btn-sub');
    if (subEl) subEl.textContent = map[site].sub;
  });
}

function checkHiddenMoney(){
  const checks = document.querySelectorAll('.refund-check-row input[type="checkbox"]');
  checks.forEach(c => {
    const row = c.closest('.refund-check-row');
    if (row) row.classList.toggle('checked', c.checked);
  });
  const checkedBoxes = Array.from(checks).filter(c => c.checked);
  const checkedCount = checkedBoxes.length;
  const resultEl = document.getElementById('hiddenMoneyResult');

  if (checkedCount === 0) {
    resultEl.textContent = pickLang(
      '\uD558\uB098\uB77C\uB3C4 \uD574\uB2F9\uB418\uBA74, \uC544\uB798\uC5D0\uC11C \uC2E4\uC81C\uB85C \uD655\uC778\uD574\uBCF4\uC138\uC694 \uD83D\uDC47',
      'If even one applies to you, check below to find out \uD83D\uDC47',
      '\u5982\u679C\u6709\u7B26\u5408\u7684\u9879\u76EE\uFF0C\u8BF7\u5728\u4E0B\u65B9\u5B9E\u9645\u786E\u8BA4\u4E00\u4E0B \uD83D\uDC47',
      'N\u1EBFu d\u00F9 ch\u1EC9 m\u1ED9t \u0111i\u1EC1u \u0111\u00FAng v\u1EDBi b\u1EA1n, h\u00E3y ki\u1EC3m tra b\u00EAn d\u01B0\u1EDBi \u0111\u1EC3 t\u00ECm hi\u1EC3u \uD83D\uDC47',
      '\u0E2B\u0E32\u0E01\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E43\u0E14\u0E02\u0E49\u0E2D\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E04\u0E38\u0E13 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \uD83D\uDC47',
      '\u0415\u0441\u043B\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u0438\u0437 \u044D\u0442\u043E\u0433\u043E \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u043A \u0432\u0430\u043C, \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u0438\u0436\u0435, \u0447\u0442\u043E\u0431\u044B \u0443\u0437\u043D\u0430\u0442\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \uD83D\uDC47',
      {
        ar: '\u0625\u0630\u0627 \u0627\u0646\u0637\u0628\u0642 \u0639\u0644\u064A\u0643 \u0648\u0644\u0648 \u0648\u0627\u062D\u062F \u0645\u0646\u0647\u0627\u060C \u062A\u062D\u0642\u0642 \u0623\u062F\u0646\u0627\u0647 \u0644\u0645\u0639\u0631\u0641\u0629 \u0630\u0644\u0643 \uD83D\uDC47',
        bn: '\u09AF\u09A6\u09BF \u098F\u0995\u099F\u09BF \u09AC\u09BF\u09B7\u09AF\u09BC\u0993 \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AE\u09C7\u09B2\u09C7, \u09A8\u09BF\u099A\u09C7 \u0997\u09BF\u09AF\u09BC\u09C7 \u09A6\u09C7\u0996\u09C1\u09A8 \uD83D\uDC47',
        fr: "Si ne serait-ce qu'un point vous concerne, v\u00E9rifiez ci-dessous \uD83D\uDC47",
        hi: '\u0905\u0917\u0930 \u090F\u0915 \u092D\u0940 \u092C\u093E\u0924 \u0906\u092A \u092A\u0930 \u0932\u093E\u0917\u0942 \u0939\u094B\u0924\u0940 \u0939\u0948, \u0924\u094B \u0928\u0940\u091A\u0947 \u091C\u093E\u0915\u0930 \u092A\u0924\u093E \u0915\u0930\u0947\u0902 \uD83D\uDC47',
        id: 'Jika ada satu saja yang berlaku untukmu, cek di bawah untuk tahu lebih lanjut \uD83D\uDC47',
        ja: '\u4E00\u3064\u3067\u3082\u5F53\u3066\u306F\u307E\u308B\u306A\u3089\u3001\u4E0B\u3067\u78BA\u8A8D\u3057\u3066\u307F\u307E\u3057\u3087\u3046 \uD83D\uDC47',
        kk: '\u0422\u044B\u043C \u0431\u043E\u043B\u043C\u0430\u0441\u0430 \u0431\u0456\u0440\u0435\u0443\u0456 \u0441\u0456\u0437\u0433\u0435 \u049B\u0430\u0442\u044B\u0441\u0442\u044B \u0431\u043E\u043B\u0441\u0430, \u0442\u04E9\u043C\u0435\u043D\u043D\u0435\u043D \u0442\u0435\u043A\u0441\u0435\u0440\u0456\u043F \u043A\u04E9\u0440\u0456\u04A3\u0456\u0437 \uD83D\uDC47',
        km: '\u1794\u17D2\u179A\u179F\u17B7\u1793\u1794\u17BE\u179F\u17BC\u1798\u17D2\u1794\u17B8\u178F\u17C2\u1798\u17BD\u1799\u178F\u17D2\u179A\u17BC\u179C\u1793\u17B9\u1784\u17A2\u17D2\u1793\u1780 \u179F\u17BC\u1798\u1796\u17B7\u1793\u17B7\u178F\u17D2\u1799\u1781\u17B6\u1784\u1780\u17D2\u179A\u17C4\u1798\u178A\u17BE\u1798\u17D2\u1794\u17B8\u178A\u17B9\u1784 \uD83D\uDC47',
        ky: '\u0416\u043E\u043A \u0434\u0435\u0433\u0435\u043D\u0434\u0435 \u0431\u0438\u0440\u04E9\u04E9 \u0441\u0438\u0437\u0433\u0435 \u0442\u0438\u0435\u0448\u0435\u043B\u04AF\u04AF \u0431\u043E\u043B\u0441\u043E, \u0442\u04E9\u043C\u04E9\u043D\u0434\u04E9\u043D \u0442\u0435\u043A\u0448\u0435\u0440\u0438\u043F \u043A\u04E9\u0440\u04AF\u04A3\u04AF\u0437 \uD83D\uDC47',
        lo: '\u0E96\u0EC9\u0EB2\u0EC1\u0EA1\u0EC8\u0E99\u0EC1\u0E95\u0EC8\u0E82\u0ECD\u0EC9\u0E94\u0EBD\u0EA7\u0E81\u0EBB\u0E87\u0E81\u0EB1\u0E9A\u0E97\u0EC8\u0EB2\u0E99 \u0EA5\u0EAD\u0E87\u0E81\u0EA7\u0E94\u0EC0\u0E9A\u0EB4\u0EC8\u0E87\u0E82\u0EC9\u0EB2\u0E87\u0EA5\u0EB8\u0EC8\u0EA1\u0EC0\u0E9E\u0EB7\u0EC8\u0EAD\u0EAE\u0EB9\u0EC9 \uD83D\uDC47',
        mn: '\u0414\u043E\u0440 \u0445\u0430\u044F\u0436 \u043D\u044D\u0433 \u043D\u044C \u0442\u0430\u043D\u0434 \u0445\u0430\u043C\u0430\u0430\u0442\u0430\u0439 \u0431\u043E\u043B \u0434\u043E\u043E\u0440\u043E\u043E\u0441 \u0448\u0430\u043B\u0433\u0430\u0436 \u04AF\u0437\u044D\u044D\u0440\u044D\u0439 \uD83D\uDC47',
        my: '\u1010\u1005\u103A\u1001\u102F\u1019\u103B\u103E\u1006\u102D\u102F\u101B\u1004\u103A\u1010\u1031\u102C\u1004\u103A \u101E\u1004\u1037\u103A\u1014\u103E\u1004\u1037\u103A \u1000\u102D\u102F\u1000\u103A\u100A\u102E\u101B\u1004\u103A \u1021\u1031\u102C\u1000\u103A\u1010\u103D\u1004\u103A \u1005\u1005\u103A\u1006\u1031\u1038\u1000\u103C\u100A\u1037\u103A\u1015\u102B \uD83D\uDC47',
        ne: '\u092F\u0926\u093F \u090F\u0909\u091F\u093E \u092E\u093E\u0924\u094D\u0930 \u092A\u0928\u093F \u0924\u092A\u093E\u0908\u0902\u0932\u093E\u0908 \u0932\u093E\u0917\u0942 \u0939\u0941\u0928\u094D\u091B \u092D\u0928\u0947, \u0924\u0932 \u0917\u090F\u0930 \u0939\u0947\u0930\u094D\u0928\u0941\u0939\u094B\u0938\u094D \uD83D\uDC47',
        si: '\u0D91\u0D9A\u0D9A\u0DCA \u0DC4\u0DDD \u0D94\u0DB6\u0DA7 \u0D85\u0DAF\u0DCF\u0DC5 \u0DB1\u0DB8\u0DCA, \u0DAF\u0DD0\u0DB1 \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DA7 \u0DB4\u0DC4\u0DAD \u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \uD83D\uDC47',
        tl: 'Kung kahit isa ay naaangkop sa iyo, tingnan sa ibaba para malaman \uD83D\uDC47',
        ur: '\u0627\u06AF\u0631 \u0627\u06CC\u06A9 \u0628\u06BE\u06CC \u0622\u067E \u067E\u0631 \u0644\u0627\u06AF\u0648 \u06C1\u0648\u062A\u06CC \u06C1\u06D2 \u062A\u0648 \u0646\u06CC\u0686\u06D2 \u062C\u0627 \u06A9\u0631 \u0645\u0639\u0644\u0648\u0645 \u06A9\u0631\u06CC\u06BA \uD83D\uDC47',
        uz: "Agar hech bo'lmasa bittasi sizga tegishli bo'lsa, pastda tekshirib ko'ring \uD83D\uDC47",
      }
    );
    resultEl.className = 'refund-wizard-result';
  } else if (checkedCount === 1) {
    resultEl.textContent = pickLang(
      '\u2705 \uD574\uB2F9\uD558\uC2DC\uB294 \uAC8C \uC788\uB124\uC694 \u2014 \uBABB \uBC1B\uC740 \uB3C8\uC774 \uC788\uC744 \uAC00\uB2A5\uC131\uC774 \uC788\uC5B4\uC694. \uC544\uB798\uC5D0\uC11C \uD68C\uC6D0\uB2D8\uD55C\uD14C \uB9DE\uB294 \uACF3\uC744 \uCD94\uCC9C\uD574\uB4DC\uB838\uC5B4\uC694',
      '\u2705 You checked one \u2014 there may be money you haven\u2019t claimed. We\u2019ve highlighted the right place for you below',
      '\u2705 \u6709\u4E00\u9879\u7B26\u5408\u2014\u2014\u53EF\u80FD\u6709\u60A8\u8FD8\u6CA1\u9886\u53D6\u7684\u94B1\u3002\u6211\u4EEC\u5DF2\u7ECF\u5728\u4E0B\u65B9\u4E3A\u60A8\u6807\u51FA\u4E86\u5BF9\u5E94\u7684\u67E5\u8BE2\u6E20\u9053',
      '\u2705 B\u1EA1n c\u00F3 m\u1ED9t m\u1EE5c \u0111\u00FAng \u2014 c\u00F3 th\u1EC3 b\u1EA1n c\u00F3 kho\u1EA3n ti\u1EC1n ch\u01B0a nh\u1EADn. Ch\u00FAng t\u00F4i \u0111\u00E3 \u0111\u00E1nh d\u1EA5u n\u01A1i ph\u00F9 h\u1EE3p cho b\u1EA1n b\u00EAn d\u01B0\u1EDBi',
      '\u2705 \u0E04\u0E38\u0E13\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E02\u0E49\u0E2D \u2014 \u0E2D\u0E32\u0E08\u0E21\u0E35\u0E40\u0E07\u0E34\u0E19\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A \u0E40\u0E23\u0E32\u0E44\u0E2E\u0E44\u0E25\u0E15\u0E4C\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E04\u0E38\u0E13\u0E44\u0E27\u0E49\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E41\u0E25\u0E49\u0E27',
      '\u2705 \u0423 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u043E\u0434\u043D\u043E \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u2014 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0443 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u043D\u0435\u0432\u043E\u0441\u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0434\u0435\u043D\u044C\u0433\u0438. \u041C\u044B \u0432\u044B\u0434\u0435\u043B\u0438\u043B\u0438 \u0434\u043B\u044F \u0432\u0430\u0441 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0435 \u043C\u0435\u0441\u0442\u043E \u043D\u0438\u0436\u0435',
      {
        ar: '\u2705 \u0644\u062F\u064A\u0643 \u0645\u0648\u0631\u062F \u0648\u0627\u062D\u062F \u064A\u0646\u0637\u0628\u0642 \u2014 \u0642\u062F \u064A\u0643\u0648\u0646 \u0644\u062F\u064A\u0643 \u0623\u0645\u0648\u0627\u0644 \u0644\u0645 \u062A\u0633\u062A\u0644\u0645\u0647\u0627. \u0644\u0642\u062F \u0623\u0628\u0631\u0632\u0646\u0627 \u0644\u0643 \u0627\u0644\u0645\u0643\u0627\u0646 \u0627\u0644\u0645\u0646\u0627\u0633\u0628 \u0623\u062F\u0646\u0627\u0647',
        bn: '\u2705 \u0986\u09AA\u09A8\u09BE\u09B0 \u098F\u0995\u099F\u09BF \u09AC\u09BF\u09B7\u09AF\u09BC \u09AE\u09BF\u09B2\u09C7\u099B\u09C7 \u2014 \u0986\u09AA\u09A8\u09BE\u09B0 \u0995\u09BE\u099B\u09C7 \u0985\u09A6\u09BE\u09AC\u09BF\u0995\u09C3\u09A4 \u099F\u09BE\u0995\u09BE \u09A5\u09BE\u0995\u09A4\u09C7 \u09AA\u09BE\u09B0\u09C7\u0964 \u0986\u09AE\u09B0\u09BE \u09A8\u09BF\u099A\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u09B8\u09A0\u09BF\u0995 \u099C\u09BE\u09AF\u09BC\u0997\u09BE\u099F\u09BF \u099A\u09BF\u09B9\u09CD\u09A8\u09BF\u09A4 \u0995\u09B0\u09C7\u099B\u09BF',
        fr: "\u2705 Un point vous concerne \u2014 il pourrait y avoir de l'argent que vous n'avez pas r\u00E9clam\u00E9. Nous avons mis en \u00E9vidence l'endroit appropri\u00E9 ci-dessous",
        hi: '\u2705 \u0906\u092A \u092A\u0930 \u090F\u0915 \u092C\u093E\u0924 \u0932\u093E\u0917\u0942 \u0939\u094B\u0924\u0940 \u0939\u0948 \u2014 \u0939\u094B \u0938\u0915\u0924\u093E \u0939\u0948 \u0906\u092A\u0915\u0947 \u092A\u093E\u0938 \u092C\u093F\u0928\u093E \u0926\u093E\u0935\u0947 \u0915\u093E \u092A\u0948\u0938\u093E \u0939\u094B\u0964 \u0939\u092E\u0928\u0947 \u0928\u0940\u091A\u0947 \u0906\u092A\u0915\u0947 \u0932\u093F\u090F \u0938\u0939\u0940 \u091C\u0917\u0939 \u0939\u093E\u0907\u0932\u093E\u0907\u091F \u0915\u0930 \u0926\u0940 \u0939\u0948',
        id: '\u2705 Ada satu yang berlaku untukmu \u2014 mungkin ada uang yang belum kamu klaim. Kami sudah menyorot tempat yang tepat untukmu di bawah',
        ja: '\u2705 \u4E00\u3064\u5F53\u3066\u306F\u307E\u308A\u307E\u3057\u305F \u2014 \u672A\u8ACB\u6C42\u306E\u304A\u91D1\u304C\u3042\u308B\u304B\u3082\u3057\u308C\u307E\u305B\u3093\u3002\u4EE5\u4E0B\u306B\u3042\u306A\u305F\u306B\u5408\u3063\u305F\u5834\u6240\u3092\u30CF\u30A4\u30E9\u30A4\u30C8\u3057\u307E\u3057\u305F',
        kk: '\u2705 \u0421\u0456\u0437\u0433\u0435 \u0431\u0456\u0440 \u043D\u04D9\u0440\u0441\u0435 \u049B\u0430\u0442\u044B\u0441\u0442\u044B \u2014 \u0430\u043B\u043C\u0430\u0493\u0430\u043D \u0430\u049B\u0448\u0430\u04A3\u044B\u0437 \u0431\u043E\u043B\u0443\u044B \u043C\u04AF\u043C\u043A\u0456\u043D. \u0422\u04E9\u043C\u0435\u043D\u0434\u0435 \u0441\u0456\u0437\u0433\u0435 \u0441\u04D9\u0439\u043A\u0435\u0441 \u0436\u0435\u0440\u0434\u0456 \u0431\u0435\u043B\u0433\u0456\u043B\u0435\u0434\u0456\u043A',
        km: '\u2705 \u17A2\u17D2\u1793\u1780\u1798\u17B6\u1793\u179B\u1780\u17D2\u1781\u1781\u178E\u17D2\u178C\u1798\u17BD\u1799\u178F\u17D2\u179A\u17BC\u179C\u1793\u17B9\u1784\u17A2\u17D2\u1793\u1780 \u2014 \u17A2\u17B6\u1785\u1798\u17B6\u1793\u179B\u17BB\u1799\u178A\u17C2\u179B\u17A2\u17D2\u1793\u1780\u1798\u17B7\u1793\u1794\u17B6\u1793\u1791\u17B6\u1798\u1791\u17B6\u179A\u17D4 \u1799\u17BE\u1784\u1794\u17B6\u1793\u1782\u17BC\u179F\u1794\u1789\u17D2\u1787\u17B6\u1780\u17CB\u1791\u17B8\u1780\u1793\u17D2\u179B\u17C2\u1784\u179F\u1798\u179F\u17D2\u179A\u1794\u179F\u1798\u17D2\u179A\u17B6\u1794\u17CB\u17A2\u17D2\u1793\u1780\u1781\u17B6\u1784\u1780\u17D2\u179A\u17C4\u1798',
        ky: '\u2705 \u0421\u0438\u0437\u0433\u0435 \u0431\u0438\u0440 \u043D\u0435\u0440\u0441\u0435 \u0442\u0443\u0443\u0440\u0430 \u043A\u0435\u043B\u0435\u0442 \u2014 \u0430\u043B\u044B\u043D\u0431\u0430\u0433\u0430\u043D \u0430\u043A\u0447\u0430\u04A3\u044B\u0437 \u0431\u043E\u043B\u0443\u0448\u0443 \u043C\u04AF\u043C\u043A\u04AF\u043D. \u0422\u04E9\u043C\u04E9\u043D\u0434\u04E9 \u0441\u0438\u0437\u0433\u0435 \u0442\u0443\u0443\u0440\u0430 \u043A\u0435\u043B\u0433\u0435\u043D \u0436\u0435\u0440\u0434\u0438 \u0431\u0435\u043B\u0433\u0438\u043B\u0435\u0434\u0438\u043A',
        lo: '\u2705 \u0E97\u0EC8\u0EB2\u0E99\u0EA1\u0EB5\u0E82\u0ECD\u0EC9\u0EDC\u0EB6\u0EC8\u0E87\u0E97\u0EB5\u0EC8\u0E81\u0EBB\u0E87\u0E81\u0EB1\u0E99 \u2014 \u0EAD\u0EB2\u0E94\u0EA1\u0EB5\u0EC0\u0E87\u0EB4\u0E99\u0E97\u0EB5\u0EC8\u0E97\u0EC8\u0EB2\u0E99\u0E8D\u0EB1\u0E87\u0E9A\u0ECD\u0EC8\u0EC4\u0E94\u0EC9\u0EAE\u0EB1\u0E9A. \u0E9E\u0EA7\u0E81\u0EC0\u0EAE\u0EBB\u0EB2\u0EC4\u0E94\u0EC9\u0EC0\u0E99\u0EB1\u0EC9\u0E99\u0E9A\u0EC8\u0EAD\u0E99\u0E97\u0EB5\u0EC8\u0EC0\u0EDD\u0EB2\u0EB0\u0EAA\u0EBB\u0EA1\u0EAA\u0EB3\u0EA5\u0EB1\u0E9A\u0E97\u0EC8\u0EB2\u0E99\u0EC4\u0EA7\u0EC9\u0E82\u0EC9\u0EB2\u0E87\u0EA5\u0EB8\u0EC8\u0EA1\u0EC1\u0EA5\u0EC9\u0EA7',
        mn: '\u2705 \u0422\u0430\u043D\u0434 \u043D\u044D\u0433 \u0437\u04AF\u0439\u043B \u0442\u043E\u0445\u0438\u0440\u0441\u043E\u043D \u0431\u0430\u0439\u043D\u0430 \u2014 \u0430\u0432\u0447 \u0430\u043C\u0436\u0430\u0430\u0433\u04AF\u0439 \u043C\u04E9\u043D\u0433\u04E9 \u0431\u0430\u0439\u0436 \u0431\u043E\u043B\u0437\u043E\u0448\u0433\u04AF\u0439. \u0411\u0438\u0434 \u0442\u0430\u043D\u0434 \u0442\u043E\u0445\u0438\u0440\u043E\u0445 \u0433\u0430\u0437\u0440\u044B\u0433 \u0434\u043E\u043E\u0440 \u0442\u043E\u0434\u043E\u0442\u0433\u043E\u0441\u043E\u043D \u0431\u0430\u0439\u0433\u0430\u0430',
        my: '\u2705 \u101E\u1004\u1037\u103A\u1014\u103E\u1004\u1037\u103A \u1010\u1005\u103A\u1001\u102F \u1000\u102D\u102F\u1000\u103A\u100A\u102E\u1015\u102B\u101E\u100A\u103A \u2014 \u101E\u1004\u103A\u1019\u1010\u1031\u102C\u1004\u103A\u1038\u101A\u1030\u1011\u102C\u1038\u101E\u1031\u1038\u1010\u1032\u1037 \u1004\u103D\u1031\u101B\u103E\u102D\u1014\u102D\u102F\u1004\u103A\u1015\u102B\u1010\u101A\u103A\u104B \u101E\u1004\u1037\u103A\u1021\u1010\u103D\u1000\u103A \u101E\u1004\u1037\u103A\u1010\u1031\u102C\u103A\u1010\u1032\u1037\u1014\u1031\u101B\u102C\u1000\u102D\u102F \u1021\u1031\u102C\u1000\u103A\u1010\u103D\u1004\u103A \u1019\u102E\u1038\u1019\u1031\u102C\u1004\u103A\u1038\u1011\u102D\u102F\u1038\u1015\u103C\u1011\u102C\u1038\u1015\u102B\u101E\u100A\u103A',
        ne: '\u2705 \u0924\u092A\u093E\u0908\u0902\u0938\u0901\u0917 \u090F\u0909\u091F\u093E \u0915\u0941\u0930\u093E \u092E\u093F\u0932\u094D\u092F\u094B \u2014 \u0924\u092A\u093E\u0908\u0902\u0938\u0901\u0917 \u0928\u092A\u093E\u090F\u0915\u094B \u092A\u0948\u0938\u093E \u0939\u0941\u0928\u0938\u0915\u094D\u091B\u0964 \u0939\u093E\u092E\u0940\u0932\u0947 \u0924\u0932\u0915\u094B \u0909\u092A\u092F\u0941\u0915\u094D\u0924 \u0920\u093E\u0909\u0901 \u0939\u093E\u0907\u0932\u093E\u0907\u091F \u0917\u0930\u093F\u0926\u093F\u090F\u0915\u093E \u091B\u094C\u0902',
        si: '\u2705 \u0D94\u0DB6\u0DA7 \u0D91\u0D9A\u0D9A\u0DCA \u0D9C\u0DD0\u0DBD\u0DB4\u0DDA \u2014 \u0D94\u0DB6\u0DA7 \u0DC4\u0DD2\u0DB8\u0DD2\u0D9A\u0DB8\u0DCA \u0DB1\u0DDC\u0D9A\u0DC5 \u0DB8\u0DD4\u0DAF\u0DBD\u0D9A\u0DCA \u0DAD\u0DD2\u0DB6\u0DD2\u0DBA \u0DC4\u0DD0\u0D9A. \u0D85\u0DB4\u0DD2 \u0D94\u0DB6\u0DA7 \u0DC3\u0DD4\u0DAF\u0DD4\u0DC3\u0DD4 \u0DC3\u0DCA\u0DAE\u0DCF\u0DB1\u0DBA \u0DB4\u0DC4\u0DAD \u0D8B\u0DAF\u0DCA\u0DAF\u0DD3\u0DB4\u0DB1\u0DBA \u0D9A\u0DBB \u0D87\u0DAD',
        tl: '\u2705 May isang bagay na naaangkop sa iyo \u2014 maaaring may perang hindi mo pa na-claim. Naka-highlight na namin ang tamang lugar para sa iyo sa ibaba',
        ur: '\u2705 \u0622\u067E \u067E\u0631 \u0627\u06CC\u06A9 \u0628\u0627\u062A \u0644\u0627\u06AF\u0648 \u06C1\u0648\u062A\u06CC \u06C1\u06D2 \u2014 \u0645\u0645\u06A9\u0646 \u06C1\u06D2 \u0622\u067E \u06A9\u06D2 \u067E\u0627\u0633 \u0627\u0646 \u06A9\u0644\u06CC\u0645\u0688 \u067E\u06CC\u0633\u06C1 \u06C1\u0648\u06D4 \u06C1\u0645 \u0646\u06D2 \u0646\u06CC\u0686\u06D2 \u0622\u067E \u06A9\u06D2 \u0644\u06CC\u06D2 \u0635\u062D\u06CC\u062D \u062C\u06AF\u06C1 \u0646\u0645\u0627\u06CC\u0627\u06BA \u06A9\u0631 \u062F\u06CC \u06C1\u06D2',
        uz: "\u2705 Sizga bittasi mos keladi \u2014 da'vo qilinmagan pulingiz bo'lishi mumkin. Quyida siz uchun to'g'ri joyni belgilab qo'ydik",
      }
    );
    resultEl.className = 'refund-wizard-result tag-hit';
  } else {
    resultEl.textContent = pickLang(
      `\u2705 ${checkedCount}\uAC1C\uB098 \uD574\uB2F9\uB418\uC2DC\uB124\uC694 \u2014 \uC2E4\uC81C\uB85C \uBABB \uBC1B\uC740 \uB3C8\uC774 \uC788\uC744 \uAC00\uB2A5\uC131\uC774 \uAF64 \uB192\uC544\uC694. \uC544\uB798\uC5D0\uC11C \uD68C\uC6D0\uB2D8\uD55C\uD14C \uB9DE\uB294 \uACF3\uC744 \uCD94\uCC9C\uD574\uB4DC\uB838\uC5B4\uC694`,
      `\u2705 You checked ${checkedCount} \u2014 there\u2019s a good chance you have unclaimed money. We\u2019ve highlighted the right places for you below`,
      `\u2705 \u6709${checkedCount}\u9879\u7B26\u5408\u2014\u2014\u5F88\u6709\u53EF\u80FD\u6709\u60A8\u8FD8\u6CA1\u9886\u53D6\u7684\u94B1\u3002\u6211\u4EEC\u5DF2\u7ECF\u5728\u4E0B\u65B9\u4E3A\u60A8\u6807\u51FA\u4E86\u5BF9\u5E94\u7684\u67E5\u8BE2\u6E20\u9053`,
      `\u2705 B\u1EA1n c\u00F3 ${checkedCount} m\u1EE5c \u0111\u00FAng \u2014 r\u1EA5t c\u00F3 th\u1EC3 b\u1EA1n c\u00F3 kho\u1EA3n ti\u1EC1n ch\u01B0a nh\u1EADn. Ch\u00FAng t\u00F4i \u0111\u00E3 \u0111\u00E1nh d\u1EA5u nh\u1EEFng n\u01A1i ph\u00F9 h\u1EE3p cho b\u1EA1n b\u00EAn d\u01B0\u1EDBi`,
      `\u2705 \u0E04\u0E38\u0E13\u0E21\u0E35 ${checkedCount} \u0E02\u0E49\u0E2D\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07 \u2014 \u0E21\u0E35\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E2A\u0E39\u0E07\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E21\u0E35\u0E40\u0E07\u0E34\u0E19\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A \u0E40\u0E23\u0E32\u0E44\u0E2E\u0E44\u0E25\u0E15\u0E4C\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E04\u0E38\u0E13\u0E44\u0E27\u0E49\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E41\u0E25\u0E49\u0E27`,
      `\u2705 \u0423 \u0432\u0430\u0441 ${checkedCount} \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u2014 \u0432\u043F\u043E\u043B\u043D\u0435 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0443 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u043D\u0435\u0432\u043E\u0441\u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0434\u0435\u043D\u044C\u0433\u0438. \u041C\u044B \u0432\u044B\u0434\u0435\u043B\u0438\u043B\u0438 \u0434\u043B\u044F \u0432\u0430\u0441 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0435 \u043C\u0435\u0441\u0442\u0430 \u043D\u0438\u0436\u0435`,
      {
        ar: `\u2705 \u0644\u062F\u064A\u0643 ${checkedCount} \u0645\u0648\u0627\u0631\u062F \u062A\u0646\u0637\u0628\u0642 \u2014 \u0647\u0646\u0627\u0643 \u0641\u0631\u0635\u0629 \u062C\u064A\u062F\u0629 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0644\u062F\u064A\u0643 \u0623\u0645\u0648\u0627\u0644 \u0644\u0645 \u062A\u0633\u062A\u0644\u0645\u0647\u0627. \u0644\u0642\u062F \u0623\u0628\u0631\u0632\u0646\u0627 \u0644\u0643 \u0627\u0644\u0623\u0645\u0627\u0643\u0646 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0623\u062F\u0646\u0627\u0647`,
        bn: `\u2705 \u0986\u09AA\u09A8\u09BE\u09B0 ${checkedCount}\u099F\u09BF \u09AC\u09BF\u09B7\u09AF\u09BC \u09AE\u09BF\u09B2\u09C7\u099B\u09C7 \u2014 \u09B8\u09AE\u09CD\u09AD\u09AC\u09A4 \u0986\u09AA\u09A8\u09BE\u09B0 \u0995\u09BE\u099B\u09C7 \u0985\u09A6\u09BE\u09AC\u09BF\u0995\u09C3\u09A4 \u099F\u09BE\u0995\u09BE \u0986\u099B\u09C7\u0964 \u0986\u09AE\u09B0\u09BE \u09A8\u09BF\u099A\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u09B8\u09A0\u09BF\u0995 \u099C\u09BE\u09AF\u09BC\u0997\u09BE\u0997\u09C1\u09B2\u09CB \u099A\u09BF\u09B9\u09CD\u09A8\u09BF\u09A4 \u0995\u09B0\u09C7\u099B\u09BF`,
        fr: `\u2705 ${checkedCount} points vous concernent \u2014 il y a de bonnes chances que vous ayez de l'argent non r\u00E9clam\u00E9. Nous avons mis en \u00E9vidence les endroits appropri\u00E9s ci-dessous`,
        hi: `\u2705 \u0906\u092A \u092A\u0930 ${checkedCount} \u092C\u093E\u0924\u0947\u0902 \u0932\u093E\u0917\u0942 \u0939\u094B\u0924\u0940 \u0939\u0948\u0902 \u2014 \u0905\u091A\u094D\u091B\u0940 \u0938\u0902\u092D\u093E\u0935\u0928\u093E \u0939\u0948 \u0915\u093F \u0906\u092A\u0915\u0947 \u092A\u093E\u0938 \u092C\u093F\u0928\u093E \u0926\u093E\u0935\u0947 \u0915\u093E \u092A\u0948\u0938\u093E \u0939\u094B\u0964 \u0939\u092E\u0928\u0947 \u0928\u0940\u091A\u0947 \u0906\u092A\u0915\u0947 \u0932\u093F\u090F \u0938\u0939\u0940 \u091C\u0917\u0939\u0947\u0902 \u0939\u093E\u0907\u0932\u093E\u0907\u091F \u0915\u0930 \u0926\u0940 \u0939\u0948\u0902`,
        id: `\u2705 Ada ${checkedCount} yang berlaku untukmu \u2014 kemungkinan besar ada uang yang belum kamu klaim. Kami sudah menyorot tempat-tempat yang tepat untukmu di bawah`,
        ja: `\u2705 ${checkedCount}\u500B\u5F53\u3066\u306F\u307E\u308A\u307E\u3057\u305F \u2014 \u672A\u8ACB\u6C42\u306E\u304A\u91D1\u304C\u3042\u308B\u53EF\u80FD\u6027\u304C\u9AD8\u3044\u3067\u3059\u3002\u4EE5\u4E0B\u306B\u3042\u306A\u305F\u306B\u5408\u3063\u305F\u5834\u6240\u3092\u30CF\u30A4\u30E9\u30A4\u30C8\u3057\u307E\u3057\u305F`,
        kk: `\u2705 \u0421\u0456\u0437\u0433\u0435 ${checkedCount} \u043D\u04D9\u0440\u0441\u0435 \u049B\u0430\u0442\u044B\u0441\u0442\u044B \u2014 \u0430\u043B\u043C\u0430\u0493\u0430\u043D \u0430\u049B\u0448\u0430\u04A3\u044B\u0437 \u0431\u043E\u043B\u0443 \u043C\u04AF\u043C\u043A\u0456\u043D\u0434\u0456\u0433\u0456 \u0436\u043E\u0493\u0430\u0440\u044B. \u0422\u04E9\u043C\u0435\u043D\u0434\u0435 \u0441\u0456\u0437\u0433\u0435 \u0441\u04D9\u0439\u043A\u0435\u0441 \u0436\u0435\u0440\u043B\u0435\u0440\u0434\u0456 \u0431\u0435\u043B\u0433\u0456\u043B\u0435\u0434\u0456\u043A`,
        km: `\u2705 \u17A2\u17D2\u1793\u1780\u1798\u17B6\u1793\u179B\u1780\u17D2\u1781\u1781\u178E\u17D2\u178C ${checkedCount} \u178F\u17D2\u179A\u17BC\u179C\u1793\u17B9\u1784\u17A2\u17D2\u1793\u1780 \u2014 \u1798\u17B6\u1793\u17B1\u1780\u17B6\u179F\u1781\u17D2\u1796\u179F\u17CB\u178A\u17C2\u179B\u17A2\u17D2\u1793\u1780\u1798\u17B6\u1793\u179B\u17BB\u1799\u1798\u17B7\u1793\u1794\u17B6\u1793\u1791\u17B6\u1798\u1791\u17B6\u179A\u17D4 \u1799\u17BE\u1784\u1794\u17B6\u1793\u1782\u17BC\u179F\u1794\u1789\u17D2\u1787\u17B6\u1780\u17CB\u1791\u17B8\u1780\u1793\u17D2\u179B\u17C2\u1784\u179F\u1798\u179F\u17D2\u179A\u1794\u179F\u1798\u17D2\u179A\u17B6\u1794\u17CB\u17A2\u17D2\u1793\u1780\u1781\u17B6\u1784\u1780\u17D2\u179A\u17C4\u1798`,
        ky: `\u2705 \u0421\u0438\u0437\u0433\u0435 ${checkedCount} \u043D\u0435\u0440\u0441\u0435 \u0442\u0443\u0443\u0440\u0430 \u043A\u0435\u043B\u0435\u0442 \u2014 \u0430\u043B\u044B\u043D\u0431\u0430\u0433\u0430\u043D \u0430\u043A\u0447\u0430\u04A3\u044B\u0437 \u0431\u043E\u043B\u0443\u0443 \u044B\u043A\u0442\u044B\u043C\u0430\u043B\u0434\u044B\u0433\u044B \u0436\u043E\u0433\u043E\u0440\u0443. \u0422\u04E9\u043C\u04E9\u043D\u0434\u04E9 \u0441\u0438\u0437\u0433\u0435 \u0442\u0443\u0443\u0440\u0430 \u043A\u0435\u043B\u0433\u0435\u043D \u0436\u0435\u0440\u043B\u0435\u0440\u0434\u0438 \u0431\u0435\u043B\u0433\u0438\u043B\u0435\u0434\u0438\u043A`,
        lo: `\u2705 \u0E97\u0EC8\u0EB2\u0E99\u0EA1\u0EB5 ${checkedCount} \u0E82\u0ECD\u0EC9\u0E97\u0EB5\u0EC8\u0E81\u0EBB\u0E87\u0E81\u0EB1\u0E99 \u2014 \u0EA1\u0EB5\u0EC2\u0EAD\u0E81\u0EB2\u0E94\u0EAA\u0EB9\u0E87\u0E97\u0EB5\u0EC8\u0E97\u0EC8\u0EB2\u0E99\u0E88\u0EB0\u0EA1\u0EB5\u0EC0\u0E87\u0EB4\u0E99\u0E97\u0EB5\u0EC8\u0E8D\u0EB1\u0E87\u0E9A\u0ECD\u0EC8\u0EC4\u0E94\u0EC9\u0EAE\u0EB1\u0E9A. \u0E9E\u0EA7\u0E81\u0EC0\u0EAE\u0EBB\u0EB2\u0EC4\u0E94\u0EC9\u0EC0\u0E99\u0EB1\u0EC9\u0E99\u0E9A\u0EC8\u0EAD\u0E99\u0E97\u0EB5\u0EC8\u0EC0\u0EDD\u0EB2\u0EB0\u0EAA\u0EBB\u0EA1\u0EAA\u0EB3\u0EA5\u0EB1\u0E9A\u0E97\u0EC8\u0EB2\u0E99\u0EC4\u0EA7\u0EC9\u0E82\u0EC9\u0EB2\u0E87\u0EA5\u0EB8\u0EC8\u0EA1\u0EC1\u0EA5\u0EC9\u0EA7`,
        mn: `\u2705 \u0422\u0430\u043D\u0434 ${checkedCount} \u0437\u04AF\u0439\u043B \u0442\u043E\u0445\u0438\u0440\u0441\u043E\u043D \u0431\u0430\u0439\u043D\u0430 \u2014 \u0430\u0432\u0447 \u0430\u043C\u0436\u0430\u0430\u0433\u04AF\u0439 \u043C\u04E9\u043D\u0433\u04E9\u0442\u044D\u0439 \u0431\u0430\u0439\u0445 \u043C\u0430\u0433\u0430\u0434\u043B\u0430\u043B \u04E9\u043D\u0434\u04E9\u0440 \u0431\u0430\u0439\u043D\u0430. \u0411\u0438\u0434 \u0442\u0430\u043D\u0434 \u0442\u043E\u0445\u0438\u0440\u043E\u0445 \u0433\u0430\u0437\u0440\u0443\u0443\u0434\u044B\u0433 \u0434\u043E\u043E\u0440 \u0442\u043E\u0434\u043E\u0442\u0433\u043E\u0441\u043E\u043D \u0431\u0430\u0439\u0433\u0430\u0430`,
        my: `\u2705 \u101E\u1004\u1037\u103A\u1014\u103E\u1004\u1037\u103A ${checkedCount} \u1001\u102F \u1000\u102D\u102F\u1000\u103A\u100A\u102E\u1015\u102B\u101E\u100A\u103A \u2014 \u101E\u1004\u103A\u1019\u1010\u1031\u102C\u1004\u103A\u1038\u101A\u1030\u1011\u102C\u1038\u101E\u1031\u1038\u1010\u1032\u1037 \u1004\u103D\u1031\u101B\u103E\u102D\u1014\u102D\u102F\u1004\u103A\u1001\u103C\u1031 \u1019\u103B\u102C\u1038\u1015\u102B\u101E\u100A\u103A\u104B \u101E\u1004\u1037\u103A\u1021\u1010\u103D\u1000\u103A \u101E\u1004\u1037\u103A\u1010\u1031\u102C\u103A\u1010\u1032\u1037\u1014\u1031\u101B\u102C\u1019\u103B\u102C\u1038\u1000\u102D\u102F \u1021\u1031\u102C\u1000\u103A\u1010\u103D\u1004\u103A \u1019\u102E\u1038\u1019\u1031\u102C\u1004\u103A\u1038\u1011\u102D\u102F\u1038\u1015\u103C\u1011\u102C\u1038\u1015\u102B\u101E\u100A\u103A`,
        ne: `\u2705 \u0924\u092A\u093E\u0908\u0902\u0938\u0901\u0917 ${checkedCount} \u0915\u0941\u0930\u093E \u092E\u093F\u0932\u094D\u092F\u094B \u2014 \u0924\u092A\u093E\u0908\u0902\u0938\u0901\u0917 \u0928\u092A\u093E\u090F\u0915\u094B \u092A\u0948\u0938\u093E \u0939\u0941\u0928\u0947 \u0930\u093E\u092E\u094D\u0930\u094B \u0938\u092E\u094D\u092D\u093E\u0935\u0928\u093E \u091B\u0964 \u0939\u093E\u092E\u0940\u0932\u0947 \u0924\u0932\u0915\u093E \u0909\u092A\u092F\u0941\u0915\u094D\u0924 \u0920\u093E\u0909\u0901\u0939\u0930\u0942 \u0939\u093E\u0907\u0932\u093E\u0907\u091F \u0917\u0930\u093F\u0926\u093F\u090F\u0915\u093E \u091B\u094C\u0902`,
        si: `\u2705 \u0D94\u0DB6\u0DA7 ${checkedCount}\u0D9A\u0DCA \u0D9C\u0DD0\u0DBD\u0DB4\u0DDA \u2014 \u0D94\u0DB6\u0DA7 \u0DC4\u0DD2\u0DB8\u0DD2\u0D9A\u0DB8\u0DCA \u0DB1\u0DDC\u0D9A\u0DC5 \u0DB8\u0DD4\u0DAF\u0DBD\u0D9A\u0DCA \u0DAD\u0DD2\u0DB6\u0DD3\u0DB8\u0DA7 \u0DC4\u0DDC\u0DB3 \u0D89\u0DA9\u0D9A\u0DCA \u0D87\u0DAD. \u0D85\u0DB4\u0DD2 \u0D94\u0DB6\u0DA7 \u0DC3\u0DD4\u0DAF\u0DD4\u0DC3\u0DD4 \u0DC3\u0DCA\u0DAE\u0DCF\u0DB1 \u0DB4\u0DC4\u0DAD \u0D8B\u0DAF\u0DCA\u0DAF\u0DD3\u0DB4\u0DB1\u0DBA \u0D9A\u0DBB \u0D87\u0DAD`,
        tl: `\u2705 May ${checkedCount} bagay na naaangkop sa iyo \u2014 malaki ang posibilidad na may perang hindi mo pa na-claim. Naka-highlight na namin ang mga tamang lugar para sa iyo sa ibaba`,
        ur: `\u2705 \u0622\u067E \u067E\u0631 ${checkedCount} \u0628\u0627\u062A\u06CC\u06BA \u0644\u0627\u06AF\u0648 \u06C1\u0648\u062A\u06CC \u06C1\u06CC\u06BA \u2014 \u0627\u0645\u06A9\u0627\u0646 \u06C1\u06D2 \u06A9\u06C1 \u0622\u067E \u06A9\u06D2 \u067E\u0627\u0633 \u0627\u0646 \u06A9\u0644\u06CC\u0645\u0688 \u067E\u06CC\u0633\u06C1 \u06C1\u0648\u06D4 \u06C1\u0645 \u0646\u06D2 \u0646\u06CC\u0686\u06D2 \u0622\u067E \u06A9\u06D2 \u0644\u06CC\u06D2 \u0635\u062D\u06CC\u062D \u062C\u06AF\u06C1\u06CC\u06BA \u0646\u0645\u0627\u06CC\u0627\u06BA \u06A9\u0631 \u062F\u06CC \u06C1\u06CC\u06BA`,
        uz: `\u2705 Sizga ${checkedCount} ta narsa mos keladi \u2014 da'vo qilinmagan pulingiz bo'lish ehtimoli yuqori. Quyida siz uchun to'g'ri joylarni belgilab qo'ydik`,
      }
    );
    resultEl.className = 'refund-wizard-result tag-hit';
  }

  // \uCCB4\uD06C\uD55C \uD56D\uBAA9\uC5D0 \uC5F0\uACB0\uB41C \uC0AC\uC774\uD2B8\uB9CC \uCD94\uCC9C(\uAC15\uC870)\uD558\uACE0, \uB098\uBA38\uC9C0\uB294 \uD750\uB9AC\uAC8C
  const recommendedSites = new Set(checkedBoxes.map(c => c.dataset.site));
  const allSites = ['hometax', 'gov24', 'fine', 'health', 'cardpoint'];
  allSites.forEach(site => {
    const btn = document.getElementById('refund-site-' + site);
    if (!btn) return;
    if (checkedCount === 0) {
      btn.classList.remove('recommended', 'dimmed');
    } else if (recommendedSites.has(site)) {
      btn.classList.add('recommended');
      btn.classList.remove('dimmed');
    } else {
      btn.classList.remove('recommended');
      btn.classList.add('dimmed');
    }
  });
}

// FTC(외국납부세액공제) 신청 서류 체크리스트 — checkHiddenMoney()와 같은 패턴(체크만 되고
// 서버 저장은 안 함, 새로고침하면 초기화됨). 서류 자체를 대신 발급해주는 게 아니라 "내가 뭘
// 챙겼는지" 스스로 확인하는 용도라 이 정도면 충분하다고 판단
function checkFtcDocs(){
  const checks = document.querySelectorAll('#faq-doc-checklist input[type="checkbox"], .refund-step-card input[type="checkbox"][onchange="checkFtcDocs()"]');
  checks.forEach(c => {
    const row = c.closest('.refund-check-row');
    if (row) row.classList.toggle('checked', c.checked);
  });
  const total = checks.length;
  const checkedCount = Array.from(checks).filter(c => c.checked).length;
  const resultEl = document.getElementById('ftcDocsResult');
  if (!resultEl) return;
  if (checkedCount === 0) {
    resultEl.textContent = resultEl.getAttribute('data-i18n-ko') || resultEl.textContent;
  } else if (checkedCount === total) {
    resultEl.textContent = pickLang(
      '서류 다 챙기셨네요! 이제 신고만 남았어요 🎉',
      "You've got everything! Just the filing left 🎉",
      '文件都齐了！只剩申报了 🎉',
      'Bạn đã chuẩn bị đủ giấy tờ rồi! Chỉ còn khai thuế thôi 🎉',
      'เอกสารครบแล้ว! เหลือแค่ยื่นภาษี 🎉',
      'Все документы готовы! Осталось только подать декларацию 🎉',
      {
        ar: 'لقد جهزت كل الأوراق! تبقى فقط تقديم الإقرار 🎉',
        bn: 'সব কাগজপত্র প্রস্তুত! এখন শুধু ফাইল করা বাকি 🎉',
        fr: 'Vous avez tous les documents ! Il ne reste plus qu’à déclarer 🎉',
        hi: 'सारे दस्तावेज़ तैयार हैं! अब बस फाइलिंग बाकी है 🎉',
        id: 'Semua dokumen sudah siap! Tinggal lapor pajak saja 🎉',
        ja: '書類は全部揃いました！あとは申告だけです 🎉',
        kk: 'Барлық құжаттар дайын! Тек декларация тапсыру ғана қалды 🎉',
        km: 'អ្នកបានរៀបចំឯកសារគ្រប់គ្រាន់ហើយ! នៅសល់តែការដាក់ពន្ធ 🎉',
        ky: 'Бардык документтер даяр! Декларация тапшыруу гана калды 🎉',
        lo: 'ເອກະສານພ້ອມໝົດແລ້ວ! ເຫຼືອແຕ່ຍື່ນພາສີ 🎉',
        mn: 'Бүх бичиг баримт бэлэн боллоо! Зөвхөн татварын мэдүүлэг үлдлээ 🎉',
        my: 'စာရွက်စာတမ်းအားလုံး ပြင်ဆင်ပြီးပါပြီ! အခွန်တင်ရန်သာ ကျန်တော့သည် 🎉',
        ne: 'सबै कागजात तयार भयो! अब कर विवरण बाँकी छ 🎉',
        si: 'ලේඛන සියල්ල සූදානම්! ඉතිරිව ඇත්තේ බදු ගොනු කිරීම පමණයි 🎉',
        tl: 'Kumpleto na ang mga dokumento! Ang natitira na lang ay ang pag-file 🎉',
        ur: 'تمام دستاویزات تیار ہیں! صرف فائلنگ باقی ہے 🎉',
        uz: 'Barcha hujjatlar tayyor! Faqat deklaratsiya topshirish qoldi 🎉',
      }
    );
  } else {
    resultEl.textContent = pickLang(
      `${checkedCount}/${total}개 챙겼어요 — 나머지도 확인해보세요`,
      `${checkedCount}/${total} ready — check off the rest`,
      `已备齐 ${checkedCount}/${total} 项 — 请确认剩下的`,
      `Đã chuẩn bị ${checkedCount}/${total} — kiểm tra phần còn lại`,
      `พร้อมแล้ว ${checkedCount}/${total} รายการ — ตรวจสอบที่เหลือด้วย`,
      `Готово ${checkedCount}/${total} — проверьте остальное`,
      {
        ar: `جهزت ${checkedCount}/${total} — تحقق من الباقي`,
        bn: `${checkedCount}/${total}টি প্রস্তুত — বাকিগুলো দেখুন`,
        fr: `${checkedCount}/${total} prêts — vérifiez le reste`,
        hi: `${checkedCount}/${total} तैयार — बाकी भी जांच लें`,
        id: `${checkedCount}/${total} siap — cek sisanya`,
        ja: `${checkedCount}/${total}個準備できました — 残りも確認してください`,
        kk: `${checkedCount}/${total} дайын — қалғанын тексеріңіз`,
        km: `${checkedCount}/${total} បានរៀបចំ — សូមពិនិត្យមើលផ្នែកដែលនៅសល់`,
        ky: `${checkedCount}/${total} даяр — калганын текшериңиз`,
        lo: `ພ້ອມແລ້ວ ${checkedCount}/${total} — ກວດສອບສ່ວນທີ່ເຫຼືອ`,
        mn: `${checkedCount}/${total} бэлэн боллоо — үлдсэнийг шалгана уу`,
        my: `${checkedCount}/${total} ပြင်ဆင်ပြီးပါပြီ — ကျန်တာလည်း စစ်ဆေးပါ`,
        ne: `${checkedCount}/${total} तयार — बाँकी पनि जाँच्नुहोस्`,
        si: `${checkedCount}/${total} සූදානම් — ඉතිරිය ද පරීක්ෂා කරන්න`,
        tl: `${checkedCount}/${total} handa na — tingnan din ang natitira`,
        ur: `${checkedCount}/${total} تیار ہیں — باقی بھی چیک کریں`,
        uz: `${checkedCount}/${total} tayyor — qolganini ham tekshiring`,
      }
    );
  }
}

// FTC 체크리스트 카드 아래에 종합소득세 신고 마감일(다음 해 5/31)까지 D-day를 보여줌 —
// FAQ 텍스트(a19/a20)로만 읽고 지나치던 정보를, 실제로 언제까지 해야 하는지 숫자로 체감하게 함
function renderFilingDday(){
  const el = document.getElementById('faq-filing-dday');
  if (!el) return;
  const now = new Date();
  const year = now.getFullYear();
  // 5/31 자정(다음날 0시) 기준으로 지났으면 내년으로
  const thisYearDeadline = new Date(year, 4, 31);
  const deadline = now <= thisYearDeadline ? thisYearDeadline : new Date(year + 1, 4, 31);
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const dateStr = `${deadline.getFullYear()}.${String(deadline.getMonth() + 1).padStart(2, '0')}.${String(deadline.getDate()).padStart(2, '0')}`;
  const label = pickLang(
    `⏰ 종합소득세 신고 마감까지 D-${diffDays} (${dateStr})`,
    `⏰ D-${diffDays} until the filing deadline (${dateStr})`,
    `⏰ 距综合所得税申报截止还有 D-${diffDays} 天 (${dateStr})`,
    `⏰ Còn D-${diffDays} ngày đến hạn khai thuế (${dateStr})`,
    `⏰ เหลืออีก D-${diffDays} วันถึงกำหนดยื่นภาษี (${dateStr})`,
    `⏰ Осталось D-${diffDays} дней до срока подачи декларации (${dateStr})`,
    {
      ar: `⏰ D-${diffDays} يوم حتى موعد تقديم الإقرار (${dateStr})`,
      bn: `⏰ কর ফাইলিং শেষ হতে D-${diffDays} দিন বাকি (${dateStr})`,
      fr: `⏰ D-${diffDays} jours avant la date limite de déclaration (${dateStr})`,
      hi: `⏰ फाइलिंग की समय सीमा तक D-${diffDays} दिन (${dateStr})`,
      id: `⏰ D-${diffDays} hari menuju batas waktu lapor pajak (${dateStr})`,
      ja: `⏰ 申告期限まで D-${diffDays}日 (${dateStr})`,
      kk: `⏰ Декларация тапсыру мерзіміне дейін D-${diffDays} күн (${dateStr})`,
      km: `⏰ D-${diffDays} ថ្ងៃទៀតដល់កាលកំណត់ដាក់ពន្ធ (${dateStr})`,
      ky: `⏰ Декларация мөөнөтүнө чейин D-${diffDays} күн (${dateStr})`,
      lo: `⏰ ອີກ D-${diffDays} ວັນຈະຮອດກຳນົດຍື່ນພາສີ (${dateStr})`,
      mn: `⏰ Татварын мэдүүлгийн эцсийн хугацаанд D-${diffDays} өдөр үлдлээ (${dateStr})`,
      my: `⏰ အခွန်တင်ရမည့်နောက်ဆုံးရက်အထိ D-${diffDays} ရက် (${dateStr})`,
      ne: `⏰ कर विवरण बुझाउने अन्तिम मितिसम्म D-${diffDays} दिन (${dateStr})`,
      si: `⏰ බදු ගොනු කිරීමේ අවසන් දිනයට D-${diffDays} දින (${dateStr})`,
      tl: `⏰ D-${diffDays} araw hanggang sa deadline ng pag-file (${dateStr})`,
      ur: `⏰ فائلنگ کی آخری تاریخ تک D-${diffDays} دن (${dateStr})`,
      uz: `⏰ Deklaratsiya topshirish muddatigacha D-${diffDays} kun qoldi (${dateStr})`,
    }
  );
  el.textContent = label;
}

function checkRefundPossibility(){
  const stateCode = document.getElementById('refundStateSelect').value;
  const resultEl = document.getElementById('refundWizardResult');
  if (!stateCode) {
    resultEl.textContent = pickLang(
      '\uC8FC\uB97C \uC120\uD0DD\uD558\uBA74 \uD658\uAE09 \uAC00\uB2A5\uC131\uC744 \uBC14\uB85C \uC54C\uB824\uB4DC\uB824\uC694',
      'Select a state and we\u2019ll tell you right away whether a refund is likely',
      '\u9009\u62E9\u5DDE\u4E4B\u540E\uFF0C\u9A6C\u4E0A\u544A\u8BC9\u60A8\u9000\u7A0E\u7684\u53EF\u80FD\u6027',
      'Ch\u1ECDn m\u1ED9t bang v\u00E0 ch\u00FAng t\u00F4i s\u1EBD cho b\u1EA1n bi\u1EBFt ngay kh\u1EA3 n\u0103ng \u0111\u01B0\u1EE3c ho\u00E0n thu\u1EBF',
      '\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E21\u0E25\u0E23\u0E31\u0E10\u0E41\u0E25\u0E49\u0E27\u0E40\u0E23\u0E32\u0E08\u0E30\u0E1A\u0E2D\u0E01\u0E17\u0E31\u0E19\u0E17\u0E35\u0E27\u0E48\u0E32\u0E21\u0E35\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E44\u0E14\u0E49\u0E04\u0E37\u0E19\u0E20\u0E32\u0E29\u0E35\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48',
      '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0448\u0442\u0430\u0442, \u0438 \u043C\u044B \u0441\u0440\u0430\u0437\u0443 \u0441\u043A\u0430\u0436\u0435\u043C, \u0432\u0435\u0440\u043E\u044F\u0442\u0435\u043D \u043B\u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0442',
      {
        ar: '\u0627\u062E\u062A\u0631 \u0648\u0644\u0627\u064A\u0629 \u0648\u0633\u0646\u062E\u0628\u0631\u0643 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0631 \u0628\u0645\u062F\u0649 \u0627\u062D\u062A\u0645\u0627\u0644 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0636\u0631\u064A\u0628\u0629',
        bn: '\u098F\u0995\u099F\u09BF \u09B0\u09BE\u099C\u09CD\u09AF \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8, \u0986\u09AE\u09B0\u09BE \u09B8\u09BE\u09A5\u09C7 \u09B8\u09BE\u09A5\u09C7 \u09AC\u09B2\u09C7 \u09A6\u09C7\u09AC \u09AB\u09C7\u09B0\u09A4 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE\u09B0 \u09B8\u09AE\u09CD\u09AD\u09BE\u09AC\u09A8\u09BE \u0995\u09A4\u099F\u09C1\u0995\u09C1',
        fr: 'Choisissez un \u00C9tat et nous vous dirons imm\u00E9diatement si un remboursement est probable',
        hi: '\u090F\u0915 \u0930\u093E\u091C\u094D\u092F \u091A\u0941\u0928\u0947\u0902 \u0914\u0930 \u0939\u092E \u0924\u0941\u0930\u0902\u0924 \u092C\u0924\u093E \u0926\u0947\u0902\u0917\u0947 \u0915\u093F \u0930\u093F\u092B\u0902\u0921 \u092E\u093F\u0932\u0928\u0947 \u0915\u0940 \u0938\u0902\u092D\u093E\u0935\u0928\u093E \u0939\u0948 \u092F\u093E \u0928\u0939\u0940\u0902',
        id: 'Pilih negara bagian dan kami akan langsung memberitahumu kemungkinan pengembalian dana',
        ja: '\u5DDE\u3092\u9078\u3076\u3068\u3001\u9084\u4ED8\u306E\u53EF\u80FD\u6027\u3092\u3059\u3050\u306B\u304A\u77E5\u3089\u305B\u3057\u307E\u3059',
        kk: '\u0428\u0442\u0430\u0442 \u0442\u0430\u04A3\u0434\u0430\u04A3\u044B\u0437, \u0431\u0456\u0437 \u0441\u0456\u0437\u0433\u0435 \u049B\u0430\u0439\u0442\u0430\u0440\u044B\u043C \u044B\u049B\u0442\u0438\u043C\u0430\u043B\u0434\u044B\u0493\u044B\u043D \u0431\u0456\u0440\u0434\u0435\u043D \u0430\u0439\u0442\u0430\u043C\u044B\u0437',
        km: '\u1787\u17D2\u179A\u17BE\u179F\u179A\u17BE\u179F\u179A\u178A\u17D2\u178B\u1798\u17BD\u1799 \u17A0\u17BE\u1799\u1799\u17BE\u1784\u1793\u17B9\u1784\u1794\u17D2\u179A\u17B6\u1794\u17CB\u17A2\u17D2\u1793\u1780\u1797\u17D2\u179B\u17B6\u1798\u17D7\u1790\u17B6\u178F\u17BE\u1798\u17B6\u1793\u179B\u1791\u17D2\u1792\u1797\u17B6\u1796\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793\u1780\u17B6\u179A\u179F\u1784\u1794\u17D2\u179A\u17B6\u1780\u17CB\u179C\u17B7\u1789\u17AC\u17A2\u178F\u17CB',
        ky: '\u0428\u0442\u0430\u0442 \u0442\u0430\u043D\u0434\u0430\u04A3\u044B\u0437, \u0431\u0438\u0437 \u0441\u0438\u0437\u0433\u0435 \u043A\u0430\u0439\u0442\u0430\u0440\u044B\u043C \u044B\u043A\u0442\u044B\u043C\u0430\u043B\u0434\u044B\u0433\u044B\u043D \u0434\u0430\u0440\u043E\u043E \u0430\u0439\u0442\u0430\u0431\u044B\u0437',
        lo: '\u0EC0\u0EA5\u0EB7\u0EAD\u0E81\u0EA5\u0EB1\u0E94\u0EC1\u0EA5\u0EC9\u0EA7\u0E9E\u0EA7\u0E81\u0EC0\u0EAE\u0EBB\u0EB2\u0E88\u0EB0\u0E9A\u0EAD\u0E81\u0E97\u0EC8\u0EB2\u0E99\u0E97\u0EB1\u0E99\u0E97\u0EB5\u0EA7\u0EC8\u0EB2\u0EA1\u0EB5\u0EC2\u0EAD\u0E81\u0EB2\u0E94\u0EC4\u0E94\u0EC9\u0EAE\u0EB1\u0E9A\u0EC0\u0E87\u0EB4\u0E99\u0E84\u0EB7\u0E99\u0EAB\u0EBC\u0EB7\u0E9A\u0ECD\u0EC8',
        mn: '\u041C\u0443\u0436\u0430\u0430 \u0441\u043E\u043D\u0433\u043E\u043E\u0434 \u0431\u0438\u0434 \u0442\u0430\u043D\u0434 \u0431\u0443\u0446\u0430\u0430\u043D \u043E\u043B\u0433\u043E\u043B\u0442 \u0430\u0432\u0430\u0445 \u043C\u0430\u0433\u0430\u0434\u043B\u0430\u043B\u044B\u0433 \u0448\u0443\u0443\u0434 \u0445\u044D\u043B\u0436 \u04E9\u0433\u043D\u04E9',
        my: '\u1015\u103C\u100A\u103A\u1014\u101A\u103A\u1010\u1005\u103A\u1001\u102F\u1000\u102D\u102F \u101B\u103D\u1031\u1038\u1001\u103B\u101A\u103A\u1015\u102B\u1000 \u1015\u103C\u1014\u103A\u1021\u1019\u103A\u1038\u1004\u103D\u1031\u101B\u1014\u102D\u102F\u1004\u103A\u1001\u103C\u1031\u1000\u102D\u102F \u1001\u103B\u1000\u103A\u1001\u103B\u1004\u103A\u1038\u1015\u103C\u1031\u102C\u1015\u103C\u1015\u102B\u1019\u100A\u103A',
        ne: '\u0930\u093E\u091C\u094D\u092F \u091B\u093E\u0928\u094D\u0928\u0941\u0939\u094B\u0938\u094D, \u0939\u093E\u092E\u0940 \u0924\u092A\u093E\u0908\u0902\u0932\u093E\u0908 \u0924\u0941\u0930\u0941\u0928\u094D\u0924\u0948 \u092B\u093F\u0930\u094D\u0924\u093E \u092A\u093E\u0909\u0928\u0947 \u0938\u092E\u094D\u092D\u093E\u0935\u0928\u093E \u092C\u0924\u093E\u0909\u0928\u0947\u091B\u094C\u0902',
        si: '\u0DB4\u0DCA\u200D\u0DBB\u0DCF\u0DB1\u0DCA\u0DAD\u0DBA\u0D9A\u0DCA \u0DAD\u0DDD\u0DBB\u0DB1\u0DCA\u0DB1, \u0D85\u0DB4\u0DD2 \u0D94\u0DB6\u0DA7 \u0DC0\u0DC4\u0DCF\u0DB8 \u0D86\u0DB4\u0DC3\u0DD4 \u0D9C\u0DD9\u0DC0\u0DD3\u0DB8\u0D9A\u0DCA \u0DBD\u0DD0\u0DB6\u0DD3\u0DB8\u0DDA \u0DC4\u0DD0\u0D9A\u0DD2\u0DBA\u0DCF\u0DC0 \u0DB4\u0DC0\u0DC3\u0DB1\u0DCA\u0DB1\u0DD9\u0DB8\u0DD4',
        tl: 'Pumili ng estado at agad naming sasabihin sa iyo kung malamang na may refund',
        ur: '\u0627\u06CC\u06A9 \u0631\u06CC\u0627\u0633\u062A \u0645\u0646\u062A\u062E\u0628 \u06A9\u0631\u06CC\u06BA \u0627\u0648\u0631 \u06C1\u0645 \u0641\u0648\u0631\u06CC \u0637\u0648\u0631 \u067E\u0631 \u0628\u062A\u0627\u0626\u06CC\u06BA \u06AF\u06D2 \u06A9\u06C1 \u0631\u06CC\u0641\u0646\u0688 \u06A9\u0627 \u0627\u0645\u06A9\u0627\u0646 \u06C1\u06D2 \u06CC\u0627 \u0646\u06C1\u06CC\u06BA',
        uz: "Shtatni tanlang, biz sizga qaytarim olish ehtimolini darhol aytamiz",
      }
    );
    resultEl.className = 'refund-wizard-result';
    return;
  }

  const STATE_DISPLAY_NAMES = {
    AL: '\uC575\uB77C\uBC14\uB9C8', AK: '\uC54C\uB798\uC2A4\uCE74', AZ: '\uC560\uB9AC\uC870\uB098', AR: '\uC544\uCE78\uC18C', CA: '\uCE98\uB9AC\uD3EC\uB2C8\uC544',
    CO: '\uCF5C\uB85C\uB77C\uB3C4', CT: '\uCF54\uB124\uD2F0\uCEF7', DE: '\uB378\uB77C\uC6E8\uC5B4', FL: '\uD50C\uB85C\uB9AC\uB2E4', GA: '\uC870\uC9C0\uC544',
    HI: '\uD558\uC640\uC774', ID: '\uC544\uC774\uB2E4\uD638', IL: '\uC77C\uB9AC\uB178\uC774', IN: '\uC778\uB514\uC544\uB098', IA: '\uC544\uC774\uC624\uC640',
    KS: '\uCE94\uC790\uC2A4', KY: '\uCF00\uD130\uD0A4', LA: '\uB8E8\uC774\uC9C0\uC544\uB098', ME: '\uBA54\uC778', MD: '\uBA54\uB9B4\uB79C\uB4DC',
    MA: '\uB9E4\uC0AC\uCD94\uC138\uCE20', MI: '\uBBF8\uC2DC\uAC74', MN: '\uBBF8\uB124\uC18C\uD0C0', MS: '\uBBF8\uC2DC\uC2DC\uD53C', MO: '\uBBF8\uC8FC\uB9AC',
    MT: '\uBAAC\uD0C0\uB098', NE: '\uB124\uBE0C\uB798\uC2A4\uCE74', NV: '\uB124\uBC14\uB2E4', NH: '\uB274\uD584\uD504\uC154', NJ: '\uB274\uC800\uC9C0',
    NM: '\uB274\uBA55\uC2DC\uCF54', NY: '\uB274\uC695', NC: '\uB178\uC2A4\uCE90\uB864\uB77C\uC774\uB098', ND: '\uB178\uC2A4\uB2E4\uCF54\uD0C0', OH: '\uC624\uD558\uC774\uC624',
    OK: '\uC624\uD074\uB77C\uD638\uB9C8', OR: '\uC624\uB9AC\uAC74', PA: '\uD39C\uC2E4\uBC14\uB2C8\uC544', RI: '\uB85C\uB4DC\uC544\uC77C\uB79C\uB4DC', SC: '\uC0AC\uC6B0\uC2A4\uCE90\uB864\uB77C\uC774\uB098',
    SD: '\uC0AC\uC6B0\uC2A4\uB2E4\uCF54\uD0C0', TN: '\uD14C\uB124\uC2DC', TX: '\uD14D\uC0AC\uC2A4', UT: '\uC720\uD0C0', VT: '\uBC84\uBAAC\uD2B8',
    VA: '\uBC84\uC9C0\uB2C8\uC544', WA: '\uC6CC\uC2F1\uD134', DC: '\uC6CC\uC2F1\uD134 D.C.', WV: '\uC6E8\uC2A4\uD2B8\uBC84\uC9C0\uB2C8\uC544', WI: '\uC704\uC2A4\uCEE8\uC2E0',
    WY: '\uC640\uC774\uC624\uBC0D',
  };
  const STATE_DISPLAY_NAMES_EN = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', DC: 'Washington D.C.', WV: 'West Virginia', WI: 'Wisconsin',
    WY: 'Wyoming',
  };
  const STATE_DISPLAY_NAMES_ZH = {
    AL: '\u963F\u62C9\u5DF4\u9A6C', AK: '\u963F\u62C9\u65AF\u52A0', AZ: '\u4E9A\u5229\u6851\u90A3', AR: '\u963F\u80AF\u8272', CA: '\u52A0\u5229\u798F\u5C3C\u4E9A',
    CO: '\u79D1\u7F57\u62C9\u591A', CT: '\u5EB7\u6D85\u72C4\u683C', DE: '\u7279\u62C9\u534E', FL: '\u4F5B\u7F57\u91CC\u8FBE', GA: '\u4F50\u6CBB\u4E9A',
    HI: '\u590F\u5A01\u5937', ID: '\u7231\u8FBE\u8377', IL: '\u4F0A\u5229\u8BFA\u4F0A', IN: '\u5370\u7B2C\u5B89\u7EB3', IA: '\u827E\u5965\u74E6',
    KS: '\u5821\u8428\u65AF', KY: '\u80AF\u5854\u57FA', LA: '\u8DEF\u6613\u65AF\u5B89\u90A3', ME: '\u7F05\u56E0', MD: '\u9A6C\u91CC\u5170',
    MA: '\u9A6C\u8428\u8BF8\u585E', MI: '\u5BC6\u6B47\u6839', MN: '\u660E\u5C3C\u82CF\u8FBE', MS: '\u5BC6\u897F\u897F\u6BD4', MO: '\u5BC6\u82CF\u91CC',
    MT: '\u8499\u5927\u62FF', NE: '\u5185\u5E03\u62C9\u65AF\u52A0', NV: '\u5185\u534E\u8FBE', NH: '\u65B0\u7F55\u5E03\u4EC0\u5C14', NJ: '\u65B0\u6CFD\u897F',
    NM: '\u65B0\u58A8\u897F\u54E5', NY: '\u7EBD\u7EA6', NC: '\u5317\u5361\u7F57\u6765\u7EB3', ND: '\u5317\u8FBE\u79D1\u4ED6', OH: '\u4FC4\u4EA5\u4FC4',
    OK: '\u4FC4\u514B\u62C9\u4F55\u9A6C', OR: '\u4FC4\u52D2\u5188', PA: '\u5BBE\u5915\u6CD5\u5C3C\u4E9A', RI: '\u7F57\u5FB7\u5C9B', SC: '\u5357\u5361\u7F57\u6765\u7EB3',
    SD: '\u5357\u8FBE\u79D1\u4ED6', TN: '\u7530\u7EB3\u897F', TX: '\u5F97\u514B\u8428\u65AF', UT: '\u72B9\u4ED6', VT: '\u4F5B\u8499\u7279',
    VA: '\u5F17\u5409\u5C3C\u4E9A', WA: '\u534E\u76DB\u987F', DC: '\u534E\u76DB\u987F\u7279\u533A', WV: '\u897F\u5F17\u5409\u5C3C\u4E9A', WI: '\u5A01\u65AF\u5EB7\u661F',
    WY: '\u6021\u4FC4\u660E',
  };
  // 베트남어는 미국 주 이름을 영문 표기 그대로 쓰는 게 관행이라 별도 표 없이 EN 표를 재사용
  const STATE_DISPLAY_NAMES_TH = {
    AL: 'แอละแบมา', AK: 'อะแลสกา', AZ: 'แอริโซนา', AR: 'อาร์คันซอ', CA: 'แคลิฟอร์เนีย',
    CO: 'โคโลราโด', CT: 'คอนเนตทิคัต', DE: 'เดลาแวร์', FL: 'ฟลอริดา', GA: 'จอร์เจีย',
    HI: 'ฮาวาย', ID: 'ไอดาโฮ', IL: 'อิลลินอยส์', IN: 'อินดีแอนา', IA: 'ไอโอวา',
    KS: 'แคนซัส', KY: 'เคนตักกี', LA: 'หลุยเซียนา', ME: 'เมน', MD: 'แมริแลนด์',
    MA: 'แมสซาชูเซตส์', MI: 'มิชิแกน', MN: 'มินนิโซตา', MS: 'มิสซิสซิปปี', MO: 'มิสซูรี',
    MT: 'มอนแทนา', NE: 'เนแบรสกา', NV: 'เนวาดา', NH: 'นิวแฮมป์เชียร์', NJ: 'นิวเจอร์ซีย์',
    NM: 'นิวเม็กซิโก', NY: 'นิวยอร์ก', NC: 'นอร์ทแคโรไลนา', ND: 'นอร์ทดาโคตา', OH: 'โอไฮโอ',
    OK: 'โอคลาโฮมา', OR: 'ออริกอน', PA: 'เพนซิลเวเนีย', RI: 'โรดไอแลนด์', SC: 'เซาท์แคโรไลนา',
    SD: 'เซาท์ดาโคตา', TN: 'เทนเนสซี', TX: 'เท็กซัส', UT: 'ยูทาห์', VT: 'เวอร์มอนต์',
    VA: 'เวอร์จิเนีย', WA: 'วอชิงตัน', DC: 'วอชิงตัน ดี.ซี.', WV: 'เวสต์เวอร์จิเนีย', WI: 'วิสคอนซิน',
    WY: 'ไวโอมิง',
  };
  const STATE_DISPLAY_NAMES_RU = {
    AL: 'Алабама', AK: 'Аляска', AZ: 'Аризона', AR: 'Арканзас', CA: 'Калифорния',
    CO: 'Колорадо', CT: 'Коннектикут', DE: 'Делавэр', FL: 'Флорида', GA: 'Джорджия',
    HI: 'Гавайи', ID: 'Айдахо', IL: 'Иллинойс', IN: 'Индиана', IA: 'Айова',
    KS: 'Канзас', KY: 'Кентукки', LA: 'Луизиана', ME: 'Мэн', MD: 'Мэриленд',
    MA: 'Массачусетс', MI: 'Мичиган', MN: 'Миннесота', MS: 'Миссисипи', MO: 'Миссури',
    MT: 'Монтана', NE: 'Небраска', NV: 'Невада', NH: 'Нью-Гэмпшир', NJ: 'Нью-Джерси',
    NM: 'Нью-Мексико', NY: 'Нью-Йорк', NC: 'Северная Каролина', ND: 'Северная Дакота', OH: 'Огайо',
    OK: 'Оклахома', OR: 'Орегон', PA: 'Пенсильвания', RI: 'Род-Айленд', SC: 'Южная Каролина',
    SD: 'Южная Дакота', TN: 'Теннесси', TX: 'Техас', UT: 'Юта', VT: 'Вермонт',
    VA: 'Вирджиния', WA: 'Вашингтон', DC: 'Вашингтон (округ Колумбия)', WV: 'Западная Вирджиния', WI: 'Висконсин',
    WY: 'Вайоминг',
  };
  const NO_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];
  const EXEMPT_STATES = ['CA'];
  const UNCERTAIN_STATES = ['MD'];
  const stateInfo = STATE_TAX_RATES[stateCode];
  const stateName = pickLang(STATE_DISPLAY_NAMES[stateCode], STATE_DISPLAY_NAMES_EN[stateCode], STATE_DISPLAY_NAMES_ZH[stateCode], STATE_DISPLAY_NAMES_EN[stateCode], STATE_DISPLAY_NAMES_TH[stateCode], STATE_DISPLAY_NAMES_RU[stateCode], buildStateNameMore(stateCode));

  let msg, cls;
  if (NO_TAX_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u2715 \uC774 \uC8FC(${stateName})\uB294 \uC8FC \uC18C\uB4DD\uC138 \uC790\uCCB4\uAC00 \uC5C6\uB294 \uBB34\uACFC\uC138 \uC8FC\uC608\uC694. \uC560\uCD08\uC5D0 \uC6D0\uCC9C\uC9D5\uC218\uB41C \uAC8C \uC5C6\uC5B4\uC11C \uB3CC\uB824\uBC1B\uC744 \uAC83\uB3C4 \uC5C6\uC5B4\uC694.`,
      `\u2715 This state (${stateName}) has no state income tax at all. Nothing was withheld in the first place, so there\u2019s nothing to get back.`,
      `\u2715 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u6839\u672C\u6CA1\u6709\u5DDE\u6240\u5F97\u7A0E\u3002\u672C\u6765\u5C31\u6CA1\u6709\u9884\u6263\u8FC7\u7A0E\u6B3E\uFF0C\u6240\u4EE5\u6CA1\u6709\u53EF\u9000\u7684\u90E8\u5206\u3002`,
      `\u2715 Bang n\u00E0y (${stateName}) ho\u00E0n to\u00E0n kh\u00F4ng c\u00F3 thu\u1EBF thu nh\u1EADp bang. V\u00EC kh\u00F4ng b\u1ECB kh\u1EA5u tr\u1EEB g\u00EC ngay t\u1EEB \u0111\u1EA7u n\u00EAn kh\u00F4ng c\u00F3 g\u00EC \u0111\u1EC3 l\u1EA5y l\u1EA1i.`,
      `\u2715 \u0E21\u0E25\u0E23\u0E31\u0E10\u0E19\u0E35\u0E49 (${stateName}) \u0E44\u0E21\u0E48\u0E21\u0E35\u0E20\u0E32\u0E29\u0E35\u0E40\u0E07\u0E34\u0E19\u0E44\u0E14\u0E49\u0E21\u0E25\u0E23\u0E31\u0E10\u0E40\u0E25\u0E22 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E41\u0E23\u0E01 \u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E02\u0E2D\u0E04\u0E37\u0E19`,
      `\u2715 \u0412 \u044D\u0442\u043E\u043C \u0448\u0442\u0430\u0442\u0435 (${stateName}) \u0432\u043E\u043E\u0431\u0449\u0435 \u043D\u0435\u0442 \u043F\u043E\u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u043D\u0430\u043B\u043E\u0433\u0430 \u0448\u0442\u0430\u0442\u0430. \u0418\u0437\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u043B\u043E\u0441\u044C, \u0442\u0430\u043A \u0447\u0442\u043E \u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E.`,
      {
        ar: `\u2715 \u0647\u0630\u0647 \u0627\u0644\u0648\u0644\u0627\u064A\u0629 (${stateName}) \u0644\u0627 \u062A\u0641\u0631\u0636 \u0623\u064A \u0636\u0631\u064A\u0628\u0629 \u062F\u062E\u0644 \u0639\u0644\u0649 \u0627\u0644\u0625\u0637\u0644\u0627\u0642. \u0644\u0645 \u064A\u062A\u0645 \u0627\u0642\u062A\u0637\u0627\u0639 \u0623\u064A \u0634\u064A\u0621 \u0645\u0646 \u0627\u0644\u0623\u0633\u0627\u0633\u060C \u0644\u0630\u0627 \u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0627 \u062A\u0633\u062A\u0639\u064A\u062F\u0647.`,
        bn: `\u2715 \u098F\u0987 \u09B0\u09BE\u099C\u09CD\u09AF\u09C7 (${stateName}) \u0995\u09CB\u09A8\u09CB \u09B0\u09BE\u099C\u09CD\u09AF \u0986\u09AF\u09BC\u0995\u09B0 \u09A8\u09C7\u0987\u0964 \u09AA\u09CD\u09B0\u09A5\u09AE \u09A5\u09C7\u0995\u09C7\u0987 \u0995\u09BF\u099B\u09C1 \u0995\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09A8\u09BF, \u09A4\u09BE\u0987 \u09AB\u09C7\u09B0\u09A4 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE\u09B0 \u0995\u09BF\u099B\u09C1 \u09A8\u09C7\u0987\u0964`,
        fr: `\u2715 Cet \u00C9tat (${stateName}) n'a aucun imp\u00F4t sur le revenu d'\u00C9tat. Rien n'a \u00E9t\u00E9 retenu au d\u00E9part, donc il n'y a rien \u00E0 r\u00E9cup\u00E9rer.`,
        hi: `\u2715 \u0907\u0938 \u0930\u093E\u091C\u094D\u092F (${stateName}) \u092E\u0947\u0902 \u0930\u093E\u091C\u094D\u092F \u0906\u092F\u0915\u0930 \u092C\u093F\u0932\u094D\u0915\u0941\u0932 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0936\u0941\u0930\u0941\u0906\u0924 \u092E\u0947\u0902 \u0939\u0940 \u0915\u0941\u091B \u0928\u0939\u0940\u0902 \u0915\u093E\u091F\u093E \u0917\u092F\u093E, \u0907\u0938\u0932\u093F\u090F \u0935\u093E\u092A\u0938 \u092A\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u0941\u091B \u0928\u0939\u0940\u0902 \u0939\u0948\u0964`,
        id: `\u2715 Negara bagian ini (${stateName}) sama sekali tidak memiliki pajak penghasilan negara bagian. Sejak awal tidak ada yang dipotong, jadi tidak ada yang bisa dikembalikan.`,
        ja: `\u2715 \u3053\u306E\u5DDE\uFF08${stateName}\uFF09\u306B\u306F\u5DDE\u6240\u5F97\u7A0E\u81EA\u4F53\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u305D\u3082\u305D\u3082\u6E90\u6CC9\u5FB4\u53CE\u3055\u308C\u3066\u3044\u306A\u3044\u306E\u3067\u3001\u623B\u3063\u3066\u304F\u308B\u3082\u306E\u3082\u3042\u308A\u307E\u305B\u3093\u3002`,
        kk: `\u2715 \u0411\u04B1\u043B \u0448\u0442\u0430\u0442\u0442\u0430 (${stateName}) \u0448\u0442\u0430\u0442\u0442\u044B\u04A3 \u0442\u0430\u0431\u044B\u0441 \u0441\u0430\u043B\u044B\u0493\u044B \u043C\u04AF\u043B\u0434\u0435\u043C \u0436\u043E\u049B. \u0411\u0430\u0441\u0442\u0430\u043F\u049B\u044B\u0434\u0430 \u0435\u0448\u043D\u04D9\u0440\u0441\u0435 \u04B1\u0441\u0442\u0430\u043B\u043C\u0430\u0493\u0430\u043D\u0434\u044B\u049B\u0442\u0430\u043D, \u049B\u0430\u0439\u0442\u0430\u0440\u044B\u043B\u0430\u0442\u044B\u043D \u0434\u0430 \u0435\u0448\u0442\u0435\u04A3\u0435 \u0436\u043E\u049B.`,
        km: `\u2715 \u179A\u178A\u17D2\u178B\u1793\u17C1\u17C7 (${stateName}) \u1798\u17B7\u1793\u1798\u17B6\u1793\u1796\u1793\u17D2\u1792\u179B\u17BE\u1794\u17D2\u179A\u17B6\u1780\u17CB\u1785\u17C6\u178E\u17BC\u179B\u179A\u178A\u17D2\u178B\u1791\u17B6\u179B\u17CB\u178F\u17C2\u179F\u17C4\u17C7\u17D4 \u1782\u17D2\u1798\u17B6\u1793\u17A2\u17D2\u179C\u17B8\u178F\u17D2\u179A\u17BC\u179C\u1794\u17B6\u1793\u1780\u17B6\u178F\u17CB\u1791\u17BB\u1780\u178F\u17B6\u17C6\u1784\u1796\u17B8\u178A\u17C6\u1794\u17BC\u1784\u1791\u17C1 \u178A\u17BC\u1785\u17D2\u1793\u17C1\u17C7\u1782\u17D2\u1798\u17B6\u1793\u17A2\u17D2\u179C\u17B8\u178F\u17D2\u179A\u17BC\u179C\u1791\u17B6\u1798\u1791\u17B6\u179A\u178F\u17D2\u179A\u17A1\u1794\u17CB\u179C\u17B7\u1789\u17A1\u17BE\u1799\u17D4`,
        ky: `\u2715 \u0411\u0443\u043B \u0448\u0442\u0430\u0442\u0442\u0430 (${stateName}) \u0448\u0442\u0430\u0442\u0442\u044B\u043D \u043A\u0438\u0440\u0435\u0448\u0435 \u0441\u0430\u043B\u044B\u0433\u044B \u0442\u0430\u043A\u044B\u0440 \u0436\u043E\u043A. \u0411\u0430\u0448\u044B\u043D\u0430\u043D \u044D\u043B\u0435 \u044D\u0447 \u043D\u0435\u0440\u0441\u0435 \u043A\u0430\u0440\u043C\u0430\u043B\u0433\u0430\u043D \u044D\u043C\u0435\u0441, \u043E\u0448\u043E\u043D\u0434\u0443\u043A\u0442\u0430\u043D \u043A\u0430\u0439\u0442\u0430\u0440\u044B\u043B\u0447\u0443 \u043D\u0435\u0440\u0441\u0435 \u0436\u043E\u043A.`,
        lo: `\u2715 \u0EA5\u0EB1\u0E94\u0E99\u0EB5\u0EC9 (${stateName}) \u0E9A\u0ECD\u0EC8\u0EA1\u0EB5\u0E9E\u0EB2\u0EAA\u0EB5\u0EA5\u0EB2\u0E8D\u0EC4\u0E94\u0EC9\u0E82\u0EAD\u0E87\u0EA5\u0EB1\u0E94\u0EC0\u0EA5\u0EB5\u0E8D. \u0E9A\u0ECD\u0EC8\u0EA1\u0EB5\u0E81\u0EB2\u0E99\u0EAB\u0EB1\u0E81\u0EAB\u0E8D\u0EB1\u0E87\u0EC1\u0E95\u0EC8\u0E95\u0EBB\u0EC9\u0E99 \u0E94\u0EB1\u0EC8\u0E87\u0E99\u0EB1\u0EC9\u0E99\u0E88\u0EB4\u0EC8\u0E87\u0E9A\u0ECD\u0EC8\u0EA1\u0EB5\u0EAB\u0E8D\u0EB1\u0E87\u0EC3\u0EAB\u0EC9\u0E82\u0ECD\u0E84\u0EB7\u0E99.`,
        mn: `\u2715 \u042D\u043D\u044D \u043C\u0443\u0436\u0438\u0434 (${stateName}) \u043C\u0443\u0436\u0438\u0439\u043D \u043E\u0440\u043B\u043E\u0433\u044B\u043D \u0442\u0430\u0442\u0432\u0430\u0440 \u043E\u0433\u0442 \u0431\u0430\u0439\u0445\u0433\u04AF\u0439. \u042D\u0445\u043D\u044D\u044D\u0441 \u043D\u044C \u044F\u043C\u0430\u0440 \u0447 \u0441\u0443\u0443\u0442\u0433\u0430\u043B \u0445\u0438\u0439\u0433\u0434\u044D\u044D\u0433\u04AF\u0439 \u0442\u0443\u043B \u0431\u0443\u0446\u0430\u0430\u043D \u0430\u0432\u0430\u0445 \u0437\u04AF\u0439\u043B \u0431\u0430\u0439\u0445\u0433\u04AF\u0439.`,
        my: `\u2715 \u1024\u1015\u103C\u100A\u103A\u1014\u101A\u103A (${stateName}) \u1010\u103D\u1004\u103A \u1015\u103C\u100A\u103A\u1014\u101A\u103A\u101D\u1004\u103A\u1004\u103D\u1031\u1001\u103D\u1014\u103A \u101C\u102F\u1036\u1038\u101D\u1019\u101B\u103E\u102D\u1015\u102B\u104B \u1021\u1005\u1000\u1010\u100A\u103A\u1038\u1000 \u1018\u102C\u1019\u103E \u1001\u102F\u1014\u103E\u102D\u1019\u103A\u1011\u102C\u1038\u1001\u103C\u1004\u103A\u1038\u1019\u101B\u103E\u102D\u101E\u1031\u102C\u1000\u103C\u1031\u102C\u1004\u1037\u103A \u1015\u103C\u1014\u103A\u101B\u101B\u1014\u103A \u1018\u102C\u1019\u103E\u1019\u101B\u103E\u102D\u1015\u102B\u104B`,
        ne: `\u2715 \u092F\u094B \u0930\u093E\u091C\u094D\u092F\u092E\u093E (${stateName}) \u0930\u093E\u091C\u094D\u092F \u0906\u092F\u0915\u0930 \u0928\u0948 \u091B\u0948\u0928\u0964 \u0938\u0941\u0930\u0941\u092E\u0948 \u0915\u0947\u0939\u0940 \u0915\u091F\u094C\u0924\u0940 \u0928\u092D\u090F\u0915\u093E\u0932\u0947 \u092B\u093F\u0930\u094D\u0924\u093E \u092A\u093E\u0909\u0928\u0947 \u0915\u0947\u0939\u0940 \u091B\u0948\u0928\u0964`,
        si: `\u2715 \u0DB8\u0DD9\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DCF\u0DB1\u0DCA\u0DAD\u0DBA\u0DDA (${stateName}) \u0DB4\u0DCA\u200D\u0DBB\u0DCF\u0DB1\u0DCA\u0DAD \u0D86\u0DAF\u0DCF\u0DBA\u0DB8\u0DCA \u0DB6\u0DAF\u0DCA\u0DAF\u0D9A\u0DCA \u0DC3\u0DB8\u0DCA\u0DB4\u0DD6\u0DBB\u0DCA\u0DAB\u0DBA\u0DD9\u0DB1\u0DCA\u0DB8 \u0DB1\u0DDC\u0DB8\u0DD0\u0DAD. \u0DB8\u0DD4\u0DBD\u0DD2\u0DB1\u0DCA\u0DB8 \u0D9A\u0DD2\u0DC3\u0DD2\u0DC0\u0D9A\u0DCA \u0D85\u0DA9\u0DD4 \u0D9A\u0DBB \u0DB1\u0DDC\u0DAD\u0DD2\u0DB6\u0DD6 \u0DB1\u0DD2\u0DC3\u0DCF \u0D86\u0DB4\u0DC3\u0DD4 \u0DBD\u0DB6\u0DCF \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DA7 \u0D9A\u0DD2\u0DC3\u0DD2\u0DC0\u0D9A\u0DCA \u0DB1\u0DD0\u0DAD.`,
        tl: `\u2715 Ang estadong ito (${stateName}) ay walang state income tax. Wala talagang na-withhold sa simula pa lang, kaya walang mababawi.`,
        ur: `\u2715 \u0627\u0633 \u0631\u06CC\u0627\u0633\u062A (${stateName}) \u0645\u06CC\u06BA \u0631\u06CC\u0627\u0633\u062A\u06CC \u0627\u0646\u06A9\u0645 \u0679\u06CC\u06A9\u0633 \u0628\u0627\u0644\u06A9\u0644 \u0646\u06C1\u06CC\u06BA \u06C1\u06D2\u06D4 \u0634\u0631\u0648\u0639 \u0633\u06D2 \u06C1\u06CC \u06A9\u0686\u06BE \u0646\u06C1\u06CC\u06BA \u06A9\u0627\u0679\u0627 \u06AF\u06CC\u0627\u060C \u0627\u0633 \u0644\u06CC\u06D2 \u0648\u0627\u067E\u0633 \u0644\u06CC\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u06A9\u0686\u06BE \u0646\u06C1\u06CC\u06BA \u06C1\u06D2\u06D4`,
        uz: `\u2715 Bu shtatda (${stateName}) shtat daromad solig'i umuman yo'q. Boshidanoq hech narsa ushlab qolinmagan, shuning uchun qaytarib oladigan narsa yo'q.`,
      }
    );
    cls = 'tag-none';
  } else if (EXEMPT_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u2715 \uC774 \uC8FC(${stateName})\uB294 \uC8FC \uC18C\uB4DD\uC138\uB294 \uC788\uC9C0\uB9CC \uBCF5\uAD8C \uB2F9\uCCA8\uAE08\uC740 \uBCC4\uB3C4\uB85C \uBA74\uC81C\uD574\uC918\uC694. \uC774\uAC83\uB3C4 \uB3CC\uB824\uBC1B\uC744 \uAC8C \uC5C6\uB294 \uACBD\uC6B0\uC608\uC694.`,
      `\u2715 This state (${stateName}) has state income tax, but exempts lottery winnings specifically. This is also a case where there\u2019s nothing to get back.`,
      `\u2715 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u6709\u5DDE\u6240\u5F97\u7A0E\uFF0C\u4F46\u5F69\u7968\u4E2D\u5956\u91D1\u5355\u72EC\u514D\u7A0E\u3002\u8FD9\u4E5F\u662F\u6CA1\u6709\u53EF\u9000\u90E8\u5206\u7684\u60C5\u51B5\u3002`,
      `\u2715 Bang n\u00E0y (${stateName}) c\u00F3 thu\u1EBF thu nh\u1EADp bang, nh\u01B0ng mi\u1EC5n ri\u00EAng cho ti\u1EC1n th\u1EAFng x\u1ED5 s\u1ED1. \u0110\u00E2y c\u0169ng l\u00E0 tr\u01B0\u1EDDng h\u1EE3p kh\u00F4ng c\u00F3 g\u00EC \u0111\u1EC3 l\u1EA5y l\u1EA1i.`,
      `\u2715 \u0E21\u0E25\u0E23\u0E31\u0E10\u0E19\u0E35\u0E49 (${stateName}) \u0E21\u0E35\u0E20\u0E32\u0E29\u0E35\u0E40\u0E07\u0E34\u0E19\u0E44\u0E14\u0E49\u0E21\u0E25\u0E23\u0E31\u0E10 \u0E41\u0E15\u0E48\u0E22\u0E01\u0E40\u0E27\u0E49\u0E19\u0E40\u0E07\u0E34\u0E19\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E25\u0E2D\u0E15\u0E40\u0E15\u0E2D\u0E23\u0E35\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E32\u0E23\u0E40\u0E09\u0E1E\u0E32\u0E30 \u0E19\u0E35\u0E48\u0E01\u0E47\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E13\u0E35\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E02\u0E2D\u0E04\u0E37\u0E19\u0E40\u0E0A\u0E48\u0E19\u0E01\u0E31\u0E19`,
      `\u2715 \u0412 \u044D\u0442\u043E\u043C \u0448\u0442\u0430\u0442\u0435 (${stateName}) \u0435\u0441\u0442\u044C \u043F\u043E\u0434\u043E\u0445\u043E\u0434\u043D\u044B\u0439 \u043D\u0430\u043B\u043E\u0433 \u0448\u0442\u0430\u0442\u0430, \u043D\u043E \u0432\u044B\u0438\u0433\u0440\u044B\u0448\u0438 \u0432 \u043B\u043E\u0442\u0435\u0440\u0435\u044E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u044B \u043E\u0442 \u043D\u0435\u0433\u043E. \u042D\u0442\u043E \u0442\u043E\u0436\u0435 \u0441\u043B\u0443\u0447\u0430\u0439, \u043A\u043E\u0433\u0434\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E.`,
      {
        ar: `\u2715 \u0647\u0630\u0647 \u0627\u0644\u0648\u0644\u0627\u064A\u0629 (${stateName}) \u0644\u062F\u064A\u0647\u0627 \u0636\u0631\u064A\u0628\u0629 \u062F\u062E\u0644 \u0639\u0644\u0649 \u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0648\u0644\u0627\u064A\u0629\u060C \u0644\u0643\u0646\u0647\u0627 \u062A\u0639\u0641\u064A \u0623\u0631\u0628\u0627\u062D \u0627\u0644\u064A\u0627\u0646\u0635\u064A\u0628 \u062A\u062D\u062F\u064A\u062F\u064B\u0627. \u0647\u0630\u0647 \u0623\u064A\u0636\u064B\u0627 \u062D\u0627\u0644\u0629 \u0644\u0627 \u064A\u0648\u062C\u062F \u0641\u064A\u0647\u0627 \u0645\u0627 \u062A\u0633\u062A\u0639\u064A\u062F\u0647.`,
        bn: `\u2715 \u098F\u0987 \u09B0\u09BE\u099C\u09CD\u09AF\u09C7 (${stateName}) \u09B0\u09BE\u099C\u09CD\u09AF \u0986\u09AF\u09BC\u0995\u09B0 \u0986\u099B\u09C7, \u09A4\u09AC\u09C7 \u09B2\u099F\u09BE\u09B0\u09BF \u099C\u09C7\u09A4\u09BE \u0985\u09B0\u09CD\u09A5 \u09AC\u09BF\u09B6\u09C7\u09B7\u09AD\u09BE\u09AC\u09C7 \u099B\u09BE\u09A1\u09BC \u09A6\u09C7\u0993\u09AF\u09BC\u09BE \u09B9\u09AF\u09BC\u0964 \u098F\u099F\u09BF\u0993 \u098F\u09AE\u09A8 \u098F\u0995\u099F\u09BF \u0995\u09CD\u09B7\u09C7\u09A4\u09CD\u09B0 \u09AF\u09C7\u0996\u09BE\u09A8\u09C7 \u09AB\u09C7\u09B0\u09A4 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE\u09B0 \u0995\u09BF\u099B\u09C1 \u09A8\u09C7\u0987\u0964`,
        fr: `\u2715 Cet \u00C9tat (${stateName}) a un imp\u00F4t sur le revenu d'\u00C9tat, mais exon\u00E8re sp\u00E9cifiquement les gains de loterie. C'est aussi un cas o\u00F9 il n'y a rien \u00E0 r\u00E9cup\u00E9rer.`,
        hi: `\u2715 \u0907\u0938 \u0930\u093E\u091C\u094D\u092F (${stateName}) \u092E\u0947\u0902 \u0930\u093E\u091C\u094D\u092F \u0906\u092F\u0915\u0930 \u0939\u0948, \u0932\u0947\u0915\u093F\u0928 \u0932\u0949\u091F\u0930\u0940 \u0915\u0940 \u091C\u0940\u0924 \u0915\u094B \u0935\u093F\u0936\u0947\u0937 \u0930\u0942\u092A \u0938\u0947 \u091B\u0942\u091F \u0926\u0940 \u0917\u0908 \u0939\u0948\u0964 \u092F\u0939 \u092D\u0940 \u090F\u0915 \u0910\u0938\u093E \u092E\u093E\u092E\u0932\u093E \u0939\u0948 \u091C\u0939\u093E\u0901 \u0935\u093E\u092A\u0938 \u092A\u093E\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F \u0915\u0941\u091B \u0928\u0939\u0940\u0902 \u0939\u0948\u0964`,
        id: `\u2715 Negara bagian ini (${stateName}) memiliki pajak penghasilan negara bagian, tetapi secara khusus membebaskan kemenangan lotre. Ini juga kasus di mana tidak ada yang bisa dikembalikan.`,
        ja: `\u2715 \u3053\u306E\u5DDE\uFF08${stateName}\uFF09\u306B\u306F\u5DDE\u6240\u5F97\u7A0E\u304C\u3042\u308A\u307E\u3059\u304C\u3001\u5B9D\u304F\u3058\u306E\u5F53\u9078\u91D1\u306F\u7279\u5225\u306B\u514D\u9664\u3055\u308C\u307E\u3059\u3002\u3053\u308C\u3082\u623B\u3063\u3066\u304F\u308B\u3082\u306E\u304C\u306A\u3044\u30B1\u30FC\u30B9\u3067\u3059\u3002`,
        kk: `\u2715 \u0411\u04B1\u043B \u0448\u0442\u0430\u0442\u0442\u0430 (${stateName}) \u0448\u0442\u0430\u0442\u0442\u044B\u04A3 \u0442\u0430\u0431\u044B\u0441 \u0441\u0430\u043B\u044B\u0493\u044B \u0431\u0430\u0440, \u0431\u0456\u0440\u0430\u049B \u043B\u043E\u0442\u0435\u0440\u0435\u044F \u04B1\u0442\u044B\u0441\u044B \u0430\u0440\u043D\u0430\u0439\u044B \u0431\u043E\u0441\u0430\u0442\u044B\u043B\u0493\u0430\u043D. \u0411\u04B1\u043B \u0434\u0430 \u049B\u0430\u0439\u0442\u0430\u0440\u044B\u043B\u0430\u0442\u044B\u043D \u0435\u0448\u0442\u0435\u04A3\u0435 \u0436\u043E\u049B \u0436\u0430\u0493\u0434\u0430\u0439.`,
        km: `\u2715 \u179A\u178A\u17D2\u178B\u1793\u17C1\u17C7 (${stateName}) \u1798\u17B6\u1793\u1796\u1793\u17D2\u1792\u179B\u17BE\u1794\u17D2\u179A\u17B6\u1780\u17CB\u1785\u17C6\u178E\u17BC\u179B\u179A\u178A\u17D2\u178B \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u179B\u17BE\u1780\u179B\u17C2\u1784\u1785\u17C6\u1796\u17C4\u17C7\u1794\u17D2\u179A\u17B6\u1780\u17CB\u1786\u17D2\u1793\u17C4\u178F\u178A\u17C4\u1799\u17A1\u17C2\u1780\u17D4 \u1793\u17C1\u17C7\u1780\u17CF\u1787\u17B6\u1780\u179A\u178E\u17B8\u1798\u17BD\u1799\u178A\u17C2\u179B\u1782\u17D2\u1798\u17B6\u1793\u17A2\u17D2\u179C\u17B8\u178F\u17D2\u179A\u17BC\u179C\u1791\u17B6\u1798\u1791\u17B6\u179A\u178F\u17D2\u179A\u17A1\u1794\u17CB\u179C\u17B7\u1789\u178A\u17C2\u179A\u17D4`,
        ky: `\u2715 \u0411\u0443\u043B \u0448\u0442\u0430\u0442\u0442\u0430 (${stateName}) \u0448\u0442\u0430\u0442\u0442\u044B\u043D \u043A\u0438\u0440\u0435\u0448\u0435 \u0441\u0430\u043B\u044B\u0433\u044B \u0431\u0430\u0440, \u0431\u0438\u0440\u043E\u043A \u043B\u043E\u0442\u0435\u0440\u0435\u044F \u0443\u0442\u0443\u0448\u0443 \u04E9\u0437\u0433\u04E9\u0447\u04E9 \u0431\u043E\u0448\u043E\u0442\u0443\u043B\u0433\u0430\u043D. \u0411\u0443\u043B \u0434\u0430 \u043A\u0430\u0439\u0442\u0430\u0440\u044B\u043B\u0447\u0443 \u043D\u0435\u0440\u0441\u0435 \u0436\u043E\u043A \u0443\u0447\u0443\u0440.`,
        lo: `\u2715 \u0EA5\u0EB1\u0E94\u0E99\u0EB5\u0EC9 (${stateName}) \u0EA1\u0EB5\u0E9E\u0EB2\u0EAA\u0EB5\u0EA5\u0EB2\u0E8D\u0EC4\u0E94\u0EC9\u0E82\u0EAD\u0E87\u0EA5\u0EB1\u0E94 \u0EC1\u0E95\u0EC8\u0E8D\u0EBB\u0E81\u0EC0\u0EA7\u0EB1\u0EC9\u0E99\u0EC0\u0E87\u0EB4\u0E99\u0EA5\u0EB2\u0E87\u0EA7\u0EB1\u0E99\u0EA5\u0EAD\u0E94\u0EC0\u0E95\u0EB5\u0EA3\u0EB5\u0EC0\u0E9B\u0EB1\u0E99\u0E9E\u0EB4\u0EC0\u0EAA\u0E94. \u0E99\u0EB5\u0EC9\u0E81\u0ECD\u0EC8\u0EC0\u0E9B\u0EB1\u0E99\u0E81\u0ECD\u0EA5\u0EB0\u0E99\u0EB5\u0E97\u0EB5\u0EC8\u0E9A\u0ECD\u0EC8\u0EA1\u0EB5\u0EAB\u0E8D\u0EB1\u0E87\u0EC3\u0EAB\u0EC9\u0E82\u0ECD\u0E84\u0EB7\u0E99\u0EC0\u0E8A\u0EB1\u0EC8\u0E99\u0E81\u0EB1\u0E99.`,
        mn: `\u2715 \u042D\u043D\u044D \u043C\u0443\u0436\u0438\u0434 (${stateName}) \u043C\u0443\u0436\u0438\u0439\u043D \u043E\u0440\u043B\u043E\u0433\u044B\u043D \u0442\u0430\u0442\u0432\u0430\u0440 \u0431\u0430\u0439\u0434\u0430\u0433 \u0447, \u043B\u043E\u0442\u0435\u0440\u0435\u0439\u043D \u0445\u043E\u0436\u043B\u044B\u0433 \u0442\u0443\u0441\u0433\u0430\u0439\u043B\u0430\u043D \u0447\u04E9\u043B\u04E9\u04E9\u043B\u0434\u04E9\u0433. \u042D\u043D\u044D \u0447 \u0431\u0430\u0441 \u0431\u0443\u0446\u0430\u0430\u043D \u0430\u0432\u0430\u0445 \u0437\u04AF\u0439\u043B\u0433\u04AF\u0439 \u0442\u043E\u0445\u0438\u043E\u043B\u0434\u043E\u043B \u044E\u043C.`,
        my: `\u2715 \u1024\u1015\u103C\u100A\u103A\u1014\u101A\u103A (${stateName}) \u1010\u103D\u1004\u103A \u1015\u103C\u100A\u103A\u1014\u101A\u103A\u101D\u1004\u103A\u1004\u103D\u1031\u1001\u103D\u1014\u103A \u101B\u103E\u102D\u101E\u1031\u102C\u103A\u101C\u100A\u103A\u1038 \u1011\u102E\u1015\u1031\u102B\u1000\u103A\u1004\u103D\u1031\u1000\u102D\u102F \u1021\u1011\u1030\u1038\u1000\u1004\u103A\u1038\u101C\u103D\u1010\u103A\u1001\u103D\u1004\u1037\u103A\u1015\u1031\u1038\u1011\u102C\u1038\u101E\u100A\u103A\u104B \u1024\u101E\u100A\u103A\u101C\u100A\u103A\u1038 \u1015\u103C\u1014\u103A\u101B\u101B\u1014\u103A \u1018\u102C\u1019\u103E\u1019\u101B\u103E\u102D\u101E\u1031\u102C \u1021\u1001\u103C\u1031\u1021\u1014\u1031\u1010\u1005\u103A\u1001\u102F\u1016\u103C\u1005\u103A\u101E\u100A\u103A\u104B`,
        ne: `\u2715 \u092F\u094B \u0930\u093E\u091C\u094D\u092F\u092E\u093E (${stateName}) \u0930\u093E\u091C\u094D\u092F \u0906\u092F\u0915\u0930 \u091B, \u0924\u0930 \u0932\u091F\u0930\u0940\u0915\u094B \u091C\u093F\u0924 \u0935\u093F\u0936\u0947\u0937 \u0930\u0942\u092A\u092E\u093E \u091B\u0941\u091F \u0926\u093F\u0907\u090F\u0915\u094B \u091B\u0964 \u092F\u094B \u092A\u0928\u093F \u092B\u093F\u0930\u094D\u0924\u093E \u092A\u093E\u0909\u0928\u0947 \u0915\u0947\u0939\u0940 \u0928\u092D\u090F\u0915\u094B \u0905\u0935\u0938\u094D\u0925\u093E \u0939\u094B\u0964`,
        si: `\u2715 \u0DB8\u0DD9\u0DB8 \u0DB4\u0DCA\u200D\u0DBB\u0DCF\u0DB1\u0DCA\u0DAD\u0DBA\u0DDA (${stateName}) \u0DB4\u0DCA\u200D\u0DBB\u0DCF\u0DB1\u0DCA\u0DAD \u0D86\u0DAF\u0DCF\u0DBA\u0DB8\u0DCA \u0DB6\u0DAF\u0DCA\u0DAF\u0D9A\u0DCA \u0D87\u0DAD, \u0DB1\u0DB8\u0DD4\u0DAD\u0DCA \u0DBD\u0DDC\u0DAD\u0DBB\u0DD0\u0DBA\u0DD2 \u0DA2\u0DBA\u0D9C\u0DCA\u200D\u0DBB\u0DC4\u0DAB \u0DC0\u0DD2\u0DC1\u0DDA\u0DC2\u0DBA\u0DD9\u0DB1\u0DCA \u0DB1\u0DD2\u0DAF\u0DC4\u0DC3\u0DCA \u0D9A\u0DBB\u0DBA\u0DD2. \u0DB8\u0DD9\u0DBA\u0DAF \u0D86\u0DB4\u0DC3\u0DD4 \u0DBD\u0DB6\u0DCF \u0D9C\u0DD0\u0DB1\u0DD3\u0DB8\u0DA7 \u0D9A\u0DD2\u0DC3\u0DD2\u0DC0\u0D9A\u0DCA \u0DB1\u0DD0\u0DAD\u0DD2 \u0D85\u0DC0\u0DC3\u0DCA\u0DAE\u0DCF\u0DC0\u0D9A\u0DD2.`,
        tl: `\u2715 Ang estadong ito (${stateName}) ay may state income tax, ngunit hindi kasama ang panalo sa lottery. Ito rin ay isang kaso kung saan walang mababawi.`,
        ur: `\u2715 \u0627\u0633 \u0631\u06CC\u0627\u0633\u062A (${stateName}) \u0645\u06CC\u06BA \u0631\u06CC\u0627\u0633\u062A\u06CC \u0627\u0646\u06A9\u0645 \u0679\u06CC\u06A9\u0633 \u06C1\u06D2\u060C \u0644\u06CC\u06A9\u0646 \u0644\u0627\u0679\u0631\u06CC \u06A9\u06CC \u062C\u06CC\u062A \u06A9\u0648 \u062E\u0627\u0635 \u0637\u0648\u0631 \u067E\u0631 \u0645\u0633\u062A\u062B\u0646\u06CC\u0670 \u0631\u06A9\u06BE\u0627 \u06AF\u06CC\u0627 \u06C1\u06D2\u06D4 \u06CC\u06C1 \u0628\u06BE\u06CC \u0627\u06CC\u0633\u06CC \u0635\u0648\u0631\u062A \u06C1\u06D2 \u062C\u06C1\u0627\u06BA \u0648\u0627\u067E\u0633 \u0644\u06CC\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u06A9\u0686\u06BE \u0646\u06C1\u06CC\u06BA \u06C1\u06D2\u06D4`,
        uz: `\u2715 Bu shtatda (${stateName}) shtat daromad solig'i bor, lekin lotereya yutuqlari alohida ozod qilingan. Bu ham qaytarib oladigan narsa yo'q holat.`,
      }
    );
    cls = 'tag-none';
  } else if (UNCERTAIN_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u26A0 \uC774 \uC8FC(${stateName})\uB294 \uC6D0\uCC9C\uC9D5\uC218\uC728 \uC815\uBCF4\uAC00 \uACF5\uC2DD \uC790\uB8CC\uB9C8\uB2E4 \uC870\uAE08\uC529 \uB2EC\uB77C\uC11C(8.75~9.5%) \uC815\uD655\uD55C \uD655\uC778\uC774 \uB354 \uD544\uC694\uD574\uC694. \uB2F9\uCCA8 \uC2DC \uC8FC \uBCF5\uAD8C \uACF5\uC2DD \uC0AC\uC774\uD2B8\uC5D0\uC11C \uC2E4\uC81C \uC6D0\uCC9C\uC9D5\uC218\uC728\uC744 \uAF2D \uD655\uC778\uD558\uC138\uC694.`,
      `\u26A0 This state (${stateName}) has withholding rate figures that vary slightly across official sources (8.75~9.5%), so it needs more checking. Be sure to confirm the actual withholding rate on the state lottery\u2019s official site if you win.`,
      `\u26A0 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u7684\u9884\u6263\u7A0E\u7387\u5728\u5B98\u65B9\u8D44\u6599\u4E2D\u7565\u6709\u5DEE\u5F02\uFF088.75~9.5%\uFF09\uFF0C\u9700\u8981\u8FDB\u4E00\u6B65\u786E\u8BA4\u3002\u4E2D\u5956\u65F6\u8BF7\u52A1\u5FC5\u5728\u8BE5\u5DDE\u5F69\u7968\u5B98\u7F51\u786E\u8BA4\u5B9E\u9645\u9884\u6263\u7A0E\u7387\u3002`,
      `\u26A0 Bang n\u00E0y (${stateName}) c\u00F3 s\u1ED1 li\u1EC7u thu\u1EBF kh\u1EA5u tr\u1EEB h\u01A1i kh\u00E1c nhau gi\u1EEFa c\u00E1c ngu\u1ED3n ch\u00EDnh th\u1EE9c (8,75~9,5%), n\u00EAn c\u1EA7n ki\u1EC3m tra k\u1EF9 h\u01A1n. N\u1EBFu tr\u00FAng s\u1ED1, h\u00E3y ch\u1EAFc ch\u1EAFn x\u00E1c nh\u1EADn t\u1EF7 l\u1EC7 kh\u1EA5u tr\u1EEB th\u1EF1c t\u1EBF tr\u00EAn trang ch\u00EDnh th\u1EE9c c\u1EE7a x\u1ED5 s\u1ED1 bang.`,
      `\u26A0 \u0E21\u0E25\u0E23\u0E31\u0E10\u0E19\u0E35\u0E49 (${stateName}) \u0E21\u0E35\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E17\u0E35\u0E48\u0E41\u0E15\u0E01\u0E15\u0E48\u0E32\u0E07\u0E01\u0E31\u0E19\u0E40\u0E25\u0E47\u0E01\u0E19\u0E49\u0E2D\u0E22\u0E43\u0E19\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23 (8.75~9.5%) \u0E08\u0E36\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21 \u0E2B\u0E32\u0E01\u0E16\u0E39\u0E01\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25 \u0E2D\u0E22\u0E48\u0E32\u0E25\u0E37\u0E21\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E08\u0E23\u0E34\u0E07\u0E1A\u0E19\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07\u0E25\u0E2D\u0E15\u0E40\u0E15\u0E2D\u0E23\u0E35\u0E21\u0E25\u0E23\u0E31\u0E10`,
      `\u26A0 \u0412 \u044D\u0442\u043E\u043C \u0448\u0442\u0430\u0442\u0435 (${stateName}) \u0441\u0442\u0430\u0432\u043A\u0430 \u0443\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u044F \u043D\u0435\u043C\u043D\u043E\u0433\u043E \u043E\u0442\u043B\u0438\u0447\u0430\u0435\u0442\u0441\u044F \u0432 \u0440\u0430\u0437\u043D\u044B\u0445 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0445 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430\u0445 (8,75\u20139,5%), \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043D\u0443\u0436\u043D\u0430 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430. \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u0441\u0442\u0430\u0432\u043A\u0443 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u043C \u0441\u0430\u0439\u0442\u0435 \u043B\u043E\u0442\u0435\u0440\u0435\u0438 \u0448\u0442\u0430\u0442\u0430, \u0435\u0441\u043B\u0438 \u0432\u044B\u0438\u0433\u0440\u0430\u0435\u0442\u0435.`,
      {
        ar: `⚠ تختلف أرقام معدل الاستقطاع في هذه الولاية (${stateName}) قليلاً بين المصادر الرسمية (8.75~9.5%)، لذا يحتاج الأمر إلى مزيد من التحقق. تأكد من التحقق من معدل الاستقطاع الفعلي على الموقع الرسمي لليانصيب في الولاية إذا فزت.`,
        bn: `⚠ এই রাজ্যের (${stateName}) উৎসকর হারের তথ্য সরকারি উৎসগুলোতে সামান্য ভিন্ন (৮.৭৫~৯.৫%), তাই আরও যাচাইয়ের প্রয়োজন। জিতলে অবশ্যই রাজ্য লটারির সরকারি সাইটে প্রকৃত উৎসকর হার নিশ্চিত করুন।`,
        fr: `⚠ Cet État (${stateName}) présente des taux de retenue qui varient légèrement selon les sources officielles (8,75~9,5%), une vérification supplémentaire est donc nécessaire. Assurez-vous de confirmer le taux de retenue réel sur le site officiel de la loterie de l'État si vous gagnez.`,
        hi: `⚠ इस राज्य (${stateName}) के कटौती दर के आंकड़े आधिकारिक स्रोतों में थोड़े अलग-अलग हैं (8.75~9.5%), इसलिए और जांच की जरूरत है। जीतने पर राज्य लॉटरी की आधिकारिक वेबसाइट पर वास्तविक कटौती दर जरूर पुष्टि करें।`,
        id: `⚠ Negara bagian ini (${stateName}) memiliki angka tarif pemotongan yang sedikit bervariasi di berbagai sumber resmi (8.75~9.5%), jadi perlu pengecekan lebih lanjut. Pastikan untuk mengonfirmasi tarif pemotongan sebenarnya di situs resmi lotre negara bagian jika kamu menang.`,
        ja: `⚠ この州（${stateName}）は源泉徴収率の情報が公式資料によって多少異なるため（8.75~9.5%）、詳しい確認が必要です。当選した場合は、州の宝くじ公式サイトで実際の源泉徴収率を必ず確認してください。`,
        kk: `⚠ Бұл штаттың (${stateName}) ұстап қалу мөлшерлемесі ресми дереккөздерде сәл өзгеше болады (8.75~9.5%), сондықтан қосымша тексеру қажет. Ұтып алсаңыз, штат лотереясының ресми сайтынан нақты ұстап қалу мөлшерлемесін міндетті түрде растаңыз.`,
        km: `⚠ រដ្ឋនេះ (${stateName}) មានតួលេខអត្រាកាត់ទុកខុសគ្នាបន្តិចបន្តួចនៅតាមប្រភពផ្លូវការនីមួយៗ (8.75~9.5%) ដូច្នេះត្រូវការការត្រួតពិនិត្យបន្ថែម។ សូមប្រាកដថាបានបញ្ជាក់អត្រាកាត់ទុកជាក់ស្តែងនៅគេហទំព័រផ្លូវការឆ្នោតរបស់រដ្ឋប្រសិនបើអ្នកឈ្នះ។`,
        ky: `⚠ Бул штаттын (${stateName}) кармап калуу коэффициенти расмий булактарда бир аз айырмаланат (8.75~9.5%), андыктан кошумча текшерүү керек. Утуп алсаңыз, штаттын лотерея расмий сайтынан чыныгы кармап калуу коэффициентин текшериңиз.`,
        lo: `⚠ ລັດນີ້ (${stateName}) ມີຕົວເລກອັດຕາການຫັກເງິນທີ່ແຕກຕ່າງກັນເລັກນ້ອຍລະຫວ່າງແຫຼ່ງຂໍ້ມູນທາງການ (8.75~9.5%) ດັ່ງນັ້ນຈິ່ງຕ້ອງກວດສອບເພີ່ມເຕີມ. ຖ້າຖືກລາງວັນ ໃຫ້ແນ່ໃຈວ່າໄດ້ຢືນຢັນອັດຕາການຫັກເງິນຕົວຈິງຢູ່ເວັບໄຊທ໌ທາງການຂອງລອດເຕີຣີລັດ.`,
        mn: `⚠ Энэ мужийн (${stateName}) суутгалын хувь хэмжээ албан ёсны эх сурвалж бүрт бага зэрэг ялгаатай байдаг (8.75~9.5%), тул нэмэлт шалгалт хийх шаардлагатай. Хожсон тохиолдолд мужийн лотерейн албан ёсны сайтаас бодит суутгалын хувийг заавал баталгаажуулаарай.`,
        my: `⚠ ဤပြည်နယ် (${stateName}) ၏ ခုနှိမ်နှုန်း အချက်အလက်များသည် တရားဝင်ရင်းမြစ်များတွင် အနည်းငယ်ကွာခြားနေသောကြောင့် (8.75~9.5%) ပိုမိုစစ်ဆေးရန် လိုအပ်ပါသည်။ ဆွတ်ခူးပါက ပြည်နယ်ထီ၏ တရားဝင်ဝဘ်ဆိုက်တွင် အမှန်တကယ် ခုနှိမ်နှုန်းကို သေချာစွာ အတည်ပြုပါ။`,
        ne: `⚠ यो राज्यको (${stateName}) कट्टी दर आधिकारिक स्रोतहरूमा अलिकति फरक हुन्छ (8.75~9.5%), त्यसैले थप जाँच आवश्यक छ। जित्यो भने राज्य लटरीको आधिकारिक साइटमा वास्तविक कट्टी दर अवश्य पुष्टि गर्नुहोस्।`,
        si: `⚠ මෙම ප්‍රාන්තයේ (${stateName}) අඩු කිරීමේ අනුපාත සංඛ්‍යා නිල මූලාශ්‍ර අතර තරමක් වෙනස් වේ (8.75~9.5%), එබැවින් වැඩිදුර පරීක්ෂාවක් අවශ්‍යයි. ඔබ දිනුවහොත් ප්‍රාන්ත ලොතරැයියේ නිල වෙබ් අඩවියේ සැබෑ අඩු කිරීමේ අනුපාතය තහවුරු කර ගන්න.`,
        tl: `⚠ Ang estadong ito (${stateName}) ay may withholding rate na medyo naiiba sa opisyal na mga sanggunian (8.75~9.5%), kaya kailangan pa ng karagdagang pagsuri. Siguraduhing kumpirmahin ang aktwal na withholding rate sa opisyal na site ng lottery ng estado kung mananalo ka.`,
        ur: `⚠ اس ریاست (${stateName}) کی کٹوتی کی شرح سرکاری ذرائع میں تھوڑی مختلف ہوتی ہے (8.75~9.5%)، اس لیے مزید تصدیق کی ضرورت ہے۔ جیتنے پر ریاستی لاٹری کی سرکاری ویب سائٹ پر اصل کٹوتی کی شرح ضرور تصدیق کریں۔`,
        uz: `⚠ Bu shtatning (${stateName}) ushlab qolish stavkasi rasmiy manbalarda biroz farq qiladi (8.75~9.5%), shuning uchun qo'shimcha tekshirish kerak. Agar yutsangiz, shtat lotereyasining rasmiy saytida haqiqiy ushlab qolish stavkasini albatta tasdiqlang.`,
      }
    );
    cls = 'tag-maybe';
  } else {
    msg = pickLang(
      `\u2139 \uC774 \uC8FC(${stateName})\uB294 \uC6D0\uCC9C\uC9D5\uC218\uC728\uC774 \uC57D ${(stateInfo.rate*100).toFixed(2)}%\uC608\uC694. \uBE44\uAC70\uC8FC\uC790\uB294 \uB300\uCCB4\uB85C \uC774 \uC6D0\uCC9C\uC9D5\uC218\uC728 \uC790\uCCB4\uAC00 \uCD5C\uC885 \uC138\uAE08\uC73C\uB85C \uD655\uC815\uB418\uB294 \uACBD\uC6B0\uAC00 \uB9CE\uC9C0\uB9CC, \uC2E4\uC81C\uB85C \uB354 \uB0C8\uB294\uC9C0\uB294 \uBBF8\uAD6D \uBE44\uAC70\uC8FC\uC790 \uC138\uAE08\uC2E0\uACE0(1040-NR)\uB85C \uC815\uC0B0\uD574\uBD10\uC57C \uC815\uD655\uD788 \uC54C \uC218 \uC788\uC5B4\uC694 \u2014 \uBB34\uC870\uAC74 \uD658\uAE09\uB41C\uB2E4\uB294 \uB73B\uC740 \uC544\uB2C8\uC5D0\uC694.`,
      `\u2139 This state (${stateName}) withholds about ${(stateInfo.rate*100).toFixed(2)}%. For nonresidents, this withholding often ends up being the final tax, but you can only know for sure by settling it through a US nonresident tax return (1040-NR) \u2014 a refund isn\u2019t guaranteed.`,
      `\u2139 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u7684\u9884\u6263\u7A0E\u7387\u7EA6\u4E3A${(stateInfo.rate*100).toFixed(2)}%\u3002\u5BF9\u4E8E\u975E\u5C45\u6C11\u6765\u8BF4\uFF0C\u8FD9\u4E2A\u9884\u6263\u7A0E\u7387\u5F88\u591A\u65F6\u5019\u5C31\u662F\u6700\u7EC8\u7A0E\u989D\uFF0C\u4F46\u5B9E\u9645\u662F\u5426\u591A\u4EA4\u4E86\u7A0E\uFF0C\u9700\u8981\u901A\u8FC7\u7F8E\u56FD\u975E\u5C45\u6C11\u62A5\u7A0E\uFF081040-NR\uFF09\u6765\u7ED3\u7B97\u624D\u80FD\u786E\u5B9A \u2014 \u5E76\u4E0D\u610F\u5473\u7740\u4E00\u5B9A\u4F1A\u9000\u7A0E\u3002`,
      `\u2139 Bang n\u00E0y (${stateName}) kh\u1EA5u tr\u1EEB kho\u1EA3ng ${(stateInfo.rate*100).toFixed(2)}%. V\u1EDBi ng\u01B0\u1EDDi kh\u00F4ng c\u01B0 tr\u00FA, kho\u1EA3n kh\u1EA5u tr\u1EEB n\u00E0y th\u01B0\u1EDDng tr\u1EDF th\u00E0nh thu\u1EBF cu\u1ED1i c\u00F9ng, nh\u01B0ng ch\u1EC9 c\u00F3 th\u1EC3 bi\u1EBFt ch\u1EAFc b\u1EB1ng c\u00E1ch quy\u1EBFt to\u00E1n qua t\u1EDD khai thu\u1EBF ng\u01B0\u1EDDi kh\u00F4ng c\u01B0 tr\u00FA M\u1EF9 (1040-NR) \u2014 kh\u00F4ng \u0111\u1EA3m b\u1EA3o ch\u1EAFc ch\u1EAFn \u0111\u01B0\u1EE3c ho\u00E0n thu\u1EBF.`,
      `\u2139 \u0E21\u0E25\u0E23\u0E31\u0E10\u0E19\u0E35\u0E49 (${stateName}) \u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 ${(stateInfo.rate*100).toFixed(2)}% \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E16\u0E34\u0E48\u0E19\u0E1E\u0E33\u0E19\u0E31\u0E01 \u0E01\u0E32\u0E23\u0E2B\u0E31\u0E01\u0E19\u0E35\u0E49\u0E21\u0E31\u0E01\u0E08\u0E30\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E20\u0E32\u0E29\u0E35\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22 \u0E41\u0E15\u0E48\u0E08\u0E30\u0E23\u0E39\u0E49\u0E41\u0E19\u0E48\u0E0A\u0E31\u0E14\u0E44\u0E14\u0E49\u0E01\u0E47\u0E15\u0E48\u0E2D\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E22\u0E37\u0E48\u0E19\u0E41\u0E1A\u0E1A\u0E20\u0E32\u0E29\u0E35\u0E1C\u0E39\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E16\u0E34\u0E48\u0E19\u0E1E\u0E33\u0E19\u0E31\u0E01\u0E43\u0E19\u0E2A\u0E2B\u0E23\u0E31\u0E10\u0E2F (1040-NR) \u2014 \u0E44\u0E21\u0E48\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E01\u0E31\u0E19\u0E27\u0E48\u0E32\u0E08\u0E30\u0E44\u0E14\u0E49\u0E04\u0E37\u0E19\u0E20\u0E32\u0E29\u0E35`,
      `\u2139 \u0412 \u044D\u0442\u043E\u043C \u0448\u0442\u0430\u0442\u0435 (${stateName}) \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0442 \u043E\u043A\u043E\u043B\u043E ${(stateInfo.rate*100).toFixed(2)}%. \u0414\u043B\u044F \u043D\u0435\u0440\u0435\u0437\u0438\u0434\u0435\u043D\u0442\u043E\u0432 \u044D\u0442\u043E \u0443\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 \u0447\u0430\u0441\u0442\u043E \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u043E\u043A\u043E\u043D\u0447\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u043D\u0430\u043B\u043E\u0433\u043E\u043C, \u043D\u043E \u0442\u043E\u0447\u043D\u043E \u0443\u0437\u043D\u0430\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u0440\u0435\u0437 \u0440\u0430\u0441\u0447\u0451\u0442 \u043F\u043E \u0434\u0435\u043A\u043B\u0430\u0440\u0430\u0446\u0438\u0438 \u043D\u0435\u0440\u0435\u0437\u0438\u0434\u0435\u043D\u0442\u0430 \u0421\u0428\u0410 (1040-NR) \u2014 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D.`
,
      {
        ar: `ℹ هذه الولاية (${stateName}) تستقطع حوالي ${(stateInfo.rate*100).toFixed(2)}%. بالنسبة لغير المقيمين، غالبًا ما ينتهي الأمر بأن يكون هذا الاستقطاع هو الضريبة النهائية، لكن لا يمكنك معرفة ذلك بشكل مؤكد إلا من خلال تسوية الأمر عبر إقرار ضريبي لغير المقيمين في الولايات المتحدة (1040-NR) — استرداد الضريبة غير مضمون.`,
        bn: `ℹ এই রাজ্য (${stateName}) প্রায় ${(stateInfo.rate*100).toFixed(2)}% উৎসে কর্তন করে। অনাবাসীদের জন্য, এই কর্তনই প্রায়ই চূড়ান্ত কর হয়ে যায়, তবে আপনি নিশ্চিতভাবে জানতে পারবেন কেবল মার্কিন অনাবাসী কর রিটার্ন (1040-NR) দিয়ে হিসাব করলেই — ফেরত পাওয়া নিশ্চিত নয়।`,
        fr: `ℹ Cet État (${stateName}) retient environ ${(stateInfo.rate*100).toFixed(2)}%. Pour les non-résidents, cette retenue devient souvent l'impôt final, mais vous ne pouvez le savoir avec certitude qu'en le réglant via une déclaration fiscale de non-résident américain (1040-NR) — un remboursement n'est pas garanti.`,
        hi: `ℹ इस राज्य (${stateName}) में लगभग ${(stateInfo.rate*100).toFixed(2)}% कटौती होती है। गैर-निवासियों के लिए, यह कटौती अक्सर अंतिम टैक्स बन जाती है, लेकिन आप निश्चित रूप से केवल अमेरिकी गैर-निवासी टैक्स रिटर्न (1040-NR) से ही जान सकते हैं — रिफंड की गारंटी नहीं है।`,
        id: `ℹ Negara bagian ini (${stateName}) memotong sekitar ${(stateInfo.rate*100).toFixed(2)}%. Bagi bukan penduduk, pemotongan ini seringkali menjadi pajak final, tetapi kamu hanya bisa tahu pasti dengan menyelesaikannya lewat SPT pajak bukan penduduk AS (1040-NR) — pengembalian dana tidak dijamin.`,
        ja: `ℹ この州（${stateName}）の源泉徴収率は約${(stateInfo.rate*100).toFixed(2)}%です。非居住者の場合、この源泉徴収がそのまま最終的な税額になることが多いですが、実際にどうなるかは米国非居住者の確定申告（1040-NR）で精算してみないと正確にはわかりません — 必ず還付されるわけではありません。`,
        kk: `ℹ Бұл штат (${stateName}) шамамен ${(stateInfo.rate*100).toFixed(2)}% ұстайды. Резидент еместер үшін бұл ұстап қалу көбіне түпкілікті салыққа айналады, бірақ нақты білу үшін АҚШ резидент емес салық декларациясы (1040-NR) арқылы есептеу қажет — қайтарым кепілдендірілмеген.`,
        km: `ℹ រដ្ឋនេះ (${stateName}) កាត់ទុកប្រហែល ${(stateInfo.rate*100).toFixed(2)}%។ សម្រាប់អ្នកមិនមែនអ្នករស់នៅ ការកាត់ទុកនេះជាញឹកញាប់ក្លាយជាពន្ធចុងក្រោយ ប៉ុន្តែអ្នកអាចដឹងច្បាស់លាស់តែតាមរយៈការគណនាតាមរយៈការបង់ពន្ធអ្នកមិនមែនអ្នករស់នៅអាមេរិក (1040-NR) ប៉ុណ្ណោះ — ការសងប្រាក់វិញមិនត្រូវបានធានាទេ។`,
        ky: `ℹ Бул штат (${stateName}) болжол менен ${(stateInfo.rate*100).toFixed(2)}% кармайт. Резидент эместер үчүн бул кармоо көбүнчө акыркы салыкка айланат, бирок так билүү үчүн АКШнын резидент эмес салык декларациясы (1040-NR) аркылу эсептөө керек — кайтарым кепилдик берилбейт.`,
        lo: `ℹ ລັດນີ້ (${stateName}) ຫັກເງິນປະມານ ${(stateInfo.rate*100).toFixed(2)}%. ສຳລັບຜູ້ບໍ່ມີຖິ່ນພຳນັກ ການຫັກເງິນນີ້ມັກຈະກາຍເປັນພາສີສຸດທ້າຍ ແຕ່ທ່ານຈະຮູ້ແນ່ນອນໄດ້ກໍ່ຕໍ່ເມື່ອຄິດໄລ່ຜ່ານການຍື່ນພາສີຜູ້ບໍ່ມີຖິ່ນພຳນັກຂອງສະຫະລັດ (1040-NR) ເທົ່ານັ້ນ — ບໍ່ຮັບປະກັນວ່າຈະໄດ້ຄືນເງິນ.`,
        mn: `ℹ Энэ муж (${stateName}) ойролцоогоор ${(stateInfo.rate*100).toFixed(2)}% суутгадаг. Оршин суугч бус хүмүүсийн хувьд энэ суутгал ихэвчлэн эцсийн татвар болдог ч, АНУ-ын оршин суугч бус татварын мэдүүлэг (1040-NR)-ээр тооцоолж байж л яг таг мэдэх боломжтой — буцаан олголт баталгаатай биш.`,
        my: `ℹ ဤပြည်နယ် (${stateName}) သည် ${(stateInfo.rate*100).toFixed(2)}% ခန့် ခုနှိမ်ပါသည်။ နေထိုင်သူမဟုတ်သူများအတွက် ဤခုနှိမ်ခြင်းသည် အများအားဖြင့် နောက်ဆုံးအခွန်ဖြစ်လာလေ့ရှိသော်လည်း၊ အမေရိကန် နေထိုင်သူမဟုတ်သူ အခွန်ပြန်လည်တင်ပြမှု (1040-NR) ဖြင့် တွက်ချက်မှသာ အတိအကျသိနိုင်ပါသည် — ပြန်အမ်းငွေ အာမခံချက်မရှိပါ။`,
        ne: `ℹ यो राज्यले (${stateName}) लगभग ${(stateInfo.rate*100).toFixed(2)}% कट्टी गर्छ। गैर-बासिन्दाहरूका लागि, यो कट्टी प्रायः अन्तिम कर बन्छ, तर तपाईंले पक्का थाहा पाउन अमेरिकी गैर-बासिन्दा कर रिटर्न (1040-NR) मार्फत मात्र गणना गर्नुपर्छ — फिर्ता ग्यारेन्टी छैन।`,
        si: `ℹ මෙම ප්‍රාන්තය (${stateName}) ආසන්න වශයෙන් ${(stateInfo.rate*100).toFixed(2)}% අඩු කරයි. පදිංචිකරුවන් නොවන අයට, මෙම අඩු කිරීම බොහෝ විට අවසාන බද්ද බවට පත් වේ, නමුත් ඇමරිකානු පදිංචිකරුවකු නොවන බදු ප්‍රතිලාභය (1040-NR) හරහා ගණනය කිරීමෙන් පමණක් ඔබට නිශ්චිතව දැන ගත හැක — ආපසු ගෙවීමක් සහතික නොවේ.`,
        tl: `ℹ Ang estadong ito (${stateName}) ay nagbabawas ng humigit-kumulang ${(stateInfo.rate*100).toFixed(2)}%. Para sa mga di-residente, ang withholding na ito ay kadalasang nagiging pangwakas na buwis, ngunit malalaman mo lang ito nang tiyak sa pamamagitan ng US nonresident tax return (1040-NR) — hindi garantisado ang refund.`,
        ur: `ℹ اس ریاست (${stateName}) میں تقریباً ${(stateInfo.rate*100).toFixed(2)}% کٹوتی ہوتی ہے۔ غیر رہائشیوں کے لیے، یہ کٹوتی اکثر حتمی ٹیکس بن جاتی ہے، لیکن آپ یقینی طور پر صرف امریکی غیر رہائشی ٹیکس ریٹرن (1040-NR) کے ذریعے حساب لگا کر ہی جان سکتے ہیں — ریفنڈ کی ضمانت نہیں ہے۔`,
        uz: `ℹ Bu shtat (${stateName}) taxminan ${(stateInfo.rate*100).toFixed(2)}% ushlab qoladi. Norezidentlar uchun bu ushlab qolish ko'pincha yakuniy soliqqa aylanadi, lekin buni faqat AQSh norezident soliq deklaratsiyasi (1040-NR) orqali hisoblab, aniq bilib olishingiz mumkin — qaytarim kafolatlanmagan.`,
      }
    );
    cls = 'tag-check';
  }
  resultEl.textContent = msg;
  resultEl.className = 'refund-wizard-result ' + cls;
}

let activeFaqCategory = 'all';
let activeFaqAudience = 'all';

function setFaqCategory(cat, btnEl){
  activeFaqCategory = cat;
  document.querySelectorAll('.faq-chip').forEach(c => c.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  filterFaq();
}

// FAQ 탭 전용 두 번째 필터 축 — "누가 묻는 질문이냐"(재외국민 vs 한국 거주 외국인) 기준.
// data-basis(어느 나라 세금 기준이냐)와는 완전히 다른 축이라 별도 상태로 관리하고,
// filterFaq()에서 AND 조건으로 같이 걸러줌
function setFaqAudience(aud, btnEl){
  activeFaqAudience = aud;
  document.querySelectorAll('.faq-audience-chip').forEach(c => c.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  filterFaq();
}

function filterFaq(){
  updateFaqTg2Card(); // 검색/카테고리와 무관하게, 세금 기준이 바뀌었을 수 있는 시점마다 같이 갱신
  const query = document.getElementById('faqSearch').value.trim().toLowerCase();
  // 세금 계산 기준(홈 화면의 KR/US/CN 토글)에 따라, 그 나라와 무관한 질문(예: CN 기준인데
  // 한국 국민연금 질문)은 아예 숨김. data-basis가 없으면 어느 기준에서나 다 관련 있는
  // 공통 질문이라는 뜻이라 항상 보여줌
  const currentBasis = sharedCountry || 'kr';
  const items = document.querySelectorAll('#view-faq .faq-item, #view-faq .refund-step-card[data-basis], #view-faq .jc-stepper[data-basis]');
  let visibleCount = 0;
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const searchMatch = query === '' || text.includes(query);
    const catMatch = activeFaqCategory === 'all' || !item.dataset.cat || item.dataset.cat === activeFaqCategory;
    const basisMatch = !item.dataset.basis || item.dataset.basis.split(',').includes(currentBasis);
    const audienceMatch = activeFaqAudience === 'all' || !item.dataset.audience || item.dataset.audience === activeFaqAudience;
    const match = searchMatch && catMatch && basisMatch && audienceMatch;
    item.style.display = match ? '' : 'none';
    if (match && item.classList.contains('faq-item')) visibleCount++;
    if (query !== '' && match && item.tagName === 'DETAILS') item.open = true;
    if (query === '' && item.tagName === 'DETAILS') item.open = false;
  });

  // 심화 콘텐츠(더 자세히 알아보기 — 플레이슬립, 티켓 생김새 등)도 검색 대상에 포함
  // 단, 카테고리 칩이 '전체'가 아니면 심화 콘텐츠는 어느 카테고리에도 속하지 않으므로 숨김
  const moreToggle = document.querySelector('#view-faq .more-details-toggle');
  let moreMatch = false;
  if (moreToggle && activeFaqCategory !== 'all') {
    moreToggle.style.display = 'none';
    moreToggle.open = false;
  } else if (moreToggle) {
    const moreText = moreToggle.textContent.toLowerCase();
    moreMatch = query !== '' && moreText.includes(query);
    if (moreMatch) {
      moreToggle.open = true;
      moreToggle.style.display = '';
      if (visibleCount === 0) visibleCount++; // 심화 콘텐츠에서만 매칭되어도 '결과 없음' 문구는 숨김
    } else if (query !== '') {
      moreToggle.style.display = visibleCount === 0 ? '' : 'none'; // 위 FAQ에 매칭이 있으면 심화 콘텐츠는 숨겨서 화면 정리
    } else {
      moreToggle.style.display = '';
      moreToggle.open = false;
    }
  }

  document.getElementById('faqNoResult').style.display = (visibleCount === 0) ? 'block' : 'none';
}

// 파워볼(흰 공 1~69 + 파워볼 1~26)/메가밀리언즈(흰 공 1~70 + 메가볼 1~24, 2025-04-08부터 적용된
// 현행 규칙 — 이전엔 메가볼이 1~25였음) 번호 범위와 잭팟 당첨 확률을 한 곳에 모아둠
const LIGHTNING_GAMES = {
  powerball: {
    mainMax: 69, specialMax: 26, specialClass: 'pb',
    oddsText: () => pickLang('이 번호로 당첨될 확률은 여전히 1/2억 9,200만이지만, 재미로만 봐주세요 😉', 'Your odds with these numbers are still 1 in 292 million — just for fun 😉', '用这些号码中奖的概率依然是1/2.92亿，纯属娱乐哦 😉', 'Xác suất trúng với những số này vẫn là 1/292 triệu — chỉ để vui thôi 😉', 'โอกาสถูกรางวัลด้วยเลขเหล่านี้ก็ยังคงเป็น 1 ใน 292 ล้าน — แค่สนุกๆ นะ 😉', 'Шанс выиграть с этими числами всё равно 1 к 292 миллионам — просто для развлечения 😉', {
      ar: 'احتمالات فوزك بهذه الأرقام لا تزال 1 من 292 مليون — فقط للمتعة 😉',
      bn: 'এই সংখ্যাগুলো দিয়ে জেতার সম্ভাবনা এখনও 292 মিলিয়নে 1 — নিছক মজার জন্য 😉',
      fr: 'Vos chances avec ces numéros restent de 1 sur 292 millions — juste pour le plaisir 😉',
      hi: 'इन नंबरों के साथ भी आपकी जीतने की संभावना अब भी 292 मिलियन में से 1 है — बस मज़े के लिए 😉',
      id: 'Peluang Anda dengan angka-angka ini tetap 1 banding 292 juta — cuma buat seru-seruan 😉',
      ja: 'この番号でも当選確率は依然として2億9200万分の1です — お楽しみとしてどうぞ 😉',
      kk: 'Осы сандармен де жеңу мүмкіндігі әлі де 292 миллионнан 1 — жай ғана көңіл көтеру үшін 😉',
      km: 'ឱកាសឈ្នះជាមួយលេខទាំងនេះនៅតែជា 1 ក្នុង 292 លាន — គ្រាន់តែសប្បាយប៉ុណ្ណោះ 😉',
      ky: 'Бул сандар менен утуш мүмкүнчүлүгү дагы эле 292 миллионго 1 — жөн гана көңүл ачуу үчүн 😉',
      lo: 'ໂອກາດຖືກລາງວັນດ້ວຍເລກເຫຼົ່ານີ້ຍັງເປັນ 1 ໃນ 292 ລ້ານ — ພຽງແຕ່ສະໜຸກສະໜານເທົ່ານັ້ນ 😉',
      mn: 'Эдгээр тоотой хожих магадлал өдий хэвээрээ 292 сая тутамд 1 байна — зөвхөн зугаа цэнгэлийн төлөө 😉',
      my: 'ဒီဂဏန်းတွေနဲ့ ပေါက်နိုင်ခြေက 292 သန်းမှာ 1 ဆက်လက်ရှိနေဆဲပါ — ပျော်စရာအတွက်ပဲ 😉',
      ne: 'यी नम्बरहरूसँग पनि जित्ने सम्भावना अझै 292 मिलियनमा 1 छ — रमाइलोका लागि मात्र 😉',
      si: 'මෙම අංක සමඟ ජයග්‍රහණයේ අවස්ථාව තවමත් මිලියන 292න් 1කි — විනෝදය සඳහා පමණි 😉',
      tl: 'Ang tsansa mo sa mga numerong ito ay 1 sa 292 milyon pa rin — para lang sa saya 😉',
      ur: 'ان نمبروں کے ساتھ بھی جیتنے کے امکانات اب بھی 292 ملین میں سے 1 ہیں — محض تفریح کے لیے 😉',
      uz: "Bu raqamlar bilan ham yutish imkoniyati hali ham 292 milliondan 1 — shunchaki qiziqarli bo'lsin uchun 😉",
    })
  },
  megamillions: {
    mainMax: 70, specialMax: 24, specialClass: 'mega',
    oddsText: () => pickLang('이 번호로 당첨될 확률은 여전히 1/2억 9,000만이지만, 재미로만 봐주세요 😉', 'Your odds with these numbers are still 1 in 290 million — just for fun 😉', '用这些号码中奖的概率依然是1/2.9亿，纯属娱乐哦 😉', 'Xác suất trúng với những số này vẫn là 1/290 triệu — chỉ để vui thôi 😉', 'โอกาสถูกรางวัลด้วยเลขเหล่านี้ก็ยังคงเป็น 1 ใน 290 ล้าน — แค่สนุกๆ นะ 😉', 'Шанс выиграть с этими числами всё равно 1 к 290 миллионам — просто для развлечения 😉', {
      ar: 'احتمالات فوزك بهذه الأرقام لا تزال 1 من 290 مليون — فقط للمتعة 😉',
      bn: 'এই সংখ্যাগুলো দিয়ে জেতার সম্ভাবনা এখনও 290 মিলিয়নে 1 — নিছক মজার জন্য 😉',
      fr: 'Vos chances avec ces numéros restent de 1 sur 290 millions — juste pour le plaisir 😉',
      hi: 'इन नंबरों के साथ भी आपकी जीतने की संभावना अब भी 290 मिलियन में से 1 है — बस मज़े के लिए 😉',
      id: 'Peluang Anda dengan angka-angka ini tetap 1 banding 290 juta — cuma buat seru-seruan 😉',
      ja: 'この番号でも当選確率は依然として2億9000万分の1です — お楽しみとしてどうぞ 😉',
      kk: 'Осы сандармен де жеңу мүмкіндігі әлі де 290 миллионнан 1 — жай ғана көңіл көтеру үшін 😉',
      km: 'ឱកាសឈ្នះជាមួយលេខទាំងនេះនៅតែជា 1 ក្នុង 290 លាន — គ្រាន់តែសប្បាយប៉ុណ្ណោះ 😉',
      ky: 'Бул сандар менен утуш мүмкүнчүлүгү дагы эле 290 миллионго 1 — жөн гана көңүл ачуу үчүн 😉',
      lo: 'ໂອກາດຖືກລາງວັນດ້ວຍເລກເຫຼົ່ານີ້ຍັງເປັນ 1 ໃນ 290 ລ້ານ — ພຽງແຕ່ສະໜຸກສະໜານເທົ່ານັ້ນ 😉',
      mn: 'Эдгээр тоотой хожих магадлал өдий хэвээрээ 290 сая тутамд 1 байна — зөвхөн зугаа цэнгэлийн төлөө 😉',
      my: 'ဒီဂဏန်းတွေနဲ့ ပေါက်နိုင်ခြေက 290 သန်းမှာ 1 ဆက်လက်ရှိနေဆဲပါ — ပျော်စရာအတွက်ပဲ 😉',
      ne: 'यी नम्बरहरूसँग पनि जित्ने सम्भावना अझै 290 मिलियनमा 1 छ — रमाइलोका लागि मात्र 😉',
      si: 'මෙම අංක සමඟ ජයග්‍රහණයේ අවස්ථාව තවමත් මිලියන 290න් 1කි — විනෝදය සඳහා පමණි 😉',
      tl: 'Ang tsansa mo sa mga numerong ito ay 1 sa 290 milyon pa rin — para lang sa saya 😉',
      ur: 'ان نمبروں کے ساتھ بھی جیتنے کے امکانات اب بھی 290 ملین میں سے 1 ہیں — محض تفریح کے لیے 😉',
      uz: "Bu raqamlar bilan ham yutish imkoniyati hali ham 290 milliondan 1 — shunchaki qiziqarli bo'lsin uchun 😉",
    })
  }
};

// 등수별 당첨 확률표 — 공식 상금 구조 기준 고정값(잭팟 크기와 무관하게 항상 동일, 조합론으로
// 검증한 값). 메가밀리언즈는 2025-04-08 개정 규칙(LIGHTNING_GAMES 주석 참고)으로 잭팟 제외 모든
// 등수에 2~10배 무작위 배수가 티켓마다 필수 적용됨(파워볼 Power Play처럼 선택이 아님) — 아래
// 금액은 배수 적용 전 기본값. 각 항목은 [ko, en, zh, vi, th, ru] 튜플 — 새로 추가하는 콘텐츠라
// 기존 5개 등수(odds.match5 등, 22개 언어 완역 보유)와 달리 6개 핵심 언어만 우선 지원함
// 등수 라벨("Match N (+/no) {볼}")과 "볼만 맞춤" 문구의 17개 언어 템플릿 —
// 언어별 어순·조사가 다 달라서 최종 문자열 자체가 아니라 조각(개수 매칭/볼 있음-없음/볼만)을
// 함수로 두고 buildMatchMore()에서 조립함 (buildCountryMore 등과 같은 패턴)
const MATCH_LABEL_TEMPLATES_MORE = {
  ar: { match: n => n === 1 ? 'تطابق رقم واحد' : `تطابق ${n} أرقام`, no: ball => `(بدون ${ball})`, plus: ball => `+ ${ball}`, only: ball => `رقم ${ball} فقط` },
  bn: { match: n => n === 1 ? 'একটি সংখ্যা মিল' : `${n}টি সংখ্যা মিল`, no: ball => `(${ball} ছাড়া)`, plus: ball => `+ ${ball}`, only: ball => `শুধু ${ball} নম্বর মিল` },
  fr: { match: n => n === 1 ? '1 numéro correct' : `${n} numéros corrects`, no: ball => `(sans ${ball})`, plus: ball => `+ ${ball}`, only: ball => `Numéro ${ball} uniquement` },
  hi: { match: n => n === 1 ? '1 अंक मैच' : `${n} अंक मैच`, no: ball => `(${ball} नहीं)`, plus: ball => `+ ${ball}`, only: ball => `केवल ${ball} नंबर मैच` },
  id: { match: n => `Cocok ${n} angka`, no: ball => `(tanpa ${ball})`, plus: ball => `+ ${ball}`, only: ball => `Hanya nomor ${ball}` },
  ja: { match: n => `${n}個一致`, no: ball => `（${ball}なし）`, plus: ball => `+ ${ball}`, only: ball => `${ball}番号のみ一致` },
  kk: { match: n => `${n} сан сәйкес`, no: ball => `(${ball} жоқ)`, plus: ball => `+ ${ball}`, only: ball => `Тек ${ball} нөмірі сәйкес` },
  km: { match: n => `ត្រូវគ្នា ${n} លេខ`, no: ball => `(គ្មាន ${ball})`, plus: ball => `+ ${ball}`, only: ball => `ត្រូវតែលេខ ${ball} ប៉ុណ្ណោះ` },
  ky: { match: n => `${n} сан дал келди`, no: ball => `(${ball} жок)`, plus: ball => `+ ${ball}`, only: ball => `Жалгыз гана ${ball} номери дал келди` },
  lo: { match: n => `ຖືກ ${n} ຕົວເລກ`, no: ball => `(${ball} ບໍ່ຖືກ)`, plus: ball => `+ ${ball}`, only: ball => `ຖືກສະເພາະເລກ ${ball}` },
  mn: { match: n => `${n} тоо таарсан`, no: ball => `(${ball} ороогүй)`, plus: ball => `+ ${ball}`, only: ball => `Зөвхөн ${ball} дугаар таарсан` },
  my: { match: n => `ဂဏန်း ${n} လုံး ကိုက်ညီ`, no: ball => `(${ball} မပါ)`, plus: ball => `+ ${ball}`, only: ball => `${ball} ဂဏန်းသာ ကိုက်ညီ` },
  ne: { match: n => `${n} अंक मिल्यो`, no: ball => `(${ball} बाहेक)`, plus: ball => `+ ${ball}`, only: ball => `${ball} नम्बर मात्र मिल्यो` },
  si: { match: n => `අංක ${n}ක් ගැලපේ`, no: ball => `(${ball} නැත)`, plus: ball => `+ ${ball}`, only: ball => `${ball} අංකය පමණක් ගැලපේ` },
  tl: { match: n => `${n} numerong tugma`, no: ball => `(walang ${ball})`, plus: ball => `+ ${ball}`, only: ball => `Numero ng ${ball} lang ang tugma` },
  ur: { match: n => n === 1 ? '1 عدد میچ' : `${n} اعداد میچ`, no: ball => `(${ball} کے بغیر)`, plus: ball => `+ ${ball}`, only: ball => `صرف ${ball} نمبر میچ` },
  uz: { match: n => `${n} ta raqam mos keldi`, no: ball => `(${ball} yo'q)`, plus: ball => `+ ${ball}`, only: ball => `Faqat ${ball} raqami mos keldi` },
};
// mode: 'no'(볼은 틀림) | 'plus'(볼까지 맞춤) | 'only'(볼 번호만 맞춤)
function buildMatchMore(n, ball, mode){
  const more = {};
  Object.keys(MATCH_LABEL_TEMPLATES_MORE).forEach(lang => {
    const t = MATCH_LABEL_TEMPLATES_MORE[lang];
    more[lang] = mode === 'only' ? t.only(ball) : `${t.match(n)} ${mode === 'no' ? t.no(ball) : t.plus(ball)}`;
  });
  return more;
}
// "파워볼은/메가볼은 틀림" 문구의 17개 언어 버전
const MISSED_LABEL_MORE = {
  powerball: { ar: 'Powerball لم يُطابق', bn: 'Powerball মেলেনি', fr: 'Powerball manqué', hi: 'Powerball नहीं मिला', id: 'Powerball tidak cocok', ja: 'Powerballは外れ', kk: 'Powerball сәйкес келмеді', km: 'Powerball មិនត្រូវ', ky: 'Powerball дал келген жок', lo: 'Powerball ບໍ່ຖືກ', mn: 'Powerball тохирсонгүй', my: 'Powerball မကိုက်ညီပါ', ne: 'Powerball मिलेन', si: 'Powerball නොගැලපේ', tl: 'Hindi tumugma ang Powerball', ur: 'Powerball میچ نہیں ہوا', uz: 'Powerball mos kelmadi' },
  megamillions: { ar: 'Mega Ball لم يُطابق', bn: 'Mega Ball মেলেনি', fr: 'Mega Ball manqué', hi: 'Mega Ball नहीं मिला', id: 'Mega Ball tidak cocok', ja: 'Mega Ballは外れ', kk: 'Mega Ball сәйкес келмеді', km: 'Mega Ball មិនត្រូវ', ky: 'Mega Ball дал келген жок', lo: 'Mega Ball ບໍ່ຖືກ', mn: 'Mega Ball тохирсонгүй', my: 'Mega Ball မကိုက်ညီပါ', ne: 'Mega Ball मिलेन', si: 'Mega Ball නොගැලපේ', tl: 'Hindi tumugma ang Mega Ball', ur: 'Mega Ball میچ نہیں ہوا', uz: 'Mega Ball mos kelmadi' },
};
const PRIZE_TIERS = {
  powerball: [
    { match: ['숫자 5개 맞춤','Match 5 (no Powerball)','中5个号码（未中强力球）','Trúng 5 số (trật Powerball)','ถูก 5 ตัวเลข (พาวเวอร์บอลไม่ถูก)','Совпадение 5 чисел (без Powerball)', buildMatchMore(5, 'Powerball', 'no')], explain: true, usd: 1000000, krw: '약 15억원', oddsNum: 11690000, pct: '0.0000086%' },
    { match: ['숫자 4개 + 파워볼 맞춤','Match 4 + Powerball','中4个号码+强力球','Trúng 4 số + Powerball','ถูก 4 ตัวเลข + พาวเวอร์บอล','Совпадение 4 чисел + Powerball', buildMatchMore(4, 'Powerball', 'plus')], explain: false, usd: 50000, krw: '약 7,500만원', oddsNum: 910000, pct: '0.00011%' },
    { match: ['숫자 4개 맞춤','Match 4 (no Powerball)','中4个号码（未中强力球）','Trúng 4 số (trật Powerball)','ถูก 4 ตัวเลข (พาวเวอร์บอลไม่ถูก)','Совпадение 4 чисел (без Powerball)', buildMatchMore(4, 'Powerball', 'no')], explain: true, usd: 100, krw: '약 15만원', oddsNum: 36525, pct: '0.27%' },
    { match: ['숫자 3개 + 파워볼 맞춤','Match 3 + Powerball','中3个号码+强力球','Trúng 3 số + Powerball','ถูก 3 ตัวเลข + พาวเวอร์บอล','Совпадение 3 чисел + Powerball', buildMatchMore(3, 'Powerball', 'plus')], explain: false, usd: 100, krw: '약 15만원', oddsNum: 14494, pct: '0.69%' },
    { match: ['숫자 3개 맞춤','Match 3 (no Powerball)','中3个号码（未中强力球）','Trúng 3 số (trật Powerball)','ถูก 3 ตัวเลข (พาวเวอร์บอลไม่ถูก)','Совпадение 3 чисел (без Powerball)', buildMatchMore(3, 'Powerball', 'no')], explain: true, usd: 7, krw: '약 1만원', oddsNum: 580, pct: '0.17%' },
    { match: ['숫자 2개 + 파워볼 맞춤','Match 2 + Powerball','中2个号码+强力球','Trúng 2 số + Powerball','ถูก 2 ตัวเลข + พาวเวอร์บอล','Совпадение 2 чисел + Powerball', buildMatchMore(2, 'Powerball', 'plus')], explain: false, usd: 7, krw: '약 1만원', oddsNum: 701, pct: '0.14%' },
    { match: ['숫자 1개 + 파워볼 맞춤','Match 1 + Powerball','中1个号码+强力球','Trúng 1 số + Powerball','ถูก 1 ตัวเลข + พาวเวอร์บอล','Совпадение 1 числа + Powerball', buildMatchMore(1, 'Powerball', 'plus')], explain: false, usd: 4, krw: '약 6,000원', oddsNum: 92, pct: '1.09%' },
    { match: ['파워볼 번호만 맞춤','Powerball number only','仅中强力球号码','Chỉ trúng số Powerball','ถูกเฉพาะเลขพาวเวอร์บอล','Совпал только Powerball', buildMatchMore(0, 'Powerball', 'only')], explain: false, usd: 4, krw: '약 6,000원', oddsNum: 38, pct: '2.63%' },
  ],
  megamillions: [
    { match: ['숫자 5개 맞춤','Match 5 (no Mega Ball)','中5个号码（未中超级百万球）','Trúng 5 số (trật Mega Ball)','ถูก 5 ตัวเลข (เมกะบอลไม่ถูก)','Совпадение 5 чисел (без Mega Ball)', buildMatchMore(5, 'Mega Ball', 'no')], explain: true, usd: 1000000, krw: '약 15억원', oddsNum: 12630000, pct: '0.0000079%' },
    { match: ['숫자 4개 + 메가볼 맞춤','Match 4 + Mega Ball','中4个号码+超级百万球','Trúng 4 số + Mega Ball','ถูก 4 ตัวเลข + เมกะบอล','Совпадение 4 чисел + Mega Ball', buildMatchMore(4, 'Mega Ball', 'plus')], explain: false, usd: 10000, krw: '약 1,490만원', oddsNum: 890000, pct: '0.00011%' },
    { match: ['숫자 4개 맞춤','Match 4 (no Mega Ball)','中4个号码（未中超级百万球）','Trúng 4 số (trật Mega Ball)','ถูก 4 ตัวเลข (เมกะบอลไม่ถูก)','Совпадение 4 чисел (без Mega Ball)', buildMatchMore(4, 'Mega Ball', 'no')], explain: true, usd: 500, krw: '약 74만원', oddsNum: 38859, pct: '0.0026%' },
    { match: ['숫자 3개 + 메가볼 맞춤','Match 3 + Mega Ball','中3个号码+超级百万球','Trúng 3 số + Mega Ball','ถูก 3 ตัวเลข + เมกะบอล','Совпадение 3 чисел + Mega Ball', buildMatchMore(3, 'Mega Ball', 'plus')], explain: false, usd: 200, krw: '약 30만원', oddsNum: 13965, pct: '0.0072%' },
    { match: ['숫자 3개 맞춤','Match 3 (no Mega Ball)','中3个号码（未中超级百万球）','Trúng 3 số (trật Mega Ball)','ถูก 3 ตัวเลข (เมกะบอลไม่ถูก)','Совпадение 3 чисел (без Mega Ball)', buildMatchMore(3, 'Mega Ball', 'no')], explain: true, usd: 10, krw: '약 1만 5,000원', oddsNum: 607, pct: '0.16%' },
    { match: ['숫자 2개 + 메가볼 맞춤','Match 2 + Mega Ball','中2个号码+超级百万球','Trúng 2 số + Mega Ball','ถูก 2 ตัวเลข + เมกะบอล','Совпадение 2 чисел + Mega Ball', buildMatchMore(2, 'Mega Ball', 'plus')], explain: false, usd: 10, krw: '약 1만 5,000원', oddsNum: 665, pct: '0.15%' },
    { match: ['숫자 1개 + 메가볼 맞춤','Match 1 + Mega Ball','中1个号码+超级百万球','Trúng 1 số + Mega Ball','ถูก 1 ตัวเลข + เมกะบอล','Совпадение 1 числа + Mega Ball', buildMatchMore(1, 'Mega Ball', 'plus')], explain: false, usd: 10, krw: '약 1만 5,000원', oddsNum: 86, pct: '1.17%' },
    { match: ['메가볼 번호만 맞춤','Mega Ball number only','仅中超级百万球号码','Chỉ trúng số Mega Ball','ถูกเฉพาะเลขเมกะบอล','Совпал только Mega Ball', buildMatchMore(0, 'Mega Ball', 'only')], explain: false, usd: 5, krw: '약 7,400원', oddsNum: 35, pct: '2.84%' },
  ]
};
const SPECIAL_MISSED_LABEL = {
  powerball: ['파워볼은 틀림','Powerball missed','未中强力球','Trật Powerball','พาวเวอร์บอลไม่ถูก','Powerball не совпал', MISSED_LABEL_MORE.powerball],
  megamillions: ['메가볼은 틀림','Mega Ball missed','未中超级百万球','Trật Mega Ball','เมกะบอลไม่ถูก','Mega Ball не совпал', MISSED_LABEL_MORE.megamillions],
};
const HOWTO_TEXT_MEGA = ['메가밀리언즈는 일반번호 5개(1~70 중에서) + 메가볼 1개(1~24 중에서), 총 6개 숫자를 맞히는 게임이에요. 일반번호를 몇 개 맞혔는지 + 메가볼까지 맞혔는지에 따라 상금이 달라지고, 잭팟을 제외한 모든 상금엔 2~10배 무작위 배수가 자동으로 붙어요.',
  'Mega Millions is a game of matching 5 main numbers (from 1–70) plus 1 Mega Ball (from 1–24) — 6 numbers total. The prize depends on how many main numbers you match plus whether you also match the Mega Ball, and every non-jackpot prize automatically gets a random 2x–10x multiplier.',
  '超级百万是从1~70中选5个普通号码 + 从1~24中选1个超级百万球，共6个数字的游戏。奖金取决于普通号码命中数量以及是否命中超级百万球，除头奖外所有奖金都会自动附加2~10倍随机倍数。',
  'Mega Millions là trò chơi chọn trúng 5 số chính (từ 1–70) cùng 1 số Mega Ball (từ 1–24), tổng cộng 6 số. Tiền thưởng tùy vào số lượng số chính trúng cộng với việc có trúng Mega Ball hay không, và mọi giải thưởng ngoại trừ jackpot đều tự động nhân ngẫu nhiên 2–10 lần.',
  'เมกะมิลเลียนคือเกมที่ต้องทายเลขหลัก 5 ตัว (จาก 1-70) บวกเลขเมกะบอล 1 ตัว (จาก 1-24) รวม 6 ตัวเลข เงินรางวัลขึ้นอยู่กับจำนวนเลขหลักที่ถูกบวกกับว่าถูกเมกะบอลด้วยหรือไม่ และทุกรางวัลยกเว้นแจ็คพอตจะถูกคูณด้วยตัวคูณสุ่ม 2-10 เท่าโดยอัตโนมัติ',
  'Mega Millions — это игра, в которой нужно угадать 5 основных чисел (от 1 до 70) плюс 1 число Mega Ball (от 1 до 24), всего 6 чисел. Приз зависит от того, сколько основных чисел вы угадали и угадали ли Mega Ball, а каждый приз, кроме джекпота, автоматически умножается на случайный множитель 2–10.',
  {
    ar: 'Mega Millions هي لعبة تطابق 5 أرقام رئيسية (من 1 إلى 70) بالإضافة إلى رقم Mega Ball واحد (من 1 إلى 24) — أي 6 أرقام إجمالاً. تعتمد الجائزة على عدد الأرقام الرئيسية التي تطابقها بالإضافة إلى ما إذا كنت طابقت Mega Ball أيضًا، وكل جائزة عدا الجاكبوت تحصل تلقائيًا على مضاعف عشوائي من 2 إلى 10 أضعاف.',
    bn: 'Mega Millions হল একটি খেলা যেখানে ৫টি প্রধান সংখ্যা (১–৭০ থেকে) এবং ১টি Mega Ball সংখ্যা (১–২৪ থেকে) মিলাতে হয় — মোট ৬টি সংখ্যা। পুরস্কার নির্ভর করে আপনি কতগুলো প্রধান সংখ্যা মিলিয়েছেন এবং Mega Ball মিলিয়েছেন কিনা তার উপর, এবং জ্যাকপট ছাড়া প্রতিটি পুরস্কারে স্বয়ংক্রিয়ভাবে ২–১০ গুণ র‍্যান্ডম গুণক যুক্ত হয়।',
    fr: 'Mega Millions est un jeu où il faut trouver 5 numéros principaux (de 1 à 70) plus 1 numéro Mega Ball (de 1 à 24) — soit 6 numéros au total. Le gain dépend du nombre de numéros principaux trouvés, ainsi que si le Mega Ball est également trouvé, et chaque gain hors jackpot reçoit automatiquement un multiplicateur aléatoire de 2x à 10x.',
    hi: 'Mega Millions एक ऐसा खेल है जिसमें 5 मुख्य नंबर (1–70 में से) और 1 Mega Ball नंबर (1–24 में से) मिलाना होता है — कुल 6 नंबर। इनाम इस बात पर निर्भर करता है कि आपने कितने मुख्य नंबर मिलाए और क्या आपने Mega Ball भी मिलाया, और जैकपॉट को छोड़कर हर इनाम में अपने आप 2–10 गुना का रैंडम मल्टीप्लायर जुड़ जाता है।',
    id: 'Mega Millions adalah permainan mencocokkan 5 angka utama (dari 1–70) ditambah 1 angka Mega Ball (dari 1–24) — total 6 angka. Hadiah tergantung pada berapa banyak angka utama yang cocok ditambah apakah Anda juga mencocokkan Mega Ball, dan setiap hadiah selain jackpot otomatis mendapat pengali acak 2x–10x.',
    ja: 'メガミリオンズは、メイン数字5個（1〜70の中から）＋メガボール数字1個（1〜24の中から）、合計6個の数字を当てるゲームです。賞金は、メイン数字を何個当てたか、そしてメガボールも当てたかどうかによって変わり、ジャックポットを除くすべての賞金には自動的に2〜10倍のランダムな倍率が適用されます。',
    kk: 'Mega Millions — 5 негізгі санды (1–70 аралығынан) және 1 Mega Ball санын (1–24 аралығынан) тапқызатын ойын, барлығы 6 сан. Жүлде сіз қанша негізгі санды тапқаныңызға және Mega Ball санын да тапқаныңызға байланысты өзгереді, ал джекпоттан басқа әрбір жүлдеге автоматты түрде 2–10 еселік кездейсоқ көбейткіш қосылады.',
    km: 'Mega Millions គឺជាហ្គេមដែលត្រូវទាយឱ្យត្រូវលេខចម្បង 5 (ពី 1–70) បូកនឹងលេខ Mega Ball 1 (ពី 1–24) សរុប 6 លេខ។ ប្រាក់រង្វាន់អាស្រ័យលើចំនួនលេខចម្បងដែលអ្នកទាយត្រូវ បូកនឹងថាតើអ្នកទាយត្រូវលេខ Mega Ball ដែរឬទេ ហើយរង្វាន់ទាំងអស់ក្រៅពីជេកផតនឹងទទួលបានគុណនកម្មចៃដន្យ 2-10 ដងដោយស្វ័យប្រវត្តិ។',
    ky: 'Mega Millions — 5 негизги санды (1–70 арасынан) жана 1 Mega Ball санын (1–24 арасынан) таап табуучу оюн, бардыгы болуп 6 сан. Байге сиз канча негизги санды тапканыңызга жана Mega Ball санын да тапканыңызга жараша өзгөрөт, ал джекпоттон башка ар бир байгеге автоматтык түрдө 2–10 эсе кокустук көбөйткүч кошулат.',
    lo: 'Mega Millions ແມ່ນເກມທາຍເລກຫຼັກ 5 ຕົວ (ຈາກ 1-70) ບວກກັບເລກ Mega Ball 1 ຕົວ (ຈາກ 1-24) ລວມທັງໝົດ 6 ຕົວເລກ. ລາງວັນຂຶ້ນກັບວ່າທ່ານທາຍຖືກເລກຫຼັກຈັກຕົວ ບວກກັບວ່າທາຍຖືກເລກ Mega Ball ນຳຫຼືບໍ່, ແລະທຸກລາງວັນຍົກເວັ້ນແຈັກພອດຈະໄດ້ຮັບຕົວຄູນແບບສຸ່ມ 2-10 ເທົ່າໂດຍອັດຕະໂນມັດ.',
    mn: 'Mega Millions бол 5 үндсэн тоо (1–70-ийн хооронд) нэмэх 1 Mega Ball тоог (1–24-ийн хооронд), нийт 6 тоог таах тоглоом юм. Шагнал нь та хэдэн үндсэн тоог таасан, мөн Mega Ball-ыг ч мөн таасан эсэхээс хамаарах бөгөөд жекпотоос бусад бүх шагналд автоматаар 2-10 дахин санамсаргүй үржүүлэгч нэмэгддэг.',
    my: 'Mega Millions ဆိုတာ အဓိကဂဏန်း ၅ လုံး (၁ မှ ၇၀ ကြားမှ) ထပ်ပေါင်း Mega Ball ဂဏန်း ၁ လုံး (၁ မှ ၂၄ ကြားမှ) စုစုပေါင်း ဂဏန်း ၆ လုံးကို ကိုက်ညီအောင် ရွေးရသော ဂိမ်းတစ်ခုဖြစ်ပါတယ်။ ဆုငွေက သင် အဓိကဂဏန်း ဘယ်နှလုံးကိုက်ညီသလဲ ဆိုတဲ့အပေါ်နဲ့ Mega Ball ကိုပါ ကိုက်ညီသလား ဆိုတာအပေါ် မူတည်ပြီး၊ ဂျက်ပေါ့မှလွဲပြီး ဆုငွေတိုင်းမှာ ၂ မှ ၁၀ ဆအထိ ကျပန်းမြှောက်တန်ဖိုးကို အလိုအလျောက်ပေါင်းထည့်ပါတယ်။',
    ne: 'Mega Millions भनेको ५ मुख्य नम्बर (१–७० बाट) र १ Mega Ball नम्बर (१–२४ बाट), जम्मा ६ नम्बर मिलाउने खेल हो। पुरस्कार तपाईंले कति मुख्य नम्बर मिलाउनुभयो र Mega Ball पनि मिलाउनुभयो कि भन्नेमा भर पर्छ, र ज्याकपोट बाहेक हरेक पुरस्कारमा स्वचालित रूपमा २–१० गुणा अनियमित गुणक थपिन्छ।',
    si: 'Mega Millions යනු ප්‍රධාන අංක 5ක් (1–70 අතරින්) සහ Mega Ball අංකයක් (1–24 අතරින්) ගැලපිය යුතු, මුළු අංක 6ක් සහිත ක්‍රීඩාවකි. ත්‍යාගය රඳා පවතින්නේ ඔබ කීයක් ප්‍රධාන අංක ගැලපුවාද සහ Mega Ball අංකයද ගැලපුවාද යන්න මතය, තවද ජැක්පොට් හැර සෑම ත්‍යාගයකටම ස්වයංක්‍රීයව 2-10 ගුණයක අහඹු ගුණකයක් එකතු වේ.',
    tl: 'Ang Mega Millions ay laro ng pagtutugma ng 5 pangunahing numero (mula 1–70) at 1 Mega Ball na numero (mula 1–24) — kabuuang 6 na numero. Ang premyo ay depende sa kung ilang pangunahing numero ang tumugma at kung tumugma rin ang Mega Ball, at bawat premyo maliban sa jackpot ay awtomatikong nakakakuha ng random na 2x–10x na multiplier.',
    ur: 'Mega Millions ایک ایسا کھیل ہے جس میں 5 مرکزی نمبر (1–70 میں سے) اور 1 Mega Ball نمبر (1–24 میں سے) ملانا ہوتا ہے — کل 6 نمبر۔ انعام کا انحصار اس بات پر ہے کہ آپ نے کتنے مرکزی نمبر ملائے اور کیا آپ نے Mega Ball بھی ملایا، اور جیک پاٹ کے علاوہ ہر انعام میں خودکار طور پر 2–10 گنا بے ترتیب ضرب شامل ہو جاتی ہے۔',
    uz: "Mega Millions — 5 ta asosiy raqam (1–70 orasidan) va 1 ta Mega Ball raqami (1–24 orasidan), jami 6 ta raqamni topish o'yini. Yutuq miqdori nechta asosiy raqamni topganingizga va Mega Ball raqamini ham topganingizga bog'liq, jekpotdan tashqari har bir yutuqqa avtomatik ravishda 2–10 baravar tasodifiy multiplikator qo'shiladi.",
  }];
const HOWTO_TEXT_PB = ['파워볼은 일반번호 5개 (1~69 중에서) + 파워볼 번호 1개 (1~26 중에서), 총 6개 숫자를 맞히는 게임이에요. 일반번호를 몇 개 맞혔는지 + 파워볼까지 맞혔는지에 따라 상금이 달라져요.',
  'Powerball is a game of matching 5 main numbers (from 1–69) plus 1 Powerball number (from 1–26) — 6 numbers total. The prize depends on how many main numbers you match plus whether you also match the Powerball.',
  '强力球是从1~69中选5个普通号码 + 从1~26中选1个强力球号码，共6个数字的游戏。奖金取决于普通号码命中数量以及是否命中强力球。',
  'Powerball là trò chơi chọn trúng 5 số chính (từ 1–69) cùng 1 số Powerball (từ 1–26), tổng cộng 6 số. Tiền thưởng tùy vào số lượng số chính trúng cộng với việc có trúng Powerball hay không.',
  'พาวเวอร์บอลคือเกมที่ต้องทายเลขหลัก 5 ตัว (จาก 1-69) บวกเลขพาวเวอร์บอล 1 ตัว (จาก 1-26) รวม 6 ตัวเลข เงินรางวัลขึ้นอยู่กับจำนวนเลขหลักที่ถูกบวกกับว่าถูกพาวเวอร์บอลด้วยหรือไม่',
  'Powerball — это игра, в которой нужно угадать 5 основных чисел (от 1 до 69) плюс 1 число Powerball (от 1 до 26), всего 6 чисел. Приз зависит от того, сколько основных чисел вы угадали и угадали ли Powerball.',
  {
    ar: 'Powerball هي لعبة تطابق 5 أرقام رئيسية (من 1 إلى 69) بالإضافة إلى رقم Powerball واحد (من 1 إلى 26) — أي 6 أرقام إجمالاً. تعتمد الجائزة على عدد الأرقام الرئيسية التي تطابقها بالإضافة إلى ما إذا كنت طابقت رقم Powerball أيضًا.',
    bn: 'Powerball হল একটি খেলা যেখানে ৫টি প্রধান সংখ্যা (১–৬৯ থেকে) এবং ১টি Powerball সংখ্যা (১–২৬ থেকে) মিলাতে হয় — মোট ৬টি সংখ্যা। পুরস্কার নির্ভর করে আপনি কতগুলো প্রধান সংখ্যা মিলিয়েছেন এবং Powerball মিলিয়েছেন কিনা তার উপর।',
    fr: 'Powerball est un jeu où il faut trouver 5 numéros principaux (de 1 à 69) plus 1 numéro Powerball (de 1 à 26) — soit 6 numéros au total. Le gain dépend du nombre de numéros principaux trouvés, ainsi que si le Powerball est également trouvé.',
    hi: 'Powerball एक ऐसा खेल है जिसमें 5 मुख्य नंबर (1–69 में से) और 1 Powerball नंबर (1–26 में से) मिलाना होता है — कुल 6 नंबर। इनाम इस बात पर निर्भर करता है कि आपने कितने मुख्य नंबर मिलाए और क्या आपने Powerball भी मिलाया।',
    id: 'Powerball adalah permainan mencocokkan 5 angka utama (dari 1–69) ditambah 1 angka Powerball (dari 1–26) — total 6 angka. Hadiah tergantung pada berapa banyak angka utama yang cocok ditambah apakah Anda juga mencocokkan Powerball.',
    ja: 'パワーボールは、メイン数字5個（1〜69の中から）＋パワーボール数字1個（1〜26の中から）、合計6個の数字を当てるゲームです。賞金は、メイン数字を何個当てたか、そしてパワーボールも当てたかどうかによって変わります。',
    kk: 'Powerball — 5 негізгі санды (1–69 аралығынан) және 1 Powerball санын (1–26 аралығынан) тапқызатын ойын, барлығы 6 сан. Жүлде сіз қанша негізгі санды тапқаныңызға және Powerball санын да тапқаныңызға байланысты өзгереді.',
    km: 'Powerball គឺជាហ្គេមដែលត្រូវទាយឱ្យត្រូវលេខចម្បង 5 (ពី 1–69) បូកនឹងលេខ Powerball 1 (ពី 1–26) សរុប 6 លេខ។ ប្រាក់រង្វាន់អាស្រ័យលើចំនួនលេខចម្បងដែលអ្នកទាយត្រូវ បូកនឹងថាតើអ្នកទាយត្រូវលេខ Powerball ដែរឬទេ។',
    ky: 'Powerball — 5 негизги санды (1–69 арасынан) жана 1 Powerball санын (1–26 арасынан) таап табуучу оюн, бардыгы болуп 6 сан. Байге сиз канча негизги санды тапканыңызга жана Powerball санын да тапканыңызга жараша өзгөрөт.',
    lo: 'Powerball ແມ່ນເກມທາຍເລກຫຼັກ 5 ຕົວ (ຈາກ 1-69) ບວກກັບເລກ Powerball 1 ຕົວ (ຈາກ 1-26) ລວມທັງໝົດ 6 ຕົວເລກ. ລາງວັນຂຶ້ນກັບວ່າທ່ານທາຍຖືກເລກຫຼັກຈັກຕົວ ບວກກັບວ່າທາຍຖືກເລກ Powerball ນຳຫຼືບໍ່.',
    mn: 'Powerball бол 5 үндсэн тоо (1–69-ийн хооронд) нэмэх 1 Powerball тоог (1–26-ийн хооронд), нийт 6 тоог таах тоглоом юм. Шагнал нь та хэдэн үндсэн тоог таасан, мөн Powerball-ыг ч мөн таасан эсэхээс хамаарна.',
    my: 'Powerball ဆိုတာ အဓိကဂဏန်း ၅ လုံး (၁ မှ ၆၉ ကြားမှ) ထပ်ပေါင်း Powerball ဂဏန်း ၁ လုံး (၁ မှ ၂၆ ကြားမှ) စုစုပေါင်း ဂဏန်း ၆ လုံးကို ကိုက်ညီအောင် ရွေးရသော ဂိမ်းတစ်ခုဖြစ်ပါတယ်။ ဆုငွေက သင် အဓိကဂဏန်း ဘယ်နှလုံးကိုက်ညီသလဲ ဆိုတဲ့အပေါ်နဲ့ Powerball ကိုပါ ကိုက်ညီသလား ဆိုတာအပေါ် မူတည်ပါတယ်။',
    ne: 'Powerball भनेको ५ मुख्य नम्बर (१–६९ बाट) र १ Powerball नम्बर (१–२६ बाट), जम्मा ६ नम्बर मिलाउने खेल हो। पुरस्कार तपाईंले कति मुख्य नम्बर मिलाउनुभयो र Powerball पनि मिलाउनुभयो कि भन्नेमा भर पर्छ।',
    si: 'Powerball යනු ප්‍රධාන අංක 5ක් (1–69 අතරින්) සහ Powerball අංකයක් (1–26 අතරින්) ගැලපිය යුතු, මුළු අංක 6ක් සහිත ක්‍රීඩාවකි. ත්‍යාගය රඳා පවතින්නේ ඔබ කීයක් ප්‍රධාන අංක ගැලපුවාද සහ Powerball අංකයද ගැලපුවාද යන්න මතය.',
    tl: 'Ang Powerball ay laro ng pagtutugma ng 5 pangunahing numero (mula 1–69) at 1 Powerball na numero (mula 1–26) — kabuuang 6 na numero. Ang premyo ay depende sa kung ilang pangunahing numero ang tumugma at kung tumugma rin ang Powerball.',
    ur: 'Powerball ایک ایسا کھیل ہے جس میں 5 مرکزی نمبر (1–69 میں سے) اور 1 Powerball نمبر (1–26 میں سے) ملانا ہوتا ہے — کل 6 نمبر۔ انعام کا انحصار اس بات پر ہے کہ آپ نے کتنے مرکزی نمبر ملائے اور کیا آپ نے Powerball بھی ملایا۔',
    uz: "Powerball — 5 ta asosiy raqam (1–69 orasidan) va 1 ta Powerball raqami (1–26 orasidan), jami 6 ta raqamni topish o'yini. Yutuq miqdori nechta asosiy raqamni topganingizga va Powerball raqamini ham topganingizga bog'liq.",
  }];
const ODDS_GAME_NOTE_MEGA = ['💡 위 잭팟 카드는 파워볼 기준이에요. 메가밀리언즈는 조금 달라요 — 잭팟이 아닌 상금을 받으면 추첨 때 2~10배 중 하나가 무작위로 정해져서 자동으로 곱해져요. 아래 금액은 그 배수를 곱하기 전, 원래 상금이에요',
  '💡 The jackpot card above is for Powerball. Mega Millions works a bit differently — if you win any prize other than the jackpot, a random multiplier between 2x and 10x is picked at the drawing and automatically applied to it. The amounts below are the original prize, before that multiplier.',
  '💡 上方的头奖卡片是强力球的数据。超级百万不太一样——如果中的不是头奖，开奖时会随机抽出一个2~10倍的倍数，自动乘到奖金上。下面的金额是乘倍数之前的原始奖金',
  '💡 Thẻ jackpot ở trên là của Powerball. Mega Millions hoạt động hơi khác — nếu trúng giải nào đó không phải jackpot, một hệ số nhân ngẫu nhiên từ 2 đến 10 lần sẽ được chọn lúc quay số và tự động nhân vào giải thưởng đó. Số tiền dưới đây là giải thưởng gốc, trước khi nhân hệ số.',
  '💡 การ์ดแจ็คพอตด้านบนเป็นของพาวเวอร์บอล เมกะมิลเลียนทำงานต่างออกไปเล็กน้อย — ถ้าคุณถูกรางวัลอื่นที่ไม่ใช่แจ็คพอต ตัวคูณแบบสุ่มระหว่าง 2 ถึง 10 เท่าจะถูกเลือกตอนออกรางวัลแล้วคูณเข้ากับรางวัลนั้นโดยอัตโนมัติ จำนวนเงินด้านล่างคือรางวัลเดิมก่อนคูณ',
  '💡 Карточка джекпота выше — данные Powerball. В Mega Millions немного иначе — если вы выиграли любой приз, кроме джекпота, во время розыгрыша случайно выбирается множитель от 2 до 10, который автоматически применяется к призу. Суммы ниже — это исходный приз, до умножения.',
  {
    ar: '💡 بطاقة الجاكبوت أعلاه خاصة بـ Powerball. بالنسبة إلى Mega Millions، تحصل كل جائزة عدا الجاكبوت تلقائيًا على مضاعف عشوائي من 2 إلى 10 أضعاف — المبالغ أدناه هي القيمة الأساسية قبل ذلك',
    bn: '💡 উপরের জ্যাকপট কার্ডটি Powerball-এর ভিত্তিতে। Mega Millions-এ, জ্যাকপট বাদে প্রতিটি পুরস্কারে স্বয়ংক্রিয়ভাবে ২–১০ গুণ র‍্যান্ডম গুণক যুক্ত হয় — নিচের পরিমাণগুলো সেই গুণকের আগের মূল মান',
    fr: '💡 La carte du jackpot ci-dessus concerne Powerball. Pour Mega Millions, chaque gain hors jackpot reçoit automatiquement un multiplicateur aléatoire de 2x à 10x — les montants ci-dessous sont la valeur de base avant application de ce multiplicateur',
    hi: '💡 ऊपर दिया गया जैकपॉट कार्ड Powerball का है। Mega Millions में, जैकपॉट को छोड़कर हर इनाम में अपने आप 2–10 गुना का रैंडम मल्टीप्लायर जुड़ जाता है — नीचे दी गई राशि उस मल्टीप्लायर से पहले की मूल राशि है',
    id: '💡 Kartu jackpot di atas adalah milik Powerball. Untuk Mega Millions, setiap hadiah selain jackpot otomatis mendapat pengali acak 2x–10x — jumlah di bawah adalah nilai dasar sebelum pengali tersebut',
    ja: '💡 上記のジャックポットカードはパワーボールのものです。メガミリオンズでは、ジャックポットを除くすべての賞金に自動的に2〜10倍のランダムな倍率が適用されます — 以下の金額は倍率適用前の基本額です',
    kk: '💡 Жоғарыдағы джекпот картасы Powerball бойынша. Mega Millions үшін джекпоттан басқа әрбір жүлдеге автоматты түрде 2–10 еселік кездейсоқ көбейткіш қосылады — төмендегі сомалар осы көбейткішке дейінгі негізгі мән',
    km: '💡 កាតជេកផតខាងលើគឺសម្រាប់ Powerball។ សម្រាប់ Mega Millions រង្វាន់ទាំងអស់ក្រៅពីជេកផតនឹងទទួលបានគុណនកម្មចៃដន្យ 2-10 ដងដោយស្វ័យប្រវត្តិ — ចំនួនទឹកប្រាក់ខាងក្រោមគឺជាតម្លៃមូលដ្ឋានមុនពេលគុណ',
    ky: '💡 Жогорудагы джекпот картасы Powerball боюнча. Mega Millions үчүн джекпоттон башка ар бир байгеге автоматтык түрдө 2–10 эсе кокустук көбөйткүч кошулат — төмөндөгү суммалар ушул көбөйткүчкө чейинки негизги мааниси',
    lo: '💡 ບັດແຈັກພອດຂ້າງເທິງແມ່ນຂອງ Powerball. ສຳລັບ Mega Millions, ທຸກລາງວັນຍົກເວັ້ນແຈັກພອດຈະໄດ້ຮັບຕົວຄູນແບບສຸ່ມ 2-10 ເທົ່າໂດຍອັດຕະໂນມັດ — ຈຳນວນເງິນຂ້າງລຸ່ມແມ່ນມູນຄ່າພື້ນຖານກ່ອນຄູນ',
    mn: '💡 Дээрх жекпотын карт нь Powerball-ийн юм. Mega Millions-д жекпотоос бусад бүх шагналд автоматаар 2-10 дахин санамсаргүй үржүүлэгч нэмэгддэг — доорх дүн нь тэр үржүүлэгч орохоос өмнөх үндсэн дүн юм',
    my: '💡 အထက်ပါ ဂျက်ပေါ့ကတ်သည် Powerball အတွက်ဖြစ်ပါတယ်။ Mega Millions အတွက်တော့ ဂျက်ပေါ့မှလွဲပြီး ဆုငွေတိုင်းမှာ ၂ မှ ၁၀ ဆအထိ ကျပန်းမြှောက်တန်ဖိုးကို အလိုအလျောက်ပေါင်းထည့်ပါတယ် — အောက်ကပမာဏများသည် ထိုမြှောက်တန်ဖိုးမတိုင်မီ အခြေခံတန်ဖိုးဖြစ်ပါတယ်',
    ne: '💡 माथिको ज्याकपोट कार्ड Powerball को हो। Mega Millions मा, ज्याकपोट बाहेक हरेक पुरस्कारमा स्वचालित रूपमा २–१० गुणा अनियमित गुणक थपिन्छ — तलको रकम त्यो गुणक लाग्नुअघिको आधारभूत मान हो',
    si: '💡 ඉහත ජැක්පොට් කාඩ්පත Powerball සඳහා වේ. Mega Millions සඳහා, ජැක්පොට් හැර සෑම ත්‍යාගයකටම ස්වයංක්‍රීයව 2-10 ගුණයක අහඹු ගුණකයක් එකතු වේ — පහත මුදල් ඒ ගුණකයට පෙර මූලික අගයයි',
    tl: '💡 Ang jackpot card sa itaas ay para sa Powerball. Para sa Mega Millions, bawat premyo maliban sa jackpot ay awtomatikong nakakakuha ng random na 2x–10x na multiplier — ang mga halaga sa ibaba ay ang base value bago iyon',
    ur: '💡 اوپر دیا گیا جیک پاٹ کارڈ Powerball کا ہے۔ Mega Millions میں، جیک پاٹ کے علاوہ ہر انعام میں خودکار طور پر 2–10 گنا بے ترتیب ضرب شامل ہو جاتی ہے — نیچے دی گئی رقم اس ضرب سے پہلے کی بنیادی رقم ہے',
    uz: "💡 Yuqoridagi jekpot kartasi Powerball uchun. Mega Millions uchun jekpotdan tashqari har bir yutuqqa avtomatik ravishda 2–10 baravar tasodifiy multiplikator qo'shiladi — quyidagi summalar shu multiplikatorgacha bo'lgan asosiy qiymat",
  }];

// "약 "/"About " 접두어의 17개 언어 버전 — jackpot-card-amt·jc-jackpot/cash/final(2319·2398행 근처)에서도
// 같은 접두어를 반복해서 쓰므로 여기서 한 번만 정의해 재사용함
const ABOUT_PREFIX_MORE = {
  ar: 'حوالي ', bn: 'প্রায় ', fr: 'Environ ', hi: 'लगभग ', id: 'Sekitar ', ja: '約', kk: 'Шамамен ', km: 'ប្រហែល ',
  ky: 'Болжол менен ', lo: 'ປະມານ ', mn: 'Ойролцоогоор ', my: 'ခန့်မှန်းခြေ ', ne: 'लगभग ', si: 'ආසන්න වශයෙන් ',
  tl: 'Humigit-kumulang ', ur: 'تقریباً ', uz: 'Taxminan ',
};
// SMALL_KRW_LABEL의 "약 " + 금액(K/M/B 약어) 문구용 — 약어(₩1.5B 등)는 대부분 언어에서 라틴 문자
// 그대로 통용되므로, ABOUT_PREFIX_MORE에 약어만 이어붙여 17개 언어 more 객체를 만듦
function buildSmallKrwMore(abbrev){
  const more = {};
  Object.keys(ABOUT_PREFIX_MORE).forEach(lang => { more[lang] = ABOUT_PREFIX_MORE[lang] + abbrev; });
  return more;
}

// usdToKrwLabel()은 억/조 단위 잭팟급 금액 전용(내부적으로 1억으로 나눠서 million/billion 표기를
// 계산하므로, $4~$500처럼 작은 상금엔 그대로 못 씀) — 등수별 상금은 액수 종류가 한정적이라
// USD 금액을 key로 하는 별도 소액용 표를 둠
const SMALL_KRW_LABEL = {
  1000000: ['약 15억원','About ₩1.5B','约15亿韩元','Khoảng 1,5 tỷ KRW','ประมาณ 1.5 พันล้านวอน','Около 1,5 млрд вон', buildSmallKrwMore('₩1.5B')],
  50000:   ['약 7,500만원','About ₩75M','约7500万韩元','Khoảng 75 triệu KRW','ประมาณ 75 ล้านวอน','Около 75 млн вон', buildSmallKrwMore('₩75M')],
  10000:   ['약 1,490만원','About ₩14.9M','约1490万韩元','Khoảng 14,9 triệu KRW','ประมาณ 14.9 ล้านวอน','Около 14,9 млн вон', buildSmallKrwMore('₩14.9M')],
  500:     ['약 74만원','About ₩740K','约74万韩元','Khoảng 740 nghìn KRW','ประมาณ 740,000 วอน','Около 740 тыс. вон', buildSmallKrwMore('₩740K')],
  200:     ['약 30만원','About ₩300K','约30万韩元','Khoảng 300 nghìn KRW','ประมาณ 300,000 วอน','Около 300 тыс. вон', buildSmallKrwMore('₩300K')],
  100:     ['약 15만원','About ₩150K','约15万韩元','Khoảng 150 nghìn KRW','ประมาณ 150,000 วอน','Около 150 тыс. вон', buildSmallKrwMore('₩150K')],
  10:      ['약 1만 5,000원','About ₩15K','约1.5万韩元','Khoảng 15 nghìn KRW','ประมาณ 15,000 วอน','Около 15 тыс. вон', buildSmallKrwMore('₩15K')],
  7:       ['약 1만원','About ₩10K','约1万韩元','Khoảng 10 nghìn KRW','ประมาณ 10,000 วอน','Около 10 тыс. вон', buildSmallKrwMore('₩10K')],
  5:       ['약 7,400원','About ₩7.4K','约7400韩元','Khoảng 7.400 KRW','ประมาณ 7,400 วอน','Около 7 400 вон', buildSmallKrwMore('₩7.4K')],
  4:       ['약 6,000원','About ₩6K','约6000韩元','Khoảng 6.000 KRW','ประมาณ 6,000 วอน','Около 6 000 вон', buildSmallKrwMore('₩6K')],
};

function renderPrizeTiers(){
  const container = document.getElementById('odds-prize-tiers');
  if (!container) return;
  const tiers = PRIZE_TIERS[currentOddsGame];
  container.innerHTML = tiers.map(t => {
    const matchLabel = pickLang(...t.match);
    const explainHtml = t.explain ? `<p class="prize-explain">${pickLang(...SPECIAL_MISSED_LABEL[currentOddsGame])}</p>` : '';
    const krwLabel = pickLang(...SMALL_KRW_LABEL[t.usd]);
    return `<div class="prize-card">
      <div class="prize-left">
        <p class="prize-match">${matchLabel}</p>
        ${explainHtml}
      </div>
      <div class="prize-right">
        <p class="prize-amt">${krwLabel} <span class="prize-usd">($${t.usd.toLocaleString('en-US')})</span></p>
        <p class="prize-odds">1 / ${formatOddsDenominator(t.oddsNum)} <span class="prize-pct">(${t.pct})</span></p>
      </div>
    </div>`;
  }).join('');

  const howtoEl = document.getElementById('howto-text');
  if (howtoEl) {
    howtoEl.innerHTML = currentOddsGame === 'powerball'
      ? (resolveI18n('odds.howtoText') || pickLang(...HOWTO_TEXT_PB))
      : pickLang(...HOWTO_TEXT_MEGA);
  }
  const noteEl = document.getElementById('odds-game-note');
  if (noteEl) noteEl.textContent = currentOddsGame === 'megamillions' ? pickLang(...ODDS_GAME_NOTE_MEGA) : '';
}

let currentOddsGame = 'powerball';
function setOddsGame(game){
  if (currentOddsGame === game) return;
  currentOddsGame = game;
  document.getElementById('odds-game-pb').classList.toggle('active', game === 'powerball');
  document.getElementById('odds-game-mega').classList.toggle('active', game === 'megamillions');
  renderPrizeTiers();
}

let currentLightningGame = 'powerball';

// 언어 전환 시에도 재사용해야 해서, 이미 뽑아둔 번호는 그대로 두고 문구·토글 상태만 새로 그림
function updateLightningGameUi(){
  const pbBtn = document.getElementById('lightning-game-pb');
  const megaBtn = document.getElementById('lightning-game-mega');
  const noteEl = document.getElementById('lightning-draw-note');
  if (!pbBtn || !megaBtn || !noteEl) return;
  pbBtn.classList.toggle('active', currentLightningGame === 'powerball');
  megaBtn.classList.toggle('active', currentLightningGame === 'megamillions');
  noteEl.textContent = LIGHTNING_GAMES[currentLightningGame].oddsText();
}

// 게임을 바꾸면 특별볼(파워볼/메가볼) 색상 표시와 숫자 범위가 달라지므로, 이미 뽑아둔 번호는
// 새 게임 기준으로는 의미가 없어져서 "?"로 리셋함
function setLightningGame(game){
  if (game === currentLightningGame) return;
  currentLightningGame = game;
  const specialBall = document.getElementById('lightning-special-ball');
  specialBall.classList.remove('pb', 'mega');
  specialBall.classList.add(LIGHTNING_GAMES[game].specialClass);
  document.querySelectorAll('#lightning-result .lightning-ball').forEach(b => {
    b.textContent = '?';
    b.classList.remove('drawn');
  });
  updateLightningGameUi();
}

const DRAWING_BTN_MORE = {
  km: 'កំពុងទាញ... ⚡', ne: 'तान्दै... ⚡', id: 'Mengundi... ⚡', my: 'ဆွဲနေသည်... ⚡', si: 'ඇද ගනිමින්... ⚡',
  uz: "Tortilmoqda... ⚡", mn: 'Сугалж байна... ⚡', kk: 'Жеребе тартылуда... ⚡', ky: 'Жеребе тартылууда... ⚡',
  ur: 'نکالا جا رہا ہے... ⚡', bn: 'টানা হচ্ছে... ⚡', lo: 'ກຳລັງດຶງ... ⚡', ja: '抽選中... ⚡',
  ar: 'جارِ السحب... ⚡', hi: 'निकाला जा रहा है... ⚡', fr: 'Tirage en cours... ⚡', tl: 'Kinukuha... ⚡'
};

const DRAWN_ANNOUNCE_PREFIX_MORE = {
  km: 'លេខដែលបានទាញ៖ ', ne: 'तानिएका नम्बरहरू: ', id: 'Nomor yang diundi: ', my: 'ဆွဲထားသောနံပါတ်များ- ', si: 'ඇද ගත් අංක: ',
  uz: 'Tortilgan raqamlar: ', mn: 'Сугалсан дугаарууд: ', kk: 'Тартылған сандар: ', ky: 'Тартылган сандар: ',
  ur: 'نکالے گئے نمبر: ', bn: 'টানা নম্বর: ', lo: 'ເລກທີ່ດຶງໄດ້: ', ja: '抽選された番号: ',
  ar: 'الأرقام المسحوبة: ', hi: 'निकाले गए नंबर: ', fr: 'Numéros tirés : ', tl: 'Mga numerong nakuha: '
};

let lightningDrawInProgress = false;

// 그냥 즉시 결과를 보여주면 "게임"이라기보다 결과 표시에 가까워서, 실제 추첨 방송처럼 공 하나씩
// 순서대로(간격을 두고) 숫자가 빠르게 돌다가 멈추는 연출을 넣음 — 마지막 공이 멈추면 살짝
// 통통 튀는 축하 효과 + (지원 기기에 한해) 짧은 진동 피드백을 더해 손맛을 살림
function drawLightningNumbers(){
  if (lightningDrawInProgress) return;
  lightningDrawInProgress = true;

  const config = LIGHTNING_GAMES[currentLightningGame];
  const nums = new Set();
  while (nums.size < 5) nums.add(Math.floor(Math.random() * config.mainMax) + 1);
  const finalValues = [...nums].sort((a,b) => a-b);
  finalValues.push(Math.floor(Math.random() * config.specialMax) + 1);

  const btn = document.getElementById('lightning-draw-btn');
  const resultEl = document.getElementById('lightning-result');
  const balls = document.querySelectorAll('#lightning-result .lightning-ball');
  const originalBtnText = btn.textContent;
  const vibrate = (pattern) => { try{ if (navigator.vibrate) navigator.vibrate(pattern); }catch(e){} };

  btn.disabled = true;
  btn.textContent = pickLang('뽑는 중... ⚡', 'Drawing... ⚡', '抽取中... ⚡', 'Đang rút... ⚡', 'กำลังสุ่ม... ⚡', 'Розыгрыш... ⚡', DRAWING_BTN_MORE);
  resultEl.classList.remove('celebrate');
  balls.forEach(ball => { ball.textContent = '?'; ball.classList.remove('drawn', 'spinning'); });

  const STAGGER_MS = 150, SPIN_MS = 650, TICK_MS = 45;
  balls.forEach((ball, i) => {
    const maxForBall = i < 5 ? config.mainMax : config.specialMax;
    const startDelay = i * STAGGER_MS;
    let spinTimer = null;
    setTimeout(() => {
      ball.classList.add('spinning');
      spinTimer = setInterval(() => {
        ball.textContent = Math.floor(Math.random() * maxForBall) + 1;
      }, TICK_MS);
    }, startDelay);
    setTimeout(() => {
      clearInterval(spinTimer);
      ball.classList.remove('spinning');
      ball.textContent = finalValues[i];
      void ball.offsetWidth;
      ball.classList.add('drawn');
      vibrate(12);
      if (i === balls.length - 1) {
        void resultEl.offsetWidth;
        resultEl.classList.add('celebrate');
        vibrate([15, 40, 25]);
        const announcer = document.getElementById('lightning-result-announcer');
        if (announcer) {
          const prefix = pickLang('뽑힌 번호: ', 'Drawn numbers: ', '抽出的号码：', 'Số đã rút: ', 'เลขที่ออก: ', 'Выпавшие числа: ', DRAWN_ANNOUNCE_PREFIX_MORE);
          announcer.textContent = prefix + finalValues.join(', ');
        }
        btn.disabled = false;
        btn.textContent = originalBtnText;
        lightningDrawInProgress = false;
      }
    }, startDelay + SPIN_MS);
  });
}

function updateDrawCountdown(){
  // 파워볼: 월(1)/수(3)/토(6) 22:59 ET, 메가밀리언즈: 화(2)/금(5) 23:00 ET
  // 실제 추첨은 미국 동부시간 기준이라, 방문자가 어느 나라/시간대에서 접속하든
  // 항상 미국 동부시간 기준 요일·시각으로 계산해야 정확함 (로컬 시간 기준이면 해외 접속 시 오차 발생 가능).
  // Intl로 "지금 이 순간의 동부시간 요일/시/분"만 읽어오면 되므로, 서머타임(EDT/EST) 오프셋을
  // 직접 계산할 필요가 없어 미래 시각을 UTC로 역산하는 것보다 훨씬 단순하고 안전함
  function getEasternNow(){
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const map = {};
    parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
    const WEEKDAY_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    // 자정(00시)이 "24"로 나오는 로케일 표기 대응 — 24는 다음날 00시와 같음
    return {
      dow: WEEKDAY_NUM[map.weekday], minutesOfDay: (Number(map.hour) % 24) * 60 + Number(map.minute),
      year: Number(map.year), month: Number(map.month), day: Number(map.day)
    };
  }
  // D-day 배지는 요일까지만 보여줌 — 스크린샷을 나중에 다시 보거나 남에게 카톡으로 전달해도
  // "화" 같은 요일 표기는 날짜(7.20.)보다 한눈에 들어오고, "오늘 N시간 후"처럼 시시각각 낡는
  // 표현 대신 D-N 형식으로 통일해서 언제 봐도 무슨 뜻인지 바로 알 수 있게 함(사용자 피드백 반영)
  function formatDrawWeekday(year, month, day, diffDays){
    // UTC 기준으로 계산해서 로컬 타임존의 서머타임 경계 등으로 인한 날짜 이월 오차를 피함
    const d = new Date(Date.UTC(year, month - 1, day + diffDays));
    return new Intl.DateTimeFormat(LOCALE_MAP[currentLang] || 'ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(d);
  }
  function nextDrawInfo(drawDays, drawMinutesOfDay){
    const { dow, minutesOfDay, year, month, day } = getEasternNow();
    if (drawDays.includes(dow) && minutesOfDay < drawMinutesOfDay) {
      return `D-DAY (${formatDrawWeekday(year, month, day, 0)})`;
    }
    let diff = 1;
    while (!drawDays.includes((dow + diff) % 7)) diff++;
    return `D-${diff} (${formatDrawWeekday(year, month, day, diff)})`;
  }
  // 위 D-day 배지("D-2 (토)")는 "다음 특정 추첨일"을 보여주는 것이고, 이건 그와 별개로
  // "이 게임은 매주 어느 요일에 추첨하는지"라는 고정된 배경 정보(예: "매주 월·수·토 추첨")를
  // 보여줌. 요일 이름은 22개 언어로 직접 번역하는 대신(오타·오역 위험) 위 formatDrawWeekday와
  // 같은 방식으로 Intl.DateTimeFormat에 임의의 기준일(2026-01-04는 UTC 기준 일요일=dow 0)을
  // 넣어 그때그때 currentLang에 맞는 요일 이름을 뽑아내고 '·'로 이어붙임 — 실제 연도/날짜는
  // 무의미하고 오직 요일 이름을 얻기 위한 도구로만 쓰임
  function formatDrawDaysList(drawDays){
    const locale = LOCALE_MAP[currentLang] || 'ko-KR';
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return drawDays.map(dow => fmt.format(new Date(Date.UTC(2026, 0, 4 + dow)))).join('·');
  }
  function drawScheduleLabel(drawDays){
    const days = formatDrawDaysList(drawDays);
    return pickLang(
      `매주 ${days} 추첨`,
      `Drawn every ${days}`,
      `每周${days}开奖`,
      `Quay số mỗi ${days}`,
      `ออกรางวัลทุก ${days}`,
      `Розыгрыш каждые ${days}`,
      buildDrawScheduleMore(days)
    );
  }
  const ddayPowerballInfo = nextDrawInfo([1, 3, 6], 22 * 60 + 59);
  const ddayMegaInfo = nextDrawInfo([2, 5], 23 * 60);
  const ddayPowerballEl = document.getElementById('dday-powerball');
  const ddayMegaEl = document.getElementById('dday-mega');
  ddayPowerballEl.textContent = ddayPowerballInfo;
  ddayMegaEl.textContent = ddayMegaInfo;
  ddayPowerballEl.classList.toggle('today', ddayPowerballInfo.startsWith('D-DAY'));
  ddayMegaEl.classList.toggle('today', ddayMegaInfo.startsWith('D-DAY'));
  const drawSchedulePowerballEl = document.getElementById('draw-schedule-powerball');
  const drawScheduleMegaEl = document.getElementById('draw-schedule-megamillions');
  if (drawSchedulePowerballEl) drawSchedulePowerballEl.textContent = drawScheduleLabel([1, 3, 6]);
  if (drawScheduleMegaEl) drawScheduleMegaEl.textContent = drawScheduleLabel([2, 5]);
}

// "매주 {요일들} 추첨" 문구의 17개 추가 언어 버전 (GAME_NAME_MORE, buildFreqDescMore 등과
// 동일한 패턴 — pickLang의 `more` 인자로 전달). {days}는 formatDrawDaysList()가 이미
// Intl로 현지화해 만든 요일 목록 문자열이 그대로 들어옴.
function buildDrawScheduleMore(days){
  return {
    ar: `تُسحب كل ${days}`,
    bn: `প্রতি ${days} ড্র হয়`,
    fr: `Tirage chaque ${days}`,
    hi: `हर ${days} ड्रॉ होता है`,
    id: `Diundi setiap ${days}`,
    ja: `毎週${days}に抽選`,
    kk: `Әр ${days} тартылады`,
    km: `ទាញរាល់ ${days}`,
    ky: `Ар ${days} тартылат`,
    lo: `ອອກທຸກ ${days}`,
    mn: `Долоо хоног бүр ${days} гаргадаг`,
    my: `${days} တိုင်း မဲနှုတ်သည်`,
    ne: `हरेक ${days} ड्र हुन्छ`,
    si: `සෑම ${days} ඇදීමක් වේ`,
    tl: `Nagdo-draw tuwing ${days}`,
    ur: `ہر ${days} ڈرا ہوتا ہے`,
    uz: `Har ${days} o'tkaziladi`,
  };
}

// ============================================================================
// 🎟️ 오늘 잭팟 수동 업데이트 존 — 추첨(파워볼 월/수/토, 메가밀리언즈 화/금) 다음날
// amountUsd만 공식 사이트 보고 고치면 30초로 끝납니다.
// ============================================================================
const JACKPOT_DATA = {
  powerball:    { amountUsd: 544000000 },
  megamillions: { amountUsd: 707000000 },
};

// 게임명("파워볼"/"메가밀리언즈")의 17개 언어 버전 — home.powerballName/home.megaName
// (translations.json)과 동일하게, 모든 언어에서 브랜드명은 그대로 라틴 문자로 둠
const GAME_NAME_MORE = {
  powerball: { ar:'Powerball', bn:'Powerball', fr:'Powerball', hi:'Powerball', id:'Powerball', ja:'Powerball', kk:'Powerball', km:'Powerball', ky:'Powerball', lo:'Powerball', mn:'Powerball', my:'Powerball', ne:'Powerball', si:'Powerball', tl:'Powerball', ur:'Powerball', uz:'Powerball' },
  megamillions: { ar:'Mega Millions', bn:'Mega Millions', fr:'Mega Millions', hi:'Mega Millions', id:'Mega Millions', ja:'Mega Millions', kk:'Mega Millions', km:'Mega Millions', ky:'Mega Millions', lo:'Mega Millions', mn:'Mega Millions', my:'Mega Millions', ne:'Mega Millions', si:'Mega Millions', tl:'Mega Millions', ur:'Mega Millions', uz:'Mega Millions' },
};


// 🎱 최신 추첨 당첨번호 — 잭팟 확인할 때 공식 사이트(powerball.com/megamillions.com) 보고 같이 갱신.
// 재미 요소 + 공유 유도용(사용자 피드백: "사이트가 너무 교과서 같다") — 세금 계산기 본질은 그대로 두고
// 잭팟 카드 안에 양념처럼 추가한 것이라, 갱신을 깜빡해도 계산기 기능엔 영향 없음.
const LATEST_DRAW = {
  powerball:    { date: '2026-07-18', numbers: [9, 14, 44, 50, 56], special: 3 },
  megamillions: { date: '2026-07-17', numbers: [22, 34, 45, 48, 55], special: 14 },
};




function renderLatestDraw(){
  Object.keys(LATEST_DRAW).forEach(game => {
    const draw = LATEST_DRAW[game];
    const dateEl = document.getElementById(`draw-date-${game}`);
    const ballsEl = document.getElementById(`draw-balls-${game}`);
    if (!dateEl || !ballsEl) return;
    dateEl.textContent = pickLang(
      `🎱 최근 당첨번호`,
      `🎱 Latest numbers`,
      `🎱 最新开奖号码`,
      `🎱 Số trúng gần nhất`,
      `🎱 เลขล่าสุด`,
      `🎱 Последние номера`,
      {
        ar: `🎱 آخر الأرقام الفائزة`, bn: `🎱 সাম্প্রতিক বিজয়ী নম্বর`,
        fr: `🎱 Derniers numéros gagnants`, hi: `🎱 नवीनतम विजेता नंबर`,
        id: `🎱 Nomor terbaru`, ja: `🎱 最新の当選番号`,
        kk: `🎱 Соңғы ұтыс сандары`, km: `🎱 លេខឈ្នះថ្មីៗ`,
        ky: `🎱 Акыркы утуш сандары`, lo: `🎱 ເລກຖືກລ່າສຸດ`,
        mn: `🎱 Сүүлийн ялсан дугаарууд`, my: `🎱 နောက်ဆုံးထွက်ဂဏန်းများ`,
        ne: `🎱 पछिल्लो विजेता नम्बर`, si: `🎱 මෑත ජයග්‍රාහී අංක`,
        tl: `🎱 Kamakailang panalong numero`, ur: `🎱 حالیہ جیتنے والے نمبر`,
        uz: `🎱 Songgi g'olib raqamlar`,
      }
    );
    ballsEl.innerHTML = draw.numbers.map(n => `<span class="draw-ball">${n}</span>`).join('')
      + `<span class="draw-ball draw-ball-special draw-ball-${game}">${draw.special}</span>`;
  });
}

// 번호별 등장 횟수를 세서 상위 topMainCount/topSpecialCount개를 뽑음. 동률이면 번호가 작은 쪽이
// 먼저 오도록 정렬(그래야 언어를 바꿔도, 새로고침해도 항상 같은 순서로 보임)
function computeNumberFrequency(archive, topMainCount, topSpecialCount){
  const mainCount = {}, specialCount = {};
  archive.forEach(([, nums, special]) => {
    nums.forEach(n => { mainCount[n] = (mainCount[n] || 0) + 1; });
    specialCount[special] = (specialCount[special] || 0) + 1;
  });
  const sortTop = (counts, n) => Object.keys(counts).map(Number)
    .sort((a, b) => counts[b] - counts[a] || a - b).slice(0, n);
  return { topMain: sortTop(mainCount, topMainCount), topSpecial: sortTop(specialCount, topSpecialCount) };
}

// 예전엔 "자주 나온 번호"가 고정 텍스트로 하드코딩되어 있었음(스크린샷 검토 중 사용자가 직접
// 지적: "비교 대상이 몇 건 안 되는데 이 숫자들은 어디서 나온 거냐"). 이제 실제 당첨번호 아카이브
// (POWERBALL_DRAW_ARCHIVE/MEGAMILLIONS_DRAW_ARCHIVE, 2200건+)를 확보했으니 페이지를 그릴 때마다
// 그 데이터에서 직접 계산해서 보여줌 — 나중에 아카이브를 최신화해도 이 문구가 자동으로 맞게 갱신됨
function renderNumberFrequencyStats(){
  const descEl = document.getElementById('odds-numbers-desc');
  const pbEl = document.getElementById('odds-numbers-pb-text');
  const mmEl = document.getElementById('odds-numbers-mm-text');
  if (!descEl && !pbEl && !mmEl) return;
  if (typeof POWERBALL_DRAW_ARCHIVE === 'undefined') return; // odds-data.js 로드 전 — go('odds')에서 재호출됨
  const totalDraws = POWERBALL_DRAW_ARCHIVE.length + MEGAMILLIONS_DRAW_ARCHIVE.length;
  const pbFreq = computeNumberFrequency(POWERBALL_DRAW_ARCHIVE, 5, 3);
  const mmFreq = computeNumberFrequency(MEGAMILLIONS_DRAW_ARCHIVE, 5, 3);
  const dot = arr => arr.join('·');

  if (descEl) descEl.textContent = pickLang(
    `각 게임이 지금 방식으로 바뀐 뒤 실제 추첨 ${totalDraws.toLocaleString('ko-KR')}회차를 계산했어요`,
    `Calculated from ${totalDraws.toLocaleString('en-US')} real draws since each game adopted its current number format`,
    `根据各游戏改为现行规则后的实际开奖 ${totalDraws.toLocaleString('en-US')} 期计算得出`,
    `Tính từ ${totalDraws.toLocaleString('en-US')} kỳ quay có thật kể từ khi mỗi game đổi sang định dạng số hiện tại`,
    `คำนวณจากการออกรางวัลจริง ${totalDraws.toLocaleString('en-US')} งวด นับตั้งแต่แต่ละเกมเปลี่ยนมาใช้รูปแบบตัวเลขปัจจุบัน`,
    `Рассчитано на основе ${totalDraws.toLocaleString('ru-RU')} реальных розыгрышей с момента перехода каждой игры на текущий формат чисел`,
    buildFreqDescMore(totalDraws)
  );
  if (pbEl) pbEl.innerHTML = pickLang(
    `일반번호는 <b>${dot(pbFreq.topMain)}</b>번이 자주 나왔고, 파워볼 번호는 <b>${dot(pbFreq.topSpecial)}</b>번이 자주 나왔어요`,
    `Main numbers <b>${dot(pbFreq.topMain)}</b> came up most often, and Powerball number <b>${dot(pbFreq.topSpecial)}</b> was drawn most`,
    `普通号码 <b>${dot(pbFreq.topMain)}</b> 出现次数最多，强力球号码 <b>${dot(pbFreq.topSpecial)}</b> 出现次数最多`,
    `Số chính <b>${dot(pbFreq.topMain)}</b> ra nhiều nhất, số Powerball <b>${dot(pbFreq.topSpecial)}</b> ra nhiều nhất`,
    `เลขหลัก <b>${dot(pbFreq.topMain)}</b> ออกบ่อยที่สุด และเลขพาวเวอร์บอล <b>${dot(pbFreq.topSpecial)}</b> ออกบ่อยที่สุด`,
    `Основные числа <b>${dot(pbFreq.topMain)}</b> выпадали чаще всего, а число Powerball <b>${dot(pbFreq.topSpecial)}</b> выпадало чаще всего`,
    buildFreqTextMore(dot(pbFreq.topMain), dot(pbFreq.topSpecial), 'Powerball')
  );
  if (mmEl) mmEl.innerHTML = pickLang(
    `일반번호는 <b>${dot(mmFreq.topMain)}</b>번이 자주 나왔고, 메가볼은 <b>${dot(mmFreq.topSpecial)}</b>번이 자주 나왔어요`,
    `Main numbers <b>${dot(mmFreq.topMain)}</b> came up most often, and Mega Ball <b>${dot(mmFreq.topSpecial)}</b> was drawn most`,
    `普通号码 <b>${dot(mmFreq.topMain)}</b> 出现次数最多，超级百万球 <b>${dot(mmFreq.topSpecial)}</b> 出现次数最多`,
    `Số chính <b>${dot(mmFreq.topMain)}</b> ra nhiều nhất, Mega Ball <b>${dot(mmFreq.topSpecial)}</b> ra nhiều nhất`,
    `เลขหลัก <b>${dot(mmFreq.topMain)}</b> ออกบ่อยที่สุด และเมกะบอล <b>${dot(mmFreq.topSpecial)}</b> ออกบ่อยที่สุด`,
    `Основные числа <b>${dot(mmFreq.topMain)}</b> выпадали чаще всего, а Mega Ball <b>${dot(mmFreq.topSpecial)}</b> выпадал чаще всего`,
    buildFreqTextMore(dot(mmFreq.topMain), dot(mmFreq.topSpecial), 'Mega Ball')
  );

  // 숫자를 문장 속 텍스트로만 보여주니 심심하다는 피드백 — 홈 화면 최근 당첨번호와 같은
  // draw-ball 모양으로 시각화해서, 아코디언을 펼치면 공이 하나씩 통통 튀며 나타나게 함
  const renderFreqBalls = (container, freq, game) => {
    if (!container) return;
    container.innerHTML = freq.topMain.map(n => `<span class="draw-ball">${n}</span>`).join('')
      + freq.topSpecial.map(n => `<span class="draw-ball draw-ball-special draw-ball-${game}">${n}</span>`).join('');
  };
  renderFreqBalls(document.getElementById('odds-numbers-pb-balls'), pbFreq, 'powerball');
  renderFreqBalls(document.getElementById('odds-numbers-mm-balls'), mmFreq, 'megamillions');
  // 언어를 바꾸면 innerHTML이 통째로 새로 그려지면서 이미 펼쳐둔 아코디언의 공들이 pop 클래스를
  // 잃어 다시 투명해지므로, 이미 열려있는 상태라면 바로 다시 팝인시켜 사라진 것처럼 보이지 않게 함
  const accordion = document.getElementById('oddsNumbersAccordion');
  if (accordion && accordion.open) popInNumberFrequencyBalls();
}

// 이 아코디언은 처음엔 닫혀 있어서, 페이지 로드 시 공을 미리 그려놔도 펼치기 전까진 안 보임 —
// 펼칠 때마다(여러 번 열어도 매번) 팝인 애니메이션이 다시 재생되도록 클래스를 지웠다 다시 붙임
function popInNumberFrequencyBalls(){
  document.querySelectorAll('#oddsNumbersAccordion .freq-balls .draw-ball').forEach((ball, i) => {
    ball.classList.remove('freq-ball-pop');
    void ball.offsetWidth;
    ball.style.animationDelay = (i * 45) + 'ms';
    ball.classList.add('freq-ball-pop');
  });
}
function buildFreqDescMore(count){
  const c = count.toLocaleString('en-US');
  return {
    ar: `محسوبة من ${c} سحبًا حقيقيًا منذ اعتماد كل لعبة لتنسيق أرقامها الحالي`,
    bn: `প্রতিটি গেম বর্তমান নম্বর ফরম্যাট গ্রহণের পর থেকে প্রকৃত ${c}টি ড্র থেকে হিসাব করা হয়েছে`,
    fr: `Calculé à partir de ${c} tirages réels depuis que chaque jeu a adopté son format de numéros actuel`,
    hi: `प्रत्येक गेम के मौजूदा नंबर फॉर्मेट अपनाने के बाद से ${c} असली ड्रॉ से गणना की गई`,
    id: `Dihitung dari ${c} undian asli sejak masing-masing game menerapkan format angka saat ini`,
    ja: `各ゲームが現在の番号形式を採用して以降の実際の抽選${c}回から計算しました`,
    kk: `Әр ойын қазіргі сан форматын қабылдағаннан кейінгі ${c} нақты тартылымнан есептелген`,
    km: `គណនាពីការទាញឆ្នោតពិត ${c} ដងចាប់តាំងពីហ្គេមនីមួយៗប្រើទម្រង់លេខបច្ចុប្បន្ន`,
    ky: `Ар бир оюн азыркы сан форматын кабыл алгандан бери ${c} реалдуу тартылыштан эсептелген`,
    lo: `ຄິດໄລ່ຈາກການອອກຕົວຈິງ ${c} ຄັ້ງນັບຕັ້ງແຕ່ແຕ່ລະເກມໃຊ້ຮູບແບບຕົວເລກປັດຈຸບັນ`,
    mn: `Тоглоом бүр одоогийн тооны форматаа хэрэглэсэн цагаас хойшхи бодит ${c} сугалаанаас тооцоолов`,
    my: `ဂိမ်းတစ်ခုစီ လက်ရှိဂဏန်းပုံစံကို အသုံးပြုစဉ်မှစ၍ အမှန်တကယ် ထီပေါက်စဉ် ${c} ကြိမ်မှ တွက်ချက်ထားသည်`,
    ne: `प्रत्येक खेलले हालको नम्बर ढाँचा अपनाएदेखि वास्तविक ${c} ड्रबाट गणना गरिएको`,
    si: `සෑම ක්‍රීඩාවක්ම වත්මන් අංක ආකෘතිය අනුගමනය කළ දින සිට සැබෑ දිනුම් ඇදීම් ${c}කින් ගණනය කර ඇත`,
    tl: `Kinalkula mula sa ${c} totoong draw simula nang gamitin ng bawat laro ang kasalukuyang format ng numero`,
    ur: `ہر گیم کے موجودہ نمبر فارمیٹ اپنانے کے بعد سے ${c} حقیقی ڈرا سے حساب لگایا گیا`,
    uz: `Har bir o'yin hozirgi raqam formatini qabul qilganidan beri ${c} ta haqiqiy tortishdan hisoblangan`,
  };
}
function buildFreqTextMore(mainList, specialList, specialWord){
  return {
    ar: `الأرقام الرئيسية <b>${mainList}</b> ظهرت أكثر من غيرها، ورقم ${specialWord} <b>${specialList}</b> ظهر أكثر من غيره`,
    bn: `প্রধান সংখ্যা <b>${mainList}</b> সবচেয়ে বেশি এসেছে, এবং ${specialWord} সংখ্যা <b>${specialList}</b> সবচেয়ে বেশি এসেছে`,
    fr: `Les numéros principaux <b>${mainList}</b> sont sortis le plus souvent, et le numéro ${specialWord} <b>${specialList}</b> est sorti le plus souvent`,
    hi: `मुख्य नंबर <b>${mainList}</b> सबसे ज़्यादा आए, और ${specialWord} नंबर <b>${specialList}</b> सबसे ज़्यादा आया`,
    id: `Angka utama <b>${mainList}</b> paling sering muncul, dan angka ${specialWord} <b>${specialList}</b> paling sering muncul`,
    ja: `メイン数字は<b>${mainList}</b>が最も多く出て、${specialWord}番号は<b>${specialList}</b>が最も多く出ました`,
    kk: `<b>${mainList}</b> негізгі сандары ең жиі шықты, ал ${specialWord} нөмірі <b>${specialList}</b> ең жиі шықты`,
    km: `លេខចម្បង <b>${mainList}</b> បានចេញច្រើនបំផុត ហើយលេខ ${specialWord} <b>${specialList}</b> បានចេញច្រើនបំផុត`,
    ky: `<b>${mainList}</b> негизги сандары эң көп чыккан, ${specialWord} номери <b>${specialList}</b> эң көп чыккан`,
    lo: `ເລກຫຼັກ <b>${mainList}</b> ອອກຫຼາຍທີ່ສຸດ ແລະເລກ ${specialWord} <b>${specialList}</b> ອອກຫຼາຍທີ່ສຸດ`,
    mn: `<b>${mainList}</b> үндсэн тоонууд хамгийн олон удаа гарсан, ${specialWord} дугаар <b>${specialList}</b> хамгийн олон удаа гарсан`,
    my: `အဓိကဂဏန်း <b>${mainList}</b> အများဆုံးထွက်ပြီး ${specialWord} ဂဏန်း <b>${specialList}</b> အများဆုံးထွက်ခဲ့သည်`,
    ne: `मुख्य नम्बरहरू <b>${mainList}</b> सबैभन्दा धेरै आए, र ${specialWord} नम्बर <b>${specialList}</b> सबैभन्दा धेरै आयो`,
    si: `ප්‍රධාන අංක <b>${mainList}</b> වැඩිපුරම පැමිණ ඇත, සහ ${specialWord} අංකය <b>${specialList}</b> වැඩිපුරම පැමිණ ඇත`,
    tl: `Ang mga pangunahing numerong <b>${mainList}</b> ang pinakamadalas lumabas, at ang ${specialWord} number na <b>${specialList}</b> ang pinakamadalas lumabas`,
    ur: `مرکزی نمبر <b>${mainList}</b> سب سے زیادہ آئے، اور ${specialWord} نمبر <b>${specialList}</b> سب سے زیادہ آیا`,
    uz: `<b>${mainList}</b> asosiy raqamlari eng ko'p chiqqan, ${specialWord} raqami <b>${specialList}</b> eng ko'p chiqqan`,
  };
}

// ============================================================================
// 🖼️ 공유용 결과 카드 이미지 — 카톡 등에 링크만 보내면 사이트 고정 미리보기(OG 태그)만 뜨고
// 정작 공유한 내용(구체적 금액 등)은 안 보인다는 지적이 있어서, 텍스트 대신 그 순간의 실제
// 결과를 캔버스로 그린 이미지로 공유함 — 받는 사람이 링크를 눌러 들어가지 않아도 채팅창에서
// 바로 내용이 보임. 파일 공유(navigator.canShare({files}))를 지원 안 하는 환경(주로 PC
// 브라우저)에서는 아래 각 share 함수의 기존 텍스트+링크 공유로 자동 대체됨.
// ============================================================================
const SHARE_CARD_FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

function canvasRoundRectPath(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 캔버스는 자동 줄바꿈이 없어서 직접 구현 — 태국어·크메르어처럼 띄어쓰기 없는 스크립트도 있어
// 단어 단위 대신 글자 단위로 잘라서 어떤 언어든 안전하게 폭을 넘기지 않게 함.
// measureOnly=true면 실제로 그리지 않고 줄바꿈만 계산해서 최종 y만 반환 — buildShareCard가 그리기 전에
// 콘텐츠 블록의 총 높이를 먼저 재서 세로 중앙 정렬하는 데 씀(같은 줄바꿈 로직을 두 번 태워서 정확히 일치시킴)
function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines, measureOnly){
  const chars = Array.from(String(text));
  let line = '';
  let curY = y;
  let lines = 0;
  for (const ch of chars) {
    const testLine = line + ch;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      if (!measureOnly) ctx.fillText(line, x, curY);
      line = ch;
      curY += lineHeight;
      lines++;
      if (maxLines && lines >= maxLines) { line = ''; break; }
    } else {
      line = testLine;
    }
  }
  if (line && !measureOnly) ctx.fillText(line, x, curY);
  return curY + lineHeight;
}

// ₩ 기호 바로 뒤에 숫자가 오면(예: "₩39.7 billion") 글꼴에 따라 ₩의 이중 가로줄이 다음 숫자와
// 시각적으로 붙어서 취소선처럼 보이는 문제가 있어 — 얇은 공백(U+2009)을 하나 끼워 넣어 방지
function fixWonSpacing(text){
  if (text == null) return text;
  return String(text).replace(/₩(?=\d)/g, '₩ ');
}

function drawShareBall(ctx, cx, cy, r, num, bg, fg, border){
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = `800 30px ${SHARE_CARD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), cx, cy + 2);
  ctx.restore();
}

// label/bigText/balls/subText 블록을 실제로 그리거나(draw:true) 높이만 재고(draw:false) 마침.
// buildShareCard가 그리기 전에 draw:false로 한 번 태워서 전체 블록 높이를 알아낸 뒤, 그 높이를
// 콘텐츠 영역 한가운데로 옮겨서(centerY) draw:true로 다시 태우는 방식 — 옵션 필드 조합(bigText만/
// balls만/subText 유무 등)에 따라 남는 세로 공간을 매번 다르게 만들지 않고, 항상 의도적으로 짜인
// 배치처럼 보이게 함(기존엔 고정 y 증가값만 써서 짧은 콘텐츠일 때 카드 중간이 텅 비어 보였음)
function layoutShareContent(ctx, { label, bigText, subText, balls }, { anchorX, maxWidth, isRTL, startY, draw }){
  let y = startY;
  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#544E42';
  ctx.font = `700 30px ${SHARE_CARD_FONT}`;
  y = wrapCanvasText(ctx, label, anchorX, y, maxWidth, 40, 2, !draw) + 24;

  if (bigText) {
    ctx.fillStyle = '#155445';
    ctx.font = `800 68px ${SHARE_CARD_FONT}`;
    y = wrapCanvasText(ctx, bigText, anchorX, y, maxWidth, 80, 3, !draw) + 20;
  }

  if (balls) {
    const r = 42, gap = 98;
    const by = y + r;
    if (draw) {
      // RTL 언어는 읽기 방향이 오른쪽→왼쪽이라 공 배열도 오른쪽 끝을 기준점 삼아 반대 방향으로 배치
      let bx = isRTL ? (anchorX - r) : (anchorX + r);
      const step = isRTL ? -gap : gap;
      balls.numbers.forEach(n => {
        drawShareBall(ctx, bx, by, r, n, '#FFFEF9', '#262420', '#E8E2D3');
        bx += step;
      });
      drawShareBall(ctx, bx, by, r, balls.special, balls.specialColor, '#FFFFFF', balls.specialColor);
    }
    y = by + r + 36;
  }

  if (subText) {
    ctx.fillStyle = '#262420';
    ctx.font = `500 30px ${SHARE_CARD_FONT}`;
    y = wrapCanvasText(ctx, subText, anchorX, y, maxWidth, 42, 3, !draw) + 10;
  }

  return y;
}

// label/bigText/subText/footerText/balls를 받아 브랜드 톤에 맞는 정사각형 공유 카드 이미지를 그려서 반환.
// ar/ur(RTL_LANGS)일 땐 정렬·공 배치를 오른쪽 기준으로 미러링함
function buildShareCard({ label, bigText, subText, footerText, balls }){
  const W = 1000, H = 760, pad = 48;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const isRTL = (typeof RTL_LANGS !== 'undefined') && (typeof currentLang !== 'undefined') && RTL_LANGS.includes(currentLang);

  label = fixWonSpacing(label);
  bigText = fixWonSpacing(bigText);
  subText = fixWonSpacing(subText);
  footerText = fixWonSpacing(footerText);

  // 배경 — 완전 평면 크림색 대신 살짝 톤 다운되는 세로 그러데이션으로 은은한 깊이감을 줌
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#F1EDE0');
  bgGrad.addColorStop(1, '#FAF6EC');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const cardX = pad, cardY = pad, cardW = W - pad * 2, cardH = H - pad * 2, cardR = 32;

  // 카드 그림자(별도 pass) — 밋밋한 흰 사각형이 캔버스 위에 붙어 있는 느낌 대신 살짝 떠 있는 느낌을 줌
  ctx.save();
  ctx.shadowColor = 'rgba(38,36,32,0.18)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  canvasRoundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = '#FFFEF9';
  ctx.fill();
  ctx.restore();

  // 카드 안쪽에만 그려지도록 클립 — 워터마크 원 + 상단 악센트 밴드가 카드 모서리 반경을 벗어나지 않게 함
  canvasRoundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.save();
  ctx.clip();

  // 아주 옅은 브랜드 워터마크 원 — 하단 구석에 살짝 텍스처만 더함(밋밋한 흰 배경 탈피, 과하지 않게)
  ctx.beginPath();
  ctx.fillStyle = 'rgba(21,84,69,0.035)';
  ctx.arc(cardX + 30, cardY + cardH - 20, 170, 0, Math.PI * 2);
  ctx.fill();

  // 상단 브랜드 악센트 밴드(진한 청록) — 로고를 여기로 옮겨서 콘텐츠 영역을 순수하게 결과 내용에만 씀
  const bandH = 146;
  const bandGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + bandH);
  bandGrad.addColorStop(0, '#155445');
  bandGrad.addColorStop(1, '#1F6E5C');
  ctx.fillStyle = bandGrad;
  ctx.fillRect(cardX, cardY, cardW, bandH);

  // 밴드 위 장식용 원(금색 포인트는 아주 소량만 — 팔레트 주석 "도장·소형 강조" 용례를 그대로 따름)
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.arc(cardX + cardW - 36, cardY + bandH - 26, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = 'rgba(156,111,30,0.32)';
  ctx.arc(cardX + cardW - 128, cardY + 16, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 38px ${SHARE_CARD_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = isRTL ? 'right' : 'left';
  const wordmarkX = isRTL ? (cardX + cardW - 56) : (cardX + 56);
  ctx.fillText('🐻 참택스 · ChamTax', wordmarkX, cardY + bandH / 2);

  ctx.restore(); // 클립 해제

  canvasRoundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E8E2D3';
  ctx.stroke();

  // ---- 콘텐츠 영역: 밴드 아래 ~ 푸터 위 사이 공간에서 실제 내용 블록을 세로 중앙 정렬 ----
  const padX = 56;
  const contentX = cardX + padX;
  const contentW = cardW - padX * 2;
  const anchorX = isRTL ? (cardX + cardW - padX) : contentX;
  const footerH = 116;
  const contentTop = cardY + bandH + 44;
  const contentBottom = cardY + cardH - footerH;
  const contentAreaH = contentBottom - contentTop;

  const layoutOpts = { anchorX, maxWidth: contentW, isRTL };
  const measuredEndY = layoutShareContent(ctx, { label, bigText, subText, balls }, { ...layoutOpts, startY: 0, draw: false });
  const blockH = measuredEndY; // startY가 0이었으므로 반환값 자체가 블록 총 높이
  const startY = contentTop + Math.max(0, (contentAreaH - blockH) / 2);
  layoutShareContent(ctx, { label, bigText, subText, balls }, { ...layoutOpts, startY, draw: true });

  // ---- 푸터: 얇은 구분선 + CTA 문구 + 도메인, 카드 하단에 고정 ----
  ctx.strokeStyle = '#E8E2D3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentX, cardY + cardH - footerH + 18);
  ctx.lineTo(cardX + cardW - padX, cardY + cardH - footerH + 18);
  ctx.stroke();

  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#155445';
  ctx.font = `700 28px ${SHARE_CARD_FONT}`;
  ctx.fillText(footerText, anchorX, H - pad - 62);
  ctx.fillStyle = '#544E42';
  ctx.font = `500 24px ${SHARE_CARD_FONT}`;
  ctx.fillText('semilee123456-ui.github.io', anchorX, H - pad - 28);

  return canvas;
}

// 이미지 공유가 가능하면(navigator.canShare({files})) 이미지로 공유하고 true를 반환, 아니면 false를
// 반환해 호출 쪽에서 기존 텍스트+링크 공유로 대체하게 함. 사용자가 공유 시트를 취소한 경우(AbortError)는
// 실패가 아니라 "이미 처리됨"으로 보고 true를 반환해 텍스트 폴백으로 이어지지 않게 함
async function tryShareCardImage(canvas, shareTitle, shareText){
  if (!navigator.canShare) return false;
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    const file = new File([blob], 'chamtax-result.png', { type: 'image/png' });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: shareTitle, text: shareText });
    return true;
  } catch (e) {
    if (e && e.name === 'AbortError') return true;
    return false;
  }
}

async function shareLatestDraw(game){
  const draw = LATEST_DRAW[game];
  const jackpotMillions = Math.round(JACKPOT_DATA[game].amountUsd / 1000000);
  const gameLabel = pickLang(
    game === 'powerball' ? '파워볼' : '메가밀리언즈',
    game === 'powerball' ? 'Powerball' : 'Mega Millions',
    game === 'powerball' ? '强力球' : '超级百万',
    game === 'powerball' ? 'Powerball' : 'Mega Millions',
    game === 'powerball' ? 'พาวเวอร์บอล' : 'เมกะมิลเลียน',
    game === 'powerball' ? 'Powerball' : 'Mega Millions',
    GAME_NAME_MORE[game]
  );
  const specialLabel = game === 'powerball' ? 'PB' : 'MB';
  const numbersText = draw.numbers.join('-');
  const shareText = pickLang(
    `🎱 최근 ${gameLabel} 당첨번호: ${numbersText} + ${specialLabel} ${draw.special} / 다음 추첨 잭팟은 $${jackpotMillions}M! 참택스에서 확인해보세요`,
    `🎱 Latest ${gameLabel} numbers: ${numbersText} + ${specialLabel} ${draw.special} / Next jackpot is $${jackpotMillions}M! Check it out on ChamTax`,
    `🎱 最新${gameLabel}开奖号码：${numbersText} + ${specialLabel} ${draw.special} / 下期奖金 $${jackpotMillions}M！来ChamTax看看吧`,
    `🎱 Số trúng ${gameLabel} gần nhất: ${numbersText} + ${specialLabel} ${draw.special} / Jackpot kỳ tới là $${jackpotMillions}M! Xem trên ChamTax`,
    `🎱 เลข ${gameLabel} ล่าสุด: ${numbersText} + ${specialLabel} ${draw.special} / แจ็คพอตงวดหน้า $${jackpotMillions}M! ดูที่ ChamTax`,
    `🎱 Последние номера ${gameLabel}: ${numbersText} + ${specialLabel} ${draw.special} / Следующий джекпот $${jackpotMillions}M! Смотрите на ChamTax`,
    {
      ar: `🎱 آخر أرقام ${gameLabel}: ${numbersText} + ${specialLabel} ${draw.special} / الجاكبوت القادم $${jackpotMillions}M! شاهده على ChamTax`,
      bn: `🎱 সর্বশেষ ${gameLabel} নম্বর: ${numbersText} + ${specialLabel} ${draw.special} / পরবর্তী জ্যাকপট $${jackpotMillions}M! ChamTax-এ দেখুন`,
      fr: `🎱 Derniers numéros ${gameLabel} : ${numbersText} + ${specialLabel} ${draw.special} / Prochain jackpot $${jackpotMillions}M ! Découvrez sur ChamTax`,
      hi: `🎱 नवीनतम ${gameLabel} नंबर: ${numbersText} + ${specialLabel} ${draw.special} / अगला जैकपॉट $${jackpotMillions}M! ChamTax पर देखें`,
      id: `🎱 Nomor ${gameLabel} terbaru: ${numbersText} + ${specialLabel} ${draw.special} / Jackpot berikutnya $${jackpotMillions}M! Cek di ChamTax`,
      ja: `🎱 最新の${gameLabel}当選番号: ${numbersText} + ${specialLabel} ${draw.special} / 次回のジャックポットは$${jackpotMillions}M！ChamTaxでチェック`,
      kk: `🎱 ${gameLabel}-дің соңғы сандары: ${numbersText} + ${specialLabel} ${draw.special} / Келесі джекпот $${jackpotMillions}M! ChamTax-та қараңыз`,
      km: `🎱 លេខ${gameLabel}ថ្មីៗ: ${numbersText} + ${specialLabel} ${draw.special} / ជេកផតបន្ទាប់ $${jackpotMillions}M! មើលនៅ ChamTax`,
      ky: `🎱 ${gameLabel}дин акыркы сандары: ${numbersText} + ${specialLabel} ${draw.special} / Кийинки джекпот $${jackpotMillions}M! ChamTax'та көрүңүз`,
      lo: `🎱 ເລກ ${gameLabel} ລ່າສຸດ: ${numbersText} + ${specialLabel} ${draw.special} / ແຈັກພອດຄັ້ງຕໍ່ໄປ $${jackpotMillions}M! ເບິ່ງທີ່ ChamTax`,
      mn: `🎱 ${gameLabel}-ийн сүүлийн дугаар: ${numbersText} + ${specialLabel} ${draw.special} / Дараагийн жекпот $${jackpotMillions}M! ChamTax дээр шалгаарай`,
      my: `🎱 နောက်ဆုံး ${gameLabel} ဂဏန်းများ: ${numbersText} + ${specialLabel} ${draw.special} / နောက်ဂျက်ပေါ့ $${jackpotMillions}M! ChamTax တွင်ကြည့်ပါ`,
      ne: `🎱 पछिल्लो ${gameLabel} नम्बरहरू: ${numbersText} + ${specialLabel} ${draw.special} / अर्को ज्याकपोट $${jackpotMillions}M! ChamTax मा हेर्नुहोस्`,
      si: `🎱 නවතම ${gameLabel} අංක: ${numbersText} + ${specialLabel} ${draw.special} / ඊළඟ ජැක්පොට් $${jackpotMillions}M! ChamTax හි බලන්න`,
      tl: `🎱 Pinakabagong ${gameLabel} numbers: ${numbersText} + ${specialLabel} ${draw.special} / Ang susunod na jackpot ay $${jackpotMillions}M! Tingnan sa ChamTax`,
      ur: `🎱 تازہ ترین ${gameLabel} نمبرز: ${numbersText} + ${specialLabel} ${draw.special} / اگلا جیک پاٹ $${jackpotMillions}M! ChamTax پر دیکھیں`,
      uz: `🎱 Oxirgi ${gameLabel} raqamlari: ${numbersText} + ${specialLabel} ${draw.special} / Keyingi jekpot $${jackpotMillions}M! ChamTax'da ko'ring`,
    }
  );
  const shareUrl = location.href;

  const specialColor = game === 'powerball' ? '#C0392B' : '#9C6F1E';
  const cardLabel = pickLang(
    `🎱 최근 ${gameLabel} 당첨번호`, `🎱 Latest ${gameLabel} numbers`, `🎱 最新${gameLabel}开奖号码`,
    `🎱 Số trúng ${gameLabel} gần nhất`, `🎱 เลข ${gameLabel} ล่าสุด`, `🎱 Последние номера ${gameLabel}`,
    {
      ar: `🎱 آخر أرقام ${gameLabel}`, bn: `🎱 সর্বশেষ ${gameLabel} নম্বর`, fr: `🎱 Derniers numéros ${gameLabel}`,
      hi: `🎱 नवीनतम ${gameLabel} नंबर`, id: `🎱 Nomor ${gameLabel} terbaru`, ja: `🎱 最新の${gameLabel}当選番号`,
      kk: `🎱 ${gameLabel}-дің соңғы сандары`, km: `🎱 លេខ${gameLabel}ថ្មីៗ`, ky: `🎱 ${gameLabel}дин акыркы сандары`,
      lo: `🎱 ເລກ ${gameLabel} ລ່າສຸດ`, mn: `🎱 ${gameLabel}-ийн сүүлийн дугаар`, my: `🎱 နောက်ဆုံး ${gameLabel} ဂဏန်းများ`,
      ne: `🎱 पछिल्लो ${gameLabel} नम्बरहरू`, si: `🎱 නවතම ${gameLabel} අංක`, tl: `🎱 Pinakabagong ${gameLabel} numbers`,
      ur: `🎱 تازہ ترین ${gameLabel} نمبرز`, uz: `🎱 Oxirgi ${gameLabel} raqamlari`,
    }
  );
  const cardSub = pickLang(
    `다음 추첨 잭팟은 $${jackpotMillions}M!`, `Next jackpot is $${jackpotMillions}M!`, `下期奖金 $${jackpotMillions}M！`,
    `Jackpot kỳ tới là $${jackpotMillions}M!`, `แจ็คพอตงวดหน้า $${jackpotMillions}M!`, `Следующий джекпот $${jackpotMillions}M!`,
    {
      ar: `الجاكبوت القادم $${jackpotMillions}M!`, bn: `পরবর্তী জ্যাকপট $${jackpotMillions}M!`, fr: `Prochain jackpot $${jackpotMillions}M !`,
      hi: `अगला जैकपॉट $${jackpotMillions}M!`, id: `Jackpot berikutnya $${jackpotMillions}M!`, ja: `次回のジャックポットは$${jackpotMillions}M！`,
      kk: `Келесі джекпот $${jackpotMillions}M!`, km: `ជេកផតបន្ទាប់ $${jackpotMillions}M!`, ky: `Кийинки джекпот $${jackpotMillions}M!`,
      lo: `ແຈັກພອດຄັ້ງຕໍ່ໄປ $${jackpotMillions}M!`, mn: `Дараагийн жекпот $${jackpotMillions}M!`, my: `နောက်ဂျက်ပေါ့ $${jackpotMillions}M!`,
      ne: `अर्को ज्याकपोट $${jackpotMillions}M!`, si: `ඊළඟ ජැක්පොට් $${jackpotMillions}M!`, tl: `Ang susunod na jackpot ay $${jackpotMillions}M!`,
      ur: `اگلا جیک پاٹ $${jackpotMillions}M!`, uz: `Keyingi jekpot $${jackpotMillions}M!`,
    }
  );
  const cardFooter = pickLang(
    '👉 참택스에서 실수령액 계산해보기', '👉 Calculate your take-home on ChamTax', '👉 到ChamTax算算实得金额',
    '👉 Tính số tiền thực nhận trên ChamTax', '👉 คำนวณเงินที่ได้รับจริงที่ ChamTax', '👉 Посчитайте сумму на руки на ChamTax',
    { ar:'👉 احسب صافي دخلك على ChamTax', bn:'👉 ChamTax-এ আপনার প্রকৃত আয় হিসাব করুন', fr:'👉 Calculez votre revenu net sur ChamTax', hi:'👉 ChamTax पर अपनी हाथ में आने वाली राशि निकालें', id:'👉 Hitung take-home Anda di ChamTax', ja:'👉 ChamTaxで手取り額を計算する', kk:'👉 ChamTax-та қолға тиетін соманы есептеңіз', km:'👉 គណនាចំណូលសុទ្ធរបស់អ្នកនៅ ChamTax', ky:"👉 ChamTax'та кол алдырма акчаңызды эсептеңиз", lo:'👉 ຄິດໄລ່ເງິນທີ່ໄດ້ຮັບຈິງຂອງທ່ານທີ່ ChamTax', mn:'👉 ChamTax дээр гарт орох дүнгээ тооцоолоорой', my:'👉 ChamTax တွင် သင့်လက်ခံရရှိမှုကို တွက်ချက်ပါ', ne:'👉 ChamTax मा आफ्नो हातमा पर्ने रकम गणना गर्नुहोस्', si:'👉 ChamTax හි ඔබේ අත් ලාභය ගණනය කරන්න', tl:'👉 Kalkulahin ang iyong take-home sa ChamTax', ur:'👉 ChamTax پر اپنی ہاتھ میں آنے والی رقم کا حساب لگائیں', uz:"👉 ChamTax'da qo'lga tegadigan summangizni hisoblang" }
  );
  const canvas = buildShareCard({ label: cardLabel, subText: cardSub, footerText: cardFooter, balls: { numbers: draw.numbers, special: draw.special, specialColor } });
  if (await tryShareCardImage(canvas, gameLabel, shareText)) return;

  if (navigator.share) {
    try {
      await navigator.share({ title: gameLabel, text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    alert(pickLang('복사됐어요! 카톡에 붙여넣기 해보세요 :)', 'Copied! Paste it anywhere you like :)', '已复制！粘贴到任何地方分享吧 :)', 'Đã sao chép! Dán vào bất cứ đâu bạn muốn :)', 'คัดลอกแล้ว! วางที่ไหนก็ได้ที่คุณต้องการ :)', 'Скопировано! Вставьте куда угодно :)', COPIED_TOAST_MORE));
  } catch (e) {
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享', 'Nhấn giữ để sao chép rồi chia sẻ', 'กดค้างเพื่อคัดลอกแล้วแชร์', 'Нажмите и удерживайте, чтобы скопировать, затем поделитесь', PRESS_HOLD_COPY_MORE), `${shareText} ${shareUrl}`);
  }
}

function toggleJhGroupList(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

// JACKPOT_HISTORY(수동 큐레이션, 역대급 5건+최신 소수)만으로는 9건뿐이라 너무 적다는 지적이
// 있었음 — MEGAMILLIONS_JACKPOT_ARCHIVE(832건, 2018-02-02~2026-01-20)와 POWERBALL_JACKPOT_ARCHIVE
// (182건, 2025-05-24~2026-07-20) 둘 다 사용자가 usamega.com에서 직접 긁어온 실제 잭팟 금액 —
// 합쳐서 대폭 늘림. 같은 날짜가 JACKPOT_HISTORY에 이미 있으면(예: 역대급 5건 중 일부) 중복 제외
function getCombinedJackpotHistory(){
  // odds-data.js(파워볼/메가밀리언즈 아카이브)가 아직 로드 전이면 빈 배열 — 확률체감 탭을 아직
  // 한 번도 안 열어서 go('odds')의 지연 로드가 안 끝난 상태(2026-07-22 성능 개선). 탭을 열면
  // ensureOddsDataLoaded() 완료 후 다시 호출되어 정상적으로 채워짐
  if (typeof JACKPOT_HISTORY === 'undefined') return [];
  const curatedDates = new Set(JACKPOT_HISTORY.map(e => e.game + e.date));
  const mapArchive = (archive, game) => archive
    .map(([date, numbers, special, amountMillions]) => ({
      date, game, amountUsd: amountMillions * 1000000, numbers, special,
    }))
    .filter(e => !curatedDates.has(e.game + e.date));
  const fromArchive = [
    ...mapArchive(MEGAMILLIONS_JACKPOT_ARCHIVE, 'megamillions'),
    ...mapArchive(POWERBALL_JACKPOT_ARCHIVE, 'powerball'),
  ];
  return [...JACKPOT_HISTORY, ...fromArchive].sort((a, b) => b.date.localeCompare(a.date));
}

// 442건을 한 번에 다 그리면(나라별 실수령액 계산+DOM) 페이지가 끝없이 길어지므로, 처음엔
// 일부만 보여주고 "더 보기"를 누를 때마다 이어서 더 그림. 언어를 바꿔도(applyTranslations()가
// 다시 호출해도) 펼쳐본 만큼은 유지되도록 모듈 스코프에 보관(페이지 새로고침 전까지 유지)
const JACKPOT_HISTORY_PAGE_SIZE = 15;
let jackpotHistoryVisibleCount = null;
function expandJackpotHistory(){
  jackpotHistoryVisibleCount += JACKPOT_HISTORY_PAGE_SIZE;
  renderJackpotHistory();
}

// 잭팟 목록(renderJackpotHistory)과 날짜 조회 결과(renderDateLookupResult) 둘 다 "일시불 기준
// 국가별 실수령액"을 똑같은 방식으로 보여줘야 해서 공용 함수로 뺌 — 그룹 토글 id가 두 렌더러에서
// 서로 겹치면 안 되므로 jhGroupCounter는 모듈 스코프에서 계속 증가만 함(리셋 안 함)
let jhGroupCounter = 0;
function renderAmountBreakdownHtml(cashUsd, stateCode){
  const cashKrw = cashUsd * EXCHANGE_RATE;
  const amtResults = COUNTRY_TAX_PROFILES.filter(p => p.implemented).map(profile => {
    const r = calcTakeHome(cashKrw / 100000000, profile.code, profile.needsState ? (stateCode || 'AVG') : null);
    const label = getProfileShortLabel(profile);
    return { label, flagCode: profile.flagCode, final: r.final };
  }).sort((a, b) => b.final - a.final);
  const amtGroups = [];
  amtResults.forEach(item => {
    const key = Math.round(item.final);
    const last = amtGroups[amtGroups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      amtGroups.push({ key, items: [item] });
    }
  });
  const JH_VISIBLE_COUNT = 4;
  const toAmtItem = (group, isPrimary) => {
    const wrapCls = isPrimary ? 'jh-amt-item jh-primary-item' : 'jh-amt-item jh-amt-chip';
    if (group.items.length === 1) {
      return `<span class="${wrapCls}"><span class="jh-amt-label">${group.items[0].label}</span><span class="jh-amt">${formatWon(group.items[0].final)}</span></span>`;
    }
    const groupLabel = pickLang(`${group.items.length}개국 동일`, `Same for ${group.items.length} countries`, `${group.items.length}个国家相同`, `Giống nhau ở ${group.items.length} nước`, `เท่ากันใน ${group.items.length} ประเทศ`, `Одинаково для ${group.items.length} стран`, buildSameCountMore(group.items.length));
    const listId = `jh-grp-${jhGroupCounter++}`;
    const countryBadges = group.items.map(i => `<span class="flag-badge" title="${i.label}">${i.flagCode}</span>`).join('');
    return `<span class="${wrapCls}">
      <button type="button" class="jh-amt-label jh-amt-group-toggle" onclick="toggleJhGroupList('${listId}')">${groupLabel} ▾</button>
      <span class="jh-amt">${formatWon(group.items[0].final)}</span>
      <span class="jh-amt-group-list" id="${listId}" style="display:none;">${countryBadges}</span>
    </span>`;
  };
  let shown = 0, visibleGroups = [], hiddenGroups = [];
  amtGroups.forEach(group => {
    if (shown < JH_VISIBLE_COUNT) { visibleGroups.push(group); shown += group.items.length; }
    else hiddenGroups.push(group);
  });
  const [primaryGroup, ...restVisibleGroups] = visibleGroups;
  const primaryHtml = primaryGroup ? `<div class="jh-primary-group">${toAmtItem(primaryGroup, true)}</div>` : '';
  const restHtml = restVisibleGroups.length ? `<div class="jh-amounts-grid">${restVisibleGroups.map(g => toAmtItem(g, false)).join('')}</div>` : '';
  const hiddenCountryCount = hiddenGroups.reduce((sum, g) => sum + g.items.length, 0);
  // 이 문구 안 숫자가 영어 등 라틴 문자와 섞여 있는데, RTL(아랍어/우르두어) 페이지 안에서
  // 별도 방향 지정 없이 그대로 두면 브라우저 bidi 알고리즘이 어순을 반대로 뒤집어버림
  // (예: "8 more countries" → "more countries 8") — <bdi>로 감싸서 항상 하나의 방향
  // 단위로 렌더링되게 함
  const hiddenHtml = hiddenGroups.length
    ? `<details class="jh-more"><summary class="jh-more-summary"><bdi>${pickLang(`나머지 ${hiddenCountryCount}개국 더보기`, `${hiddenCountryCount} more countries`, `其他${hiddenCountryCount}个国家`, `Xem thêm ${hiddenCountryCount} nước`, `ดูอีก ${hiddenCountryCount} ประเทศ`, `Ещё ${hiddenCountryCount} стран`, {
        ar: `${hiddenCountryCount} دولة أخرى`, bn: `আরও ${hiddenCountryCount}টি দেশ`, fr: `${hiddenCountryCount} autres pays`, hi: `${hiddenCountryCount} और देश`,
        id: `${hiddenCountryCount} negara lainnya`, ja: `他${hiddenCountryCount}カ国`, kk: `тағы ${hiddenCountryCount} ел`, km: `ប្រទេសផ្សេងទៀត ${hiddenCountryCount}`,
        ky: `дагы ${hiddenCountryCount} өлкө`, lo: `ອີກ ${hiddenCountryCount} ປະເທດ`, mn: `өөр ${hiddenCountryCount} улс`, my: `နောက်ထပ် ${hiddenCountryCount} နိုင်ငံ`,
        ne: `थप ${hiddenCountryCount} देश`, si: `තවත් රටවල් ${hiddenCountryCount}`, tl: `${hiddenCountryCount} pang bansa`, ur: `${hiddenCountryCount} مزید ممالک`,
        uz: `yana ${hiddenCountryCount} davlat`,
      })}</bdi></summary><div class="jh-amounts-grid">${hiddenGroups.map(g => toAmtItem(g, false)).join('')}</div></details>`
    : '';
  return primaryHtml + restHtml + hiddenHtml;
}

function renderJackpotHistory(){
  const listEl = document.getElementById('jackpot-history-list');
  if (!listEl) return;
  const combined = getCombinedJackpotHistory();
  const descEl = document.getElementById('jackpot-history-desc');
  if (descEl) descEl.textContent = pickLang(
    `체크한 날짜의 잭팟 금액과 국가별 실수령액을 기록했어요 (역대 최고 5건 + 실제 과거 회차 ${combined.length.toLocaleString('ko-KR')}건 포함)`,
    `Jackpot amounts we've checked, with estimated take-home by country (including the top 5 all-time records + ${combined.length.toLocaleString('en-US')} real past draws)`,
    `记录了查询当天的头奖金额，以及各国的实得金额（含历史最高5笔纪录 + 实际过往${combined.length}期）`,
    `Số tiền jackpot đã kiểm tra, cùng số tiền thực nhận theo từng nước (gồm TOP 5 kỷ lục mọi thời đại + ${combined.length.toLocaleString('en-US')} kỳ quay thật trong quá khứ)`,
    `จำนวนแจ็คพอตที่ตรวจสอบ พร้อมจำนวนเงินที่ได้รับจริงตามประเทศ (รวม TOP 5 สถิติสูงสุดตลอดกาล + การออกรางวัลจริงในอดีต ${combined.length.toLocaleString('en-US')} งวด)`,
    `Проверенные суммы джекпотов с суммой на руки по странам (включая ТОП-5 рекордов + ${combined.length.toLocaleString('ru-RU')} реальных прошлых розыгрышей)`,
    buildJhDescMore(combined.length)
  );
  if (!combined.length) {
    listEl.innerHTML = `<p class="jackpot-history-empty">${pickLang('아직 기록이 없어요.', 'No records yet.', '暂无记录。', 'Chưa có kỷ lục nào.', 'ยังไม่มีบันทึก', 'Пока нет записей.', JACKPOT_HISTORY_EMPTY_MORE)}</p>`;
    return;
  }
  if (jackpotHistoryVisibleCount === null) jackpotHistoryVisibleCount = JACKPOT_HISTORY_PAGE_SIZE;
  const gameNameKo = { powerball: '파워볼', megamillions: '메가밀리언즈' };
  const gameNameEn = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameZh = { powerball: '强力球', megamillions: '超级百万' };
  const gameNameVi = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameTh = { powerball: 'พาวเวอร์บอล', megamillions: 'เมกะมิลเลียน' };
  const gameNameRu = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  // 17개 언어 모두 "Powerball"/"Mega Millions"를 그대로 라틴 문자로 표기 — home.powerballName/
  // home.megaName의 번역(translations.json)과 같은 관례
  const sorted = combined.slice(0, jackpotHistoryVisibleCount);
  const rowsHtml = sorted.map(entry => {
    const cashUsd = entry.cashUsd || entry.amountUsd * CASH_VALUE_RATIO;
    const gameLabel = pickLang(gameNameKo[entry.game], gameNameEn[entry.game], gameNameZh[entry.game], gameNameVi[entry.game], gameNameTh[entry.game], gameNameRu[entry.game], GAME_NAME_MORE[entry.game]);
    const note = pickLang(entry.noteKo, entry.noteEn, entry.noteZh, entry.noteVi, entry.noteTh, entry.noteRu, entry.noteMore);
    const noteHtml = note ? `<p class="jh-note">${note}</p>` : '';
    const amountBreakdownHtml = renderAmountBreakdownHtml(cashUsd, entry.stateCode);
    const gameTagClass = entry.game === 'powerball' ? 'pb' : 'mm';
    const gameTagEmoji = entry.game === 'powerball' ? '🔴' : '🟡';
    return `<div class="jackpot-history-row" data-date="${entry.date}" data-game="${entry.game}">
      <div class="jh-timeline">
        <span class="jh-timeline-dot ${gameTagClass}"></span>
        <span class="jh-timeline-line"></span>
      </div>
      <div class="jh-content">
        <div class="jh-top">
          <span class="jh-date">${entry.date}</span>
          <span class="jh-game-tag ${gameTagClass}">${gameTagEmoji} ${gameLabel}</span>
        </div>
        ${noteHtml}
        ${amountBreakdownHtml}
      </div>
    </div>`;
  }).join('');

  const remaining = combined.length - jackpotHistoryVisibleCount;
  const moreBtnHtml = remaining > 0
    ? `<button type="button" class="jh-more-btn" onclick="expandJackpotHistory()">${pickLang(
        `${remaining}건 더 보기`, `Show ${remaining} more`, `再显示${remaining}条`, `Xem thêm ${remaining} mục`, `ดูอีก ${remaining} รายการ`, `Показать ещё ${remaining}`,
        buildJhMoreBtnMore(remaining)
      )}</button>`
    : '';
  listEl.innerHTML = rowsHtml + moreBtnHtml;
}
function buildJhMoreBtnMore(remaining){
  return {
    ar: `عرض ${remaining} المزيد`, bn: `আরও ${remaining}টি দেখুন`, fr: `Afficher ${remaining} de plus`, hi: `${remaining} और दिखाएं`,
    id: `Tampilkan ${remaining} lagi`, ja: `あと${remaining}件表示`, kk: `тағы ${remaining} көрсету`, km: `បង្ហាញបន្ថែម ${remaining}`,
    ky: `дагы ${remaining} көрсөтүү`, lo: `ສະແດງອີກ ${remaining} ລາຍການ`, mn: `өөр ${remaining}-г харуулах`, my: `နောက်ထပ် ${remaining} ခုပြပါ`,
    ne: `थप ${remaining} देखाउनुहोस्`, si: `තවත් ${remaining}ක් පෙන්වන්න`, tl: `Ipakita ang ${remaining} pa`, ur: `مزید ${remaining} دکھائیں`,
    uz: `yana ${remaining} tasini ko'rsatish`,
  };
}
function buildJhDescMore(count){
  const c = count.toLocaleString('en-US');
  return {
    ar: `مبالغ الجوائز الكبرى التي تحققنا منها، مع المبلغ التقديري حسب الدولة (بما في ذلك أعلى 5 أرقام قياسية + ${c} سحبًا حقيقيًا من الماضي)`,
    bn: `আমরা যাচাই করা জ্যাকপট পরিমাণ, দেশ অনুযায়ী প্রাপ্ত পরিমাণসহ (সর্বকালের সেরা 5টি রেকর্ড + অতীতের প্রকৃত ${c}টি ড্রসহ)`,
    fr: `Montants de jackpots vérifiés, avec le montant net par pays (incluant le top 5 de tous les temps + ${c} tirages réels passés)`,
    hi: `जाँचे गए जैकपॉट राशियाँ, देश के अनुसार प्राप्त राशि सहित (सर्वकालिक शीर्ष 5 + अतीत के वास्तविक ${c} ड्रॉ सहित)`,
    id: `Jumlah jackpot yang diperiksa, dengan jumlah yang dibawa pulang menurut negara (termasuk 5 rekor tertinggi + ${c} undian asli di masa lalu)`,
    ja: `確認したジャックポット額と国別の手取り額（歴代トップ5 + 過去の実際の抽選${c}回を含む）`,
    kk: `Тексерілген джекпот сомалары, елдер бойынша қолға тиетін сомамен (барлық кезеңдегі ең жоғары 5 + өткендегі нақты ${c} тартылыммен)`,
    km: `ចំនួនរង្វាន់ធំដែលបានពិនិត្យ ជាមួយចំនួនទទួលបានតាមប្រទេស (រួមទាំង 5 កំណត់ត្រាខ្ពស់បំផុត + ការទាញឆ្នោតពិត ${c} ក្នុងអតីតកាល)`,
    ky: `Текшерилген джекпот суммалары, өлкөлөр боюнча колго тиер сумма менен (бардык доордогу эң жогорку 5 + мурдагы реалдуу ${c} тартылыш менен)`,
    lo: `ຈຳນວນລາງວັນໃຫຍ່ທີ່ກວດສອບ ພ້ອມຈຳນວນທີ່ໄດ້ຮັບຕາມປະເທດ (ລວມ 5 ອັນດັບສູງສຸດຕະຫຼອດການ + ການອອກຕົວຈິງໃນອະດີດ ${c} ຄັ້ງ)`,
    mn: `Шалгасан их шагналын дүнгүүд, улс орон бүрээр гарт орох дүнтэй хамт (бүх цаг үеийн шилдэг 5 + өнгөрсний бодит ${c} сугалаатай)`,
    my: `စစ်ဆေးထားသော ဂျက်ကပေါင်ငွေပမာဏများနှင့် နိုင်ငံအလိုက်ရရှိမည့်ငွေ (သမိုင်းတစ်လျှောက်အကြီးဆုံး 5 + အတိတ်က အမှန်တကယ် ${c} ကြိမ်အပါအဝင်)`,
    ne: `जाँचिएका ज्याकपोट रकमहरू, देशअनुसार प्राप्त रकमसहित (सर्वकालीन शीर्ष 5 + विगतका वास्तविक ${c} ड्रसहित)`,
    si: `පරීක්ෂා කළ ජැක්පොට් මුදල් සහ රට අනුව ලැබෙන මුදල (සියලු කාලවල ඉහළම 5 + අතීත සැබෑ දිනුම් ඇදීම් ${c}ක් ඇතුළුව)`,
    tl: `Mga halaga ng jackpot na na-check, kasama ang take-home ayon sa bansa (kasama ang top 5 all-time + ${c} totoong nakaraang draw)`,
    ur: `چیک کی گئی جیک پاٹ رقوم، ملک کے حساب سے ملنے والی رقم کے ساتھ (تمام ادوار کے سب سے بڑے 5 + ماضی کے حقیقی ${c} ڈرا سمیت)`,
    uz: `Tekshirilgan jekpot summalari, mamlakatlar bo'yicha qo'lga tegadigan summa bilan (barcha davrlardagi eng yuqori 5 + o'tmishdagi haqiqiy ${c} ta tortish bilan)`,
  };
}
// 🏆 실수령액 재랭킹 — 발표된(연금) 잭팟 금액 순서가 아니라, 실제로 선택된 세금 기준(sharedCountry/
// sharedState — 홈/비교 화면에서 고른 나라)의 거주자가 오늘 세율로 실제 손에 쥐는 금액 기준으로
// 다시 줄 세움. 표시 언어가 아니라 실제 세금 계산 기준을 따라야 함(FLEX_REF의 "이 돈이면 뭘 살 수
// 있나"와 같은 원칙 — 중국 기준으로 계산했는데 한국 거주자 실수령액 랭킹이 나오면 앞뒤가 안 맞음).
// 미국 세율만 다루는 다른 복권 통계 사이트들은 외국 거주자 세금 계산 자체를 안 하니 만들 수 없는
// 조합 — getCombinedJackpotHistory()가 이미 모아둔 1,000건+ 실제 잭팟 기록을 그대로 재사용
function getJackpotRealTakeHomeRanking(topN){
  return getCombinedJackpotHistory().map(entry => {
    const cashUsd = entry.cashUsd || entry.amountUsd * CASH_VALUE_RATIO;
    const cashKrw = cashUsd * EXCHANGE_RATE;
    const takeHome = calcTakeHome(cashKrw / 100000000, sharedCountry, sharedState).final;
    return { entry, announcedKrw: entry.amountUsd * EXCHANGE_RATE, takeHome };
  }).sort((a, b) => b.takeHome - a.takeHome).slice(0, topN);
}

function renderJackpotTakeHomeRanking(){
  const listEl = document.getElementById('jh-rank-list');
  if (!listEl) return;
  const titleEl = document.getElementById('jh-rank-title');
  const descEl = document.getElementById('jh-rank-desc');
  if (titleEl) titleEl.textContent = pickLang(
    '🏆 발표 금액 말고, 실제로 손에 쥐는 돈 기준으로 다시 줄 세우면?',
    '🏆 What if we ranked by actual take-home, not the announced amount?',
    '🏆 如果不按发布金额，而按实际到手金额重新排名呢？',
    '🏆 Nếu xếp hạng theo số tiền thực nhận, chứ không phải số tiền công bố thì sao?',
    '🏆 ถ้าจัดอันดับตามเงินที่ได้รับจริง ไม่ใช่จำนวนที่ประกาศล่ะ?',
    '🏆 А что если ранжировать по реальной сумме на руки, а не по объявленной?',
    JH_RANK_TITLE_MORE
  );
  // 랭킹 자체(getJackpotRealTakeHomeRanking)뿐 아니라 이 설명 문구도 실제 선택된 세금 기준을
  // 따라야 함 — calcTakeHome()이 나라별로 이미 22개 언어 전부 커버해 돌려주는 basisSuffix
  // ("한국 거주자"/"China resident (living in China)" 등, pickLang으로 현재 언어에 맞게 이미
  // 해석된 문자열)를 그대로 문장 끝에 덧붙임. amount 인자는 basisSuffix 값 자체에 영향을 주지
  // 않으므로(나라별 분기 어디서도 금액에 따라 문구가 안 바뀜) 아무 값이나 넣어도 안전함
  const basisSuffix = calcTakeHome(1, sharedCountry, sharedState).basisSuffix;
  if (descEl) descEl.textContent = pickLang(
    `발표 잭팟(연금) 순위가 아니라, 오늘 세율로 실제 받는 금액 기준 TOP 10이에요 · ${basisSuffix}`,
    `Not ranked by the announced (annuity) jackpot — this is the TOP 10 by what's actually taken home under today's tax rates · ${basisSuffix}`,
    `不是按发布的（年金）头奖排名，而是按今天税率下实际到手金额排出的TOP 10 · ${basisSuffix}`,
    `Không xếp theo jackpot công bố (trả góp) — đây là TOP 10 theo số tiền thực nhận theo thuế suất hôm nay · ${basisSuffix}`,
    `ไม่ได้จัดอันดับตามแจ็คพอตที่ประกาศ(แบบผ่อน) — นี่คือ TOP 10 ตามจำนวนเงินที่ได้รับจริงตามอัตราภาษีวันนี้ · ${basisSuffix}`,
    `Ранжировано не по объявленному (аннуитетному) джекпоту — это ТОП-10 по сумме, которую реально получают на руки по сегодняшним налоговым ставкам · ${basisSuffix}`,
    buildRankDescMore(basisSuffix)
  );

  const gameNameKo = { powerball: '파워볼', megamillions: '메가밀리언즈' };
  const gameNameEn = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameZh = { powerball: '强力球', megamillions: '超级百万' };
  const gameNameVi = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameTh = { powerball: 'พาวเวอร์บอล', megamillions: 'เมกะมิลเลียน' };
  const gameNameRu = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const medals = ['🥇', '🥈', '🥉'];

  listEl.innerHTML = getJackpotRealTakeHomeRanking(10).map(({ entry, announcedKrw, takeHome }, i) => {
    const gameLabel = pickLang(gameNameKo[entry.game], gameNameEn[entry.game], gameNameZh[entry.game], gameNameVi[entry.game], gameNameTh[entry.game], gameNameRu[entry.game], GAME_NAME_MORE[entry.game]);
    const gameTagClass = entry.game === 'powerball' ? 'pb' : 'mm';
    const gameTagEmoji = entry.game === 'powerball' ? '🔴' : '🟡';
    const rankBadge = medals[i] || `${i + 1}`;
    const announcedLine = pickLang(
      `발표액 ${formatWon(announcedKrw / 100000000)}`, `Announced ${formatWon(announcedKrw / 100000000)}`,
      `发布金额 ${formatWon(announcedKrw / 100000000)}`, `Công bố ${formatWon(announcedKrw / 100000000)}`,
      `ประกาศ ${formatWon(announcedKrw / 100000000)}`, `Объявлено ${formatWon(announcedKrw / 100000000)}`,
      buildAnnouncedLineMore(formatWon(announcedKrw / 100000000))
    );
    return `<div class="jh-rank-row">
      <span class="jh-rank-medal">${rankBadge}</span>
      <div class="jh-rank-body">
        <div class="jh-rank-top">
          <span class="jh-rank-date">${entry.date}</span>
          <span class="jh-game-tag ${gameTagClass}">${gameTagEmoji} ${gameLabel}</span>
        </div>
        <div class="jh-rank-amt">${formatWon(takeHome)}</div>
        <div class="jh-rank-sub">${announcedLine}</div>
      </div>
    </div>`;
  }).join('');
}
const JH_RANK_TITLE_MORE = {
  ar: '🏆 ماذا لو رتبنا حسب المبلغ الفعلي المستلم، وليس المبلغ المعلن؟',
  bn: '🏆 ঘোষিত পরিমাণ নয়, প্রকৃত প্রাপ্ত পরিমাণ অনুযায়ী র‍্যাঙ্ক করলে কেমন হয়?',
  fr: '🏆 Et si on classait par montant net réel, pas par le montant annoncé ?',
  hi: '🏆 घोषित राशि नहीं, बल्कि असली मिलने वाली राशि के आधार पर रैंक करें तो?',
  id: '🏆 Bagaimana jika diurutkan berdasarkan jumlah yang benar-benar diterima, bukan jumlah yang diumumkan?',
  ja: '🏆 発表額ではなく、実際の手取り額で順位をつけたら？',
  kk: '🏆 Хабарланған сома бойынша емес, нақты қолға тиетін сома бойынша сұрыптасақ ше?',
  km: '🏆 ចុះបើយើងតម្រៀបតាមចំនួនដែលទទួលបានពិតប្រាកដ មិនមែនចំនួនប្រកាស?',
  ky: '🏆 Жарыяланган сумма боюнча эмес, чын эле колго тийген сумма боюнча тизсек кандай болот?',
  lo: '🏆 ຖ້າຈັດອັນດັບຕາມຈຳນວນທີ່ໄດ້ຮັບຈິງ ບໍ່ແມ່ນຈຳນວນທີ່ປະກາດລະ?',
  mn: '🏆 Зарласан дүнгээр биш, гарт орсон бодит дүнгээр эрэмблэвэл яах вэ?',
  my: '🏆 ကြေညာထားသောပမာဏအစား လက်ခံရရှိသောအမှန်ပမာဏအလိုက် အဆင့်သတ်မှတ်ရင်ရော?',
  ne: '🏆 घोषित रकम होइन, वास्तवमा हातमा पर्ने रकमको आधारमा क्रमबद्ध गर्दा नि?',
  si: '🏆 නිවේදනය කළ මුදල නොව, සැබවින්ම අත ලැබෙන මුදල අනුව අනුපිළිවෙළ ගැසුවොත්?',
  tl: '🏆 Paano kung ayon sa aktwal na natanggap na halaga ang ranggo, hindi sa inanunsyong halaga?',
  ur: '🏆 اگر اعلان شدہ رقم کے بجائے اصل میں ملنے والی رقم کی بنیاد پر درجہ بندی کریں تو؟',
  uz: "🏆 E'lon qilingan summa emas, haqiqatda qo'lga tegadigan summa bo'yicha saralasak-chi?",
};
// 예전엔 이 설명 문구가 "한국 거주자가 오늘 세율로 실제 받는 금액" 식으로 나라 이름을 고정
// 텍스트로 박아뒀었음(=버그: sharedCountry가 kr이 아니어도 항상 "Korea resident"라고 표시됨).
// 이제는 calcTakeHome()의 basisSuffix(선택된 sharedCountry 기준으로 이미 22개 언어 다 커버됨)를
// 문장 끝에 " · "로 덧붙이는 방식으로 바꿔서(다른 곳의 "금액 · 라벨" 표기 관례와 동일), 아래
// 17개 언어 문장에서는 나라를 특정하는 부분만 지우고 그 자리를 basisSuffix가 대신하게 함
function buildRankDescMore(basisSuffix){
  return {
  ar: `ليس مرتبًا حسب الجاكبوت المعلن (السنوي) — هذه قائمة أفضل 10 حسب ما يتم استلامه فعليًا وفق معدلات الضريبة الحالية · ${basisSuffix}`,
  bn: `ঘোষিত (বার্ষিক) জ্যাকপট অনুযায়ী নয় — এটি আজকের করহারে প্রকৃতপক্ষে যা পাওয়া যায় তার ভিত্তিতে TOP 10 · ${basisSuffix}`,
  fr: `Non classé par le jackpot annoncé (rente) — voici le TOP 10 selon ce qui est réellement reçu aux taux d'imposition actuels · ${basisSuffix}`,
  hi: `घोषित (वार्षिकी) जैकपॉट के अनुसार नहीं — यह आज की कर दरों पर वास्तव में मिलने वाली राशि के आधार पर TOP 10 है · ${basisSuffix}`,
  id: `Bukan diurutkan berdasarkan jackpot yang diumumkan (anuitas) — ini TOP 10 berdasarkan jumlah yang benar-benar diterima dengan tarif pajak hari ini · ${basisSuffix}`,
  ja: `発表された（年金形式の）ジャックポット順ではなく、今日の税率で実際に受け取る金額でのTOP10です · ${basisSuffix}`,
  kk: `Хабарланған (аннуитеттік) джекпот бойынша емес — бұл бүгінгі салық мөлшерлемесімен нақты алатын сома бойынша ТОП-10 · ${basisSuffix}`,
  km: `មិនតម្រៀបតាមចំនួនរង្វាន់ធំដែលប្រកាស(តាមរយៈពេល)ទេ — នេះជា TOP 10 តាមចំនួនដែលទទួលបានពិតប្រាកដតាមអត្រាពន្ធថ្ងៃនេះ · ${basisSuffix}`,
  ky: `Жарыяланган (аннуитеттик) джекпот боюнча эмес — бул бүгүнкү салык ставкасы менен чын эле алган сумма боюнча ТОП-10 · ${basisSuffix}`,
  lo: `ບໍ່ໄດ້ຈັດອັນດັບຕາມແຈັກພອດທີ່ປະກາດ(ແບບຜ່ອນຊຳລະ) — ນີ້ແມ່ນ TOP 10 ຕາມຈຳນວນທີ່ໄດ້ຮັບຈິງຕາມອັດຕາພາສີມື້ນີ້ · ${basisSuffix}`,
  mn: `Зарласан (жилийн тэтгэвэрийн) жекпотоор биш — энэ бол өнөөдрийн татварын хувь хэмжээгээр бодит гарт орох дүнгээр ТОП 10 · ${basisSuffix}`,
  my: `ကြေညာထားသော (နှစ်ချီပေးငွေ) ဂျက်ကပေါ့အစဉ်အလိုက်မဟုတ်ပါ — ဤသည်မှာ ယနေ့အခွန်နှုန်းဖြင့် အမှန်တကယ်ရရှိသောပမာဏအလိုက် ထိပ်တန်း ၁၀ ဖြစ်သည် · ${basisSuffix}`,
  ne: `घोषित (वार्षिकी) ज्याकपोट अनुसार होइन — यो आजको कर दरमा वास्तवमा पाउने रकमको आधारमा शीर्ष १० हो · ${basisSuffix}`,
  si: `නිවේදනය කළ (වාර්ෂික) ජැක්පොට් අනුව නොවේ — මෙය අද බදු අනුපාත යටතේ සැබවින්ම ලැබෙන මුදල අනුව ඉහළම 10 වේ · ${basisSuffix}`,
  tl: `Hindi ayon sa inanunsyong (annuity) jackpot — ito ang TOP 10 ayon sa aktwal na natatanggap sa kasalukuyang buwis · ${basisSuffix}`,
  ur: `اعلان شدہ (سالانہ) جیک پاٹ کے حساب سے نہیں — یہ آج کی ٹیکس شرح پر واقعی ملنے والی رقم کی بنیاد پر ٹاپ 10 ہے · ${basisSuffix}`,
  uz: `E'lon qilingan (annuitet) jekpot bo'yicha emas — bu bugungi soliq stavkalarida haqiqatda qo'lga kiritadigan summa bo'yicha TOP 10 · ${basisSuffix}`,
  };
}
function buildAnnouncedLineMore(amt){
  return {
    ar: `المبلغ المعلن ${amt}`, bn: `ঘোষিত ${amt}`, fr: `Annoncé ${amt}`, hi: `घोषित ${amt}`,
    id: `Diumumkan ${amt}`, ja: `発表額 ${amt}`, kk: `Хабарланған ${amt}`, km: `បានប្រកាស ${amt}`,
    ky: `Жарыяланган ${amt}`, lo: `ປະກາດ ${amt}`, mn: `Зарласан ${amt}`, my: `ကြေညာ ${amt}`,
    ne: `घोषित ${amt}`, si: `නිවේදනය ${amt}`, tl: `Inanunsyo ${amt}`, ur: `اعلان کردہ ${amt}`,
    uz: `E'lon qilingan ${amt}`,
  };
}

// 📅 날짜로 당첨번호 찾아보기 — usamega.com의 "Search Past Results"와 비슷한 기능이지만,
// 여러 회차를 목록으로 보여주는 대신(사용자와 상의해 더 간단한 쪽으로 결정) 날짜 하나를 고르면
// 그날 회차만 바로 보여줌. 잭팟 금액 아카이브(POWERBALL_JACKPOT_ARCHIVE/MEGAMILLIONS_JACKPOT_ARCHIVE,
// 금액 있음)를 먼저 찾고, 없으면 당첨번호 아카이브(POWERBALL_DRAW_ARCHIVE/MEGAMILLIONS_DRAW_ARCHIVE,
// 날짜 범위가 더 넓지만 금액 없음)로 폴백함 — 파워볼/메가밀리언즈는 추첨 요일이 겹치지 않아
// 하루에 최대 1개 게임만 나옴
function findDrawByDate(dateStr){
  if (typeof JACKPOT_HISTORY === 'undefined') return null; // odds-data.js 로드가 아직 안 끝난 극히 드문 경우
  const jh = JACKPOT_HISTORY.find(e => e.date === dateStr && e.numbers);
  if (jh) return { game: jh.game, numbers: jh.numbers, special: jh.special, amountUsd: jh.amountUsd };

  const pbJackpot = POWERBALL_JACKPOT_ARCHIVE.find(([d]) => d === dateStr);
  if (pbJackpot) return { game: 'powerball', numbers: pbJackpot[1], special: pbJackpot[2], amountUsd: pbJackpot[3] * 1000000 };
  const mmJackpot = MEGAMILLIONS_JACKPOT_ARCHIVE.find(([d]) => d === dateStr);
  if (mmJackpot) return { game: 'megamillions', numbers: mmJackpot[1], special: mmJackpot[2], amountUsd: mmJackpot[3] * 1000000 };

  const pbNum = POWERBALL_DRAW_ARCHIVE.find(([d]) => d === dateStr);
  if (pbNum) return { game: 'powerball', numbers: pbNum[1], special: pbNum[2], amountUsd: null };
  const mmNum = MEGAMILLIONS_DRAW_ARCHIVE.find(([d]) => d === dateStr);
  if (mmNum) return { game: 'megamillions', numbers: mmNum[1], special: mmNum[2], amountUsd: null };

  return null;
}

function setupDateLookup(){
  const input = document.getElementById('dl-date-input');
  if (!input || input.dataset.wired) return;
  input.dataset.wired = '1';
  input.addEventListener('change', () => renderDateLookupResult(input.value));
  // 처음엔 빈 채로 두는 게 의도였는데, 아이폰 사파리는 빈 date input에 "mm/dd/yyyy" 같은
  // 안내 텍스트조차 안 보여줘서 완전히 텅 빈 칸처럼 보이는 문제가 있었음(스크린샷으로 확인,
  // 2026-07-22) — 오늘 날짜로 기본값을 채워서 처음부터 뭔가 보이게 하고, 그 날짜 결과도 바로 보여줌
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  input.value = todayStr;
  renderDateLookupResult(todayStr);
}

function renderDateLookupResult(dateStr){
  const resultEl = document.getElementById('dl-result');
  if (!resultEl) return;
  if (!dateStr) { resultEl.innerHTML = ''; return; }

  // odds-data.js가 아직 로딩 중일 때(탭을 막 연 직후 곧바로 날짜를 고른 경우, 특히 느린 회선에서)
  // findDrawByDate()가 데이터 없이 바로 "그 날짜엔 기록 없음"으로 잘못 나오는 문제가 있었음
  // (Playwright로 재현 확인, 2026-07-22) — 로드가 끝날 때까지 기다렸다가 그린다. 기다리는 동안
  // 사용자가 다른 날짜로 또 바꾸면(연타), 그 사이 값이 이미 낡았을 수 있어 resolve 시점에 입력값이
  // 그대로인지 다시 확인해서 낡은 결과가 늦게 튀어나오지 않게 함
  if (typeof JACKPOT_HISTORY === 'undefined') {
    resultEl.innerHTML = `<p class="dl-empty">${pickLang('불러오는 중…', 'Loading…', '加载中…', 'Đang tải…', 'กำลังโหลด…', 'Загрузка…', DL_LOADING_MORE)}</p>`;
    ensureOddsDataLoaded().then(() => {
      const input = document.getElementById('dl-date-input');
      if (input && input.value !== dateStr) return;
      renderDateLookupResult(dateStr);
    });
    return;
  }

  const gameNameKo = { powerball: '파워볼', megamillions: '메가밀리언즈' };
  const gameNameEn = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameZh = { powerball: '强力球', megamillions: '超级百万' };
  const gameNameVi = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameTh = { powerball: 'พาวเวอร์บอล', megamillions: 'เมกะมิลเลียน' };
  const gameNameRu = { powerball: 'Powerball', megamillions: 'Mega Millions' };

  const draw = findDrawByDate(dateStr);
  if (!draw) {
    resultEl.innerHTML = `<p class="dl-empty">${pickLang(
      '이 날짜엔 추첨 기록이 없어요 (추첨 요일이 아니거나, 아직 데이터가 없는 시기예요)',
      'No draw on this date (not a draw day, or outside the data we have)',
      '这一天没有开奖记录（不是开奖日，或不在现有数据范围内）',
      'Không có kỳ quay vào ngày này (không phải ngày quay số, hoặc ngoài phạm vi dữ liệu)',
      'ไม่มีการออกรางวัลในวันนี้ (ไม่ใช่วันออกรางวัล หรืออยู่นอกช่วงข้อมูลที่มี)',
      'В этот день розыгрыша не было (не день розыгрыша, либо вне периода имеющихся данных)',
      DL_EMPTY_MORE
    )}</p>`;
    return;
  }

  const gameLabel = pickLang(gameNameKo[draw.game], gameNameEn[draw.game], gameNameZh[draw.game], gameNameVi[draw.game], gameNameTh[draw.game], gameNameRu[draw.game], GAME_NAME_MORE[draw.game]);
  const gameTagClass = draw.game === 'powerball' ? 'pb' : 'mm';
  const gameTagEmoji = draw.game === 'powerball' ? '🔴' : '🟡';
  const ballsHtml = draw.numbers.map(n => `<span class="mn-result-ball">${n}</span>`).join('')
    + `<span class="mn-result-ball special">${draw.special}</span>`;
  // 금액이 있으면 역대 잭팟 확인 기록 목록과 똑같은 방식(renderAmountBreakdownHtml)으로
  // 국가별 실수령액까지 바로 보여줘서, 번호 조회와 금액 조회를 각각 다른 곳에서 찾아볼 필요가
  // 없게 함 — 두 섹션이 따로 있던 걸 하나로 합쳐달라는 요청 반영(2026-07-22)
  const amountHtml = draw.amountUsd
    ? `<p class="dl-amt">${pickLang('발표 잭팟', 'Announced jackpot', '发布头奖', 'Jackpot công bố', 'แจ็คพอตที่ประกาศ', 'Объявленный джекпот', DL_JACKPOT_LABEL_MORE)}: ${formatWon(draw.amountUsd * EXCHANGE_RATE / 100000000)}</p>${renderAmountBreakdownHtml(draw.cashUsd || draw.amountUsd * CASH_VALUE_RATIO, draw.stateCode)}`
    : `<p class="dl-no-amt">${pickLang('이 회차는 잭팟 금액 데이터가 없어요(당첨번호만 있어요)', 'No jackpot amount for this draw (numbers only)', '这一期没有头奖金额数据（仅有开奖号码）', 'Kỳ quay này không có dữ liệu jackpot (chỉ có số trúng)', 'งวดนี้ไม่มีข้อมูลจำนวนแจ็คพอต (มีแค่เลขที่ออก)', 'Для этого розыгрыша нет суммы джекпота (только числа)', DL_NO_AMT_MORE)}</p>`;

  resultEl.innerHTML = `<div class="jackpot-history-row">
    <div class="jh-timeline"><span class="jh-timeline-dot ${gameTagClass}"></span></div>
    <div class="jh-content">
      <div class="jh-top">
        <span class="jh-date">${dateStr}</span>
        <span class="jh-game-tag ${gameTagClass}">${gameTagEmoji} ${gameLabel}</span>
      </div>
      <div class="mn-result-balls">${ballsHtml}</div>
      ${amountHtml}
    </div>
  </div>`;
}

function updateDateLookupUi(){
  const descEl = document.getElementById('dl-desc');
  if (descEl) descEl.textContent = pickLang(
    '날짜를 골라보세요 — 파워볼은 월·수·토, 메가밀리언즈는 화·금에 추첨해요',
    'Pick a date — Powerball draws Mon/Wed/Sat, Mega Millions draws Tue/Fri',
    '选择日期——强力球在周一/三/六开奖，超级百万在周二/五开奖',
    'Chọn một ngày — Powerball quay vào Thứ 2/4/7, Mega Millions quay vào Thứ 3/6',
    'เลือกวันที่ — พาวเวอร์บอลออกวันจันทร์/พุธ/เสาร์ เมกะมิลเลียนออกวันอังคาร/ศุกร์',
    'Выберите дату — Powerball разыгрывается пн/ср/сб, Mega Millions — вт/пт',
    DL_DESC_MORE
  );
  setupDateLookup();
}
const DL_DESC_MORE = {
  ar: 'اختر تاريخًا — تُسحب Powerball أيام الإثنين والأربعاء والسبت، وMega Millions أيام الثلاثاء والجمعة',
  bn: 'একটি তারিখ বেছে নিন — Powerball সোম/বুধ/শনি এবং Mega Millions মঙ্গল/শুক্র তে ড্র হয়',
  fr: 'Choisissez une date — Powerball est tiré lun/mer/sam, Mega Millions mar/ven',
  hi: 'एक तारीख चुनें — Powerball सोम/बुध/शनि को और Mega Millions मंगल/शुक्र को होता है',
  id: 'Pilih tanggal — Powerball diundi Sen/Rab/Sab, Mega Millions Sel/Jum',
  ja: '日付を選んでください — パワーボールは月・水・土、メガミリオンズは火・金に抽選します',
  kk: 'күнді таңдаңыз — Powerball дүйсенбі/сәрсенбі/сенбіде, Mega Millions сейсенбі/жұмада тартылады',
  km: 'ជ្រើសរើសកាលបរិច្ឆេទ — Powerball ទាញនៅថ្ងៃច័ន្ទ/ពុធ/សៅរ៍ ហើយ Mega Millions ថ្ងៃអង្គារ/សុក្រ',
  ky: 'күндү тандаңыз — Powerball дүйшөмбү/шаршемби/ишембиде, Mega Millions шейшемби/жумада тартылат',
  lo: 'ເລືອກວັນທີ — Powerball ອອກວັນຈັນ/ພຸດ/ເສົາ, Mega Millions ວັນອັງຄານ/ສຸກ',
  mn: 'огноог сонгоно уу — Powerball даваа/лхагва/бямбад, Mega Millions мягмар/баасанд сугалдаг',
  my: 'ရက်စွဲတစ်ခုကို ရွေးပါ — Powerball သည် တနင်္လာ/ဗုဒ္ဓဟူး/စနေနေ့တွင်၊ Mega Millions သည် အင်္ဂါ/သောကြာနေ့တွင် မဲနှိုက်သည်',
  ne: 'मिति छान्नुहोस् — Powerball सोम/बुध/शनिबार र Mega Millions मंगल/शुक्रबार ड्र हुन्छ',
  si: 'දිනයක් තෝරන්න — Powerball සඳුදා/බදාදා/සෙනසුරාදා සහ Mega Millions අඟහරුවාදා/සිකුරාදා ඇදිනු ලැබේ',
  tl: 'Pumili ng petsa — Powerball ay sa Lun/Miy/Sab, Mega Millions ay sa Mar/Biy',
  ur: 'ایک تاریخ منتخب کریں — Powerball پیر/بدھ/ہفتہ کو اور Mega Millions منگل/جمعہ کو نکالا جاتا ہے',
  uz: "sanani tanlang — Powerball dushanba/chorshanba/shanba, Mega Millions seshanba/juma kunlari o'tkaziladi",
};
const DL_LOADING_MORE = {
  ar: 'جارٍ التحميل…', bn: 'লোড হচ্ছে…', fr: 'Chargement…', hi: 'लोड हो रहा है…', id: 'Memuat…', ja: '読み込み中…',
  kk: 'жүктелуде…', km: 'កំពុងផ្ទុក…', ky: 'жүктөлүүдө…', lo: 'ກຳລັງໂຫຼດ…', mn: 'ачаалж байна…', my: 'ဖွင့်နေသည်…',
  ne: 'लोड हुँदैछ…', si: 'පූරණය වෙමින්…', tl: 'Naglo-load…', ur: 'لوڈ ہو رہا ہے…', uz: 'Yuklanmoqda…',
};
const DL_EMPTY_MORE = {
  ar: 'لا يوجد سحب في هذا التاريخ (ليس يوم سحب، أو خارج نطاق البيانات المتوفرة)',
  bn: 'এই তারিখে কোনো ড্র নেই (ড্রয়ের দিন নয়, অথবা উপলব্ধ তথ্যের বাইরে)',
  fr: 'Aucun tirage à cette date (pas un jour de tirage, ou hors de la plage de données disponible)',
  hi: 'इस तारीख पर कोई ड्रॉ नहीं है (ड्रॉ का दिन नहीं है, या उपलब्ध डेटा की सीमा से बाहर है)',
  id: 'Tidak ada undian pada tanggal ini (bukan hari undian, atau di luar rentang data yang ada)',
  ja: 'この日付には抽選がありません（抽選日ではないか、データの範囲外です）',
  kk: 'бұл күні тарту болмаған (тарту күні емес немесе қолжетімді деректер аясынан тыс)',
  km: 'មិនមានការទាញឆ្នោតនៅថ្ងៃនេះទេ (មិនមែនថ្ងៃទាញឆ្នោត ឬនៅក្រៅជួរទិន្នន័យដែលមាន)',
  ky: 'бул күнү тартылыш болгон эмес (тартылыш күнү эмес же жеткиликтүү маалыматтын чегинен тышкары)',
  lo: 'ບໍ່ມີການອອກລາງວັນໃນວັນທີນີ້ (ບໍ່ແມ່ນວັນອອກ ຫຼືຢູ່ນອກຂອບເຂດຂໍ້ມູນທີ່ມີ)',
  mn: 'энэ өдөр сугалаа болоогүй (сугалааны өдөр биш эсвэл байгаа мэдээллийн хүрээнээс гадуур)',
  my: 'ဤရက်စွဲတွင် မဲနှိုက်မှုမရှိပါ (မဲနှိုက်ရက်မဟုတ်သည် သို့မဟုတ် ရရှိနိုင်သောဒေတာအပြင်ဘက်ဖြစ်သည်)',
  ne: 'यो मितिमा कुनै ड्र छैन (ड्र दिन होइन, वा उपलब्ध डेटाको दायरा बाहिर)',
  si: 'මෙම දිනයේ දිනුම් ඇදීමක් නොමැත (දිනුම් ඇදුම් දිනයක් නොවේ, හෝ පවතින දත්ත පරාසයෙන් පිටත)',
  tl: 'Walang draw sa petsang ito (hindi araw ng draw, o wala sa saklaw ng available na datos)',
  ur: 'اس تاریخ کو کوئی ڈرا نہیں ہے (ڈرا کا دن نہیں ہے، یا دستیاب ڈیٹا کی حد سے باہر ہے)',
  uz: "bu sanada tortish bo'lmagan (tortish kuni emas yoki mavjud ma'lumotlar doirasidan tashqarida)",
};
const DL_JACKPOT_LABEL_MORE = {
  ar: 'الجاكبوت المعلن', bn: 'ঘোষিত জ্যাকপট', fr: 'Jackpot annoncé', hi: 'घोषित जैकपॉट',
  id: 'Jackpot yang diumumkan', ja: '発表されたジャックポット', kk: 'Хабарланған джекпот', km: 'ជេកផតដែលបានប្រកាស',
  ky: 'Жарыяланган джекпот', lo: 'ແຈັກພອດທີ່ປະກາດ', mn: 'Зарласан жекпот', my: 'ကြေညာထားသော ဂျက်ကပေါ့',
  ne: 'घोषित ज्याकपोट', si: 'නිවේදනය කළ ජැක්පොට්', tl: 'Inanunsyong jackpot', ur: 'اعلان کردہ جیک پاٹ',
  uz: "E'lon qilingan jekpot",
};
const DL_NO_AMT_MORE = {
  ar: 'لا توجد بيانات لمبلغ الجاكبوت لهذا السحب (الأرقام فقط)',
  bn: 'এই ড্রয়ের জন্য জ্যাকপট পরিমাণের তথ্য নেই (শুধু নম্বর আছে)',
  fr: 'Pas de montant de jackpot pour ce tirage (numéros seulement)',
  hi: 'इस ड्रॉ के लिए जैकपॉट राशि का डेटा नहीं है (केवल नंबर हैं)',
  id: 'Tidak ada data jumlah jackpot untuk undian ini (hanya nomor)',
  ja: 'この抽選のジャックポット金額データはありません（番号のみ）',
  kk: 'бұл тарту үшін джекпот сомасы жоқ (тек сандар бар)',
  km: 'មិនមានទិន្នន័យចំនួនជេកផតសម្រាប់ការទាញឆ្នោតនេះទេ (មានតែលេខប៉ុណ្ណោះ)',
  ky: 'бул тартылыш үчүн джекпот суммасынын дайны жок (жалгыз сандар гана бар)',
  lo: 'ບໍ່ມີຂໍ້ມູນຈຳນວນແຈັກພອດສຳລັບການອອກຄັ້ງນີ້ (ມີແຕ່ໝາຍເລກ)',
  mn: 'энэ сугалааны жекпотын дүнгийн мэдээлэл алга (зөвхөн дугаар байгаа)',
  my: 'ဤထီပေါက်စဉ်အတွက် ဂျက်ကပေါ့ပမာဏဒေတာမရှိပါ (ဂဏန်းများသာရှိသည်)',
  ne: 'यो ड्रको लागि ज्याकपोट रकमको डेटा छैन (नम्बर मात्र छ)',
  si: 'මෙම දිනුම් ඇදීම සඳහා ජැක්පොට් මුදල් දත්ත නොමැත (අංක පමණි)',
  tl: 'Walang data ng halaga ng jackpot para sa draw na ito (mga numero lang)',
  ur: 'اس ڈرا کے لیے جیک پاٹ رقم کا ڈیٹا نہیں ہے (صرف نمبرز ہیں)',
  uz: "bu tortish uchun jekpot summasi ma'lumoti yo'q (faqat raqamlar bor)",
};

// ============================================================================
// 🎯 내 번호 vs 역대급 당첨번호 비교 위젯 — "확률 감이 안 온다"는 위 패널들과 이어지는 재미 요소.
// 세금 계산기 본질과 무관한 순수 novelty라, 실제 당첨 확인이 아니라는 걸 문구 곳곳에 명시함.
// 이 섹션의 모든 문구는 JS에서 pickLang()으로 렌더링(신규 인터랙션 콘텐츠는 i18n/<lang>.json이
// 아니라 여기서 17개 언어 more 객체까지 직접 갖는 게 이번 세션 관례 — JACKPOT_HISTORY의
// noteMore, GAME_NAME_MORE 등과 동일한 패턴).
// ============================================================================

// 순서 인자(n번째 일반번호)가 들어가는 aria-label의 17개 언어 버전 — 매번 다시 만들지 않고
// n만 바꿔 끼우면 되게 함수로 둠 (buildSameCountMore 등과 같은 패턴)
function buildMainNumAriaMore(n){
  return {
    ar: `الرقم الرئيسي ${n}`, bn: `প্রধান সংখ্যা ${n}`, fr: `Numéro principal ${n}`, hi: `मुख्य नंबर ${n}`,
    id: `Angka utama ${n}`, ja: `メイン数字${n}`, kk: `Негізгі сан ${n}`, km: `លេខចម្បង ${n}`,
    ky: `Негизги сан ${n}`, lo: `ເລກຫຼັກ ${n}`, mn: `Үндсэн тоо ${n}`, my: `အဓိကဂဏန်း ${n}`,
    ne: `मुख्य नम्बर ${n}`, si: `ප්‍රධාන අංකය ${n}`, tl: `Pangunahing numero ${n}`, ur: `مرکزی نمبر ${n}`,
    uz: `Asosiy raqam ${n}`,
  };
}
const MN_SPECIAL_ARIA_MORE = {
  ar: 'رقم Powerball', bn: 'Powerball সংখ্যা', fr: 'Numéro Powerball', hi: 'Powerball नंबर',
  id: 'Angka Powerball', ja: 'パワーボール番号', kk: 'Powerball саны', km: 'លេខ Powerball',
  ky: 'Powerball саны', lo: 'ເລກ Powerball', mn: 'Powerball дугаар', my: 'Powerball ဂဏန်း',
  ne: 'Powerball नम्बर', si: 'Powerball අංකය', tl: 'Numero ng Powerball', ur: 'Powerball نمبر',
  uz: 'Powerball raqami',
};

const MN_TITLE_MORE = {
  ar: '🎯 هل نقارن أرقامك بأرقام الجاكبوت الأسطورية؟', bn: '🎯 আপনার নম্বর কিংবদন্তি জ্যাকপটের সাথে মিলিয়ে দেখব?',
  fr: '🎯 On compare vos numéros aux jackpots légendaires ?', hi: '🎯 अपने नंबरों की तुलना ऐतिहासिक जैकपॉट से करें?',
  id: '🎯 Bandingkan nomor Anda dengan jackpot legendaris?', ja: '🎯 あなたの番号を伝説のジャックポットと比べてみる？',
  kk: '🎯 Сандарыңызды аңызға айналған джекпоттармен салыстырайық па?', km: '🎯 តើប្រៀបធៀបលេខរបស់អ្នកជាមួយជេកផតដ៏ល្បីល្បាញទេ?',
  ky: '🎯 Сандарыңызды атактуу джекпоттор менен салыштырып көрөлүбү?', lo: '🎯 ລອງທຽບເລກຂອງທ່ານກັບແຈັກພອດໃນຕຳນານບໍ?',
  mn: '🎯 Тоогоо түүхэн жекпотуудтай харьцуулж үзэх үү?', my: '🎯 သင့်ဂဏန်းများကို ဒဏ္ဍာရီဆန်တဲ့ ဂျက်ပေါ့တွေနဲ့ နှိုင်းယှဉ်ကြည့်မလား?',
  ne: '🎯 तपाईंको नम्बर ऐतिहासिक ज्याकपोटसँग तुलना गरौं?', si: '🎯 ඔබේ අංක සුප්‍රසිද්ධ ජැක්පොට් සමඟ සසඳමුද?',
  tl: '🎯 Ikumpara ang mga numero mo sa mga alamat na jackpot?', ur: '🎯 اپنے نمبروں کا افسانوی جیک پاٹس سے موازنہ کریں؟',
  uz: "🎯 Raqamlaringizni afsonaviy jekpotlar bilan solishtiramizmi?",
};
const MN_DESC_MORE = {
  ar: 'أدخل أرقام Powerball التي تلعبها عادةً، وسنُظهر لك — للمتعة فقط — كم منها كان سيتطابق مع هذه السحوبات الأسطورية. هذا ليس فحصًا حقيقيًا للفوز، بل مجرد مقارنة افتراضية!',
  bn: 'আপনি সাধারণত যে Powerball নম্বরগুলো খেলেন সেগুলো দিন, আমরা শুধু মজার জন্য দেখাব এগুলোর কতগুলো এই কিংবদন্তি জ্যাকপটের সাথে মিলত। এটা আসল পুরস্কার যাচাই নয়, নিছক "যদি হতো" তুলনা!',
  fr: 'Saisissez les numéros Powerball que vous jouez habituellement, et nous vous montrerons — juste pour le plaisir — combien auraient correspondu à ces tirages légendaires. Ce n\'est pas une vraie vérification de gain, juste une comparaison hypothétique !',
  hi: 'आप जो Powerball नंबर आमतौर पर खेलते हैं वो डालें, हम बस मज़े के लिए दिखाएंगे कि इनमें से कितने इन ऐतिहासिक जैकपॉट ड्रॉ से मेल खाते। यह असली इनाम जांच नहीं, बस "अगर होता तो" वाली तुलना है!',
  id: 'Masukkan nomor Powerball yang biasa Anda mainkan, dan kami akan tunjukkan — sekadar untuk seru-seruan — berapa banyak yang cocok dengan undian jackpot legendaris ini. Ini bukan pengecekan hadiah sungguhan, cuma perbandingan "andai saja"!',
  ja: 'いつも使うパワーボールの番号を入力すると、これらの伝説的なジャックポット抽選と何個一致したか、遊びとしてお見せします。これは実際の当選確認ではなく、単なる「もし」比較です！',
  kk: 'Әдетте ойнайтын Powerball сандарыңызды енгізіңіз, біз тек көңіл көтеру үшін осы аңызға айналған джекпот тартылымдарымен қаншасы сәйкес келетінін көрсетеміз. Бұл нақты ұтыс тексерісі емес, жай ғана "егер" салыстыруы!',
  km: 'បញ្ចូលលេខ Powerball ដែលអ្នកលេងជាធម្មតា ហើយយើងនឹងបង្ហាញអ្នក — សម្រាប់ភាពសប្បាយប៉ុណ្ណោះ — ថាតើប៉ុន្មានលេខត្រូវគ្នាជាមួយការទាញឆ្នោតជេកផតដ៏ល្បីល្បាញទាំងនេះ។ នេះមិនមែនជាការត្រួតពិនិត្យរង្វាន់ពិតប្រាកដទេ គ្រាន់តែជាការប្រៀបធៀបតាមសម្មតិកម្មប៉ុណ្ណោះ!',
  ky: 'Адатта ойногон Powerball сандарыңызды киргизиңиз, биз жөн гана көңүл ачуу үчүн ушул атактуу джекпот тартылыштары менен канчасы дал келерин көрсөтөбүз. Бул чыныгы утуш текшерүү эмес, жөн гана "эгер" салыштыруусу!',
  lo: 'ໃສ່ເລກ Powerball ທີ່ທ່ານມັກຫຼີ້ນ ແລ້ວພວກເຮົາຈະສະແດງໃຫ້ເຫັນ — ພຽງແຕ່ເພື່ອຄວາມມ່ວນ — ວ່າມີຈັກເລກທີ່ກົງກັບການອອກແຈັກພອດໃນຕຳນານເຫຼົ່ານີ້. ນີ້ບໍ່ແມ່ນການກວດສອບລາງວັນຈິງ, ພຽງແຕ່ການປຽບທຽບແບບ "ຖ້າສົມມຸດວ່າ" ເທົ່ານັ້ນ!',
  mn: 'Ердийн тоглодог Powerball тоогоо оруулаарай, бид зөвхөн зугаа цэнгэлийн үүднээс эдгээр түүхэн жекпотын сугалаатай хэд нь таарахыг харуулна. Энэ бол бодит шагнал шалгах явдал биш, зүгээр л "хэрэв" гэсэн харьцуулалт!',
  my: 'သင်ပုံမှန်ကစားလေ့ရှိတဲ့ Powerball ဂဏန်းများကို ထည့်လိုက်ရင်၊ ဒီဒဏ္ဍာရီဆန်တဲ့ ဂျက်ပေါ့ထွက်ဂဏန်းတွေနဲ့ ဘယ်နှလုံးကိုက်ညီမလဲဆိုတာကို ပျော်စရာအတွက်ပဲ ပြသပေးပါမယ်။ ဒါက တကယ့်ဆုစစ်ဆေးမှုမဟုတ်ပါဘူး၊ "ဆိုပါစို့" နှိုင်းယှဉ်မှုတစ်ခုပဲ ဖြစ်ပါတယ်!',
  ne: 'तपाईंले सामान्यतया खेल्ने Powerball नम्बरहरू हाल्नुहोस्, हामी रमाइलोका लागि मात्र देखाउनेछौं यी ऐतिहासिक ज्याकपोट ड्रका साथ कतिवटा मिल्थ्यो। यो वास्तविक पुरस्कार जाँच होइन, केवल "यदि भइदिएको भए" भन्ने तुलना हो!',
  si: 'ඔබ සාමාන්‍යයෙන් සෙල්ලම් කරන Powerball අංක ඇතුළත් කරන්න, අපි විනෝදයට පමණක් මෙම සුප්‍රසිද්ධ ජැක්පොට් දිනුම් ඇදීම් සමඟ කීයක් ගැලපෙනවාද යන්න පෙන්වන්නෙමු. මෙය සැබෑ ත්‍යාග පරීක්ෂාවක් නොව, හුදෙක් "එසේ නම්" සැසඳීමකි!',
  tl: 'Ilagay ang mga Powerball number na karaniwan mong pinepermahan, at ipapakita namin — para lang sa saya — kung ilan ang tumugma sa mga alamat na jackpot draw na ito. Hindi ito totoong pagsusuri ng panalo, isang "paano kaya" na paghahambing lang ito!',
  ur: 'وہ Powerball نمبر درج کریں جو آپ عام طور پر کھیلتے ہیں، اور ہم صرف تفریح کے لیے دکھائیں گے کہ ان میں سے کتنے ان افسانوی جیک پاٹ ڈرا سے میچ ہوتے۔ یہ اصل جیت کی جانچ نہیں، محض ایک "اگر ایسا ہوتا" موازنہ ہے!',
  uz: "Odatda o'ynaydigan Powerball raqamlaringizni kiriting, biz shunchaki qiziqarli tarzda bu afsonaviy jekpot chekilishlariga nechtasi mos kelishini ko'rsatamiz. Bu haqiqiy yutuqni tekshirish emas, shunchaki \"agar bo'lganida\" taqqoslashi!",
};
const MN_MAIN_LABEL_MORE = {
  ar: 'رقم أرقام رئيسية (1–69)', bn: '৫টি প্রধান সংখ্যা (১–৬৯)', fr: '5 numéros principaux (1–69)', hi: '5 मुख्य नंबर (1–69)',
  id: '5 angka utama (1–69)', ja: 'メイン数字5個（1〜69）', kk: '5 негізгі сан (1–69)', km: 'លេខចម្បង ៥ (1–69)',
  ky: '5 негизги сан (1–69)', lo: 'ເລກຫຼັກ 5 ຕົວ (1-69)', mn: '5 үндсэн тоо (1–69)', my: 'အဓိကဂဏန်း ၅ လုံး (၁ မှ ၆၉)',
  ne: '५ मुख्य नम्बर (१–६९)', si: 'ප්‍රධාන අංක 5ක් (1–69)', tl: '5 pangunahing numero (1–69)', ur: '5 مرکزی نمبر (1–69)',
  uz: "5 ta asosiy raqam (1–69)",
};
const MN_SPECIAL_LABEL_MORE = {
  ar: 'رقم Powerball (1–26)', bn: 'Powerball সংখ্যা (১–২৬)', fr: 'Numéro Powerball (1–26)', hi: 'Powerball नंबर (1–26)',
  id: 'Angka Powerball (1–26)', ja: 'パワーボール番号（1〜26）', kk: 'Powerball саны (1–26)', km: 'លេខ Powerball (1–26)',
  ky: 'Powerball саны (1–26)', lo: 'ເລກ Powerball (1-26)', mn: 'Powerball дугаар (1–26)', my: 'Powerball ဂဏန်း (၁ မှ ၂၆)',
  ne: 'Powerball नम्बर (१–२६)', si: 'Powerball අංකය (1–26)', tl: 'Numero ng Powerball (1–26)', ur: 'Powerball نمبر (1–26)',
  uz: "Powerball raqami (1–26)",
};
const MN_BTN_MORE = {
  ar: 'تحقق', bn: 'যাচাই করুন', fr: 'Vérifier', hi: 'जांचें', id: 'Cek sekarang', ja: '確認する', kk: 'Тексеру',
  km: 'ពិនិត្យមើល', ky: 'Текшерүү', lo: 'ກວດສອບ', mn: 'Шалгах', my: 'စစ်ဆေးမည်', ne: 'जाँच गर्नुहोस्', si: 'පරීක්ෂා කරන්න',
  tl: 'Suriin', ur: 'چیک کریں', uz: "Tekshirish",
};
const MN_DISCLAIMER_MORE = {
  ar: 'مجرد مقارنة افتراضية للمتعة — ليست فحصًا حقيقيًا للفوز، ولا تشجيعًا على شراء تذاكر اليانصيب 🙂',
  bn: 'নিছক মজার কাল্পনিক তুলনা — আসল পুরস্কার যাচাই নয়, লটারি টিকিট কেনার পরামর্শও নয় 🙂',
  fr: 'Juste une comparaison hypothétique pour le plaisir — pas une vraie vérification de gain, et ce n\'est pas une incitation à acheter des billets de loterie 🙂',
  hi: 'बस मज़े के लिए काल्पनिक तुलना है — असली इनाम जांच नहीं, और लॉटरी टिकट खरीदने की सलाह भी नहीं 🙂',
  id: 'Cuma perbandingan hipotetis untuk seru-seruan — bukan pengecekan hadiah sungguhan, dan bukan ajakan membeli tiket lotre 🙂',
  ja: '楽しみのための仮の比較です — 実際の当選確認ではなく、宝くじの購入を勧めるものでもありません 🙂',
  kk: 'Бұл тек көңіл көтеру үшін болжамды салыстыру — нақты ұтыс тексерісі емес және лотерея билетін сатып алуға шақыру да емес 🙂',
  km: 'គ្រាន់តែជាការប្រៀបធៀបតាមសម្មតិកម្មសម្រាប់ភាពសប្បាយប៉ុណ្ណោះ — មិនមែនជាការត្រួតពិនិត្យរង្វាន់ពិតប្រាកដ ហើយក៏មិនមែនជាការលើកទឹកចិត្តឱ្យទិញឆ្នោតដែរ 🙂',
  ky: 'Бул жөн гана көңүл ачуу үчүн болжолдуу салыштыруу — чыныгы утуш текшерүү эмес жана лотерея билетин сатып алууга чакырык дагы эмес 🙂',
  lo: 'ພຽງແຕ່ການປຽບທຽບສົມມຸດຕິຖານເພື່ອຄວາມມ່ວນເທົ່ານັ້ນ — ບໍ່ແມ່ນການກວດສອບລາງວັນຈິງ ແລະບໍ່ແມ່ນການຊັກຊວນໃຫ້ຊື້ຫວຍ 🙂',
  mn: 'Энэ бол зөвхөн зугаа цэнгэлийн таамаглалын харьцуулалт — бодит шагнал шалгах явдал биш, мөн сугалааны тасалбар худалдаж авахыг уриалах явдал ч биш 🙂',
  my: 'ဒါက ပျော်စရာအတွက်ပဲ စိတ်ကူးယဉ် နှိုင်းယှဉ်မှုတစ်ခုပါ — တကယ့်ဆုစစ်ဆေးမှုမဟုတ်ပါဘူး၊ ထီဝယ်ဖို့ တိုက်တွန်းမှုလည်း မဟုတ်ပါဘူး 🙂',
  ne: 'यो रमाइलोका लागि मात्र काल्पनिक तुलना हो — वास्तविक पुरस्कार जाँच होइन, र लटरी टिकट किन्न सिफारिस पनि होइन 🙂',
  si: 'මෙය විනෝදය සඳහා පමණක් උපකල්පිත සැසඳීමකි — සැබෑ ත්‍යාග පරීක්ෂාවක් නොව, ලොතරැයි ටිකට් මිලදී ගැනීමට දිරිගැන්වීමක් ද නොවේ 🙂',
  tl: 'Isang haka-haka lang na paghahambing para sa saya — hindi totoong pagsusuri ng panalo, at hindi rin ito paghikayat na bumili ng lottery ticket 🙂',
  ur: 'یہ محض تفریح کے لیے ایک فرضی موازنہ ہے — اصل جیت کی جانچ نہیں، اور نہ ہی لاٹری ٹکٹ خریدنے کی ترغیب ہے 🙂',
  uz: "Bu shunchaki qiziqarli faraziy taqqoslash — haqiqiy yutuqni tekshirish emas va lotereya chiptasini sotib olishga chaqiriq ham emas 🙂",
};
const MN_ERROR_MORE = {
  ar: 'يرجى إدخال 5 أرقام رئيسية مختلفة (1–69) ورقم Powerball (1–26)', bn: 'দয়া করে ৫টি ভিন্ন প্রধান সংখ্যা (১–৬৯) এবং Powerball সংখ্যা (১–২৬) দিন',
  fr: 'Veuillez saisir 5 numéros principaux différents (1–69) et le numéro Powerball (1–26)', hi: 'कृपया 5 अलग-अलग मुख्य नंबर (1–69) और Powerball नंबर (1–26) डालें',
  id: 'Mohon masukkan 5 angka utama yang berbeda (1–69) dan angka Powerball (1–26)', ja: '異なる5個のメイン数字（1〜69）とパワーボール番号（1〜26）をすべて入力してください',
  kk: '5 түрлі негізгі санды (1–69) және Powerball санын (1–26) толығымен енгізіңіз', km: 'សូមបញ្ចូលលេខចម្បងខុសគ្នា ៥ (1–69) និងលេខ Powerball (1–26)',
  ky: '5 ар түрдүү негизги санды (1–69) жана Powerball санын (1–26) толугу менен киргизиңиз', lo: 'ກະລຸນາໃສ່ເລກຫຼັກທີ່ແຕກຕ່າງກັນ 5 ຕົວ (1-69) ແລະເລກ Powerball (1-26) ໃຫ້ຄົບ',
  mn: '5 өөр үндсэн тоог (1–69) болон Powerball дугаарыг (1–26) бүрэн оруулна уу', my: 'ကွဲပြားတဲ့ အဓိကဂဏန်း ၅ လုံး (၁ မှ ၆၉) နဲ့ Powerball ဂဏန်း (၁ မှ ၂၆) ကို အပြည့်ထည့်ပါ',
  ne: 'कृपया ५ फरक-फरक मुख्य नम्बर (१–६९) र Powerball नम्बर (१–२६) पूरा भर्नुहोस्', si: 'කරුණාකර වෙනස් ප්‍රධාන අංක 5ක් (1–69) සහ Powerball අංකය (1–26) සම්පූර්ණයෙන් ඇතුළත් කරන්න',
  tl: 'Pakilagay ang 5 magkakaibang pangunahing numero (1–69) at ang Powerball number (1–26) nang buo', ur: 'براہ کرم 5 مختلف مرکزی نمبر (1–69) اور Powerball نمبر (1–26) مکمل درج کریں',
  uz: "Iltimos, 5 ta har xil asosiy raqam (1–69) va Powerball raqamini (1–26) to'liq kiriting",
};
const MN_DUPLICATE_ERROR_MORE = {
  ar: 'توجد أرقام مكررة في الأرقام الرئيسية التي أدخلتها — يرجى إدخال 5 أرقام مختلفة', bn: 'আপনার দেওয়া প্রধান সংখ্যাগুলোর মধ্যে একটি সংখ্যা পুনরাবৃত্তি হয়েছে — দয়া করে ৫টি ভিন্ন সংখ্যা দিন',
  fr: 'Certains de vos numéros principaux sont répétés — veuillez saisir 5 numéros différents', hi: 'आपके डाले गए मुख्य नंबरों में से कुछ दोहराए गए हैं — कृपया 5 अलग-अलग नंबर डालें',
  id: 'Beberapa angka utama yang kamu masukkan berulang — mohon masukkan 5 angka yang berbeda', ja: '入力したメイン数字の中に重複があります — 異なる5個の数字を入力してください',
  kk: 'Сіз енгізген негізгі сандардың арасында қайталанатын сан бар — 5 түрлі санды енгізіңіз', km: 'មានលេខស្ទួននៅក្នុងលេខចម្បងដែលអ្នកបានបញ្ចូល — សូមបញ្ចូលលេខខុសគ្នា ៥',
  ky: 'Сиз киргизген негизги сандардын арасында кайталанган сан бар — 5 ар түрдүү санды киргизиңиз', lo: 'ມີເລກຊ້ຳກັນຢູ່ໃນເລກຫຼັກທີ່ທ່ານປ້ອນ — ກະລຸນາໃສ່ເລກທີ່ແຕກຕ່າງກັນ 5 ຕົວ',
  mn: 'Таны оруулсан үндсэн тоонуудын дунд давхардсан тоо байна — 5 өөр тоо оруулна уу', my: 'သင်ထည့်ထားတဲ့ အဓိကဂဏန်းတွေထဲမှာ ထပ်နေတဲ့ဂဏန်းရှိပါတယ် — ကွဲပြားတဲ့ဂဏန်း ၅ လုံး ထည့်ပါ',
  ne: 'तपाईंले भर्नुभएको मुख्य नम्बरहरूमध्ये केही दोहोरिएका छन् — कृपया ५ फरक-फरक नम्बर भर्नुहोस्', si: 'ඔබ ඇතුළත් කළ ප්‍රධාන අංකවල පුනරාවර්තන අංකයක් ඇත — කරුණාකර වෙනස් අංක 5ක් ඇතුළත් කරන්න',
  tl: 'May paulit-ulit na numero sa mga pangunahing numerong inilagay mo — pakilagay ang 5 magkakaibang numero', ur: 'آپ کے درج کردہ مرکزی نمبروں میں سے کچھ دہرائے گئے ہیں — براہ کرم 5 مختلف نمبر درج کریں',
  uz: "Siz kiritgan asosiy raqamlar orasida takrorlanadigan raqam bor — iltimos, 5 ta har xil raqam kiriting",
};
const MN_LEGENDARY_TAG_MORE = {
  ar: '🏆 جاكبوت أسطوري', bn: '🏆 কিংবদন্তি জ্যাকপট', fr: '🏆 Jackpot légendaire', hi: '🏆 ऐतिहासिक जैकपॉट',
  id: '🏆 Jackpot legendaris', ja: '🏆 伝説のジャックポット', kk: '🏆 Аңызға айналған джекпот', km: '🏆 ជេកផតដ៏ល្បីល្បាញ',
  ky: '🏆 Атактуу джекпот', lo: '🏆 ແຈັກພອດໃນຕຳນານ', mn: '🏆 Домогт жекпот', my: '🏆 ဒဏ္ဍာရီဆန်သော ဂျက်ပေါ့',
  ne: '🏆 ऐतिहासिक ज्याकपोट', si: '🏆 සුප්‍රසිද්ධ ජැක්පොට්', tl: '🏆 Alamat na jackpot', ur: '🏆 افسانوی جیک پاٹ',
  uz: "🏆 Afsonaviy jekpot",
};
const MN_LATEST_TAG_MORE = {
  ar: '🎱 سحب حقيقي', bn: '🎱 প্রকৃত ড্র', fr: '🎱 Tirage réel', hi: '🎱 वास्तविक ड्रॉ', id: '🎱 Undian asli',
  ja: '🎱 実際の抽選', kk: '🎱 Нақты тарту', km: '🎱 ការទាញឆ្នោតពិត', ky: '🎱 Реалдуу тартылыш', lo: '🎱 ການອອກຕົວຈິງ',
  mn: '🎱 Бодит сугалаа', my: '🎱 အမှန်တကယ် ထီပေါက်စဉ်', ne: '🎱 वास्तविक ड्र', si: '🎱 සැබෑ දිනුම් ඇදීම', tl: '🎱 Aktwal na draw',
  ur: '🎱 حقیقی ڈرا', uz: "🎱 Haqiqiy tortish",
};

// 매치 개수+파워볼 일치 여부에 따른 6단계 격려 문구 — buildMatchMore()와 같은 자리(1950행 근처)의
// MATCH_LABEL_TEMPLATES_MORE 패턴과 별개로, 이건 "숫자 라벨"이 아니라 "감정 톤 한 줄"이라 새로
// 정의함. score = 일반번호 일치 개수 + (파워볼 일치 시 +1), 최대 6
const MN_TONE_TIERS = [
  // score 0~1: 무난하게, 놀리지 않는 톤
  ['다음 기회에 다시 도전해봐요 🍀', 'Next time might be the one — 🍀', '下次说不定就中了 🍀', 'Lần sau biết đâu trúng đấy 🍀', 'ครั้งหน้าอาจจะโดนก็ได้ 🍀', 'В следующий раз повезёт больше 🍀', {
    ar: 'ربما تكون المرة القادمة هي الفرصة 🍀', bn: 'পরের বার হয়তো ভাগ্য খুলবে 🍀', fr: 'La prochaine fois sera peut-être la bonne 🍀', hi: 'अगली बार शायद किस्मत खुले 🍀',
    id: 'Mungkin lain kali keberuntungan berpihak 🍀', ja: '次はいけるかも 🍀', kk: 'Келесі жолы сәттілік күтіп тұр шығар 🍀', km: 'លើកក្រោយប្រហែលជាសំណាងល្អ 🍀',
    ky: 'Кийинки жолу ийгилик күтүп жатат 🍀', lo: 'ຄັ້ງໜ້າອາດຈະໂຊກດີ 🍀', mn: 'Дараагийн удаа азтай байж магадгүй 🍀', my: 'နောက်တစ်ကြိမ်မှာ ကံကောင်းနိုင်ပါတယ် 🍀',
    ne: 'अर्को पटक भाग्य खुल्न सक्छ 🍀', si: 'ඊළඟ වතාවේ වාසනාව විවෘත වෙන්න පුළුවන් 🍀', tl: 'Baka sa susunod na pagkakataon na 🍀', ur: 'اگلی بار قسمت کھل سکتی ہے 🍀',
    uz: "Keyingi safar omad kulib boqishi mumkin 🍀",
  }],
  // score 2
  ['오, 나쁘지 않은데요? 😊', 'Oh, not bad at all! 😊', '哦，还不错嘛！😊', 'Ồ, không tệ đấy chứ! 😊', 'โอ้ ไม่เลวเลยนะ! 😊', 'О, совсем неплохо! 😊', {
    ar: 'أوه، ليس سيئًا على الإطلاق! 😊', bn: 'বাহ, মন্দ না তো! 😊', fr: 'Oh, pas mal du tout ! 😊', hi: 'अरे वाह, बुरा नहीं है! 😊',
    id: 'Wah, lumayan juga nih! 😊', ja: 'おっ、悪くないですね！😊', kk: 'Ой, жаман емес қой! 😊', km: 'អូ មិនអាក្រក់ទេ! 😊',
    ky: 'Ой, жаман эмес экен! 😊', lo: 'ໂອ້, ບໍ່ເລວເລີຍ! 😊', mn: 'Өө, муу биш байна! 😊', my: 'အိုး၊ မဆိုးလှပါဘူးနော်! 😊',
    ne: 'ओहो, नराम्रो त होइन! 😊', si: 'ඕහෝ, නරක නැහැනේ! 😊', tl: 'Oh, hindi naman masama! 😊', ur: 'واہ، برا نہیں ہے! 😊',
    uz: "Voy, yomon emas-ku! 😊",
  }],
  // score 3
  ['오, 꽤 가까웠는데요! 👀', 'Ooh, that was pretty close! 👀', '哦，还挺接近的呢！👀', 'Ồ, khá gần đấy! 👀', 'โอ้ ใกล้เคียงเลยนะ! 👀', 'О, это было довольно близко! 👀', {
    ar: 'أوه، كانت قريبة جدًا! 👀', bn: 'বাহ, বেশ কাছাকাছি ছিল! 👀', fr: 'Oh, c’était plutôt proche ! 👀', hi: 'अरे, काफी करीब थे! 👀',
    id: 'Wah, itu cukup dekat! 👀', ja: 'おっ、かなり近かったですね！👀', kk: 'Ой, бұл өте жақын болды! 👀', km: 'អូ នេះជិតណាស់! 👀',
    ky: 'Ой, бул абдан жакын болду! 👀', lo: 'ໂອ້, ໃກ້ຫຼາຍເລີຍ! 👀', mn: 'Өө, нэлээд ойрхон байлаа! 👀', my: 'အိုး၊ တော်တော်နီးလိုက်တာနော်! 👀',
    ne: 'ओहो, निकै नजिक थियो! 👀', si: 'ඕහෝ, හරිම ළඟයි! 👀', tl: 'Oh, medyo malapit na iyon! 👀', ur: 'واہ، کافی قریب تھا! 👀',
    uz: "Voy, juda yaqin bo'ldi! 👀",
  }],
  // score 4 — "아깝게 놓쳤네요" (기획 문구 예시)
  ['우와, 아깝게 놓쳤네요! 😲', 'Whoa, so close — you just missed it! 😲', '哇，差一点点就中了！😲', 'Ối, suýt nữa là trúng rồi! 😲', 'ว้าว เฉียดไปนิดเดียวเอง! 😲', 'Ого, чуть-чуть не хватило! 😲', {
    ar: 'واو، لقد فاتتك بفارق ضئيل! 😲', bn: 'ওহো, একটুর জন্য মিস হয়ে গেল! 😲', fr: 'Waouh, c’est passé si près ! 😲', hi: 'वाह, बस थोड़े से चूक गए! 😲',
    id: 'Wow, hampir saja meleset! 😲', ja: 'わあ、惜しくも逃しましたね！😲', kk: 'Уаһ, аз-ақ жетпей қалды! 😲', km: 'អូ ស្ទើរតែបានហើយ! 😲',
    ky: 'Ва, аз калды! 😲', lo: 'ໂອ້ຍ, ພາດແບບໜ້າເສຍດາຍເລີຍ! 😲', mn: 'Вау, бага зэрэг дутуу байлаа! 😲', my: 'ဝိုး၊ အနည်းငယ်လွဲသွားတာနော်! 😲',
    ne: 'ओहो, थोरैमा छुट्यो! 😲', si: 'අනේ, ටිකකින් මගහැරුනා! 😲', tl: 'Wow, sobrang lapit na — konti na lang! 😲', ur: 'واہ، تھوڑے سے رہ گیا! 😲',
    uz: "Voy, sal-pal yetishmadi! 😲",
  }],
  // score 5
  ['대박, 거의 다 맞았어요! (그래도 이건 가상 비교예요) 😄', 'Wow, you nearly matched almost everything! (still just a hypothetical comparison) 😄', '哇塞，几乎全中了！（不过这只是假设性比较哦）😄', 'Tuyệt vời, gần như trúng hết rồi! (nhưng đây chỉ là so sánh giả định thôi nhé) 😄', 'สุดยอด เกือบจะถูกหมดแล้ว! (แต่นี่เป็นแค่การเปรียบเทียบสมมติเท่านั้นนะ) 😄', 'Ого, вы почти всё угадали! (но это лишь гипотетическое сравнение) 😄', {
    ar: 'رائع، لقد طابقت كل شيء تقريبًا! (لكن هذه مجرد مقارنة افتراضية) 😄', bn: 'দারুণ, প্রায় সবই মিলে গেছে! (তবে এটা নিছক কাল্পনিক তুলনা) 😄', fr: 'Incroyable, vous avez presque tout trouvé ! (mais ce n’est qu’une comparaison hypothétique) 😄', hi: 'शानदार, लगभग सब कुछ मैच हो गया! (लेकिन यह सिर्फ काल्पनिक तुलना है) 😄',
    id: 'Wah, hampir semuanya cocok! (tapi ini cuma perbandingan hipotetis) 😄', ja: 'すごい、ほぼ全部一致しました！（でもこれはあくまで仮の比較です）😄', kk: 'Тамаша, барлығы дерлік сәйкес келді! (бірақ бұл тек болжамды салыстыру) 😄', km: 'អស្ចារ្យ ស្ទើរតែត្រូវទាំងអស់! (ប៉ុន្តែនេះគ្រាន់តែជាការប្រៀបធៀបសម្មតិកម្មប៉ុណ្ណោះ) 😄',
    ky: 'Укмуш, дээрлик баары дал келди! (бирок бул жөн гана болжолдуу салыштыруу) 😄', lo: 'ສຸດຍອດ, ຖືກເກືອບໝົດເລີຍ! (ແຕ່ນີ້ພຽງແຕ່ການປຽບທຽບສົມມຸດຕິຖານເທົ່ານັ້ນ) 😄', mn: 'Гайхалтай, бараг бүгд таарлаа! (гэхдээ энэ бол зөвхөн таамаглалын харьцуулалт) 😄', my: 'အံ့သြစရာပဲ၊ အားလုံးနီးပါး ကိုက်ညီသွားတယ်! (ဒါပေမဲ့ ဒါက စိတ်ကူးယဉ် နှိုင်းယှဉ်မှုပဲ) 😄',
    ne: 'कमाल, लगभग सबै मिल्यो! (तर यो त काल्पनिक तुलना मात्र हो) 😄', si: 'දැවැන්තයි, පාහේ සියල්ලම ගැලපුණා! (නමුත් මෙය හුදෙක් උපකල්පිත සැසඳීමක් පමණයි) 😄', tl: 'Wow, halos lahat ay tumugma! (pero ito ay isang haka-haka lang na paghahambing) 😄', ur: 'زبردست، تقریباً سب کچھ میچ ہو گیا! (لیکن یہ محض ایک فرضی موازنہ ہے) 😄',
    uz: "Ajoyib, deyarli hammasi mos keldi! (lekin bu shunchaki faraziy taqqoslash) 😄",
  }],
  // score 6 (5개 + 파워볼 전부 일치) — "축하?!" (기획 문구 예시), 실제 당첨 아님을 재차 명시
  ['축하?! 실제였다면 잭팟이었겠지만, 이건 그냥 재미로 해본 가상 비교예요 🎉😄', 'Congrats?! If this were real, that’d be the jackpot — but this is just a fun hypothetical comparison 🎉😄', '恭喜？！如果是真的那就是头奖了，不过这只是好玩的假设性比较而已 🎉😄', 'Chúc mừng?! Nếu là thật thì đã trúng jackpot rồi, nhưng đây chỉ là so sánh giả định cho vui thôi 🎉😄', 'ยินดีด้วยไหมนะ?! ถ้าเป็นเรื่องจริงนี่คือแจ็คพอตเลย แต่นี่เป็นแค่การเปรียบเทียบสมมติเพื่อความสนุกเท่านั้น 🎉😄', 'Поздравляем?! Будь это по-настоящему, это был бы джекпот — но это просто гипотетическое сравнение для развлечения 🎉😄', {
    ar: 'مبروك؟! لو كان هذا حقيقيًا لكانت الجائزة الكبرى، لكنها مجرد مقارنة افتراضية للمتعة 🎉😄', bn: 'অভিনন্দন?! সত্যি হলে এটাই জ্যাকপট হতো, তবে এটা নিছক মজার কাল্পনিক তুলনা 🎉😄', fr: 'Félicitations ?! Si c’était réel, ce serait le jackpot — mais ce n’est qu’une comparaison fictive pour le plaisir 🎉😄', hi: 'बधाई हो?! अगर यह असली होता तो यही जैकपॉट होता, पर यह सिर्फ मज़े के लिए काल्पनिक तुलना है 🎉😄',
    id: 'Selamat?! Kalau ini nyata, ini jackpot-nya — tapi ini cuma perbandingan hipotetis untuk seru-seruan 🎉😄', ja: 'おめでとう？！もし本当ならジャックポットでしたが、これは楽しみのための仮の比較です 🎉😄', kk: 'Құттықтаймыз ба?! Егер бұл шын болса, джекпот болар еді — бірақ бұл тек көңіл көтеру үшін болжамды салыстыру 🎉😄', km: 'អបអរសាទរ?! ប្រសិនបើវាពិត នេះនឹងជាជេកផត ប៉ុន្តែនេះគ្រាន់តែជាការប្រៀបធៀបសម្មតិកម្មសម្រាប់ភាពសប្បាយប៉ុណ្ណោះ 🎉😄',
    ky: 'Куттуктайбызбы?! Эгер бул чын болсо, бул джекпот болмок — бирок бул жөн гана көңүл ачуу үчүн болжолдуу салыштыруу 🎉😄', lo: 'ຂໍສະແດງຄວາມຍິນດີບໍ?! ຖ້າເປັນເລື່ອງຈິງນີ້ຄືແຈັກພອດເລີຍ — ແຕ່ນີ້ພຽງແຕ່ການປຽບທຽບສົມມຸດຕິຖານເພື່ອຄວາມມ່ວນເທົ່ານັ້ນ 🎉😄', mn: 'Баяр хүргэе үү?! Хэрэв бодит байсан бол энэ жекпот байх байсан — гэхдээ энэ бол зөвхөн зугаа цэнгэлийн таамаглалын харьцуулалт 🎉😄', my: 'ဂုဏ်ယူပါတယ်ရယ်လား?! ဒါအမှန်ဆိုရင် ဂျက်ပေါ့ပဲ ဖြစ်ခဲ့မှာပါ — ဒါပေမဲ့ ဒါက ပျော်စရာအတွက် စိတ်ကူးယဉ် နှိုင်းယှဉ်မှုပဲ 🎉😄',
    ne: 'बधाई छ?! यदि यो साँचो भएको भए यो त ज्याकपोट नै हुन्थ्यो — तर यो त रमाइलोका लागि मात्र काल्पनिक तुलना हो 🎉😄', si: 'සුබ පැතුම්ද?! මෙය සැබෑ නම් මෙය ජැක්පොට් වන්නට තිබුණි — නමුත් මෙය විනෝදය සඳහා පමණක් උපකල්පිත සැසඳීමකි 🎉😄', tl: 'Congrats kaya?! Kung totoo ito, iyan na sana ang jackpot — pero ito ay isang haka-haka lang na paghahambing para sa saya 🎉😄', ur: 'مبارک ہو؟! اگر یہ حقیقی ہوتا تو یہی جیک پاٹ ہوتا — لیکن یہ محض تفریح کے لیے ایک فرضی موازنہ ہے 🎉😄',
    uz: "Tabriklaymizmi?! Agar bu haqiqiy bo'lsa, bu jekpot bo'lardi — lekin bu shunchaki qiziqarli faraziy taqqoslash 🎉😄",
  }],
];

// score(0~6) -> 톤 문구. 배열 인덱스는 그대로 score(0,1은 같은 문구 공유하려고 인덱스 보정)
function mnToneLine(score){
  const idx = score <= 1 ? 0 : score - 1; // 0,1 -> 0번째 문구, 2->1번째, ... 6->5번째
  return pickLang(...MN_TONE_TIERS[idx]);
}

// 언어 전환 시에도 다시 불러 정적 문구를 새로 그림 (updateLightningGameUi()와 같은 자리에서 호출)
function updateMyNumbersUi(){
  const titleEl = document.getElementById('mn-section-title');
  const descEl = document.getElementById('mn-section-desc');
  const mainLabelEl = document.getElementById('mn-main-label');
  const specialLabelEl = document.getElementById('mn-special-label');
  const btnEl = document.getElementById('mn-check-btn');
  const disclaimerEl = document.getElementById('mn-disclaimer');
  if (!titleEl || !descEl || !mainLabelEl || !specialLabelEl || !btnEl || !disclaimerEl) return;
  titleEl.textContent = pickLang('🎯 내 번호, 역대급 잭팟 당첨번호와 비교해볼까요?', '🎯 Compare your numbers to legendary jackpot draws', '🎯 把你的号码和历代传奇头奖对比一下？', '🎯 So sánh số của bạn với các kỳ jackpot huyền thoại', '🎯 ลองเทียบเลขของคุณกับแจ็คพอตในตำนานไหม', '🎯 Сравните свои числа с легендарными джекпотами', MN_TITLE_MORE);
  descEl.textContent = pickLang(
    '평소 즐겨 쓰는 파워볼 번호를 넣으면, 역대 초대형 잭팟 당첨번호와 몇 개나 맞는지 재미로 보여드려요. 실제 당첨 확인이 아니라 순전히 "만약에" 비교예요!',
    "Enter the Powerball numbers you usually play, and we'll show — just for fun — how many would've matched these legendary jackpot draws. This isn't a real prize check, just a 'what if' comparison!",
    '输入你平常爱用的强力球号码，我们就会好玩地告诉你，这些号码和历代超级大奖号码能对上几个。这不是真的对奖，只是好玩的"假如"比较！',
    "Nhập những số Powerball bạn thường chơi, chúng tôi sẽ cho bạn xem — chỉ để vui thôi — có bao nhiêu số trùng với các kỳ jackpot huyền thoại. Đây không phải kiểm tra trúng thưởng thật, chỉ là so sánh 'giả sử' thôi!",
    "ใส่เลขพาวเวอร์บอลที่คุณเล่นประจำ แล้วเราจะโชว์ให้ดูเล่นๆ ว่าตรงกับเลขแจ็คพอตในตำนานกี่ตัว นี่ไม่ใช่การตรวจรางวัลจริง แค่การเปรียบเทียบแบบ 'ถ้าสมมติว่า' เท่านั้น!",
    "Введите числа Powerball, которые вы обычно играете, и мы просто ради развлечения покажем, сколько из них совпало бы с легендарными джекпотами. Это не настоящая проверка выигрыша, а просто сравнение 'а что если'!",
    MN_DESC_MORE
  );
  mainLabelEl.textContent = pickLang('일반번호 5개 (1~69)', '5 main numbers (1–69)', '5个普通号码（1~69）', '5 số chính (1–69)', 'เลขหลัก 5 ตัว (1-69)', '5 основных чисел (1–69)', MN_MAIN_LABEL_MORE);
  specialLabelEl.textContent = pickLang('파워볼 번호 (1~26)', 'Powerball number (1–26)', '强力球号码（1~26）', 'Số Powerball (1–26)', 'เลขพาวเวอร์บอล (1-26)', 'Число Powerball (1–26)', MN_SPECIAL_LABEL_MORE);
  btnEl.textContent = pickLang('확인하기', 'Check it', '查看结果', 'Kiểm tra', 'ตรวจสอบ', 'Проверить', MN_BTN_MORE);
  disclaimerEl.textContent = pickLang(
    '재미로 보는 가상 비교예요 — 실제 당첨 확인이 아니고, 복권 구매를 권하는 것도 아니에요 🙂',
    'Just a fun hypothetical comparison — not a real prize check, and not an endorsement to buy lottery tickets 🙂',
    '这只是好玩的假设性比较——不是真的对奖，也不是鼓励买彩票 🙂',
    'Chỉ là so sánh giả định cho vui — không phải kiểm tra trúng thưởng thật, và không khuyến khích mua vé số 🙂',
    'แค่การเปรียบเทียบสมมติเพื่อความสนุกเท่านั้น — ไม่ใช่การตรวจรางวัลจริง และไม่ได้ชักชวนให้ซื้อลอตเตอรี่ 🙂',
    'Это просто гипотетическое сравнение для развлечения — не настоящая проверка выигрыша и не призыв покупать лотерейные билеты 🙂',
    MN_DISCLAIMER_MORE
  );
  for (let i = 1; i <= 5; i++) {
    const input = document.getElementById(`mn-main-${i}`);
    if (input) input.setAttribute('aria-label', pickLang(`일반번호 ${i}`, `Main number ${i}`, `普通号码${i}`, `Số chính ${i}`, `เลขหลัก ${i}`, `Основное число ${i}`, buildMainNumAriaMore(i)));
  }
  const specialInput = document.getElementById('mn-special');
  if (specialInput) specialInput.setAttribute('aria-label', pickLang('파워볼 번호', 'Powerball number', '强力球号码', 'Số Powerball', 'เลขพาวเวอร์บอล', 'Число Powerball', MN_SPECIAL_ARIA_MORE));

  // 이미 확인한 번호가 있으면(예: 결과를 본 채로 언어를 바꾼 경우) 결과도 새 언어로 다시 그림
  if (lastMyNumbersCheck) renderMyNumbersResult(lastMyNumbersCheck.mainNums, lastMyNumbersCheck.specialNum);
}

// JACKPOT_HISTORY(당첨번호 확인된 역대급 5건, isLegendary=true) + POWERBALL_DRAW_ARCHIVE/
// MEGAMILLIONS_DRAW_ARCHIVE(각각 1992-04-22/2002-05-17부터 최신 회차까지 전체, 6300건+ —
// 2026-07-23 백필로 기존 2200건+에서 확장됨)를 합쳐 비교 대상 목록을 만듦. numbers/special
// 필드가 없는 JACKPOT_HISTORY 항목(대부분의 일반 기록)은
// 자동으로 제외됨. 아카이브가 이미 최신 회차까지 포함하므로 LATEST_DRAW는 여기서 더 안 합침
// (그래도 홈 화면 "최신 당첨번호" 위젯에서는 LATEST_DRAW를 그대로 씀 — 그건 별개 용도)
function getMyNumbersComparableDraws(){
  if (typeof JACKPOT_HISTORY === 'undefined') return []; // odds-data.js 로드가 아직 안 끝난 극히 드문 경우
  const fromHistory = JACKPOT_HISTORY.filter(e => e.numbers && e.special).map(e => ({
    date: e.date, game: e.game, numbers: e.numbers, special: e.special, isLegendary: true,
  }));
  const legendaryDates = new Set(fromHistory.map(e => e.game + e.date));
  const fromArchive = [
    ...POWERBALL_DRAW_ARCHIVE.map(([date, numbers, special]) => ({ date, game: 'powerball', numbers, special, isLegendary: false })),
    ...MEGAMILLIONS_DRAW_ARCHIVE.map(([date, numbers, special]) => ({ date, game: 'megamillions', numbers, special, isLegendary: false })),
  ].filter(e => !legendaryDates.has(e.game + e.date));
  return [...fromHistory, ...fromArchive].sort((a, b) => b.date.localeCompare(a.date));
}

let lastMyNumbersCheck = null; // { mainNums, specialNum } — 언어 전환 시 결과 재렌더링용

// 입력값 검증 + 결과 렌더링 트리거. 버튼 onclick에서 호출됨
function checkMyNumbersVsHistory(){
  const errorEl = document.getElementById('mn-error');
  const mainNums = [];
  for (let i = 1; i <= 5; i++) {
    const raw = document.getElementById(`mn-main-${i}`).value;
    mainNums.push(raw === '' ? NaN : Number(raw));
  }
  const specialNum = (() => {
    const raw = document.getElementById('mn-special').value;
    return raw === '' ? NaN : Number(raw);
  })();

  // 검증: 5개 모두 1~69 정수·서로 다른 값, 파워볼은 1~26 정수 — 실제 파워볼 규칙(중복 불가)과 맞춰야
  // "이게 뭘 비교하는 거지" 하는 혼란이 없음
  const rangeValid = mainNums.every(n => Number.isInteger(n) && n >= 1 && n <= 69);
  const hasDuplicate = rangeValid && new Set(mainNums).size !== 5;
  const specialValid = Number.isInteger(specialNum) && specialNum >= 1 && specialNum <= 26;
  // 중복 숫자가 원인인 경우 "입력을 다 안 했나?"가 아니라 정확히 뭐가 문제인지 짚어줌
  // (사용자가 서로 다른 숫자 5개를 넣은 줄 알았는데 실수로 겹친 경우를 위한 별도 메시지)
  if (hasDuplicate) {
    errorEl.textContent = pickLang(
      '입력하신 일반번호에 중복된 숫자가 있어요 — 서로 다른 숫자 5개를 입력해주세요',
      'Some of your main numbers are repeated — please enter 5 different numbers',
      '您输入的普通号码有重复 — 请输入5个不同的号码',
      'Có số bị trùng trong 5 số chính bạn nhập — vui lòng nhập 5 số khác nhau',
      'เลขหลักที่กรอกมีตัวซ้ำกัน — กรุณากรอกเลข 5 ตัวที่ไม่ซ้ำกัน',
      'В введённых числах есть повтор — пожалуйста, введите 5 разных чисел',
      MN_DUPLICATE_ERROR_MORE
    );
    return;
  }
  if (!rangeValid || !specialValid) {
    errorEl.textContent = pickLang(
      '일반번호 5개(1~69, 서로 다른 숫자)와 파워볼 번호(1~26)를 모두 입력해주세요',
      'Please enter all 5 main numbers (1–69, all different) and the Powerball number (1–26)',
      '请输入5个不同的普通号码（1~69）和1个强力球号码（1~26）',
      'Vui lòng nhập đủ 5 số chính (1–69, khác nhau) và số Powerball (1–26)',
      'กรุณากรอกเลขหลัก 5 ตัว (1-69 ต้องไม่ซ้ำกัน) และเลขพาวเวอร์บอล (1-26) ให้ครบ',
      'Пожалуйста, введите все 5 основных чисел (1–69, разные) и число Powerball (1–26)',
      MN_ERROR_MORE
    );
    return;
  }
  errorEl.textContent = '';
  lastMyNumbersCheck = { mainNums, specialNum };
  // odds-data.js가 아직 로딩 중일 수 있어(날짜조회 위젯과 같은 이유, 2026-07-22) 로드 완료를
  // 기다렸다가 실제 비교 결과를 그림 — ensureOddsDataLoaded()는 이미 로드됐으면 즉시 resolve됨
  ensureOddsDataLoaded().then(() => renderMyNumbersResult(mainNums, specialNum));
}

function renderMyNumbersResult(mainNums, specialNum){
  const resultEl = document.getElementById('mn-result');
  const announcerEl = document.getElementById('mn-announcer');
  if (!resultEl) return;
  const gameNameKo = { powerball: '파워볼', megamillions: '메가밀리언즈' };
  const gameNameEn = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameZh = { powerball: '强力球', megamillions: '超级百万' };
  const gameNameVi = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameTh = { powerball: 'พาวเวอร์บอล', megamillions: 'เมกะมิลเลียน' };
  const gameNameRu = { powerball: 'Powerball', megamillions: 'Mega Millions' };

  // 아카이브가 2200건+로 늘어난 뒤로는 전부 카드로 그리면 화면이 끝없이 길어지므로, 역대급
  // 잭팟 5건은 예전처럼 전부 보여주고 나머지 실제 회차 중에서는 점수(일치 개수) 기준 베스트
  // 매치 몇 건만 뽑아서 보여줌 — "몇 회차와 비교했는지"는 안내 문구(announcer)에 그대로 살려서
  // 얼마나 폭넓게 찾아봤는지는 전달하되, 카드 자체는 스크롤 가능한 분량으로 유지함
  const MN_BEST_MATCH_COUNT = 5;
  const draws = getMyNumbersComparableDraws();
  const scored = draws.map(draw => {
    const matchedMain = draw.numbers.filter(n => mainNums.includes(n)).length;
    const matchedSpecial = draw.special === specialNum;
    return { draw, matchedMain, matchedSpecial, score: matchedMain + (matchedSpecial ? 1 : 0) };
  });
  const legendary = scored.filter(s => s.draw.isLegendary);
  const bestMatches = scored.filter(s => !s.draw.isLegendary)
    .sort((a, b) => b.score - a.score || b.draw.date.localeCompare(a.draw.date))
    .slice(0, MN_BEST_MATCH_COUNT);

  const cardHtml = ({ draw, matchedMain, matchedSpecial, score }) => {
    const gameLabel = pickLang(gameNameKo[draw.game], gameNameEn[draw.game], gameNameZh[draw.game], gameNameVi[draw.game], gameNameTh[draw.game], gameNameRu[draw.game], GAME_NAME_MORE[draw.game]);
    const tagEmoji = draw.game === 'powerball' ? '🔴' : '🟡';
    const kindTag = draw.isLegendary
      ? pickLang('🏆 역대급 잭팟', '🏆 Legendary jackpot', '🏆 历代传奇头奖', '🏆 Jackpot huyền thoại', '🏆 แจ็คพอตในตำนาน', '🏆 Легендарный джекпот', MN_LEGENDARY_TAG_MORE)
      : pickLang('🎱 실제 당첨 회차', '🎱 Real draw', '🎱 真实开奖', '🎱 Kỳ quay có thật', '🎱 การออกรางวัลจริง', '🎱 Реальный розыгрыш', MN_LATEST_TAG_MORE);
    const ballsHtml = draw.numbers.map(n => `<span class="mn-result-ball${mainNums.includes(n) ? ' hit' : ''}">${n}</span>`).join('')
      + `<span class="mn-result-ball special${matchedSpecial ? ' hit' : ''}">${draw.special}</span>`;
    // buildMatchMore()는 이미 PRIZE_TIERS 등에서 검증된 17개 언어 조각 조립 함수라 재사용 —
    // ball 이름은 게임과 무관하게 언제나 "Powerball"로 고정(이 위젯 자체가 파워볼 형식 입력 기준이라)
    const mode = matchedSpecial ? (matchedMain === 0 ? 'only' : 'plus') : 'no';
    const matchMore = buildMatchMore(matchedMain, 'Powerball', mode);
    const matchLabel = mode === 'only'
      ? pickLang('파워볼 번호만 일치', 'Powerball number only', '仅强力球号码一致', 'Chỉ trúng số Powerball', 'ถูกเฉพาะเลขพาวเวอร์บอล', 'Совпал только Powerball', matchMore)
      : pickLang(
          `일반번호 ${matchedMain}개 일치 (파워볼 ${matchedSpecial ? '도 일치' : '불일치'})`,
          `${matchedMain} main number${matchedMain === 1 ? '' : 's'} matched (${matchedSpecial ? '+ Powerball' : 'Powerball missed'})`,
          `${matchedMain}个号码一致（${matchedSpecial ? '+强力球' : '未中强力球'}）`,
          `Trúng ${matchedMain} số (${matchedSpecial ? '+ Powerball' : 'trật Powerball'})`,
          `ถูก ${matchedMain} ตัวเลข (${matchedSpecial ? '+ พาวเวอร์บอล' : 'พาวเวอร์บอลไม่ถูก'})`,
          `Совпадение ${matchedMain} чисел (${matchedSpecial ? '+ Powerball' : 'без Powerball'})`,
          matchMore
        );
    const toneLine = mnToneLine(score);
    return `<div class="mn-result-card">
      <div class="mn-result-top">
        <span class="mn-result-tag">${tagEmoji} ${gameLabel} · ${kindTag}</span>
        <span class="mn-result-date">${draw.date}</span>
      </div>
      <div class="mn-result-balls">${ballsHtml}</div>
      <p class="mn-result-match">${matchLabel}</p>
      <p class="mn-result-tone">${toneLine}</p>
    </div>`;
  };

  const bestMatchLabel = pickLang(
    `실제 당첨 회차 중 가장 비슷했던 매치 ${MN_BEST_MATCH_COUNT}건`,
    `Top ${MN_BEST_MATCH_COUNT} closest matches among real draws`,
    `真实开奖中最接近的${MN_BEST_MATCH_COUNT}期`,
    `${MN_BEST_MATCH_COUNT} kỳ quay có thật giống nhất`,
    `${MN_BEST_MATCH_COUNT} งวดจริงที่ใกล้เคียงที่สุด`,
    `Топ-${MN_BEST_MATCH_COUNT} самых близких совпадений среди реальных розыгрышей`,
    buildBestMatchLabelMore(MN_BEST_MATCH_COUNT)
  );

  const cardsHtml = legendary.map(cardHtml).join('')
    + (bestMatches.length ? `<p class="mn-section-label">${bestMatchLabel}</p>${bestMatches.map(cardHtml).join('')}` : '');

  // reveal-up은 이미 다른 화면(카드 스크롤 등장 등)에서 prefers-reduced-motion까지 처리해둔
  // 기존 트랜지션 클래스라, 새 keyframe/모션 코드를 추가하지 않고 그대로 재사용함
  resultEl.innerHTML = `<div class="mn-result-wrap reveal-up">${cardsHtml}</div>`;
  requestAnimationFrame(() => {
    const wrap = resultEl.querySelector('.mn-result-wrap');
    if (wrap) wrap.classList.add('is-in');
  });

  if (announcerEl) {
    announcerEl.textContent = pickLang(
      `${draws.length}개 추첨과 비교했어요`, `Compared against ${draws.length} draws`, `已与${draws.length}期开奖比较`,
      `Đã so sánh với ${draws.length} kỳ quay`, `เทียบกับ ${draws.length} งวดแล้ว`, `Сравнено с ${draws.length} розыгрышами`,
      buildDrawCountAnnounceMore(draws.length)
    );
  }
}
function buildDrawCountAnnounceMore(count){
  return {
    ar: `تمت المقارنة مع ${count} سحوبات`, bn: `${count}টি ড্রয়ের সাথে তুলনা করা হয়েছে`, fr: `Comparé à ${count} tirages`, hi: `${count} ड्रॉ से तुलना की गई`,
    id: `Dibandingkan dengan ${count} undian`, ja: `${count}回の抽選と比較しました`, kk: `${count} тартылыммен салыстырылды`, km: `បានប្រៀបធៀបជាមួយការទាញឆ្នោត ${count}`,
    ky: `${count} тартылыш менен салыштырылды`, lo: `ປຽບທຽບກັບການອອກ ${count} ຄັ້ງແລ້ວ`, mn: `${count} сугалаатай харьцуулав`, my: `ထီပေါက်စဉ် ${count} ခုနှင့် နှိုင်းယှဉ်ပြီးပါပြီ`,
    ne: `${count} ड्रसँग तुलना गरियो`, si: `දිනුම් ඇදීම් ${count}ක් සමඟ සසඳන ලදී`, tl: `Naikumpara sa ${count} draw`, ur: `${count} ڈرا سے موازنہ کیا گیا`,
    uz: `${count} ta tortish bilan solishtirildi`,
  };
}

function buildBestMatchLabelMore(count){
  return {
    ar: `أفضل ${count} تطابقات بين السحوبات الحقيقية`, bn: `প্রকৃত ড্রয়ের মধ্যে সবচেয়ে কাছাকাছি ${count}টি মিল`,
    fr: `${count} correspondances les plus proches parmi les tirages réels`, hi: `असली ड्रॉ में सबसे नज़दीकी ${count} मैच`,
    id: `${count} kecocokan terdekat di antara undian asli`, ja: `実際の抽選の中で最も近い${count}件`,
    kk: `Нақты тартылымдар арасындағы ең жақын ${count} сәйкестік`, km: `ការផ្គូផ្គងជិតបំផុត ${count} ក្នុងចំណោមការទាញឆ្នោតពិត`,
    ky: `Реалдуу тартылыштар арасынан эң жакын ${count} дал келүү`, lo: `${count} ການຈັບຄູ່ທີ່ໃກ້ຄຽງທີ່ສຸດໃນບັນດາການອອກຕົວຈິງ`,
    mn: `Бодит сугалаануудаас хамгийн ойрхон ${count} тохирол`, my: `အမှန်တကယ် ထီပေါက်စဉ်များထဲမှ အနီးစပ်ဆုံး ${count} ခု`,
    ne: `वास्तविक ड्रहरूमध्ये सबैभन्दा नजिकको ${count} मिलान`, si: `සැබෑ දිනුම් ඇදීම් අතරින් ආසන්නතම ගැලපීම් ${count}`,
    tl: `${count} pinakamalapit na tugma sa mga totoong draw`, ur: `حقیقی ڈرا میں سب سے قریبی ${count} میچز`,
    uz: `Haqiqiy tortishlar orasidagi eng yaqin ${count} ta moslik`,
  };
}

function applyJackpotData(){
  document.getElementById('jp-powerball').setAttribute('data-target', JACKPOT_DATA.powerball.amountUsd);
  document.getElementById('jp-mega').setAttribute('data-target', JACKPOT_DATA.megamillions.amountUsd);
}

const CASH_VALUE_RATIO = 0.58; // 일시불(lump sum)은 발표된 연금 기준 잭팟의 약 45~60% (현재가치 할인) — 중간값 사용, 화면 표시 문구와 일치

function initJackpotCardAmt(){
  const krw = getJackpotKRW();
  // formatWon()이 이미 언어별(ko/en/zh/vi/th/ru) 단위 변환·표기를 전부 처리하므로 재사용
  document.getElementById('jackpot-card-amt').textContent = pickLang('약 ', 'About ', '约', 'Khoảng ', 'ประมาณ ', 'Около ', ABOUT_PREFIX_MORE) + formatWon((krw * CASH_VALUE_RATIO) / 100000000);
  // "일시불 세전"이라고만 하면 아래 펼쳤을 때 나오는 1단계(발표액)와 헷갈린다는 지적이 있어서,
  // 2단계 문구("일시불 선택 시")랑 표현을 맞춰서 "이 숫자는 일시불을 고를 때의 금액"이라는 걸 명확히 함
  document.getElementById('jackpot-card-amt-note').textContent = pickLang(
    '(일시불 선택 시, 세전)', '(lump-sum option, pre-tax)', '(选择一次性支付时，税前)', '(nếu chọn trả một lần, trước thuế)', '(หากเลือกจ่ายครั้งเดียว ก่อนหักภาษี)', '(при единовременной выплате, до налогов)',
    {
      km: '(ប្រសិនបើជ្រើសរើសទទួលជាដុំតែម្តង មុនបង់ពន្ធ)',
      ne: '(एकमुष्ट रोज्दा, कर अघि)',
      id: '(jika pilih sekaligus, sebelum pajak)',
      my: '(တစ်ကြိမ်တည်းရွေးလျှင်၊ အခွန်မတိုင်မီ)',
      si: '(එකවර තෝරාගතහොත්, බදු පෙර)',
      uz: '(bir martalik tanlansa, soliqqacha)',
      mn: '(нэг удаа сонговол, татвараас өмнө)',
      kk: '(бір реттік таңдалса, салыққа дейін)',
      ky: '(бир жолку тандалса, салыкка чейин)',
      ur: '(یکمشت منتخب کرنے پر، ٹیکس سے پہلے)',
      bn: '(একবারে বেছে নিলে, কর-পূর্ব)',
      lo: '(ຫາກເລືອກຈ່າຍເທື່ອດຽວ, ກ່ອນຫັກພາສີ)',
      ja: '(一括受取を選んだ場合、税引前)',
      ar: '(عند اختيار الدفعة الواحدة، قبل الضريبة)',
      hi: '(एकमुश्त चुनने पर, कर-पूर्व)',
      fr: '(si versement unique, avant impôt)',
      tl: '(kapag pinili ang lump-sum, bago ang buwis)',
    }
  );

  const pbUsd = Number(document.getElementById('jp-powerball').getAttribute('data-target'));
  const mgUsd = Number(document.getElementById('jp-mega').getAttribute('data-target'));
  document.getElementById('jp-powerball-krw').textContent = usdToKrwLabel(pbUsd);
  document.getElementById('jp-mega-krw').textContent = usdToKrwLabel(mgUsd);

  // "million/billion 감이 안 온다"는 사용자에게 숫자를 직접 타이핑하게 하는 대신,
  // 오늘 실제 잭팟의 일시불 환산액을 버튼에 미리 보여주고 누르면 바로 채워지게 함.
  // 버튼에는 실제로 입력창에 채워질 값(M USD)과 그 원화 감(약 -억원)을 같이 보여줌
  // 디자인 3차 개선: 버튼 안에서 원화 금액을 큰 글씨 주역으로, USD는 참고용 보조 문구로 분리
  // (이전엔 "M USD (원화)" 한 줄로 합쳐서 어느 게 중요한 숫자인지 안 와닿는다는 지적)
  const quickfillMainLabel = (usd) => {
    const cashUsd = usd * CASH_VALUE_RATIO;
    return formatWon((cashUsd * EXCHANGE_RATE) / 100000000);
  };
  // 디자인 시안의 보조 문구 예시("$316M · 일시불")를 그대로 따름 — 기존 "ko/zh는 $ 생략" 규칙은
  // 이전의 "M USD가 주역인 한 줄 표기" 맥락에서 나온 것이라, 원화가 주역이 된 이 새 보조 캡션에는
  // 적용하지 않고 모든 언어에서 $ 기호를 붙임(디자인 3차 개선)
  const quickfillSubLabel = (usd) => {
    const cashUsd = usd * CASH_VALUE_RATIO;
    const millions = Math.round(cashUsd / 1000000);
    const lumpSumWord = pickLang('일시불', 'lump-sum', '一次性', 'trả một lần', 'จ่ายครั้งเดียว', 'единовременно', LUMP_SUM_WORD_MORE);
    return `($${millions}M · ${lumpSumWord})`;
  };
  document.getElementById('quickfill-pb-amt').textContent = quickfillMainLabel(pbUsd);
  document.getElementById('quickfill-pb-usd').textContent = quickfillSubLabel(pbUsd);
  document.getElementById('quickfill-mm-amt').textContent = quickfillMainLabel(mgUsd);
  document.getElementById('quickfill-mm-usd').textContent = quickfillSubLabel(mgUsd);
}

function fillHomeAmountFromJackpot(game, btn){
  hideAnnouncedConvertNote();
  switchAmountTab('lump'); // 퀵필은 일시불 칸을 채우므로, 다른 탭이 열려있으면 안 보이는 문제 방지
  isAmountManuallyEdited = true;
  const amountUsd = JACKPOT_DATA[game].amountUsd;
  const cashUsd = amountUsd * CASH_VALUE_RATIO;
  const millions = Math.round(cashUsd / 1000000);
  const input = document.getElementById('homeAmountInput');
  input.value = millions;
  const slider = document.getElementById('homeAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.step = 1;
  slider.min = Math.min(10, millions);
  slider.value = millions;
  updateHomeCalc(millions * 1000000);
  // 예전엔 여기서 input.focus()를 호출했는데, 모바일에서는 입력칸에 포커스가 가는 순간
  // 숫자 키패드가 자동으로 올라와서 — 퀵필 버튼은 값을 이미 다 채워주는 건데 타이핑할
  // 필요가 없는데도 키보드가 뜨는 게 어색했음(사용자 지적, 2026-07-22) — 삭제함.
  // 값이 채워졌다는 시각적 피드백은 바로 아래 celebrateQuickFill() 반짝임 효과로 충분함
  // "실제 이 잭팟에 당첨되면?"을 상상해보는 순간이라 재미로 살짝 반짝임 효과를 줌
  // (사용자 요청 "이 사이트에 맞게, 과하지 않게 재밌는 요소" 반영, 2026-07-22)
  if (btn) celebrateQuickFill(btn);
}

function celebrateQuickFill(btn){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = btn.getBoundingClientRect();
  ['✨', '🍀', '✨'].forEach((emoji, i) => {
    const spark = document.createElement('span');
    spark.className = 'quickfill-spark';
    spark.textContent = emoji;
    spark.style.left = (rect.left + rect.width / 2 + (i - 1) * 22) + 'px';
    spark.style.top = rect.top + 'px';
    spark.style.animationDelay = (i * 70) + 'ms';
    document.body.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  });
}

function refreshJackpotDrawerIfOpen(){
  const box = document.getElementById('jackpot-calc-box');
  if (box && box.classList.contains('show')) {
    const announcedKrw = getJackpotKRW();
    const cashKrw = announcedKrw * CASH_VALUE_RATIO;
    const r = calcTakeHome(cashKrw / 100000000, 'kr');
    // formatWon()이 이미 언어별(ko/en/zh/vi/th/ru) 단위 변환·표기를 전부 처리하므로 재사용
    const about = pickLang('약 ', 'About ', '约', 'Khoảng ', 'ประมาณ ', 'Около ', ABOUT_PREFIX_MORE);
    document.getElementById('jc-jackpot').textContent = about + formatWon(announcedKrw / 100000000);
    document.getElementById('jc-cash').textContent = about + formatWon(cashKrw / 100000000);
    document.getElementById('jc-final').textContent = about + formatWon(r.final);
    document.getElementById('jc-note-basis').textContent = pickLang(
      `한국 거주자 기준 (미국 원천징수 30% + 한국 세금 적용, 환율 약 ${EXCHANGE_RATE.toLocaleString('ko-KR')}원 반영)`,
      `Korea resident basis (30% US withholding + Korean tax, ~${EXCHANGE_RATE.toLocaleString('en-US')} KRW/USD)`,
      `以韩国居民为基准（美国预扣30% + 韩国税金，汇率约${EXCHANGE_RATE.toLocaleString('zh-CN')}韩元/美元）`,
      `Theo tiêu chuẩn cư dân Hàn Quốc (khấu trừ Mỹ 30% + thuế Hàn Quốc, tỷ giá khoảng ${EXCHANGE_RATE.toLocaleString('vi-VN')} KRW/USD)`,
      `เกณฑ์ผู้พำนักในเกาหลี (หักภาษีสหรัฐฯ 30% + ภาษีเกาหลี, อัตราแลกเปลี่ยนประมาณ ${EXCHANGE_RATE.toLocaleString('th-TH')} วอน/ดอลลาร์)`,
      `По правилам резидента Кореи (30% удержание в США + налог Кореи, курс около ${EXCHANGE_RATE.toLocaleString('ru-RU')} вон/долл.)`,
      {
        km: `តាមមូលដ្ឋានអ្នករស់នៅកូរ៉េ (កាត់ពន្ធអាមេរិក ៣០% + ពន្ធកូរ៉េ, អត្រាប្តូរប្រាក់ប្រហែល ${EXCHANGE_RATE.toLocaleString('en-US')} វុន/ដុល្លារ)`,
        ne: `कोरिया बासिन्दा आधार (अमेरिकी कर कटौती ३०% + कोरियाली कर, विनिमय दर लगभग ${EXCHANGE_RATE.toLocaleString('en-US')} वोन/डलर)`,
        id: `Basis penduduk Korea (pemotongan AS 30% + pajak Korea, kurs sekitar ${EXCHANGE_RATE.toLocaleString('en-US')} KRW/USD)`,
        my: `ကိုရီးယားနေထိုင်သူအခြေခံ (အမေရိကန်နှုတ်ငွေ ၃၀% + ကိုရီးယားအခွန်, ငွေလဲနှုန်း ${EXCHANGE_RATE.toLocaleString('en-US')} ဝမ်/ဒေါ်လာခန့်)`,
        si: `කොරියානු පදිංචිකරු පදනම (ඇමරිකානු බදු අඩුකිරීම 30% + කොරියානු බද්ද, විනිමය අනුපාතය ආසන්න වශයෙන් ${EXCHANGE_RATE.toLocaleString('en-US')} වොන්/ඩොලර්)`,
        uz: `Koreya rezidenti asosida (AQSh ushlab qolishi 30% + Koreya solig'i, kurs taxminan ${EXCHANGE_RATE.toLocaleString('en-US')} von/dollar)`,
        mn: `Солонгос оршин суугчийн үндэслэлээр (АНУ-ын суутгал 30% + Солонгосын татвар, ханш ойролцоогоор ${EXCHANGE_RATE.toLocaleString('en-US')} вон/доллар)`,
        kk: `Корея резиденті негізінде (АҚШ ұстауы 30% + Корея салығы, бағам шамамен ${EXCHANGE_RATE.toLocaleString('en-US')} вон/доллар)`,
        ky: `Корея резиденти негизинде (АКШнын кармап калуусу 30% + Корея салыгы, курс болжол менен ${EXCHANGE_RATE.toLocaleString('en-US')} вон/доллар)`,
        ur: `کوریا رہائشی بنیاد پر (امریکی کٹوتی 30% + کوریائی ٹیکس، شرح تبادلہ تقریباً ${EXCHANGE_RATE.toLocaleString('en-US')} وون/ڈالر)`,
        bn: `কোরিয়া বাসিন্দা ভিত্তিতে (মার্কিন কর্তন 30% + কোরিয়ান কর, বিনিময় হার প্রায় ${EXCHANGE_RATE.toLocaleString('en-US')} ওন/ডলার)`,
        lo: `ອີງໃສ່ຜູ້ອາໄສຢູ່ເກົາຫຼີ (ອາເມຣິກາຫັກ 30% + ພາສີເກົາຫຼີ, ອັດຕາແລກປ່ຽນປະມານ ${EXCHANGE_RATE.toLocaleString('en-US')} ວອນ/ໂດລາ)`,
        ja: `韓国居住者基準（米国源泉徴収30%＋韓国税金、為替レート約${EXCHANGE_RATE.toLocaleString('en-US')}ウォン/ドル）`,
        ar: `على أساس مقيم كوريا (اقتطاع أمريكي 30% + ضريبة كورية، سعر الصرف حوالي ${EXCHANGE_RATE.toLocaleString('en-US')} وون/دولار)`,
        hi: `कोरिया निवासी आधार (अमेरिकी कटौती 30% + कोरियाई कर, विनिमय दर लगभग ${EXCHANGE_RATE.toLocaleString('en-US')} वोन/डॉलर)`,
        fr: `Base résident coréen (retenue américaine 30 % + impôt coréen, taux de change environ ${EXCHANGE_RATE.toLocaleString('en-US')} KRW/USD)`,
        tl: `Batay sa residente ng Korea (30% na Amerikanong withholding + buwis sa Korea, palitan humigit-kumulang ${EXCHANGE_RATE.toLocaleString('en-US')} won/dolyar)`,
      }
    );

    // 연금(annuity) 선택 시 — 발표 잭팟 총액을 30회로 단순 평균해 희망적인 그림도 함께 보여줌
    const ANNUITY_PAYMENTS = 30;
    const perYearKrw = announcedKrw / ANNUITY_PAYMENTS;
    const rYear = calcTakeHome(perYearKrw / 100000000, 'kr');
    document.getElementById('jc-annuity-year').textContent = about + formatWon(perYearKrw / 100000000);
    document.getElementById('jc-annuity-year-net').textContent = about + formatWon(rYear.final);
    document.getElementById('jc-annuity-month-net').textContent = about + formatWon(rYear.final / 12);
    renderAnnuitySchedule(announcedKrw);
  }
}

// 연금은 "단순 평균"이 아니라 실제로는 첫 회가 가장 적고 매년 5%씩 늘어나는 등비수열로 지급됨
// (30회 총합 = 발표된 잭팟 총액). 등비수열 합 공식으로 첫 회 금액을 역산: 총액 = P0*(r^30-1)/(r-1)
function buildAnnuitySchedule(announcedKrw){
  const N = 30, GROWTH = 1.05;
  const p0 = announcedKrw * (GROWTH - 1) / (Math.pow(GROWTH, N) - 1);
  const rows = [];
  for (let i = 0; i < N; i++) {
    rows.push({ year: i + 1, grossKrw: p0 * Math.pow(GROWTH, i) });
  }
  return rows;
}

function renderAnnuitySchedule(announcedKrw, targetId){
  const listEl = document.getElementById(targetId || 'annuity-schedule-list');
  if (!listEl) return;
  const rows = buildAnnuitySchedule(announcedKrw);
  // 회차별로 금액이 달라 한국 종합소득세 누진세율 구간도 회차마다 달라짐 — 그래서 평균이 아니라
  // 회차별로 calcTakeHome()을 각각 다시 계산해야 실제와 맞음(초반 회차는 낮은 세율, 후반은 높은 세율)
  listEl.innerHTML = rows.map(row => {
    const r = calcTakeHome(row.grossKrw / 100000000, 'kr');
    return `<div class="annuity-schedule-row">
      <span>${row.year}</span>
      <span>${formatWon(row.grossKrw / 100000000)}</span>
      <span class="annuity-schedule-net">${formatWon(r.final)}</span>
    </div>`;
  }).join('');
}

// jc-tap-cta 한 줄짜리 문구를 열림/닫힘 상태·현재 언어에 맞게 다시 그려줌
// (예전엔 "👇 눌러서..."와 "👆 다시 누르면 접혀요" 두 문단을 따로 두고 하나만 숨기는 방식이라,
// 카드를 펼치면 두 줄이 같이 보이는 버그가 있었음 — 디자인 원본처럼 한 줄이 상태에 따라 바뀌게 함)
function updateJcTapLabel(){
  const el = document.getElementById('jc-tap-cta');
  if (!el) return;
  const box = document.getElementById('jackpot-calc-box');
  const isOpen = box && box.classList.contains('show');
  if (isOpen) {
    el.textContent = pickLang('👆 카드를 다시 누르면 접혀요', '👆 Tap the card again to collapse', '👆 再次点击卡片可收起', '👆 Nhấn lại vào thẻ để thu gọn', '👆 แตะการ์ดอีกครั้งเพื่อย่อ', '👆 Нажмите на карточку ещё раз, чтобы свернуть', {
      ar: '👆 اضغط على البطاقة مرة أخرى للطي', bn: '👆 কার্ডটি আবার ট্যাপ করলে বন্ধ হয়ে যাবে',
      fr: '👆 Appuyez à nouveau sur la carte pour la réduire', hi: '👆 कार्ड को फिर से टैप करने पर यह सिमट जाएगा',
      id: '👆 Ketuk kartu lagi untuk menutupnya', ja: '👆 カードをもう一度タップすると閉じます',
      kk: '👆 Картаны қайта түртсеңіз, жиналады', km: '👆 ចុចកាតម្តងទៀតដើម្បីបត់វា',
      ky: '👆 Картаны кайра басканда жыйылат', lo: '👆 ແຕະບັດອີກຄັ້ງເພື່ອຫຍໍ້',
      mn: '👆 Картыг дахин дарвал хумигдана', my: '👆 ကတ်ကို ထပ်နှိပ်ပါက ပြန်ခေါက်သွားပါမည်',
      ne: '👆 कार्ड फेरि थिच्दा यो बन्द हुन्छ', si: '👆 කාඩ්පත නැවත තට්ටු කළහොත් හැකිලේ',
      tl: '👆 Pindutin muli ang card para ito ay mag-collapse', ur: '👆 کارڈ کو دوبارہ ٹیپ کرنے پر یہ سمٹ جائے گا',
      uz: "👆 Kartani yana bosing, u yig'iladi",
    });
  } else {
    el.textContent = pickLang('👇 눌러서 세후 실수령액 보기', '👇 Tap to see your after-tax take-home', '👇 点击查看税后实得金额', '👇 Nhấn để xem số tiền thực nhận sau thuế', '👇 แตะเพื่อดูจำนวนที่ได้รับจริงหลังหักภาษี', '👇 Нажмите, чтобы увидеть сумму на руки после налогов', {
      ar: '👇 اضغط لمعرفة المبلغ الذي تحصل عليه بعد الضريبة', bn: '👇 কর-পরবর্তী প্রকৃত অর্থ দেখতে ট্যাপ করুন',
      fr: '👇 Appuyez pour voir votre montant net après impôt', hi: '👇 टैक्स के बाद मिलने वाली राशि देखने के लिए टैप करें',
      id: '👇 Ketuk untuk melihat jumlah yang Anda terima setelah pajak', ja: '👇 タップして税引き後の受取額を見る',
      kk: '👇 Салықтан кейінгі қолыңызға тиетін соманы көру үшін түртіңіз', km: '👇 ចុចដើម្បីមើលចំនួនទឹកប្រាក់ដែលអ្នកទទួលបានបន្ទាប់ពីបង់ពន្ធ',
      ky: '👇 Салыктан кийин колуңузга тийчү суманы көрүү үчүн басыңыз', lo: '👇 ແຕະເພື່ອເບິ່ງຈຳນວນເງິນທີ່ໄດ້ຮັບຈິງຫຼັງຫັກພາສີ',
      mn: '👇 Татвар суутгасны дараах гартаа авах дүнг харахын тулд дарна уу', my: '👇 အခွန်ဖြတ်ပြီးနောက် လက်ခံရရှိမည့်ပမာဏကိုကြည့်ရန် နှိပ်ပါ',
      ne: '👇 कर पछि पाउने रकम हेर्न ट्याप गर्नुहोस्', si: '👇 බදු කැපීමෙන් පසු ලැබෙන මුදල බැලීමට තට්ටු කරන්න',
      tl: '👇 Pindutin para makita ang matatanggap mo pagkatapos ng buwis', ur: '👇 ٹیکس کے بعد ملنے والی رقم دیکھنے کے لیے ٹیپ کریں',
      uz: "👇 Soliqdan keyin qo'lingizga tegadigan summani ko'rish uchun bosing",
    });
  }
}

function toggleJackpotCalc(){
  const box = document.getElementById('jackpot-calc-box');
  const isShowing = box.classList.toggle('show');
  updateJcTapLabel();
  if (isShowing) refreshJackpotDrawerIfOpen();
}

// 홈 화면 계산기는 일시불(lump sum) 기준으로만 계산함 — 연금(annuity) 세금은 30년에 걸쳐
// 매년 다른 세율 구간이 적용되는 완전히 별도의 계산이라 여기에 중복으로 넣지 않고,
// 이미 만들어둔 확률체감 페이지의 잭팟 계산기(연금 단계 포함)로 안내만 함
function toggleTaxTermInfo(){
  const box = document.getElementById('tax-term-box');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function goToAnnuityInfo(){
  go('odds');
  const box = document.getElementById('jackpot-calc-box');
  if (!box.classList.contains('show')) toggleJackpotCalc();
  setTimeout(() => {
    document.querySelector('.prize-card.jackpot').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 400);
}

// 스크롤하면서 각 섹션이 살짝 떠오르며 나타나는 효과. reduced-motion 환경에서는 CSS가 즉시 보이게 처리함
let _revealObserver = null;
function setupRevealAnimation(){
  const activeView = document.querySelector('.view.on');
  if (!activeView) return;
  const targets = activeView.querySelectorAll(':scope > .hero, :scope > .panel, :scope > .input-card, :scope > .explore-section, :scope > details, :scope > .legal-section, :scope > form');
  if (!_revealObserver){
    _revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('is-in');
          animateBarsIn(entry.target);
          _revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  }
  targets.forEach(el => {
    if (el.classList.contains('is-in') || el.classList.contains('reveal-up')) return;
    el.classList.add('reveal-up');
    _revealObserver.observe(el);
  });
}

// 확률 막대그래프(odds.barPowerball 등)가 화면에 처음 들어올 때 고정폭으로 뚝 나타나지 않고
// 0에서 실제 길이까지 부드럽게 채워지도록 함.
// 예전엔 "style.width를 0%로 리셋했다가 목표값으로 되돌려서 CSS transition이 걸리게 하는" 방식을
// 썼는데(reflow를 강제로 끼워넣는 흔한 트릭 포함해서 시도해봐도), 리셋과 복원이 브라우저가 실제
// 페인트하는 시점 전에 같은 프레임으로 묶여버려서 0% 상태가 화면에 한 번도 그려지지 않고 바로
// 완성 폭으로 뚝 나타나는 문제가 있었음(사용자가 "애니메이션이 사라진 것 같다"고 직접 지적,
// Playwright로 재현 확인) — style 값 전후 비교에 의존하는 CSS transition 대신, Web Animations
// API(Element.animate)로 0%→목표값 구간을 직접 지정하면 이전 페인트 상태와 무관하게 항상
// 재생됨. fill 옵션을 안 써서 애니메이션이 끝나면 원래 inline style(목표값)에 그대로 되돌아감
function animateBarsIn(container){
  const bars = container.querySelectorAll('.bar-fill');
  bars.forEach(bar => {
    const target = bar.style.width;
    if (!target || typeof bar.animate !== 'function') return;
    bar.animate([{ width: '0%' }, { width: target }], { duration: 900, easing: 'cubic-bezier(0.16,1,0.3,1)' });
    const icon = bar.closest('.bar-row')?.querySelector('.bar-icon');
    if (icon) {
      icon.classList.remove('bar-icon-pop');
      void icon.offsetWidth;
      icon.style.animationDelay = '0.75s';
      icon.classList.add('bar-icon-pop');
    }
  });
}

// 입력창·슬라이더는 메인 결과 카드보다 화면 아래쪽에 있어서, 모바일에서 스크롤해서 금액을
// 바꾸면 결과가 바뀌는 게 화면 밖이라 안 보임(사용자가 직접 지적) — 메인 결과 카드가 뷰포트
// 밖으로 나갔을 때만 하단에 작은 배지로 지금 값을 계속 보여줌. MutationObserver로
// home-final-amt 텍스트를 그대로 미러링해서, formatWon() 결과를 쓰는 기존 갱신 코드
// 여러 곳(연금 뷰 제외 계산 관련 전부)을 하나도 안 건드려도 값이 항상 같이 갱신됨
let _stickyResultObserver = null;
function setupStickyResultBadge(){
  const target = document.getElementById('home-final-amt');
  // 결과 카드 밑에 입력창·슬라이더·세금 상세까지가 "관련 구간"이고, 그 밑 탐색 카드부터는
  // 배지랑 상관없는 콘텐츠임 — 이 구간을 완전히 지나쳐 스크롤하면(잭팟 이력·탐색 카드 등이
  // 보일 때) 배지가 그 위에 계속 떠서 글자를 가리는 문제가 있었음(사용자가 스크린샷으로 지적) —
  // .calc-detail-toggle이 화면 위로 완전히 넘어가면 배지도 같이 숨김
  const zoneEnd = document.querySelector('.calc-detail-toggle');
  const badge = document.getElementById('sticky-result-badge');
  const amtEl = document.getElementById('sticky-result-amt');
  if (!target || !badge || !amtEl || badge.dataset.bound) return;
  badge.dataset.bound = '1';

  let resultOutOfView = false;
  let pastRelevantZone = false;
  const updateVisibility = () => {
    const isHomeActive = document.getElementById('view-home').classList.contains('on');
    badge.classList.toggle('is-visible', isHomeActive && resultOutOfView && !pastRelevantZone);
  };

  _stickyResultObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.target === target) {
        resultOutOfView = !entry.isIntersecting;
      } else if (entry.target === zoneEnd) {
        pastRelevantZone = entry.boundingClientRect.bottom < 0;
      }
    });
    updateVisibility();
  }, { threshold: 0 });
  _stickyResultObserver.observe(target);
  if (zoneEnd) _stickyResultObserver.observe(zoneEnd);

  new MutationObserver(() => { amtEl.textContent = target.textContent; }).observe(target, { childList: true, characterData: true, subtree: true });
  amtEl.textContent = target.textContent;
}
function scrollToMainResult(){
  const target = document.getElementById('home-final-amt');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// renderJackpotHistory()/renderJackpotTakeHomeRanking()/renderNumberFrequencyStats()는 확률체감
// 탭 전용 데이터(odds-data.js)가 필요해서 여기서 안 부름 — go('odds')가 처음 호출될 때 지연 로드
// 후 그려짐(renderOddsTabDataWhenReady, 2026-07-22 성능 개선)
document.addEventListener('DOMContentLoaded', () => { applyJackpotData(); runCountUps(); updateHomeCalc(100000000); updateCalc(); initJackpotCardAmt(); updateDrawCountdown(); syncRateInputsDisplay(); setupRevealAnimation(); updateDateLookupUi(); renderLatestDraw(); renderPrizeTiers(); fetchLiveExchangeRate(); updateLightningGameUi(); updateMyNumbersUi(); setupStickyResultBadge(); renderFilingDday(); });

// 다른 페이지(korea-resident-us-lottery-tax.html 등)에서 "index.html#faq"처럼 해시가 붙은 링크로
// 들어왔을 때, 이 SPA는 해시를 안 보고 항상 홈 화면부터 그려서 그 링크가 사실상 무시되던 문제 수정.
// 페이지 로드 시 해시를 확인해서, 알려진 뷰 이름이면 그 화면으로 바로 이동시켜줌
document.addEventListener('DOMContentLoaded', () => {
  const knownViews = ['home', 'compare', 'odds', 'faq', 'privacy', 'disclaimer', 'contact'];
  const hashView = location.hash.replace('#', '');
  if (knownViews.includes(hashView) && hashView !== 'home') {
    go(hashView);
  }
});

// 페이지 로드 시 초기 언어를 정하는 우선순위:
// 1) localStorage에 저장된, 사용자가 예전에 직접 고른 언어(있으면 최우선 — 자동 감지보다 사용자
//    의사가 항상 우선함)
// 2) 영어/중국어 랜딩페이지(korean-abroad-lottery-tax.html, china-resident-us-lottery-tax.html 등)에서
//    "index.html?lang=en" 처럼 붙어서 들어온 URL 파라미터
// 3) 브라우저/OS 설정 언어 자동 감지(navigator.language) — 방문자 나라를 직접 조회하는 대신
//    이 방법을 씀(외부 API 불필요, 즉시 동작, 언어별 세금 정보 사이트 특성상 더 정확한 신호)
// 4) 위 셋 다 없으면 그대로 기본값(한국어) 유지
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const urlLang = params.get('lang');
  const SUPPORTED_LANGS = ['en', 'zh', 'vi', 'th', 'ru', ...ADDITIONAL_LANGS];
  let savedLang = null;
  try { savedLang = localStorage.getItem('chamtax_lang'); } catch (e) {}

  if (savedLang === 'ko' || SUPPORTED_LANGS.includes(savedLang)) {
    setLanguage(savedLang);
  } else if (urlLang === 'ko' || SUPPORTED_LANGS.includes(urlLang)) {
    // 'ko'는 언어 파일이 따로 없는 기본값이라 SUPPORTED_LANGS 목록엔 없는데, 그 때문에
    // "?lang=ko"로 명시적으로 들어온 링크가 이 분기를 못 타고 그 아래 브라우저 자동감지로
    // 새서, 한국어가 아닌 브라우저에서 열면 링크가 지정한 한국어 대신 엉뚱한 언어로 뜨는
    // 버그였음(현재는 이 링크를 실제로 쓰는 페이지가 없어 드러나진 않았지만 잠재 버그였음)
    setLanguage(urlLang);
  } else {
    const detected = detectBrowserLanguage();
    if (detected) setLanguage(detected);
  }

  if (urlLang === 'ko' || SUPPORTED_LANGS.includes(urlLang)) {
    // 한 번 적용한 뒤엔 URL에서 ?lang= 을 지워야 함 — 남겨두면, 방문자가 이후 언어 토글로
    // 직접 다른 언어를 골라도 새로고침하는 순간 주소창에 남아있는 이 값이 다시 강제로
    // 적용되면서 "내가 방금 고른 언어가 마음대로 바뀌는" 것처럼 보이는 문제가 있었음
    params.delete('lang');
    const newSearch = params.toString();
    history.replaceState(null, '', location.pathname + (newSearch ? '?' + newSearch : '') + location.hash);
  }
});
setInterval(() => { fetchLiveExchangeRate(); }, 60 * 60 * 1000); // 1시간마다 환율 자동 재조회 — 유저가 직접 수정한 경우는 fetchLiveExchangeRate 내부에서 자동으로 건너뜀
setInterval(updateDrawCountdown, 60 * 1000); // 추첨 당일엔 "오늘 N시간 후"처럼 시간 단위로 보여주므로, 방문 중에도 값이 그대로 멈춰있지 않도록 1분마다 갱신

// Pretendard 웹폰트는 렌더링 차단 없이 비동기로 로드되는데(느린 CDN 대비), 그 말은 즉
// fitAmountFontSize()가 실행되는 시점엔 아직 대체 폰트(시스템 폰트) 기준으로 폭이 계산될 수 있다는 뜻.
// 이후 실제로 Pretendard가 로드되면서 글자 폭이 달라지면(대체 폰트보다 넓으면), 이미 계산해둔
// 크기로는 다시 넘칠 수 있는데 이걸 감지해서 재계산하는 로직이 없었음 — 그래서 폰트 로딩이
// "완료된" 시점(document.fonts.ready)에 한 번 더 안전하게 재계산함
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    const homeFinalEl = document.getElementById('home-final-amt');
    if (homeFinalEl && homeFinalEl.textContent && homeFinalEl.textContent !== '-') fitAmountFontSize(homeFinalEl);
    // 'finalAmt'는 국가비교 화면 리디자인 이후 더 이상 쓰이지 않는 죽은 id라 여기서 빼고,
    // 실제로 화면에 그려지는 .side-card-amt(나라별 카드에 동적으로 생성됨) 전체를 재계산 대상으로 함
    document.querySelectorAll('.side-card-amt').forEach(el => {
      if (el.textContent && el.textContent !== '-') fitAmountFontSize(el);
    });
  });
}
let _resizeDebounceTimer = null;
window.addEventListener('resize', () => {
  // resize는 창을 드래그하는 동안 초당 수십 번 발생할 수 있어서, 매번 재계산하면
  // 저사양 기기·모바일 사파리에서 버벅임(프레임 드랍)을 유발할 수 있음.
  // 창 크기 조절이 "멈춘 뒤" 0.2초 후 딱 한 번만 재계산하도록 디바운스 적용
  clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      fitAmountFontSize(document.getElementById('home-final-amt'));
      // auto-fit 그리드는 창 너비에 따라 열 수가 바뀌므로, 리사이즈 후에도 마지막 줄
      // 혼자 남은 카드가 있는지 다시 판단해야 함
      fixSideCardOrphanRow();
    });
  }, 200);
});

// fitAmountFontSize()의 예전 구현은 "1px씩 줄이고 scrollWidth 다시 읽기"를 최대 30번 반복했는데,
// scrollWidth를 읽을 때마다 브라우저가 강제로 레이아웃을 다시 계산해야 해서(강제 리플로우) 최악의
// 경우 호출 한 번에 리플로우가 30번 발생했음. 폰트 로딩이 끝나는 시점에 비교 탭의 카드(.side-card-amt)
// 전부에 대해 한꺼번에 이 함수가 돌면(아래 document.fonts.ready 핸들러), 카드가 8~20개만 있어도
// 리플로우가 수백 번 몰려서 그 순간 화면이 눈에 띄게 멈칫하는 원인이 됨 — 캔버스로 텍스트 폭을
// 재는 방식은 레이아웃을 건드리지 않아서(강제 리플로우 없음) 같은 계산을 사실상 공짜로 함
let _measureCanvasCtx = null;
function fitAmountFontSize(el){
  if (!el) return;
  const container = el.parentElement;
  if (!container) return;
  el.style.fontSize = ''; // CSS clamp 기본값으로 리셋
  const computed = getComputedStyle(el);
  const fontSize = parseFloat(computed.fontSize);
  const minFontSize = 20; // 아무리 길어도 이 밑으로는 안 줄임 (그 이하는 가독성 문제)
  const safetyMargin = 22; // 기기별 폰트 렌더링(서브픽셀 anti-aliasing, 폰트 로딩 전/후 폭 차이 등) 오차를 감안한 여유폭.
  // 이전엔 14px였는데, 딱 안 넘치는 수준이라 "билл" 등 긴 단위가 붙으면 폭을 꽉 채워 답답해 보인다는
  // 피드백이 있어서 시각적 여유를 더 확보하도록 확대함
  const availableWidth = container.clientWidth - safetyMargin; // 읽기 1회(불가피한 리플로우 1회)
  if (!_measureCanvasCtx) _measureCanvasCtx = document.createElement('canvas').getContext('2d');
  _measureCanvasCtx.font = `${computed.fontWeight} ${fontSize}px ${computed.fontFamily}`;
  const textWidth = _measureCanvasCtx.measureText(el.textContent).width;
  if (textWidth > availableWidth) {
    const scaled = Math.floor(fontSize * (availableWidth / textWidth));
    el.style.fontSize = Math.max(minFontSize, scaled) + 'px'; // 쓰기 1회(불가피한 리플로우 1회)
  }
}

const _activeAnimations = new WeakMap(); // 엘리먼트별 진행 중인 애니메이션 프레임 추적 (빠른 연속 입력 시 중첩 실행 방지)

function animateValueChange(el, fromVal, toVal, suffix, decimals, duration, onDone){
  duration = duration || 250;
  // 이 엘리먼트에서 이미 돌고 있는 애니메이션이 있으면 취소하고 새로 시작
  const prevFrameId = _activeAnimations.get(el);
  if (prevFrameId) cancelAnimationFrame(prevFrameId);

  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    const value = fromVal + (toVal - fromVal) * eased;
    // formatWon()이 현재 언어(currentLang)에 맞춰 "억원" 또는 million/billion/trillion(₩) 표기를
    // 알아서 골라주므로, 여기서 suffix를 직접 붙이지 않고 항상 formatWon을 거치게 함.
    // (예전엔 이 함수가 '억원'을 하드코딩해서 직접 붙이고 있어서, 영어 모드로 전환해도
    // 애니메이션되는 숫자만 "6,107.8억원"처럼 한국어 단위가 그대로 남아있던 버그가 있었음)
    el.textContent = formatWon(value);
    el.dataset.eokVal = value; // 다음 애니메이션의 시작값을 이 값에서 읽음(아래 설명 참고)
    if (progress >= 1) {
      _activeAnimations.delete(el);
      // 애니메이션이 "진짜로" 끝난 이 시점에만 폰트 크기 재계산을 실행함.
      // 예전엔 setTimeout(고정 시간)으로 따로 타이밍을 맞췄는데, 모바일에서 애니메이션(rAF)이
      // 화면 초기 로딩 부하 등으로 늦게 끝나면 setTimeout이 먼저 발동해서 아직 다 안 늘어난
      // 중간 숫자 기준으로 폰트를 계산해버리는 경합(race condition) 버그가 있었음 —
      // 그래서 최종 숫자("7,654.9억원" 같은 긴 값)가 카드 밖으로 삐져나오는 문제가 있었음.
      if (onDone) onDone();
    } else {
      const id = requestAnimationFrame(frame);
      _activeAnimations.set(el, id);
    }
  }
  const id = requestAnimationFrame(frame);
  _activeAnimations.set(el, id);
}

const MAX_INPUT_MILLIONS = 1000000; // $1조 달러 — 역대 최고 잭팟(약 20억 달러)의 500배 수준으로 이미 비현실적인 상한.
// 이 상한이 없으면 자릿수가 극단적으로 큰 입력(예: 30자리 숫자)이 들어왔을 때, 결과 숫자가 애니메이션으로
// 올라가는 도중 극단적으로 큰 이전 값과 정상 범위의 새 값 사이의 부동소수점 연산(a + (b-a)*progress)에서
// 자릿수 차이가 너무 커 오차가 발생해, 이후 정상적인 금액을 입력해도 결과가 "0"에 멈춰버리는 문제가 있었음

function parseMillionsInput(str){
  // 소수점이 두 개 이상(예: "100.5.5") 들어오면, 뒤에 오는 숫자를 이어붙이지 않고 무시함.
  // "100.5.5"는 "100.5"를 치려다 마침표를 실수로 한 번 더 누른 경우일 가능성이 높아서,
  // 이걸 "100.55"로 이어붙여 해석하면 유저가 의도하지 않은 값이 될 수 있음
  const parts = str.replace(/[^0-9.]/g, '').split('.');
  const sanitized = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
  const n = Number(sanitized);
  if (isNaN(n)) return 0;
  return Math.min(n, MAX_INPUT_MILLIONS);
}

function parseRateInput(str){
  // 소수점을 지우면 "1,382.5" 같은 입력이 13825로 10배 뻥튀기되는 버그가 있었음(콤마와 마침표를
  // 구분 없이 한꺼번에 지워버렸기 때문) — parseMillionsInput과 동일하게 마침표는 보존하도록 수정
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const sanitized = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
  const n = Number(sanitized);
  // 원/달러 환율은 현대사에서 대체로 700~2000원 사이였음 — 이 범위를 크게 벗어나면
  // 입력 실수(자릿수 오타 등)일 가능성이 높아 직전 값을 그대로 유지함
  return isNaN(n) || n < 500 || n > 3000 ? EXCHANGE_RATE : n;
}

// 연금 발표액 입력 / 일시불 직접 입력 / 원하는 실수령액 역산 — 원래 3군데 흩어져 있어서
// 지저분하다는 지적을 받고, 하나의 탭 그룹으로 합침. 각 패널의 기존 로직(onHomeAmountTyped 등)은
// 그대로 두고 보이는 패널만 전환함
function switchAmountTab(tab){
  document.querySelectorAll('.amount-tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.getElementById('amountTabLump').style.display = tab === 'lump' ? 'block' : 'none';
  document.getElementById('amountTabAnnounced').style.display = tab === 'announced' ? 'block' : 'none';
  document.getElementById('amountTabReverse').style.display = tab === 'reverse' ? 'block' : 'none';
}

function hideAnnouncedConvertNote(){
  const note = document.getElementById('home-announced-convert-note');
  if (note) note.style.display = 'none';
}

function onHomeAmountTyped(){
  hideAnnouncedConvertNote(); // 일시불 칸을 직접 고치면 더는 연금 환산값과 일치한다고 보장 못하므로 안내 숨김
  const rawValue = document.getElementById('homeAmountInput').value;
  if (rawValue.trim() !== '') isAmountManuallyEdited = true;
  const millions = parseMillionsInput(rawValue);
  const slider = document.getElementById('homeAmountSlider');
  slider.max = Math.max(2000, millions); // 기본 상한(2000=$2B)을 넘는 값을 입력하면 슬라이더 상한도 같이 늘려서 롤백 방지
  slider.step = 1; // 타이핑한 정밀값(예: 153)이 슬라이더를 살짝 건드릴 때 10단위로 스냅되지 않도록 임시로 완화
  slider.min = Math.min(10, Math.round(millions)); // $10M 미만 입력 시 슬라이더 하한도 같이 낮춰 불일치 방지
  slider.value = Math.round(millions);
  // rawValue가 진짜 비어있을 때만 "값 없음"(undefined -> 마지막 유효값 유지)으로 처리하고,
  // "0"을 직접 입력한 경우는 millions===0이어도 유효한 입력으로 인정해서 그대로 반영함
  // (예전엔 millions>0으로만 판단해서 "0"을 입력해도 무시되고 이전 값에 멈춰있던 문제가 있었음)
  updateHomeCalc(rawValue.trim() === '' ? undefined : millions * 1000000);
}

// "일시불이 발표액의 몇 %인지" 감으로 어림잡아야 하는 진입장벽을 없애기 위한 보조 입력칸 —
// 발표된 연금 총액만 입력하면 CASH_VALUE_RATIO(58%, 퀵필 버튼과 동일 기준)를 곱해
// 아래 실제 계산용 입력칸(homeAmountInput)에 자동으로 채워줌. 계산 로직 자체는 그대로 재사용.
function onHomeAnnouncedTyped(){
  const rawValue = document.getElementById('homeAnnouncedInput').value;
  if (rawValue.trim() === '') return;
  const announcedMillions = parseMillionsInput(rawValue);
  if (isNaN(announcedMillions) || announcedMillions <= 0) return;
  isAmountManuallyEdited = true;
  const lumpMillions = Math.max(1, Math.round(announcedMillions * CASH_VALUE_RATIO));
  const input = document.getElementById('homeAmountInput');
  input.value = lumpMillions;
  const slider = document.getElementById('homeAmountSlider');
  slider.max = Math.max(2000, lumpMillions);
  slider.step = 1;
  slider.min = Math.min(10, lumpMillions);
  slider.value = lumpMillions;
  updateHomeCalc(lumpMillions * 1000000);

  const wrap = input.closest('.million-input-wrap');
  if (wrap) {
    wrap.classList.remove('field-autofill-flash');
    void wrap.offsetWidth; // 애니메이션 재시작(연속 타이핑 시에도 매번 반짝이도록 강제 리플로우)
    wrap.classList.add('field-autofill-flash');
  }

  // 연금 발표액을 입력했는데 결과엔 "일시불"이라고만 나오면 왜 다른 숫자인지 헷갈릴 수 있어서
  // (사용자가 직접 지적) 결과 위쪽에 "연금 X → 일시불 환산 Y" 환산 과정을 짧게 보여줌
  const note = document.getElementById('home-announced-convert-note');
  if (note) {
    note.textContent = pickLang(
      `연금 발표 $${announcedMillions}M → 일시불 환산 $${lumpMillions}M 기준`,
      `Announced (annuity) $${announcedMillions}M → converted to lump sum $${lumpMillions}M`,
      `年金公布 $${announcedMillions}M → 换算为一次性支付 $${lumpMillions}M`,
      `Công bố (trả góp) $${announcedMillions}M → quy đổi sang nhận một lần $${lumpMillions}M`,
      `ประกาศ (รายปี) $${announcedMillions}M → แปลงเป็นเงินก้อน $${lumpMillions}M`,
      `Объявлено (рента) $${announcedMillions}M → пересчитано в единовременную выплату $${lumpMillions}M`,
      {
        km: `ប្រកាស (ប្រាក់រំលឹក) $${announcedMillions}M → បម្លែងទៅជាដុំតែម្តង $${lumpMillions}M`,
        ne: `घोषित (वार्षिकी) $${announcedMillions}M → एकमुष्टमा रूपान्तरण $${lumpMillions}M`,
        id: `Diumumkan (anuitas) $${announcedMillions}M → dikonversi ke sekaligus $${lumpMillions}M`,
        my: `ကြေညာ (annuity) $${announcedMillions}M → တစ်ကြိမ်တည်းသို့ ပြောင်းလဲ $${lumpMillions}M`,
        si: `ප්‍රකාශිත (annuity) $${announcedMillions}M → එකවර ගෙවීමට පරිවර්තනය $${lumpMillions}M`,
        uz: `E'lon qilingan (annuitet) $${announcedMillions}M → bir martalik to'lovga aylantirildi $${lumpMillions}M`,
        mn: `Зарлагдсан (жилийн төлбөр) $${announcedMillions}M → нэг удаагийн төлбөр рүү хөрвүүлсэн $${lumpMillions}M`,
        kk: `Жарияланған (аннуитет) $${announcedMillions}M → бір реттік төлемге ауыстырылды $${lumpMillions}M`,
        ky: `Жарыяланган (аннуитет) $${announcedMillions}M → бир жолку төлөмгө айландырылды $${lumpMillions}M`,
        ur: `اعلان کردہ (سالانہ اقساط) $${announcedMillions}M → یکمشت میں تبدیل $${lumpMillions}M`,
        bn: `ঘোষিত (বার্ষিক কিস্তি) $${announcedMillions}M → একবারে প্রদানে রূপান্তরিত $${lumpMillions}M`,
        lo: `ປະກາດ (ລາຍປີ) $${announcedMillions}M → ແປງເປັນຈ່າຍເທື່ອດຽວ $${lumpMillions}M`,
        ja: `発表額（年金）$${announcedMillions}M → 一括受取に換算 $${lumpMillions}M`,
        ar: `المعلن (سنوي) $${announcedMillions}M ← يُحوَّل إلى دفعة واحدة $${lumpMillions}M`,
        hi: `घोषित (वार्षिकी) $${announcedMillions}M → एकमुश्त में परिवर्तित $${lumpMillions}M`,
        fr: `Annoncé (rente) $${announcedMillions}M → converti en versement unique $${lumpMillions}M`,
        tl: `Inanunsyo (annuity) $${announcedMillions}M → na-convert sa lump sum $${lumpMillions}M`,
      }
    );
    note.style.display = 'block';
  }
}

// -webkit-appearance:none으로 네이티브 트랙을 지운 뒤라 Chrome/Safari는 진행 정도를 색으로
// 보여줄 pseudo-element(::-webkit-slider-progress)가 없음 — 그래서 값이 바뀔 때마다 여기서
// 직접 "지나온 구간만 --teal, 남은 구간은 --border"인 그라데이션을 계산해 발라줌
// (Firefox는 ::-moz-range-progress로 CSS만으로 처리되니 이 함수와 무관)
function updateSliderFill(slider){
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const pct = max > min ? ((Number(slider.value) - min) / (max - min)) * 100 : 0;
  slider.style.background = `linear-gradient(to right, var(--teal) ${pct}%, var(--border) ${pct}%)`;
}

let _prevSliderUsdM = null; // 5억 달러 문턱 통과 감지용 (진동 피드백이 방향 전환마다 한 번만 울리게)
function onHomeSliderMoved(){
  hideAnnouncedConvertNote();
  isAmountManuallyEdited = true;
  const slider = document.getElementById('homeAmountSlider');
  slider.step = 10; // 유저가 슬라이더를 직접 조작하면 원래대로 10단위 스냅 복원
  const usdMillions = Number(slider.value);
  document.getElementById('homeAmountInput').value = usdMillions;
  updateHomeCalc(usdMillions * 1000000);

  // 5억 달러 문턱을 넘나들 때 짧게 진동 (안드로이드 Chrome 등만 지원, 미지원 브라우저는 조용히 무시됨)
  if (_prevSliderUsdM !== null && navigator.vibrate) {
    const crossedThreshold = (_prevSliderUsdM < 500 && usdMillions >= 500) || (_prevSliderUsdM >= 500 && usdMillions < 500);
    if (crossedThreshold) navigator.vibrate(12);
  }
  _prevSliderUsdM = usdMillions;
}

function onHomeRateChanged(){
  isRateManuallyEdited = true;
  exchangeRateIsLive = false; // 수동으로 값을 고쳤으니 더 이상 "실시간 환율"이 아님
  exchangeRateFetchFailed = false;
  EXCHANGE_RATE = parseRateInput(document.getElementById('home-rate-input').value);
  updateExchangeRateBadges();
  updateHomeCalc();
  initJackpotCardAmt();
  refreshJackpotDrawerIfOpen();
}

// 요약줄에 "이 돈"처럼 추상적인 표현 대신 실제 금액을 직접 넣어서, 위쪽에 함께 보이는
// 발표 금액과 헷갈리지 않고 바로 어떤 액수 얘기인지 알 수 있게 함
function updateFunSummary(finalEok){
  const el = document.getElementById('fun-summary');
  if (!el) return;
  const amt = formatWon(finalEok);
  el.textContent = pickLang(
    `🤑 ${amt}이면 얼마나 살 수 있을까요? (재미로 보기)`,
    `🤑 What could ${amt} buy? (just for fun)`,
    `🤑 ${amt}能买到什么？（纯属娱乐）`,
    `🤑 ${amt} có thể mua được gì? (chỉ để vui thôi)`,
    `🤑 ${amt} ซื้ออะไรได้บ้าง? (แค่สนุกๆ)`,
    `🤑 Что можно купить на ${amt}? (просто для развлечения)`,
    {
      km: `🤑 ${amt} អាចទិញអ្វីបាន? (គ្រាន់តែសម្រាប់កម្សាន្ត)`,
      ne: `🤑 ${amt} ले के किन्न सकिन्छ? (केवल रमाइलोको लागि)`,
      id: `🤑 Apa yang bisa dibeli dengan ${amt}? (hanya untuk hiburan)`,
      my: `🤑 ${amt} နဲ့ ဘာဝယ်လို့ရမလဲ? (ဖျော်ဖြေရေးအတွက်သာ)`,
      si: `🤑 ${amt} වලින් මොනවා මිලදී ගත හැකිද? (විනෝදය සඳහා පමණි)`,
      uz: `🤑 ${amt} bilan nima sotib olish mumkin? (faqat qiziqarli mashg'ulot uchun)`,
      mn: `🤑 ${amt}-р юу худалдаж авах боломжтой вэ? (зөвхөн зугаа цэнгэлийн зорилготой)`,
      kk: `🤑 ${amt}-ға не сатып алуға болады? (тек ойын-сауық үшін)`,
      ky: `🤑 ${amt} менен эмне сатып алууга болот? (жөн гана көңүл ачуу үчүн)`,
      ur: `🤑 ${amt} سے کیا خریدا جا سکتا ہے؟ (صرف تفریح کے لیے)`,
      bn: `🤑 ${amt} দিয়ে কী কেনা যায়? (শুধু মজার জন্য)`,
      lo: `🤑 ${amt} ສາມາດຊື້ຫຍັງໄດ້? (ເພື່ອຄວາມມ່ວນເທົ່ານັ້ນ)`,
      ja: `🤑 ${amt}で何が買える？ (あくまで娯楽目的です)`,
      ar: `🤑 ماذا يمكن شراؤه بمبلغ ${amt}؟ (للتسلية فقط)`,
      hi: `🤑 ${amt} से क्या खरीदा जा सकता है? (केवल मनोरंजन के लिए)`,
      fr: `🤑 Qu'est-ce qu'on pourrait acheter avec ${amt}? (juste pour le plaisir)`,
      tl: `🤑 Ano ang mabibili ng ${amt}? (para lang sa saya)`
    }
  );
}

// 재미로 보는 "이 돈이면 뭘 살 수 있나" 비교 대상 — 표시 언어가 아니라 실제 세금 계산 기준(country)에
// 맞춰야 함(예: 중국 기준으로 계산했는데 한국 강남 아파트/원화 가격이 나오면 앞뒤가 안 맞음).
// 가격은 참고용 대략치이며 출처: 페라리 로마 — 한국 공식가 약 3.5억원, 미국 MSRP 약 $275,000,
// 중국 공식가 약 RMB 276만(수입세 포함 실제 거래가는 더 높음); 스타벅스 아메리카노 — 한국 5,000원,
// 미국 평균 약 $3.75, 중국 30위안(2026년 기준 동결); 아파트는 각 나라에서 "부의 상징"으로 통하는
// 기준을 사용 — 강남 25억원, 맨해튼 $1.5M, 상하이 고급 아파트 3,000만 위안.
const FLEX_REF = {
  kr: {
    apt:    { currency: 'krw', price: 2500000000, label: () => pickLang('강남 아파트 (25억 기준)', 'Gangnam apartment (based on ₩2.5B)', '江南公寓（按25亿韩元计算）', 'Căn hộ Gangnam (dựa trên ₩2,5 tỷ)', 'อพาร์ตเมนต์กังนัม (อิงจาก ₩2.5 พันล้าน)', 'Квартира в Каннаме (по ₩2,5 млрд)', { km:'Gangnam apartment (ផ្អែកលើ ₩2.5 ប៊ីលាន)', ne:'Gangnam apartment (₩2.5 अर्बको आधारमा)', id:'Gangnam apartment (berdasarkan ₩2,5 Miliar)', my:'Gangnam apartment (₩2.5 ဘီလီယံ ကို အခြေခံ၍)', si:'Gangnam apartment (₩2.5 බිලියන මත පදනම්ව)', uz:'Gangnam apartment (₩2,5 milliard asosida)', mn:'Gangnam apartment (₩2.5 тэрбум дээр үндэслэсэн)', kk:'Gangnam apartment (₩2,5 миллиард негізінде)', ky:'Gangnam apartment (₩2,5 миллиард негизинде)', ur:'Gangnam apartment (₩2.5 ارب کی بنیاد پر)', bn:'Gangnam apartment (₩2.5 বিলিয়ন এর ভিত্তিতে)', lo:'Gangnam apartment (ອີງໃສ່ ₩2.5 ຕື້)', ja:'Gangnam apartment (25億ウォン基準)', ar:'Gangnam apartment (بناءً على ₩2.5 مليار)', hi:'Gangnam apartment (₩2.5 अरब के आधार पर)', fr:'Gangnam apartment (sur la base de ₩2,5 milliards)', tl:'Gangnam apartment (batay sa ₩2.5B)' }) },
    car:    { currency: 'krw', price: 350000000,  label: () => pickLang('페라리 로마 (3.5억원 기준)', 'Ferrari Roma (based on ₩350M)', '法拉利Roma（按3.5亿韩元计算）', 'Ferrari Roma (dựa trên ₩350 triệu)', 'เฟอร์รารี โรม่า (อิงจาก ₩350 ล้าน)', 'Ferrari Roma (по ₩350 млн)', { km:'Ferrari Roma (ផ្អែកលើ ₩350 លាន)', ne:'Ferrari Roma (₩350 मिलियनको आधारमा)', id:'Ferrari Roma (berdasarkan ₩350 Juta)', my:'Ferrari Roma (₩350 သန်း ကို အခြေခံ၍)', si:'Ferrari Roma (₩350 මිලියන මත පදනම්ව)', uz:'Ferrari Roma (₩350 million asosida)', mn:'Ferrari Roma (₩350 сая дээр үндэслэсэн)', kk:'Ferrari Roma (₩350 миллион негізінде)', ky:'Ferrari Roma (₩350 миллион негизинде)', ur:'Ferrari Roma (₩350 ملین کی بنیاد پر)', bn:'Ferrari Roma (₩350 মিলিয়ন এর ভিত্তিতে)', lo:'Ferrari Roma (ອີງໃສ່ ₩350 ລ້ານ)', ja:'Ferrari Roma (3.5億ウォン基準)', ar:'Ferrari Roma (بناءً على ₩350 مليون)', hi:'Ferrari Roma (₩350 मिलियन के आधार पर)', fr:'Ferrari Roma (sur la base de ₩350 millions)', tl:'Ferrari Roma (batay sa ₩350M)' }) },
    coffee: { currency: 'krw', price: 5000,        label: () => pickLang('스타벅스 아메리카노 (5천원)', 'Starbucks Americano (₩5,000)', '星巴克美式咖啡（5,000韩元）', 'Starbucks Americano (₩5.000)', 'สตาร์บัคส์ อเมริกาโน่ (₩5,000)', 'Starbucks Americano (₩5 000)', { km:'Starbucks Americano (₩5,000)', ne:'Starbucks Americano (₩5,000)', id:'Starbucks Americano (₩5,000)', my:'Starbucks Americano (₩5,000)', si:'Starbucks Americano (₩5,000)', uz:'Starbucks Americano (₩5,000)', mn:'Starbucks Americano (₩5,000)', kk:'Starbucks Americano (₩5,000)', ky:'Starbucks Americano (₩5,000)', ur:'Starbucks Americano (₩5,000)', bn:'Starbucks Americano (₩5,000)', lo:'Starbucks Americano (₩5,000)', ja:'Starbucks Americano (₩5,000)', ar:'Starbucks Americano (₩5,000)', hi:'Starbucks Americano (₩5,000)', fr:'Starbucks Americano (₩5,000)', tl:'Starbucks Americano (₩5,000)' }) }
  },
  us: {
    apt:    { currency: 'usd', price: 1500000, label: () => pickLang('맨해튼 아파트 (150만 달러 기준)', 'Manhattan apartment (based on $1.5M)', '曼哈顿公寓（按150万美元计算）', 'Căn hộ Manhattan (dựa trên $1,5 triệu)', 'อพาร์ตเมนต์แมนฮัตตัน (อิงจาก $1.5 ล้าน)', 'Квартира на Манхэттене (по $1,5 млн)', { km:'Manhattan apartment (ផ្អែកលើ $1.5 លាន)', ne:'Manhattan apartment ($1.5 मिलियनको आधारमा)', id:'Manhattan apartment (berdasarkan $1,5 Juta)', my:'Manhattan apartment ($1.5 သန်း ကို အခြေခံ၍)', si:'Manhattan apartment ($1.5 මිලියන මත පදනම්ව)', uz:'Manhattan apartment ($1,5 million asosida)', mn:'Manhattan apartment ($1.5 сая дээр үндэслэсэн)', kk:'Manhattan apartment ($1,5 миллион негізінде)', ky:'Manhattan apartment ($1,5 миллион негизинде)', ur:'Manhattan apartment ($1.5 ملین کی بنیاد پر)', bn:'Manhattan apartment ($1.5 মিলিয়ন এর ভিত্তিতে)', lo:'Manhattan apartment (ອີງໃສ່ $1.5 ລ້ານ)', ja:'Manhattan apartment (150万ドル基準)', ar:'Manhattan apartment (بناءً على $1.5 مليون)', hi:'Manhattan apartment ($1.5 मिलियन के आधार पर)', fr:'Manhattan apartment (sur la base de 1,5 million $)', tl:'Manhattan apartment (batay sa $1.5M)' }) },
    car:    { currency: 'usd', price: 275000,  label: () => pickLang('페라리 로마 (27.5만 달러 기준)', 'Ferrari Roma (based on $275,000)', '法拉利Roma（按27.5万美元计算）', 'Ferrari Roma (dựa trên $275.000)', 'เฟอร์รารี โรม่า (อิงจาก $275,000)', 'Ferrari Roma (по $275 000)', { km:'Ferrari Roma (ផ្អែកលើ $275,000)', ne:'Ferrari Roma ($275,000को आधारमा)', id:'Ferrari Roma (berdasarkan $275.000)', my:'Ferrari Roma ($275,000 ကို အခြေခံ၍)', si:'Ferrari Roma ($275,000 මත පදනම්ව)', uz:'Ferrari Roma ($275 000 asosida)', mn:'Ferrari Roma ($275,000 дээр үндэслэсэн)', kk:'Ferrari Roma ($275 000 негізінде)', ky:'Ferrari Roma ($275 000 негизинде)', ur:'Ferrari Roma ($275,000 کی بنیاد پر)', bn:'Ferrari Roma ($275,000 এর ভিত্তিতে)', lo:'Ferrari Roma (ອີງໃສ່ $275,000)', ja:'Ferrari Roma (27.5万ドル基準)', ar:'Ferrari Roma (بناءً على $275,000)', hi:'Ferrari Roma ($275,000 के आधार पर)', fr:'Ferrari Roma (sur la base de 275 000 $)', tl:'Ferrari Roma (batay sa $275,000)' }) },
    coffee: { currency: 'usd', price: 3.75,    label: () => pickLang('스타벅스 아메리카노 (3.75달러)', 'Starbucks Americano ($3.75)', '星巴克美式咖啡（3.75美元）', 'Starbucks Americano ($3,75)', 'สตาร์บัคส์ อเมริกาโน่ ($3.75)', 'Starbucks Americano ($3,75)', { km:'Starbucks Americano ($3.75)', ne:'Starbucks Americano ($3.75)', id:'Starbucks Americano ($3.75)', my:'Starbucks Americano ($3.75)', si:'Starbucks Americano ($3.75)', uz:'Starbucks Americano ($3.75)', mn:'Starbucks Americano ($3.75)', kk:'Starbucks Americano ($3.75)', ky:'Starbucks Americano ($3.75)', ur:'Starbucks Americano ($3.75)', bn:'Starbucks Americano ($3.75)', lo:'Starbucks Americano ($3.75)', ja:'Starbucks Americano ($3.75)', ar:'Starbucks Americano ($3.75)', hi:'Starbucks Americano ($3.75)', fr:'Starbucks Americano ($3.75)', tl:'Starbucks Americano ($3.75)' }) }
  },
  cn: {
    apt:    { currency: 'cny', price: 30000000, label: () => pickLang('상하이 고급 아파트 (3천만 위안 기준)', 'Shanghai luxury apartment (based on ¥30M)', '上海高档公寓（按3000万元计算）', 'Căn hộ cao cấp Thượng Hải (dựa trên ¥30 triệu)', 'อพาร์ตเมนต์หรูเซี่ยงไฮ้ (อิงจาก ¥30 ล้าน)', 'Элитная квартира в Шанхае (по ¥30 млн)', { km:'Shanghai luxury apartment (ផ្អែកលើ ¥30 លាន)', ne:'Shanghai luxury apartment (¥30 मिलियनको आधारमा)', id:'Shanghai luxury apartment (berdasarkan ¥30 Juta)', my:'Shanghai luxury apartment (¥30 သန်း ကို အခြေခံ၍)', si:'Shanghai luxury apartment (¥30 මිලියන මත පදනම්ව)', uz:'Shanghai luxury apartment (¥30 million asosida)', mn:'Shanghai luxury apartment (¥30 сая дээр үндэслэсэн)', kk:'Shanghai luxury apartment (¥30 миллион негізінде)', ky:'Shanghai luxury apartment (¥30 миллион негизинде)', ur:'Shanghai luxury apartment (¥30 ملین کی بنیاد پر)', bn:'Shanghai luxury apartment (¥30 মিলিয়ন এর ভিত্তিতে)', lo:'Shanghai luxury apartment (ອີງໃສ່ ¥30 ລ້ານ)', ja:'Shanghai luxury apartment (3,000万元基準)', ar:'Shanghai luxury apartment (بناءً على ¥30 مليون)', hi:'Shanghai luxury apartment (¥30 मिलियन के आधार पर)', fr:'Shanghai luxury apartment (sur la base de 30 millions ¥)', tl:'Shanghai luxury apartment (batay sa ¥30M)' }) },
    car:    { currency: 'cny', price: 2760000,  label: () => pickLang('페라리 로마 (276만 위안 기준)', 'Ferrari Roma (based on ¥2.76M)', '法拉利Roma（按276万元计算）', 'Ferrari Roma (dựa trên ¥2,76 triệu)', 'เฟอร์รารี โรม่า (อิงจาก ¥2.76 ล้าน)', 'Ferrari Roma (по ¥2,76 млн)', { km:'Ferrari Roma (ផ្អែកលើ ¥2.76 លាន)', ne:'Ferrari Roma (¥2.76 मिलियनको आधारमा)', id:'Ferrari Roma (berdasarkan ¥2,76 Juta)', my:'Ferrari Roma (¥2.76 သန်း ကို အခြေခံ၍)', si:'Ferrari Roma (¥2.76 මිලියන මත පදනම්ව)', uz:'Ferrari Roma (¥2,76 million asosida)', mn:'Ferrari Roma (¥2.76 сая дээр үндэслэсэн)', kk:'Ferrari Roma (¥2,76 миллион негізінде)', ky:'Ferrari Roma (¥2,76 миллион негизинде)', ur:'Ferrari Roma (¥2.76 ملین کی بنیاد پر)', bn:'Ferrari Roma (¥2.76 মিলিয়ন এর ভিত্তিতে)', lo:'Ferrari Roma (ອີງໃສ່ ¥2.76 ລ້ານ)', ja:'Ferrari Roma (276万元基準)', ar:'Ferrari Roma (بناءً على ¥2.76 مليون)', hi:'Ferrari Roma (¥2.76 मिलियन के आधार पर)', fr:'Ferrari Roma (sur la base de 2,76 millions ¥)', tl:'Ferrari Roma (batay sa ¥2.76M)' }) },
    coffee: { currency: 'cny', price: 30,       label: () => pickLang('스타벅스 아메리카노 (30위안)', 'Starbucks Americano (¥30)', '星巴克美式咖啡（30元）', 'Starbucks Americano (¥30)', 'สตาร์บัคส์ อเมริกาโน่ (¥30)', 'Starbucks Americano (¥30)', { km:'Starbucks Americano (¥30)', ne:'Starbucks Americano (¥30)', id:'Starbucks Americano (¥30)', my:'Starbucks Americano (¥30)', si:'Starbucks Americano (¥30)', uz:'Starbucks Americano (¥30)', mn:'Starbucks Americano (¥30)', kk:'Starbucks Americano (¥30)', ky:'Starbucks Americano (¥30)', ur:'Starbucks Americano (¥30)', bn:'Starbucks Americano (¥30)', lo:'Starbucks Americano (¥30)', ja:'Starbucks Americano (¥30)', ar:'Starbucks Americano (¥30)', hi:'Starbucks Americano (¥30)', fr:'Starbucks Americano (¥30)', tl:'Starbucks Americano (¥30)' }) }
  },
  // 인도는 수입차에 100%가 넘는 관세가 붙어서 페라리 로마 실거래가가 미국 정가의 두 배 이상임 —
  // 아래 가격은 참고용 대략치(위 kr/us/cn과 동일하게 정확한 출처 표기 없는 재미 콘텐츠)
  in: {
    apt:    { currency: 'inr', price: 200000000, label: () => pickLang('뭄바이 고급 아파트 (2억 루피 기준)', 'Mumbai luxury apartment (based on ₹20 crore)', '孟买豪华公寓（按2亿卢比计算）', 'Căn hộ cao cấp Mumbai (dựa trên ₹20 crore)', 'อพาร์ตเมนต์หรูมุมไบ (อิงจาก ₹20 โครร์)', 'Элитная квартира в Мумбаи (по ₹20 крор)', { km:'Mumbai luxury apartment (ផ្អែកលើ ₹200 លាន)', ne:'Mumbai luxury apartment (₹20 करोडको आधारमा)', id:'Mumbai luxury apartment (berdasarkan ₹200 Juta)', my:'Mumbai luxury apartment (₹200 သန်း ကို အခြေခံ၍)', si:'Mumbai luxury apartment (₹200 මිලියන මත පදනම්ව)', uz:'Mumbai luxury apartment (₹200 million asosida)', mn:'Mumbai luxury apartment (₹200 сая дээр үндэслэсэн)', kk:'Mumbai luxury apartment (₹200 миллион негізінде)', ky:'Mumbai luxury apartment (₹200 миллион негизинде)', ur:'Mumbai luxury apartment (₹20 کروڑ کی بنیاد پر)', bn:'Mumbai luxury apartment (₹20 কোটি এর ভিত্তিতে)', lo:'Mumbai luxury apartment (ອີງໃສ່ ₹200 ລ້ານ)', ja:'Mumbai luxury apartment (2億ルピー基準)', ar:'Mumbai luxury apartment (بناءً على ₹200 مليون)', hi:'Mumbai luxury apartment (₹20 करोड़ के आधार पर)', fr:'Mumbai luxury apartment (sur la base de 200 millions ₹)', tl:'Mumbai luxury apartment (batay sa ₹20 crore)' }) },
    car:    { currency: 'inr', price: 65000000,  label: () => pickLang('페라리 로마 (6,500만 루피 기준)', 'Ferrari Roma (based on ₹6.5 crore)', '法拉利Roma（按6500万卢比计算）', 'Ferrari Roma (dựa trên ₹6,5 crore)', 'เฟอร์รารี โรม่า (อิงจาก ₹6.5 โครร์)', 'Ferrari Roma (по ₹6,5 крор)', { km:'Ferrari Roma (ផ្អែកលើ ₹65 លាន)', ne:'Ferrari Roma (₹6.5 करोडको आधारमा)', id:'Ferrari Roma (berdasarkan ₹65 Juta)', my:'Ferrari Roma (₹65 သန်း ကို အခြေခံ၍)', si:'Ferrari Roma (₹65 මිලියන මත පදනම්ව)', uz:'Ferrari Roma (₹65 million asosida)', mn:'Ferrari Roma (₹65 сая дээр үндэслэсэн)', kk:'Ferrari Roma (₹65 миллион негізінде)', ky:'Ferrari Roma (₹65 миллион негизинде)', ur:'Ferrari Roma (₹6.5 کروڑ کی بنیاد پر)', bn:'Ferrari Roma (₹6.5 কোটি এর ভিত্তিতে)', lo:'Ferrari Roma (ອີງໃສ່ ₹65 ລ້ານ)', ja:'Ferrari Roma (6,500万ルピー基準)', ar:'Ferrari Roma (بناءً على ₹65 مليون)', hi:'Ferrari Roma (₹6.5 करोड़ के आधार पर)', fr:'Ferrari Roma (sur la base de 65 millions ₹)', tl:'Ferrari Roma (batay sa ₹6.5 crore)' }) },
    coffee: { currency: 'inr', price: 300,       label: () => pickLang('스타벅스 아메리카노 (300루피)', 'Starbucks Americano (₹300)', '星巴克美式咖啡（300卢比）', 'Starbucks Americano (₹300)', 'สตาร์บัคส์ อเมริกาโน่ (₹300)', 'Starbucks Americano (₹300)', { km:'Starbucks Americano (₹300)', ne:'Starbucks Americano (₹300)', id:'Starbucks Americano (₹300)', my:'Starbucks Americano (₹300)', si:'Starbucks Americano (₹300)', uz:'Starbucks Americano (₹300)', mn:'Starbucks Americano (₹300)', kk:'Starbucks Americano (₹300)', ky:'Starbucks Americano (₹300)', ur:'Starbucks Americano (₹300)', bn:'Starbucks Americano (₹300)', lo:'Starbucks Americano (₹300)', ja:'Starbucks Americano (₹300)', ar:'Starbucks Americano (₹300)', hi:'Starbucks Americano (₹300)', fr:'Starbucks Americano (₹300)', tl:'Starbucks Americano (₹300)' }) }
  }
};

function updateFlexBox(finalEok, country){
  updateFunSummary(finalEok);
  const wonAmount = finalEok * 100000000;
  const usdAmount = wonAmount / EXCHANGE_RATE;
  const cnyAmount = usdAmount * EXCHANGE_RATE_CNY;
  const inrAmount = usdAmount * EXCHANGE_RATE_INR;
  const amountByCurrency = { krw: wonAmount, usd: usdAmount, cny: cnyAmount, inr: inrAmount };
  const ref = FLEX_REF[country] || FLEX_REF.kr;
  const localeStr = LOCALE_MAP[currentLang] || 'ko-KR';

  const apt = Math.floor(amountByCurrency[ref.apt.currency] / ref.apt.price);
  const car = Math.floor(amountByCurrency[ref.car.currency] / ref.car.price);
  const coffeeCups = Math.floor(amountByCurrency[ref.coffee.currency] / ref.coffee.price);
  const coffeeYears = Math.floor(coffeeCups / 3 / 365);

  document.getElementById('flex-apt-label').textContent = ref.apt.label();
  document.getElementById('flex-car-label').textContent = ref.car.label();
  document.getElementById('flex-coffee-label').textContent = ref.coffee.label();

  document.getElementById('flex-apt').textContent = apt.toLocaleString(localeStr) + pickLang('채', ' units', '套', ' căn', ' หลัง', ' шт.', { km:'ខ្នង', ne:'वटा', id:' unit', my:' လုံး', si:'ක්', uz:' ta', mn:' айл', kk:' пәтер', ky:' батир', ur:' یونٹس', bn:'টি', lo:' ຫຼັງ', ja:'戸', ar:' وحدة', hi:' यूनिट', fr:' logements', tl:' unit' });
  document.getElementById('flex-car').textContent = car.toLocaleString(localeStr) + pickLang('대', ' cars', '辆', ' chiếc', ' คัน', ' шт.', { km:'គ្រឿង', ne:'वटा', id:' unit', my:' စီး', si:'ක්', uz:' ta', mn:' машин', kk:' көлік', ky:' машина', ur:' گاڑیاں', bn:'টি', lo:' ຄັນ', ja:'台', ar:' سيارة', hi:' गाड़ियाँ', fr:' voitures', tl:' kotse' });
  document.getElementById('flex-coffee').textContent = coffeeYears > 0
    ? pickLang(`하루 3잔씩 ${coffeeYears.toLocaleString(localeStr)}년`, `3/day for ${coffeeYears.toLocaleString(localeStr)} years`, `每天3杯，喝${coffeeYears.toLocaleString(localeStr)}年`, `3 ly/ngày trong ${coffeeYears.toLocaleString(localeStr)} năm`, `วันละ 3 แก้ว เป็นเวลา ${coffeeYears.toLocaleString(localeStr)} ปี`, `по 3 в день в течение ${coffeeYears.toLocaleString(localeStr)} лет`, { km:`ថ្ងៃមួយ 3 ពែង អស់រយៈពេល ${coffeeYears.toLocaleString(localeStr)} ឆ្នាំ`, ne:`दिनको ३ कपका दरले ${coffeeYears.toLocaleString(localeStr)} वर्ष`, id:`3/hari selama ${coffeeYears.toLocaleString(localeStr)} tahun`, my:`တစ်နေ့ ၃ ခွက်နှုန်းဖြင့် ${coffeeYears.toLocaleString(localeStr)} နှစ်`, si:`දිනකට කෝප්ප 3 බැගින් වසර ${coffeeYears.toLocaleString(localeStr)} ක්`, uz:`kuniga 3 tadan ${coffeeYears.toLocaleString(localeStr)} yil`, mn:`өдөрт 3-аар ${coffeeYears.toLocaleString(localeStr)} жил`, kk:`күніне 3-тен ${coffeeYears.toLocaleString(localeStr)} жыл`, ky:`күнүнө 3төн ${coffeeYears.toLocaleString(localeStr)} жыл`, ur:`روزانہ 3 کپ کے حساب سے ${coffeeYears.toLocaleString(localeStr)} سال`, bn:`দিনে ৩ কাপ করে ${coffeeYears.toLocaleString(localeStr)} বছর`, lo:`ວັນລະ 3 ຈອກ ເປັນເວລາ ${coffeeYears.toLocaleString(localeStr)} ປີ`, ja:`1日3杯で${coffeeYears.toLocaleString(localeStr)}年分`, ar:`3 أكواب يومياً لمدة ${coffeeYears.toLocaleString(localeStr)} سنة`, hi:`रोज़ 3 कप के हिसाब से ${coffeeYears.toLocaleString(localeStr)} साल`, fr:`3/jour pendant ${coffeeYears.toLocaleString(localeStr)} ans`, tl:`3/araw sa loob ng ${coffeeYears.toLocaleString(localeStr)} taon` })
    : coffeeCups.toLocaleString(localeStr) + pickLang('잔', ' cups', '杯', ' ly', ' แก้ว', ' чашек', { km:'ពែង', ne:'कप', id:' cangkir', my:' ခွက်', si:'ක්', uz:' finjon', mn:' аяга', kk:' кесе', ky:' чыны', ur:' کپ', bn:'কাপ', lo:' ຈອກ', ja:'杯', ar:' كوب', hi:' कप', fr:' tasses', tl:' tasa' });
}

// FAQ "세금 가이드" 3칸 요약 카드의 2번째 칸 — "다른 나라에서도 또 내는지"는 세금 계산
// 기준(kr/us/cn)에 따라 완전히 다른 질문이라(한국은 종합소득세, 미국은 이미 federal에 다 포함,
// 중국은 우연소득세), 항상 "한국에서도 또 내요?"로 고정돼 있으면 미국·중국 기준에서는 내용이 안 맞음
const FAQ_TG2 = {
  kr: {
    title: () => pickLang('한국에서도 또 내요?', 'Do I also pay in Korea?', '在韩国也要交税吗？', 'Có phải đóng thuế ở Hàn Quốc nữa không?', 'ต้องเสียภาษีในเกาหลีด้วยไหม?', 'Нужно ли платить налог ещё и в Корее?', buildAlsoPayMore('kr')),
    sub: () => pickLang('종합소득세 <span style="white-space:nowrap">누진세율(최고 45%)</span>, <span style="white-space:nowrap">외국납부세액공제(FTC)로</span> 조정 — 참고용 계산', 'Progressive comprehensive income tax (up to 45%), adjusted by Foreign Tax Credit (FTC) — reference estimate', '综合所得税累进税率（最高45%），通过外国税收抵免（FTC）调整 — 仅供参考', 'Thuế thu nhập tổng hợp lũy tiến (tối đa 45%), điều chỉnh bằng Tín dụng thuế nước ngoài (FTC) — ước tính tham khảo', 'ภาษีเงินได้แบบก้าวหน้า (สูงสุด 45%) ปรับด้วยเครดิตภาษีต่างประเทศ (FTC) — ประมาณการอ้างอิง', 'Прогрессивный совокупный подоходный налог (до 45%), скорректированный иностранным налоговым кредитом (FTC) — справочная оценка', { km: "ពន្ធលើប្រាក់ចំណូលសរុបជាលំដាប់ (រហូតដល់ 45%) កែសម្រួលដោយឥណទានពន្ធបរទេស (FTC) — ការគណនាយោង", ne: "प्रगतिशील समग्र आयकर (अधिकतम ४५%), विदेशी कर क्रेडिट (FTC) द्वारा समायोजित — सन्दर्भ अनुमान", id: "Pajak penghasilan komprehensif progresif (hingga 45%), disesuaikan dengan Kredit Pajak Luar Negeri (FTC) — perkiraan referensi", my: "တိုးမြှင့်စနစ် ပေါင်းစည်းဝင်ငွေခွန် (အများဆုံး ၄၅%)၊ နိုင်ငံခြားအခွန်ခရက်ဒစ် (FTC) ဖြင့်ချိန်ညှိထား — ရည်ညွှန်းခန့်မှန်းချက်", si: "ප්‍රගතිශීලී සම්පූර්ණ ආදායම් බද්ද (උපරිම 45%), විදේශ බදු ණය (FTC) මගින් සකස් කර ඇත — යොමු ඇස්තමේන්තුව", uz: "Progressiv umumiy daromad solig'i (45%gacha), Xorijiy Soliq Krediti (FTC) bilan tuzatilgan — ma'lumot uchun taxminiy hisob", mn: "Даамжирсан бүх орлогын татвар (хамгийн ихдээ 45%), Гадаадын татварын хөнгөлөлт (FTC)-өөр тохируулсан — лавлагаа тооцоо", kk: "Прогрессивті жиынтық табыс салығы (ең көбі 45%), Шетелдік салық несиесімен (FTC) түзетілген — анықтамалық есеп", ky: "Прогрессивдүү жалпы киреше салыгы (эң көбү 45%), Чет өлкө салык кредити (FTC) менен туураланган — маалымдама эсеп", ur: "ترقی پذیر مجموعی انکم ٹیکس (زیادہ سے زیادہ 45%)، غیر ملکی ٹیکس کریڈٹ (FTC) سے ایڈجسٹ — حوالہ جاتی تخمینہ", bn: "প্রগতিশীল সামগ্রিক আয়কর (সর্বোচ্চ ৪৫%), বিদেশি কর ক্রেডিট (FTC) দ্বারা সমন্বিত — রেফারেন্স অনুমান", lo: "ພາສີລາຍໄດ້ລວມແບບກ້າວໜ້າ (ສູງສຸດ 45%) ປັບດ້ວຍເຄຣດິດພາສີຕ່າງປະເທດ (FTC) — ການຄາດຄະເນອ້າງອີງ", ja: "総合所得税累進税率（最高45%）、外国税額控除（FTC）で調整 — 参考計算", ar: "ضريبة الدخل الإجمالية التصاعدية (حتى 45%)، معدَّلة بائتمان الضريبة الأجنبية (FTC) — تقدير مرجعي", hi: "प्रगतिशील समग्र आयकर (अधिकतम 45%), विदेशी कर क्रेडिट (FTC) द्वारा समायोजित — संदर्भ अनुमान", fr: "Impôt sur le revenu global progressif (jusqu'à 45 %), ajusté par le crédit d'impôt étranger (FTC) — estimation de référence", tl: "Progresibong comprehensive income tax (hanggang 45%), naaayon sa Foreign Tax Credit (FTC) — pang-reperensyang pagtatantya" })
  },
  us: {
    title: () => pickLang('주(State) 세금은 얼마나 붙어요?', 'How much does state tax add?', '州税会加多少？', 'Thuế bang tính thêm bao nhiêu?', 'ภาษีมลรัฐเพิ่มเท่าไหร่?', 'Сколько добавляет налог штата?', STATE_TAX_TITLE_MORE),
    sub: () => pickLang('주에 따라 0%~10.9%까지 다양해요 — 텍사스·플로리다 등은 아예 없어요', 'Ranges from 0%–10.9% depending on the state — some states like Texas and Florida have none', '因州而异，从0%到10.9%不等 — 德克萨斯、佛罗里达等州完全没有州税', 'Dao động từ 0%–10,9% tùy bang — một số bang như Texas, Florida không có thuế này', 'อยู่ระหว่าง 0%–10.9% ขึ้นอยู่กับมลรัฐ — บางมลรัฐเช่นเท็กซัสและฟลอริดาไม่มีเลย', 'От 0% до 10,9% в зависимости от штата — в некоторых, как Техас и Флорида, налога нет вообще', { km: "ចាប់ពី 0%~10.9% អាស្រ័យលើរដ្ឋ — រដ្ឋមួយចំនួនដូចជា Texas និង Florida គ្មានពន្ធនេះទាល់តែសោះ", ne: "राज्य अनुसार ०%~१०.९% सम्म फरक हुन्छ — टेक्सास, फ्लोरिडा जस्ता केही राज्यमा यो कर नै हुँदैन", id: "Berkisar 0%–10,9% tergantung negara bagian — beberapa negara bagian seperti Texas dan Florida tidak mengenakannya sama sekali", my: "ပြည်နယ်ပေါ်မူတည်၍ 0%~10.9% ကွာခြားသည် — Texas၊ Florida ကဲ့သို့ ပြည်နယ်အချို့တွင် လုံးဝမရှိပါ", si: "ප්‍රාන්තය අනුව 0%~10.9% දක්වා වෙනස් වේ — ටෙක්සාස්, ෆ්ලොරිඩා වැනි ප්‍රාන්ත කිහිපයක නැත", uz: "Shtatga qarab 0%–10,9% gacha farq qiladi — Texas, Florida kabi ba'zi shtatlarda umuman yo'q", mn: "Мужаас хамааран 0%~10.9% хооронд хэлбэлздэг — Texas, Florida зэрэг зарим мужид огт байхгүй", kk: "Штатқа байланысты 0%–10,9% дейін өзгереді — Техас, Флорида сияқты кейбір штаттарда мүлдем жоқ", ky: "Штатка жараша 0%–10.9% чейин өзгөрөт — Техас, Флорида сыяктуу айрым штаттарда таптакыр жок", ur: "ریاست کے لحاظ سے 0%–10.9% تک مختلف ہوتا ہے — ٹیکساس، فلوریڈا جیسی کچھ ریاستوں میں بالکل نہیں", bn: "রাজ্যভেদে ০%–১০.৯% পর্যন্ত ভিন্ন হয় — টেক্সাস, ফ্লোরিডার মতো কিছু রাজ্যে একেবারেই নেই", lo: "ແຕກຕ່າງກັນ 0%–10.9% ຂຶ້ນກັບລັດ — ບາງລັດເຊັ່ນ Texas ແລະ Florida ບໍ່ມີເລີຍ", ja: "州によって0%〜10.9%まで幅がある — テキサス州やフロリダ州などは州税自体がない", ar: "يتراوح من 0% إلى 10.9% حسب الولاية — بعض الولايات مثل تكساس وفلوريدا لا تفرضها إطلاقًا", hi: "राज्य के अनुसार 0%–10.9% तक अलग-अलग होता है — टेक्सास, फ्लोरिडा जैसे कुछ राज्यों में बिल्कुल नहीं है", fr: "Varie de 0 % à 10,9 % selon l'État — certains États comme le Texas et la Floride n'en ont aucun", tl: "Mula 0%–10.9%, depende sa estado — walang state tax ang ilang estado tulad ng Texas at Florida" })
  },
  cn: {
    title: () => pickLang('중국에서도 또 내요?', 'Do I also pay in China?', '在中国也要交税吗？', 'Có phải đóng thuế ở Trung Quốc nữa không?', 'ต้องเสียภาษีในจีนด้วยไหม?', 'Нужно ли платить налог ещё и в Китае?', buildAlsoPayMore('cn')),
    sub: () => pickLang('우연소득 20% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 20% rate on incidental income — the US tax already paid can offset it via tax credit', '偶然所得20%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 20% trên thu nhập ngẫu nhiên — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 20% สำหรับรายได้ที่เกิดขึ้นโดยบังเอิญ — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 20% на случайный доход — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាថេរ 20% លើប្រាក់ចំណូលចៃដន្យ — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "आकस्मिक आयमा स्थिर २०% दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif tetap 20% untuk penghasilan insidental — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ကြုံကြိုက်ရရှိငွေအတွက် ၂၀% ပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "ආකස්මික ආදායමට ස්ථාවර 20% අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Tasodifiy daromadga 20% qat'iy stavka — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Санамсаргүй орлогод 12% биш 20% тогтмол хувь — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Кездейсоқ табысқа 20% тұрақты мөлшерлеме — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Кокустан кирешеге 20% туруктуу чен — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "حادثاتی آمدنی پر 20% فلیٹ ریٹ — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "আকস্মিক আয়ে ২০% ফ্ল্যাট হার — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາຄົງທີ່ 20% ສຳລັບລາຍໄດ້ໂດຍບັງເອີນ — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "偶発所得に一律20%課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة ثابتة 20% على الدخل العرضي — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "आकस्मिक आय पर 20% फ्लैट दर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux fixe de 20 % sur les revenus fortuits — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 20% rate sa incidental income — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  in: {
    title: () => pickLang('인도에서도 또 내요?', 'Do I also pay in India?', '在印度也要交税吗？', 'Có phải đóng thuế ở Ấn Độ nữa không?', 'ต้องเสียภาษีในอินเดียด้วยไหม?', 'Нужно ли платить налог ещё и в Индии?', buildAlsoPayMore('in')),
    sub: () => pickLang('복권 당첨소득 30% 단일세율 + 서차지·세스 포함 실효 약 39% — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 30% rate on lottery winnings plus surcharge/cess, ~39% effective — the US tax already paid can offset it via tax credit', '彩票中奖所得30%单一税率，加上附加税和税捐后实际约39% — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 30% trên tiền thắng xổ số cộng phụ phí/thuế bổ sung, hiệu quả khoảng 39% — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 30% สำหรับเงินรางวัลลอตเตอรีบวกภาษีเพิ่มและค่าธรรมเนียม รวมประมาณ 39% — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 30% на выигрыш в лотерею плюс надбавка/сбор, эффективно около 39% — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាថេរ 30% លើប្រាក់ឆ្នោត បូកបន្ថែម surcharge/cess សរុបប្រហែល 39% — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "लटरी जितेको आयमा स्थिर ३०% दर + सरचार्ज/सेस सहित प्रभावकारी करिब ३९% — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif tetap 30% untuk kemenangan lotre plus biaya tambahan/cess, efektif ~39% — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ထီပေါက်ငွေအတွက် ၃၀% ပုံသေနှုန်း + surcharge/cess ပါဝင်ပြီး အကျိုးသက်ရောက်မှု ~၃၉% — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "ලොතරැයි ජයග්‍රහණයට ස්ථාවර 30% + surcharge/cess ඇතුළත්ව ඵලදායි ~39% — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Lotereya yutuqiga 30% qat'iy stavka + ustama/cess bilan samarali ~39% — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Сугалааны ялалтад 30% тогтмол хувь + сургчарж/сесс нэмэгдэж бодит ~39% — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Лотерея ұтысына 20% емес 30% тұрақты мөлшерлеме + үстеме алым қосылып іс жүзінде ~39% — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Лотерея утушуна 30% туруктуу чен + кошумча алым менен иш жүзүндө ~39% — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "لاٹری جیت پر 30% فلیٹ ریٹ + سرچارج/سیس ملا کر مؤثر طور پر ~39% — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "লটারি জয়ে ৩০% ফ্ল্যাট হার + সারচার্জ/সেস মিলিয়ে কার্যকরভাবে ~৩৯% — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາຄົງທີ່ 30% ສຳລັບເງິນລາງວັນເລກລອດເຕີຣີ ບວກຄ່າທຳນຽມເພີ່ມ ລວມແລ້ວປະມານ 39% — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "宝くじ当選金に一律30%課税、サーチャージ込みで実質約39% — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة ثابتة 30% على أرباح اليانصيب بالإضافة إلى رسوم إضافية، بمعدل فعلي ~39% — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "लॉटरी जीत पर 30% फ्लैट दर + अधिभार/उपकर सहित प्रभावी रूप से ~39% — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux fixe de 30 % sur les gains de loterie plus surtaxe, soit ~39 % effectif — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 30% rate sa panalo sa lottery + surcharge/cess, epektibong ~39% — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  vn: {
    title: () => pickLang('베트남에서도 또 내요?', 'Do I also pay in Vietnam?', '在越南也要交税吗？', 'Có phải đóng thuế ở Việt Nam nữa không?', 'ต้องเสียภาษีในเวียดนามด้วยไหม?', 'Нужно ли платить налог ещё и во Вьетнаме?', buildAlsoPayMore('vn')),
    sub: () => pickLang('상금소득 10% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 10% rate on prize income — the US tax already paid can offset it via tax credit', '奖金所得10%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 10% trên thu nhập tiền thưởng — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 10% สำหรับรายได้เงินรางวัล — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 10% на доход от приза — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាថេរ 10% លើប្រាក់ចំណូលពីរង្វាន់ — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "पुरस्कार आयमा स्थिर १०% दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif tetap 10% untuk penghasilan hadiah — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ဆုငွေဝင်ငွေအတွက် ၁၀% ပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "ත්‍යාග ආදායමට ස්ථාවර 10% අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Mukofot daromadiga 10% qat'iy stavka — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Шагналын орлогод 10% тогтмол хувь — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Сыйлықақы табысына 10% тұрақты мөлшерлеме — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Сыйлык кирешесине 10% туруктуу чен — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "انعامی آمدنی پر 10% فلیٹ ریٹ — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "পুরস্কার আয়ে ১০% ফ্ল্যাট হার — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາຄົງທີ່ 10% ສຳລັບລາຍໄດ້ເງິນລາງວັນ — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "賞金所得に一律10%課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة ثابتة 10% على دخل الجوائز — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "पुरस्कार आय पर 10% फ्लैट दर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux fixe de 10 % sur les revenus de prix — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 10% rate sa prize income — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  id: {
    title: () => pickLang('인도네시아에서도 또 내요?', 'Do I also pay in Indonesia?', '在印尼也要交税吗？', 'Có phải đóng thuế ở Indonesia nữa không?', 'ต้องเสียภาษีในอินโดนีเซียด้วยไหม?', 'Нужно ли платить налог ещё и в Индонезии?', buildAlsoPayMore('id')),
    sub: () => pickLang('복권 당첨소득 25% 단일 최종세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 25% final tax rate on lottery winnings — the US tax already paid can offset it via tax credit', '彩票中奖所得25%单一最终税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 25% (thuế cuối cùng) trên tiền thắng xổ số — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราภาษีสุดท้ายคงที่ 25% สำหรับเงินรางวัลลอตเตอรี — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная итоговая ставка 25% на выигрыш в лотерею — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាពន្ធចុងក្រោយថេរ 25% លើប្រាក់ឆ្នោត — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "लटरी जितेकोमा स्थिर २५% अन्तिम कर दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif pajak final tetap 25% untuk kemenangan lotre — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ထီပေါက်ငွေအတွက် ၂၅% နောက်ဆုံးပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "ලොතරැයි ජයග්‍රහණයට ස්ථාවර 25% අවසාන බදු අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Lotereya yutuqiga 25% qat'iy yakuniy soliq stavkasi — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Сугалааны ялалтад 25% тогтмол эцсийн татварын хувь — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Лотерея ұтысына 25% тұрақты түпкілікті салық мөлшерлемесі — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Лотерея утушуна 25% туруктуу акыркы салык чени — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "لاٹری جیت پر 25% فلیٹ حتمی ٹیکس ریٹ — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "লটারি জয়ে ২৫% ফ্ল্যাট চূড়ান্ত কর হার — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາພາສີສຸດທ້າຍຄົງທີ່ 25% ສຳລັບເງິນລາງວັນເລກລອດເຕີຣີ — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "宝くじ当選金に一律25%の最終課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة نهائية ثابتة 25% على أرباح اليانصيب — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "लॉटरी जीत पर 25% फ्लैट अंतिम कर दर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux d'imposition final fixe de 25 % sur les gains de loterie — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 25% na huling tax rate sa panalo sa lottery — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  ph: {
    title: () => pickLang('필리핀에서도 또 내요?', 'Do I also pay in the Philippines?', '在菲律宾也要交税吗？', 'Có phải đóng thuế ở Philippines nữa không?', 'ต้องเสียภาษีในฟิลิปปินส์ด้วยไหม?', 'Нужно ли платить налог ещё и на Филиппинах?', buildAlsoPayMore('ph')),
    sub: () => pickLang('해외 당첨금은 누진세율(최고 35%)로 합산 과세 — 이 계산기는 최고구간으로 근사, 미국에서 낸 세금은 세액공제로 상계 가능', 'Foreign winnings are taxed at progressive rates (up to 35%) as part of overall income — this calculator approximates using the top bracket; the US tax already paid can offset it via tax credit', '境外中奖所得按累进税率（最高35%）合并征税 — 本计算器按最高档估算，已在美国缴纳的税款可通过税收抵免抵消', 'Tiền thắng từ nước ngoài bị đánh thuế lũy tiến (tối đa 35%) hợp nhất vào thu nhập — máy tính này ước tính theo bậc cao nhất, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'เงินรางวัลจากต่างประเทศเสียภาษีแบบก้าวหน้า (สูงสุด 35%) รวมกับรายได้ — เครื่องคำนวณนี้ประมาณการที่อัตราสูงสุด ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Иностранный выигрыш облагается прогрессивным налогом (до 35%) в составе общего дохода — этот калькулятор использует приближение по верхней ставке, уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "ប្រាក់ឆ្នោតបរទេសត្រូវបានយកពន្ធតាមអត្រាលំដាប់ (រហូតដល់ 35%) ជាផ្នែកនៃប្រាក់ចំណូលសរុប — ម៉ាស៊ីនគណនានេះប៉ាន់ស្មានតាមថ្នាក់ខ្ពស់បំផុត ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "विदेशी जितेको रकम प्रगतिशील दर (अधिकतम ३५%) मा समग्र आयको भागको रूपमा कर लगाइन्छ — यो क्यालकुलेटरले उच्चतम स्ल्याब प्रयोग गरी अनुमान गर्छ, अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Kemenangan luar negeri dikenakan pajak progresif (hingga 35%) sebagai bagian dari penghasilan keseluruhan — kalkulator ini memperkirakan dengan bracket tertinggi, pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "နိုင်ငံခြားဆုငွေများကို ဝင်ငွေစုစုပေါင်း၏ တစ်စိတ်တစ်ပိုင်းအဖြစ် တိုးမြှင့်နှုန်း (အများဆုံး ၃၅%) ဖြင့် အခွန်ကောက်သည် — ဒီတွက်စက်သည် အမြင့်ဆုံးအလွှာဖြင့် ခန့်မှန်းသည်၊ အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "විදේශීය ජයග්‍රහණ සමස්ත ආදායමේ කොටසක් ලෙස ප්‍රගතිශීලී අනුපාතවලින් (උපරිම 35%) බදු අය කෙරේ — මෙම ගණකය ඉහළම කාණ්ඩය භාවිතයෙන් ඇස්තමේන්තු කරයි, ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Xorijiy yutuqlar umumiy daromad tarkibida progressiv stavkalar (35%gacha) bo'yicha soliqqa tortiladi — bu kalkulyator eng yuqori pog'onadan foydalanib taxmin qiladi, AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Гадаадын ялалтыг ерөнхий орлогын хэсэг болгон даамжирсан хувь (хамгийн ихдээ 35%)-аар татварладаг — энэ тооцоолуур хамгийн дээд шатлалаар ойролцоолж тооцдог, АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Шетелдік ұтыс жалпы табыстың бөлігі ретінде прогрессивті мөлшерлемемен (ең көбі 35%) салық салынады — бұл калькулятор ең жоғарғы санатпен жуықтайды, АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Чет өлкөдөгү утуш жалпы кирешенин бөлүгү катары прогрессивдүү чен (эң көбү 35%) менен салыкка алынат — бул эсептегич эң жогорку категория менен болжолдойт, АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "غیر ملکی جیت مجموعی آمدنی کے حصے کے طور پر ترقی پذیر شرحوں (زیادہ سے زیادہ 35%) پر ٹیکس عائد ہوتی ہے — یہ کیلکولیٹر سب سے اونچے بریکٹ سے تخمینہ لگاتا ہے، امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "বিদেশি জয় সামগ্রিক আয়ের অংশ হিসেবে প্রগতিশীল হারে (সর্বোচ্চ ৩৫%) কর আরোপিত হয় — এই ক্যালকুলেটর সর্বোচ্চ স্ল্যাব ব্যবহার করে অনুমান করে, যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ເງິນລາງວັນຕ່າງປະເທດຖືກເກັບພາສີແບບກ້າວໜ້າ (ສູງສຸດ 35%) ເປັນສ່ວນໜຶ່ງຂອງລາຍໄດ້ລວມ — ເຄື່ອງຄິດໄລ່ນີ້ຄາດຄະເນດ້ວຍລະດັບສູງສຸດ, ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "海外の当選金は総合所得の一部として累進税率（最高35%）で課税 — この計算機は最高税率帯で概算、米国で既に納めた税金は税額控除で相殺できます", ar: "تُفرض الضريبة على الأرباح الأجنبية بمعدلات تصاعدية (حتى 35%) كجزء من الدخل الإجمالي — تُقدّر هذه الآلة الحاسبة باستخدام أعلى شريحة، ويمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "विदेशी जीत को समग्र आय के हिस्से के रूप में प्रगतिशील दरों (अधिकतम 35%) पर कर लगाया जाता है — यह कैलकुलेटर उच्चतम स्लैब का उपयोग करके अनुमान लगाता है, अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Les gains étrangers sont imposés à des taux progressifs (jusqu'à 35 %) dans le cadre du revenu global — ce calculateur estime avec la tranche la plus élevée ; l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Ang mga panalo mula sa ibang bansa ay binubuwisan sa progresibong rate (hanggang 35%) bilang bahagi ng kabuuang kita — tinatantya ng calculator na ito gamit ang pinakamataas na bracket; puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  th: {
    title: () => pickLang('태국에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Thailand? (estimate ⚠️)', '在泰国也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Thái Lan nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในไทยด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Таиланде? (оценка ⚠️)', buildAlsoPayMore('th', 'estimate')),
    sub: () => pickLang('해외 복권 당첨금 과세 기준이 명확히 확인되지 않아, 개인소득세 최고세율(35%)로 추정 계산했어요 — 실제와 다를 수 있어요', 'The tax rule for foreign lottery winnings isn’t clearly confirmed, so we estimated using the top personal income tax rate (35%) — the real amount may differ', '境外彩票中奖收入的征税依据尚未明确确认，故按个人所得税最高税率（35%）估算 — 可能与实际不同', 'Quy định thuế cho tiền thắng xổ số nước ngoài chưa được xác nhận rõ ràng, nên chúng tôi ước tính theo thuế suất thu nhập cá nhân cao nhất (35%) — số tiền thực tế có thể khác', 'ยังไม่ยืนยันหลักเกณฑ์ภาษีสำหรับเงินรางวัลลอตเตอรีจากต่างประเทศอย่างชัดเจน จึงประมาณการด้วยอัตราภาษีเงินได้บุคคลธรรมดาสูงสุด (35%) — จำนวนจริงอาจแตกต่างออกไป', 'Правило налогообложения иностранных лотерейных выигрышей чётко не подтверждено, поэтому мы использовали оценку по максимальной ставке подоходного налога (35%) — реальная сумма может отличаться', { km: "ច្បាប់ពន្ធសម្រាប់ប្រាក់ឆ្នោតបរទេសមិនត្រូវបានបញ្ជាក់ច្បាស់លាស់ទេ ដូច្នេះយើងបានប៉ាន់ស្មានដោយប្រើអត្រាពន្ធលើប្រាក់ចំណូលបុគ្គលខ្ពស់បំផុត (35%) — ចំនួនពិតប្រាកដអាចខុសគ្នា", ne: "विदेशी लटरी जितेको रकमको कर नियम स्पष्ट रूपमा पुष्टि नभएकोले, हामीले उच्चतम व्यक्तिगत आयकर दर (३५%) प्रयोग गरी अनुमान गर्यौं — वास्तविक रकम फरक हुन सक्छ", id: "Aturan pajak untuk kemenangan lotre luar negeri belum dikonfirmasi dengan jelas, jadi kami memperkirakan menggunakan tarif pajak penghasilan pribadi tertinggi (35%) — jumlah sebenarnya bisa berbeda", my: "နိုင်ငံခြားထီပေါက်ငွေအတွက် အခွန်စည်းမျဉ်း ရှင်းလင်းစွာအတည်မပြုရသေးသဖြင့် ကျွန်ုပ်တို့သည် အများဆုံး ကိုယ်ရေးဝင်ငွေခွန်နှုန်း (၃၅%) ကို အသုံးပြု၍ ခန့်မှန်းခဲ့ပါသည် — အမှန်တကယ်ပမာဏ ကွာခြားနိုင်သည်", si: "විදේශීය ලොතරැයි ජයග්‍රහණ සඳහා බදු නීතිය පැහැදිලිව තහවුරු වී නොමැති බැවින්, අපි ඉහළම පුද්ගලික ආදායම් බදු අනුපාතය (35%) භාවිතයෙන් ඇස්තමේන්තු කළෙමු — සැබෑ ප්‍රමාණය වෙනස් විය හැක", uz: "Xorijiy lotereya yutuqlari uchun soliq qoidasi aniq tasdiqlanmagan, shuning uchun biz eng yuqori shaxsiy daromad solig'i stavkasi (35%) bo'yicha taxmin qildik — haqiqiy summa farq qilishi mumkin", mn: "Гадаадын сугалааны ялалтад ногдох татварын дүрэм тодорхой батлагдаагүй тул хамгийн дээд хувийн орлогын албан татварын хувь (35%)-аар тооцоолсон — бодит дүн өөр байж болно", kk: "Шетелдік лотерея ұтысына арналған салық ережесі нақты расталмаған, сондықтан біз ең жоғарғы жеке табыс салығы мөлшерлемесін (35%) пайдаланып бағаладық — нақты сома өзгеше болуы мүмкін", ky: "Чет өлкөдөгү лотерея утушуна карата салык эрежеси так бекитилген эмес, ошондуктан биз эң жогорку жеке киреше салыгынын чени (35%) менен болжолдук — чыныгы сумма башкача болушу мүмкүн", ur: "غیر ملکی لاٹری جیت کے لیے ٹیکس کا اصول واضح طور پر تصدیق شدہ نہیں ہے، اس لیے ہم نے سب سے اونچی ذاتی انکم ٹیکس شرح (35%) استعمال کرتے ہوئے تخمینہ لگایا — اصل رقم مختلف ہو سکتی ہے", bn: "বিদেশি লটারি জয়ের জন্য কর নিয়ম স্পষ্টভাবে নিশ্চিত না হওয়ায়, আমরা সর্বোচ্চ ব্যক্তিগত আয়কর হার (৩৫%) ব্যবহার করে অনুমান করেছি — প্রকৃত পরিমাণ ভিন্ন হতে পারে", lo: "ກົດລະບຽບພາສີສຳລັບເງິນລາງວັນເລກລອດເຕີຣີຕ່າງປະເທດຍັງບໍ່ໄດ້ຮັບການຢືນຢັນຢ່າງຈະແຈ້ງ, ດັ່ງນັ້ນພວກເຮົາຄາດຄະເນໂດຍໃຊ້ອັດຕາພາສີລາຍໄດ້ບຸກຄົນສູງສຸດ (35%) — ຈຳນວນຈິງອາດແຕກຕ່າງ", ja: "海外宝くじ当選金の課税ルールが明確に確認できないため、個人所得税の最高税率（35%）で推定計算しました — 実際とは異なる場合があります", ar: "قاعدة الضريبة على أرباح اليانصيب الأجنبية غير مؤكدة بوضوح، لذا قدّرنا باستخدام أعلى معدل لضريبة الدخل الشخصي (35%) — قد يختلف المبلغ الفعلي", hi: "विदेशी लॉटरी जीत के लिए कर नियम स्पष्ट रूप से पुष्टि नहीं है, इसलिए हमने उच्चतम व्यक्तिगत आयकर दर (35%) का उपयोग करके अनुमान लगाया — वास्तविक राशि भिन्न हो सकती है", fr: "La règle fiscale pour les gains de loterie étrangers n'est pas clairement confirmée, nous avons donc estimé avec le taux d'impôt sur le revenu personnel le plus élevé (35 %) — le montant réel peut différer", tl: "Hindi malinaw na nakumpirma ang tax rule para sa panalo sa dayuhang lottery, kaya tinantya namin gamit ang pinakamataas na personal income tax rate (35%) — maaaring iba ang aktwal na halaga" })
  },
  jp: {
    title: () => pickLang('일본에서도 또 내요?', 'Do I also pay in Japan?', '在日本也要交税吗？', 'Có phải đóng thuế ở Nhật Bản nữa không?', 'ต้องเสียภาษีในญี่ปุ่นด้วยไหม?', 'Нужно ли платить налог ещё и в Японии?', buildAlsoPayMore('jp')),
    sub: () => pickLang('일본 자국 복권만 비과세이고 해외 복권은 「일시소득」으로 과세 — 절반만 과세표준에 포함(1/2 특례) 후 누진세율 적용, 미국에서 낸 세금은 세액공제로 상계 가능', 'Only Japan’s own lottery is tax-free — foreign lottery winnings are taxed as “temporary income”, with only half included in the tax base, then taxed at progressive rates; the US tax already paid can offset it via tax credit', '仅日本本国彩票免税，境外彩票按「一时所得」征税——仅一半计入应税额后按累进税率征税，已在美国缴纳的税款可通过税收抵免抵消', 'Chỉ xổ số của chính Nhật Bản mới miễn thuế — tiền thắng xổ số nước ngoài bị đánh thuế là "thu nhập tạm thời", chỉ tính một nửa vào cơ sở thuế rồi áp thuế lũy tiến, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'มีเพียงลอตเตอรีของญี่ปุ่นเองเท่านั้นที่ปลอดภาษี — เงินรางวัลลอตเตอรีต่างประเทศถูกเก็บภาษีเป็น "รายได้ชั่วคราว" โดยนับเพียงครึ่งหนึ่งเข้าฐานภาษีแล้วใช้อัตราก้าวหน้า ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Только собственная лотерея Японии не облагается налогом — иностранный лотерейный выигрыш облагается как «временный доход», в налоговую базу включается лишь половина суммы, затем применяется прогрессивная ставка; уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "តែឆ្នោតជប៉ុនខ្លួនឯងទេដែលមិនជាប់ពន្ធ — ប្រាក់ឆ្នោតបរទេសត្រូវបានយកពន្ធជា \"ប្រាក់ចំណូលបណ្តោះអាសន្ន\" ដោយរាប់តែពាក់កណ្តាលចូលមូលដ្ឋានពន្ធ រួចអនុវត្តអត្រាលំដាប់ ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "जापानको आफ्नै लटरी मात्र करमुक्त छ — विदेशी लटरी जितेको रकम \"अस्थायी आय\" को रूपमा कर लगाइन्छ, आधामात्र कर आधारमा समावेश गरी प्रगतिशील दर लागू गरिन्छ, अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Hanya lotre Jepang sendiri yang bebas pajak — kemenangan lotre luar negeri dikenakan pajak sebagai \"penghasilan sementara\", hanya separuh yang masuk dasar pajak lalu dikenakan tarif progresif, pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ဂျပန်၏ကိုယ်ပိုင်ထီကိုသာ အခွန်ကင်းလွတ်ခွင့်ရသည် — နိုင်ငံခြားထီပေါက်ငွေကို \"ယာယီဝင်ငွေ\" အဖြစ် အခွန်ကောက်ပြီး တစ်ဝက်သာ အခွန်အခြေခံတွင် ထည့်ပြီးမှ တိုးမြှင့်နှုန်းကို အသုံးပြုသည်၊ အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "ජපානයේම ලොතරැයිය පමණක් බදු රහිතයි — විදේශීය ලොතරැයි ජයග්‍රහණ \"තාවකාලික ආදායම\" ලෙස බදු අය කරන අතර, බදු පදනමට අඩක් පමණක් ඇතුළත් කර ප්‍රගතිශීලී අනුපාතය යොදයි, ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Faqat Yaponiyaning o'z lotereyasi soliqdan ozod — xorijiy lotereya yutuqlari 'vaqtinchalik daromad' sifatida soliqqa tortiladi, faqat yarmi soliq bazasiga kiritilib progressiv stavka qo'llaniladi, AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Зөвхөн Японы өөрийн сугалаа татвараас чөлөөлөгддөг — гадаадын сугалааны ялалтыг \"түр зуурын орлого\" гэж татварладаг бөгөөд зөвхөн хагасыг нь татварын суурьт оруулж дараа нь даамжирсан хувь хэрэглэдэг, АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Тек Жапонияның өз лотереясы ғана салықтан босатылған — шетелдік лотерея ұтысы \"уақытша табыс\" ретінде салық салынады, тек жартысы ғана салық базасына кіреді, содан кейін прогрессивті мөлшерлеме қолданылады, АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Жапониянын өз лотереясы гана салыктан бошотулган — чет өлкөдөгү лотерея утушу \"убактылуу киреше\" катары салыкка алынат, анын жарымы гана салык базасына кирет, андан кийин прогрессивдүү чен колдонулат, АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "صرف جاپان کی اپنی لاٹری ٹیکس سے مستثنیٰ ہے — غیر ملکی لاٹری جیت کو \"عارضی آمدنی\" کے طور پر ٹیکس لگایا جاتا ہے، صرف آدھا حصہ ٹیکس بیس میں شامل ہوتا ہے پھر ترقی پذیر شرح لاگو ہوتی ہے، امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "শুধু জাপানের নিজস্ব লটারি করমুক্ত — বিদেশি লটারি জয়কে \"সাময়িক আয়\" হিসেবে কর দেওয়া হয়, শুধু অর্ধেক কর ভিত্তিতে অন্তর্ভুক্ত হয়ে প্রগতিশীল হার প্রয়োগ হয়, যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ມີແຕ່ເລກລອດເຕີຣີຂອງຍີ່ປຸ່ນເອງເທົ່ານັ້ນທີ່ປອດພາສີ — ເງິນລາງວັນເລກລອດເຕີຣີຕ່າງປະເທດຖືກເກັບພາສີເປັນ \"ລາຍໄດ້ຊົ່ວຄາວ\" ໂດຍນັບພຽງເຄິ່ງໜຶ່ງເຂົ້າຖານພາສີແລ້ວໃຊ້ອັດຕາກ້າວໜ້າ, ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "日本国内の宝くじのみ非課税 — 海外の宝くじ当選金は「一時所得」として課税され、課税標準には半分のみ算入（1/2特例）した上で累進税率を適用、米国で既に納めた税金は税額控除で相殺できます", ar: "يانصيب اليابان الخاص فقط معفى من الضريبة — تُفرض الضريبة على أرباح اليانصيب الأجنبية باعتبارها \"دخلاً مؤقتًا\"، مع إدراج النصف فقط في الوعاء الضريبي ثم تطبيق معدلات تصاعدية، ويمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "केवल जापान की अपनी लॉटरी कर-मुक्त है — विदेशी लॉटरी जीत को \"अस्थायी आय\" के रूप में कर लगाया जाता है, केवल आधा हिस्सा कर आधार में शामिल होकर प्रगतिशील दर लागू होती है, अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Seule la loterie japonaise elle-même est exonérée d'impôt — les gains de loterie étrangers sont imposés comme un « revenu temporaire », dont seule la moitié est incluse dans l'assiette fiscale avant application des taux progressifs ; l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Ang lottery lang mismo ng Japan ang walang buwis — ang panalo sa dayuhang lottery ay binubuwisan bilang \"pansamantalang kita,\" kalahati lang ang isasama sa tax base bago ilapat ang progresibong rate; puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  ru: {
    title: () => pickLang('러시아에서도 또 내요? (조약 정지 ⚠️)', 'Do I also pay in Russia? (treaty suspended ⚠️)', '在俄罗斯也要交税吗？（条约暂停⚠️）', 'Có phải đóng thuế ở Nga nữa không? (hiệp định bị đình chỉ ⚠️)', 'ต้องเสียภาษีในรัสเซียด้วยไหม? (สนธิสัญญาระงับ ⚠️)', 'Нужно ли платить налог ещё и в России? (договор приостановлен ⚠️)', buildAlsoPayMore('ru', 'treatySuspended')),
    sub: () => pickLang('일반 누진세율 최고구간 22% 적용(국내 판촉경품 전용 35%는 해당 없음) — 단, 2023년 미-러 조세조약 핵심 조항 정지로 미국 세금 상계가 지금도 되는지 불확실해요', 'The standard top progressive rate of 22% applies (the 35% rate is only for domestic promotional prizes) — but since Russia suspended key US treaty provisions in 2023, it’s unclear whether the US tax can still be offset', '适用一般累进税率最高档22%（35%的特别税率仅针对国内促销奖品）——但由于俄罗斯2023年暂停了与美国税收协定的核心条款，能否抵免美国税款尚不确定', 'Áp dụng thuế suất lũy tiến cao nhất 22% (mức 35% chỉ dành cho giải thưởng khuyến mãi trong nước) — nhưng do Nga đình chỉ các điều khoản cốt lõi trong hiệp định thuế với Mỹ từ 2023, chưa rõ liệu có còn khấu trừ thuế Mỹ được không', 'ใช้อัตราภาษีก้าวหน้าสูงสุด 22% ตามปกติ (อัตรา 35% ใช้เฉพาะของรางวัลส่งเสริมการขายในประเทศ) — แต่เนื่องจากรัสเซียระงับข้อกำหนดหลักของสนธิสัญญากับสหรัฐฯ ตั้งแต่ปี 2023 จึงยังไม่แน่ชัดว่าจะหักลบภาษีสหรัฐฯ ได้หรือไม่', 'Применяется стандартная максимальная прогрессивная ставка 22% (35% — только для внутренних промо-призов) — но поскольку Россия приостановила ключевые положения договора с США в 2023 году, неясно, можно ли по-прежнему зачесть налог США', { km: "អត្រាលំដាប់ខ្ពស់បំផុតធម្មតា 22% អនុវត្ត (អត្រា 35% សម្រាប់តែរង្វាន់ផ្សព្វផ្សាយក្នុងស្រុក) — ប៉ុន្តែដោយសាររុស្ស៊ីបានផ្អាកលក្ខខណ្ឌសំខាន់ៗនៃសន្ធិសញ្ញាជាមួយអាមេរិកក្នុងឆ្នាំ 2023 វានៅមិនច្បាស់ថាតើអាចទូទាត់ពន្ធអាមេរិកបានទៀតឬអត់", ne: "सामान्य उच्चतम प्रगतिशील दर 22% लागू हुन्छ (35% दर घरेलु प्रचार पुरस्कारका लागि मात्र हो) — तर रुसले 2023 मा अमेरिकासँगको सन्धिका मुख्य प्रावधानहरू निलम्बन गरेकोले, अमेरिकी कर अझै पनि अफसेट गर्न सकिन्छ कि सकिँदैन स्पष्ट छैन", id: "Tarif progresif tertinggi standar 22% berlaku (tarif 35% hanya untuk hadiah promosi domestik) — tetapi karena Rusia menangguhkan ketentuan utama perjanjian dengan AS pada 2023, belum jelas apakah pajak AS masih bisa dikompensasi", my: "ပုံမှန်အများဆုံးတိုးမြှင့်နှုန်း ၂၂% ကျင့်သုံးသည် (၃၅% နှုန်းသည် ပြည်တွင်းလှုံ့ဆော်ဆုများအတွက်သာဖြစ်သည်) — သို့သော် ရုရှားသည် ၂၀၂၃ တွင် အမေရိကန်နှင့် စာချုပ်ပါ အဓိကစည်းမျဉ်းများကို ရပ်ဆိုင်းလိုက်သောကြောင့် အမေရိကန်အခွန်ကို ယခုတိုင်ခုနှိမ်နိုင်ဆဲရှိမရှိ မသေချာပါ", si: "සම්මත ඉහළම ප්‍රගතිශීලී අනුපාතය 22% අදාළ වේ (35% අනුපාතය දේශීය ප්‍රවර්ධන ත්‍යාග සඳහා පමණි) — නමුත් රුසියාව 2023 දී එක්සත් ජනපදය සමඟ ගිවිසුමේ ප්‍රධාන විධිවිධාන අත්හිටුවූ බැවින්, එක්සත් ජනපද බද්ද තවමත් ප්‍රතිසන්තුලනය කළ හැකිද යන්න පැහැදිලි නැත", uz: "Standart eng yuqori progressiv stavka 22% qo'llaniladi (35% stavka faqat mahalliy reklama sovg'alari uchun) — lekin Rossiya 2023-yilda AQSh bilan shartnomaning asosiy qoidalarini to'xtatgani sababli, AQSh solig'ini hali ham qoplash mumkinmi aniq emas", mn: "Стандарт хамгийн дээд даамжирсан 22% хувь хэрэглэгддэг (35% хувь нь зөвхөн дотоодын урамшуулах шагналд) — гэвч Орос 2023 онд АНУ-тай хийсэн гэрээний гол заалтуудыг түдгэлзүүлсэн тул АНУ-ын татварыг одоо ч нөхөж болох эсэх тодорхойгүй", kk: "Стандартты ең жоғарғы прогрессивті мөлшерлеме 22% қолданылады (35% мөлшерлеме тек ішкі жарнамалық сыйлықтарға) — бірақ Ресей 2023 жылы АҚШ-пен келісімнің негізгі ережелерін тоқтатқандықтан, АҚШ салығын әлі де өтеуге бола ма белгісіз", ky: "Стандарттуу эң жогорку прогрессивдүү 22% чен колдонулат (35% чен ички жарнама сыйлыктарына гана) — бирок Орусия 2023-жылы АКШ менен келишимдин негизги жоболорун токтоткондуктан, АКШ салыгын дагы деле төлөшкө болобу же жокпу белгисиз", ur: "معیاری سب سے اونچی ترقی پذیر شرح 22% لاگو ہوتی ہے (35% شرح صرف ملکی پروموشنل انعامات کے لیے ہے) — لیکن روس نے 2023 میں امریکہ کے ساتھ معاہدے کی اہم شقیں معطل کر دی تھیں، اس لیے یہ واضح نہیں کہ امریکی ٹیکس اب بھی پورا کیا جا سکتا ہے یا نہیں", bn: "আদর্শ সর্বোচ্চ প্রগতিশীল হার ২২% প্রযোজ্য (৩৫% হার শুধুমাত্র দেশীয় প্রচার পুরস্কারের জন্য) — কিন্তু রাশিয়া ২০২৩ সালে যুক্তরাষ্ট্রের সাথে চুক্তির মূল বিধানগুলো স্থগিত করায়, মার্কিন কর এখনও সমন্বয় করা যায় কিনা তা স্পষ্ট নয়", lo: "ນຳໃຊ້ອັດຕາກ້າວໜ້າສູງສຸດມາດຕະຖານ 22% (ອັດຕາ 35% ສະເພາະລາງວັນສົ່ງເສີມການຂາຍພາຍໃນປະເທດ) — ແຕ່ເນື່ອງຈາກລັດເຊຍໄດ້ໂຈະຂໍ້ກຳນົດຫຼັກຂອງສົນທິສັນຍາກັບສະຫະລັດໃນປີ 2023 ຈຶ່ງຍັງບໍ່ຈະແຈ້ງວ່າຈະຫັກລ້າງພາສີສະຫະລັດໄດ້ຢູ່ຫຼືບໍ່", ja: "通常の最高累進税率22%を適用（35%は国内の販促景品のみ）— ただしロシアが2023年に米国との条約の主要条項を停止したため、米国税の相殺が今も可能かは不明確です", ar: "يُطبَّق المعدل التصاعدي الأعلى القياسي 22% (المعدل 35% مخصص فقط للجوائز الترويجية المحلية) — لكن نظرًا لتعليق روسيا لأحكام رئيسية في المعاهدة مع أمريكا عام 2023، من غير الواضح ما إذا كان لا يزال بالإمكان تعويض الضريبة الأمريكية", hi: "मानक उच्चतम प्रगतिशील दर 22% लागू होती है (35% दर केवल घरेलू प्रचार पुरस्कारों के लिए है) — लेकिन रूस ने 2023 में अमेरिका के साथ संधि के प्रमुख प्रावधानों को निलंबित कर दिया, इसलिए यह स्पष्ट नहीं है कि अमेरिकी कर अभी भी भरपाई किया जा सकता है या नहीं", fr: "Le taux progressif maximal standard de 22 % s'applique (le taux de 35 % concerne uniquement les prix promotionnels nationaux) — mais la Russie ayant suspendu des dispositions clés du traité avec les États-Unis en 2023, on ne sait pas si l'impôt américain peut encore être compensé", tl: "Inilalapat ang standard na pinakamataas na progresibong rate na 22% (ang 35% rate ay para lang sa domestic promotional prizes) — pero dahil sinuspinde ng Russia ang mga pangunahing probisyon ng tratado nito sa US noong 2023, hindi malinaw kung puwede pa ring i-offset ang buwis sa US" })
  },
  np: {
    title: () => pickLang('네팔에서도 또 내요?', 'Do I also pay in Nepal?', '在尼泊尔也要交税吗？', 'Có phải đóng thuế ở Nepal nữa không?', 'ต้องเสียภาษีในเนปาลด้วยไหม?', 'Нужно ли платить налог ещё и в Непале?', buildAlsoPayMore('np')),
    sub: () => pickLang('복권·상금 등 우발이득에 25% 단일 최종세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 25% final tax on windfall income like lottery/prizes — the US tax already paid can offset it via tax credit', '彩票、奖金等偶然所得适用25%单一最终税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 25% (thuế cuối cùng) trên thu nhập bất ngờ như xổ số/tiền thưởng — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราภาษีสุดท้ายคงที่ 25% สำหรับรายได้ที่ไม่คาดคิด เช่น ลอตเตอรี/เงินรางวัล — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная итоговая ставка 25% на случайный доход, например от лотереи/приза — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាពន្ធចុងក្រោយថេរ 25% លើប្រាក់ចំណូលចៃដន្យដូចជាឆ្នោត/រង្វាន់ — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "लटरी/पुरस्कार जस्ता आकस्मिक आयमा स्थिर २५% अन्तिम कर दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif pajak final tetap 25% untuk penghasilan tak terduga seperti lotre/hadiah — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ထီပေါက်ငွေ/ဆုကဲ့သို့ မမျှော်လင့်ဘဲရရှိငွေအတွက် ၂၅% နောက်ဆုံးပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "ලොතරැයි/ත්‍යාග වැනි අනපේක්ෂිත ආදායමට ස්ථාවර 25% අවසාන බදු අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Lotereya/mukofot kabi kutilmagan daromadga 25% qat'iy yakuniy soliq — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Сугалаа/шагнал зэрэг санамсаргүй орлогод 25% тогтмол эцсийн татвар — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Лотерея/сыйлық сияқты кездейсоқ табысқа 25% тұрақты түпкілікті салық — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Лотерея/сыйлык сыяктуу күтүлбөгөн кирешеге 25% туруктуу акыркы салык — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "لاٹری/انعامات جیسی غیر متوقع آمدنی پر 25% فلیٹ حتمی ٹیکس — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "লটারি/পুরস্কারের মতো অপ্রত্যাশিত আয়ে ২৫% ফ্ল্যাট চূড়ান্ত কর — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາພາສີສຸດທ້າຍຄົງທີ່ 25% ສຳລັບລາຍໄດ້ທີ່ບໍ່ຄາດຄິດເຊັ່ນ ເລກລອດເຕີຣີ/ລາງວັນ — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "宝くじ・賞金などの偶発的所得に一律25%の最終課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة نهائية ثابتة 25% على الدخل غير المتوقع مثل اليانصيب/الجوائز — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "लॉटरी/पुरस्कार जैसी अप्रत्याशित आय पर 25% फ्लैट अंतिम कर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux d'imposition final fixe de 25 % sur les revenus fortuits comme les loteries/prix — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 25% na huling buwis sa windfall income tulad ng lottery/premyo — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  lk: {
    title: () => pickLang('스리랑카에서도 또 내요?', 'Do I also pay in Sri Lanka?', '在斯里兰卡也要交税吗？', 'Có phải đóng thuế ở Sri Lanka nữa không?', 'ต้องเสียภาษีในศรีลังกาด้วยไหม?', 'Нужно ли платить налог ещё и в Шри-Ланке?', buildAlsoPayMore('lk')),
    sub: () => pickLang('해외 당첨금은 누진세율(최고 36%)로 직접 신고 — 이 계산기는 최고구간으로 근사, 미국에서 낸 세금은 세액공제로 상계 가능', 'Foreign winnings are self-declared at progressive rates (up to 36%) — this calculator approximates using the top bracket; the US tax already paid can offset it via tax credit', '境外中奖所得按累进税率（最高36%）自行申报 — 本计算器按最高档估算，已在美国缴纳的税款可通过税收抵免抵消', 'Tiền thắng từ nước ngoài tự khai báo theo thuế suất lũy tiến (tối đa 36%) — máy tính này ước tính theo bậc cao nhất, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'เงินรางวัลจากต่างประเทศต้องยื่นภาษีเองตามอัตราก้าวหน้า (สูงสุด 36%) — เครื่องคำนวณนี้ประมาณการที่อัตราสูงสุด ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Иностранный выигрыш декларируется самостоятельно по прогрессивной ставке (до 36%) — этот калькулятор использует приближение по верхней ставке, уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "ប្រាក់ឆ្នោតបរទេសត្រូវប្រកាសដោយខ្លួនឯងតាមអត្រាលំដាប់ (រហូតដល់ 36%) — ម៉ាស៊ីនគណនានេះប៉ាន់ស្មានតាមថ្នាក់ខ្ពស់បំផុត ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "विदेशी जितेको रकम प्रगतिशील दर (अधिकतम ३६%) मा स्वयं घोषणा गरिन्छ — यो क्यालकुलेटरले उच्चतम स्ल्याब प्रयोग गरी अनुमान गर्छ, अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Kemenangan luar negeri dilaporkan sendiri dengan tarif progresif (hingga 36%) — kalkulator ini memperkirakan dengan bracket tertinggi, pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "နိုင်ငံခြားဆုငွေများကို တိုးမြှင့်နှုန်း (အများဆုံး ၃၆%) ဖြင့် ကိုယ်တိုင်ကြေညာသည် — ဒီတွက်စက်သည် အမြင့်ဆုံးအလွှာဖြင့် ခန့်မှန်းသည်၊ အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "විදේශීය ජයග්‍රහණ ප්‍රගතිශීලී අනුපාතවලින් (උපරිම 36%) ස්වයං ප්‍රකාශ කෙරේ — මෙම ගණකය ඉහළම කාණ්ඩය භාවිතයෙන් ඇස්තමේන්තු කරයි, ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Xorijiy yutuqlar progressiv stavkalar (36%gacha) bo'yicha o'zi e'lon qilinadi — bu kalkulyator eng yuqori pog'onadan foydalanib taxmin qiladi, AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Гадаадын ялалтыг даамжирсан хувь (хамгийн ихдээ 36%)-аар өөрөө мэдүүлдэг — энэ тооцоолуур хамгийн дээд шатлалаар ойролцоолж тооцдог, АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Шетелдік ұтыс прогрессивті мөлшерлемемен (ең көбі 36%) өзі декларацияланады — бұл калькулятор ең жоғарғы санатпен жуықтайды, АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Чет өлкөдөгү утуш прогрессивдүү чен (эң көбү 36%) менен өзү декларацияланат — бул эсептегич эң жогорку категория менен болжолдойт, АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "غیر ملکی جیت ترقی پذیر شرحوں (زیادہ سے زیادہ 36%) پر خود ظاہر کی جاتی ہے — یہ کیلکولیٹر سب سے اونچے بریکٹ سے تخمینہ لگاتا ہے، امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "বিদেশি জয় প্রগতিশীল হারে (সর্বোচ্চ ৩৬%) নিজে ঘোষণা করতে হয় — এই ক্যালকুলেটর সর্বোচ্চ স্ল্যাব ব্যবহার করে অনুমান করে, যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ເງິນລາງວັນຕ່າງປະເທດຕ້ອງລາຍງານດ້ວຍຕົນເອງຕາມອັດຕາກ້າວໜ້າ (ສູງສຸດ 36%) — ເຄື່ອງຄິດໄລ່ນີ້ຄາດຄະເນດ້ວຍລະດັບສູງສຸດ, ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "海外の当選金は累進税率（最高36%）で自己申告 — この計算機は最高税率帯で概算、米国で既に納めた税金は税額控除で相殺できます", ar: "يُعلَن عن الأرباح الأجنبية ذاتيًا بمعدلات تصاعدية (حتى 36%) — تُقدّر هذه الآلة الحاسبة باستخدام أعلى شريحة، ويمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "विदेशी जीत प्रगतिशील दरों (अधिकतम 36%) पर स्वयं घोषित की जाती है — यह कैलकुलेटर उच्चतम स्लैब का उपयोग करके अनुमान लगाता है, अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Les gains étrangers sont auto-déclarés à des taux progressifs (jusqu'à 36 %) — ce calculateur estime avec la tranche la plus élevée ; l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Ang panalo mula sa ibang bansa ay self-declared sa progresibong rate (hanggang 36%) — tinatantya ng calculator na ito gamit ang pinakamataas na bracket; puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  uz: {
    title: () => pickLang('우즈베키스탄에서도 또 내요?', 'Do I also pay in Uzbekistan?', '在乌兹别克斯坦也要交税吗？', 'Có phải đóng thuế ở Uzbekistan nữa không?', 'ต้องเสียภาษีในอุซเบกิสถานด้วยไหม?', 'Нужно ли платить налог ещё и в Узбекистане?', buildAlsoPayMore('uz')),
    sub: () => pickLang('모든 개인소득에 12% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 12% rate on all personal income — the US tax already paid can offset it via tax credit', '所有个人所得适用12%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 12% trên mọi thu nhập cá nhân — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 12% สำหรับรายได้บุคคลทั้งหมด — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 12% на весь личный доход — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាថេរ 12% លើប្រាក់ចំណូលផ្ទាល់ខ្លួនទាំងអស់ — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "सबै व्यक्तिगत आयमा स्थिर १२% दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif tetap 12% untuk semua penghasilan pribadi — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ကိုယ်ရေးဝင်ငွေအားလုံးအတွက် ၁၂% ပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "සියලුම පුද්ගලික ආදායමට ස්ථාවර 12% අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Barcha shaxsiy daromadga 12% qat'iy stavka — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Бүх хувийн орлогод 12% тогтмол хувь — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Барлық жеке табысқа 12% тұрақты мөлшерлеме — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Бардык жеке кирешеге 12% туруктуу чен — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "تمام ذاتی آمدنی پر 12% فلیٹ ریٹ — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "সকল ব্যক্তিগত আয়ে ১২% ফ্ল্যাট হার — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາຄົງທີ່ 12% ສຳລັບລາຍໄດ້ສ່ວນຕົວທັງໝົດ — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "すべての個人所得に一律12%課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة ثابتة 12% على جميع الدخل الشخصي — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "सभी व्यक्तिगत आय पर 12% फ्लैट दर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux fixe de 12 % sur tout revenu personnel — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 12% rate sa lahat ng personal income — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  kz: {
    title: () => pickLang('카자흐스탄에서도 또 내요?', 'Do I also pay in Kazakhstan?', '在哈萨克斯坦也要交税吗？', 'Có phải đóng thuế ở Kazakhstan nữa không?', 'ต้องเสียภาษีในคาซัคสถานด้วยไหม?', 'Нужно ли платить налог ещё и в Казахстане?', buildAlsoPayMore('kz')),
    sub: () => pickLang('"당첨금" 항목에 거주자 기준 10% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 10% resident rate on the "winnings" category — the US tax already paid can offset it via tax credit', '"中奖所得"项目对居民适用10%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 10% cho cư dân trong danh mục "tiền thắng" — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 10% สำหรับผู้พำนักในหมวด "เงินรางวัล" — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 10% для резидентов по категории «выигрыш» — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាថេរ 10% សម្រាប់អ្នករស់នៅក្នុងប្រភេទ \"ប្រាក់ឈ្នះ\" — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "\"जितेको रकम\" श्रेणीमा बासिन्दाका लागि स्थिर १०% दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif tetap 10% bagi penduduk untuk kategori \"kemenangan\" — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "\"ဆုငွေ\" အမျိုးအစားတွင် နေထိုင်သူအတွက် ၁၀% ပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "\"ජයග්‍රහණ\" කාණ්ඩයට පදිංචිකරුවන් සඳහා ස්ථාවර 10% අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "\"Yutuq\" toifasi bo'yicha rezidentlar uchun 10% qat'iy stavka — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "\"Шагнал\" ангилалд оршин суугчийн хувьд 10% тогтмол хувь — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "\"Ұтыс\" санаты бойынша резиденттерге 10% тұрақты мөлшерлеме — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "\"Утуш\" категориясы боюнча резиденттер үчүн 10% туруктуу чен — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "\"جیت\" کیٹگری میں رہائشیوں کے لیے 10% فلیٹ ریٹ — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "\"জয়\" বিভাগে বাসিন্দাদের জন্য ১০% ফ্ল্যাট হার — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາຄົງທີ່ 10% ສຳລັບຜູ້ອາໄສໃນໝວດ \"ເງິນລາງວັນ\" — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "「当選金」区分に居住者向け一律10%課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة ثابتة 10% للمقيمين على فئة \"الأرباح\" — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "\"जीत\" श्रेणी में निवासियों के लिए 10% फ्लैट दर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux fixe de 10 % pour les résidents dans la catégorie « gains » — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 10% resident rate sa kategoryang \"panalo\" — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  kg: {
    title: () => pickLang('키르기스스탄에서도 또 내요?', 'Do I also pay in Kyrgyzstan?', '在吉尔吉斯斯坦也要交税吗？', 'Có phải đóng thuế ở Kyrgyzstan nữa không?', 'ต้องเสียภาษีในคีร์กีซสถานด้วยไหม?', 'Нужно ли платить налог ещё и в Кыргызстане?', buildAlsoPayMore('kg')),
    sub: () => pickLang('당첨금 포함 모든 개인소득에 10% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 10% rate on all personal income including winnings — the US tax already paid can offset it via tax credit', '包括中奖所得在内的所有个人所得适用10%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 10% trên mọi thu nhập cá nhân kể cả tiền thắng — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 10% สำหรับรายได้บุคคลทั้งหมดรวมถึงเงินรางวัล — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 10% на весь личный доход, включая выигрыши — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "អត្រាថេរ 10% លើប្រាក់ចំណូលផ្ទាល់ខ្លួនទាំងអស់ រួមទាំងប្រាក់ឈ្នះ — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "जितेको रकम सहित सबै व्यक्तिगत आयमा स्थिर १०% दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Tarif tetap 10% untuk semua penghasilan pribadi termasuk kemenangan — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "ဆုငွေအပါအဝင် ကိုယ်ရေးဝင်ငွေအားလုံးအတွက် ၁၀% ပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "ජයග්‍රහණ ඇතුළුව සියලුම පුද්ගලික ආදායමට ස්ථාවර 10% අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "Yutuqni ham qo'shgan holda barcha shaxsiy daromadga 10% qat'iy stavka — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "Шагналыг оролцуулан бүх хувийн орлогод 10% тогтмол хувь — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "Ұтысты қоса алғанда барлық жеке табысқа 10% тұрақты мөлшерлеме — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "Утушту кошо алганда бардык жеке кирешеге 10% туруктуу чен — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "جیت سمیت تمام ذاتی آمدنی پر 10% فلیٹ ریٹ — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "জয় সহ সকল ব্যক্তিগত আয়ে ১০% ফ্ল্যাট হার — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ອັດຕາຄົງທີ່ 10% ສຳລັບລາຍໄດ້ສ່ວນຕົວທັງໝົດ ລວມທັງເງິນລາງວັນ — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "当選金を含むすべての個人所得に一律10%課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "ضريبة ثابتة 10% على جميع الدخل الشخصي بما في ذلك الأرباح — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "जीत सहित सभी व्यक्तिगत आय पर 10% फ्लैट दर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Taux fixe de 10 % sur tout revenu personnel y compris les gains — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Flat 10% rate sa lahat ng personal income kasama ang panalo — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  mm: {
    title: () => pickLang('미얀마에서도 또 내요?', 'Do I also pay in Myanmar?', '在缅甸也要交税吗？', 'Có phải đóng thuế ở Myanmar nữa không?', 'ต้องเสียภาษีในเมียนมาด้วยไหม?', 'Нужно ли платить налог ещё и в Мьянме?', buildAlsoPayMore('mm')),
    sub: () => pickLang('"기타 소득"으로 분류돼 누진세율(최고 25%) 적용 — 이 계산기는 최고구간으로 근사, 미국에서 낸 세금은 세액공제로 상계 가능', 'Classified as "other income" and taxed at progressive rates (up to 25%) — this calculator approximates using the top bracket; the US tax already paid can offset it via tax credit', '归类为"其他所得"，适用累进税率（最高25%）— 本计算器按最高档估算，已在美国缴纳的税款可通过税收抵免抵消', 'Được phân loại là "thu nhập khác" và đánh thuế lũy tiến (tối đa 25%) — máy tính này ước tính theo bậc cao nhất, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'จัดเป็น "รายได้อื่น" และเก็บภาษีแบบก้าวหน้า (สูงสุด 25%) — เครื่องคำนวณนี้ประมาณการที่อัตราสูงสุด ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Классифицируется как «прочий доход» и облагается прогрессивным налогом (до 25%) — этот калькулятор использует приближение по верхней ставке, уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "ចាត់ថ្នាក់ជា \"ប្រាក់ចំណូលផ្សេងទៀត\" និងយកពន្ធតាមអត្រាលំដាប់ (រហូតដល់ 25%) — ម៉ាស៊ីនគណនានេះប៉ាន់ស្មានតាមថ្នាក់ខ្ពស់បំផុត ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "\"अन्य आय\" को रूपमा वर्गीकृत गरी प्रगतिशील दर (अधिकतम २५%) मा कर लगाइन्छ — यो क्यालकुलेटरले उच्चतम स्ल्याब प्रयोग गरी अनुमान गर्छ, अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Diklasifikasikan sebagai \"penghasilan lain\" dan dikenakan pajak progresif (hingga 25%) — kalkulator ini memperkirakan dengan bracket tertinggi, pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "\"အခြားဝင်ငွေ\" အဖြစ်သတ်မှတ်ပြီး တိုးမြှင့်နှုန်း (အများဆုံး ၂၅%) ဖြင့် အခွန်ကောက်သည် — ဒီတွက်စက်သည် အမြင့်ဆုံးအလွှာဖြင့် ခန့်မှန်းသည်၊ အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "\"වෙනත් ආදායම\" ලෙස වර්ගීකරණය කර ප්‍රගතිශීලී අනුපාතවලින් (උපරිම 25%) බදු අය කෙරේ — මෙම ගණකය ඉහළම කාණ්ඩය භාවිතයෙන් ඇස්තමේන්තු කරයි, ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "\"Boshqa daromad\" sifatida tasniflanib progressiv stavkalar (25%gacha) bo'yicha soliqqa tortiladi — bu kalkulyator eng yuqori pog'onadan foydalanib taxmin qiladi, AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "\"Бусад орлого\" гэж ангилагдаж даамжирсан хувь (хамгийн ихдээ 25%)-аар татварладаг — энэ тооцоолуур хамгийн дээд шатлалаар ойролцоолж тооцдог, АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "\"Басқа табыс\" ретінде жіктеліп прогрессивті мөлшерлемемен (ең көбі 25%) салық салынады — бұл калькулятор ең жоғарғы санатпен жуықтайды, АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "\"Башка киреше\" катары классификацияланып прогрессивдүү чен (эң көбү 25%) менен салыкка алынат — бул эсептегич эң жогорку категория менен болжолдойт, АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "\"دیگر آمدنی\" کے طور پر درجہ بندی ہو کر ترقی پذیر شرحوں (زیادہ سے زیادہ 25%) پر ٹیکس عائد ہوتی ہے — یہ کیلکولیٹر سب سے اونچے بریکٹ سے تخمینہ لگاتا ہے، امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "\"অন্যান্য আয়\" হিসেবে শ্রেণীবদ্ধ হয়ে প্রগতিশীল হারে (সর্বোচ্চ ২৫%) কর আরোপিত হয় — এই ক্যালকুলেটর সর্বোচ্চ স্ল্যাব ব্যবহার করে অনুমান করে, যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ຈັດເປັນ \"ລາຍໄດ້ອື່ນ\" ແລະເກັບພາສີແບບກ້າວໜ້າ (ສູງສຸດ 25%) — ເຄື່ອງຄິດໄລ່ນີ້ຄາດຄະເນດ້ວຍລະດັບສູງສຸດ, ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "「その他所得」に分類され累進税率（最高25%）を適用 — この計算機は最高税率帯で概算、米国で既に納めた税金は税額控除で相殺できます", ar: "تُصنَّف \"دخلاً آخر\" وتُفرض عليها ضريبة تصاعدية (حتى 25%) — تُقدّر هذه الآلة الحاسبة باستخدام أعلى شريحة، ويمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "\"अन्य आय\" के रूप में वर्गीकृत होकर प्रगतिशील दरों (अधिकतम 25%) पर कर लगाया जाता है — यह कैलकुलेटर उच्चतम स्लैब का उपयोग करके अनुमान लगाता है, अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Classé comme « autre revenu » et imposé à des taux progressifs (jusqu'à 25 %) — ce calculateur estime avec la tranche la plus élevée ; l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Inuuri bilang \"iba pang kita\" at binubuwisan sa progresibong rate (hanggang 25%) — tinatantya ng calculator na ito gamit ang pinakamataas na bracket; puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  bd: {
    title: () => pickLang('방글라데시에서도 또 내요?', 'Do I also pay in Bangladesh?', '在孟加拉国也要交税吗？', 'Có phải đóng thuế ở Bangladesh nữa không?', 'ต้องเสียภาษีในบังกลาเทศด้วยไหม?', 'Нужно ли платить налог ещё и в Бангладеш?', buildAlsoPayMore('bd')),
    sub: () => pickLang('"기타 소득"으로 분류돼 25% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Classified as "other income" with a flat 25% rate — the US tax already paid can offset it via tax credit', '归类为"其他所得"，适用25%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Được phân loại là "thu nhập khác" với thuế suất cố định 25% — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'จัดเป็น "รายได้อื่น" อัตราคงที่ 25% — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Классифицируется как «прочий доход» с фиксированной ставкой 25% — уже уплаченный в США налог можно зачесть налоговым кредитом', { km: "ចាត់ថ្នាក់ជា \"ប្រាក់ចំណូលផ្សេងទៀត\" ជាមួយអត្រាថេរ 25% — ពន្ធដែលបានបង់នៅអាមេរិកអាចទូទាត់វិញតាមរយៈឥណទានពន្ធ", ne: "\"अन्य आय\" को रूपमा वर्गीकृत गरी स्थिर २५% दर — अमेरिकामा तिरिसकेको कर कर क्रेडिटबाट अफसेट गर्न सकिन्छ", id: "Diklasifikasikan sebagai \"penghasilan lain\" dengan tarif tetap 25% — pajak yang sudah dibayar di AS bisa dikompensasi lewat kredit pajak", my: "\"အခြားဝင်ငွေ\" အဖြစ်သတ်မှတ်ပြီး ၂၅% ပုံသေနှုန်း — အမေရိကန်တွင်ပေးပြီးသားအခွန်ကို အခွန်ခရက်ဒစ်ဖြင့် ခုနှိမ်နိုင်သည်", si: "\"වෙනත් ආදායම\" ලෙස වර්ගීකරණය කර ස්ථාවර 25% අනුපාතය — ඇමරිකාවේ දැනටමත් ගෙවූ බද්ද බදු ණයෙන් ප්‍රතිසන්තුලනය කළ හැක", uz: "\"Boshqa daromad\" sifatida tasniflanib 25% qat'iy stavka — AQShda to'langan soliqni soliq krediti orqali qoplash mumkin", mn: "\"Бусад орлого\" гэж ангилагдаж 25% тогтмол хувь — АНУ-д төлсөн татварыг татварын хөнгөлөлтөөр нөхөх боломжтой", kk: "\"Басқа табыс\" ретінде жіктеліп 25% тұрақты мөлшерлеме — АҚШ-та төленген салықты салық несиесімен өтеуге болады", ky: "\"Башка киреше\" катары классификацияланып 25% туруктуу чен — АКШда төлөнгөн салыкты салык кредити менен төлөшкө болот", ur: "\"دیگر آمدنی\" کے طور پر درجہ بندی ہو کر 25% فلیٹ ریٹ — امریکہ میں ادا شدہ ٹیکس کو ٹیکس کریڈٹ سے پورا کیا جا سکتا ہے", bn: "\"অন্যান্য আয়\" হিসেবে শ্রেণীবদ্ধ হয়ে ২৫% ফ্ল্যাট হার — যুক্তরাষ্ট্রে ইতিমধ্যে পরিশোধিত কর ট্যাক্স ক্রেডিটের মাধ্যমে সমন্বয় করা যায়", lo: "ຈັດເປັນ \"ລາຍໄດ້ອື່ນ\" ອັດຕາຄົງທີ່ 25% — ພາສີທີ່ຈ່າຍໃນອາເມລິກາແລ້ວສາມາດຫັກລ້າງໄດ້ດ້ວຍເຄຣດິດພາສີ", ja: "「その他所得」に分類され一律25%課税 — 米国で既に納めた税金は税額控除で相殺できます", ar: "تُصنَّف \"دخلاً آخر\" بمعدل ثابت 25% — يمكن تعويض الضريبة المدفوعة بالفعل في أمريكا عبر الائتمان الضريبي", hi: "\"अन्य आय\" के रूप में वर्गीकृत होकर 25% फ्लैट दर — अमेरिका में पहले से चुकाए गए कर की भरपाई टैक्स क्रेडिट से हो सकती है", fr: "Classé comme « autre revenu » avec un taux fixe de 25 % — l'impôt déjà payé aux États-Unis peut être compensé par un crédit d'impôt", tl: "Inuuri bilang \"iba pang kita\" na may flat 25% rate — puwedeng i-offset ng tax credit ang buwis na naibayad na sa US" })
  },
  pk: {
    title: () => pickLang('파키스탄에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Pakistan? (estimate ⚠️)', '在巴基斯坦也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Pakistan nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในปากีสถานด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Пакистане? (оценка ⚠️)', buildAlsoPayMore('pk', 'estimate')),
    sub: () => pickLang('복권 원천징수 규정(20~40%)이 자국 지급기관 전제라 적용 여부 불명확해, 일반 소득세 최고구간(35%)으로 추정 계산했어요. 여기에 잭팟 규모 당첨금은 Super Tax(8%)와 서차지(세액의 10%)까지 더 붙어요 — 실제와 다를 수 있어요', 'Pakistan’s lottery withholding rule (20–40%) assumes a local payer, so it’s unclear if it applies here — we estimated using the top general income tax rate (35%) instead. A jackpot-sized win also triggers Pakistan’s Super Tax (8%) and a surcharge (10% of the tax amount); the real amount may differ', '巴基斯坦彩票预扣规定（20%~40%）以境内支付方为前提，是否适用尚不明确，故按一般所得税最高档（35%）估算。头奖规模的奖金还会额外产生Super Tax（8%）和附加税（税额的10%）— 可能与实际不同', 'Quy định khấu trừ xổ số của Pakistan (20–40%) giả định bên chi trả trong nước nên chưa rõ có áp dụng không — chúng tôi ước tính theo thuế suất thu nhập chung cao nhất (35%) thay thế. Với tiền thắng cỡ jackpot còn phát sinh thêm Super Tax (8%) và phụ thu (10% số thuế) — số tiền thực tế có thể khác', 'กฎการหักภาษี ณ ที่จ่ายลอตเตอรีของปากีสถาน (20–40%) อ้างอิงกรณีผู้จ่ายในประเทศ จึงยังไม่ชัดเจนว่าใช้ได้หรือไม่ เราจึงประมาณด้วยอัตราภาษีเงินได้ทั่วไปสูงสุด (35%) แทน เงินรางวัลระดับแจ็คพอตยังมี Super Tax (8%) และเงินเพิ่ม (10% ของภาษี) เพิ่มเข้ามาอีก — จำนวนจริงอาจแตกต่างออกไป', 'Пакистанское правило удержания налога с лотереи (20–40%) предполагает местного плательщика, поэтому неясно, применимо ли оно — мы использовали оценку по максимальной обычной ставке подоходного налога (35%). Для выигрыша джекпот-уровня также добавляются пакистанский Super Tax (8%) и надбавка (10% от суммы налога); реальная сумма может отличаться', { km: "បទប្បញ្ញត្តិកាត់ទុកពន្ធឆ្នោតរបស់ប៉ាគីស្ថាន (20~40%) សន្មតថាមានអ្នកបង់ប្រាក់ក្នុងស្រុក ដូច្នេះមិនច្បាស់ថាតើអនុវត្តទេ — យើងបានប៉ាន់ស្មានដោយប្រើអត្រាពន្ធលើប្រាក់ចំណូលទូទៅខ្ពស់បំផុត (35%) ជំនួសវិញ។ ប្រាក់ឆ្នោតទំហំធំក៏មាន Super Tax (8%) និងកម្រៃបន្ថែម (10% នៃចំនួនពន្ធ) — ចំនួនពិតប្រាកដអាចខុសគ្នា", ne: "पाकिस्तानको लटरी कट्टी नियम (२०–४०%) ले स्थानीय भुक्तानीकर्ता मान्दछ, त्यसैले यहाँ लागू हुन्छ कि हुँदैन स्पष्ट छैन — हामीले सामान्य आयकरको उच्चतम स्ल्याब (३५%) प्रयोग गरी अनुमान गर्यौं। जुनसुकै ठूलो रकम जित्दा Super Tax (8%) र सरचार्ज (कर रकमको 10%) पनि थपिन्छ — वास्तविक रकम फरक हुन सक्छ", id: "Aturan pemotongan lotre Pakistan (20–40%) mengasumsikan pembayar lokal, jadi belum jelas apakah berlaku di sini — kami memperkirakan menggunakan tarif pajak penghasilan umum tertinggi (35%) sebagai gantinya. Kemenangan sebesar jackpot juga memicu Super Tax Pakistan (8%) dan biaya tambahan (10% dari jumlah pajak) — jumlah sebenarnya bisa berbeda", my: "ပါကစ္စတန်၏ ထီနှုတ်ယူခွန်စည်းမျဉ်း (20~40%) သည် ပြည်တွင်းငွေပေးချေသူကို ယူဆထားသဖြင့် ဒီနေရာတွင်အသုံးချမလား မသေချာပါ — ကျွန်ုပ်တို့သည် ယေဘုယျဝင်ငွေခွန်၏ အများဆုံးအလွှာ (35%) ဖြင့် ခန့်မှန်းခဲ့ပါသည်။ ဂျက်ပေါ့အဆင့်ဆုငွေတွင် Super Tax (8%) နှင့် အခွန်ပမာဏ၏ 10% ထပ်ဆောင်းကောက်ခံသည် — အမှန်တကယ်ပမာဏ ကွာခြားနိုင်သည်", si: "පකිස්තානයේ ලොතරැයි අඩුකිරීමේ නීතිය (20–40%) දේශීය ගෙවන්නෙකු උපකල්පනය කරයි, එබැවින් මෙහි අදාළද යන්න පැහැදිලි නැත — අපි ඒ වෙනුවට ඉහළම සාමාන්‍ය ආදායම් බදු අනුපාතය (35%) භාවිතයෙන් ඇස්තමේන්තු කළෙමු. ජැක්පොට් ප්‍රමාණයේ ජයග්‍රහණයකට පකිස්තානයේ Super Tax (8%) සහ අතිරේක ගාස්තුවක් (බදු ප්‍රමාණයෙන් 10%) ද එකතු වේ — සැබෑ ප්‍රමාණය වෙනස් විය හැක", uz: "Pokistonning lotereya ushlab qolish qoidasi (20–40%) mahalliy to'lovchini nazarda tutadi, shuning uchun bu yerda qo'llanilishi aniq emas — biz o'rniga eng yuqori umumiy daromad solig'i stavkasi (35%) bo'yicha taxmin qildik. Jackpot darajasidagi yutuq Pokistonning Super Tax (8%) va ustama to'lovini (soliq summasining 10%) ham keltirib chiqaradi — haqiqiy summa farq qilishi mumkin", mn: "Пакистаны сугалааны суутгалын дүрэм (20–40%) нь дотоодын төлөгчийг таамагладаг тул энд хэрэгжих эсэх тодорхойгүй — оронд нь бид ерөнхий орлогын албан татварын хамгийн дээд шатлал (35%)-аар тооцоолсон. Джекпот хэмжээний ялалт нь Пакистаны Super Tax (8%) болон нэмэлт төлбөр (татварын дүнгийн 10%) -ийг мөн үүсгэдэг — бодит дүн өөр байж болно", kk: "Пәкістанның лотерея ұстау ережесі (20–40%) жергілікті төлеушіні болжайды, сондықтан бұл жерде қолданыла ма белгісіз — біз оның орнына ең жоғарғы жалпы табыс салығы мөлшерлемесін (35%) пайдаланып бағаладық. Джекпот деңгейіндегі ұтыс Пәкістанның Super Tax (8%) және үстеме төлемін (салық сомасының 10%) де тудырады — нақты сома өзгеше болуы мүмкін", ky: "Пакистандын лотерея кармоо эрежеси (20–40%) жергиликтүү төлөөчүнү болжолдойт, ошондуктан бул жерде колдонулабы белгисиз — биз анын ордуна эң жогорку жалпы киреше салыгынын чени (35%) менен болжолдук. Джекпот өлчөмүндөгү утуш Пакистандын Super Tax (8%) жана кошумча төлөмдү (салык суммасынын 10%) да пайда кылат — чыныгы сумма башкача болушу мүмкүн", ur: "پاکستان کا لاٹری کٹوتی کا اصول (20–40%) مقامی ادائیگی کنندہ کو فرض کرتا ہے، اس لیے یہاں لاگو ہوتا ہے یا نہیں واضح نہیں — ہم نے اس کے بجائے سب سے اونچی عام انکم ٹیکس شرح (35%) استعمال کرتے ہوئے تخمینہ لگایا۔ جیک پاٹ سائز کی جیت پر پاکستان کا سپر ٹیکس (8%) اور سرچارج (ٹیکس رقم کا 10%) بھی لاگو ہوتا ہے — اصل رقم مختلف ہو سکتی ہے", bn: "পাকিস্তানের লটারি কর্তন নিয়ম (২০–৪০%) স্থানীয় প্রদানকারী ধরে নেয়, তাই এখানে প্রযোজ্য কিনা স্পষ্ট নয় — আমরা পরিবর্তে সর্বোচ্চ সাধারণ আয়কর হার (৩৫%) ব্যবহার করে অনুমান করেছি। জ্যাকপট আকারের জয়ে পাকিস্তানের সুপার ট্যাক্স (৮%) এবং সারচার্জ (করের পরিমাণের ১০%) যোগ হয় — প্রকৃত পরিমাণ ভিন্ন হতে পারে", lo: "ກົດລະບຽບການຫັກພາສີເລກລອດເຕີຣີຂອງປາກີສະຖານ (20–40%) ສົມມຸດວ່າມີຜູ້ຈ່າຍພາຍໃນປະເທດ ດັ່ງນັ້ນຍັງບໍ່ຈະແຈ້ງວ່າໃຊ້ໄດ້ຫຼືບໍ່ — ພວກເຮົາຄາດຄະເນໂດຍໃຊ້ອັດຕາພາສີລາຍໄດ້ທົ່ວໄປສູງສຸດ (35%) ແທນ. ເງິນລາງວັນລະດັບແຈັກພັອດຍັງມີ Super Tax (8%) ແລະຄ່າທຳນຽມເພີ່ມ (10% ຂອງຈຳນວນພາສີ) — ຈຳນວນຈິງອາດແຕກຕ່າງ", ja: "パキスタンの宝くじ源泉徴収規定（20〜40%）は国内の支払機関を前提としており、適用されるか不明確なため、一般所得税の最高税率帯（35%）で推定計算しました。ジャックポット規模の当選金にはさらにSuper Tax（8%）とサーチャージ（税額の10%）が加わります — 実際とは異なる場合があります", ar: "تفترض قاعدة اقتطاع اليانصيب الباكستانية (20–40%) وجود جهة دفع محلية، لذا من غير الواضح ما إذا كانت تنطبق هنا — قدّرنا بدلاً من ذلك باستخدام أعلى معدل ضريبة دخل عام (35%). كما تخضع الأرباح بحجم الجائزة الكبرى لضريبة Super Tax الباكستانية (8%) ورسم إضافي (10% من مبلغ الضريبة) — قد يختلف المبلغ الفعلي", hi: "पाकिस्तान का लॉटरी कटौती नियम (20–40%) स्थानीय भुगतानकर्ता मानता है, इसलिए यहां लागू होता है या नहीं स्पष्ट नहीं है — हमने इसके बजाय उच्चतम सामान्य आयकर दर (35%) का उपयोग करके अनुमान लगाया। जैकपॉट आकार की जीत पर पाकिस्तान का सुपर टैक्स (8%) और अधिभार (कर राशि का 10%) भी जुड़ता है — वास्तविक राशि भिन्न हो सकती है", fr: "La règle de retenue sur les loteries au Pakistan (20–40 %) suppose un payeur local, donc son application ici n'est pas claire — nous avons plutôt estimé avec le taux d'impôt sur le revenu général le plus élevé (35 %). Un gain de la taille d'un jackpot déclenche aussi la Super Tax pakistanaise (8 %) et une surtaxe (10 % du montant de l'impôt) ; le montant réel peut différer", tl: "Ipinapalagay ng withholding rule ng Pakistan para sa lottery (20–40%) na may lokal na nagbabayad, kaya hindi malinaw kung naaangkop ito rito — sa halip, tinantya namin gamit ang pinakamataas na general income tax rate (35%). Ang panalong kasing-laki ng jackpot ay may dagdag na Super Tax ng Pakistan (8%) at surcharge (10% ng halaga ng buwis); maaaring iba ang aktwal na halaga" })
  },
  kh: {
    title: () => pickLang('캄보디아에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Cambodia? (estimate ⚠️)', '在柬埔寨也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Campuchia nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในกัมพูชาด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Камбодже? (оценка ⚠️)', buildAlsoPayMore('kh', 'estimate')),
    sub: () => pickLang('개인 복권·상금 소득을 과세하는 명확한 캄보디아 법 조항을 찾지 못해, 추가 세금을 0원으로 가정했어요 — 실제로는 과세될 수도 있어요', 'We couldn’t find a clear Cambodian law provision taxing personal lottery/prize income, so we assumed ₩0 additional tax — you could still owe tax in reality', '未能找到明确对个人彩票、奖金所得征税的柬埔寨法律条款，故假设追加税额为0韩元 — 实际仍可能需要纳税', 'Chúng tôi không tìm thấy quy định rõ ràng trong luật Campuchia đánh thuế thu nhập cá nhân từ xổ số/tiền thưởng, nên giả định thuế bổ sung là 0 won — thực tế bạn vẫn có thể phải đóng thuế', 'เราไม่พบข้อกำหนดที่ชัดเจนในกฎหมายกัมพูชาที่เก็บภาษีรายได้บุคคลจากลอตเตอรี/เงินรางวัล จึงสมมติว่าภาษีเพิ่มเติมเป็น 0 วอน — ในความเป็นจริงคุณอาจยังต้องเสียภาษี', 'Мы не смогли найти чёткого положения в законодательстве Камбоджи, облагающего налогом личный доход от лотереи/приза, поэтому предположили дополнительный налог в 0 вон — на практике налог всё же может взиматься', { km: "យើងមិនបានរកឃើញបទប្បញ្ញត្តិច្បាស់លាស់នៃច្បាប់កម្ពុជាដែលយកពន្ធលើប្រាក់ចំណូលឆ្នោត/រង្វាន់ផ្ទាល់ខ្លួន ដូច្នេះយើងបានសន្មតថាពន្ធបន្ថែមគឺ 0 វុន — តាមការពិតអ្នកអាចនៅតែជំពាក់ពន្ធ", ne: "व्यक्तिगत लटरी/पुरस्कार आयमा कर लगाउने स्पष्ट कम्बोडियाली कानूनी प्रावधान भेटिएन, त्यसैले हामीले थप कर ₩0 मानेका छौं — वास्तवमा तपाईंले अझै कर तिर्नुपर्न सक्छ", id: "Kami tidak menemukan ketentuan hukum Kamboja yang jelas mengenakan pajak atas penghasilan lotre/hadiah pribadi, jadi kami mengasumsikan pajak tambahan ₩0 — Anda mungkin tetap berutang pajak dalam kenyataannya", my: "ကိုယ်ရေးထီပေါက်ငွေ/ဆုငွေဝင်ငွေကို အခွန်ကောက်ခံသည့် ကမ္ဘောဒီးယားဥပဒေပြဋ္ဌာန်းချက် ရှင်းလင်းစွာ ရှာမတွေ့ခဲ့ပါ၊ ထို့ကြောင့် ထပ်ဆောင်းအခွန်ကို ₩0 ဟု ယူဆခဲ့ပါသည် — အမှန်တကယ်တွင် အခွန်ကျန်နေနိုင်ပါသေးသည်", si: "පුද්ගලික ලොතරැයි/ත්‍යාග ආදායමට බදු අය කරන පැහැදිලි කාම්බෝජ නීති විධිවිධානයක් අපට සොයාගත නොහැකි විය, එබැවින් අමතර බද්ද ₩0 ලෙස උපකල්පනය කළෙමු — යථාර්ථයේදී ඔබට තවමත් බදු ගෙවීමට සිදුවිය හැක", uz: "Shaxsiy lotereya/mukofot daromadiga soliq soladigan aniq Kambodja qonun qoidasini topa olmadik, shuning uchun qo'shimcha solig'ini ₩0 deb faraz qildik — haqiqatda hali ham soliq to'lashingiz mumkin", mn: "Хувийн сугалаа/шагналын орлогод татвар ногдуулах тодорхой Камбожийн хуулийн заалт олдсонгүй тул нэмэлт татварыг ₩0 гэж үзсэн — бодит байдал дээр та бүгд татвар төлөх шаардлагатай хэвээр байж болно", kk: "Жеке лотерея/сыйлық табысына салық салатын нақты Камбоджа заң нормасын таба алмадық, сондықтан қосымша салықты ₩0 деп есептедік — шын мәнінде сіз әлі де салық төлеуге тиіс болуыңыз мүмкін", ky: "Жеке лотерея/сыйлык кирешесине салык салган так Камбожа мыйзам ченемин таба алган жокбуз, ошондуктан кошумча салыкты ₩0 деп божомолдодук — чындыгында сиз дагы деле салык төлөшүңүз мүмкүн", ur: "ذاتی لاٹری/انعامی آمدنی پر ٹیکس عائد کرنے والا کوئی واضح کمبوڈین قانونی شق نہیں مل سکا، اس لیے ہم نے اضافی ٹیکس ₩0 فرض کیا — حقیقت میں آپ پر اب بھی ٹیکس واجب ہو سکتا ہے", bn: "ব্যক্তিগত লটারি/পুরস্কার আয়ে কর আরোপকারী স্পষ্ট কম্বোডিয়ান আইনি বিধান খুঁজে পাওয়া যায়নি, তাই আমরা অতিরিক্ত কর ₩0 ধরে নিয়েছি — বাস্তবে আপনার এখনও কর দিতে হতে পারে", lo: "ພວກເຮົາບໍ່ພົບຂໍ້ກຳນົດກົດໝາຍກຳປູເຈຍທີ່ຈະແຈ້ງທີ່ເກັບພາສີລາຍໄດ້ບຸກຄົນຈາກເລກລອດເຕີຣີ/ລາງວັນ ດັ່ງນັ້ນພວກເຮົາສົມມຸດວ່າພາສີເພີ່ມເຕີມແມ່ນ ₩0 — ໃນຄວາມເປັນຈິງທ່ານອາດຍັງຕ້ອງເສຍພາສີ", ja: "個人の宝くじ・賞金所得に課税する明確なカンボジア法規定が見つからなかったため、追加税額を₩0と仮定しました — 実際には課税される可能性があります", ar: "لم نتمكن من العثور على حكم قانوني كمبودي واضح يفرض ضريبة على دخل اليانصيب/الجوائز الشخصية، لذا افترضنا ضريبة إضافية قدرها ₩0 — قد يكون عليك دفع ضريبة فعليًا", hi: "व्यक्तिगत लॉटरी/पुरस्कार आय पर कर लगाने वाला कोई स्पष्ट कम्बोडियाई कानूनी प्रावधान नहीं मिला, इसलिए हमने अतिरिक्त कर ₩0 मान लिया — वास्तव में आप पर अभी भी कर देय हो सकता है", fr: "Nous n'avons pas trouvé de disposition légale cambodgienne claire imposant les revenus personnels de loterie/prix, nous avons donc supposé un impôt supplémentaire de ₩0 — vous pourriez tout de même devoir de l'impôt en réalité", tl: "Hindi kami nakahanap ng malinaw na probisyon sa batas ng Cambodia na nagpapabuwis sa personal na lottery/prize income, kaya inasumang ₩0 ang karagdagang buwis — posibleng may dapat ka pa ring bayarang buwis sa totoong buhay" })
  },
  mn: {
    title: () => pickLang('몽골에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Mongolia? (estimate ⚠️)', '在蒙古也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Mông Cổ nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในมองโกเลียด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Монголии? (оценка ⚠️)', buildAlsoPayMore('mn', 'estimate')),
    sub: () => pickLang('베팅·도박성 당첨금 40% 조항은 2025년 국내 베팅업 금지 때 함께 폐지됐어요. 해외 복권 당첨금을 명시한 대체 조항을 찾지 못해, 가장 근접한 기타소득 단일세율(10%)을 잠정 적용했어요 — 실제와 다를 수 있어요', "The 40% rate for gambling/betting winnings was repealed along with Mongolia's 2025 domestic betting ban. We couldn't find a replacement provision specifically for foreign lottery winnings, so we tentatively applied the closest match — the flat 10% rate for other income — the real amount may differ", '博彩类中奖40%的条款已随蒙古2025年境内禁止博彩业一并废止。由于未找到专门针对境外彩票中奖的替代条款，暂按最接近的其他所得单一税率（10%）估算 — 可能与实际不同', 'Mức thuế 40% cho tiền thắng cờ bạc/cá cược đã bị bãi bỏ cùng với lệnh cấm cá cược trong nước năm 2025 của Mông Cổ. Do không tìm thấy quy định thay thế dành riêng cho tiền thắng xổ số nước ngoài, chúng tôi tạm áp dụng mức gần nhất — thuế suất cố định 10% cho thu nhập khác — số tiền thực tế có thể khác', 'อัตราภาษี 40% สำหรับเงินได้จากการพนัน/พนันขันต่อถูกยกเลิกไปพร้อมกับการห้ามพนันในประเทศของมองโกเลียปี 2025 เนื่องจากไม่พบข้อกำหนดทดแทนสำหรับเงินรางวัลลอตเตอรีต่างประเทศโดยเฉพาะ จึงใช้อัตราที่ใกล้เคียงที่สุดชั่วคราว — อัตราคงที่ 10% สำหรับรายได้อื่น — จำนวนจริงอาจแตกต่างออกไป', 'Ставка 40% для выигрышей от азартных игр/ставок была отменена вместе с запретом внутреннего игорного бизнеса в Монголии в 2025 году. Поскольку не найдено отдельного положения для иностранного лотерейного выигрыша, мы временно применили ближайшее совпадение — фиксированную ставку 10% для прочего дохода — реальная сумма может отличаться', {
    km: "អត្រា 40% សម្រាប់ការភ្នាល់/ល្បែងស៊ីសងត្រូវបានលុបចោលរួមជាមួយការហាមឃាត់អាជីវកម្មភ្នាល់ក្នុងស្រុករបស់ម៉ុងហ្គោលីឆ្នាំ 2025។ ដោយសារយើងមិនបានរកឃើញបទប្បញ្ញត្តិជំនួសសម្រាប់ប្រាក់ឆ្នោតបរទេសជាពិសេស យើងបានអនុវត្តអត្រាដែលជិតបំផុតជាបណ្តោះអាសន្ន — អត្រាថេរ 10% សម្រាប់ប្រាក់ចំណូលផ្សេងទៀត — ចំនួនពិតប្រាកដអាចខុសគ្នា",
    ne: "बेटिङ/जुवा जित्नेमा लाग्ने ४०% दर मंगोलियाको २०२५ को घरेलु सट्टेबाजी प्रतिबन्धसँगै खारेज भयो। विदेशी लटरी जित विशेष गरी उल्लेख गर्ने प्रतिस्थापन प्रावधान नभेटिएकोले, हामीले सबैभन्दा नजिकको मेल — अन्य आयमा लाग्ने स्थिर १०% दर — अस्थायी रूपमा लागू गर्यौं — वास्तविक रकम फरक हुन सक्छ",
    id: "Tarif 40% untuk kemenangan judi/taruhan telah dicabut bersamaan dengan larangan taruhan domestik Mongolia 2025. Karena kami tidak menemukan ketentuan pengganti khusus untuk kemenangan lotre luar negeri, kami menerapkan yang paling mendekati untuk sementara — tarif tetap 10% untuk penghasilan lain — jumlah sebenarnya bisa berbeda",
    my: "လောင်းကစား/ဆော့ကစားဆုငွေအတွက် ၄၀% နှုန်းသည် မွန်ဂိုလီယာ၏ ၂၀၂၅ ပြည်တွင်းလောင်းကစားပိတ်ပင်မှုနှင့်အတူ ပယ်ဖျက်ခံခဲ့ရသည်။ နိုင်ငံခြားထီပေါက်ငွေအတွက် အစားထိုးစည်းမျဉ်းကို အထူးရှာမတွေ့ခဲ့သဖြင့်၊ အနီးစပ်ဆုံးဖြစ်သော အခြားဝင်ငွေအတွက် ၁၀% ပုံသေနှုန်းကို ယာယီအသုံးပြုခဲ့ပါသည် — အမှန်တကယ်ပမာဏ ကွာခြားနိုင်သည်",
    si: "සූදුව/ඔට්ටු ජයග්‍රහණ සඳහා 40% අනුපාතය මොංගෝලියාවේ 2025 දේශීය ඔට්ටු තහනම සමඟ අහෝසි කරන ලදී. විදේශීය ලොතරැයි ජයග්‍රහණ සඳහා විශේෂිත ආදේශන විධිවිධානයක් අප සොයාගත නොහැකි වූ බැවින්, අප තාවකාලිකව ළඟම ගැලපීම යෙදුවෙමු — වෙනත් ආදායම සඳහා ස්ථාවර 10% අනුපාතය — සැබෑ ප්‍රමාණය වෙනස් විය හැක",
    uz: "Qimor/tikish yutuqlari uchun 40% stavka Mongoliyaning 2025-yilgi ichki tikish taqig'i bilan birga bekor qilindi. Xorijiy lotereya yutuqlari uchun maxsus almashtiruvchi qoida topilmagani sababli, biz vaqtincha eng yaqin mosni qo'lladik — boshqa daromad uchun 10% qat'iy stavka — haqiqiy summa farq qilishi mumkin",
    mn: "Бооцоо/тоглоомын ялалтад ногдох 40% хувь Монголын 2025 оны дотоодын бооцооны хориглолттой хамт хүчингүй болсон. Гадаадын сугалааны ялалтад зориулсан орлуулах заалт олдоогүй тул бид хамгийн ойрын тохирол — бусад орлогод ногдох 10% тогтмол хувийг — түр хугацаагаар хэрэглэсэн — бодит дүн өөр байж болно",
    kk: "Ойын/бәс тігу ұтысына арналған 40% мөлшерлеме Моңғолияның 2025 жылғы ішкі бәс тігу тыйымымен бірге жойылды. Шетелдік лотерея ұтысына арналған алмастыратын ереже табылмағандықтан, біз ең жақын сәйкестікті — басқа табысқа арналған 10% тұрақты мөлшерлемені — уақытша қолдандық — нақты сома өзгеше болуы мүмкін",
    ky: "Бооз/оюн утушуна 40% чен Монголиянын 2025-жылдагы ички бооз тыюусу менен кошо жоюлду. Чет өлкөдөгү лотерея утушу үчүн атайын алмаштыруучу эреже табылбагандыктан, биз эң жакын дал келүүнү — башка кирешеге 10% туруктуу ченди — убактылуу колдондук — чыныгы сумма башкача болушу мүмкүн",
    ur: "جوا/شرط جیت پر 40% شرح منگولیا کی 2025 کی ملکی شرط پابندی کے ساتھ ختم کر دی گئی۔ چونکہ ہمیں غیر ملکی لاٹری جیت کے لیے کوئی متبادل شق نہیں ملی، اس لیے ہم نے عارضی طور پر قریب ترین مماثلت — دیگر آمدنی کے لیے 10% فلیٹ ریٹ — استعمال کی — اصل رقم مختلف ہو سکتی ہے",
    bn: "জুয়া/বাজি জয়ে ৪০% হার মঙ্গোলিয়ার ২০২৫ সালের দেশীয় বাজি নিষেধাজ্ঞার সাথে বাতিল হয়েছে। বিদেশি লটারি জয়ের জন্য নির্দিষ্ট বিকল্প বিধান খুঁজে না পাওয়ায়, আমরা সাময়িকভাবে নিকটতম মিল — অন্যান্য আয়ের জন্য ১০% ফ্ল্যাট হার — প্রয়োগ করেছি — প্রকৃত পরিমাণ ভিন্ন হতে পারে",
    lo: "ອັດຕາ 40% ສຳລັບເງິນລາງວັນການພະນັນ/ການພະນັນຂັນຕໍ່ຖືກຍົກເລີກພ້ອມກັບການຫ້າມການພະນັນພາຍໃນປະເທດຂອງມົງໂກເລຍປີ 2025. ເນື່ອງຈາກພວກເຮົາບໍ່ພົບຂໍ້ກຳນົດທົດແທນສະເພາະສຳລັບເງິນລາງວັນເລກລອດເຕີຣີຕ່າງປະເທດ, ພວກເຮົາໄດ້ນຳໃຊ້ການຈັບຄູ່ທີ່ໃກ້ທີ່ສຸດຊົ່ວຄາວ — ອັດຕາຄົງທີ່ 10% ສຳລັບລາຍໄດ້ອື່ນ — ຈຳນວນຈິງອາດແຕກຕ່າງ",
    ja: "賭博・ギャンブル当選金に対する40%の税率は、モンゴルの2025年国内賭博禁止と共に廃止されました。海外宝くじ当選金に特化した代替規定が見つからなかったため、最も近い一致 — その他所得への一律10%課税 — を暫定的に適用しました。実際とは異なる場合があります",
    ar: "أُلغيت نسبة 40% لأرباح القمار/الرهان جنبًا إلى جنب مع حظر منغوليا للرهان المحلي عام 2025. نظرًا لعدم العثور على حكم بديل خاص بأرباح اليانصيب الأجنبية، طبّقنا مؤقتًا أقرب تطابق — نسبة ثابتة 10% للدخل الآخر — قد يختلف المبلغ الفعلي",
    hi: "जुआ/सट्टेबाजी जीत पर 40% दर मंगोलिया के 2025 के घरेलू सट्टेबाजी प्रतिबंध के साथ निरस्त कर दी गई। विदेशी लॉटरी जीत के लिए विशेष रूप से कोई प्रतिस्थापन प्रावधान न मिलने के कारण, हमने अस्थायी रूप से निकटतम मिलान — अन्य आय के लिए 10% फ्लैट दर — लागू किया — वास्तविक राशि भिन्न हो सकती है",
    fr: "Le taux de 40 % pour les gains de jeux d'argent/paris a été abrogé avec l'interdiction des paris domestiques en Mongolie en 2025. N'ayant pas trouvé de disposition de remplacement spécifique aux gains de loterie étrangers, nous avons appliqué provisoirement la correspondance la plus proche — le taux fixe de 10 % pour les autres revenus — le montant réel peut différer",
    tl: "Inalis ang 40% rate para sa panalo sa sugal/pusta kasabay ng 2025 domestic betting ban ng Mongolia. Dahil wala kaming nahanap na kapalit na probisyon na partikular para sa panalo sa dayuhang lottery, pansamantala naming inilapat ang pinakamalapit na tugma — ang flat 10% rate para sa iba pang kita — maaaring iba ang aktwal na halaga",
  })
  },
  la: {
    title: () => pickLang('라오스에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Laos? (estimate ⚠️)', '在老挝也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Lào nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในลาวด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Лаосе? (оценка ⚠️)', buildAlsoPayMore('la', 'estimate')),
    sub: () => pickLang('2026년 7월 시행된 신설법으로 복권 당첨소득에 5% 세율이 처음 생겼지만, 조세조약이 없어 미국 세금 상계(FTC)가 안 돼요 — 30% 원천징수에 이 5%가 그대로 더해져요', 'A brand-new July 2026 law introduced a 5% rate on lottery winnings for the first time, but since there’s no tax treaty with the US, this 5% cannot be offset (FTC) — it stacks fully on top of the 30% withholding', '2026年7月生效的新法首次对彩票中奖所得设定5%税率，但因无税收协定无法抵免（FTC）——这5%会全额叠加在30%预扣税之上', 'Luật mới có hiệu lực từ tháng 7/2026 lần đầu áp thuế 5% cho tiền thắng xổ số, nhưng do không có hiệp định thuế với Mỹ nên không thể bù trừ (FTC) — mức 5% này cộng dồn đầy đủ lên trên khoản khấu trừ 30%', 'กฎหมายใหม่ที่มีผลตั้งแต่กรกฎาคม 2026 กำหนดอัตราภาษี 5% สำหรับเงินรางวัลลอตเตอรีเป็นครั้งแรก แต่เนื่องจากไม่มีสนธิสัญญาภาษีกับสหรัฐฯ จึงไม่สามารถหักลบได้ (FTC) — 5% นี้จะถูกบวกเพิ่มเต็มจำนวนจากภาษีหัก ณ ที่จ่าย 30%', 'Совершенно новый закон, вступивший в силу в июле 2026 года, впервые ввёл ставку 5% на лотерейный выигрыш, но из-за отсутствия налогового соглашения с США зачесть её (FTC) нельзя — эти 5% добавляются полностью сверх удержания 30%', { km: "ច្បាប់ថ្មីដែលមានប្រសិទ្ធភាពចាប់ពីខែកក្កដា 2026 បានណែនាំអត្រា 5% លើប្រាក់ចំណូលឆ្នោតជាលើកដំបូង ប៉ុន្តែដោយសារគ្មានសន្ធិសញ្ញាពន្ធជាមួយអាមេរិក 5% នេះមិនអាចទូទាត់វិញបានទេ (FTC) — វាបូកបន្ថែមពេញលេញលើសពីការកាត់ទុក 30%", ne: "जुलाई २०२६ मा लागू भएको नयाँ कानूनले लटरी जितेको आयमा पहिलो पटक ५% दर ल्यायो, तर अमेरिकासँग कर सन्धि नभएकोले यो ५% अफसेट (FTC) गर्न सकिँदैन — यो ३०% कट्टीमाथि पूर्ण रूपमा थपिन्छ", id: "Undang-undang baru yang berlaku Juli 2026 memperkenalkan tarif 5% untuk kemenangan lotre untuk pertama kalinya, tetapi karena tidak ada perjanjian pajak dengan AS, 5% ini tidak bisa dikompensasi (FTC) — ini bertumpuk penuh di atas pemotongan 30%", my: "၂၀၂၆ ဇူလိုင်လမှစတင်၍ အသက်ဝင်သော ဥပဒေသစ်သည် ထီပေါက်ငွေဝင်ငွေအတွက် ၅% နှုန်းကို ပထမဆုံးအကြိမ် မိတ်ဆက်ခဲ့ပါသည်၊ သို့သော် အမေရိကန်နှင့် အခွန်သဘောတူညီချက်မရှိသဖြင့် ဒီ ၅% ကို ခုနှိမ်၍မရပါ (FTC) — ၎င်းသည် ၃၀% နှုတ်ယူမှုအပေါ် အပြည့်အဝ ထပ်တလဲလဲ ပေါင်းထည့်ခြင်းဖြစ်သည်", si: "2026 ජූලි මාසයේ සිට ක්‍රියාත්මක වූ නව නීතිය ලොතරැයි ජයග්‍රහණවලට 5% අනුපාතයක් පළමු වරට හඳුන්වා දුන්නද, එක්සත් ජනපදය සමඟ බදු ගිවිසුමක් නොමැති බැවින් මෙම 5% ප්‍රතිසන්තුලනය කළ නොහැක (FTC) — එය 30% අඩුකිරීම මතට සම්පූර්ණයෙන් එකතු වේ", uz: "2026-yil iyulda kuchga kirgan yangi qonun lotereya yutuqiga birinchi marta 5% stavkani joriy qildi, lekin AQSh bilan soliq shartnomasi yo'qligi sababli bu 5% qoplanmaydi (FTC) — u 30% ushlab qolishning ustiga to'liq qo'shiladi", mn: "2026 оны 7-р сард хүчин төгөлдөр болсон шинэ хууль сугалааны ялалтад анх удаа 5% хувь оруулсан ч, АНУ-тай татварын гэрээ байхгүй тул энэ 5%-ийг нөхөх (FTC) боломжгүй — энэ нь 30% суутгал дээр бүрэн нэмэгддэг", kk: "2026 жылдың шілдесінде күшіне енген жаңа заң лотерея ұтысына алғаш рет 5% мөлшерлеме енгізді, бірақ АҚШ-пен салық келісімі жоқ болғандықтан бұл 5%-ды өтеу (FTC) мүмкін емес — ол 30% ұстаудың үстіне толық қосылады", ky: "2026-жылдын июль айында күчүнө кирген жаңы мыйзам лотерея утушуна биринчи жолу 5% чен киргизди, бирок АКШ менен салык келишими жок болгондуктан бул 5%ды төлөшкө (FTC) болбойт — ал 30% кармоонун үстүнө толук кошулат", ur: "جولائی 2026 سے نافذ نئے قانون نے لاٹری جیت پر پہلی بار 5% شرح متعارف کرائی، لیکن امریکہ کے ساتھ ٹیکس معاہدہ نہ ہونے کی وجہ سے یہ 5% پورا نہیں کیا جا سکتا (FTC) — یہ 30% کٹوتی کے اوپر مکمل طور پر جمع ہوتا ہے", bn: "২০২৬ সালের জুলাই থেকে কার্যকর নতুন আইন লটারি জয়ে প্রথমবারের মতো ৫% হার প্রবর্তন করেছে, কিন্তু যুক্তরাষ্ট্রের সাথে কর চুক্তি না থাকায় এই ৫% সমন্বয় (FTC) করা যায় না — এটি ৩০% কর্তনের উপর সম্পূর্ণভাবে যোগ হয়", lo: "ກົດໝາຍໃໝ່ທີ່ມີຜົນຕັ້ງແຕ່ເດືອນກໍລະກົດ 2026 ໄດ້ນຳສະເໜີອັດຕາ 5% ສຳລັບເງິນລາງວັນເລກລອດເຕີຣີເປັນຄັ້ງທຳອິດ, ແຕ່ເນື່ອງຈາກບໍ່ມີສົນທິສັນຍາພາສີກັບສະຫະລັດ ຈຶ່ງບໍ່ສາມາດຫັກລ້າງໄດ້ (FTC) — 5% ນີ້ຈະຖືກບວກເພີ່ມເຕັມຈຳນວນຈາກການຫັກ 30%", ja: "2026年7月施行の新法で宝くじ当選所得に初めて5%の税率が導入されましたが、米国との租税条約がないためこの5%は相殺（FTC）できません — 30%源泉徴収にそのまま上乗せされます", ar: "أدخل قانون جديد دخل حيز التنفيذ في يوليو 2026 نسبة 5% على أرباح اليانصيب لأول مرة، لكن نظرًا لعدم وجود معاهدة ضريبية مع أمريكا، لا يمكن تعويض هذه الـ5% (FTC) — تُضاف بالكامل فوق نسبة الاقتطاع 30%", hi: "जुलाई 2026 से लागू नए कानून ने लॉटरी जीत पर पहली बार 5% दर पेश की, लेकिन अमेरिका के साथ कर संधि न होने के कारण यह 5% भरपाई (FTC) नहीं की जा सकती — यह 30% कटौती के ऊपर पूरी तरह जुड़ जाती है", fr: "Une toute nouvelle loi entrée en vigueur en juillet 2026 a introduit pour la première fois un taux de 5 % sur les gains de loterie, mais comme il n'y a pas de traité fiscal avec les États-Unis, ces 5 % ne peuvent pas être compensés (FTC) — ils s'ajoutent intégralement à la retenue de 30 %", tl: "Ang bagong batas na ipinatupad noong Hulyo 2026 ay unang nagpakilala ng 5% rate sa panalo sa lottery, pero dahil walang tax treaty sa US, hindi puwedeng i-offset (FTC) ang 5% na ito — dinadagdag ito nang buo sa ibabaw ng 30% withholding" })
  }
};

// FAQ 상단 소개문 — "국세청 상담 기준"이라는 출처 표기가 세금 기준(kr/us/cn)과 무관하게
// 항상 똑같이 나오고 있었음. us/cn 기준 방문자에게는 실제로 확인 근거가 국세청이 아니라
// IRS·중국 국가세무총국 쪽인데 "국세청"이라고만 말하는 건 부정확해서, 기준별로 출처를 다르게 표기함
// FAQ_PANEL_DESC 17개 언어 헬퍼 — 모든 나라가 "검색하다 오신 분들이 자주 물어보는 질문 모았어요 ·
// [출처 확인 문구]" 구조를 공유해서, 앞부분 문구 한 번 + "{나라}의 {기관}" 연결 문구만 나라별로
// 채워 넣음(기관 고유명사는 국제적으로 흔히 원문 그대로/약자로 쓰이므로 영어 표기 유지)
const FAQ_INTRO_PREFIX_MORE = {
  km: 'ចងក្រងសំណួរដែលអ្នកស្វែងរកមកដល់ទីនេះតែងសួរ',
  ne: 'खोजी गरेर यहाँ आउनुभएकाहरूले सोध्ने सामान्य प्रश्नहरू संकलन गरिएको',
  id: 'Kumpulan pertanyaan umum dari orang yang mencari dan sampai di sini',
  my: 'ဤနေရာသို့ ရှာဖွေရောက်ရှိလာသူများ မကြာခဏမေးလေ့ရှိသော မေးခွန်းများကို စုစည်းထားသည်',
  si: 'මෙතැනට සොයාගෙන පැමිණි අය නිතර අසන ප්‍රශ්න එකතු කර ඇත',
  uz: "Bu yerga qidirib kelganlar tez-tez beradigan savollar to'plami",
  mn: 'Хайлт хийж энд ирсэн хүмүүсийн байнга асуудаг асуултуудыг цуглуулсан',
  kk: 'Осында іздеп келгендер жиі қоятын сұрақтар жиынтығы',
  ky: 'Бул жерге издеп келгендер көп берген суроолордун жыйындысы',
  ur: 'یہاں تلاش کر کے آنے والوں کے اکثر پوچھے جانے والے سوالات جمع کیے گئے',
  bn: 'অনুসন্ধান করে এখানে আসা মানুষদের প্রায়ই জিজ্ঞাসিত প্রশ্নগুলো সংগ্রহ করা হয়েছে',
  lo: 'ລວບລວມຄຳຖາມທີ່ຄົນຄົ້ນຫາມາຮອດທີ່ນີ້ມັກຖາມ',
  ja: '検索してここに来た方がよく聞く質問をまとめました',
  ar: 'مجموعة من الأسئلة الشائعة من الأشخاص الذين وصلوا إلى هنا عبر البحث',
  hi: 'खोज करके यहाँ आए लोगों द्वारा अक्सर पूछे जाने वाले प्रश्न एकत्र किए गए हैं',
  fr: "Questions fréquentes des personnes arrivées ici via une recherche",
  tl: 'Tinipon namin ang mga madalas itanong ng mga taong naghanap at napunta rito',
};
const FAQ_CONFIRMED_TEMPLATE_MORE = {
  km: (country, agency) => `បានផ្ទៀងផ្ទាត់ដោយផ្អែកលើប្រភព ${agency} របស់${country}`,
  ne: (country, agency) => `${country}को ${agency} स्रोतमा आधारित पुष्टि गरिएको`,
  id: (country, agency) => `Dikonfirmasi berdasarkan sumber ${agency} ${country}`,
  my: (country, agency) => `${country}၏ ${agency} အရင်းအမြစ်များအပေါ် အခြေခံ၍ အတည်ပြုထားသည်`,
  si: (country, agency) => `${country} හි ${agency} මූලාශ්‍ර මත පදනම්ව තහවුරු කර ඇත`,
  uz: (country, agency) => `${country} ${agency} manbalari asosida tasdiqlangan`,
  mn: (country, agency) => `${country}-ын ${agency} эх сурвалж дээр үндэслэн баталгаажуулсан`,
  kk: (country, agency) => `${country} ${agency} дереккөздері негізінде расталған`,
  ky: (country, agency) => `${country} ${agency} булактарынын негизинде тастыкталган`,
  ur: (country, agency) => `${country} کے ${agency} ذرائع کی بنیاد پر تصدیق شدہ`,
  bn: (country, agency) => `${country}-এর ${agency} সূত্রের ভিত্তিতে নিশ্চিত করা হয়েছে`,
  lo: (country, agency) => `ຢືນຢັນອີງໃສ່ແຫຼ່ງຂໍ້ມູນ ${agency} ຂອງ${country}`,
  ja: (country, agency) => `${country}の${agency}資料に基づき確認済み`,
  ar: (country, agency) => `تم التأكيد استنادًا إلى مصادر ${agency} في ${country}`,
  hi: (country, agency) => `${country} के ${agency} स्रोतों के आधार पर पुष्टि की गई`,
  fr: (country, agency) => `Confirmé sur la base des sources ${agency} de ${country}`,
  tl: (country, agency) => `Nakumpirma batay sa mga mapagkukunan ng ${agency} ng ${country}`,
};
function buildFaqPanelDescMore(countryCode, agencyEnglishName){
  const more = {};
  Object.keys(FAQ_INTRO_PREFIX_MORE).forEach(lang => {
    const countryName = COUNTRY_NAMES_MORE[lang][countryCode];
    more[lang] = `${FAQ_INTRO_PREFIX_MORE[lang]} · ${FAQ_CONFIRMED_TEMPLATE_MORE[lang](countryName, agencyEnglishName)}`;
  });
  return more;
}

const FAQ_PANEL_DESC = {
  kr: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 국세청 상담 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Korea’s National Tax Service consultations', '搜索到这里的朋友们经常问的问题 · 已通过韩国国税厅咨询确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên tư vấn của Cơ quan Thuế Hàn Quốc', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามคำปรึกษาของกรมสรรพากรเกาหลี', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе консультаций Налоговой службы Кореи', buildFaqPanelDescMore('kr', 'National Tax Service')),
  us: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · IRS 공식 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on official IRS sources', '搜索到这里的朋友们经常问的问题 · 已根据美国国税局（IRS）官方资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn chính thức của IRS', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลทางการของ IRS', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе официальных источников IRS', buildFaqPanelDescMore('us', 'IRS')),
  cn: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 중국 국가세무총국 공고 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on China’s State Taxation Administration notices', '搜索到这里的朋友们经常问的问题 · 已根据中国国家税务总局公告确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên thông báo của Tổng cục Thuế Nhà nước Trung Quốc', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามประกาศของกรมสรรพากรแห่งชาติจีน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе уведомлений Государственного налогового управления Китая', buildFaqPanelDescMore('cn', 'State Taxation Administration')),
  in: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 인도 소득세청 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on India’s Income Tax Department sources', '搜索到这里的朋友们经常问的问题 · 已根据印度所得税局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Thu nhập Ấn Độ', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรอินเดีย', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента подоходного налога Индии', buildFaqPanelDescMore('in', 'Income Tax Department')),
  vn: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 베트남 세무총국 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Vietnam’s General Department of Taxation sources', '搜索到这里的朋友们经常问的问题 · 已根据越南税务总局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Tổng cục Thuế Việt Nam', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรทั่วไปเวียดนาม', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Главного налогового управления Вьетнама', buildFaqPanelDescMore('vn', 'General Department of Taxation')),
  id: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 인도네시아 국세청 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Indonesia’s Directorate General of Taxes sources', '搜索到这里的朋友们经常问的问题 · 已根据印尼税务总局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Tổng cục Thuế Indonesia', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรอินโดนีเซีย', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Налогового управления Индонезии', buildFaqPanelDescMore('id', 'Directorate General of Taxes')),
  ph: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 필리핀 국세청(BIR) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Philippines Bureau of Internal Revenue sources', '搜索到这里的朋友们经常问的问题 · 已根据菲律宾国税局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Philippines', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรฟิลิปปินส์', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Налогового управления Филиппин', buildFaqPanelDescMore('ph', 'Bureau of Internal Revenue')),
  th: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 태국은 해외 복권 세금 기준이 명확하지 않아 추정치예요', 'Common questions from people who searched their way here · ⚠️ Thailand’s rule for foreign lottery tax isn’t clearly confirmed, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 泰国境外彩票税收依据尚不明确，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Quy định thuế xổ số nước ngoài của Thái Lan chưa rõ ràng nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ หลักเกณฑ์ภาษีลอตเตอรีต่างประเทศของไทยยังไม่ชัดเจน ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Правило налога на иностранную лотерею в Таиланде чётко не подтверждено, поэтому цифры являются оценкой', {
    km: FAQ_INTRO_PREFIX_MORE.km + ' · ⚠️ ថៃមិនមានលក្ខណៈវិនិច្ឆ័យច្បាស់លាស់សម្រាប់ពន្ធឆ្នោតបរទេសទេ ដូច្នេះជាតួលេខប៉ាន់ស្មាន',
    ne: FAQ_INTRO_PREFIX_MORE.ne + ' · ⚠️ थाइल्याण्डको विदेशी लटरी करको नियम स्पष्ट रूपमा पुष्टि नभएकोले, यी अनुमानित हुन्',
    id: FAQ_INTRO_PREFIX_MORE.id + ' · ⚠️ Aturan pajak lotre luar negeri Thailand belum dikonfirmasi jelas, jadi angka ini perkiraan',
    my: FAQ_INTRO_PREFIX_MORE.my + ' · ⚠️ ထိုင်း၏ နိုင်ငံခြားထီအခွန်စည်းမျဉ်း ရှင်းလင်းစွာအတည်မပြုရသေးသဖြင့် ဤကိန်းဂဏန်းများသည် ခန့်မှန်းချက်များဖြစ်သည်',
    si: FAQ_INTRO_PREFIX_MORE.si + ' · ⚠️ තායිලන්තයේ විදේශීය ලොතරැයි බදු නීතිය පැහැදිලිව තහවුරු වී නොමැති බැවින්, මෙම ඉලක්කම් ඇස්තමේන්තු වේ',
    uz: FAQ_INTRO_PREFIX_MORE.uz + " · ⚠️ Tailandning xorijiy lotereya solig'i qoidasi aniq tasdiqlanmagan, shuning uchun bu raqamlar taxminiy",
    mn: FAQ_INTRO_PREFIX_MORE.mn + ' · ⚠️ Тайландын гадаадын сугалааны татварын дүрэм тодорхой батлагдаагүй тул эдгээр тоо баримт нь тооцоо юм',
    kk: FAQ_INTRO_PREFIX_MORE.kk + ' · ⚠️ Тайландтың шетелдік лотерея салығы ережесі нақты расталмаған, сондықтан бұл сандар болжам болып табылады',
    ky: FAQ_INTRO_PREFIX_MORE.ky + ' · ⚠️ Тайланддын чет өлкөдөгү лотерея салыгынын эрежеси так бекитилген эмес, ошондуктан бул сандар болжол болуп саналат',
    ur: FAQ_INTRO_PREFIX_MORE.ur + ' · ⚠️ تھائی لینڈ کا غیر ملکی لاٹری ٹیکس اصول واضح طور پر تصدیق شدہ نہیں ہے، اس لیے یہ اعداد تخمینی ہیں',
    bn: FAQ_INTRO_PREFIX_MORE.bn + ' · ⚠️ থাইল্যান্ডের বিদেশি লটারি কর নিয়ম স্পষ্টভাবে নিশ্চিত না হওয়ায়, এই সংখ্যাগুলো অনুমান',
    lo: FAQ_INTRO_PREFIX_MORE.lo + ' · ⚠️ ກົດລະບຽບພາສີເລກລອດເຕີຣີຕ່າງປະເທດຂອງໄທຍັງບໍ່ໄດ້ຮັບການຢືນຢັນຢ່າງຈະແຈ້ງ ຕົວເລກນີ້ຈຶ່ງເປັນການຄາດຄະເນ',
    ja: FAQ_INTRO_PREFIX_MORE.ja + ' · ⚠️ タイの海外宝くじ税ルールが明確に確認できないため、これらの数値は推定値です',
    ar: FAQ_INTRO_PREFIX_MORE.ar + ' · ⚠️ قاعدة ضريبة اليانصيب الأجنبي في تايلاند غير مؤكدة بوضوح، لذا فإن هذه الأرقام تقديرية',
    hi: FAQ_INTRO_PREFIX_MORE.hi + ' · ⚠️ थाईलैंड का विदेशी लॉटरी कर नियम स्पष्ट रूप से पुष्टि नहीं है, इसलिए ये आंकड़े अनुमानित हैं',
    fr: FAQ_INTRO_PREFIX_MORE.fr + " · ⚠️ La règle fiscale thaïlandaise sur les loteries étrangères n'est pas clairement confirmée, ces chiffres sont donc des estimations",
    tl: FAQ_INTRO_PREFIX_MORE.tl + ' · ⚠️ Hindi malinaw na nakumpirma ang tax rule ng Thailand para sa dayuhang lottery, kaya tantya ang mga figure na ito',
  }),
  jp: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 일본 국세청(NTA) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Japan’s National Tax Agency sources', '搜索到这里的朋友们经常问的问题 · 已根据日本国税厅资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cơ quan Thuế Quốc gia Nhật Bản', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรแห่งชาติญี่ปุ่น', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Национального налогового управления Японии', buildFaqPanelDescMore('jp', 'National Tax Agency')),
  ru: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 러시아는 미-러 조세조약 정지로 세액공제 여부가 불확실해요', 'Common questions from people who searched their way here · ⚠️ Russia’s US tax treaty is suspended, so tax-credit eligibility is uncertain', '搜索到这里的朋友们经常问的问题 · ⚠️ 俄美税收协定已暂停，税收抵免是否可用尚不确定', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Hiệp định thuế Nga-Mỹ bị đình chỉ nên chưa chắc chắn về tín dụng thuế', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ สนธิสัญญาภาษีรัสเซีย-สหรัฐฯ ถูกระงับ จึงยังไม่แน่ชัดเรื่องเครดิตภาษี', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Налоговое соглашение России и США приостановлено, поэтому доступность налогового кредита под вопросом', {
    km: FAQ_INTRO_PREFIX_MORE.km + ' · ⚠️ រុស្ស៊ីបានផ្អាកសន្ធិសញ្ញាពន្ធជាមួយអាមេរិក ដូច្នេះលទ្ធភាពទទួលបានឥណទានពន្ធនៅមិនច្បាស់',
    ne: FAQ_INTRO_PREFIX_MORE.ne + ' · ⚠️ रुसले अमेरिकासँगको कर सन्धि निलम्बन गरेकोले, कर क्रेडिट योग्यता अनिश्चित छ',
    id: FAQ_INTRO_PREFIX_MORE.id + ' · ⚠️ Perjanjian pajak Rusia-AS ditangguhkan, jadi kelayakan kredit pajak tidak pasti',
    my: FAQ_INTRO_PREFIX_MORE.my + ' · ⚠️ ရုရှား၏ အမေရိကန်နှင့် အခွန်သဘောတူညီချက်ကို ရပ်ဆိုင်းထားသဖြင့် အခွန်ခရက်ဒစ်ရရှိနိုင်မှု မသေချာပါ',
    si: FAQ_INTRO_PREFIX_MORE.si + ' · ⚠️ රුසියාවේ එක්සත් ජනපද බදු ගිවිසුම අත්හිටුවා ඇති බැවින්, බදු ණය සුදුසුකම් අවිනිශ්චිතයි',
    uz: FAQ_INTRO_PREFIX_MORE.uz + " · ⚠️ Rossiyaning AQSh bilan soliq shartnomasi to'xtatilgan, shuning uchun soliq krediti huquqi noaniq",
    mn: FAQ_INTRO_PREFIX_MORE.mn + ' · ⚠️ Оросын АНУ-тай хийсэн татварын гэрээ түдгэлзсэн тул татварын хөнгөлөлт авах эрх тодорхойгүй',
    kk: FAQ_INTRO_PREFIX_MORE.kk + ' · ⚠️ Ресейдің АҚШ-пен салық келісімі тоқтатылған, сондықтан салық несиесіне құқылы болу белгісіз',
    ky: FAQ_INTRO_PREFIX_MORE.ky + ' · ⚠️ Орусиянын АКШ менен салык келишими токтотулган, ошондуктан салык кредитине укуктуулук белгисиз',
    ur: FAQ_INTRO_PREFIX_MORE.ur + ' · ⚠️ روس کا امریکہ کے ساتھ ٹیکس معاہدہ معطل ہے، اس لیے ٹیکس کریڈٹ کی اہلیت غیر یقینی ہے',
    bn: FAQ_INTRO_PREFIX_MORE.bn + ' · ⚠️ রাশিয়ার যুক্তরাষ্ট্রের সাথে কর চুক্তি স্থগিত থাকায়, কর ক্রেডিট যোগ্যতা অনিশ্চিত',
    lo: FAQ_INTRO_PREFIX_MORE.lo + ' · ⚠️ ສົນທິສັນຍາພາສີຣັດເຊຍ-ສະຫະລັດຖືກໂຈະ ຈຶ່ງຍັງບໍ່ແນ່ນອນເລື່ອງເຄຣດິດພາສີ',
    ja: FAQ_INTRO_PREFIX_MORE.ja + ' · ⚠️ ロシアの米露租税条約が停止中のため、税額控除の可否は不確実です',
    ar: FAQ_INTRO_PREFIX_MORE.ar + ' · ⚠️ المعاهدة الضريبية الروسية الأمريكية معلقة، لذا فإن أهلية الائتمان الضريبي غير مؤكدة',
    hi: FAQ_INTRO_PREFIX_MORE.hi + ' · ⚠️ रूस की अमेरिका के साथ कर संधि निलंबित है, इसलिए कर क्रेडिट पात्रता अनिश्चित है',
    fr: FAQ_INTRO_PREFIX_MORE.fr + " · ⚠️ Le traité fiscal russo-américain étant suspendu, l'éligibilité au crédit d'impôt est incertaine",
    tl: FAQ_INTRO_PREFIX_MORE.tl + ' · ⚠️ Suspendido ang tax treaty ng Russia sa US, kaya hindi tiyak kung kwalipikado pa rin ang tax credit',
  }),
  np: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 네팔 국세청(IRD) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Nepal’s Inland Revenue Department sources', '搜索到这里的朋友们经常问的问题 · 已根据尼泊尔国内税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Nepal', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรเนปาล', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента внутренних доходов Непала', buildFaqPanelDescMore('np', 'Inland Revenue Department')),
  lk: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 스리랑카 국세청(IRD) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Sri Lanka’s Inland Revenue Department sources', '搜索到这里的朋友们经常问的问题 · 已根据斯里兰卡国内税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Sri Lanka', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรศรีลังกา', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента внутренних доходов Шри-Ланки', buildFaqPanelDescMore('lk', 'Inland Revenue Department')),
  uz: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 우즈베키스탄 국가조세위원회 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Uzbekistan’s State Tax Committee sources', '搜索到这里的朋友们经常问的问题 · 已根据乌兹别克斯坦国家税务委员会资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Ủy ban Thuế Nhà nước Uzbekistan', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของคณะกรรมการภาษีแห่งรัฐอุซเบกิสถาน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Государственного налогового комитета Узбекистана', buildFaqPanelDescMore('uz', 'State Tax Committee')),
  kz: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 카자흐스탄 국가세입위원회 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Kazakhstan’s Committee of State Revenues sources', '搜索到这里的朋友们经常问的问题 · 已根据哈萨克斯坦国家税收委员会资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Ủy ban Thu ngân sách Nhà nước Kazakhstan', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของคณะกรรมการรายได้แห่งรัฐคาซัคสถาน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Комитета государственных доходов Казахстана', buildFaqPanelDescMore('kz', 'Committee of State Revenues')),
  kg: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 키르기스스탄 국가조세청 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Kyrgyzstan’s State Tax Service sources', '搜索到这里的朋友们经常问的问题 · 已根据吉尔吉斯斯坦国家税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cơ quan Thuế Nhà nước Kyrgyzstan', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรแห่งรัฐคีร์กีซสถาน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Государственной налоговой службы Кыргызстана', buildFaqPanelDescMore('kg', 'State Tax Service')),
  mm: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 미얀마 내국세청(IRD) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Myanmar’s Internal Revenue Department sources', '搜索到这里的朋友们经常问的问题 · 已根据缅甸内税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Myanmar', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรภายในเมียนมา', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента внутренних доходов Мьянмы', buildFaqPanelDescMore('mm', 'Internal Revenue Department')),
  bd: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 방글라데시 국세청(NBR) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Bangladesh’s National Board of Revenue sources', '搜索到这里的朋友们经常问的问题 · 已根据孟加拉国国家税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Ủy ban Thuế Quốc gia Bangladesh', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของคณะกรรมการรายได้แห่งชาติบังกลาเทศ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Национального совета по доходам Бангладеш', buildFaqPanelDescMore('bd', 'National Board of Revenue')),
  pk: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 파키스탄은 규정 적용 여부가 불명확해 추정치예요', 'Common questions from people who searched their way here · ⚠️ Pakistan’s applicable rule is unclear, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 巴基斯坦适用规定不明确，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Quy định áp dụng của Pakistan chưa rõ ràng nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ กฎที่ใช้บังคับของปากีสถานยังไม่ชัดเจน ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Применимое правило Пакистана неясно, поэтому цифры являются оценкой', {
    km: FAQ_INTRO_PREFIX_MORE.km + ' · ⚠️ ច្បាប់ដែលអនុវត្តរបស់ប៉ាគីស្ថានមិនច្បាស់លាស់ទេ ដូច្នេះជាតួលេខប៉ាន់ស្មាន',
    ne: FAQ_INTRO_PREFIX_MORE.ne + ' · ⚠️ पाकिस्तानको लागू हुने नियम अस्पष्ट भएकोले, यी अनुमानित हुन्',
    id: FAQ_INTRO_PREFIX_MORE.id + ' · ⚠️ Aturan yang berlaku di Pakistan tidak jelas, jadi angka ini perkiraan',
    my: FAQ_INTRO_PREFIX_MORE.my + ' · ⚠️ ပါကစ္စတန်၏ သက်ဆိုင်ရာစည်းမျဉ်း ရှင်းလင်းမှုမရှိသဖြင့် ဤကိန်းဂဏန်းများသည် ခန့်မှန်းချက်များဖြစ်သည်',
    si: FAQ_INTRO_PREFIX_MORE.si + ' · ⚠️ පකිස්තානයේ අදාළ නීතිය පැහැදිලි නැති බැවින්, මෙම ඉලක්කම් ඇස්තමේන්තු වේ',
    uz: FAQ_INTRO_PREFIX_MORE.uz + " · ⚠️ Pokistonning qo'llaniladigan qoidasi aniq emas, shuning uchun bu raqamlar taxminiy",
    mn: FAQ_INTRO_PREFIX_MORE.mn + ' · ⚠️ Пакистаны хэрэглэгдэх дүрэм тодорхойгүй тул эдгээр тоо баримт нь тооцоо юм',
    kk: FAQ_INTRO_PREFIX_MORE.kk + ' · ⚠️ Пәкістанның қолданылатын ережесі белгісіз, сондықтан бұл сандар болжам болып табылады',
    ky: FAQ_INTRO_PREFIX_MORE.ky + ' · ⚠️ Пакистандын колдонулуучу эрежеси белгисиз, ошондуктан бул сандар болжол болуп саналат',
    ur: FAQ_INTRO_PREFIX_MORE.ur + ' · ⚠️ پاکستان کا لاگو اصول واضح نہیں ہے، اس لیے یہ اعداد تخمینی ہیں',
    bn: FAQ_INTRO_PREFIX_MORE.bn + ' · ⚠️ পাকিস্তানের প্রযোজ্য নিয়ম স্পষ্ট না হওয়ায়, এই সংখ্যাগুলো অনুমান',
    lo: FAQ_INTRO_PREFIX_MORE.lo + ' · ⚠️ ກົດລະບຽບທີ່ໃຊ້ບັງຄັບຂອງປາກີສະຖານຍັງບໍ່ຈະແຈ້ງ ຕົວເລກນີ້ຈຶ່ງເປັນການຄາດຄະເນ',
    ja: FAQ_INTRO_PREFIX_MORE.ja + ' · ⚠️ パキスタンの適用規定が不明確なため、これらの数値は推定値です',
    ar: FAQ_INTRO_PREFIX_MORE.ar + ' · ⚠️ القاعدة المطبقة في باكستان غير واضحة، لذا فإن هذه الأرقام تقديرية',
    hi: FAQ_INTRO_PREFIX_MORE.hi + ' · ⚠️ पाकिस्तान का लागू नियम स्पष्ट नहीं है, इसलिए ये आंकड़े अनुमानित हैं',
    fr: FAQ_INTRO_PREFIX_MORE.fr + " · ⚠️ La règle applicable au Pakistan n'est pas claire, ces chiffres sont donc des estimations",
    tl: FAQ_INTRO_PREFIX_MORE.tl + ' · ⚠️ Hindi malinaw ang naaangkop na tuntunin ng Pakistan, kaya tantya ang mga figure na ito',
  }),
  kh: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 캄보디아는 관련 법 조항을 찾지 못해 추정치예요', 'Common questions from people who searched their way here · ⚠️ We couldn’t find a Cambodian law provision on point, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 未找到相关柬埔寨法律条款，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Chúng tôi không tìm thấy quy định luật Campuchia liên quan nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ ไม่พบข้อกำหนดกฎหมายกัมพูชาที่เกี่ยวข้อง ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Мы не нашли соответствующего положения в законодательстве Камбоджи, поэтому цифры являются оценкой', {
    km: FAQ_INTRO_PREFIX_MORE.km + ' · ⚠️ យើងមិនបានរកឃើញបទប្បញ្ញត្តិច្បាប់កម្ពុជាពាក់ព័ន្ធទេ ដូច្នេះជាតួលេខប៉ាន់ស្មាន',
    ne: FAQ_INTRO_PREFIX_MORE.ne + ' · ⚠️ हामीले सान्दर्भिक कम्बोडियाली कानूनी प्रावधान भेट्न सकेनौं, त्यसैले यी अनुमानित हुन्',
    id: FAQ_INTRO_PREFIX_MORE.id + ' · ⚠️ Kami tidak menemukan ketentuan hukum Kamboja yang relevan, jadi angka ini perkiraan',
    my: FAQ_INTRO_PREFIX_MORE.my + ' · ⚠️ ကျွန်ုပ်တို့သည် သက်ဆိုင်ရာ ကမ္ဘောဒီးယားဥပဒေပြဋ္ဌာန်းချက်ကို ရှာမတွေ့ခဲ့ပါ၊ ထို့ကြောင့် ဤကိန်းဂဏန်းများသည် ခန့်မှန်းချက်များဖြစ်သည်',
    si: FAQ_INTRO_PREFIX_MORE.si + ' · ⚠️ අදාළ කාම්බෝජ නීති විධිවිධානයක් අපට සොයාගත නොහැකි විය, එබැවින් මෙම ඉලක්කම් ඇස්තමේන්තු වේ',
    uz: FAQ_INTRO_PREFIX_MORE.uz + " · ⚠️ Biz tegishli Kambodja qonun qoidasini topa olmadik, shuning uchun bu raqamlar taxminiy",
    mn: FAQ_INTRO_PREFIX_MORE.mn + ' · ⚠️ Бид холбогдох Камбожийн хуулийн заалтыг олсонгүй тул эдгээр тоо баримт нь тооцоо юм',
    kk: FAQ_INTRO_PREFIX_MORE.kk + ' · ⚠️ Біз тиісті Камбоджа заң нормасын таба алмадық, сондықтан бұл сандар болжам болып табылады',
    ky: FAQ_INTRO_PREFIX_MORE.ky + ' · ⚠️ Биз тиешелүү Камбожа мыйзам ченемин таба алган жокбуз, ошондуктан бул сандар болжол болуп саналат',
    ur: FAQ_INTRO_PREFIX_MORE.ur + ' · ⚠️ ہمیں متعلقہ کمبوڈین قانونی شق نہیں ملی، اس لیے یہ اعداد تخمینی ہیں',
    bn: FAQ_INTRO_PREFIX_MORE.bn + ' · ⚠️ আমরা প্রাসঙ্গিক কম্বোডিয়ান আইনি বিধান খুঁজে পাইনি, তাই এই সংখ্যাগুলো অনুমান',
    lo: FAQ_INTRO_PREFIX_MORE.lo + ' · ⚠️ ພວກເຮົາບໍ່ພົບຂໍ້ກຳນົດກົດໝາຍກຳປູເຈຍທີ່ກ່ຽວຂ້ອງ ຕົວເລກນີ້ຈຶ່ງເປັນການຄາດຄະເນ',
    ja: FAQ_INTRO_PREFIX_MORE.ja + ' · ⚠️ 該当するカンボジア法規定が見つからなかったため、これらの数値は推定値です',
    ar: FAQ_INTRO_PREFIX_MORE.ar + ' · ⚠️ لم نتمكن من العثور على حكم قانوني كمبودي ذي صلة، لذا فإن هذه الأرقام تقديرية',
    hi: FAQ_INTRO_PREFIX_MORE.hi + ' · ⚠️ हमें प्रासंगिक कम्बोडियाई कानूनी प्रावधान नहीं मिला, इसलिए ये आंकड़े अनुमानित हैं',
    fr: FAQ_INTRO_PREFIX_MORE.fr + " · ⚠️ Nous n'avons pas trouvé de disposition légale cambodgienne pertinente, ces chiffres sont donc des estimations",
    tl: FAQ_INTRO_PREFIX_MORE.tl + ' · ⚠️ Wala kaming nahanap na kaugnay na probisyon sa batas ng Cambodia, kaya tantya ang mga figure na ito',
  }),
  mn: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 몽골은 2025년 베팅업 금지 후 적용 여부가 불명확해 추정치예요', 'Common questions from people who searched their way here · ⚠️ It’s unclear whether Mongolia’s rule still applies after its 2025 betting ban, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 蒙古2025年禁止博彩业后适用性不明确，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Chưa rõ quy định của Mông Cổ có còn áp dụng sau lệnh cấm cá cược 2025 hay không nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ ยังไม่ชัดเจนว่ากฎของมองโกเลียยังใช้ได้หรือไม่หลังห้ามพนันปี 2025 ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Неясно, действует ли ещё правило Монголии после запрета ставок в 2025 году, поэтому цифры являются оценкой', {
    km: FAQ_INTRO_PREFIX_MORE.km + ' · ⚠️ មិនច្បាស់ថាតើបទប្បញ្ញត្តិម៉ុងហ្គោលីនៅតែអនុវត្តទេបន្ទាប់ពីហាមឃាត់អាជីវកម្មភ្នាល់ក្នុងស្រុកឆ្នាំ 2025 ដូច្នេះជាតួលេខប៉ាន់ស្មាន',
    ne: FAQ_INTRO_PREFIX_MORE.ne + ' · ⚠️ मंगोलियाको नियम २०२५ को घरेलु सट्टेबाजी प्रतिबन्ध पछि अझै लागू हुन्छ कि हुँदैन स्पष्ट छैन, त्यसैले यी अनुमानित हुन्',
    id: FAQ_INTRO_PREFIX_MORE.id + ' · ⚠️ Belum jelas apakah aturan Mongolia masih berlaku setelah larangan taruhan domestik 2025, jadi angka ini perkiraan',
    my: FAQ_INTRO_PREFIX_MORE.my + ' · ⚠️ မွန်ဂိုလီယာ၏ စည်းမျဉ်းသည် ၂၀၂၅ ပြည်တွင်းလောင်းကစားပိတ်ပင်မှုနောက်ပိုင်း ဆက်လက်အသုံးချမလား မသေချာသဖြင့် ဤကိန်းဂဏန်းများသည် ခန့်မှန်းချက်များဖြစ်သည်',
    si: FAQ_INTRO_PREFIX_MORE.si + ' · ⚠️ මොංගෝලියාවේ 2025 දේශීය ඔට්ටු තහනමෙන් පසුව එහි නීතිය තවමත් අදාළද යන්න පැහැදිලි නැත, එබැවින් මෙම ඉලක්කම් ඇස්තමේන්තු වේ',
    uz: FAQ_INTRO_PREFIX_MORE.uz + " · ⚠️ Mongoliyaning 2025-yilgi ichki tikish taqig'idan keyin qoidasi hali ham qo'llanilishi aniq emas, shuning uchun bu raqamlar taxminiy",
    mn: FAQ_INTRO_PREFIX_MORE.mn + ' · ⚠️ Монголын дүрэм 2025 оны дотоодын бооцооны хориглолтын дараа хэрэгжих эсэх тодорхойгүй тул эдгээр тоо баримт нь тооцоо юм',
    kk: FAQ_INTRO_PREFIX_MORE.kk + ' · ⚠️ Моңғолияның ережесі 2025 жылғы ішкі бәс тігу тыйымынан кейін әлі де қолданыла ма белгісіз, сондықтан бұл сандар болжам болып табылады',
    ky: FAQ_INTRO_PREFIX_MORE.ky + ' · ⚠️ Монголиянын эрежеси 2025-жылдагы ички бооз тыюусунан кийин дагы деле колдонулабы белгисиз, ошондуктан бул сандар болжол болуп саналат',
    ur: FAQ_INTRO_PREFIX_MORE.ur + ' · ⚠️ منگولیا کا اصول 2025 کی ملکی شرط پابندی کے بعد اب بھی لاگو ہوتا ہے یا نہیں واضح نہیں، اس لیے یہ اعداد تخمینی ہیں',
    bn: FAQ_INTRO_PREFIX_MORE.bn + ' · ⚠️ মঙ্গোলিয়ার নিয়ম ২০২৫ সালের দেশীয় বাজি নিষেধাজ্ঞার পর এখনও প্রযোজ্য কিনা স্পষ্ট নয়, তাই এই সংখ্যাগুলো অনুমান',
    lo: FAQ_INTRO_PREFIX_MORE.lo + ' · ⚠️ ຍັງບໍ່ຈະແຈ້ງວ່າກົດລະບຽບຂອງມົງໂກເລຍຍັງໃຊ້ໄດ້ຫຼືບໍ່ຫຼັງຈາກຫ້າມການພະນັນພາຍໃນປະເທດປີ 2025 ຕົວເລກນີ້ຈຶ່ງເປັນການຄາດຄະເນ',
    ja: FAQ_INTRO_PREFIX_MORE.ja + ' · ⚠️ モンゴルの規定が2025年の国内賭博禁止後も適用されるか不明確なため、これらの数値は推定値です',
    ar: FAQ_INTRO_PREFIX_MORE.ar + ' · ⚠️ من غير الواضح ما إذا كانت قاعدة منغوليا لا تزال سارية بعد حظر الرهان المحلي عام 2025، لذا فإن هذه الأرقام تقديرية',
    hi: FAQ_INTRO_PREFIX_MORE.hi + ' · ⚠️ मंगोलिया का नियम 2025 की घरेलू सट्टेबाजी प्रतिबंध के बाद अभी भी लागू होता है या नहीं स्पष्ट नहीं है, इसलिए ये आंकड़े अनुमानित हैं',
    fr: FAQ_INTRO_PREFIX_MORE.fr + " · ⚠️ On ne sait pas si la règle mongole s'applique encore après l'interdiction des paris domestiques de 2025, ces chiffres sont donc des estimations",
    tl: FAQ_INTRO_PREFIX_MORE.tl + ' · ⚠️ Hindi malinaw kung naaangkop pa rin ang tuntunin ng Mongolia matapos ang 2025 domestic betting ban nito, kaya tantya ang mga figure na ito',
  }),
  la: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 라오스는 법이 시행된 지 얼마 안 돼 추정치예요', 'Common questions from people who searched their way here · ⚠️ Laos’s law is very new, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 老挝法律施行不久，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Luật của Lào vừa có hiệu lực nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ กฎหมายของลาวเพิ่งมีผลบังคับใช้ ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Закон Лаоса вступил в силу совсем недавно, поэтому цифры являются оценкой', {
    km: FAQ_INTRO_PREFIX_MORE.km + ' · ⚠️ ច្បាប់របស់ឡាវទើបនឹងចូលជាធរមាន ដូច្នេះជាតួលេខប៉ាន់ស្មាន',
    ne: FAQ_INTRO_PREFIX_MORE.ne + ' · ⚠️ लाओसको कानून धेरै नयाँ भएकोले, यी अनुमानित हुन्',
    id: FAQ_INTRO_PREFIX_MORE.id + ' · ⚠️ Undang-undang Laos masih sangat baru, jadi angka ini perkiraan',
    my: FAQ_INTRO_PREFIX_MORE.my + ' · ⚠️ လာအို၏ ဥပဒေသည် အလွန်သစ်နေသေးသဖြင့် ဤကိန်းဂဏန်းများသည် ခန့်မှန်းချက်များဖြစ်သည်',
    si: FAQ_INTRO_PREFIX_MORE.si + ' · ⚠️ ලාඕසයේ නීතිය ඉතා අලුත් බැවින්, මෙම ඉලක්කම් ඇස්තමේන්තු වේ',
    uz: FAQ_INTRO_PREFIX_MORE.uz + " · ⚠️ Laosning qonuni juda yangi, shuning uchun bu raqamlar taxminiy",
    mn: FAQ_INTRO_PREFIX_MORE.mn + ' · ⚠️ Лаосын хууль маш шинэ тул эдгээр тоо баримт нь тооцоо юм',
    kk: FAQ_INTRO_PREFIX_MORE.kk + ' · ⚠️ Лаостың заңы өте жаңа, сондықтан бұл сандар болжам болып табылады',
    ky: FAQ_INTRO_PREFIX_MORE.ky + ' · ⚠️ Лаостун мыйзамы абдан жаңы, ошондуктан бул сандар болжол болуп саналат',
    ur: FAQ_INTRO_PREFIX_MORE.ur + ' · ⚠️ لاؤس کا قانون بہت نیا ہے، اس لیے یہ اعداد تخمینی ہیں',
    bn: FAQ_INTRO_PREFIX_MORE.bn + ' · ⚠️ লাওসের আইন খুবই নতুন, তাই এই সংখ্যাগুলো অনুমান',
    lo: FAQ_INTRO_PREFIX_MORE.lo + ' · ⚠️ ກົດໝາຍຂອງລາວຫາກໍ່ມີຜົນບັງຄັບໃຊ້ ຕົວເລກນີ້ຈຶ່ງເປັນການຄາດຄະເນ',
    ja: FAQ_INTRO_PREFIX_MORE.ja + ' · ⚠️ ラオスの法律は施行されたばかりのため、これらの数値は推定値です',
    ar: FAQ_INTRO_PREFIX_MORE.ar + ' · ⚠️ قانون لاوس جديد جدًا، لذا فإن هذه الأرقام تقديرية',
    hi: FAQ_INTRO_PREFIX_MORE.hi + ' · ⚠️ लाओस का कानून बहुत नया है, इसलिए ये आंकड़े अनुमानित हैं',
    fr: FAQ_INTRO_PREFIX_MORE.fr + " · ⚠️ La loi laotienne est très récente, ces chiffres sont donc des estimations",
    tl: FAQ_INTRO_PREFIX_MORE.tl + ' · ⚠️ Napakabago pa lang ng batas ng Laos, kaya tantya ang mga figure na ito',
  })
};

function updateFaqPanelDesc(){
  const el = document.getElementById('faq-panel-desc');
  if (!el) return;
  const entry = FAQ_PANEL_DESC[sharedCountry] || FAQ_PANEL_DESC.kr;
  el.textContent = entry();
}

function updateFaqTg2Card(){
  const titleEl = document.getElementById('faq-tg2-title');
  const subEl = document.getElementById('faq-tg2-sub');
  updateFaqPanelDesc();
  if (!titleEl || !subEl) return;
  const entry = FAQ_TG2[sharedCountry] || FAQ_TG2.kr;
  titleEl.textContent = entry.title();
  subEl.innerHTML = entry.sub();
}

const DREAM_DATA = {
  freedom: {
    emoji: '🕊️',
    title: '자유의 몸', desc: '월요일 아침이 더 이상 두렵지 않은 삶. 사표는 이미 냈어요.',
    titleEn: 'Free at last', descEn: 'Monday mornings don\u2019t scare you anymore. You already handed in your resignation.',
    titleZh: '自由之身', descZh: '不再害怕星期一早晨的生活。辞职信已经交了。',
    titleVi: 'Cuối cùng cũng tự do', descVi: 'Sáng thứ Hai không còn đáng sợ nữa. Bạn đã nộp đơn xin nghỉ việc rồi.',
    titleTh: 'อิสระในที่สุด', descTh: 'เช้าวันจันทร์ไม่น่ากลัวอีกต่อไป คุณยื่นใบลาออกไปแล้ว',
    titleRu: 'Наконец-то свободен', descRu: 'Утро понедельника больше не пугает. Заявление об увольнении уже подано.',
    titleMore: { ar:'حرّ أخيرًا', bn:'অবশেষে মুক্ত', fr:'Enfin libre', hi:'आख़िरकार आज़ाद', id:'Akhirnya bebas', ja:'ついに自由の身', kk:'Ақыры еркін', km:'ទីបំផុតរួចផុត', ky:'Акыры эркин', lo:'ໃນທີ່ສຸດກໍເປັນອິດສະຫຼະ', mn:'Эцэст нь эрх чөлөөтэй боллоо', my:'နောက်ဆုံးတော့ လွတ်လပ်သွားပြီ', ne:'अन्ततः स्वतन्त्र', si:'අවසානයේ නිදහස්', tl:'Sa wakas, malaya na', ur:'آخرکار آزاد', uz:"Nihoyat erkin" },
    descMore: { ar:'صباحات الاثنين لم تعد تخيفك بعد الآن. لقد قدّمت استقالتك بالفعل.', bn:'সোমবার সকাল আর আপনাকে ভয় দেখায় না। আপনি ইতিমধ্যে পদত্যাগপত্র জমা দিয়েছেন।', fr:'Les lundis matin ne vous font plus peur. Vous avez déjà remis votre démission.', hi:'सोमवार की सुबहें अब आपको डराती नहीं। आपने पहले ही इस्तीफा दे दिया है।', id:'Pagi hari Senin tidak lagi menakutkan bagimu. Kamu sudah mengajukan pengunduran diri.', ja:'月曜日の朝はもう怖くありません。すでに退職届を提出しました。', kk:'Дүйсенбі таңы сізді енді қорқытпайды. Сіз жұмыстан босату өтінішін қойып та қойдыңыз.', km:'ព្រឹកថ្ងៃច័ន្ទលែងធ្វើឱ្យអ្នកខ្លាចទៀតហើយ។ អ្នកបានដាក់លិខិតលាឈប់រួចហើយ។', ky:'Дүйшөмбү эртеси сизди эми коркутпайт. Сиз иштен бошотуу арызын мурунтан эле берип койгонсуз.', lo:'ຕອນເຊົ້າວັນຈັນບໍ່ໜ້າຢ້ານອີກຕໍ່ໄປ ທ່ານໄດ້ຍື່ນໃບລາອອກໄປແລ້ວ.', mn:'Даваа гарагийн өглөө таныг цаашид айлгахгүй. Та аль хэдийн ажлаасаа чөлөөлөгдөх өргөдлөө өгсөн.', my:'တနင်္လာနေ့မနက်ခင်းက သင့်ကို ထပ်မံမကြောက်စေတော့ပါ။ သင် နှုတ်ထွက်စာတင်ပြီးသားဖြစ်သည်။', ne:'सोमबार बिहान अब तपाईंलाई डर लाग्दैन। तपाईंले पहिले नै राजीनामा बुझाइसक्नुभएको छ।', si:'සඳුදා උදෑසන දැන් ඔබට බියක් නැත. ඔබ දැනටමත් ඉල්ලා අස්වීමේ ලිපිය ඉදිරිපත් කර ඇත.', tl:'Hindi ka na natatakot sa umaga ng Lunes. Naisumite mo na ang iyong resignasyon.', ur:'پیر کی صبحیں اب آپ کو خوفزدہ نہیں کرتیں۔ آپ پہلے ہی استعفیٰ دے چکے ہیں۔', uz:"Dushanba ertalabi endi sizni qo'rqitmaydi. Siz allaqachon iste'foingizni topshirgansiz." }
  },
  family:  {
    emoji: '🏠',
    title: '가족 부동산왕', desc: '온 가족이 집 걱정 없이 사는 명절, 그 주인공이 바로 나예요.',
    titleEn: 'Family real-estate mogul', descEn: 'The whole family lives worry-free about housing \u2014 and you\u2019re the reason why.',
    titleZh: '家族房产大亨', descZh: '全家人过节不再为住房发愁，而这一切都是因为你。',
    titleVi: 'Ông trùm bất động sản gia đình', descVi: 'Cả gia đình sống không lo về nhà cửa \u2014 và bạn chính là lý do.',
    titleTh: 'เจ้าพ่ออสังหาริมทรัพย์ของครอบครัว', descTh: 'ทั้งครอบครัวอยู่อย่างไม่ต้องกังวลเรื่องที่อยู่อาศัย \u2014 และคุณคือเหตุผล',
    titleRu: 'Магнат недвижимости для семьи', descRu: 'Вся семья живёт без забот о жилье \u2014 и всё это благодаря вам.',
    titleMore: { ar:'عرّاب عقارات العائلة', bn:'পারিবারিক রিয়েল এস্টেট মোগল', fr:'Magnat immobilier de la famille', hi:'परिवार का रियल-एस्टेट किंग', id:'Raja properti keluarga', ja:'一族の不動産王', kk:'Отбасының жылжымайтын мүлік королі', km:'ស្តេចអចលនទ្រព្យគ្រួសារ', ky:'Үй-бүлөнүн кыймылсыз мүлк королу', lo:'ຣາຊາອະສັງຫາລິມະຊັບຄອບຄົວ', mn:'Гэр бүлийн үл хөдлөх хөрөнгийн хаан', my:'မိသားစု အိမ်ခြံမြေ ဘုရင်', ne:'परिवारको घडेरी बादशाह', si:'පවුලේ දේපල රජු', tl:'Hari ng real estate ng pamilya', ur:'خاندان کا رئیل اسٹیٹ بادشاہ', uz:"Oilaning ko'chmas mulk shohi" },
    descMore: { ar:'العائلة بأكملها تعيش دون قلق بشأن السكن — وأنت السبب في ذلك.', bn:'পুরো পরিবার বাসস্থান নিয়ে চিন্তামুক্ত জীবনযাপন করছে — আর এর কারণ আপনি।', fr:"Toute la famille vit sans souci de logement — et c'est grâce à vous.", hi:'पूरा परिवार बिना घर की चिंता के रहता है — और इसकी वजह आप हैं।', id:'Seluruh keluarga hidup tanpa khawatir soal tempat tinggal — dan kamulah alasannya.', ja:'一家全員が住まいの心配なく暮らしています — その理由はあなたです。', kk:'Бүкіл отбасы баспана туралы уайымсыз өмір сүреді — бұған сіз себепсіз.', km:'ក្រុមគ្រួសារទាំងមូលរស់នៅដោយមិនបារម្ភពីលំនៅដ្ឋាន — ហើយអ្នកគឺជាមូលហេតុ។', ky:'Бүт үй-бүлө турак жай тууралуу тынчсызданбай жашайт — мунун себеби сизсиз.', lo:'ຄອບຄົວທັງໝົດອາໄສຢູ່ໂດຍບໍ່ຕ້ອງກັງວົນເລື່ອງທີ່ຢູ່ອາໄສ — ແລະທ່ານແມ່ນເຫດຜົນ.', mn:'Бүх гэр бүл орон сууцны талаар санаа зовохгүй амьдардаг — учир нь та тэр шалтгаан.', my:'မိသားစုတစ်ခုလုံး အိမ်ခြံမြေအတွက် စိုးရိမ်စရာမလိုဘဲ နေထိုင်နေရပါတယ် — ၎င်းအတွက် အကြောင်းရင်းက သင်ပါပဲ။', ne:'सम्पूर्ण परिवार घर बारे चिन्ता नगरी बस्छ — र त्यसको कारण तपाईं नै हुनुहुन्छ।', si:'මුළු පවුලම නිවාස ගැන කරදර නොවී ජීවත් වේ — ඒ සඳහා හේතුව ඔබයි.', tl:'Ang buong pamilya ay namumuhay nang walang alalahanin tungkol sa tirahan — at ikaw ang dahilan.', ur:'پورا خاندان رہائش کی فکر کے بغیر زندگی گزار رہا ہے — اور اس کی وجہ آپ ہیں۔', uz:"Butun oila uy-joy haqida qayg'urmasdan yashaydi — va buning sababi sizsiz." }
  },
  travel:  {
    emoji: '✈️',
    title: '지구 한 바퀴 클럽', desc: '여권에 도장이 모자랄 지경이에요. 다음 목적지는 어디로 갈까요?',
    titleEn: 'Around-the-world club', descEn: 'Your passport is running out of pages for stamps. Where\u2019s next?',
    titleZh: '环游世界俱乐部', descZh: '护照上的印章都快盖不下了。下一站去哪里呢？',
    titleVi: 'Câu lạc bộ vòng quanh thế giới', descVi: 'Hộ chiếu của bạn sắp hết trang để đóng dấu. Điểm đến tiếp theo là đâu?',
    titleTh: 'คลับรอบโลก', descTh: 'พาสปอร์ตของคุณหน้ากระดาษไม่พอประทับตราแล้ว จุดหมายต่อไปคือที่ไหน?',
    titleRu: 'Клуб кругосветных путешественников', descRu: 'В паспорте почти не осталось места для штампов. Куда дальше?',
    titleMore: { ar:'نادي حول العالم', bn:'বিশ্ব ভ্রমণ ক্লাব', fr:'Club du tour du monde', hi:'दुनिया भर की यात्रा क्लब', id:'Klub keliling dunia', ja:'世界一周クラブ', kk:'Дүниежүзін аралау клубы', km:'ក្លឹបជុំវិញពិភពលោក', ky:'Дүйнөнү кыдыруу клубу', lo:'ຊົມຣົມທ່ອງໂລກ', mn:'Дэлхийг тойрох клуб', my:'ကမ္ဘာလှည့်ကလပ်', ne:'विश्व परिक्रमा क्लब', si:'ලෝකය වටා සංචාරක සමාජය', tl:'Around-the-world club', ur:'دنیا بھر کے سفر کا کلب', uz:"Dunyo bo'ylab sayohat klubi" },
    descMore: { ar:'جواز سفرك أوشك أن ينفد من الصفحات للأختام. إلى أين بعد ذلك؟', bn:'আপনার পাসপোর্টে সিলের জন্য পাতা ফুরিয়ে আসছে। এরপর কোথায়?', fr:"Votre passeport n'a presque plus de pages pour les tampons. Et après ?", hi:'आपके पासपोर्ट में स्टैम्प के लिए पन्ने कम पड़ रहे हैं। अगला कहाँ?', id:'Paspormu hampir kehabisan halaman untuk cap. Ke mana lagi?', ja:'パスポートはスタンプでページが足りなくなりそうです。次はどこへ？', kk:'Төлқұжатыңызда мөр басуға бет жетіспей барады. Келесі қайда?', km:'លិខិតឆ្លងដែនរបស់អ្នកជិតអស់ទំព័រសម្រាប់បោះត្រាហើយ។ បន្ទាប់ទៅណា?', ky:'Паспортуңузда мөөр басууга барак жетишпей баратат. Кийинки жерге кайда?', lo:'ພາສປອດຂອງທ່ານໃກ້ໝົດໜ້າສຳລັບປະທັບຕາແລ້ວ. ຈຸດໝາຍຕໍ່ໄປແມ່ນຢູ່ໃສ?', mn:'Таны паспортын тамга дарах хуудас дуусах шахаж байна. Дараагийн газар хаана вэ?', my:'သင့်နိုင်ငံကူးလက်မှတ်မှာ တံဆိပ်တင်ဖို့ စာမျက်နှာ နီးပါးကုန်နေပြီ။ နောက်ဘယ်ကိုသွားမလဲ?', ne:'तपाईंको राहदानीमा छाप लगाउने पाना सकिन लाग्यो। अर्को गन्तव्य कहाँ हो?', si:'ඔබේ විදේශ ගමන් බලපත්‍රයේ මුද්‍රා සඳහා පිටු ඉවර වෙමින් පවතී. ඊළඟට කොහෙද?', tl:'Halos maubusan na ng pahina ang iyong pasaporte para sa mga selyo. Saan ang susunod?', ur:'آپ کے پاسپورٹ میں مہروں کے لیے صفحات ختم ہو رہے ہیں۔ اگلا کہاں؟', uz:"Pasportingizda muhrlar uchun sahifalar tugab bormoqda. Keyingi manzil qayer?" }
  },
  calm:    {
    emoji: '💼',
    title: '현실주의자', desc: '화려하게 안 살아도 괜찮아요. 잔고만 봐도 웃음이 나요.',
    titleEn: 'The realist', descEn: 'No need for a flashy lifestyle \u2014 just checking your balance makes you smile.',
    titleZh: '现实主义者', descZh: '不用活得多风光也没关系。光是看着余额就会笑出来。',
    titleVi: 'Người thực tế', descVi: 'Không cần lối sống hào nhoáng \u2014 chỉ cần xem số dư tài khoản cũng đủ khiến bạn mỉm cười.',
    titleTh: 'นักสัจนิยม', descTh: 'ไม่จำเป็นต้องใช้ชีวิตหรูหรา \u2014 แค่เช็คยอดเงินก็ยิ้มได้แล้ว',
    titleRu: 'Реалист', descRu: 'Не нужен showy образ жизни \u2014 достаточно проверить баланс, чтобы улыбнуться.',
    titleMore: { ar:'الواقعي', bn:'বাস্তববাদী', fr:'Le réaliste', hi:'यथार्थवादी', id:'Sang realis', ja:'リアリスト', kk:'Реалист', km:'អ្នកនិយមភាពជាក់ស្តែង', ky:'Реалист', lo:'ນັກປະຕິບັດຕົວຈິງ', mn:'Реалист', my:'လက်တွေ့ဝါဒီ', ne:'यथार्थवादी', si:'යථාර්ථවාදියා', tl:'Ang realista', ur:'حقیقت پسند', uz:"Realist" },
    descMore: { ar:'لا حاجة لأسلوب حياة فاخر — مجرد التحقق من رصيدك يجعلك تبتسم.', bn:'জাঁকজমকপূর্ণ জীবনযাপনের দরকার নেই — শুধু ব্যালেন্স দেখলেই হাসি চলে আসে।', fr:"Pas besoin d'un style de vie tape-à-l'œil — juste vérifier votre solde vous fait sourire.", hi:'दिखावटी जीवनशैली की ज़रूरत नहीं — बस अपना बैलेंस देखकर ही मुस्कान आ जाती है।', id:'Tak perlu gaya hidup mewah — cukup cek saldo saja sudah bikin tersenyum.', ja:'派手な暮らしは必要ありません — 残高を確認するだけで笑顔になれます。', kk:'Керемет өмір салты қажет емес — жай ғана балансыңызды тексеру сізді күлдіреді.', km:'មិនចាំបាច់រស់នៅប្រណិតទេ — គ្រាន់តែមើលសមតុល្យក៏ធ្វើឱ្យញញឹមហើយ។', ky:'Ажайып жашоо стили керек эмес — жөн гана балансыңызды текшерүү сизди жылмайтат.', lo:'ບໍ່ຈຳເປັນຕ້ອງໃຊ້ຊີວິດຫລູຫລາ — ພຽງແຕ່ເບິ່ງຍອດເງິນກໍ່ເຮັດໃຫ້ຍິ້ມໄດ້ແລ້ວ.', mn:'Гоёмсог амьдралын хэв маяг хэрэггүй — үлдэгдлээ шалгахад л инээмсэглэл төрдөг.', my:'ဇိမ်ခံနေထိုင်ရေးစတိုင် မလိုအပ်ပါ — ဘဏ်လက်ကျန်ကို စစ်ရုံနဲ့တင် အားရကျေနပ်စိတ်ဖြစ်ပါတယ်။', ne:'चम्किलो जीवनशैली आवश्यक छैन — केवल ब्यालेन्स हेर्दा नै मुस्कान आउँछ।', si:'දිලිසෙන ජීවන රටාවක් අවශ්‍ය නැත — ඔබේ ශේෂය පරීක්ෂා කිරීමෙන් ම සිනාව එයි.', tl:'Hindi kailangan ng mamahaling pamumuhay — ang pagtingin lang sa balanse mo ay nakakapangiti na.', ur:'دکھاوے کی زندگی کی ضرورت نہیں — بس اپنا بیلنس دیکھ کر ہی مسکراہٹ آ جاتی ہے۔', uz:"Ko'z-ko'z qiladigan turmush tarzi shart emas — hisobingizni tekshirish sizni jilmaytiradi." }
  },
};

let lastPickedDreamKey = null; // 마지막으로 고른 드림 카드 — 언어 전환 시 dream-result 텍스트를 새 언어로 다시 그리기 위해 기억해둠

// finalAmtOverride: home-final-amt는 animateValueChange()로 requestAnimationFrame을 통해
// 비동기로 애니메이션되며 채워지므로, 이 함수 호출 시점에 DOM에서 바로 읽으면 애니메이션 도중의
// 값(또는 이전 언어 포맷)을 읽어버리는 레이스 컨디션이 생길 수 있음 — updateHomeCalc()처럼 최종
// 금액을 이미 계산해둔 곳에서는 그 값을 직접 넘겨줘서 항상 정확한 최신 금액이 쓰이게 함
function renderDreamResult(key, finalAmtOverride){
  const data = DREAM_DATA[key];
  if (!data) return;
  const finalAmt = finalAmtOverride !== undefined ? finalAmtOverride : document.getElementById('home-final-amt').textContent;
  document.getElementById('dream-title').textContent = data.emoji + ' ' + pickLang(data.title, data.titleEn, data.titleZh, data.titleVi, data.titleTh, data.titleRu, data.titleMore);
  document.getElementById('dream-desc').textContent = pickLang(data.desc, data.descEn, data.descZh, data.descVi, data.descTh, data.descRu, data.descMore);
  document.getElementById('dream-amt').textContent = pickLang(finalAmt + '의 주인공', `The one taking home ${finalAmt}`, `坐拥${finalAmt}的人`, `Người sở hữu ${finalAmt}`, `เจ้าของเงิน ${finalAmt}`, `Обладатель ${finalAmt}`, {
    ar: `صاحب ${finalAmt}`, bn: `${finalAmt}-এর মালিক`, fr: `Celui qui empoche ${finalAmt}`, hi: `${finalAmt} पाने वाला`,
    id: `Pemilik ${finalAmt}`, ja: `${finalAmt}を手にする人`, kk: `${finalAmt} иесі`, km: `ម្ចាស់ ${finalAmt}`,
    ky: `${finalAmt} ээси`, lo: `ເຈົ້າຂອງ ${finalAmt}`, mn: `${finalAmt}-ыг гартаа авагч`, my: `${finalAmt} ရရှိသူ`,
    ne: `${finalAmt} पाउने व्यक्ति`, si: `${finalAmt} හිමිකරු`, tl: `Ang may-ari ng ${finalAmt}`, ur: `${finalAmt} کا مالک`,
    uz: `${finalAmt} egasi`,
  });
}

function pickDream(key){
  if (!DREAM_DATA[key]) return;
  lastPickedDreamKey = key;
  renderDreamResult(key);
  const resultEl = document.getElementById('dream-result');
  resultEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  fireConfettiBurst();
}

// 브랜드 컬러 사각 조각 14개가 dream-result 위에서 짧게 떨어지는 연출.
// prefers-reduced-motion 환경에서는 CSS 쪽에서 애니메이션 자체를 꺼버리므로 여기서는 그냥 만들기만 해도 안전함
function fireConfettiBurst(){
  const target = document.getElementById('dream-result');
  if (!target) return;
  const colors = ['#155445', '#9C6F1E', '#F0A98C', '#FFFEF9', '#0D3A2F'];
  const rect = target.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (rect.left + window.scrollX + Math.random() * rect.width) + 'px';
    piece.style.top = (rect.top + window.scrollY) + 'px';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.15) + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1000);
  }
}

// dream-result가 이미 열려있는 상태에서 언어가 바뀌거나 당첨 금액이 바뀌면, 고정 텍스트로 남지
// 않도록 현재 언어·최신 금액으로 다시 그려줌
function refreshDreamResultIfOpen(finalAmtOverride){
  const resultEl = document.getElementById('dream-result');
  if (resultEl && resultEl.style.display !== 'none' && lastPickedDreamKey) {
    renderDreamResult(lastPickedDreamKey, finalAmtOverride);
  }
}

async function shareDreamResult(){
  const title = document.getElementById('dream-title').textContent;
  const amt = document.getElementById('dream-amt').textContent;
  const shareText = pickLang(
    `나는 [${title}]! ${amt}. 너는 당첨되면 뭐부터 할래?`,
    `I'm [${title}]! ${amt}. What would you do first if you won?`,
    `我是[${title}]！${amt}。如果你中奖了，会先做什么？`,
    `Tôi là [${title}]! ${amt}. Bạn sẽ làm gì đầu tiên nếu trúng số?`,
    `ฉันคือ [${title}]! ${amt}. คุณจะทำอะไรก่อนถ้าถูกรางวัล?`,
    `Я [${title}]! ${amt}. Что бы вы сделали в первую очередь, если бы выиграли?`,
    {
      ar: `أنا [${title}]! ${amt}. ماذا ستفعل أولاً لو فزت؟`,
      bn: `আমি [${title}]! ${amt}। জিতলে তুমি প্রথমে কী করবে?`,
      fr: `Je suis [${title}] ! ${amt}. Que ferais-tu en premier si tu gagnais ?`,
      hi: `मैं [${title}] हूँ! ${amt}. अगर तुम जीतोगे तो सबसे पहले क्या करोगे?`,
      id: `Aku [${title}]! ${amt}. Kalau kamu menang, apa yang akan kamu lakukan duluan?`,
      ja: `私は[${title}]！${amt}。あなたは当たったら最初に何する？`,
      kk: `Мен [${title}]! ${amt}. Сен ұтып алсаң, ең алдымен не істер едің?`,
      km: `ខ្ញុំគឺជា [${title}]! ${amt}។ បើអ្នកឈ្នះ តើអ្នកនឹងធ្វើអ្វីមុនគេ?`,
      ky: `Мен [${title}]! ${amt}. Сен утуп алсаң, эң оболу эмне кыласың?`,
      lo: `ຂ້ອຍແມ່ນ [${title}]! ${amt}. ຖ້າເຈົ້າຖືກລາງວັນ ເຈົ້າຈະເຮັດຫຍັງກ່ອນ?`,
      mn: `Би бол [${title}]! ${amt}. Чи хожвол юуг эхлээд хийх вэ?`,
      my: `ငါက [${title}]! ${amt}။ သင်ဆုမှန်ရင် ဘာကို အရင်လုပ်မလဲ?`,
      ne: `म [${title}] हुँ! ${amt}। तिमी जित्यौ भने पहिले के गर्छौ?`,
      si: `මම [${title}]! ${amt}. ඔබ දිනුවොත් මුලින්ම කරන්නේ මොකක්ද?`,
      tl: `Ako si [${title}]! ${amt}. Ano ang unang gagawin mo kung manalo ka?`,
      ur: `میں [${title}] ہوں! ${amt}۔ اگر آپ جیت جائیں تو سب سے پہلے کیا کریں گے؟`,
      uz: `Men [${title}]! ${amt}. Agar yutib olsang, birinchi bo'lib nima qilasan?`,
    }
  );
  const shareUrl = location.href;
  const shareTitle = pickLang('당첨되면 나는?', 'What would I do if I won?', '如果中奖了，我会……', 'Nếu trúng số tôi sẽ?', 'ถ้าถูกรางวัลฉันจะ?', 'Что бы я сделал, если бы выиграл?', { ar:'ماذا سأفعل لو فزت؟', bn:'জিতলে আমি কী করব?', fr:'Que ferais-je si je gagnais ?', hi:'अगर मैं जीत जाऊं तो क्या करूंगा?', id:'Apa yang akan kulakukan kalau menang?', ja:'当たったら私は何をする？', kk:'Ұтып алсам не істер едім?', km:'តើខ្ញុំនឹងធ្វើអ្វី ប្រសិនបើឈ្នះ?', ky:'Утуп алсам эмне кылмакмын?', lo:'ຖ້າຂ້ອຍຖືກລາງວັນ ຂ້ອຍຈະເຮັດຫຍັງ?', mn:'Хожвол би юу хийх вэ?', my:'ဆုမှန်ရင် ငါဘာလုပ်မလဲ?', ne:'जितें भने म के गर्छु?', si:'මම දිනුවොත් මොකද කරන්නේ?', tl:'Ano ang gagawin ko kung manalo ako?', ur:'اگر میں جیت جاؤں تو کیا کروں گا؟', uz:'Agar yutib olsam, nima qilaman?' });

  const cardSub = pickLang('너는 당첨되면 뭐부터 할래?', 'What would you do first if you won?', '如果你中奖了，会先做什么？', 'Bạn sẽ làm gì đầu tiên nếu trúng số?', 'คุณจะทำอะไรก่อนถ้าถูกรางวัล?', 'Что бы вы сделали в первую очередь, если бы выиграли?', { ar:'ماذا ستفعل أولاً لو فزت؟', bn:'জিতলে তুমি প্রথমে কী করবে?', fr:'Que ferais-tu en premier si tu gagnais ?', hi:'अगर तुम जीतोगे तो सबसे पहले क्या करोगे?', id:'Kalau kamu menang, apa yang akan kamu lakukan duluan?', ja:'あなたは当たったら最初に何する？', kk:'Сен ұтып алсаң, ең алдымен не істер едің?', km:'បើអ្នកឈ្នះ តើអ្នកនឹងធ្វើអ្វីមុនគេ?', ky:'Сен утуп алсаң, эң оболу эмне кыласың?', lo:'ຖ້າເຈົ້າຖືກລາງວັນ ເຈົ້າຈະເຮັດຫຍັງກ່ອນ?', mn:'Чи хожвол юуг эхлээд хийх вэ?', my:'သင်ဆုမှန်ရင် ဘာကို အရင်လုပ်မလဲ?', ne:'तिमी जित्यौ भने पहिले के गर्छौ?', si:'ඔබ දිනුවොත් මුලින්ම කරන්නේ මොකක්ද?', tl:'Ano ang unang gagawin mo kung manalo ka?', ur:'اگر آپ جیت جائیں تو سب سے پہلے کیا کریں گے؟', uz:"Agar yutib olsang, birinchi bo'lib nima qilasan?" });
  const cardFooter = pickLang('👉 참택스에서 나도 골라보기', '👉 Pick yours on ChamTax', '👉 到ChamTax也选一个', '👉 Chọn của bạn trên ChamTax', '👉 เลือกของคุณที่ ChamTax', '👉 Выберите своё на ChamTax', { ar:'👉 اختر خيارك على ChamTax', bn:'👉 ChamTax-এ তোমারটা বেছে নাও', fr:'👉 Choisissez le vôtre sur ChamTax', hi:'👉 ChamTax पर अपना चुनें', id:'👉 Pilih milikmu di ChamTax', ja:'👉 ChamTaxであなたも選んでみて', kk:'👉 ChamTax-та өзіңіздікін таңдаңыз', km:'👉 ជ្រើសរើសរបស់អ្នកនៅ ChamTax', ky:"👉 ChamTax'та өзүңдүкүн тандаңыз", lo:'👉 ເລືອກຂອງເຈົ້າທີ່ ChamTax', mn:'👉 ChamTax дээр өөрийнхөө сонголтыг хийгээрэй', my:'👉 ChamTax တွင် သင့်ရွေးချယ်မှုကို ရွေးပါ', ne:'👉 ChamTax मा आफ्नो छान्नुहोस्', si:'👉 ChamTax හි ඔබේ එක තෝරන්න', tl:"👉 Piliin ang sa'yo sa ChamTax", ur:'👉 ChamTax پر اپنا انتخاب کریں', uz:"👉 ChamTax'da o'zingiznikini tanlang" });
  const canvas = buildShareCard({ label: title, bigText: amt, subText: cardSub, footerText: cardFooter });
  if (await tryShareCardImage(canvas, shareTitle, shareText)) return;

  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    alert(pickLang('복사됐어요! 카톡에 붙여넣기 해보세요 :)', 'Copied! Paste it anywhere you like :)', '已复制！粘贴到任何地方分享吧 :)', 'Đã sao chép! Dán vào bất cứ đâu bạn muốn :)', 'คัดลอกแล้ว! วางที่ไหนก็ได้ที่คุณต้องการ :)', 'Скопировано! Вставьте куда угодно :)', COPIED_TOAST_MORE));
  } catch (e) {
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享', 'Nhấn giữ để sao chép rồi chia sẻ', 'กดค้างเพื่อคัดลอกแล้วแชร์', 'Нажмите и удерживайте, чтобы скопировать, затем поделитесь', PRESS_HOLD_COPY_MORE), `${shareText} ${shareUrl}`);
  }
}

// 아직 금액을 입력/조작한 적 없는 기본 상태(입력칸은 placeholder만 있고 실제 값은 비어있음)에서
// 공유하면, 계산해본 적도 없는 기본값(100M USD)이 마치 실제로 나온 결과인 것처럼 특정 금액이
// 박힌 카드로 나가버리는 문제가 있었음 — isAmountManuallyEdited가 true일 때(사용자가 직접
// 입력했거나 슬라이더/퀵필 버튼을 조작한 적 있을 때)만 결과 카드를 공유하고, 그 전에는 특정
// 금액 없이 사이트 자체를 소개하는 일반 카드로 공유함
async function shareGenericPromo(){
  const shareTitle = document.querySelector('[data-i18n="hero.tag"]')?.textContent?.trim() || 'ChamTax';
  const heroTitleEl = document.querySelector('[data-i18n-html="hero.title"]');
  let heroTitleText = '';
  if (heroTitleEl) {
    // hero.title엔 줄바꿈용 <br>이 들어있는데 textContent는 <br>을 공백 없이 그냥 이어붙여서
    // "wouldyou"처럼 단어가 붙어버림 — <br>을 실제 공백으로 바꾼 뒤 텍스트만 뽑음
    const clone = heroTitleEl.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    heroTitleText = clone.textContent.replace(/\s+/g, ' ').trim();
  }
  const shareText = heroTitleText ? `${shareTitle} — ${heroTitleText}` : shareTitle;
  const shareUrl = location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  const btn = document.getElementById('home-share-btn');
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = pickLang('✅ 링크가 복사됐어요', '✅ Link copied', '✅ 链接已复制', '✅ Đã sao chép liên kết', '✅ คัดลอกลิงก์แล้ว', '✅ Ссылка скопирована', LINK_COPIED_MORE);
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享', 'Nhấn giữ để sao chép rồi chia sẻ', 'กดค้างเพื่อคัดลอกแล้วแชร์', 'Нажмите и удерживайте, чтобы скопировать, затем поделитесь', PRESS_HOLD_COPY_MORE), `${shareText} ${shareUrl}`);
  }
}

async function shareResult(){
  if (!isAmountManuallyEdited) { await shareGenericPromo(); return; }
  const amountText = document.getElementById('homeAmountInput').value || '100';
  const finalAmt = document.getElementById('home-final-amt').textContent;
  const homeCountryVal = document.getElementById('homeCountrySelect').value;
  const country = homeCountryVal === 'us'
    ? pickLang('미국 거주자', 'US resident', '美国居民', 'Cư dân Mỹ', 'ผู้พำนักในสหรัฐฯ', 'Резидент США', buildCountryMore('us'))
    : homeCountryVal === 'cn'
    ? pickLang('중국 거주자', 'China resident', '中国居民', 'Cư dân Trung Quốc', 'ผู้พำนักในจีน', 'Резидент Китая', buildCountryMore('cn'))
    : homeCountryVal === 'in'
    ? pickLang('인도 거주자', 'India resident', '印度居民', 'Cư dân Ấn Độ', 'ผู้พำนักในอินเดีย', 'Резидент Индии', buildCountryMore('in'))
    : pickLang('한국 거주자', 'Korea resident', '韩国居民', 'Cư dân Hàn Quốc', 'ผู้พำนักในเกาหลี', 'Резидент Кореи', buildCountryMore('kr'));
  const article = homeCountryVal === 'in' ? 'an' : 'a'; // "an India resident" vs "a US/China/Korea resident"
  const shareText = pickLang(
    `미국 복권(${amountText} Million USD) 당첨되면 ${country} 기준 실수령액이 약 ${finalAmt}이래요. 세금 떼고 나면 실제로 얼마 남는지 참택스에서 계산해보세요! (참고용 시뮬레이션 결과예요)`,
    `If I won the US lottery (${amountText} Million USD), my take-home as ${article} ${country} would be about ${finalAmt}. See how much you'd actually keep after tax on ChamTax! (This is a reference simulation)`,
    `如果中了美国彩票（${amountText} Million USD），按${country}计算实得金额大约是${finalAmt}。来ChamTax算算你扣税后实际能拿到多少吧！（仅供参考的模拟计算）`,
    `Nếu trúng xổ số Mỹ (${amountText} Million USD), số tiền thực nhận theo ${country} sẽ khoảng ${finalAmt}. Xem bạn thực sự giữ lại bao nhiêu sau thuế trên ChamTax! (Đây là kết quả mô phỏng tham khảo)`,
    `ถ้าถูกลอตเตอรีสหรัฐฯ (${amountText} Million USD) เงินที่ได้รับจริงตาม${country}จะอยู่ที่ประมาณ ${finalAmt} ลองดูว่าคุณจะเหลือเงินจริงเท่าไหร่หลังหักภาษีที่ ChamTax! (นี่เป็นผลจำลองเพื่ออ้างอิง)`,
    `Если бы я выиграл в американскую лотерею (${amountText} Million USD), моя сумма на руки как ${country} составила бы около ${finalAmt}. Узнайте, сколько реально останется после налогов на ChamTax! (Это справочное моделирование)`,
    {
      ar: `إذا فزت في يانصيب الولايات المتحدة (${amountText} مليون دولار)، فسيكون صافي دخلي بصفتي ${country} حوالي ${finalAmt}. اطّلع على المبلغ الذي ستحتفظ به فعليًا بعد الضريبة على ChamTax! (هذه محاكاة مرجعية)`,
      bn: `আমি মার্কিন লটারি (${amountText} মিলিয়ন USD) জিতলে, ${country} হিসেবে আমার প্রকৃত আয় হবে প্রায় ${finalAmt}। কর বাদ দেওয়ার পর আসলে কত থাকে তা ChamTax-এ হিসাব করে দেখুন! (এটি একটি রেফারেন্স সিমুলেশন)`,
      fr: `Si je gagnais à la loterie américaine (${amountText} millions USD), mon revenu net en tant que ${country} serait d'environ ${finalAmt}. Découvrez combien il vous resterait réellement après impôt sur ChamTax ! (Ceci est une simulation de référence)`,
      hi: `अगर मैं अमेरिकी लॉटरी (${amountText} मिलियन USD) जीतूं, तो ${country} के रूप में मेरी हाथ में आने वाली राशि लगभग ${finalAmt} होगी। टैक्स कटने के बाद असल में कितना बचता है, यह ChamTax पर देखें! (यह एक संदर्भ सिमुलेशन है)`,
      id: `Kalau aku menang lotre AS (${amountText} Juta USD), take-home-ku sebagai ${country} akan sekitar ${finalAmt}. Lihat berapa yang benar-benar tersisa setelah pajak di ChamTax! (Ini simulasi referensi)`,
      ja: `もしアメリカの宝くじ（${amountText} Million USD）に当たったら、${country}としての手取り額は約${finalAmt}になります。税金を引いた後に実際いくら残るかChamTaxで計算してみてください！（参考シミュレーションです）`,
      kk: `Егер мен АҚШ лотереясында (${amountText} млн USD) ұтып алсам, ${country} ретінде қолыма тиетін сома шамамен ${finalAmt} болар еді. Салықтан кейін нақты қанша қалатынын ChamTax-та есептеп көріңіз! (Бұл анықтамалық модельдеу)`,
      km: `ប្រសិនបើខ្ញុំឈ្នះឆ្នោតអាមេរិក (${amountText} លានដុល្លារ) ចំណូលសុទ្ធរបស់ខ្ញុំក្នុងនាម${country}នឹងមានប្រហែល ${finalAmt}។ សូមមើលថាតើអ្នកនឹងនៅសល់ប៉ុន្មានពិតប្រាកដបន្ទាប់ពីបង់ពន្ធនៅ ChamTax! (នេះជាការក្លែងធ្វើសម្រាប់យោង)`,
      ky: `Эгер мен АКШ лотереясында (${amountText} млн USD) утуп алсам, ${country} катары кол алдырма акчам болжол менен ${finalAmt} болмок. Салыктан кийин чын-чынына канча калаарын ChamTax'та эсептеп көрүңүз! (Бул шилтемелик моделдөө)`,
      lo: `ຖ້າຂ້ອຍຖືກລອດເຕີຣີອາເມລິກາ (${amountText} ລ້ານໂດລາ) ເງິນທີ່ໄດ້ຮັບຈິງຂອງຂ້ອຍໃນຖານະ${country}ຈະປະມານ ${finalAmt}. ລອງເບິ່ງວ່າຫຼັງຫັກພາສີແລ້ວຈະເຫຼືອຈິງເທົ່າໃດທີ່ ChamTax! (ນີ້ແມ່ນການຈຳລອງເພື່ອອ້າງອີງ)`,
      mn: `Хэрэв би АНУ-ын лотерейнд (${amountText} сая доллар) хожвол, ${country} хувьд гарт орох дүн минь ойролцоогоор ${finalAmt} байх болно. Татвар суутгасны дараа бодитоор хэд үлдэхийг ChamTax дээр тооцоолж үзээрэй! (Энэ бол лавлагаа загварчлал юм)`,
      my: `အမေရိကန်ထီ (${amountText} သန်း USD) ကို ငါဆွတ်ခူးမိရင်၊ ${country} အနေနဲ့ ငါ့လက်ခံရရှိမှုက ${finalAmt} လောက်ဖြစ်မယ်။ အခွန်ပြီးနောက် တကယ်ဘယ်လောက်ကျန်လဲဆိုတာ ChamTax မှာ တွက်ချက်ကြည့်ပါ! (ဒါက ရည်ညွှန်း သရုပ်ဖော်မှုသာဖြစ်ပါတယ်)`,
      ne: `यदि मैले अमेरिकी लटरी (${amountText} मिलियन USD) जिते भने, ${country} को रूपमा मेरो हातमा पर्ने रकम लगभग ${finalAmt} हुनेछ। कर कटौती पछि वास्तवमा कति बाँकी रहन्छ ChamTax मा गणना गरेर हेर्नुहोस्! (यो एक सन्दर्भ सिमुलेसन हो)`,
      si: `මම ඇමරිකානු ලොතරැයිය (${amountText} මිලියන USD) දිනුවොත්, ${country} ලෙස මගේ අත් ලාභය ආසන්න වශයෙන් ${finalAmt} වනු ඇත. බදු අඩු කිරීමෙන් පසු සැබවින්ම ඉතිරි වන්නේ කීයද කියා ChamTax හි ගණනය කර බලන්න! (මෙය යොමු අනුකරණයකි)`,
      tl: `Kung mananalo ako sa lottery ng US (${amountText} Million USD), ang take-home ko bilang ${country} ay magiging humigit-kumulang ${finalAmt}. Tingnan kung magkano talaga ang matitira pagkatapos ng buwis sa ChamTax! (Ito ay isang reference simulation)`,
      ur: `اگر میں امریکی لاٹری (${amountText} ملین USD) جیت جاؤں تو ${country} کے طور پر میری ہاتھ میں آنے والی رقم تقریباً ${finalAmt} ہوگی۔ ٹیکس کٹنے کے بعد واقعی کتنا بچتا ہے یہ ChamTax پر حساب لگائیں! (یہ ایک حوالہ سیمولیشن ہے)`,
      uz: `Agar men AQSh lotereyasida (${amountText} million USD) yutsam, ${country} sifatida qo'lga tegadigan summam taxminan ${finalAmt} bo'lardi. Soliqdan keyin haqiqatda qancha qolishini ChamTax'da hisoblab ko'ring! (Bu ma'lumot uchun simulyatsiya)`,
    }
  );
  const shareUrl = location.href;
  const shareTitle = pickLang('미국 복권 세금 계산기 - 참택스', 'US Lottery Tax Calculator - ChamTax', '美国彩票税金计算器 - ChamTax', 'Máy tính thuế xổ số Mỹ - ChamTax', 'เครื่องคำนวณภาษีลอตเตอรีสหรัฐฯ - ChamTax', 'Калькулятор налога на американскую лотерею - ChamTax', { ar:'حاسبة ضريبة اليانصيب الأمريكي - ChamTax', bn:'মার্কিন লটারি ট্যাক্স ক্যালকুলেটর - ChamTax', fr:"Calculateur d'impôt sur la loterie américaine - ChamTax", hi:'अमेरिकी लॉटरी टैक्स कैलकुलेटर - ChamTax', id:'Kalkulator Pajak Lotre AS - ChamTax', ja:'アメリカ宝くじ税金計算機 - ChamTax', kk:'АҚШ лотереясының салық калькуляторы - ChamTax', km:'ម៉ាស៊ីនគណនាពន្ធឆ្នោតអាមេរិក - ChamTax', ky:'АКШ лотереясынын салык калькулятору - ChamTax', lo:'ເຄື່ອງຄິດໄລ່ພາສີລອດເຕີຣີອາເມລິກາ - ChamTax', mn:'АНУ-ын лотерейн татварын тооцоолуур - ChamTax', my:'အမေရိကန်ထီအခွန် တွက်ချက်စက် - ChamTax', ne:'अमेरिकी लटरी कर क्यालकुलेटर - ChamTax', si:'ඇමරිකානු ලොතරැයි බදු ගණකය - ChamTax', tl:'US Lottery Tax Calculator - ChamTax', ur:'امریکی لاٹری ٹیکس کیلکولیٹر - ChamTax', uz:"AQSh lotereyasi soliq kalkulyatori - ChamTax" });

  const cardLabel = pickLang('💰 예상 실수령액 (일시불 기준)', '💰 Estimated take-home (lump sum)', '💰 预计实得金额（一次性）', '💰 Số tiền thực nhận ước tính (trả một lần)', '💰 เงินที่คาดว่าจะได้รับจริง (จ่ายครั้งเดียว)', '💰 Ожидаемая сумма на руки (единовременно)', { ar:'💰 صافي الدخل المتوقع (دفعة واحدة)', bn:'💰 আনুমানিক প্রকৃত আয় (একবারে)', fr:'💰 Revenu net estimé (paiement unique)', hi:'💰 अनुमानित हाथ में आने वाली राशि (एकमुश्त)', id:'💰 Perkiraan take-home (sekaligus)', ja:'💰 予想手取り額（一時金）', kk:'💰 Болжамды қолға тиетін сома (бір жолғы төлем)', km:'💰 ចំណូលសុទ្ធប៉ាន់ស្មាន (ទូទាត់តែម្តង)', ky:'💰 Болжолдуу кол алдырма акча (бир жолку төлөм)', lo:'💰 ເງິນທີ່ຄາດວ່າຈະໄດ້ຮັບຈິງ (ຈ່າຍເທື່ອດຽວ)', mn:'💰 Тооцоолсон гарт орох дүн (нэг удаагийн төлбөр)', my:'💰 ခန့်မှန်းလက်ခံရရှိမှု (တစ်ကြိမ်တည်း)', ne:'💰 अनुमानित हातमा पर्ने रकम (एकमुष्ट)', si:'💰 ඇස්තමේන්තුගත අත් ලාභය (එකවර ගෙවීම)', tl:'💰 Tinatayang take-home (lump sum)', ur:'💰 متوقع ہاتھ میں آنے والی رقم (یکمشت)', uz:"💰 Taxminiy qo'lga tegadigan summa (bir martalik to'lov)" });
  const cardSub = pickLang(`${amountText} Million USD 당첨 시 · ${country} 기준`, `If you win $${amountText}M USD · as ${article} ${country}`, `如果中了${amountText} Million USD · 按${country}计算`, `Nếu trúng ${amountText} Million USD · theo ${country}`, `ถ้าถูก ${amountText} Million USD · ตาม${country}`, `Если выиграть ${amountText} Million USD · как ${country}`, {
      ar: `عند الفوز بـ ${amountText} مليون دولار · بصفتك ${country}`,
      bn: `${amountText} মিলিয়ন USD জিতলে · ${country} হিসেবে`,
      fr: `En cas de gain de ${amountText} millions USD · en tant que ${country}`,
      hi: `${amountText} मिलियन USD जीतने पर · ${country} के रूप में`,
      id: `Jika menang $${amountText}M USD · sebagai ${country}`,
      ja: `${amountText} Million USD当選時 · ${country}として`,
      kk: `${amountText} млн USD ұтқанда · ${country} ретінде`,
      km: `ប្រសិនបើឈ្នះ ${amountText} លានដុល្លារ · ក្នុងនាម${country}`,
      ky: `${amountText} млн USD утканда · ${country} катары`,
      lo: `ຖ້າຖືກ ${amountText} ລ້ານໂດລາ · ໃນຖານະ${country}`,
      mn: `${amountText} сая доллар хожвол · ${country} хувьд`,
      my: `${amountText} သန်း USD ဆွတ်ခူးရင် · ${country} အနေနဲ့`,
      ne: `${amountText} मिलियन USD जित्दा · ${country} को रूपमा`,
      si: `${amountText} මිලියන USD දිනුවොත් · ${country} ලෙස`,
      tl: `Kung mananalo ng $${amountText}M USD · bilang ${country}`,
      ur: `${amountText} ملین USD جیتنے پر · ${country} کے طور پر`,
      uz: `${amountText} million USD yutganda · ${country} sifatida`,
    });
  const cardFooter = pickLang('👉 참택스에서 직접 계산해보기', '👉 Calculate yours on ChamTax', '👉 到ChamTax自己算算看', '👉 Tự tính trên ChamTax', '👉 ลองคำนวณเองที่ ChamTax', '👉 Посчитайте своё на ChamTax', { ar:'👉 احسب حالتك على ChamTax', bn:'👉 ChamTax-এ নিজেরটা হিসাব করুন', fr:'👉 Calculez le vôtre sur ChamTax', hi:'👉 ChamTax पर खुद हिसाब लगाएं', id:'👉 Hitung sendiri di ChamTax', ja:'👉 ChamTaxで自分で計算してみる', kk:'👉 ChamTax-та өзіңіз есептеп көріңіз', km:'👉 គណនាដោយខ្លួនឯងនៅ ChamTax', ky:"👉 ChamTax'та өзүңүз эсептеп көрүңүз", lo:'👉 ລອງຄິດໄລ່ເອງທີ່ ChamTax', mn:'👉 ChamTax дээр өөрөө тооцоолж үзээрэй', my:'👉 ChamTax တွင် ကိုယ်တိုင် တွက်ချက်ကြည့်ပါ', ne:'👉 ChamTax मा आफैं गणना गर्नुहोस्', si:'👉 ChamTax හි ඔබම ගණනය කරන්න', tl:"👉 Kalkulahin ang sa'yo sa ChamTax", ur:'👉 ChamTax پر خود حساب لگائیں', uz:"👉 ChamTax'da o'zingiz hisoblab ko'ring" });
  const canvas = buildShareCard({ label: cardLabel, bigText: finalAmt, subText: cardSub, footerText: cardFooter });
  if (await tryShareCardImage(canvas, shareTitle, shareText)) return;

  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      return;
    } catch (e) {
      // 사용자가 공유 취소한 경우 등 — 조용히 무시
      if (e && e.name === 'AbortError') return;
    }
  }

  // Web Share API 미지원 브라우저 — 클립보드 복사로 대체
  const btn = document.getElementById('home-share-btn');
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = pickLang('✅ 링크가 복사됐어요', '✅ Link copied', '✅ 链接已复制', '✅ Đã sao chép liên kết', '✅ คัดลอกลิงก์แล้ว', '✅ Ссылка скопирована', LINK_COPIED_MORE);
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    // 클립보드 API까지 막힌 환경(카카오톡 등 인앱 브라우저 등) — 사용자가 직접 보고 복사할 수 있게 표시
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享', 'Nhấn giữ để sao chép rồi chia sẻ', 'กดค้างเพื่อคัดลอกแล้วแชร์', 'Нажмите и удерживайте, чтобы скопировать, затем поделитесь', PRESS_HOLD_COPY_MORE), `${shareText} ${shareUrl}`);
  }
}

async function shareRefundChecklist(){
  const shareText = pickLang(
    '나도 모르게 못 받은 돈이 있는지 체크리스트로 확인해봐요. 국세환급금만 매년 수천억 원대가 안 찾아가서 사라진대요 (5년 지나면 국고로 귀속). 참택스 FAQ에서 10분이면 확인 끝나요!',
    'I checked whether I had unclaimed money using this checklist. Apparently hundreds of billions of won in unclaimed tax refunds go unclaimed every year in Korea (reverts to the treasury after 5 years). Takes 10 minutes to check on the ChamTax FAQ!',
    '我用这个清单确认了自己是否有不知道的未领取的钱。据说韩国每年都有数百亿韩元的税款没人领取（5年后归国库）。在ChamTax的FAQ里10分钟就能确认完！',
    'Tôi đã kiểm tra xem mình có khoản tiền chưa nhận nào không bằng danh sách này. Ở Hàn Quốc, mỗi năm có hàng trăm tỷ won tiền hoàn thuế không ai nhận (sẽ thuộc về ngân khố sau 5 năm). Chỉ mất 10 phút để kiểm tra trên FAQ của ChamTax!',
    'ฉันตรวจสอบว่ามีเงินที่ไม่รู้ว่ายังไม่ได้รับหรือไม่ด้วยเช็คลิสต์นี้ ในเกาหลีมีเงินคืนภาษีหลายแสนล้านวอนที่ไม่มีใครมารับทุกปี (จะตกเป็นของคลังหลัง 5 ปี) ใช้เวลาแค่ 10 นาทีในการตรวจสอบที่ FAQ ของ ChamTax!',
    'Я проверил, есть ли у меня невостребованные деньги, с помощью этого чек-листа. В Корее ежегодно остаются невостребованными сотни миллиардов вон возврата налогов (переходят в казну через 5 лет). Проверка на FAQ ChamTax занимает всего 10 минут!',
    {
      ar: 'تحققت مما إذا كان لدي أموال لم أستلمها باستخدام هذه القائمة. يبدو أن مئات المليارات من الوون في مبالغ استرداد الضرائب غير المطالب بها تضيع كل عام في كوريا (تؤول إلى الخزينة بعد 5 سنوات). يستغرق الأمر 10 دقائق للتحقق في FAQ الخاصة بـ ChamTax!',
      bn: 'আমি এই চেকলিস্ট দিয়ে আমার কোনো না পাওয়া টাকা আছে কিনা পরীক্ষা করেছি। কোরিয়াতে প্রতি বছর কয়েকশ বিলিয়ন ওন দাবি না করা কর ফেরত হারিয়ে যায় (৫ বছর পর কোষাগারে চলে যায়)। ChamTax-এর FAQ-তে ১০ মিনিটেই যাচাই শেষ!',
      fr: "J'ai vérifié si j'avais de l'argent non réclamé avec cette checklist. Apparemment, des centaines de milliards de wons de remboursements d'impôts non réclamés disparaissent chaque année en Corée (reviennent au trésor après 5 ans). Il suffit de 10 minutes pour vérifier sur la FAQ de ChamTax !",
      hi: 'मैंने इस चेकलिस्ट से जांचा कि मेरे पास कोई अनक्लेम्ड पैसा तो नहीं है। कोरिया में हर साल सैकड़ों अरब वॉन के बिना दावे वाले टैक्स रिफंड गायब हो जाते हैं (5 साल बाद खजाने में चले जाते हैं)। ChamTax के FAQ पर सिर्फ 10 मिनट में जांच पूरी!',
      id: 'Aku memeriksa apakah ada uangku yang belum diklaim pakai checklist ini. Katanya ratusan miliar won pengembalian pajak yang tidak diklaim hilang setiap tahun di Korea (kembali ke kas negara setelah 5 tahun). Cuma butuh 10 menit untuk cek di FAQ ChamTax!',
      ja: 'このチェックリストで、自分が知らずに受け取っていないお金がないか確認しました。韓国では毎年数千億ウォンもの未請求の還付金が失われているそうです（5年経つと国庫に帰属）。ChamTaxのFAQなら10分で確認できます！',
      kk: 'Мен осы чек-парақ арқылы алмаған ақшам бар-жоғын тексердім. Кореяда жыл сайын жүздеген миллиард вон салық қайтарымы иесіз қалып, жоғалады екен (5 жылдан кейін қазынаға өтеді). ChamTax-тың FAQ-нда тексеру бар-жоғы 10 минут алады!',
      km: 'ខ្ញុំបានពិនិត្យមើលថាតើខ្ញុំមានលុយដែលមិនបានទាមទារដែរឬទេ ដោយប្រើបញ្ជីត្រួតពិនិត្យនេះ។ តាមរបាយការណ៍ រាប់រយពាន់លានវ៉ុននៃការសងប្រាក់ពន្ធដែលមិនបានទាមទារបាត់បង់រៀងរាល់ឆ្នាំនៅកូរ៉េ (ត្រលប់ទៅឃ្លាំងសម្បត្តិជាតិវិញបន្ទាប់ពី 5 ឆ្នាំ)។ ត្រូវការតែ 10 នាទីដើម្បីពិនិត្យនៅលើ FAQ របស់ ChamTax!',
      ky: "Мен ушул текшерүү тизмеси менен алынбаган акчам бар-жогун текшердим. Кореяда жыл сайын жүздөгөн миллиард вон талап кылынбаган салык кайтарымы жоголот экен (5 жылдан кийин казынага өтөт). ChamTax'тын FAQ'унда текшерүү болгону 10 мүнөт алат!",
      lo: 'ຂ້ອຍໄດ້ກວດເບິ່ງວ່າມີເງິນທີ່ຍັງບໍ່ໄດ້ຮັບຫຼືບໍ່ດ້ວຍລາຍການກວດສອບນີ້. ວ່າກັນວ່າໃນເກົາຫຼີ ເງິນຄືນພາສີທີ່ບໍ່ມີໃຜມາຮັບຫຼາຍຮ້ອຍພັນລ້ານວອນຫາຍໄປທຸກປີ (ຈະຕົກເປັນຂອງຄັງຫຼັງ 5 ປີ). ໃຊ້ເວລາພຽງ 10 ນາທີໃນການກວດສອບທີ່ FAQ ຂອງ ChamTax!',
      mn: 'Би энэ чеклистээр өөрийн авч амжаагүй мөнгө байгаа эсэхийг шалгасан. Солонгост жил бүр хэдэн зуун тэрбум вон татварын буцаан олголт эзэнгүй үлдэж алга болдог гэнэ (5 жилийн дараа сан хөмрөгт шилждэг). ChamTax-ийн FAQ дээр ердөө 10 минутад шалгаж болно!',
      my: 'ဒီစစ်ဆေးစာရင်းနဲ့ ငါမရသေးတဲ့ငွေရှိလားဆိုတာ စစ်ဆေးကြည့်ခဲ့တယ်။ ကိုရီးယားမှာ နှစ်စဉ် ဆယ်ဂဏန်းဘီလီယံဝမ်းလောက်ရှိတဲ့ မတောင်းယူထားတဲ့အခွန်ပြန်အမ်းငွေတွေ ပျောက်ဆုံးသွားတယ်ဆိုပဲ (၅ နှစ်ကြာရင် နိုင်ငံတော်ဘဏ္ဍာထဲကို ပြန်ဝင်သွားမယ်)။ ChamTax ရဲ့ FAQ မှာ ၁၀ မိနစ်နဲ့ စစ်ဆေးပြီးသွားနိုင်တယ်!',
      ne: 'यो चेकलिस्ट प्रयोग गरेर मैले नपाएको पैसा छ कि छैन जाँचें। कोरियामा हरेक वर्ष सयौं अरब वॉन बराबरको दाबी नगरिएको कर फिर्ता हराउँछ रे (५ वर्षपछि सरकारी ढुकुटीमा जान्छ)। ChamTax को FAQ मा जम्मा १० मिनेटमा जाँच सकिन्छ!',
      si: 'මම මෙම විමර්ශන ලැයිස්තුව භාවිතයෙන් මට නොලැබුණු මුදල් තිබේදැයි පරීක්ෂා කළෙමි. කොරියාවේ සෑම වසරකම බිලියන ගණනක් වොන් වටිනා ප්‍රතිලාභ නොදැනුවත්කම නිසා අහිමි වේ (5 වසරකට පසු භාණ්ඩාගාරයට පවරයි). ChamTax හි FAQ හි විනාඩි 10කින් පරීක්ෂා කළ හැක!',
      tl: 'Sinuri ko kung mayroon akong pera na hindi pa na-claim gamit ang checklist na ito. Sabi nila daan-daang bilyong won na hindi na-claim na tax refund ang nawawala taun-taon sa Korea (napupunta sa treasury pagkatapos ng 5 taon). 10 minuto lang para suriin sa FAQ ng ChamTax!',
      ur: 'میں نے اس چیک لسٹ سے دیکھا کہ کہیں میرا کوئی ان کلیمڈ پیسہ تو نہیں ہے۔ کوریا میں ہر سال سینکڑوں ارب وون کی ان کلیمڈ ٹیکس ریفنڈز ضائع ہو جاتی ہیں (5 سال بعد خزانے میں چلی جاتی ہیں)۔ ChamTax کے FAQ پر صرف 10 منٹ میں چیک مکمل!',
      uz: "Men ushbu tekshiruv ro'yxati orqali da'vo qilinmagan pulim bor-yo'qligini tekshirdim. Koreyada har yili yuzlab milliard von da'vo qilinmagan soliq qaytarilishi yo'qolib ketar ekan (5 yildan keyin xazinaga o'tadi). ChamTax'ning FAQ sahifasida tekshirish atigi 10 daqiqa oladi!",
    }
  );
  const shareUrl = location.href;
  const btn = document.getElementById('refund-share-btn');
  const shareTitle = pickLang(
    '나도 모르는 잠자는 내 돈 찾기 체크리스트',
    'Find money you didn’t know you had — checklist',
    '找出你不知道的沉睡资产 — 检查清单',
    'Danh sách tìm tiền bạn không biết mình có',
    'เช็คลิสต์ค้นหาเงินที่คุณไม่รู้ว่ามี',
    'Чек-лист: найдите деньги, о которых не знали',
    {
      ar: 'قائمة للعثور على أموال لم تكن تعرف أنك تملكها',
      bn: 'তুমি যে টাকার কথা জানতে না তা খুঁজে বের করার চেকলিস্ট',
      fr: "Checklist pour trouver de l'argent que vous ignoriez avoir",
      hi: 'वह पैसा खोजें जिसके बारे में आपको पता नहीं था — चेकलिस्ट',
      id: 'Checklist untuk menemukan uang yang tidak kamu tahu kamu punya',
      ja: '知らずに眠っていたお金を見つけるチェックリスト',
      kk: 'Барын білмеген ақшаңды табу чек-парағы',
      km: 'បញ្ជីត្រួតពិនិត្យរកលុយដែលអ្នកមិនដឹងថាមាន',
      ky: 'Барын билбеген акчаңды табуу текшерүү тизмеси',
      lo: 'ລາຍການກວດສອບຄົ້ນຫາເງິນທີ່ເຈົ້າບໍ່ຮູ້ວ່າມີ',
      mn: 'Байгааг нь мэдээгүй мөнгөө олох чеклист',
      my: 'သင်ပိုင်ဆိုင်တာမသိတဲ့ငွေကို ရှာဖွေဖို့ စစ်ဆေးစာရင်း',
      ne: 'तपाईंलाई थाहा नभएको पैसा फेला पार्ने — चेकलिस्ट',
      si: 'ඔබ නොදැන සිටි මුදල් සොයා ගැනීමේ විමර්ශන ලැයිස්තුව',
      tl: 'Checklist para mahanap ang perang hindi mo alam na meron ka',
      ur: 'وہ پیسہ ڈھونڈیں جس کا آپ کو علم نہیں تھا — چیک لسٹ',
      uz: "Bor ekanini bilmagan pulingizni topish tekshiruv ro'yxati",
    }
  );

  const cardLabel = pickLang('🔍 나도 모르게 놓친 돈이 있을까?', '🔍 Did I miss money I didn’t know about?', '🔍 我是不是漏掉了什么钱？', '🔍 Mình có bỏ sót khoản tiền nào không?', '🔍 ฉันพลาดเงินที่ไม่รู้ว่ามีไหม?', '🔍 Не упустил ли я деньги, о которых не знал?', { ar:'🔍 هل فاتني مال لم أكن أعرف عنه؟', bn:'🔍 আমি কি না জেনে কোনো টাকা মিস করেছি?', fr:"🔍 Ai-je manqué de l'argent sans le savoir ?", hi:'🔍 क्या मुझसे कोई पैसा छूट गया जिसके बारे में पता ही नहीं था?', id:'🔍 Apakah aku melewatkan uang yang tidak kutahu?', ja:'🔍 知らないうちに逃したお金があるかも？', kk:'🔍 Білмей қалдырған ақшам бар ма?', km:'🔍 តើខ្ញុំបានខកខានលុយដែលខ្ញុំមិនដឹងដែរឬទេ?', ky:'🔍 Билбей калтырган акчам барбы?', lo:'🔍 ຂ້ອຍພາດເງິນທີ່ບໍ່ຮູ້ບໍ?', mn:'🔍 Мэдэлгүй алдсан мөнгө байна уу?', my:'🔍 မသိလိုက်ဘဲ လက်လွှတ်ခဲ့တဲ့ငွေ ရှိလား?', ne:'🔍 मलाई थाहा नभएको छुटेको पैसा छ त?', si:'🔍 මට නොදැනුවත්ව මුදල් අහිමි වුණාද?', tl:'🔍 May napalampas ba akong perang hindi ko alam?', ur:'🔍 کیا مجھ سے کوئی پیسہ چھوٹ گیا جس کا مجھے علم نہیں تھا؟', uz:"🔍 Bilmagan holda o'tkazib yuborgan pulim bormikan?" });
  const cardBig = pickLang('10분 체크리스트', '10-min checklist', '10分钟清单', 'Danh sách 10 phút', 'เช็คลิสต์ 10 นาที', '10-минутный чек-лист', { ar:'قائمة 10 دقائق', bn:'১০ মিনিটের চেকলিস্ট', fr:'Checklist de 10 min', hi:'10 मिनट की चेकलिस्ट', id:'Checklist 10 menit', ja:'10分チェックリスト', kk:'10 минуттық чек-парақ', km:'បញ្ជីត្រួតពិនិត្យ 10 នាទី', ky:'10 мүнөттүк текшерүү тизмеси', lo:'ລາຍການກວດສອບ 10 ນາທີ', mn:'10 минутын чеклист', my:'၁၀ မိနစ် စစ်ဆေးစာရင်း', ne:'१० मिनेट चेकलिस्ट', si:'මිනිත්තු 10 විමර්ශන ලැයිස්තුව', tl:'10-minutong checklist', ur:'10 منٹ کی چیک لسٹ', uz:"10 daqiqalik tekshiruv ro'yxati" });
  const cardSub = pickLang('국세환급금, 5년 지나면 국고로 귀속돼요', 'Unclaimed refunds revert to the treasury after 5 years', '未领取的退税5年后归入国库', 'Tiền hoàn thuế chưa nhận sẽ thuộc về ngân khố sau 5 năm', 'เงินคืนภาษีที่ไม่มีใครรับจะตกเป็นของคลังหลัง 5 ปี', 'Невостребованный возврат налога переходит в казну через 5 лет', { ar:'الأموال المستردة غير المطالب بها تؤول إلى الخزينة بعد 5 سنوات', bn:'দাবি না করা রিফান্ড ৫ বছর পর কোষাগারে চলে যায়', fr:'5 ans après, les remboursements non réclamés reviennent au trésor', hi:'बिना दावे वाले रिफंड 5 साल बाद खजाने में चले जाते हैं', id:'Pengembalian yang tidak diklaim kembali ke kas negara setelah 5 tahun', ja:'未請求の還付金は5年で国庫に帰属します', kk:'Талап етілмеген қайтарымдар 5 жылдан кейін қазынаға өтеді', km:'ការសងប្រាក់ដែលមិនបានទាមទារនឹងត្រលប់ទៅឃ្លាំងសម្បត្តិជាតិវិញបន្ទាប់ពី 5 ឆ្នាំ', ky:'Талап кылынбаган кайтарымдар 5 жылдан кийин казынага өтөт', lo:'ເງິນຄືນທີ່ບໍ່ມີໃຜມາຮັບຈະຕົກເປັນຂອງຄັງຫຼັງ 5 ປີ', mn:'Эзэнгүй буцаан олголт 5 жилийн дараа сан хөмрөгт шилждэг', my:'မတောင်းယူထားတဲ့ ပြန်အမ်းငွေများသည် ၅ နှစ်ကြာလျှင် နိုင်ငံတော်ဘဏ္ဍာသို့ ပြန်ဝင်သွားမည်', ne:'दाबी नगरिएको फिर्ता ५ वर्षपछि सरकारी ढुकुटीमा जान्छ', si:'නොදැනුවත්කම හේතුවෙන් අහිමි වූ ප්‍රතිලාභ වසර 5කට පසු භාණ්ඩාගාරයට පවරයි', tl:'Ang hindi na-claim na refund ay napupunta sa treasury pagkatapos ng 5 taon', ur:'ان کلیمڈ رقم 5 سال بعد خزانے میں چلی جاتی ہے', uz:"Da'vo qilinmagan qaytarilgan mablag' 5 yildan keyin xazinaga o'tadi" });
  const cardFooter = pickLang('👉 참택스 FAQ에서 확인하기', '👉 Check it on the ChamTax FAQ', '👉 到ChamTax常见问题确认', '👉 Kiểm tra trên FAQ của ChamTax', '👉 ตรวจสอบที่ FAQ ของ ChamTax', '👉 Проверьте в FAQ ChamTax', { ar:'👉 تحقق منه في الأسئلة الشائعة لـ ChamTax', bn:'👉 ChamTax-এর FAQ-তে দেখুন', fr:'👉 Vérifiez sur la FAQ de ChamTax', hi:'👉 ChamTax के FAQ पर देखें', id:'👉 Cek di FAQ ChamTax', ja:'👉 ChamTaxのFAQでチェック', kk:'👉 ChamTax-тың FAQ бөлімінде қараңыз', km:'👉 ពិនិត្យនៅ FAQ របស់ ChamTax', ky:"👉 ChamTax'тын FAQ'унда текшериңиз", lo:'👉 ກວດສອບທີ່ FAQ ຂອງ ChamTax', mn:'👉 ChamTax-ийн FAQ дээр шалгаарай', my:'👉 ChamTax ရဲ့ FAQ မှာ စစ်ဆေးပါ', ne:'👉 ChamTax को FAQ मा जाँच गर्नुहोस्', si:'👉 ChamTax හි FAQ හි පරීක්ෂා කරන්න', tl:'👉 Tingnan sa FAQ ng ChamTax', ur:'👉 ChamTax کے FAQ پر چیک کریں', uz:"👉 ChamTax'ning FAQ sahifasida tekshiring" });
  const canvas = buildShareCard({ label: cardLabel, bigText: cardBig, subText: cardSub, footerText: cardFooter });
  if (await tryShareCardImage(canvas, shareTitle, shareText)) return;

  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = pickLang('✅ 링크가 복사됐어요', '✅ Link copied', '✅ 链接已复制', '✅ Đã sao chép liên kết', '✅ คัดลอกลิงก์แล้ว', '✅ Ссылка скопирована', LINK_COPIED_MORE);
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    window.prompt(pickLang(
      '아래 내용을 길게 눌러 복사해서 공유해주세요',
      'Press and hold to copy, then share it',
      '长按下方内容复制后分享',
      'Nhấn giữ để sao chép rồi chia sẻ',
      'กดค้างเพื่อคัดลอกแล้วแชร์',
      'Нажмите и удерживайте, чтобы скопировать, затем поделитесь',
      PRESS_HOLD_COPY_MORE
    ), `${shareText} ${shareUrl}`);
  }
}

let lastMilestoneTier = 0; // 0=없음, 1=1000억, 2=1조 — 마일스톤을 "새로" 넘었을 때만 효과를 터뜨리기 위한 추적
let homeResultFirstRender = true; // 페이지에 처음 들어왔을 때는 0에서부터 세는 카운트업 효과가 오히려
// "어? 0원인가?" 하는 순간적인 혼동을 줄 수 있어서, 최초 1회만 애니메이션 없이 바로 최종 숫자를 보여주고,
// 그 이후 유저가 직접 금액을 바꿀 때만 카운트업 효과를 사용함

function triggerMilestoneBurst(){
  const container = document.getElementById('milestone-burst');
  if (!container) return;
  const balls = ['🔴', '🟡', '🟢', '🔵'];
  container.innerHTML = '';
  balls.forEach((ball, i) => {
    const span = document.createElement('span');
    span.className = 'ball';
    span.textContent = ball;
    span.style.left = (30 + i * 14) + '%';
    span.style.animationDelay = (i * 0.08) + 's';
    container.appendChild(span);
  });
  setTimeout(() => { container.innerHTML = ''; }, 1300);
}

// 실수령액 미니 박스를 눌러서 "이만큼 받고 싶다"는 금액을 직접 입력하면,
// 세율이 누진세율이라 단순 나눗셈이 안 되므로 이분 탐색으로 필요한 당첨금(억원)을 역산해서
// 위쪽 당첨금 입력창에 반영함 (예전엔 별도 아코디언이었는데, 결과 숫자를 직접 고치는 방식으로 단순화)
function startEditMiniResult(){
  const display = document.getElementById('live-result-mini-display');
  const editBox = document.getElementById('live-result-mini-edit');
  const hint = document.getElementById('mini-result-hint');
  const input = document.getElementById('miniResultEditInput');
  const current억 = parseFloat(document.getElementById('home-final-amt').dataset.eokVal) || 0;

  display.style.display = 'none';
  editBox.style.display = 'inline-flex';
  if (hint) hint.style.display = 'none';
  input.value = Math.round(current억);

  function finish(){
    input.removeEventListener('keydown', onKeydown);
    input.removeEventListener('blur', finish);
    confirmEditMiniResult(input.value);
  }
  function onKeydown(e){
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { input.removeEventListener('keydown', onKeydown); input.removeEventListener('blur', finish); cancelEditMiniResult(); }
  }
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', finish);
  input.focus();
  input.select();
}

function cancelEditMiniResult(){
  document.getElementById('live-result-mini-display').style.display = '';
  document.getElementById('live-result-mini-edit').style.display = 'none';
  const hint = document.getElementById('mini-result-hint');
  if (hint) hint.style.display = '';
}

function confirmEditMiniResult(rawValue){
  cancelEditMiniResult();
  const target억 = parseFloat(String(rawValue).replace(/[^0-9.]/g, ''));
  if (!target억 || target억 <= 0) return;

  const country = document.getElementById('homeCountrySelect').value;
  const stateCode = document.getElementById('homeStateSelect').value;

  let lo = target억; // 세금 떼면 항상 원금보다 적게 받으므로, 필요한 당첨금은 최소 목표금액 이상
  let hi = target억 * 3;
  let guard = 0;
  while (calcTakeHome(hi, country, stateCode).final < target억 && guard < 40) {
    hi *= 2;
    guard++;
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const midFinal = calcTakeHome(mid, country, stateCode).final;
    if (midFinal < target억) lo = mid; else hi = mid;
  }

  const required억 = hi;
  const requiredUsd = Math.round(required억 * 100000000 / EXCHANGE_RATE);
  const requiredUsdM = requiredUsd / 1000000;

  const amountInput = document.getElementById('homeAmountInput');
  amountInput.value = requiredUsdM >= 10 ? Math.round(requiredUsdM) : Math.round(requiredUsdM * 10) / 10;
  const slider = document.getElementById('homeAmountSlider');
  slider.value = Math.min(Math.max(Math.round(requiredUsdM), Number(slider.min)), Number(slider.max));
  updateSliderFill(slider);
  updateHomeCalc(requiredUsd);
}
function setHomeCountry(country){
  document.getElementById('homeCountrySelect').value = country;
  document.querySelectorAll('#homeCountryToggle .country-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.country === country);
  });
  updateHomeCalc();
  filterFaq(); // FAQ가 세금 기준(KR/US/CN)에 따라 관련 없는 질문은 숨기므로, 기준 바뀔 때마다 다시 걸러줌
}

// 나라별 실제 과세당국 표기 — home-trust-line에 "OO 공식 자료 기반"으로 노출됨. 나라가 6개일 땐
// 삼항연산 체인이었지만 19개로 늘면서 가독성이 떨어져 맵으로 정리함. kr(기본값)·us는 여기 없고
// 호출부에서 폴백 처리함(각각 이미 그 자체로 fallback 대상이라 굳이 맵에 안 넣어도 됨)
const COUNTRY_TAX_AUTHORITY = {
  cn: () => pickLang('중국 국가세무총국·IRS', 'China State Taxation Administration/IRS', '中国国家税务总局·IRS', 'Tổng cục Thuế Nhà nước Trung Quốc·IRS', 'กรมสรรพากรแห่งชาติจีน·IRS', 'Государственное налоговое управление Китая·IRS', {
      km: "អគ្គនាយកដ្ឋានពន្ធដារជាតិចិន·IRS",
      ne: "चीनको राज्य कर प्रशासन·IRS",
      id: "Administrasi Perpajakan Negara Tiongkok·IRS",
      my: "တရုတ်နိုင်ငံ ပြည်ထောင်စုအခွန်ဦးစီးဌာန·IRS",
      si: "චීන රාජ්‍ය බදු පරිපාලනය·IRS",
      uz: "Xitoy Davlat soliq boshqarmasi·IRS",
      mn: "Хятадын Улсын татварын ерөнхий газар·IRS",
      kk: "Қытайдың мемлекеттік салық басқармасы·IRS",
      ky: "Кытайдын мамлекеттик салык башкармалыгы·IRS",
      ur: "چین اسٹیٹ ٹیکسیشن ایڈمنسٹریشن·IRS",
      bn: "চীন রাষ্ট্রীয় কর প্রশাসন·IRS",
      lo: "ອົງການບໍລິຫານພາສີແຫ່ງລັດຈີນ·IRS",
      ja: "中国国家税務総局·IRS",
      ar: "هيئة الضرائب الحكومية الصينية·IRS",
      hi: "चीन राज्य कराधान प्रशासन·IRS",
      fr: "Administration nationale des impôts de Chine·IRS",
      tl: "Pambansang Administrasyon ng Buwis ng Tsina·IRS"
    }),
  in: () => pickLang('인도 소득세청·IRS', 'India Income Tax Department/IRS', '印度所得税局·IRS', 'Cục Thuế Thu nhập Ấn Độ·IRS', 'กรมสรรพากรอินเดีย·IRS', 'Департамент подоходного налога Индии·IRS', {
      km: "នាយកដ្ឋានពន្ធលើប្រាក់ចំណូលឥណ្ឌា·IRS",
      ne: "भारतीय आयकर विभाग·IRS",
      id: "Direktorat Pajak Penghasilan India·IRS",
      my: "အိန္ဒိယ ၀င်ငွေခွန်ဦးစီးဌာန·IRS",
      si: "ඉන්දියානු ආදායම් බදු දෙපාර්තමේන්තුව·IRS",
      uz: "Hindiston Daromad solig'i departamenti·IRS",
      mn: "Энэтхэгийн орлогын албан татварын алба·IRS",
      kk: "Үндістанның табыс салығы департаменті·IRS",
      ky: "Индиянын киреше салыгы департаменти·IRS",
      ur: "انڈیا انکم ٹیکس ڈیپارٹمنٹ·IRS",
      bn: "ভারতীয় আয়কর বিভাগ·IRS",
      lo: "ກົມສ່ວຍສາອາກອນລາຍໄດ້ອິນເດຍ·IRS",
      ja: "インド所得税局·IRS",
      ar: "إدارة ضريبة الدخل الهندية·IRS",
      hi: "भारतीय आयकर विभाग·IRS",
      fr: "Département de l'impôt sur le revenu de l'Inde·IRS",
      tl: "Kagawaran ng Buwis sa Kita ng India·IRS"
    }),
  vn: () => pickLang('베트남 세무총국·IRS', 'Vietnam General Department of Taxation/IRS', '越南税务总局·IRS', 'Tổng cục Thuế Việt Nam·IRS', 'กรมสรรพากรทั่วไปเวียดนาม·IRS', 'Главное налоговое управление Вьетнама·IRS', {
      km: "អគ្គនាយកដ្ឋានពន្ធដារវៀតណាម·IRS",
      ne: "भियतनाम सामान्य कर विभाग·IRS",
      id: "Direktorat Jenderal Pajak Vietnam·IRS",
      my: "ဗီယက်နမ် အခွန်ဦးစီးချုပ်ဌာန·IRS",
      si: "වියට්නාම බදු අධ්‍යක්ෂ ජනරාල් දෙපාර්තමේන්තුව·IRS",
      uz: "Vetnam Bosh soliq boshqarmasi·IRS",
      mn: "Вьетнамын татварын ерөнхий газар·IRS",
      kk: "Вьетнамның салық жөніндегі бас басқармасы·IRS",
      ky: "Вьетнамдын салык башкы башкармалыгы·IRS",
      ur: "ویتنام جنرل ڈیپارٹمنٹ آف ٹیکسیشن·IRS",
      bn: "ভিয়েতনাম সাধারণ কর অধিদপ্তর·IRS",
      lo: "ກົມສ່ວຍສາອາກອນທົ່ວໄປຫວຽດນາມ·IRS",
      ja: "ベトナム税務総局·IRS",
      ar: "الإدارة العامة للضرائب في فيتنام·IRS",
      hi: "वियतनाम कर महानिदेशालय·IRS",
      fr: "Direction générale des impôts du Vietnam·IRS",
      tl: "Pangkalahatang Kagawaran ng Buwis ng Vietnam·IRS"
    }),
  id: () => pickLang('인도네시아 국세청(DJP)·IRS', 'Indonesia Directorate General of Taxes/IRS', '印尼税务总局·IRS', 'Tổng cục Thuế Indonesia·IRS', 'กรมสรรพากรอินโดนีเซีย·IRS', 'Налоговое управление Индонезии·IRS', {
      km: "អគ្គនាយកដ្ឋានពន្ធដារឥណ្ឌូនេស៊ី (DJP)·IRS",
      ne: "इन्डोनेसिया कर महानिर्देशनालय (DJP)·IRS",
      id: "Direktorat Jenderal Pajak Indonesia (DJP)·IRS",
      my: "အင်ဒိုနီးရှား အခွန်ညွှန်ကြားမှုဦးစီးချုပ်ဌာန (DJP)·IRS",
      si: "ඉන්දුනීසියානු බදු අධ්‍යක්ෂ ජනරාල් දෙපාර්තමේන්තුව (DJP)·IRS",
      uz: "Indoneziya Soliqlar bosh direktorati (DJP)·IRS",
      mn: "Индонезийн татварын ерөнхий газар (DJP)·IRS",
      kk: "Индонезияның салық жөніндегі бас дирекциясы (DJP)·IRS",
      ky: "Индонезиянын салык башкы дирекциясы (DJP)·IRS",
      ur: "انڈونیشیا ڈائریکٹوریٹ جنرل آف ٹیکسز (DJP)·IRS",
      bn: "ইন্দোনেশিয়া কর মহাপরিদপ্তর (DJP)·IRS",
      lo: "ກົມສ່ວຍສາອາກອນອິນໂດເນເຊຍ (DJP)·IRS",
      ja: "インドネシア税務総局 (DJP)·IRS",
      ar: "الإدارة العامة للضرائب في إندونيسيا (DJP)·IRS",
      hi: "इंडोनेशिया कर महानिदेशालय (DJP)·IRS",
      fr: "Direction générale des impôts d'Indonésie (DJP)·IRS",
      tl: "Pangkalahatang Direktoryo ng Buwis ng Indonesia (DJP)·IRS"
    }),
  ph: () => pickLang('필리핀 국세청(BIR)·IRS', 'Philippines Bureau of Internal Revenue/IRS', '菲律宾国税局·IRS', 'Cục Thuế Nội địa Philippines·IRS', 'กรมสรรพากรฟิลิปปินส์·IRS', 'Налоговое управление Филиппин·IRS', {
      km: "ការិយាល័យចំណូលផ្ទៃក្នុងហ្វីលីពីន (BIR)·IRS",
      ne: "फिलिपिन्स आन्तरिक राजस्व ब्यूरो (BIR)·IRS",
      id: "Biro Pendapatan Dalam Negeri Filipina (BIR)·IRS",
      my: "ဖိလစ်ပိုင် ပြည်တွင်းအခွန်ရုံး (BIR)·IRS",
      si: "පිලිපීන අභ්‍යන්තර ආදායම් කාර්යාංශය (BIR)·IRS",
      uz: "Filippin Ichki daromadlar byurosi (BIR)·IRS",
      mn: "Филиппиний дотоод орлогын товчоо (BIR)·IRS",
      kk: "Филиппиннің ішкі кірістер бюросы (BIR)·IRS",
      ky: "Филиппиндин ички кирешелер бюросу (BIR)·IRS",
      ur: "فلپائن بیورو آف انٹرنل ریونیو (BIR)·IRS",
      bn: "ফিলিপাইন অভ্যন্তরীণ রাজস্ব ব্যুরো (BIR)·IRS",
      lo: "ອົງການລາຍໄດ້ພາຍໃນຟີລິບປິນ (BIR)·IRS",
      ja: "フィリピン国税庁 (BIR)·IRS",
      ar: "مكتب الإيرادات الداخلية الفلبيني (BIR)·IRS",
      hi: "फिलीपींस आंतरिक राजस्व ब्यूरो (BIR)·IRS",
      fr: "Bureau du revenu intérieur des Philippines (BIR)·IRS",
      tl: "Kawanihan ng Rentas Internas ng Pilipinas (BIR)·IRS"
    }),
  th: () => pickLang('태국 국세청 자료 기준 추정치·IRS ⚠️', 'Estimate based on Thailand Revenue Department data/IRS ⚠️', '基于泰国税务厅资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu Cục Thuế Thái Lan·IRS ⚠️', 'ค่าประมาณจากข้อมูลกรมสรรพากรไทย·IRS ⚠️', 'Оценка на основе данных налогового управления Таиланда·IRS ⚠️', {
      km: "ការប៉ាន់ស្មានផ្អែកលើទិន្នន័យអគ្គនាយកដ្ឋានពន្ធដារថៃ·IRS ⚠️",
      ne: "थाइल्याण्ड राजस्व विभागको डेटामा आधारित अनुमान·IRS ⚠️",
      id: "Estimasi berdasarkan data Departemen Pendapatan Thailand·IRS ⚠️",
      my: "ထိုင်း အခွန်ဦးစီးဌာန၏ ဒေတာအပေါ်အခြေခံ ခန့်မှန်းချက်·IRS ⚠️",
      si: "තායිලන්ත ආදායම් දෙපාර්තමේන්තු දත්ත මත පදනම් වූ ඇස්තමේන්තුව·IRS ⚠️",
      uz: "Tailand Daromadlar departamenti ma'lumotlariga asoslangan taxminiy hisob·IRS ⚠️",
      mn: "Тайландын Орлогын албаны мэдээлэлд үндэслэсэн тооцоо·IRS ⚠️",
      kk: "Тайландтың кірістер департаменті деректеріне негізделген болжам·IRS ⚠️",
      ky: "Тайланддын кирешелер департаментинин маалыматына негизделген болжол·IRS ⚠️",
      ur: "تھائی لینڈ ریونیو ڈیپارٹمنٹ کے ڈیٹا پر مبنی تخمینہ·IRS ⚠️",
      bn: "থাইল্যান্ড রাজস্ব বিভাগের তথ্যের ভিত্তিতে অনুমান·IRS ⚠️",
      lo: "ການຄາດຄະເນໂດຍອີງໃສ່ຂໍ້ມູນກົມສ່ວຍສາອາກອນໄທ·IRS ⚠️",
      ja: "タイ歳入局データに基づく推定値·IRS ⚠️",
      ar: "تقدير استنادًا إلى بيانات إدارة الإيرادات التايلاندية·IRS ⚠️",
      hi: "थाईलैंड राजस्व विभाग के आंकड़ों पर आधारित अनुमान·IRS ⚠️",
      fr: "Estimation basée sur les données du Département des recettes de Thaïlande·IRS ⚠️",
      tl: "Pagtatantiya batay sa datos ng Kagawaran ng Kita ng Thailand·IRS ⚠️"
    }),
  jp: () => pickLang('일본 국세청(NTA)·IRS', 'Japan National Tax Agency (NTA)/IRS', '日本国税厅·IRS', 'Cơ quan Thuế Quốc gia Nhật Bản (NTA)·IRS', 'กรมสรรพากรแห่งชาติญี่ปุ่น (NTA)·IRS', 'Национальное налоговое управление Японии (NTA)·IRS', {
      km: "ទីភ្នាក់ងារពន្ធដារជាតិជប៉ុន (NTA)·IRS",
      ne: "जापान राष्ट्रिय कर एजेन्सी (NTA)·IRS",
      id: "Badan Pajak Nasional Jepang (NTA)·IRS",
      my: "ဂျပန် အမျိုးသားအခွန်ဦးစီးဌာန (NTA)·IRS",
      si: "ජපාන ජාතික බදු ඒජන්සිය (NTA)·IRS",
      uz: "Yaponiya Milliy soliq agentligi (NTA)·IRS",
      mn: "Японы Үндэсний татварын алба (NTA)·IRS",
      kk: "Жапонияның Ұлттық салық агенттігі (NTA)·IRS",
      ky: "Жапониянын Улуттук салык агенттиги (NTA)·IRS",
      ur: "جاپان نیشنل ٹیکس ایجنسی (NTA)·IRS",
      bn: "জাপান জাতীয় কর সংস্থা (NTA)·IRS",
      lo: "ອົງການສ່ວຍສາອາກອນແຫ່ງຊາດຍີ່ປຸ່ນ (NTA)·IRS",
      ja: "国税庁 (NTA)·IRS",
      ar: "هيئة الضرائب الوطنية اليابانية (NTA)·IRS",
      hi: "जापान राष्ट्रीय कर एजेंसी (NTA)·IRS",
      fr: "Agence nationale des impôts du Japon (NTA)·IRS",
      tl: "Pambansang Ahensya ng Buwis ng Japan (NTA)·IRS"
    }),
  ru: () => pickLang('러시아 연방국세청(ФНС)·IRS ⚠️', 'Russia Federal Tax Service (FNS)/IRS ⚠️', '俄罗斯联邦税务局·IRS ⚠️', 'Cơ quan Thuế Liên bang Nga (FNS)·IRS ⚠️', 'กรมสรรพากรกลางรัสเซีย (FNS)·IRS ⚠️', 'Федеральная налоговая служба России (ФНС)·IRS ⚠️', {
      km: "អគ្គនាយកដ្ឋានពន្ធដារសហព័ន្ធរុស្ស៊ី (FNS)·IRS ⚠️",
      ne: "रुसी संघीय कर सेवा (FNS)·IRS ⚠️",
      id: "Layanan Pajak Federal Rusia (FNS)·IRS ⚠️",
      my: "ရုရှား ဖက်ဒရယ်အခွန်ဝန်ဆောင်မှု (FNS)·IRS ⚠️",
      si: "රුසියානු ෆෙඩරල් බදු සේවාව (FNS)·IRS ⚠️",
      uz: "Rossiya Federal soliq xizmati (FNS)·IRS ⚠️",
      mn: "Оросын Холбооны татварын алба (ФНС)·IRS ⚠️",
      kk: "Ресейдің федералды салық қызметі (ФНС)·IRS ⚠️",
      ky: "Орусиянын федералдык салык кызматы (ФНС)·IRS ⚠️",
      ur: "روس فیڈرل ٹیکس سروس (FNS)·IRS ⚠️",
      bn: "রাশিয়ার ফেডারেল কর সেবা (FNS)·IRS ⚠️",
      lo: "ບໍລິການພາສີກາງລັດເຊຍ (FNS)·IRS ⚠️",
      ja: "ロシア連邦税務局 (FNS)·IRS ⚠️",
      ar: "دائرة الضرائب الفيدرالية الروسية (FNS)·IRS ⚠️",
      hi: "रूस संघीय कर सेवा (FNS)·IRS ⚠️",
      fr: "Service fédéral des impôts de Russie (FNS)·IRS ⚠️",
      tl: "Pederal na Serbisyo ng Buwis ng Russia (FNS)·IRS ⚠️"
    }),
  np: () => pickLang('네팔 국세청(IRD)·IRS', 'Nepal Inland Revenue Department (IRD)/IRS', '尼泊尔国内税务局·IRS', 'Cục Thuế Nội địa Nepal (IRD)·IRS', 'กรมสรรพากรเนปาล (IRD)·IRS', 'Департамент внутренних доходов Непала (IRD)·IRS', {
      km: "នាយកដ្ឋានចំណូលផ្ទៃក្នុងនេប៉ាល់ (IRD)·IRS",
      ne: "आन्तरिक राजस्व विभाग (IRD)·IRS",
      id: "Departemen Pendapatan Dalam Negeri Nepal (IRD)·IRS",
      my: "နီပေါ ပြည်တွင်းအခွန်ဦးစီးဌာန (IRD)·IRS",
      si: "නේපාල අභ්‍යන්තර ආදායම් දෙපාර්තමේන්තුව (IRD)·IRS",
      uz: "Nepal Ichki daromadlar departamenti (IRD)·IRS",
      mn: "Балба улсын дотоод орлогын алба (IRD)·IRS",
      kk: "Непалдың ішкі кірістер департаменті (IRD)·IRS",
      ky: "Непалдын ички кирешелер департаменти (IRD)·IRS",
      ur: "نیپال ان لینڈ ریونیو ڈیپارٹمنٹ (IRD)·IRS",
      bn: "নেপাল অভ্যন্তরীণ রাজস্ব বিভাগ (IRD)·IRS",
      lo: "ກົມສ່ວຍສາອາກອນພາຍໃນເນປານ (IRD)·IRS",
      ja: "ネパール内国歳入局 (IRD)·IRS",
      ar: "إدارة الإيرادات الداخلية النيبالية (IRD)·IRS",
      hi: "नेपाल आंतरिक राजस्व विभाग (IRD)·IRS",
      fr: "Département des recettes intérieures du Népal (IRD)·IRS",
      tl: "Kagawaran ng Panloob na Kita ng Nepal (IRD)·IRS"
    }),
  lk: () => pickLang('스리랑카 국세청(IRD)·IRS', 'Sri Lanka Inland Revenue Department (IRD)/IRS', '斯里兰卡国内税务局·IRS', 'Cục Thuế Nội địa Sri Lanka (IRD)·IRS', 'กรมสรรพากรศรีลังกา (IRD)·IRS', 'Департамент внутренних доходов Шри-Ланки (IRD)·IRS', {
      km: "នាយកដ្ឋានចំណូលផ្ទៃក្នុងស្រីលង្កា (IRD)·IRS",
      ne: "श्रीलंका आन्तरिक राजस्व विभाग (IRD)·IRS",
      id: "Departemen Pendapatan Dalam Negeri Sri Lanka (IRD)·IRS",
      my: "သီရိလင်္ကာ ပြည်တွင်းအခွန်ဦးစီးဌာန (IRD)·IRS",
      si: "ශ්‍රී ලංකා අභ්‍යන්තර ආදායම් දෙපාර්තමේන්තුව (IRD)·IRS",
      uz: "Shri-Lanka Ichki daromadlar departamenti (IRD)·IRS",
      mn: "Шри-Ланкийн дотоод орлогын алба (IRD)·IRS",
      kk: "Шри-Ланканың ішкі кірістер департаменті (IRD)·IRS",
      ky: "Шри-Ланканын ички кирешелер департаменти (IRD)·IRS",
      ur: "سری لنکا ان لینڈ ریونیو ڈیپارٹمنٹ (IRD)·IRS",
      bn: "শ্রীলঙ্কা অভ্যন্তরীণ রাজস্ব বিভাগ (IRD)·IRS",
      lo: "ກົມສ່ວຍສາອາກອນພາຍໃນສີລັງກາ (IRD)·IRS",
      ja: "スリランカ内国歳入局 (IRD)·IRS",
      ar: "إدارة الإيرادات الداخلية السريلانكية (IRD)·IRS",
      hi: "श्रीलंका आंतरिक राजस्व विभाग (IRD)·IRS",
      fr: "Département des recettes intérieures du Sri Lanka (IRD)·IRS",
      tl: "Kagawaran ng Panloob na Kita ng Sri Lanka (IRD)·IRS"
    }),
  uz: () => pickLang('우즈베키스탄 국가조세위원회·IRS', 'Uzbekistan State Tax Committee/IRS', '乌兹别克斯坦国家税务委员会·IRS', 'Ủy ban Thuế Nhà nước Uzbekistan·IRS', 'คณะกรรมการภาษีแห่งรัฐอุซเบกิสถาน·IRS', 'Государственный налоговый комитет Узбекистана·IRS', {
      km: "គណៈកម្មាធិការពន្ធដាររដ្ឋអ៊ូសបេគីស្ថាន·IRS",
      ne: "उज्बेकिस्तान राज्य कर समिति·IRS",
      id: "Komite Pajak Negara Uzbekistan·IRS",
      my: "ဥဇဘက်ကစ္စတန် ပြည်နယ်အခွန်ကော်မတီ·IRS",
      si: "උස්බෙකිස්තාන රාජ්‍ය බදු කමිටුව·IRS",
      uz: "O'zbekiston Davlat soliq qo'mitasi·IRS",
      mn: "Узбекистаны Улсын татварын хороо·IRS",
      kk: "Өзбекстанның Мемлекеттік салық комитеті·IRS",
      ky: "Өзбекстандын Мамлекеттик салык комитети·IRS",
      ur: "ازبکستان اسٹیٹ ٹیکس کمیٹی·IRS",
      bn: "উজবেকিস্তান রাষ্ট্রীয় কর কমিটি·IRS",
      lo: "ຄະນະກຳມະການພາສີແຫ່ງລັດອຸດເບກິສຖານ·IRS",
      ja: "ウズベキスタン国家税委員会·IRS",
      ar: "اللجنة الحكومية للضرائب في أوزبكستان·IRS",
      hi: "उज़्बेकिस्तान राज्य कर समिति·IRS",
      fr: "Comité national des impôts d'Ouzbékistan·IRS",
      tl: "Komite ng Buwis ng Estado ng Uzbekistan·IRS"
    }),
  kz: () => pickLang('카자흐스탄 국가세입위원회·IRS', 'Kazakhstan Committee of State Revenues/IRS', '哈萨克斯坦国家税收委员会·IRS', 'Ủy ban Thu ngân sách Nhà nước Kazakhstan·IRS', 'คณะกรรมการรายได้แห่งรัฐคาซัคสถาน·IRS', 'Комитет государственных доходов Казахстана·IRS', {
      km: "គណៈកម្មាធិការចំណូលរដ្ឋកាហ្សាក់ស្ថាន·IRS",
      ne: "कजाकिस्तान राज्य राजस्व समिति·IRS",
      id: "Komite Pendapatan Negara Kazakhstan·IRS",
      my: "ကာဇက်စတန် ပြည်နယ်ဝင်ငွေကော်မတီ·IRS",
      si: "කසකස්තාන රාජ්‍ය ආදායම් කමිටුව·IRS",
      uz: "Qozog'iston Davlat daromadlari qo'mitasi·IRS",
      mn: "Казахстаны Улсын орлогын хороо·IRS",
      kk: "Қазақстанның Мемлекеттік кірістер комитеті·IRS",
      ky: "Казакстандын Мамлекеттик кирешелер комитети·IRS",
      ur: "قازقستان اسٹیٹ ریونیو کمیٹی·IRS",
      bn: "কাজাখস্তান রাষ্ট্রীয় রাজস্ব কমিটি·IRS",
      lo: "ຄະນະກຳມະການລາຍໄດ້ແຫ່ງລັດຄາຊັກສະຖານ·IRS",
      ja: "カザフスタン国家歳入委員会·IRS",
      ar: "لجنة الإيرادات الحكومية في كازاخستان·IRS",
      hi: "कज़ाख़स्तान राज्य राजस्व समिति·IRS",
      fr: "Comité des recettes de l'État du Kazakhstan·IRS",
      tl: "Komite ng Kita ng Estado ng Kazakhstan·IRS"
    }),
  kg: () => pickLang('키르기스스탄 국가조세청·IRS', 'Kyrgyzstan State Tax Service/IRS', '吉尔吉斯斯坦国家税务局·IRS', 'Cơ quan Thuế Nhà nước Kyrgyzstan·IRS', 'กรมสรรพากรแห่งรัฐคีร์กีซสถาน·IRS', 'Государственная налоговая служба Кыргызстана·IRS', {
      km: "អគ្គនាយកដ្ឋានពន្ធដាររដ្ឋកៀហ្ស៊ីស៊ីស្ថាន·IRS",
      ne: "किर्गिस्तान राज्य कर सेवा·IRS",
      id: "Layanan Pajak Negara Kirgistan·IRS",
      my: "ကာဂျစ်စတန် ပြည်နယ်အခွန်ဝန်ဆောင်မှု·IRS",
      si: "කිර්ගිස්ස්තාන රාජ්‍ය බදු සේවාව·IRS",
      uz: "Qirg'iziston Davlat soliq xizmati·IRS",
      mn: "Кыргызстаны Улсын татварын алба·IRS",
      kk: "Қырғызстанның Мемлекеттік салық қызметі·IRS",
      ky: "Кыргызстандын Мамлекеттик салык кызматы·IRS",
      ur: "کرغزستان اسٹیٹ ٹیکس سروس·IRS",
      bn: "কিরগিজস্তান রাষ্ট্রীয় কর সেবা·IRS",
      lo: "ບໍລິການພາສີແຫ່ງລັດຄີກີສຖານ·IRS",
      ja: "キルギス国家税務局·IRS",
      ar: "دائرة الضرائب الحكومية في قيرغيزستان·IRS",
      hi: "किर्गिज़स्तान राज्य कर सेवा·IRS",
      fr: "Service fiscal d'État du Kirghizistan·IRS",
      tl: "Serbisyo ng Buwis ng Estado ng Kyrgyzstan·IRS"
    }),
  mm: () => pickLang('미얀마 내국세청(IRD)·IRS', 'Myanmar Internal Revenue Department (IRD)/IRS', '缅甸内税务局·IRS', 'Cục Thuế Nội địa Myanmar (IRD)·IRS', 'กรมสรรพากรภายในเมียนมา (IRD)·IRS', 'Департамент внутренних доходов Мьянмы (IRD)·IRS', {
      km: "នាយកដ្ឋានចំណូលផ្ទៃក្នុងមីយ៉ាន់ម៉ា (IRD)·IRS",
      ne: "म्यानमार आन्तरिक राजस्व विभाग (IRD)·IRS",
      id: "Departemen Pendapatan Dalam Negeri Myanmar (IRD)·IRS",
      my: "မြန်မာ ပြည်တွင်းအခွန်ဦးစီးဌာန (IRD)·IRS",
      si: "මියන්මාර අභ්‍යන්තර ආදායම් දෙපාර්තමේන්තුව (IRD)·IRS",
      uz: "Myanma Ichki daromadlar departamenti (IRD)·IRS",
      mn: "Мьянмарын дотоод орлогын алба (IRD)·IRS",
      kk: "Мьянманың ішкі кірістер департаменті (IRD)·IRS",
      ky: "Мьянманын ички кирешелер департаменти (IRD)·IRS",
      ur: "میانمار انٹرنل ریونیو ڈیپارٹمنٹ (IRD)·IRS",
      bn: "মিয়ানমার অভ্যন্তরীণ রাজস্ব বিভাগ (IRD)·IRS",
      lo: "ກົມສ່ວຍສາອາກອນພາຍໃນມຽນມາ (IRD)·IRS",
      ja: "ミャンマー内国歳入局 (IRD)·IRS",
      ar: "إدارة الإيرادات الداخلية في ميانمار (IRD)·IRS",
      hi: "म्यांमार आंतरिक राजस्व विभाग (IRD)·IRS",
      fr: "Département des recettes intérieures du Myanmar (IRD)·IRS",
      tl: "Kagawaran ng Panloob na Kita ng Myanmar (IRD)·IRS"
    }),
  bd: () => pickLang('방글라데시 국세청(NBR)·IRS', 'Bangladesh National Board of Revenue (NBR)/IRS', '孟加拉国国家税务局·IRS', 'Ủy ban Thuế Quốc gia Bangladesh (NBR)·IRS', 'คณะกรรมการรายได้แห่งชาติบังกลาเทศ (NBR)·IRS', 'Национальный совет по доходам Бангладеш (NBR)·IRS', {
      km: "ក្រុមប្រឹក្សាជាតិចំណូលបង់ក្លាដែស (NBR)·IRS",
      ne: "बंगलादेश राष्ट्रिय राजस्व बोर्ड (NBR)·IRS",
      id: "Dewan Pendapatan Nasional Bangladesh (NBR)·IRS",
      my: "ဘင်္ဂလားဒေ့ရှ် အမျိုးသားဝင်ငွေဘုတ်အဖွဲ့ (NBR)·IRS",
      si: "බංග්ලාදේශ ජාතික ආදායම් මණ්ඩලය (NBR)·IRS",
      uz: "Bangladesh Milliy daromadlar kengashi (NBR)·IRS",
      mn: "Бангладешийн Үндэсний орлогын зөвлөл (NBR)·IRS",
      kk: "Бангладештің Ұлттық кірістер кеңесі (NBR)·IRS",
      ky: "Бангладештин Улуттук кирешелер кеңеши (NBR)·IRS",
      ur: "بنگلہ دیش نیشنل بورڈ آف ریونیو (NBR)·IRS",
      bn: "বাংলাদেশ জাতীয় রাজস্ব বোর্ড (NBR)·IRS",
      lo: "ຄະນະກຳມະການລາຍໄດ້ແຫ່ງຊາດບັງກະລາເທດ (NBR)·IRS",
      ja: "バングラデシュ国家歳入庁 (NBR)·IRS",
      ar: "الهيئة الوطنية للإيرادات في بنغلاديش (NBR)·IRS",
      hi: "बांग्लादेश राष्ट्रीय राजस्व बोर्ड (NBR)·IRS",
      fr: "Conseil national des recettes du Bangladesh (NBR)·IRS",
      tl: "Pambansang Lupon ng Kita ng Bangladesh (NBR)·IRS"
    }),
  pk: () => pickLang('파키스탄 연방국세청(FBR) 자료 기준 추정치·IRS ⚠️', 'Estimate based on Pakistan FBR data/IRS ⚠️', '基于巴基斯坦联邦税务局资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu FBR Pakistan·IRS ⚠️', 'ค่าประมาณจากข้อมูล FBR ปากีสถาน·IRS ⚠️', 'Оценка на основе данных FBR Пакистана·IRS ⚠️', {
      km: "ការប៉ាន់ស្មានផ្អែកលើទិន្នន័យ FBR ប៉ាគីស្ថាន·IRS ⚠️",
      ne: "पाकिस्तान FBR डेटामा आधारित अनुमान·IRS ⚠️",
      id: "Estimasi berdasarkan data FBR Pakistan·IRS ⚠️",
      my: "ပါကစ္စတန် FBR ဒေတာအပေါ်အခြေခံ ခန့်မှန်းချက်·IRS ⚠️",
      si: "පකිස්ථාන FBR දත්ත මත පදනම් වූ ඇස්තමේන්තුව·IRS ⚠️",
      uz: "Pokiston FBR ma'lumotlariga asoslangan taxminiy hisob·IRS ⚠️",
      mn: "Пакистаны FBR-ийн мэдээлэлд үндэслэсэн тооцоо·IRS ⚠️",
      kk: "Пәкістанның FBR деректеріне негізделген болжам·IRS ⚠️",
      ky: "Пакистандын FBR маалыматына негизделген болжол·IRS ⚠️",
      ur: "پاکستان FBR ڈیٹا پر مبنی تخمینہ·IRS ⚠️",
      bn: "পাকিস্তান FBR তথ্যের ভিত্তিতে অনুমান·IRS ⚠️",
      lo: "ການຄາດຄະເນໂດຍອີງໃສ່ຂໍ້ມູນ FBR ປາກີສະຖານ·IRS ⚠️",
      ja: "パキスタンFBRデータに基づく推定値·IRS ⚠️",
      ar: "تقدير استنادًا إلى بيانات FBR الباكستانية·IRS ⚠️",
      hi: "पाकिस्तान FBR आंकड़ों पर आधारित अनुमान·IRS ⚠️",
      fr: "Estimation basée sur les données du FBR du Pakistan·IRS ⚠️",
      tl: "Pagtatantiya batay sa datos ng FBR ng Pakistan·IRS ⚠️"
    }),
  kh: () => pickLang('캄보디아 국세청(GDT) 자료 기준 추정치·IRS ⚠️', 'Estimate based on Cambodia GDT data/IRS ⚠️', '基于柬埔寨税务总局资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu GDT Campuchia·IRS ⚠️', 'ค่าประมาณจากข้อมูล GDT กัมพูชา·IRS ⚠️', 'Оценка на основе данных GDT Камбоджи·IRS ⚠️', {
      km: "ការប៉ាន់ស្មានផ្អែកលើទិន្នន័យអគ្គនាយកដ្ឋានពន្ធដារកម្ពុជា (GDT)·IRS ⚠️",
      ne: "कम्बोडिया GDT डेटामा आधारित अनुमान·IRS ⚠️",
      id: "Estimasi berdasarkan data GDT Kamboja·IRS ⚠️",
      my: "ကမ္ဘောဒီးယား GDT ဒေတာအပေါ်အခြေခံ ခန့်မှန်းချက်·IRS ⚠️",
      si: "කාම්බෝජ GDT දත්ත මත පදනම් වූ ඇස්තමේන්තුව·IRS ⚠️",
      uz: "Kambodja GDT ma'lumotlariga asoslangan taxminiy hisob·IRS ⚠️",
      mn: "Камбожийн GDT-ийн мэдээлэлд үндэслэсэн тооцоо·IRS ⚠️",
      kk: "Камбоджаның GDT деректеріне негізделген болжам·IRS ⚠️",
      ky: "Камбоджанын GDT маалыматына негизделген болжол·IRS ⚠️",
      ur: "کمبوڈیا GDT ڈیٹا پر مبنی تخمینہ·IRS ⚠️",
      bn: "কম্বোডিয়া GDT তথ্যের ভিত্তিতে অনুমান·IRS ⚠️",
      lo: "ການຄາດຄະເນໂດຍອີງໃສ່ຂໍ້ມູນ GDT ກຳປູເຈຍ·IRS ⚠️",
      ja: "カンボジアGDTデータに基づく推定値·IRS ⚠️",
      ar: "تقدير استنادًا إلى بيانات GDT الكمبودية·IRS ⚠️",
      hi: "कंबोडिया GDT आंकड़ों पर आधारित अनुमान·IRS ⚠️",
      fr: "Estimation basée sur les données du GDT du Cambodge·IRS ⚠️",
      tl: "Pagtatantiya batay sa datos ng GDT ng Cambodia·IRS ⚠️"
    }),
  mn: () => pickLang('몽골 국세청 자료 기준 추정치·IRS ⚠️', 'Estimate based on Mongolia Tax Administration data/IRS ⚠️', '基于蒙古税务局资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu Cơ quan Thuế Mông Cổ·IRS ⚠️', 'ค่าประมาณจากข้อมูลกรมสรรพากรมองโกเลีย·IRS ⚠️', 'Оценка на основе данных налогового управления Монголии·IRS ⚠️', {
      km: "ការប៉ាន់ស្មានផ្អែកលើទិន្នន័យរដ្ឋបាលពន្ធដារម៉ុងហ្គោលី·IRS ⚠️",
      ne: "मंगोलिया कर प्रशासन डेटामा आधारित अनुमान·IRS ⚠️",
      id: "Estimasi berdasarkan data Administrasi Pajak Mongolia·IRS ⚠️",
      my: "မွန်ဂိုလီးယား အခွန်စီမံခန့်ခွဲမှုဌာန ဒေတာအပေါ်အခြေခံ ခန့်မှန်းချက်·IRS ⚠️",
      si: "මොංගෝලියානු බදු පරිපාලන දත්ත මත පදනම් වූ ඇස්තමේන්තුව·IRS ⚠️",
      uz: "Mongoliya Soliq boshqarmasi ma'lumotlariga asoslangan taxminiy hisob·IRS ⚠️",
      mn: "Монголын татварын албаны мэдээлэлд үндэслэсэн тооцоо·IRS ⚠️",
      kk: "Моңғолияның салық басқармасы деректеріне негізделген болжам·IRS ⚠️",
      ky: "Монголиянын салык башкармалыгынын маалыматына негизделген болжол·IRS ⚠️",
      ur: "منگولیا ٹیکس ایڈمنسٹریشن ڈیٹا پر مبنی تخمینہ·IRS ⚠️",
      bn: "মঙ্গোলিয়া কর প্রশাসনের তথ্যের ভিত্তিতে অনুমান·IRS ⚠️",
      lo: "ການຄາດຄະເນໂດຍອີງໃສ່ຂໍ້ມູນອົງການພາສີມົງໂກເລຍ·IRS ⚠️",
      ja: "モンゴル税務局データに基づく推定値·IRS ⚠️",
      ar: "تقدير استنادًا إلى بيانات إدارة الضرائب المنغولية·IRS ⚠️",
      hi: "मंगोलिया कर प्रशासन आंकड़ों पर आधारित अनुमान·IRS ⚠️",
      fr: "Estimation basée sur les données de l'Administration fiscale de Mongolie·IRS ⚠️",
      tl: "Pagtatantiya batay sa datos ng Administrasyon ng Buwis ng Mongolia·IRS ⚠️"
    }),
  la: () => pickLang('라오스 재정부 자료 기준 추정치·IRS ⚠️', 'Estimate based on Laos Ministry of Finance data/IRS ⚠️', '基于老挝财政部资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu Bộ Tài chính Lào·IRS ⚠️', 'ค่าประมาณจากข้อมูลกระทรวงการคลังลาว·IRS ⚠️', 'Оценка на основе данных Министерства финансов Лаоса·IRS ⚠️', {
      km: "ការប៉ាន់ស្មានផ្អែកលើទិន្នន័យក្រសួងហិរញ្ញវត្ថុឡាវ·IRS ⚠️",
      ne: "लाओस अर्थ मन्त्रालय डेटामा आधारित अनुमान·IRS ⚠️",
      id: "Estimasi berdasarkan data Kementerian Keuangan Laos·IRS ⚠️",
      my: "လာအို ဘဏ္ဍာရေးဝန်ကြီးဌာန ဒေတာအပေါ်အခြေခံ ခန့်မှန်းချက်·IRS ⚠️",
      si: "ලාඕස මුදල් අමාත්‍යාංශ දත්ත මත පදනම් වූ ඇස්තමේන්තුව·IRS ⚠️",
      uz: "Laos Moliya vazirligi ma'lumotlariga asoslangan taxminiy hisob·IRS ⚠️",
      mn: "Лаосын Сангийн яамны мэдээлэлд үндэслэсэн тооцоо·IRS ⚠️",
      kk: "Лаостың Қаржы министрлігі деректеріне негізделген болжам·IRS ⚠️",
      ky: "Лаостун Финансы министрлигинин маалыматына негизделген болжол·IRS ⚠️",
      ur: "لاؤس وزارت خزانہ ڈیٹا پر مبنی تخمینہ·IRS ⚠️",
      bn: "লাওস অর্থ মন্ত্রণালয়ের তথ্যের ভিত্তিতে অনুমান·IRS ⚠️",
      lo: "ການຄາດຄະເນໂດຍອີງໃສ່ຂໍ້ມູນກະຊວງການເງິນລາວ·IRS ⚠️",
      ja: "ラオス財務省データに基づく推定値·IRS ⚠️",
      ar: "تقدير استنادًا إلى بيانات وزارة المالية اللاوية·IRS ⚠️",
      hi: "लाओस वित्त मंत्रालय आंकड़ों पर आधारित अनुमान·IRS ⚠️",
      fr: "Estimation basée sur les données du ministère des Finances du Laos·IRS ⚠️",
      tl: "Pagtatantiya batay sa datos ng Ministri ng Pananalapi ng Laos·IRS ⚠️"
    }),
  kr: () => pickLang('국세청·IRS', 'IRS/NTS', 'IRS·韩国国税厅', 'Cơ quan Thuế Hàn Quốc·IRS', 'กรมสรรพากรเกาหลี·IRS', 'Налоговая служба Кореи·IRS', {
      km: "ការិយាល័យពន្ធដារជាតិកូរ៉េ·IRS",
      ne: "कोरिया राष्ट्रिय कर सेवा·IRS",
      id: "Layanan Pajak Nasional Korea·IRS",
      my: "ကိုရီးယား အမျိုးသားအခွန်ဝန်ဆောင်မှု·IRS",
      si: "කොරියානු ජාතික බදු සේවාව·IRS",
      uz: "Koreya Milliy soliq xizmati·IRS",
      mn: "Солонгосын Үндэсний татварын алба·IRS",
      kk: "Кореяның Ұлттық салық қызметі·IRS",
      ky: "Кореянын Улуттук салык кызматы·IRS",
      ur: "کوریا نیشنل ٹیکس سروس·IRS",
      bn: "কোরিয়া জাতীয় কর সেবা·IRS",
      lo: "ບໍລິການພາສີແຫ່ງຊາດເກົາຫຼີ·IRS",
      ja: "韓国国税庁·IRS",
      ar: "مصلحة الضرائب الوطنية الكورية·IRS",
      hi: "कोरिया राष्ट्रीय कर सेवा·IRS",
      fr: "Service national des impôts de Corée·IRS",
      tl: "Pambansang Serbisyo ng Buwis ng Korea·IRS"
    }),
  us: () => pickLang('IRS', 'IRS', 'IRS', 'IRS', 'IRS', 'IRS', {
      km: "IRS",
      ne: "IRS",
      id: "IRS",
      my: "IRS",
      si: "IRS",
      uz: "IRS",
      mn: "IRS",
      kk: "IRS",
      ky: "IRS",
      ur: "IRS",
      bn: "IRS",
      lo: "IRS",
      ja: "IRS",
      ar: "IRS",
      hi: "IRS",
      fr: "IRS",
      tl: "IRS"
    })
};

// 세율 자체가 불확실하거나(공식 근거를 못 찾음), 세율은 알아도 실제 적용 여부가 불확실한 나라들을
// 위한 경고 배너 문구 모음. 다른 나라(kr/us/cn/in/vn/id/ph 등)는 근거가 확인된 세율이라 필요 없고,
// 여기 등록된 나라만 화면에 별도 경고 배너로 "다른 나라와 같은 신뢰도가 아니다"를 명확히 알림
const COUNTRY_TAX_DISCLAIMERS = {
  th: () => pickLang(
    '⚠️ 태국은 해외 복권 당첨금에 대한 명확한 공식 과세 기준을 아직 찾지 못했어요. 여기 나온 세금은 태국 개인소득세 최고세율(35%)로 추정한 참고치이며, 실제 세율과 다를 수 있어요. 정확한 금액은 반드시 태국 국세청이나 세무 전문가에게 확인하세요.',
    '⚠️ We couldn’t find a clear official rule for how Thailand taxes foreign lottery winnings. The tax shown here is an estimate based on Thailand’s top personal income tax rate (35%) and may differ from the real amount. Please confirm with Thailand’s Revenue Department or a tax professional.',
    '⚠️ 目前尚未找到泰国对境外彩票中奖收入征税的明确官方依据。这里显示的税额是按泰国个人所得税最高税率（35%）估算的参考值，可能与实际税额不同。请务必向泰国税务厅或税务专家确认准确金额。',
    '⚠️ Chúng tôi chưa tìm thấy quy định chính thức rõ ràng về cách Thái Lan đánh thuế tiền thắng xổ số nước ngoài. Số thuế hiển thị ở đây là ước tính dựa trên thuế suất thu nhập cá nhân cao nhất của Thái Lan (35%) và có thể khác với số tiền thực tế. Vui lòng xác nhận với Cục Thuế Thái Lan hoặc chuyên gia thuế.',
    '⚠️ เรายังไม่พบหลักเกณฑ์ทางการที่ชัดเจนว่าประเทศไทยเก็บภาษีเงินรางวัลลอตเตอรีจากต่างประเทศอย่างไร ภาษีที่แสดงนี้เป็นค่าประมาณจากอัตราภาษีเงินได้บุคคลธรรมดาสูงสุดของไทย (35%) และอาจแตกต่างจากจำนวนจริง กรุณายืนยันกับกรมสรรพากรหรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ Мы не смогли найти чёткого официального правила о том, как Таиланд облагает налогом иностранные лотерейные выигрыши. Показанный здесь налог — это оценка на основе максимальной ставки подоходного налога Таиланда (35%), которая может отличаться от реальной суммы. Уточните точную сумму в налоговом управлении Таиланда или у налогового специалиста.',
    {
      km: "⚠️ យើងមិនអាចរកឃើញច្បាប់ផ្លូវការច្បាស់លាស់អំពីរបៀបដែលប្រទេសថៃយកពន្ធលើប្រាក់រង្វាន់ឆ្នោតបរទេសនោះទេ។ ពន្ធដែលបង្ហាញនៅទីនេះជាការប៉ាន់ស្មានផ្អែកលើអត្រាពន្ធលើប្រាក់ចំណូលបុគ្គលកំពូលរបស់ថៃ (35%) ហើយអាចខុសពីចំនួនពិតប្រាកដ។ សូមបញ្ជាក់ជាមួយអគ្គនាយកដ្ឋានពន្ធដារថៃ ឬអ្នកជំនាញពន្ធ។",
      ne: "⚠️ थाइल्याण्डले विदेशी लटरी जित्ने रकममा कसरी कर लगाउँछ भन्ने बारे हामीले स्पष्ट आधिकारिक नियम फेला पार्न सकेनौं। यहाँ देखाइएको कर थाइल्याण्डको उच्चतम व्यक्तिगत आयकर दर (35%) मा आधारित अनुमान हो र वास्तविक रकमभन्दा फरक हुन सक्छ। कृपया थाइल्याण्ड राजस्व विभाग वा कर विशेषज्ञसँग पुष्टि गर्नुहोस्।",
      id: "⚠️ Kami tidak menemukan aturan resmi yang jelas tentang bagaimana Thailand mengenakan pajak atas kemenangan lotre luar negeri. Pajak yang ditampilkan di sini adalah perkiraan berdasarkan tarif pajak penghasilan pribadi tertinggi Thailand (35%) dan mungkin berbeda dari jumlah sebenarnya. Harap konfirmasi dengan Departemen Pendapatan Thailand atau profesional pajak.",
      my: "⚠️ ထိုင်းနိုင်ငံသည် နိုင်ငံခြားထီပေါက်ငွေကို မည်သို့အခွန်ကောက်ခံသည်ဆိုသည့် ရှင်းလင်းသော တရားဝင်စည်းမျဉ်းကို ကျွန်ုပ်တို့ ရှာမတွေ့ခဲ့ပါ။ ဤတွင်ပြသထားသော အခွန်သည် ထိုင်း၏ အမြင့်ဆုံးပုဂ္ဂိုလ်ရေးဝင်ငွေခွန်နှုန်း (35%) ကို အခြေခံ၍ ခန့်မှန်းထားခြင်းဖြစ်ပြီး အမှန်တကယ်ပမာဏနှင့် ကွာခြားနိုင်ပါသည်။ ထိုင်းအခွန်ဦးစီးဌာန သို့မဟုတ် အခွန်ကျွမ်းကျင်သူနှင့် အတည်ပြုပါ။",
      si: "⚠️ තායිලන්තය විදේශීය ලොතරැයි ජයග්‍රහණවලට බදු අය කරන ආකාරය පිළිබඳ පැහැදිලි නිල නීතියක් අපට සොයාගත නොහැකි විය. මෙහි පෙන්වා ඇති බද්ද තායිලන්තයේ ඉහළම පුද්ගලික ආදායම් බදු අනුපාතය (35%) මත පදනම් වූ ඇස්තමේන්තුවක් වන අතර එය සැබෑ මුදලට වඩා වෙනස් විය හැක. කරුණාකර තායිලන්තයේ ආදායම් දෙපාර්තමේන්තුව හෝ බදු වෘත්තිකයෙකු සමඟ තහවුරු කරන්න.",
      uz: "⚠️ Tailand xorijiy lotereya yutuqlariga qanday soliq solishi haqida aniq rasmiy qoidani topa olmadik. Bu yerda ko'rsatilgan soliq Tailandning eng yuqori shaxsiy daromad solig'i stavkasi (35%) asosida taxmin qilingan bo'lib, haqiqiy summadan farq qilishi mumkin. Iltimos, Tailand Daromadlar departamenti yoki soliq mutaxassisi bilan tasdiqlang.",
      mn: "⚠️ Тайланд гадаадын сугалааны ялалтад хэрхэн татвар ногдуулдаг тухай тодорхой албан ёсны дүрмийг бид олж чадсангүй. Энд харуулсан татвар нь Тайландын хувь хүний орлогын албан татварын дээд хувь (35%)-д үндэслэсэн тооцоо бөгөөд бодит дүнгээс ялгаатай байж болно. Тайландын Орлогын алба эсвэл татварын мэргэжилтэнтэй холбогдож баталгаажуулна уу.",
      kk: "⚠️ Тайландтың шетелдік лотерея ұтыстарына қалай салық салатыны туралы нақты ресми ережені таба алмадық. Мұнда көрсетілген салық Тайландтың ең жоғары жеке табыс салығы мөлшерлемесіне (35%) негізделген болжам және нақты сомадан ерекшеленуі мүмкін. Тайландтың Кірістер департаментімен немесе салық маманымен растаңыз.",
      ky: "⚠️ Тайланддын чет өлкөлүк лотерея утуштарына кандайча салык салары боюнча так расмий эрежени таба алган жокпуз. Бул жерде көрсөтүлгөн салык Тайланддын эң жогорку жеке киреше салыгынын чени (35%) боюнча болжолдонгон жана чыныгы суммадан айырмаланышы мүмкүн. Тайланддын Кирешелер департаменти же салык боюнча адис менен тактаңыз.",
      ur: "⚠️ ہمیں یہ واضح سرکاری قاعدہ نہیں مل سکا کہ تھائی لینڈ غیر ملکی لاٹری جیت پر کیسے ٹیکس لگاتا ہے۔ یہاں دکھایا گیا ٹیکس تھائی لینڈ کی سب سے زیادہ انفرادی انکم ٹیکس شرح (35%) پر مبنی تخمینہ ہے اور اصل رقم سے مختلف ہو سکتا ہے۔ براہ کرم تھائی لینڈ ریونیو ڈیپارٹمنٹ یا ٹیکس ماہر سے تصدیق کریں۔",
      bn: "⚠️ থাইল্যান্ড বিদেশি লটারি জয়ের উপর কীভাবে কর আরোপ করে তার স্পষ্ট সরকারি নিয়ম আমরা খুঁজে পাইনি। এখানে দেখানো করটি থাইল্যান্ডের সর্বোচ্চ ব্যক্তিগত আয়কর হারের (৩৫%) উপর ভিত্তি করে একটি অনুমান এবং প্রকৃত পরিমাণ থেকে ভিন্ন হতে পারে। অনুগ্রহ করে থাইল্যান্ড রাজস্ব বিভাগ বা কর বিশেষজ্ঞের সাথে নিশ্চিত করুন।",
      lo: "⚠️ ພວກເຮົາບໍ່ພົບກົດລະບຽບທາງການທີ່ຊັດເຈນວ່າໄທເກັບພາສີເງິນລາງວັນເລກລອດເຕີຣີຕ່າງປະເທດແນວໃດ. ພາສີທີ່ສະແດງຢູ່ນີ້ແມ່ນການຄາດຄະເນໂດຍອີງໃສ່ອັດຕາພາສີເງິນໄດ້ບຸກຄົນສູງສຸດຂອງໄທ (35%) ແລະອາດແຕກຕ່າງຈາກຈຳນວນຈິງ. ກະລຸນາຢືນຢັນກັບກົມສ່ວຍສາອາກອນໄທ ຫຼື ຜູ້ຊ່ຽວຊານດ້ານພາສີ.",
      ja: "⚠️ タイが海外の宝くじ当選金にどのように課税するかについて、明確な公式ルールが見つかりませんでした。ここに表示されている税額はタイの個人所得税最高税率（35%）に基づく推定値であり、実際の金額とは異なる場合があります。タイ歳入局または税務専門家にご確認ください。",
      ar: "⚠️ لم نتمكن من العثور على قاعدة رسمية واضحة حول كيفية فرض تايلاند الضرائب على أرباح اليانصيب الأجنبية. الضريبة المعروضة هنا هي تقدير استنادًا إلى أعلى معدل لضريبة الدخل الشخصي في تايلاند (35%) وقد تختلف عن المبلغ الفعلي. يرجى التأكيد مع إدارة الإيرادات التايلاندية أو أحد المتخصصين الضريبيين.",
      hi: "⚠️ थाईलैंड विदेशी लॉटरी जीत पर कैसे कर लगाता है, इसके लिए हमें कोई स्पष्ट आधिकारिक नियम नहीं मिला। यहां दिखाया गया कर थाईलैंड की उच्चतम व्यक्तिगत आयकर दर (35%) पर आधारित अनुमान है और वास्तविक राशि से भिन्न हो सकता है। कृपया थाईलैंड राजस्व विभाग या कर विशेषज्ञ से पुष्टि करें।",
      fr: "⚠️ Nous n'avons trouvé aucune règle officielle claire sur la manière dont la Thaïlande taxe les gains de loterie étrangers. L'impôt indiqué ici est une estimation basée sur le taux d'imposition sur le revenu des personnes physiques le plus élevé de Thaïlande (35 %) et peut différer du montant réel. Veuillez confirmer auprès du Département des recettes de Thaïlande ou d'un professionnel de la fiscalité.",
      tl: "⚠️ Hindi kami nakahanap ng malinaw na opisyal na patakaran kung paano binubuwisan ng Thailand ang mga panalo sa dayuhang lottery. Ang buwis na ipinapakita dito ay isang pagtatantiya batay sa pinakamataas na personal income tax rate ng Thailand (35%) at maaaring iba sa aktwal na halaga. Mangyaring kumpirmahin sa Kagawaran ng Kita ng Thailand o isang propesyonal sa buwis."
    }
  ),
  ru: () => pickLang(
    '⚠️ 러시아는 2023년에 미국과의 조세조약 핵심 조항(이중과세 조정 포함)의 효력을 정지시켰어요. 세율(22%) 자체는 확인된 정보예요. 러시아 세법상으로는 개인의 세금 감면 권리가 인정되지만, 양국 간 조약이 공식 정지된 상태라 실제로 러시아 국세청에서 감면받을 때는 세무 처리상 불확실성이 남아있어요 — 최악의 경우 여기 나온 것보다 세금을 더 낼 수도 있어요. 정확한 처리는 러시아 세무 전문가에게 확인하세요.',
    '⚠️ In 2023, Russia suspended key parts of its US tax treaty (including double-taxation relief). The 22% rate itself is well documented. Russian tax law recognizes individuals\' right to a tax reduction, but since the treaty between the two countries is officially suspended, there\'s still uncertainty in how Russia\'s tax authority handles this in practice. In the worst case you could owe more than shown here. Please confirm the details with a Russian tax professional.',
    '⚠️ 俄罗斯于2023年暂停了与美国税收协定核心条款（含避免双重征税条款）的效力。22%这个税率本身有据可查。俄罗斯税法承认个人的减税权利，但由于两国间的条约已正式暂停，俄罗斯税务机关在实际操作中如何处理仍存在不确定性——最坏情况下实际要交的税可能比这里显示的更多。请务必向俄罗斯税务专家确认。',
    '⚠️ Năm 2023, Nga đã đình chỉ các điều khoản cốt lõi trong hiệp định thuế với Mỹ (bao gồm điều khoản tránh đánh thuế hai lần). Mức thuế 22% được xác nhận rõ ràng. Luật thuế Nga công nhận quyền giảm thuế của cá nhân, nhưng vì hiệp định giữa hai nước đã chính thức bị đình chỉ nên vẫn còn sự không chắc chắn về cách cơ quan thuế Nga xử lý việc này trên thực tế. Trường hợp xấu nhất bạn có thể phải nộp nhiều hơn số hiển thị ở đây. Vui lòng xác nhận với chuyên gia thuế Nga.',
    '⚠️ ในปี 2023 รัสเซียได้ระงับข้อกำหนดหลักของสนธิสัญญาภาษีกับสหรัฐฯ (รวมถึงข้อกำหนดป้องกันการเก็บภาษีซ้อน) อัตราภาษี 22% นี้มีข้อมูลยืนยันชัดเจน กฎหมายภาษีรัสเซียยอมรับสิทธิ์ลดหย่อนภาษีของบุคคล แต่เนื่องจากสนธิสัญญาระหว่างสองประเทศถูกระงับอย่างเป็นทางการ จึงยังมีความไม่แน่นอนว่ากรมสรรพากรรัสเซียจะดำเนินการอย่างไรในทางปฏิบัติ — กรณีเลวร้ายที่สุดคุณอาจต้องจ่ายภาษีมากกว่าที่แสดงไว้นี้ กรุณายืนยันกับผู้เชี่ยวชาญด้านภาษีของรัสเซีย',
    '⚠️ В 2023 году Россия приостановила действие ключевых положений налогового соглашения с США (включая устранение двойного налогообложения). Сама ставка 22% хорошо подтверждена. Российское налоговое законодательство признаёт право физлиц на снижение налога, но поскольку соглашение между странами официально приостановлено, остаётся неясным, как это будет применяться на практике налоговой службой России. В худшем случае налог может оказаться выше показанного здесь. Уточните детали у российского налогового специалиста.',
    {
      km: "⚠️ ក្នុងឆ្នាំ 2023 រុស្ស៊ីបានផ្អាកផ្នែកសំខាន់ៗនៃសន្ធិសញ្ញាពន្ធជាមួយសហរដ្ឋអាមេរិក (រួមទាំងការលើកលែងការយកពន្ធពីរដង)។ អត្រា 22% ខ្លួនឯងមានឯកសារបញ្ជាក់ច្បាស់លាស់។ ច្បាប់ពន្ធរបស់រុស្ស៊ីទទួលស្គាល់សិទ្ធិរបស់បុគ្គលក្នុងការកាត់បន្ថយពន្ធ ប៉ុន្តែដោយសារសន្ធិសញ្ញារវាងប្រទេសទាំងពីរត្រូវបានផ្អាកជាផ្លូវការ វានៅតែមានភាពមិនច្បាស់លាស់អំពីរបៀបដែលអាជ្ញាធរពន្ធដាររុស្ស៊ីដោះស្រាយបញ្ហានេះជាក់ស្តែង។ ក្នុងករណីអាក្រក់បំផុតអ្នកអាចជំពាក់ច្រើនជាងអ្វីដែលបានបង្ហាញនៅទីនេះ។ សូមបញ្ជាក់ព័ត៌មានលម្អិតជាមួយអ្នកជំនាញពន្ធរុស្ស៊ី។",
      ne: "⚠️ 2023 मा, रुसले आफ्नो अमेरिकी कर सन्धिका मुख्य भागहरू (दोहोरो कर छुट सहित) निलम्बित गर्‍यो। 22% दर आफैं राम्ररी दस्तावेजीकरण गरिएको छ। रुसी कर कानूनले व्यक्तिहरूको कर कटौतीको अधिकार मान्यता दिन्छ, तर दुई देशबीचको सन्धि आधिकारिक रूपमा निलम्बित भएकाले, रुसको कर प्राधिकरणले व्यवहारमा यसलाई कसरी सम्हाल्छ भन्ने बारे अझै अनिश्चितता छ। सबैभन्दा खराब अवस्थामा तपाईंले यहाँ देखाइएभन्दा बढी तिर्नुपर्ने हुन सक्छ। कृपया विवरणहरू रुसी कर विशेषज्ञसँग पुष्टि गर्नुहोस्।",
      id: "⚠️ Pada tahun 2023, Rusia menangguhkan bagian-bagian penting dari perjanjian pajaknya dengan AS (termasuk keringanan pajak berganda). Tarif 22% itu sendiri terdokumentasi dengan baik. Hukum pajak Rusia mengakui hak individu atas pengurangan pajak, tetapi karena perjanjian antara kedua negara secara resmi ditangguhkan, masih ada ketidakpastian tentang bagaimana otoritas pajak Rusia menangani hal ini dalam praktiknya. Dalam skenario terburuk, Anda bisa berutang lebih dari yang ditampilkan di sini. Harap konfirmasi detailnya dengan profesional pajak Rusia.",
      my: "⚠️ ၂၀၂၃ ခုနှစ်တွင် ရုရှားသည် အမေရိကန်နှင့် ချုပ်ဆိုထားသော အခွန်သဘောတူညီချက်၏ အဓိကအစိတ်အပိုင်းများ (နှစ်ဆအခွန်ကင်းလွတ်ခွင့်အပါအဝင်) ကို ရပ်ဆိုင်းခဲ့သည်။ ၂၂% နှုန်းကိုယ်တိုင်ကို စာရွက်စာတမ်းများဖြင့် ကောင်းစွာအထောက်အထားပြထားသည်။ ရုရှားအခွန်ဥပဒေသည် ပုဂ္ဂိုလ်ရေးအခွန်လျှော့ချခွင့်ကို အသိအမှတ်ပြုသော်လည်း၊ နှစ်နိုင်ငံအကြား သဘောတူညီချက်ကို တရားဝင်ရပ်ဆိုင်းထားသောကြောင့် ရုရှားအခွန်အာဏာပိုင်များက ၎င်းကို လက်တွေ့တွင် မည်သို့ကိုင်တွယ်မည်ဆိုသည်မှာ မသေချာမှုရှိနေဆဲဖြစ်သည်။ အဆိုးဆုံးအခြေအနေတွင် ဤတွင်ပြထားသည်ထက် ပိုပေးရနိုင်သည်။ ရုရှားအခွန်ကျွမ်းကျင်သူနှင့် အသေးစိတ်ကို အတည်ပြုပါ။",
      si: "⚠️ 2023 දී, රුසියාව එක්සත් ජනපදය සමඟ ඇති බදු ගිවිසුමේ ප්‍රධාන කොටස් (ද්විත්ව බදුකරණ සහන ඇතුළුව) අත්හිටුවීය. 22% අනුපාතය එයම හොඳින් ලේඛනගත කර ඇත. රුසියානු බදු නීතිය පුද්ගලයින්ගේ බදු අඩුකිරීමේ අයිතිය පිළිගනී, නමුත් රටවල් දෙක අතර ගිවිසුම නිල වශයෙන් අත්හිටුවා ඇති බැවින්, රුසියාවේ බදු අධිකාරිය මෙය ප්‍රායෝගිකව හසුරුවන ආකාරය පිළිබඳ තවමත් අවිනිශ්චිතතාවයක් පවතී. නරකම අවස්ථාවෙහිදී ඔබට මෙහි පෙන්වා ඇති ප්‍රමාණයට වඩා ගෙවීමට සිදුවිය හැක. කරුණාකර විස්තර රුසියානු බදු වෘත්තිකයෙකු සමඟ තහවුරු කරන්න.",
      uz: "⚠️ 2023-yilda Rossiya AQSh bilan tuzilgan soliq shartnomasining asosiy qismlarini (ikki tomonlama soliqqa tortishni bartaraf etishni ham) to'xtatdi. 22% stavkaning o'zi yaxshi hujjatlashtirilgan. Rossiya soliq qonunchiligi jismoniy shaxslarning soliqni kamaytirish huquqini tan oladi, lekin ikki mamlakat o'rtasidagi shartnoma rasman to'xtatilgani sababli, Rossiya soliq organi buni amalda qanday hal qilishi haqida hali ham noaniqlik mavjud. Eng yomon holatda siz bu yerda ko'rsatilganidan ko'proq to'lashingiz mumkin. Iltimos, tafsilotlarni rossiyalik soliq mutaxassisi bilan tasdiqlang.",
      mn: "⚠️ 2023 онд Орос АНУ-тай хийсэн татварын гэрээний гол хэсгүүдийг (давхар татвар ногдуулахаас чөлөөлөх зэрэг) түдгэлзүүлсэн. 22%-ийн хувь өөрөө сайн баримтжуулагдсан. Оросын татварын хууль хувь хүний татвар бууруулах эрхийг хүлээн зөвшөөрдөг ч хоёр орны хоорондын гэрээ албан ёсоор түдгэлзсэн тул Оросын татварын алба үүнийг практикт хэрхэн шийддэг нь тодорхойгүй хэвээр байна. Хамгийн муу тохиолдолд энд харуулснаас илүү төлөх шаардлагатай байж болно. Дэлгэрэнгүй мэдээллийг Оросын татварын мэргэжилтэнтэй баталгаажуулна уу.",
      kk: "⚠️ 2023 жылы Ресей АҚШ-пен жасалған салық келісімінің негізгі бөліктерін (қосарланған салық салуды жеңілдетуді қоса алғанда) тоқтатты. 22% мөлшерлеменің өзі жақсы құжатталған. Ресей салық заңнамасы жеке тұлғалардың салықты азайту құқығын мойындайды, бірақ екі ел арасындағы келісім ресми түрде тоқтатылғандықтан, Ресейдің салық органы мұны іс жүзінде қалай шешетіні әлі белгісіз. Ең нашар жағдайда сіз мұнда көрсетілгеннен көбірек төлеуге тура келуі мүмкін. Толығырақты ресейлік салық маманымен растаңыз.",
      ky: "⚠️ 2023-жылы Орусия АКШ менен түзүлгөн салык макулдашуусунун негизги бөлүктөрүн (кош салык салууну жоюуну кошо алганда) токтотту. 22% чени өзү жакшы документтештирилген. Орусиянын салык мыйзамы жеке адамдардын салыкты азайтуу укугун таанып билет, бирок эки өлкөнүн ортосундагы макулдашуу расмий түрдө токтотулгандыктан, Орусиянын салык бийлиги муну иш жүзүндө кантип чечери али белгисиз бойдон калууда. Эң начар учурда сиз бул жерде көрсөтүлгөндөн көбүрөөк төлөшүңүз мүмкүн. Толук маалыматты орусиялык салык адиси менен тактаңыз.",
      ur: "⚠️ 2023 میں، روس نے امریکہ کے ساتھ اپنے ٹیکس معاہدے کے اہم حصوں (بشمول دوہرے ٹیکس سے نجات) کو معطل کر دیا۔ 22% کی شرح خود اچھی طرح دستاویزی ہے۔ روسی ٹیکس قانون افراد کے ٹیکس میں کمی کے حق کو تسلیم کرتا ہے، لیکن چونکہ دونوں ممالک کے درمیان معاہدہ باضابطہ طور پر معطل ہے، اس لیے روس کا ٹیکس ادارہ عملی طور پر اس سے کیسے نمٹتا ہے اس میں ابھی بھی غیر یقینی صورتحال ہے۔ بدترین صورت میں آپ کو یہاں دکھائی گئی رقم سے زیادہ ادا کرنا پڑ سکتا ہے۔ براہ کرم تفصیلات روسی ٹیکس ماہر سے تصدیق کریں۔",
      bn: "⚠️ ২০২৩ সালে, রাশিয়া মার্কিন যুক্তরাষ্ট্রের সাথে তার কর চুক্তির মূল অংশগুলি (দ্বৈত কর ত্রাণ সহ) স্থগিত করে। ২২% হার নিজেই ভালোভাবে নথিভুক্ত। রাশিয়ার কর আইন ব্যক্তিদের কর হ্রাসের অধিকার স্বীকার করে, তবে দুই দেশের মধ্যে চুক্তি আনুষ্ঠানিকভাবে স্থগিত থাকায়, রাশিয়ার কর কর্তৃপক্ষ বাস্তবে এটি কীভাবে পরিচালনা করে তা নিয়ে এখনও অনিশ্চয়তা রয়েছে। সবচেয়ে খারাপ পরিস্থিতিতে আপনাকে এখানে দেখানো পরিমাণের চেয়ে বেশি দিতে হতে পারে। অনুগ্রহ করে বিস্তারিত একজন রাশিয়ান কর বিশেষজ্ঞের সাথে নিশ্চিত করুন।",
      lo: "⚠️ ໃນປີ 2023, ຣັດເຊຍໄດ້ໂຈະສ່ວນສຳຄັນຂອງສົນທິສັນຍາພາສີກັບສະຫະລັດ (ລວມທັງການບັນເທົາການເກັບພາສີຊ້ຳຊ້ອນ). ອັດຕາ 22% ເອງມີການບັນທຶກໄວ້ຢ່າງດີ. ກົດໝາຍພາສີຣັດເຊຍຮັບຮູ້ສິດຂອງບຸກຄົນໃນການຫຼຸດພາສີ, ແຕ່ເນື່ອງຈາກສົນທິສັນຍາລະຫວ່າງສອງປະເທດຖືກໂຈະຢ່າງເປັນທາງການ, ຈຶ່ງຍັງມີຄວາມບໍ່ແນ່ນອນວ່າອົງການພາສີຣັດເຊຍຈະຈັດການເລື່ອງນີ້ແນວໃດໃນທາງປະຕິບັດ. ໃນກໍລະນີທີ່ຮ້າຍແຮງທີ່ສຸດທ່ານອາດຕ້ອງຈ່າຍຫຼາຍກວ່າທີ່ສະແດງໄວ້ນີ້. ກະລຸນາຢືນຢັນລາຍລະອຽດກັບຜູ້ຊ່ຽວຊານດ້ານພາສີຣັດເຊຍ.",
      ja: "⚠️ 2023年、ロシアは米国との租税条約の主要部分（二重課税の救済を含む）を停止しました。22%という税率自体はよく裏付けられています。ロシアの税法は個人の減税を受ける権利を認めていますが、両国間の条約が正式に停止されているため、ロシアの税務当局が実際にこれをどう扱うかにはまだ不確実性があります。最悪の場合、ここに表示されている額より多く支払うことになる可能性があります。詳細はロシアの税務専門家にご確認ください。",
      ar: "⚠️ في عام 2023، علّقت روسيا أجزاءً رئيسية من معاهدتها الضريبية مع الولايات المتحدة (بما في ذلك الإعفاء من الازدواج الضريبي). معدل الـ22% نفسه موثق جيدًا. يعترف قانون الضرائب الروسي بحق الأفراد في تخفيض الضريبة، ولكن نظرًا لأن المعاهدة بين البلدين معلّقة رسميًا، لا يزال هناك عدم يقين حول كيفية تعامل السلطة الضريبية الروسية مع هذا الأمر عمليًا. في أسوأ الحالات، قد تدفع أكثر مما هو موضح هنا. يرجى تأكيد التفاصيل مع متخصص ضرائب روسي.",
      hi: "⚠️ 2023 में, रूस ने अमेरिका के साथ अपनी कर संधि के प्रमुख हिस्सों (दोहरे कराधान राहत सहित) को निलंबित कर दिया। 22% की दर स्वयं अच्छी तरह से दस्तावेज़ीकृत है। रूसी कर कानून व्यक्तियों के कर कटौती के अधिकार को मान्यता देता है, लेकिन चूंकि दोनों देशों के बीच संधि आधिकारिक रूप से निलंबित है, इसलिए रूस का कर प्राधिकरण व्यवहार में इसे कैसे संभालता है, इसमें अभी भी अनिश्चितता है। सबसे बुरी स्थिति में आपको यहां दिखाई गई राशि से अधिक चुकाना पड़ सकता है। कृपया विवरण एक रूसी कर विशेषज्ञ से पुष्टि करें।",
      fr: "⚠️ En 2023, la Russie a suspendu des parties clés de son traité fiscal avec les États-Unis (y compris l'allègement de la double imposition). Le taux de 22 % lui-même est bien documenté. Le droit fiscal russe reconnaît le droit des particuliers à une réduction d'impôt, mais comme le traité entre les deux pays est officiellement suspendu, il existe encore une incertitude quant à la manière dont l'administration fiscale russe gère cela en pratique. Dans le pire des cas, vous pourriez devoir payer plus que ce qui est indiqué ici. Veuillez confirmer les détails auprès d'un professionnel de la fiscalité russe.",
      tl: "⚠️ Noong 2023, isinuspinde ng Russia ang mahahalagang bahagi ng kasunduan nito sa buwis sa US (kabilang ang double-taxation relief). Ang rate na 22% mismo ay maayos na nadokumentuhan. Kinikilala ng batas sa buwis ng Russia ang karapatan ng mga indibidwal sa pagbawas ng buwis, ngunit dahil opisyal na nakasuspinde ang kasunduan sa pagitan ng dalawang bansa, mayroon pa ring kawalan ng katiyakan kung paano ito haharapin ng awtoridad sa buwis ng Russia sa praktika. Sa pinakamasamang kaso, maaaring kailanganin mong magbayad ng higit pa sa ipinapakita rito. Mangyaring kumpirmahin ang mga detalye sa isang propesyonal sa buwis ng Russia."
    }
  ),
  pk: () => pickLang(
    '⚠️ 파키스탄은 복권 당첨금에 대한 법(20~40%)이 있지만, 이건 파키스탄 안에서 지급하는 경우를 전제로 한 규정이라 미국에서 직접 받는 당첨금에도 그대로 적용되는지 명확하지 않아요. 여기 나온 세금은 일반 소득세 최고세율(35%)로 추정한 참고치예요. 여기에 더해, 잭팟 규모 당첨금은 소득 5억 루피 초과분에 붙는 Super Tax(제4C조, 2026-07 Finance Act 기준 8%)와 세액 기준 서차지(10%)까지 함께 부과돼요. 정확한 처리는 파키스탄 국세청(FBR)이나 세무 전문가에게 확인하세요.',
    '⚠️ Pakistan has a specific law for lottery prizes (20–40%), but it assumes the payer is based in Pakistan, so it’s unclear whether it applies to winnings paid directly from the US. The tax shown here is an estimate based on the top general income tax rate (35%). On top of that, a jackpot-sized win also triggers Pakistan’s Super Tax (Section 4C, 8% above PKR 500 million in taxable income per the July 2026 Finance Act) and a surcharge (10% of the tax amount). Please confirm with Pakistan’s Federal Board of Revenue (FBR) or a tax professional.',
    '⚠️ 巴基斯坦对彩票奖金有专门规定（20%~40%），但该规定以巴基斯坦境内支付方为前提，是否适用于从美国直接领取的奖金尚不明确。这里显示的税额是按一般所得税最高税率（35%）估算的参考值。此外，头奖规模的奖金还会触发Super Tax（第4C条，根据2026年7月Finance Act为应税所得超过5亿卢比部分的8%）和按税额计算的附加税（10%）。请务必向巴基斯坦联邦税务局（FBR）或税务专家确认。',
    '⚠️ Pakistan có luật riêng cho tiền thưởng xổ số (20–40%), nhưng luật này giả định bên chi trả ở Pakistan, nên chưa rõ có áp dụng cho tiền thắng nhận trực tiếp từ Mỹ hay không. Số thuế hiển thị ở đây là ước tính theo thuế suất thu nhập chung cao nhất (35%). Ngoài ra, tiền thắng cỡ jackpot còn phát sinh Super Tax (Điều 4C, 8% trên phần thu nhập chịu thuế vượt 500 triệu Rupee theo Finance Act tháng 7/2026) và phụ thu 10% tính trên số thuế. Vui lòng xác nhận với Cục Thuế Liên bang Pakistan (FBR) hoặc chuyên gia thuế.',
    '⚠️ ปากีสถานมีกฎหมายเฉพาะสำหรับเงินรางวัลลอตเตอรี (20–40%) แต่กฎหมายนี้อ้างอิงกรณีผู้จ่ายอยู่ในปากีสถาน จึงยังไม่ชัดเจนว่าจะใช้กับเงินรางวัลที่ได้รับโดยตรงจากสหรัฐฯ หรือไม่ ภาษีที่แสดงนี้เป็นค่าประมาณจากอัตราภาษีเงินได้ทั่วไปสูงสุด (35%) นอกจากนี้ เงินรางวัลระดับแจ็คพอตยังมี Super Tax (มาตรา 4C, 8% ของรายได้ที่ต้องเสียภาษีส่วนที่เกิน 500 ล้านรูปี ตาม Finance Act เดือนกรกฎาคม 2026) และเงินเพิ่ม 10% ของภาษีอีกด้วย กรุณายืนยันกับคณะกรรมการรายได้กลางปากีสถาน (FBR) หรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ В Пакистане есть отдельный закон о лотерейных призах (20–40%), но он рассчитан на случай, когда плательщик находится в Пакистане, поэтому неясно, применяется ли он к выигрышу, полученному напрямую из США. Показанный здесь налог — оценка по максимальной обычной ставке подоходного налога (35%). Вдобавок, выигрыш джекпот-уровня также подпадает под пакистанский Super Tax (статья 4C, 8% с облагаемого дохода свыше 500 млн рупий согласно Finance Act от июля 2026 года) и надбавку (10% от суммы налога). Уточните детали в Федеральном налоговом управлении Пакистана (FBR) или у налогового специалиста.',
    {
      km: "⚠️ ប៉ាគីស្ថានមានច្បាប់ជាក់លាក់សម្រាប់រង្វាន់ឆ្នោត (20–40%) ប៉ុន្តែសន្មតថាអ្នកបង់ប្រាក់មានទីតាំងនៅប៉ាគីស្ថាន ដូច្នេះមិនច្បាស់ថាតើវាអនុវត្តចំពោះប្រាក់រង្វាន់ដែលបង់ដោយផ្ទាល់ពីសហរដ្ឋអាមេរិកដែរឬទេ។ ពន្ធដែលបង្ហាញនៅទីនេះជាការប៉ាន់ស្មានផ្អែកលើអត្រាពន្ធលើប្រាក់ចំណូលទូទៅកំពូល (35%)។ បន្ថែមពីនេះ ប្រាក់រង្វាន់ថ្នាក់ jackpot ក៏បង្កឱ្យមាន Super Tax របស់ប៉ាគីស្ថាន (មាត្រា 4C, 8% លើប្រាក់ចំណូលជាប់ពន្ធលើសពី 500 លាន PKR យោងតាម Finance Act ខែកក្កដា 2026) និងបន្ទុកបន្ថែម (10% នៃចំនួនពន្ធ)។ សូមបញ្ជាក់ជាមួយក្រុមប្រឹក្សាចំណូលសហព័ន្ធប៉ាគីស្ថាន (FBR) ឬអ្នកជំនាញពន្ធ។",
      ne: "⚠️ पाकिस्तानसँग लटरी पुरस्कारका लागि विशेष कानून (20–40%) छ, तर यसले भुक्तानीकर्ता पाकिस्तानमा आधारित छ भनी मान्दछ, त्यसैले यो अमेरिकाबाट सिधै भुक्तानी गरिएको जितमा लागू हुन्छ कि हुँदैन स्पष्ट छैन। यहाँ देखाइएको कर सामान्य आयकरको उच्चतम दर (35%) मा आधारित अनुमान हो। यसमाथि, ज्याकपोट आकारको जितले पाकिस्तानको Super Tax (धारा 4C, जुलाई 2026 Finance Act अनुसार कर योग्य आयमा PKR 500 मिलियनभन्दा माथि 8%) र अधिभार (कर रकमको 10%) पनि निम्त्याउँछ। कृपया पाकिस्तानको संघीय राजस्व बोर्ड (FBR) वा कर विशेषज्ञसँग पुष्टि गर्नुहोस्।",
      id: "⚠️ Pakistan memiliki undang-undang khusus untuk hadiah lotre (20–40%), tetapi ini mengasumsikan pembayar berbasis di Pakistan, sehingga tidak jelas apakah ini berlaku untuk kemenangan yang dibayarkan langsung dari AS. Pajak yang ditampilkan di sini adalah perkiraan berdasarkan tarif pajak penghasilan umum tertinggi (35%). Selain itu, kemenangan sebesar jackpot juga memicu Super Tax Pakistan (Pasal 4C, 8% di atas PKR 500 juta penghasilan kena pajak menurut Finance Act Juli 2026) dan biaya tambahan (10% dari jumlah pajak). Harap konfirmasi dengan Dewan Pendapatan Federal Pakistan (FBR) atau profesional pajak.",
      my: "⚠️ ပါကစ္စတန်တွင် ထီဆုများအတွက် အထူးဥပဒေ (20–40%) ရှိသော်လည်း ၎င်းသည် ငွေပေးချေသူ ပါကစ္စတန်တွင် အခြေစိုက်သည်ဟု ယူဆထားသဖြင့် အမေရိကန်မှ တိုက်ရိုက်ပေးချေသော ဆုငွေများတွင် သက်ဆိုင်မည်ဆိုသည်မှာ မရှင်းလင်းပါ။ ဤတွင်ပြသထားသော အခွန်သည် အထွေထွေဝင်ငွေခွန် အမြင့်ဆုံးနှုန်း (35%) ကို အခြေခံ၍ ခန့်မှန်းထားခြင်းဖြစ်သည်။ ထို့အပြင် jackpot အရွယ်အစား ဆုငွေသည် ပါကစ္စတန်၏ Super Tax (အပိုဒ် 4C၊ ဇူလိုင် 2026 Finance Act အရ အခွန်ဆောင်ရမည့်ဝင်ငွေ PKR 500 သန်းအထက် 8%) နှင့် အပိုဆောင်းခွန် (အခွန်ပမာဏ၏ 10%) ကိုပါ ဖြစ်ပေါ်စေသည်။ ပါကစ္စတန် ဖက်ဒရယ်ဝင်ငွေဘုတ်အဖွဲ့ (FBR) သို့မဟုတ် အခွန်ကျွမ်းကျင်သူနှင့် အတည်ပြုပါ။",
      si: "⚠️ පකිස්ථානයට ලොතරැයි ත්‍යාග සඳහා විශේෂිත නීතියක් (20–40%) ඇති නමුත් එය ගෙවන්නා පකිස්ථානයේ පදනම් වී ඇති බව උපකල්පනය කරයි, එබැවින් එය එක්සත් ජනපදයෙන් කෙලින්ම ගෙවනු ලබන ජයග්‍රහණවලට අදාළ වේද යන්න පැහැදිලි නැත. මෙහි පෙන්වා ඇති බද්ද සාමාන්‍ය ආදායම් බදු ඉහළම අනුපාතය (35%) මත පදනම් වූ ඇස්තමේන්තුවකි. මීට අමතරව, ජැක්පොට් ප්‍රමාණයේ ජයග්‍රහණයක් පකිස්ථානයේ Super Tax (වගන්තිය 4C, 2026 ජූලි Finance Act අනුව බදු අය කළ හැකි ආදායමින් PKR මිලියන 500ට වැඩි ප්‍රමාණයට 8%) සහ අතිරේක ගාස්තුවක් (බදු ප්‍රමාණයෙන් 10%) ද අවුස්සයි. කරුණාකර පකිස්ථාන ෆෙඩරල් ආදායම් මණ්ඩලය (FBR) හෝ බදු වෘත්තිකයෙකු සමඟ තහවුරු කරන්න.",
      uz: "⚠️ Pokistonda lotereya sovrinlari uchun maxsus qonun (20–40%) mavjud, lekin bu to'lovchi Pokistonda joylashgan deb faraz qiladi, shuning uchun bu AQShdan to'g'ridan-to'g'ri to'lanadigan yutuqlarga tegishlimi yoki yo'qmi aniq emas. Bu yerda ko'rsatilgan soliq umumiy daromad solig'ining eng yuqori stavkasi (35%) asosida taxmin qilingan. Bundan tashqari, jackpot hajmidagi yutuq Pokistonning Super Tax solig'ini ham keltirib chiqaradi (4C bandi, 2026-yil iyul Finance Act ga ko'ra soliqqa tortiladigan daromadning 500 million PKRdan yuqori qismiga 8%) va ustama to'lov (soliq summasining 10%). Iltimos, Pokiston Federal daromadlar kengashi (FBR) yoki soliq mutaxassisi bilan tasdiqlang.",
      mn: "⚠️ Пакистанд сугалааны шагналд зориулсан тусгай хууль (20–40%) байдаг ч энэ нь төлбөр төлөгч Пакистанд байрладаг гэж үздэг тул АНУ-аас шууд төлсөн ялалтад хэрэглэгддэг эсэх нь тодорхойгүй. Энд харуулсан татвар нь ерөнхий орлогын албан татварын дээд хувь (35%)-д үндэслэсэн тооцоо юм. Үүнээс гадна jackpot хэмжээний ялалт нь Пакистаны Super Tax (4C зүйл, 2026 оны 7-р сарын Finance Act-ийн дагуу татвар ногдуулах орлогын 500 сая PKR-ээс дээш хэсэгт 8%) болон нэмэлт төлбөр (татварын дүнгийн 10%)-ийг мөн үүсгэдэг. Пакистаны Холбооны орлогын зөвлөл (FBR) эсвэл татварын мэргэжилтэнтэй баталгаажуулна уу.",
      kk: "⚠️ Пәкістанда лотерея сыйлықтары үшін арнайы заң (20–40%) бар, бірақ ол төлеуші Пәкістанда орналасқан деп болжайды, сондықтан ол АҚШ-тан тікелей төленетін ұтыстарға қолданыла ма, белгісіз. Мұнда көрсетілген салық жалпы табыс салығының ең жоғары мөлшерлемесіне (35%) негізделген болжам. Оған қоса, jackpot мөлшеріндегі ұтыс Пәкістанның Super Tax салығын да тудырады (4C бабы, 2026 жылғы шілдедегі Finance Act бойынша салық салынатын табыстың 500 миллион PKR-ден асатын бөлігіне 8%) және үстеме ақы (салық сомасының 10%). Пәкістанның Федералды кірістер кеңесімен (FBR) немесе салық маманымен растаңыз.",
      ky: "⚠️ Пакистанда лотерея сыйлыктары үчүн атайын мыйзам (20–40%) бар, бирок ал төлөөчү Пакистанда жайгашкан деп болжолдойт, ошондуктан ал АКШдан түз төлөнгөн утуштарга колдонуларын же колдонулбасын так эмес. Бул жерде көрсөтүлгөн салык жалпы киреше салыгынын эң жогорку чени (35%) боюнча болжол. Мындан тышкары, jackpot өлчөмүндөгү утуш Пакистандын Super Tax салыгын да пайда кылат (4C беренеси, 2026-жылдын июлундагы Finance Act боюнча салык салынуучу кирешенин 500 миллион PKRдан ашкан бөлүгүнө 8%) жана кошумча төлөм (салык суммасынын 10%). Пакистандын Федералдык кирешелер кеңеши (FBR) же салык боюнча адис менен тактаңыз.",
      ur: "⚠️ پاکستان میں لاٹری انعامات کے لیے مخصوص قانون (20–40%) موجود ہے، لیکن یہ فرض کرتا ہے کہ ادائیگی کرنے والا پاکستان میں مقیم ہے، اس لیے یہ واضح نہیں کہ آیا یہ امریکہ سے براہ راست ادا کی گئی جیت پر لاگو ہوتا ہے۔ یہاں دکھایا گیا ٹیکس عام انکم ٹیکس کی سب سے زیادہ شرح (35%) پر مبنی تخمینہ ہے۔ اس کے علاوہ، جیک پاٹ سائز کی جیت پاکستان کے Super Tax (سیکشن 4C، جولائی 2026 کے Finance Act کے مطابق قابل ٹیکس آمدنی میں PKR 500 ملین سے زائد پر 8%) اور ایک اضافی چارج (ٹیکس رقم کا 10%) کو بھی متحرک کرتی ہے۔ براہ کرم پاکستان کے وفاقی ریونیو بورڈ (FBR) یا ٹیکس ماہر سے تصدیق کریں۔",
      bn: "⚠️ পাকিস্তানের লটারি পুরস্কারের জন্য একটি নির্দিষ্ট আইন (২০–৪০%) রয়েছে, তবে এটি ধরে নেয় যে প্রদানকারী পাকিস্তানে অবস্থিত, তাই এটি মার্কিন যুক্তরাষ্ট্র থেকে সরাসরি প্রদত্ত জয়ের ক্ষেত্রে প্রযোজ্য কিনা তা স্পষ্ট নয়। এখানে দেখানো করটি সাধারণ আয়করের সর্বোচ্চ হারের (৩৫%) উপর ভিত্তি করে একটি অনুমান। এছাড়াও, জ্যাকপট আকারের জয় পাকিস্তানের Super Tax (ধারা ৪C, জুলাই ২০২৬ Finance Act অনুযায়ী করযোগ্য আয়ে PKR ৫০০ মিলিয়নের বেশি অংশে ৮%) এবং একটি সারচার্জ (কর পরিমাণের ১০%) ও সৃষ্টি করে। অনুগ্রহ করে পাকিস্তানের ফেডারেল বোর্ড অফ রেভিনিউ (FBR) বা কর বিশেষজ্ঞের সাথে নিশ্চিত করুন।",
      lo: "⚠️ ປາກີສະຖານມີກົດໝາຍສະເພາະສຳລັບລາງວັນລອດເຕີຣີ (20–40%) ແຕ່ສົມມຸດວ່າຜູ້ຈ່າຍຢູ່ໃນປາກີສະຖານ, ດັ່ງນັ້ນຈຶ່ງບໍ່ຊັດເຈນວ່າຈະໃຊ້ກັບເງິນລາງວັນທີ່ຈ່າຍໂດຍກົງຈາກສະຫະລັດຫຼືບໍ່. ພາສີທີ່ສະແດງຢູ່ນີ້ແມ່ນການຄາດຄະເນໂດຍອີງໃສ່ອັດຕາພາສີເງິນໄດ້ທົ່ວໄປສູງສຸດ (35%). ນອກຈາກນັ້ນ, ເງິນລາງວັນລະດັບແຈັກພອດຍັງກໍ່ໃຫ້ເກີດ Super Tax ຂອງປາກີສະຖານ (ມາດຕາ 4C, 8% ຂອງລາຍໄດ້ທີ່ຕ້ອງເສຍພາສີເກີນ 500 ລ້ານ PKR ຕາມ Finance Act ເດືອນກໍລະກົດ 2026) ແລະຄ່າທຳນຽມເພີ່ມ (10% ຂອງຈຳນວນພາສີ). ກະລຸນາຢືນຢັນກັບຄະນະກຳມະການລາຍໄດ້ກາງປາກີສະຖານ (FBR) ຫຼື ຜູ້ຊ່ຽວຊານດ້ານພາສີ.",
      ja: "⚠️ パキスタンには宝くじ賞金に関する特別法（20〜40%）がありますが、これは支払者がパキスタンを拠点としていることを前提としているため、米国から直接支払われる当選金に適用されるかどうかは不明です。ここに表示されている税額は一般所得税の最高税率（35%）に基づく推定値です。さらに、ジャックポット規模の当選はパキスタンのSuper Tax（第4C条、2026年7月Finance Actにより課税所得5億PKR超の部分に8%）と付加税（税額の10%）も発生させます。パキスタン連邦歳入庁（FBR）または税務専門家にご確認ください。",
      ar: "⚠️ لدى باكستان قانون خاص بجوائز اليانصيب (20–40%)، لكنه يفترض أن الجهة الدافعة موجودة في باكستان، لذا من غير الواضح ما إذا كان ينطبق على الأرباح المدفوعة مباشرة من الولايات المتحدة. الضريبة المعروضة هنا هي تقدير استنادًا إلى أعلى معدل عام لضريبة الدخل (35%). بالإضافة إلى ذلك، فإن الفوز بحجم الجاكبوت يؤدي أيضًا إلى تفعيل ضريبة Super Tax الباكستانية (المادة 4C، 8% على الدخل الخاضع للضريبة الذي يتجاوز 500 مليون روبية باكستانية وفقًا لقانون المالية الصادر في يوليو 2026) ورسم إضافي (10% من مبلغ الضريبة). يرجى التأكيد مع مجلس الإيرادات الفيدرالي الباكستاني (FBR) أو أحد المتخصصين الضريبيين.",
      hi: "⚠️ पाकिस्तान में लॉटरी पुरस्कारों के लिए एक विशिष्ट कानून (20–40%) है, लेकिन यह मानता है कि भुगतानकर्ता पाकिस्तान में स्थित है, इसलिए यह स्पष्ट नहीं है कि यह अमेरिका से सीधे भुगतान की गई जीत पर लागू होता है या नहीं। यहां दिखाया गया कर सामान्य आयकर की उच्चतम दर (35%) पर आधारित अनुमान है। इसके अतिरिक्त, जैकपॉट आकार की जीत पाकिस्तान के Super Tax (धारा 4C, जुलाई 2026 Finance Act के अनुसार कर योग्य आय में PKR 500 मिलियन से अधिक पर 8%) और अधिभार (कर राशि का 10%) को भी ट्रिगर करती है। कृपया पाकिस्तान के संघीय राजस्व बोर्ड (FBR) या कर विशेषज्ञ से पुष्टि करें।",
      fr: "⚠️ Le Pakistan dispose d'une loi spécifique pour les prix de loterie (20–40 %), mais elle suppose que le payeur est basé au Pakistan, donc on ne sait pas clairement si elle s'applique aux gains payés directement depuis les États-Unis. L'impôt indiqué ici est une estimation basée sur le taux d'imposition général sur le revenu le plus élevé (35 %). De plus, un gain de la taille d'un jackpot déclenche également la Super Tax du Pakistan (Section 4C, 8 % au-delà de 500 millions PKR de revenu imposable selon la loi de finances de juillet 2026) et une surtaxe (10 % du montant de l'impôt). Veuillez confirmer auprès du Conseil fédéral des recettes du Pakistan (FBR) ou d'un professionnel de la fiscalité.",
      tl: "⚠️ May partikular na batas ang Pakistan para sa mga premyo sa lottery (20–40%), ngunit ipinapalagay nito na ang nagbabayad ay nakabase sa Pakistan, kaya hindi malinaw kung nalalapat ito sa mga panalong direktang binayaran mula sa US. Ang buwis na ipinapakita dito ay isang pagtatantiya batay sa pinakamataas na pangkalahatang income tax rate (35%). Bukod dito, ang panalong kasing laki ng jackpot ay nagti-trigger din ng Super Tax ng Pakistan (Seksyon 4C, 8% sa itaas ng PKR 500 milyon na taxable income ayon sa Finance Act ng Hulyo 2026) at isang surcharge (10% ng halaga ng buwis). Mangyaring kumpirmahin sa Federal Board of Revenue ng Pakistan (FBR) o isang propesyonal sa buwis."
    }
  ),
  kh: () => pickLang(
    '⚠️ 캄보디아 세법에서는 복권 당첨 같은 개인 소득에 매기는 명확한 조항을 찾지 못했어요. 그래서 이 계산기는 캄보디아 추가 세금을 0원으로 가정하고 있는데, 실제로는 세금이 부과될 수도 있어요. 정확한 처리는 캄보디아 국세청(GDT)이나 세무 전문가에게 반드시 확인하세요.',
    '⚠️ We couldn’t find a clear provision in Cambodian tax law covering personal windfall income like lottery winnings. This calculator therefore assumes ₩0 additional Cambodian tax, but you could still owe tax in reality. Please confirm with Cambodia’s General Department of Taxation (GDT) or a tax professional.',
    '⚠️ 未能在柬埔寨税法中找到针对彩票中奖等个人意外所得的明确条款。因此本计算器暂按柬埔寨追加税额为0韩元计算，但实际仍可能需要纳税。请务必向柬埔寨税务总局（GDT）或税务专家确认。',
    '⚠️ Chúng tôi không tìm thấy quy định rõ ràng trong luật thuế Campuchia về thu nhập bất ngờ cá nhân như trúng số. Vì vậy máy tính này giả định thuế bổ sung tại Campuchia là 0 won, nhưng thực tế bạn vẫn có thể phải đóng thuế. Vui lòng xác nhận với Tổng cục Thuế Campuchia (GDT) hoặc chuyên gia thuế.',
    '⚠️ เราไม่พบข้อกำหนดที่ชัดเจนในกฎหมายภาษีกัมพูชาเกี่ยวกับรายได้ที่ไม่คาดคิดส่วนบุคคล เช่น เงินรางวัลลอตเตอรี เครื่องคำนวณนี้จึงสมมติว่าภาษีเพิ่มเติมของกัมพูชาเป็น 0 วอน แต่ในความเป็นจริงคุณอาจยังต้องเสียภาษี กรุณายืนยันกับกรมสรรพากรกัมพูชา (GDT) หรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ Мы не смогли найти в налоговом законодательстве Камбоджи чёткого положения о случайном личном доходе, например, о лотерейном выигрыше. Поэтому калькулятор считает дополнительный камбоджийский налог равным 0 вон, но на практике налог всё же может взиматься. Уточните детали в Генеральном департаменте налогообложения Камбоджи (GDT) или у налогового специалиста.',
    {
      km: "⚠️ យើងមិនអាចរកឃើញបទប្បញ្ញត្តិច្បាស់លាស់នៅក្នុងច្បាប់ពន្ធកម្ពុជាដែលគ្របដណ្តប់លើប្រាក់ចំណូលចៃដន្យផ្ទាល់ខ្លួនដូចជាការឈ្នះឆ្នោតនោះទេ។ ដូច្នេះម៉ាស៊ីនគណនានេះសន្មតថាពន្ធកម្ពុជាបន្ថែមគឺ ₩0 ប៉ុន្តែជាក់ស្តែងអ្នកអាចនៅតែជំពាក់ពន្ធ។ សូមបញ្ជាក់ជាមួយអគ្គនាយកដ្ឋានពន្ធដារកម្ពុជា (GDT) ឬអ្នកជំនាញពន្ធ។",
      ne: "⚠️ हामीले कम्बोडियाली कर कानूनमा लटरी जित्ने जस्ता व्यक्तिगत आकस्मिक आयलाई समेट्ने स्पष्ट प्रावधान फेला पार्न सकेनौं। त्यसैले यो क्यालकुलेटरले थप कम्बोडियाली कर ₩0 मानेको छ, तर वास्तविकतामा तपाईंले अझै कर तिर्नुपर्ने हुन सक्छ। कृपया कम्बोडियाको सामान्य कर विभाग (GDT) वा कर विशेषज्ञसँग पुष्टि गर्नुहोस्।",
      id: "⚠️ Kami tidak menemukan ketentuan yang jelas dalam hukum pajak Kamboja yang mencakup penghasilan tak terduga pribadi seperti kemenangan lotre. Oleh karena itu, kalkulator ini mengasumsikan pajak tambahan Kamboja sebesar ₩0, tetapi Anda tetap bisa berutang pajak dalam kenyataannya. Harap konfirmasi dengan Direktorat Jenderal Pajak Kamboja (GDT) atau profesional pajak.",
      my: "⚠️ ကမ္ဘောဒီးယားအခွန်ဥပဒေတွင် ထီပေါက်ငွေကဲ့သို့သော ပုဂ္ဂိုလ်ရေးမမျှော်လင့်ဘဲရရှိသောဝင်ငွေကို လွှမ်းခြုံသည့် ရှင်းလင်းသောပြဋ္ဌာန်းချက်ကို ကျွန်ုပ်တို့ ရှာမတွေ့ခဲ့ပါ။ ထို့ကြောင့် ဤတွက်ချက်စက်သည် ကမ္ဘောဒီးယားအပိုအခွန်ကို ₩0 ဟု ယူဆထားသော်လည်း လက်တွေ့တွင် အခွန်ဆက်လက်ကျန်ရှိနိုင်ပါသည်။ ကမ္ဘောဒီးယားအခွန်ညွှန်ကြားမှုဦးစီးချုပ်ဌာန (GDT) သို့မဟုတ် အခွန်ကျွမ်းကျင်သူနှင့် အတည်ပြုပါ။",
      si: "⚠️ ලොතරැයි ජයග්‍රහණ වැනි පුද්ගලික අනපේක්ෂිත ආදායම ආවරණය කරන පැහැදිලි විධිවිධානයක් කාම්බෝජ බදු නීතියේ අපට සොයාගත නොහැකි විය. එබැවින් මෙම ගණකයන්ත්‍රය අතිරේක කාම්බෝජ බද්ද ₩0 ලෙස උපකල්පනය කරයි, නමුත් ඇත්ත වශයෙන්ම ඔබට තවමත් බදු ගෙවීමට සිදුවිය හැක. කරුණාකර කාම්බෝජ පොදු බදු දෙපාර්තමේන්තුව (GDT) හෝ බදු වෘත්තිකයෙකු සමඟ තහවුරු කරන්න.",
      uz: "⚠️ Kambodja soliq qonunchiligida lotereya yutuqlari kabi shaxsiy kutilmagan daromadni qamrab oluvchi aniq qoidani topa olmadik. Shuning uchun bu kalkulyator qo'shimcha Kambodja solig'ini ₩0 deb faraz qiladi, lekin aslida sizdan hali ham soliq talab qilinishi mumkin. Iltimos, Kambodja Soliqlar bosh boshqarmasi (GDT) yoki soliq mutaxassisi bilan tasdiqlang.",
      mn: "⚠️ Сугалааны ялалт зэрэг хувь хүний гэнэтийн орлогыг хамарсан тодорхой заалтыг Камбожийн татварын хуулиас бид олж чадсангүй. Тиймээс энэ тооцоолуур нэмэлт Камбожийн татварыг ₩0 гэж үзэж байгаа ч бодит байдал дээр та татвар төлөх шаардлагатай байж болно. Камбожийн Татварын ерөнхий газар (GDT) эсвэл татварын мэргэжилтэнтэй баталгаажуулна уу.",
      kk: "⚠️ Камбоджа салық заңнамасынан лотерея ұтысы сияқты жеке кездейсоқ табысты қамтитын нақты ережені таба алмадық. Сондықтан бұл калькулятор қосымша Камбоджа салығын ₩0 деп есептейді, бірақ іс жүзінде сізден әлі де салық талап етілуі мүмкін. Камбоджаның Салық жөніндегі бас департаментімен (GDT) немесе салық маманымен растаңыз.",
      ky: "⚠️ Камбожа салык мыйзамынан лотерея утушу сыяктуу жеке күтүлбөгөн кирешени камтыган так жобону таба алган жокпуз. Ошондуктан бул эсептегич кошумча Камбожа салыгын ₩0 деп эсептейт, бирок чындыгында сизден дагы деле салык талап кылынышы мүмкүн. Камбожанын Салык башкы департаменти (GDT) же салык боюнча адис менен тактаңыз.",
      ur: "⚠️ ہمیں کمبوڈیا کے ٹیکس قانون میں لاٹری جیت جیسی ذاتی غیر متوقع آمدنی کا احاطہ کرنے والی کوئی واضح شق نہیں ملی۔ اس لیے یہ کیلکولیٹر اضافی کمبوڈین ٹیکس ₩0 فرض کرتا ہے، لیکن حقیقت میں آپ کو پھر بھی ٹیکس دینا پڑ سکتا ہے۔ براہ کرم کمبوڈیا کے جنرل ڈیپارٹمنٹ آف ٹیکسیشن (GDT) یا ٹیکس ماہر سے تصدیق کریں۔",
      bn: "⚠️ লটারি জয়ের মতো ব্যক্তিগত অপ্রত্যাশিত আয় কভার করার জন্য কম্বোডিয়ার কর আইনে কোনো স্পষ্ট বিধান আমরা খুঁজে পাইনি। তাই এই ক্যালকুলেটরটি অতিরিক্ত কম্বোডিয়ান কর ₩০ ধরে নেয়, তবে বাস্তবে আপনাকে এখনও কর দিতে হতে পারে। অনুগ্রহ করে কম্বোডিয়ার জেনারেল ডিপার্টমেন্ট অফ ট্যাক্সেশন (GDT) বা কর বিশেষজ্ঞের সাথে নিশ্চিত করুন।",
      lo: "⚠️ ພວກເຮົາບໍ່ພົບຂໍ້ກຳນົດທີ່ຊັດເຈນໃນກົດໝາຍພາສີກຳປູເຈຍທີ່ກວມເອົາລາຍໄດ້ທີ່ບໍ່ຄາດຄິດສ່ວນບຸກຄົນເຊັ່ນເງິນລາງວັນລອດເຕີຣີ. ດັ່ງນັ້ນເຄື່ອງຄິດໄລ່ນີ້ຈຶ່ງສົມມຸດວ່າພາສີເພີ່ມເຕີມຂອງກຳປູເຈຍເປັນ ₩0 ແຕ່ໃນຄວາມເປັນຈິງທ່ານອາດຍັງຕ້ອງເສຍພາສີ. ກະລຸນາຢືນຢັນກັບກົມສ່ວຍສາອາກອນທົ່ວໄປກຳປູເຈຍ (GDT) ຫຼື ຜູ້ຊ່ຽວຊານດ້ານພາສີ.",
      ja: "⚠️ 宝くじ当選金のような個人の予期せぬ収入を対象とする明確な規定は、カンボジアの税法には見つかりませんでした。そのため、この計算機は追加のカンボジア税を₩0と仮定していますが、実際には課税される可能性があります。カンボジア税務総局（GDT）または税務専門家にご確認ください。",
      ar: "⚠️ لم نتمكن من العثور على نص واضح في قانون الضرائب الكمبودي يغطي الدخل الشخصي غير المتوقع مثل أرباح اليانصيب. لذلك تفترض هذه الآلة الحاسبة أن الضريبة الكمبودية الإضافية تساوي 0 وون، لكن قد تظل مدينًا بضريبة في الواقع. يرجى التأكيد مع الإدارة العامة للضرائب في كمبوديا (GDT) أو أحد المتخصصين الضريبيين.",
      hi: "⚠️ हमें कंबोडियाई कर कानून में लॉटरी जीत जैसी व्यक्तिगत अप्रत्याशित आय को कवर करने वाला कोई स्पष्ट प्रावधान नहीं मिला। इसलिए यह कैलकुलेटर अतिरिक्त कंबोडियाई कर को ₩0 मानता है, लेकिन वास्तव में आपको अभी भी कर देना पड़ सकता है। कृपया कंबोडिया के सामान्य कराधान विभाग (GDT) या कर विशेषज्ञ से पुष्टि करें।",
      fr: "⚠️ Nous n'avons trouvé aucune disposition claire dans le droit fiscal cambodgien couvrant les revenus personnels exceptionnels comme les gains de loterie. Ce calculateur suppose donc un impôt cambodgien supplémentaire de 0 ₩, mais vous pourriez tout de même devoir payer des impôts en réalité. Veuillez confirmer auprès de la Direction générale des impôts du Cambodge (GDT) ou d'un professionnel de la fiscalité.",
      tl: "⚠️ Hindi kami nakahanap ng malinaw na probisyon sa batas sa buwis ng Cambodia na sumasaklaw sa personal na hindi inaasahang kita tulad ng panalo sa lottery. Kaya ipinapalagay ng calculator na ito na ang karagdagang buwis sa Cambodia ay ₩0, ngunit maaari ka pa ring may utang na buwis sa katotohanan. Mangyaring kumpirmahin sa General Department of Taxation ng Cambodia (GDT) o isang propesyonal sa buwis."
    }
  ),
  mn: () => pickLang(
    '⚠️ 몽골법의 도박·베팅성 당첨소득 40% 조항은 2025년 국내 베팅·도박 사업 금지 때 함께 폐지됐어요. 해외 복권 당첨금을 명시한 대체 조항을 찾지 못해, 가장 근접해 보이는 기타소득 단일세율(10%)을 잠정 적용한 참고치예요. 정확한 처리는 몽골 국세청이나 세무 전문가에게 확인하세요.',
    "⚠️ Mongolia's 40% rate for gambling/betting winnings was repealed along with its 2025 ban on domestic betting/gambling businesses. We couldn't find a replacement provision specifically for foreign lottery winnings, so the figure shown is a reference estimate using the closest match — the flat 10% rate for other income. Please confirm with Mongolia's Tax Administration or a tax professional.",
    '⚠️ 蒙古法律中针对博彩类中奖所得的40%税率已随2025年境内博彩业禁令一并废止。由于未找到专门针对境外彩票中奖的替代条款，这里显示的数值是按最接近的其他所得单一税率（10%）估算的参考值。请务必向蒙古税务局或税务专家确认。',
    'Mức thuế 40% cho tiền thắng từ cờ bạc/cá cược theo luật Mông Cổ đã bị bãi bỏ cùng với lệnh cấm hoạt động cá cược/cờ bạc trong nước năm 2025. Do không tìm thấy quy định thay thế dành riêng cho tiền thắng xổ số nước ngoài, số liệu hiển thị ở đây là ước tính tham khảo theo mức gần nhất — thuế suất cố định 10% cho thu nhập khác. Vui lòng xác nhận với Cơ quan Thuế Mông Cổ hoặc chuyên gia thuế.',
    'อัตราภาษี 40% สำหรับเงินได้จากการพนัน/พนันขันต่อตามกฎหมายมองโกเลียถูกยกเลิกไปพร้อมกับการห้ามธุรกิจพนันในประเทศปี 2025 เนื่องจากไม่พบข้อกำหนดทดแทนสำหรับเงินรางวัลลอตเตอรีต่างประเทศโดยเฉพาะ ตัวเลขที่แสดงนี้เป็นค่าประมาณอ้างอิงจากอัตราที่ใกล้เคียงที่สุด — อัตราคงที่ 10% สำหรับรายได้อื่น กรุณายืนยันกับกรมสรรพากรมองโกเลียหรือผู้เชี่ยวชาญด้านภาษี',
    'Ставка 40% для выигрышей от азартных игр/ставок по законодательству Монголии была отменена вместе с запретом внутреннего игорного бизнеса в 2025 году. Поскольку не найдено отдельного положения для иностранного лотерейного выигрыша, показанная здесь цифра — справочная оценка по ближайшему совпадению — фиксированной ставке 10% для прочего дохода. Уточните детали в налоговом управлении Монголии или у налогового специалиста.',
    {
      km: 'អត្រា 40% សម្រាប់ការភ្នាល់/ល្បែងស៊ីសងតាមច្បាប់ម៉ុងហ្គោលីត្រូវបានលុបចោលរួមជាមួយការហាមឃាត់អាជីវកម្មភ្នាល់ក្នុងស្រុកឆ្នាំ 2025។ ដោយសារយើងមិនបានរកឃើញបទប្បញ្ញត្តិជំនួសសម្រាប់ប្រាក់ឆ្នោតបរទេសជាពិសេស តួលេខបង្ហាញនៅទីនេះជាការប៉ាន់ស្មានយោងតាមអត្រាដែលជិតបំផុត — អត្រាថេរ 10% សម្រាប់ប្រាក់ចំណូលផ្សេងទៀត។ សូមបញ្ជាក់ជាមួយអាជ្ញាធរពន្ធដារម៉ុងហ្គោលី ឬអ្នកជំនាញពន្ធ។',
      ne: 'मंगोलियाको कानूनको बेटिङ/जुवा जित्नेमा लाग्ने ४०% दर मंगोलियाको २०२५ को घरेलु सट्टेबाजी व्यवसाय प्रतिबन्धसँगै खारेज भयो। विदेशी लटरी जितको लागि विशेष प्रतिस्थापन प्रावधान नभेटिएकोले, यहाँ देखाइएको अंक सबैभन्दा नजिकको मेल — अन्य आयमा लाग्ने स्थिर १०% दर — प्रयोग गरी अनुमानित सन्दर्भ हो। सही प्रक्रियाका लागि मंगोलिया कर प्रशासन वा कर विशेषज्ञसँग पुष्टि गर्नुहोस्।',
      id: 'Tarif 40% untuk kemenangan judi/taruhan menurut hukum Mongolia telah dicabut bersamaan dengan larangan bisnis taruhan/judi domestik 2025. Karena tidak ditemukan ketentuan pengganti khusus untuk kemenangan lotre luar negeri, angka yang ditampilkan di sini adalah perkiraan referensi menggunakan yang paling mendekati — tarif tetap 10% untuk penghasilan lain. Harap konfirmasi dengan Administrasi Pajak Mongolia atau profesional pajak.',
      my: 'မွန်ဂိုလီယာဥပဒေအရ လောင်းကစား/ဆော့ကစားဆုငွေအတွက် ၄၀% နှုန်းသည် ၂၀၂၅ ပြည်တွင်းလောင်းကစားလုပ်ငန်းများပိတ်ပင်မှုနှင့်အတူ ပယ်ဖျက်ခံခဲ့ရသည်။ နိုင်ငံခြားထီပေါက်ငွေအတွက် အထူးအစားထိုးစည်းမျဉ်းကို ရှာမတွေ့ခဲ့သဖြင့်၊ ဤတွင်ပြသထားသောကိန်းသည် အနီးစပ်ဆုံးဖြစ်သော အခြားဝင်ငွေအတွက် ၁၀% ပုံသေနှုန်းကို အသုံးပြု၍ ခန့်မှန်းထားသော ကိုးကားချက်ဖြစ်သည်။ မွန်ဂိုလီယာအခွန်စီမံခန့်ခွဲမှု သို့မဟုတ် အခွန်ကျွမ်းကျင်သူနှင့် အတည်ပြုပါ။',
      si: 'මොංගෝලියානු නීතියේ සූදුව/ඔට්ටු ජයග්‍රහණ සඳහා 40% අනුපාතය 2025 දේශීය ඔට්ටු/සූදු ව්‍යාපාර තහනම සමඟ අහෝසි කරන ලදී. විදේශීය ලොතරැයි ජයග්‍රහණ සඳහා විශේෂිත ආදේශන විධිවිධානයක් සොයාගත නොහැකි වූ බැවින්, මෙහි පෙන්වා ඇති අගය ළඟම ගැලපීම — වෙනත් ආදායම සඳහා ස්ථාවර 10% අනුපාතය — භාවිතයෙන් ඇස්තමේන්තු කළ යොමු අගයකි. මොංගෝලියාවේ බදු පරිපාලනය හෝ බදු වෘත්තිකයෙකු සමඟ තහවුරු කරන්න.',
      uz: "Mongoliya qonunchiligidagi qimor/tikish yutuqlari uchun 40% stavka 2025-yilgi ichki tikish/qimor biznesi taqig'i bilan birga bekor qilindi. Xorijiy lotereya yutuqlari uchun maxsus almashtiruvchi qoida topilmagani sababli, bu yerda ko'rsatilgan raqam eng yaqin mos — boshqa daromad uchun 10% qat'iy stavka — asosida hisoblangan taxminiy ma'lumot. Mongoliya Soliq boshqarmasi yoki soliq mutaxassisi bilan tasdiqlang.",
      mn: 'Монгол хуулийн бооцоо/тоглоомын ялалтад ногдох 40% хувь 2025 оны дотоодын бооцоо/тоглоомын бизнесийг хориглосонтой хамт хүчингүй болсон. Гадаадын сугалааны ялалтад зориулсан орлуулах заалт олдоогүй тул энд харуулсан тоо нь хамгийн ойрын тохирол — бусад орлогод ногдох 10% тогтмол хувийг ашиглан тооцоолсон лавлагаа юм. Монголын татварын алба эсвэл татварын мэргэжилтэнтэй холбогдож баталгаажуулна уу.',
      kk: 'Моңғолия заңындағы ойын/бәс тігу ұтысына арналған 40% мөлшерлеме 2025 жылғы ішкі бәс тігу/ойын бизнесіне тыйым салумен бірге жойылды. Шетелдік лотерея ұтысына арналған алмастыратын ереже табылмағандықтан, мұнда көрсетілген сан ең жақын сәйкестік — басқа табысқа арналған 10% тұрақты мөлшерлеме — негізінде есептелген анықтамалық баға. Моңғолияның салық басқармасымен немесе салық маманымен растаңыз.',
      ky: 'Монголиянын мыйзамындагы бооз/оюн утушуна 40% чен 2025-жылдагы ички бооз/оюн бизнесине тыюу менен кошо жоюлду. Чет өлкөдөгү лотерея утушу үчүн атайын алмаштыруучу эреже табылбагандыктан, бул жерде көрсөтүлгөн сан эң жакын дал келүү — башка кирешеге 10% туруктуу чен — негизинде эсептелген маалымдама баа. Монголиянын салык башкармалыгы же салык адисти менен тактаңыз.',
      ur: 'منگولیا کے قانون میں جوا/شرط جیت پر 40% شرح 2025 کی ملکی شرط/جوا کاروبار پابندی کے ساتھ ختم کر دی گئی۔ چونکہ غیر ملکی لاٹری جیت کے لیے کوئی متبادل شق نہیں ملی، یہاں دکھایا گیا عدد قریب ترین مماثلت — دیگر آمدنی کے لیے 10% فلیٹ ریٹ — استعمال کرتے ہوئے تخمینی حوالہ جاتی قدر ہے۔ منگولیا کی ٹیکس انتظامیہ یا ٹیکس ماہر سے تصدیق کریں۔',
      bn: 'মঙ্গোলিয়ার আইনে জুয়া/বাজি জয়ে ৪০% হার ২০২৫ সালের দেশীয় বাজি/জুয়া ব্যবসা নিষেধাজ্ঞার সাথে বাতিল হয়েছে। বিদেশি লটারি জয়ের জন্য নির্দিষ্ট বিকল্প বিধান খুঁজে না পাওয়ায়, এখানে দেখানো সংখ্যাটি নিকটতম মিল — অন্যান্য আয়ের জন্য ১০% ফ্ল্যাট হার — ব্যবহার করে অনুমান করা রেফারেন্স মান। মঙ্গোলিয়ার কর প্রশাসন বা কর বিশেষজ্ঞের সাথে নিশ্চিত করুন।',
      lo: 'ອັດຕາ 40% ສຳລັບເງິນລາງວັນການພະນັນ/ການພະນັນຂັນຕໍ່ຕາມກົດໝາຍມົງໂກເລຍຖືກຍົກເລີກພ້ອມກັບການຫ້າມທຸລະກິດການພະນັນພາຍໃນປະເທດປີ 2025. ເນື່ອງຈາກບໍ່ພົບຂໍ້ກຳນົດທົດແທນສະເພາະສຳລັບເງິນລາງວັນເລກລອດເຕີຣີຕ່າງປະເທດ, ຕົວເລກທີ່ສະແດງຢູ່ນີ້ແມ່ນການຄາດຄະເນອ້າງອີງໂດຍໃຊ້ຄ່າທີ່ໃກ້ທີ່ສຸດ — ອັດຕາຄົງທີ່ 10% ສຳລັບລາຍໄດ້ອື່ນ. ກະລຸນາຢືນຢັນກັບອົງການພາສີມົງໂກເລຍ ຫຼື ຜູ້ຊ່ຽວຊານດ້ານພາສີ.',
      ja: 'モンゴル法における賭博・ギャンブル当選金への40%税率は、2025年の国内賭博・ギャンブル事業禁止と共に廃止されました。海外宝くじ当選金に特化した代替規定が見つからなかったため、ここに表示されている数値は最も近い一致 — その他所得への一律10%課税 — を用いた参考推定値です。正確な取り扱いはモンゴル税務当局または税務専門家にご確認ください。',
      ar: 'أُلغيت نسبة 40% لأرباح القمار/الرهان بموجب القانون المنغولي جنبًا إلى جنب مع حظر أعمال الرهان/القمار المحلية عام 2025. نظرًا لعدم العثور على حكم بديل خاص بأرباح اليانصيب الأجنبية، فإن الرقم المعروض هنا هو تقدير مرجعي باستخدام أقرب تطابق — نسبة ثابتة 10% للدخل الآخر. يرجى التأكيد مع إدارة الضرائب المنغولية أو أحد المتخصصين الضريبيين.',
      hi: 'मंगोलिया के कानून में जुआ/सट्टेबाजी जीत पर 40% दर 2025 की घरेलू सट्टेबाजी/जुआ व्यवसाय प्रतिबंध के साथ निरस्त कर दी गई। विदेशी लॉटरी जीत के लिए विशेष रूप से कोई प्रतिस्थापन प्रावधान न मिलने के कारण, यहाँ दिखाया गया आंकड़ा निकटतम मिलान — अन्य आय के लिए 10% फ्लैट दर — का उपयोग करके अनुमानित संदर्भ मूल्य है। सटीक जानकारी के लिए मंगोलिया कर प्रशासन या कर विशेषज्ञ से पुष्टि करें।',
      fr: "Le taux de 40 % pour les gains de jeux d'argent/paris selon la loi mongole a été abrogé avec l'interdiction des activités de paris/jeux d'argent domestiques en 2025. N'ayant pas trouvé de disposition de remplacement spécifique aux gains de loterie étrangers, le chiffre indiqué ici est une estimation de référence utilisant la correspondance la plus proche — le taux fixe de 10 % pour les autres revenus. Veuillez confirmer auprès de l'administration fiscale mongole ou d'un professionnel de la fiscalité.",
      tl: "Ang 40% na rate para sa gambling/betting winnings sa ilalim ng batas ng Mongolia ay na-repeal kasabay ng 2025 ban sa domestic betting/gambling businesses. Dahil wala kaming nakitang replacement provision na partikular para sa foreign lottery winnings, ang halagang ipinapakita dito ay isang reference estimate gamit ang pinakamalapit na tugma — ang flat 10% rate para sa iba pang kita. Mangyaring kumpirmahin sa Mongolia Tax Administration o isang tax professional.",
    }
  ),
  la: () => pickLang(
    '⚠️ 라오스는 2026년 7월부터 시행된 아주 새로운 법(5%)으로 복권 당첨소득을 처음 과세하기 시작했어요. 법이 너무 최근에 생겨서 실제 적용 사례가 아직 없고, 미국에서 낸 세금을 빼주는 조세조약도 없어서 미국 원천징수(30%)에 이 5%가 그대로 더해질 가능성이 높아요. 정확한 처리는 라오스 재정부나 세무 전문가에게 확인하세요.',
    '⚠️ Laos only just began taxing lottery-type winnings (5%) under a brand-new law that took effect in July 2026 — too recent for any real enforcement track record. Laos also has no tax treaty with the US, so this 5% likely stacks fully on top of the US withholding (30%) rather than being offset. Please confirm with Laos’s Ministry of Finance or a tax professional.',
    '⚠️ 老挝根据2026年7月才刚生效的全新法律（5%）首次对彩票类中奖所得征税——法律施行时间太短，尚无实际执行案例。老挝与美国也没有税收协定，因此这5%很可能会在美国预扣税（30%）之外全额叠加，而不是抵免。请务必向老挝财政部或税务专家确认。',
    '⚠️ Lào chỉ mới bắt đầu đánh thuế tiền thắng dạng xổ số (5%) theo luật hoàn toàn mới có hiệu lực từ tháng 7/2026 — quá gần đây để có tiền lệ thực thi. Lào cũng không có hiệp định thuế với Mỹ, nên mức 5% này nhiều khả năng cộng dồn đầy đủ lên trên khoản khấu trừ của Mỹ (30%) thay vì được khấu trừ. Vui lòng xác nhận với Bộ Tài chính Lào hoặc chuyên gia thuế.',
    '⚠️ ลาวเพิ่งเริ่มเก็บภาษีเงินรางวัลประเภทลอตเตอรี (5%) ตามกฎหมายใหม่ล่าสุดที่มีผลบังคับใช้ตั้งแต่กรกฎาคม 2026 — ใหม่เกินกว่าจะมีแนวปฏิบัติจริง ลาวยังไม่มีสนธิสัญญาภาษีกับสหรัฐฯ ด้วย จึงมีแนวโน้มว่า 5% นี้จะถูกบวกเพิ่มเต็มจำนวนจากภาษีหัก ณ ที่จ่ายของสหรัฐฯ (30%) แทนที่จะหักลบกัน กรุณายืนยันกับกระทรวงการคลังลาวหรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ Лаос только начал облагать налогом лотерейные выигрыши (5%) по совершенно новому закону, вступившему в силу в июле 2026 года — слишком недавно, чтобы была практика применения. У Лаоса также нет налогового соглашения с США, поэтому эти 5%, скорее всего, добавятся сверх удержания США (30%) полностью, без зачёта. Уточните детали в Министерстве финансов Лаоса или у налогового специалиста.',
    {
      km: "⚠️ ឡាវទើបតែចាប់ផ្តើមយកពន្ធលើប្រាក់រង្វាន់ប្រភេទឆ្នោត (5%) ក្រោមច្បាប់ថ្មីទាំងស្រុងដែលចូលជាធរមាននៅខែកក្កដា 2026 — ថ្មីពេកសម្រាប់កំណត់ត្រាការអនុវត្តជាក់ស្តែងណាមួយ។ ឡាវក៏មិនមានសន្ធិសញ្ញាពន្ធជាមួយសហរដ្ឋអាមេរិកដែរ ដូច្នេះ 5% នេះទំនងជានឹងបូកបន្ថែមពេញលេញនៅលើការកាត់ទុកពន្ធរបស់សហរដ្ឋអាមេរិក (30%) ជាជាងត្រូវបានផ្ទេរតុល្យភាព។ សូមបញ្ជាក់ជាមួយក្រសួងហិរញ្ញវត្ថុឡាវ ឬអ្នកជំនាញពន្ធ។",
      ne: "⚠️ लाओसले जुलाई 2026 मा लागू भएको एकदमै नयाँ कानून अन्तर्गत लटरी-प्रकारको जितमा कर लगाउन भर्खरै मात्र सुरु गर्‍यो (5%) — वास्तविक कार्यान्वयन रेकर्डको लागि धेरै भर्खरको। लाओससँग अमेरिकासँग कर सन्धि पनि छैन, त्यसैले यो 5% सम्भवतः अफसेट हुनुको सट्टा अमेरिकी रोक्का (30%) माथि पूर्ण रूपमा थपिन्छ। कृपया लाओसको अर्थ मन्त्रालय वा कर विशेषज्ञसँग पुष्टि गर्नुहोस्।",
      id: "⚠️ Laos baru saja mulai mengenakan pajak atas kemenangan jenis lotre (5%) berdasarkan undang-undang baru yang mulai berlaku Juli 2026 — terlalu baru untuk memiliki catatan penegakan yang nyata. Laos juga tidak memiliki perjanjian pajak dengan AS, sehingga 5% ini kemungkinan besar akan ditambahkan sepenuhnya di atas pemotongan pajak AS (30%) alih-alih dikompensasikan. Harap konfirmasi dengan Kementerian Keuangan Laos atau profesional pajak.",
      my: "⚠️ လာအိုသည် ၂၀၂၆ ဇူလိုင်လတွင် အသက်ဝင်လာသော လုံးဝအသစ်ဥပဒေအောက်တွင် ထီအမျိုးအစား ဆုငွေများကို အခွန်ကောက်ခံရန် မကြာသေးမီကမှ စတင်ခဲ့သည် (5%) — အမှန်တကယ်စိုးမိုးမှုမှတ်တမ်းအတွက် လွန်စွာလတ်တလောဖြစ်သည်။ လာအိုသည် အမေရိကန်နှင့် အခွန်သဘောတူညီချက်လည်း မရှိသဖြင့် ဤ 5% သည် ချိန်ညှိခြင်းမပြုဘဲ အမေရိကန်ထုတ်ယူငွေ (30%) အပေါ်တွင် အပြည့်အဝ ထပ်ပေါင်းနိုင်ခြေရှိသည်။ လာအိုဘဏ္ဍာရေးဝန်ကြီးဌာန သို့မဟုတ် အခွန်ကျွမ်းကျင်သူနှင့် အတည်ပြုပါ။",
      si: "⚠️ ලාඕසය 2026 ජූලි මාසයේ බලාත්මක වූ සම්පූර්ණයෙන්ම නව නීතියක් යටතේ ලොතරැයි වර්ගයේ ජයග්‍රහණවලට බදු අය කිරීම මෑතකදී පමණක් ආරම්භ කළේය (5%) — සැබෑ ක්‍රියාත්මක කිරීමේ වාර්තාවක් සඳහා අති නවතාවයකි. ලාඕසයට එක්සත් ජනපදය සමඟ බදු ගිවිසුමක්ද නොමැති බැවින්, මෙම 5% බොහෝ විට ප්‍රතිශෝධනය නොකර එක්සත් ජනපද රඳවා ගැනීම (30%) මතට සම්පූර්ණයෙන්ම එකතු වනු ඇත. කරුණාකර ලාඕසයේ මුදල් අමාත්‍යාංශය හෝ බදු වෘත්තිකයෙකු සමඟ තහවුරු කරන්න.",
      uz: "⚠️ Laos 2026-yil iyulda kuchga kirgan yangi qonun asosida lotereya turidagi yutuqlarga soliq solishni yaqinda boshladi (5%) — haqiqiy amaliyot tarixi uchun juda yaqinda. Laosning AQSh bilan soliq shartnomasi ham yo'q, shuning uchun bu 5% kompensatsiya qilinmasdan AQSh ushlab qolishi (30%) ustiga to'liq qo'shilishi mumkin. Iltimos, Laos Moliya vazirligi yoki soliq mutaxassisi bilan tasdiqlang.",
      mn: "⚠️ Лаос 2026 оны 7-р сард хүчин төгөлдөр болсон бүрэн шинэ хуулийн дагуу сугалааны төрлийн ялалтад татвар ногдуулж эхэлсэн (5%) — бодит хэрэгжилтийн түүхэнд хэтэрхий саяхныхаа. Лаос мөн АНУ-тай татварын гэрээгүй тул энэ 5% нь тэнцвэржихийн оронд АНУ-ын суутган татвар (30%)-ын дээр бүрэн нэмэгдэх магадлалтай. Лаосын Сангийн яам эсвэл татварын мэргэжилтэнтэй баталгаажуулна уу.",
      kk: "⚠️ Лаос 2026 жылғы шілдеде күшіне енген мүлдем жаңа заң бойынша лотерея түріндегі ұтыстарға салық салуды жуырда ғана бастады (5%) — нақты қолдану тәжірибесі үшін тым жақында. Лаостың АҚШ-пен салық келісімі де жоқ, сондықтан бұл 5% өтемақы жасалмай, АҚШ-тың ұстап қалуының (30%) үстіне толығымен қосылуы мүмкін. Лаостың Қаржы министрлігімен немесе салық маманымен растаңыз.",
      ky: "⚠️ Лаос 2026-жылдын июлунда күчүнө кирген толугу менен жаңы мыйзам боюнча лотерея түрүндөгү утуштарга салык салууну жакында гана баштады (5%) — чыныгы аткаруу тарыхы үчүн өтө эле жаңы. Лаостун АКШ менен салык макулдашуусу да жок, ошондуктан бул 5% компенсацияланбастан АКШнын кармап калуусунун (30%) үстүнө толугу менен кошулушу мүмкүн. Лаостун Финансы министрлиги же салык боюнча адис менен тактаңыз.",
      ur: "⚠️ لاؤس نے جولائی 2026 میں نافذ ہونے والے بالکل نئے قانون کے تحت لاٹری طرز کی جیت پر ٹیکس لگانا ابھی ابھی شروع کیا ہے (5%) — حقیقی نفاذ کے ریکارڈ کے لیے بہت حالیہ۔ لاؤس کا امریکہ کے ساتھ کوئی ٹیکس معاہدہ بھی نہیں ہے، اس لیے یہ 5% ممکنہ طور پر ایڈجسٹ ہونے کے بجائے امریکی روک تھام (30%) کے اوپر مکمل طور پر جمع ہو جائے گا۔ براہ کرم لاؤس کی وزارت خزانہ یا ٹیکس ماہر سے تصدیق کریں۔",
      bn: "⚠️ লাওস ২০২৬ সালের জুলাই মাসে কার্যকর হওয়া একেবারে নতুন আইনের অধীনে লটারি-জাতীয় জয়ের উপর কর আরোপ করা সবেমাত্র শুরু করেছে (৫%) — প্রকৃত প্রয়োগের রেকর্ডের জন্য খুবই সাম্প্রতিক। লাওসের মার্কিন যুক্তরাষ্ট্রের সাথে কোনো কর চুক্তিও নেই, তাই এই ৫% সম্ভবত অফসেট হওয়ার পরিবর্তে মার্কিন উইথহোল্ডিং (৩০%) এর উপর সম্পূর্ণভাবে যুক্ত হবে। অনুগ্রহ করে লাওসের অর্থ মন্ত্রণালয় বা কর বিশেষজ্ঞের সাথে নিশ্চিত করুন।",
      lo: "⚠️ ລາວຫາກໍ່ເລີ່ມເກັບພາສີເງິນລາງວັນປະເພດລອດເຕີຣີ (5%) ພາຍໃຕ້ກົດໝາຍໃໝ່ທັງໝົດທີ່ມີຜົນບັງຄັບໃຊ້ໃນເດືອນກໍລະກົດ 2026 — ໃໝ່ເກີນໄປສຳລັບປະຫວັດການບັງຄັບໃຊ້ຈິງ. ລາວຍັງບໍ່ມີສົນທິສັນຍາພາສີກັບສະຫະລັດ, ດັ່ງນັ້ນ 5% ນີ້ອາດຈະຖືກບວກເພີ່ມເຕັມຈຳນວນເທິງການຫັກພາສີຂອງສະຫະລັດ (30%) ແທນທີ່ຈະຖືກຫັກລົບ. ກະລຸນາຢືນຢັນກັບກະຊວງການເງິນລາວ ຫຼື ຜູ້ຊ່ຽວຊານດ້ານພາສີ.",
      ja: "⚠️ ラオスは2026年7月に施行されたばかりの新しい法律の下で、宝くじ型の当選金への課税を開始したばかりです（5%）— 実際の執行実績としては新しすぎます。ラオスは米国と租税条約も結んでいないため、この5%は相殺されることなく、米国の源泉徴収（30%）にそのまま上乗せされる可能性が高いです。ラオス財務省または税務専門家にご確認ください。",
      ar: "⚠️ بدأت لاوس للتو في فرض ضرائب على الأرباح من نوع اليانصيب (5%) بموجب قانون جديد تمامًا دخل حيز التنفيذ في يوليو 2026 — وهو حديث جدًا لوجود سجل تنفيذ فعلي. كما لا توجد للاوس معاهدة ضريبية مع الولايات المتحدة، لذا من المرجح أن تُضاف نسبة الـ5% هذه بالكامل فوق الاستقطاع الأمريكي (30%) بدلاً من تعويضها. يرجى التأكيد مع وزارة المالية اللاوية أو أحد المتخصصين الضريبيين.",
      hi: "⚠️ लाओस ने जुलाई 2026 में लागू हुए एकदम नए कानून के तहत लॉटरी-प्रकार की जीत पर कर लगाना अभी शुरू ही किया है (5%) — वास्तविक प्रवर्तन रिकॉर्ड के लिए बहुत हाल ही का। लाओस का अमेरिका के साथ कोई कर संधि भी नहीं है, इसलिए यह 5% संभवतः ऑफसेट होने के बजाय अमेरिकी रोक (30%) के ऊपर पूरी तरह से जुड़ जाएगा। कृपया लाओस के वित्त मंत्रालय या कर विशेषज्ञ से पुष्टि करें।",
      fr: "⚠️ Le Laos vient tout juste de commencer à taxer les gains de type loterie (5 %) en vertu d'une toute nouvelle loi entrée en vigueur en juillet 2026 — trop récente pour avoir un véritable historique d'application. Le Laos n'a pas non plus de traité fiscal avec les États-Unis, donc ces 5 % s'ajouteront probablement intégralement à la retenue à la source américaine (30 %) plutôt que d'être compensés. Veuillez confirmer auprès du ministère des Finances du Laos ou d'un professionnel de la fiscalité.",
      tl: "⚠️ Kararampa lamang magsimula ang Laos na buwisan ang mga panalong uri ng lottery (5%) sa ilalim ng bagong batas na naging epektibo noong Hulyo 2026 — masyadong bago para magkaroon ng tunay na track record ng pagpapatupad. Ang Laos ay wala ring kasunduan sa buwis sa US, kaya ang 5% na ito ay malamang na idadagdag nang buo sa ibabaw ng US withholding (30%) sa halip na ma-offset. Mangyaring kumpirmahin sa Ministri ng Pananalapi ng Laos o isang propesyonal sa buwis."
    }
  )
};

function updateHomeCalc(usdOverride){
  // 입력창이 비어있으면(플레이스홀더만 보이는 초기 상태) 0으로 계산하지 않고, 마지막으로
  // 알려진 유효한 금액(sharedAmountUsd, 기본값 $100M)을 그대로 씀 — 환율 재조회·언어전환처럼
  // 다른 이유로 이 함수가 인자 없이 재호출될 때마다 결과가 0으로 튀는 걸 방지
  const typedValue = parseMillionsInput(document.getElementById('homeAmountInput').value);
  const usd = usdOverride !== undefined ? usdOverride : (typedValue > 0 ? typedValue * 1000000 : sharedAmountUsd);
  const country = document.getElementById('homeCountrySelect').value;
  const stateCode = document.getElementById('homeStateSelect').value;
  sharedAmountUsd = usd;
  sharedCountry = country;
  sharedState = stateCode;
  // 확률체감 탭이 이미 열려 있는 상태에서 여기서 세금 기준(국가/주)이 바뀌면, 그 탭으로
  // 돌아가지 않아도(=go('odds') 재호출 없이도) "실수령액 TOP 10" 랭킹·문구가 곧바로 새
  // sharedCountry/sharedState를 반영해야 함. renderJackpotTakeHomeRanking()은 리스트 DOM이
  // 없으면(다른 탭에 있으면) 조용히 스킵하고, odds-data.js가 아직 로드 전이어도 안전하게
  // 빈 목록을 그릴 뿐이라 언제 호출해도 안전함(setLanguage()도 이미 같은 방식으로 무조건 호출)
  renderJackpotTakeHomeRanking();
  updateSliderFill(document.getElementById('homeAmountSlider'));
  const 억 = (usd * EXCHANGE_RATE) / 100000000;
  const r = calcTakeHome(억, country, stateCode);
  const { final, label1, val1, label2, val2, basisSuffix } = r;

  document.getElementById('home-krw-amt').textContent = formatWon(억);

  const trustLine = document.getElementById('home-trust-line');
  if (trustLine) {
    const rateStr = EXCHANGE_RATE.toLocaleString(LOCALE_MAP[currentLang] || 'ko-KR');
    // 국가별로 실제 근거가 되는 과세당국이 다름 — 중국 거주자 시나리오에 한국 국세청 자료가
    // 근거인 것처럼 표기하면 사실과 다르므로, 국가에 맞는 과세당국만 표기함
    const authorityText = (COUNTRY_TAX_AUTHORITY[country] || COUNTRY_TAX_AUTHORITY.kr)();
    // 환율은 한국 거주자 시나리오에서만 실제 세액(누진세율 구간) 산정에 실질적으로 쓰임 —
    // 미국·중국 거주자는 세금 자체가 달러 기준 정률로 정해지고, 원화 환산은 비교를 위한 표시일 뿐이라
    // (아래 usdNote에서 별도 안내) "공식 자료 기반" 문구에 환율을 같이 넣으면 마치 환율이 그 나라
    // 세법 계산에 쓰인 것처럼 오해될 수 있어 kr에서만 환율 문구를 붙임
    trustLine.textContent = (country === 'kr')
      ? pickLang(
          `${authorityText} 공식 자료 기반 · 2026년 세율 · 환율 ${rateStr}원 적용`,
          `Based on ${authorityText} official data · 2026 tax rates · rate ${rateStr} KRW/USD`,
          `基于${authorityText}官方数据 · 2026年税率 · 汇率${rateStr}韩元/美元`,
          `Dựa trên dữ liệu chính thức của ${authorityText} · thuế suất 2026 · tỷ giá ${rateStr} KRW/USD`,
          `อ้างอิงข้อมูลทางการจาก ${authorityText} · อัตราภาษีปี 2026 · อัตราแลกเปลี่ยน ${rateStr} วอน/ดอลลาร์`,
          `На основе официальных данных ${authorityText} · налоговые ставки 2026 · курс ${rateStr} вон/долл.`,
          {
            ar: `استنادًا إلى بيانات ${authorityText} الرسمية · معدلات ضريبة 2026 · سعر الصرف ${rateStr} وون/دولار`,
            bn: `${authorityText}-এর সরকারি তথ্যের ভিত্তিতে · ২০২৬ করহার · বিনিময় হার ${rateStr} ওন/ডলার`,
            fr: `Basé sur les données officielles de ${authorityText} · taux d'imposition 2026 · taux de change ${rateStr} KRW/USD`,
            hi: `${authorityText} के आधिकारिक डेटा पर आधारित · 2026 कर दरें · विनिमय दर ${rateStr} KRW/USD`,
            id: `Berdasarkan data resmi ${authorityText} · tarif pajak 2026 · kurs ${rateStr} KRW/USD`,
            ja: `${authorityText}の公式データに基づく · 2026年税率 · 為替レート${rateStr}ウォン/ドル`,
            kk: `${authorityText} ресми деректері негізінде · 2026 салық мөлшерлемелері · айырбас бағамы ${rateStr} вон/долл.`,
            km: `ផ្អែកលើទិន្នន័យផ្លូវការរបស់ ${authorityText} · អត្រាពន្ធឆ្នាំ 2026 · អត្រាប្តូរប្រាក់ ${rateStr} វอน/ដុល្លារ`,
            ky: `${authorityText} расмий маалыматтарынын негизинде · 2026 салык коэффициенттери · алмашуу курсу ${rateStr} вон/доллар`,
            lo: `ອີງໃສ່ຂໍ້ມູນທາງການຂອງ ${authorityText} · ອັດຕາພາສີປີ 2026 · ອັດຕາແລກປ່ຽນ ${rateStr} ວອນ/ໂດລາ`,
            mn: `${authorityText}-ийн албан ёсны мэдээлэлд үндэслэсэн · 2026 оны татварын хувь · ханш ${rateStr} вон/доллар`,
            my: `${authorityText} ၏ တရားဝင်အချက်အလက်ကို အခြေခံသည် · 2026 အခွန်နှုန်း · ငွေလဲနှုန်း ${rateStr} ဝမ်း/ဒေါ်လာ`,
            ne: `${authorityText} को आधिकारिक डेटामा आधारित · 2026 कर दर · विनिमय दर ${rateStr} वोन/डलर`,
            si: `${authorityText} හි නිල දත්ත මත පදනම්ව · 2026 බදු අනුපාත · විනිමය අනුපාතය ${rateStr} වොන්/ඩොලර්`,
            tl: `Batay sa opisyal na datos ng ${authorityText} · 2026 tax rates · exchange rate ${rateStr} KRW/USD`,
            ur: `${authorityText} کے سرکاری ڈیٹا پر مبنی · 2026 ٹیکس کی شرحیں · شرح مبادلہ ${rateStr} وون/ڈالر`,
            uz: `${authorityText} rasmiy ma'lumotlariga asoslangan · 2026 soliq stavkalari · valyuta kursi ${rateStr} von/dollar`,
          }
        )
      : pickLang(
          `${authorityText} 공식 자료 기반 · 2026년 세율 (원화 환산은 비교용)`,
          `Based on ${authorityText} official data · 2026 tax rates (KRW figure is for comparison only)`,
          `基于${authorityText}官方数据 · 2026年税率（韩元金额仅供对比参考）`,
          `Dựa trên dữ liệu chính thức của ${authorityText} · thuế suất 2026 (số liệu KRW chỉ để so sánh)`,
          `อ้างอิงข้อมูลทางการจาก ${authorityText} · อัตราภาษีปี 2026 (ตัวเลขวอนใช้เพื่อเปรียบเทียบเท่านั้น)`,
          `На основе официальных данных ${authorityText} · налоговые ставки 2026 (сумма в вонах — только для сравнения)`,
          {
            ar: `استنادًا إلى بيانات ${authorityText} الرسمية · معدلات ضريبة 2026 (رقم الوون للمقارنة فقط)`,
            bn: `${authorityText}-এর সরকারি তথ্যের ভিত্তিতে · ২০২৬ করহার (ওন অঙ্কটি শুধু তুলনার জন্য)`,
            fr: `Basé sur les données officielles de ${authorityText} · taux d'imposition 2026 (le montant en KRW est indiqué à titre de comparaison)`,
            hi: `${authorityText} के आधिकारिक डेटा पर आधारित · 2026 कर दरें (KRW आंकड़ा केवल तुलना के लिए)`,
            id: `Berdasarkan data resmi ${authorityText} · tarif pajak 2026 (angka KRW hanya untuk perbandingan)`,
            ja: `${authorityText}の公式データに基づく · 2026年税率（ウォン表示は比較用）`,
            kk: `${authorityText} ресми деректері негізінде · 2026 салық мөлшерлемелері (вон сомасы тек салыстыру үшін)`,
            km: `ផ្អែកលើទិន្នន័យផ្លូវការរបស់ ${authorityText} · អត្រាពន្ធឆ្នាំ 2026 (តួលេខវ៉ុនសម្រាប់តែប្រៀបធៀបប៉ុណ្ណោះ)`,
            ky: `${authorityText} расмий маалыматтарынын негизинде · 2026 салык коэффициенттери (вон суммасы салыштыруу үчүн гана)`,
            lo: `ອີງໃສ່ຂໍ້ມູນທາງການຂອງ ${authorityText} · ອັດຕາພາສີປີ 2026 (ຈຳນວນວອນສຳລັບປຽບທຽບເທົ່ານັ້ນ)`,
            mn: `${authorityText}-ийн албан ёсны мэдээлэлд үндэслэсэн · 2026 оны татварын хувь (воны дүн зөвхөн харьцуулахад)`,
            my: `${authorityText} ၏ တရားဝင်အချက်အလက်ကို အခြေခံသည် · 2026 အခွန်နှုန်း (ဝမ်းပမာဏသည် နှိုင်းယှဉ်ရန်သာဖြစ်သည်)`,
            ne: `${authorityText} को आधिकारिक डेटामा आधारित · 2026 कर दर (वोन अंक केवल तुलनाका लागि)`,
            si: `${authorityText} හි නිල දත්ත මත පදනම්ව · 2026 බදු අනුපාත (වොන් අගය සංසන්දනය සඳහා පමණි)`,
            tl: `Batay sa opisyal na datos ng ${authorityText} · 2026 tax rates (ang KRW figure ay para sa paghahambing lamang)`,
            ur: `${authorityText} کے سرکاری ڈیٹا پر مبنی · 2026 ٹیکس کی شرحیں (وون کا ہندسہ صرف موازنے کے لیے)`,
            uz: `${authorityText} rasmiy ma'lumotlariga asoslangan · 2026 soliq stavkalari (von summasi faqat taqqoslash uchun)`,
          }
        );
  }

  const milestoneEl = document.getElementById('home-milestone');
  const newMilestoneTier = final >= 10000 ? 2 : (final >= 1000 ? 1 : 0);
  if (newMilestoneTier === 2) {
    milestoneEl.textContent = pickLang('🎉 실수령액만 1조원이 넘어요!', '🎉 Your take-home tops ₩1 trillion!', '🎉 实得金额突破1万亿韩元！', '🎉 Số tiền thực nhận vượt quá 1 nghìn tỷ won!', '🎉 เงินที่ได้รับจริงเกิน 1 ล้านล้านวอน!', '🎉 Сумма на руки превысила 1 триллион вон!', { ar:'🎉 صافي دخلك تجاوز 1 تريليون وون!', bn:'🎉 আপনার প্রকৃত আয় ১ ট্রিলিয়ন ওন ছাড়িয়ে গেছে!', fr:'🎉 Votre revenu net dépasse 1 000 milliards de wons !', hi:'🎉 आपकी हाथ में आने वाली राशि 1 ट्रिलियन वॉन को पार कर गई!', id:'🎉 Take-home-mu tembus ₩1 triliun!', ja:'🎉 手取り額が1兆ウォンを突破！', kk:'🎉 Қолыңызға тиетін сома 1 триллион воннан асты!', km:'🎉 ចំណូលសុទ្ធរបស់អ្នកលើសពី 1 ទ្រីលានវ៉ុនហើយ!', ky:'🎉 Кол алдырма акчаңыз 1 триллион вондон ашты!', lo:'🎉 ເງິນທີ່ໄດ້ຮັບຈິງຂອງທ່ານເກີນ 1 ລ້ານລ້ານວອນແລ້ວ!', mn:'🎉 Таны гарт орох дүн 1 их наяд воноос давлаа!', my:'🎉 သင့်လက်ခံရရှိမှုသည် ဝမ်း ၁ ထရီလီယံ ကျော်လွန်သွားပါပြီ!', ne:'🎉 तपाईंको हातमा पर्ने रकम १ ट्रिलियन वोन नाघ्यो!', si:'🎉 ඔබේ අත් ලාභය වොන් ට්‍රිලියන 1 ඉක්මවා ඇත!', tl:'🎉 Lumampas na sa ₩1 trillion ang take-home mo!', ur:'🎉 آپ کی ہاتھ میں آنے والی رقم 1 ٹریلین وون سے تجاوز کر گئی!', uz:"🎉 Qo'lingizga tegadigan summa 1 trillion vondan oshdi!" });
    milestoneEl.style.display = 'block';
  } else if (newMilestoneTier === 1) {
    milestoneEl.textContent = pickLang('💎 실수령액이 1,000억원을 넘었어요', '💎 Your take-home tops ₩100 billion', '💎 实得金额突破1000亿韩元', '💎 Số tiền thực nhận vượt quá 100 tỷ won', '💎 เงินที่ได้รับจริงเกิน 1 แสนล้านวอน', '💎 Сумма на руки превысила 100 миллиардов вон', { ar:'💎 صافي دخلك تجاوز 100 مليار وون', bn:'💎 আপনার প্রকৃত আয় ১০০ বিলিয়ন ওন ছাড়িয়ে গেছে', fr:'💎 Votre revenu net dépasse 100 milliards de wons', hi:'💎 आपकी हाथ में आने वाली राशि 100 अरब वॉन को पार कर गई', id:'💎 Take-home-mu tembus ₩100 miliar', ja:'💎 手取り額が1000億ウォンを突破', kk:'💎 Қолыңызға тиетін сома 100 миллиард воннан асты', km:'💎 ចំណូលសុទ្ធរបស់អ្នកលើសពី 100 ប៊ីលានវ៉ុន', ky:'💎 Кол алдырма акчаңыз 100 миллиард вондон ашты', lo:'💎 ເງິນທີ່ໄດ້ຮັບຈິງຂອງທ່ານເກີນ 1 ແສນລ້ານວອນແລ້ວ', mn:'💎 Таны гарт орох дүн 100 тэрбум воноос давлаа', my:'💎 သင့်လက်ခံရရှိမှုသည် ဝမ်း ၁၀၀ ဘီလီယံ ကျော်လွန်သွားပါပြီ', ne:'💎 तपाईंको हातमा पर्ने रकम १०० अर्ब वोन नाघ्यो', si:'💎 ඔබේ අත් ලාභය වොන් බිලියන 100 ඉක්මවා ඇත', tl:'💎 Lumampas na sa ₩100 billion ang take-home mo', ur:'💎 آپ کی ہاتھ میں آنے والی رقم 100 ارب وون سے تجاوز کر گئی', uz:"💎 Qo'lingizga tegadigan summa 100 milliard vondan oshdi" });
    milestoneEl.style.display = 'block';
  } else {
    milestoneEl.style.display = 'none';
  }
  // 마일스톤을 "새로" 넘어섰을 때만 짧게 로또볼이 튀어오르는 효과 (계속 떠있지 않고 한 번만)
  if (newMilestoneTier > lastMilestoneTier) {
    triggerMilestoneBurst();
  }
  lastMilestoneTier = newMilestoneTier;
  const finalEl = document.getElementById('home-final-amt');
  const prevVal = parseFloat(finalEl.dataset.eokVal) || 0;
  if (homeResultFirstRender) {
    // 최초 1회 — 카운트업 없이 바로 최종 숫자를 보여줌 (0에서 세는 걸 보고 헷갈리지 않게)
    finalEl.textContent = formatWon(final);
    finalEl.dataset.eokVal = final;
    fitAmountFontSize(finalEl);
    homeResultFirstRender = false;
  } else {
    animateValueChange(finalEl, prevVal, final, '억원', 1, 250, () => fitAmountFontSize(finalEl));
  }
  const miniEl = document.getElementById('live-result-mini-amt');
  if (miniEl) miniEl.textContent = formatWon(final);
  document.getElementById('home-final-basis').textContent = pickLang(
    formatWon(억) + ' 당첨 기준 · ' + basisSuffix,
    formatWon(억) + ' prize basis · ' + basisSuffix,
    formatWon(억) + ' 中奖基准 · ' + basisSuffix,
    formatWon(억) + ' cơ sở trúng thưởng · ' + basisSuffix,
    formatWon(억) + ' เกณฑ์เงินรางวัล · ' + basisSuffix,
    formatWon(억) + ' основа приза · ' + basisSuffix,
    {
      ar: formatWon(억) + ' أساس الجائزة · ' + basisSuffix, bn: formatWon(억) + ' পুরস্কারের ভিত্তি · ' + basisSuffix,
      fr: formatWon(억) + ' base du prix · ' + basisSuffix, hi: formatWon(억) + ' पुरस्कार आधार · ' + basisSuffix,
      id: formatWon(억) + ' basis kemenangan · ' + basisSuffix, ja: formatWon(억) + ' 当選基準・' + basisSuffix,
      kk: formatWon(억) + ' жүлде негізі · ' + basisSuffix, km: formatWon(억) + ' មូលដ្ឋានពានរង្វាន់ · ' + basisSuffix,
      ky: formatWon(억) + ' байге негизи · ' + basisSuffix, lo: formatWon(억) + ' ພື້ນຖານລາງວັນ · ' + basisSuffix,
      mn: formatWon(억) + ' шагналын үндэслэл · ' + basisSuffix, my: formatWon(억) + ' ဆုငွေအခြေခံ · ' + basisSuffix,
      ne: formatWon(억) + ' पुरस्कार आधार · ' + basisSuffix, si: formatWon(억) + ' ත්‍යාග පදනම · ' + basisSuffix,
      tl: formatWon(억) + ' basehan ng premyo · ' + basisSuffix, ur: formatWon(억) + ' انعام کی بنیاد · ' + basisSuffix,
      uz: formatWon(억) + ' yutuq asosi · ' + basisSuffix,
    }
  );
  const usdMillions = Math.round(usd / 1000000).toLocaleString(LOCALE_MAP[currentLang] || 'ko-KR');
  document.getElementById('home-final-basis-mini').textContent = pickLang(
    `${usdMillions}M USD 당첨 · ${basisSuffix}`,
    `${usdMillions}M USD prize · ${basisSuffix}`,
    `${usdMillions}M USD 中奖 · ${basisSuffix}`,
    `${usdMillions}M USD trúng thưởng · ${basisSuffix}`,
    `${usdMillions}M USD เงินรางวัล · ${basisSuffix}`,
    `${usdMillions}M USD приз · ${basisSuffix}`,
    {
      ar: `${usdMillions}M USD جائزة · ${basisSuffix}`, bn: `${usdMillions}M USD পুরস্কার · ${basisSuffix}`,
      fr: `${usdMillions}M USD prix · ${basisSuffix}`, hi: `${usdMillions}M USD पुरस्कार · ${basisSuffix}`,
      id: `${usdMillions}M USD kemenangan · ${basisSuffix}`, ja: `${usdMillions}M USD 当選・${basisSuffix}`,
      kk: `${usdMillions}M USD жүлде · ${basisSuffix}`, km: `${usdMillions}M USD ពានរង្វាន់ · ${basisSuffix}`,
      ky: `${usdMillions}M USD байге · ${basisSuffix}`, lo: `${usdMillions}M USD ລາງວັນ · ${basisSuffix}`,
      mn: `${usdMillions}M USD шагнал · ${basisSuffix}`, my: `${usdMillions}M USD ဆုငွေ · ${basisSuffix}`,
      ne: `${usdMillions}M USD पुरस्कार · ${basisSuffix}`, si: `${usdMillions}M USD ත්‍යාගය · ${basisSuffix}`,
      tl: `${usdMillions}M USD premyo · ${basisSuffix}`, ur: `${usdMillions}M USD انعام · ${basisSuffix}`,
      uz: `${usdMillions}M USD yutuq · ${basisSuffix}`,
    }
  );
  document.getElementById('home-tax1-label').textContent = label1;
  document.getElementById('home-tax1-val').textContent = val1;
  document.getElementById('home-tax2-label').textContent = label2;
  document.getElementById('home-tax2-val').textContent = val2;

  const taxImpactPct = 억 > 0 ? Math.round(100 - (final / 억 * 100)) : 0;
  document.getElementById('tax-impact-before').textContent = formatWon(억);
  document.getElementById('tax-impact-after').textContent = formatWon(final);
  document.getElementById('tax-impact-diff').textContent = '-' + formatWon(억 - final) + ` (${taxImpactPct}%)`;
  // "합계" 줄만 소수 첫째자리까지 보여줌 — 바로 위 두 항목(연방세/한국 추가납부)이 각각 -30%,
  // -16.5%처럼 소수점이 있는 값인데 합계를 정수로 반올림하면(-46%) 30+16.5=46.5와 안 맞아
  // "계산이 틀렸나?" 오해를 살 수 있음. 히어로 영역 상단의 taxImpactPct(정수)는 그대로 둠 —
  // 거기는 단독으로만 보여서 소수점 유무가 문제되지 않음
  const taxImpactPctPrecise = 억 > 0 ? (100 - (final / 억 * 100)) : 0;
  document.getElementById('home-tax-total-line').textContent =
    pickLang('합계 ', 'Total ', '合计 ', 'Tổng ', 'รวม ', 'Итого ', { km:'សរុប ', ne:'जम्मा ', id:'Total ', my:'စုစုပေါင်း ', si:'එකතුව ', uz:'Jami ', mn:'Нийт ', kk:'Барлығы ', ky:'Баары ', ur:'کل ', bn:'মোট ', lo:'ລວມ ', ja:'合計 ', ar:'الإجمالي ', hi:'कुल ', fr:'Total ', tl:'Kabuuan ' })
    + '-' + taxImpactPctPrecise.toFixed(1) + '%';

  // 실수령/세금 비율을 숫자로만 보여주는 대신 막대그래프로도 한눈에 보이게 함 —
  // 다른 복권 세금 계산기들(infinitycalculator 등)에 공통으로 있는 시각적 breakdown 패턴 참고
  const takeHomePct = Math.max(0, Math.min(100, 100 - taxImpactPct));
  const takeBar = document.getElementById('result-visual-take');
  // 페이지를 막 열었을 때 첫 렌더링에서만 0%→목표값으로 차오르는 걸 보여줌(그 뒤 슬라이더 조작 시
  // 값이 바뀌는 건 CSS transition(styles.css .result-visual-bar-take)으로 이미 자연스럽게
  // 움직이므로 매번 다시 재생하면 오히려 과함) — animateBarsIn()과 같은 Element.animate() 방식
  if (!resultBarAnimatedIn && typeof takeBar.animate === 'function') {
    resultBarAnimatedIn = true;
    takeBar.animate([{ width: '0%' }, { width: takeHomePct + '%' }], { duration: 900, easing: 'cubic-bezier(0.16,1,0.3,1)' });
  }
  takeBar.style.width = takeHomePct + '%';
  document.getElementById('result-visual-take-pct').textContent = takeHomePct + '%';
  document.getElementById('result-visual-tax-pct').textContent = taxImpactPct + '%';

  // 일시불 대신 연금(annuity)으로 받으면? — 확률체감 탭 잭팟계산기와 같은 로직 재사용.
  // 여기 입력값(억)은 이미 "일시불 세전 기준"이라, 확률체감 탭처럼 발표총액(announcedKrw)에서
  // CASH_VALUE_RATIO(58%)를 곱해 일시불을 구하는 게 아니라 거꾸로 나눠서 발표총액을 역산함
  const homeAnnouncedKrw = (억 * 100000000) / CASH_VALUE_RATIO;
  const ANNUITY_PAYMENTS_HOME = 30;
  const homePerYearKrw = homeAnnouncedKrw / ANNUITY_PAYMENTS_HOME;
  const rHomeAnnuityYear = calcTakeHome(homePerYearKrw / 100000000, 'kr');
  const homeAnnuityYearEl = document.getElementById('home-annuity-year');
  if (homeAnnuityYearEl) {
    const aboutHome = pickLang('약 ', 'About ', '约', 'Khoảng ', 'ประมาณ ', 'Около ', ABOUT_PREFIX_MORE);
    homeAnnuityYearEl.textContent = aboutHome + formatWon(homePerYearKrw / 100000000);
    document.getElementById('home-annuity-year-net').textContent = aboutHome + formatWon(rHomeAnnuityYear.final);
    document.getElementById('home-annuity-month-net').textContent = aboutHome + formatWon(rHomeAnnuityYear.final / 12);
    renderAnnuitySchedule(homeAnnouncedKrw, 'home-annuity-schedule-list');
  }

  const usdNote = document.getElementById('home-usd-note');
  const cnyNote = document.getElementById('home-cny-note');
  const inrNote = document.getElementById('home-inr-note');
  const otherNote = document.getElementById('home-other-note');
  if (country !== 'kr') {
    // 미국·중국·인도 거주자 모두 실제로는 달러(USD)로 그대로 받고, 자국 세법상 세액도 원래는
    // 그 나라 통화 기준으로 계산됨 — 여기 보이는 원화 금액은 한국 기준과 비교하기 위한 표시일 뿐이라
    // 실수령률(final/억)을 그대로 USD 원금에 곱해서 실제 달러 수령액을 구함 (국가별 세율 하드코딩 없이 공통 처리)
    const finalUsd = Math.round(usd * (final / 억));
    usdNote.textContent = pickLang(
      `💵 실제로는 달러($${finalUsd.toLocaleString('en-US')})로 그대로 받아요 — 원화는 한국 기준과 비교하기 위한 참고용이에요`,
      `💵 You actually receive USD ($${finalUsd.toLocaleString('en-US')}) directly — the KRW figure is just for comparison with the Korea basis`,
      `💵 实际上会直接以美元（$${finalUsd.toLocaleString('en-US')}）收到 —— 韩元金额仅供与韩国标准对比参考`,
      `💵 Thực tế bạn nhận trực tiếp bằng đô la ($${finalUsd.toLocaleString('en-US')}) — số tiền KRW chỉ để so sánh với tiêu chuẩn Hàn Quốc`,
      `💵 คุณจะได้รับเป็นดอลลาร์ ($${finalUsd.toLocaleString('en-US')}) โดยตรง — ตัวเลขวอนใช้เพื่อเปรียบเทียบกับเกณฑ์เกาหลีเท่านั้น`,
      `💵 На самом деле вы получаете доллары ($${finalUsd.toLocaleString('en-US')}) напрямую — сумма в вонах приведена только для сравнения с корейской базой`,
      {
        ar: `💵 في الواقع تحصل على دولارات ($${finalUsd.toLocaleString('en-US')}) مباشرة — رقم الوون هو فقط للمقارنة مع الأساس الكوري`,
        bn: `💵 আপনি আসলে সরাসরি ডলার ($${finalUsd.toLocaleString('en-US')}) পাবেন — ওন অঙ্কটি শুধু কোরিয়ার ভিত্তির সাথে তুলনার জন্য`,
        fr: `💵 Vous recevez en réalité directement des USD ($${finalUsd.toLocaleString('en-US')}) — le chiffre en KRW sert uniquement à comparer avec la base coréenne`,
        hi: `💵 आपको असल में सीधे डॉलर ($${finalUsd.toLocaleString('en-US')}) मिलते हैं — KRW आंकड़ा सिर्फ कोरिया आधार से तुलना के लिए है`,
        id: `💵 Kamu sebenarnya menerima USD ($${finalUsd.toLocaleString('en-US')}) langsung — angka KRW hanya untuk perbandingan dengan dasar Korea`,
        ja: `💵 実際にはドル（$${finalUsd.toLocaleString('en-US')}）でそのまま受け取ります — ウォン表示は韓国基準との比較用です`,
        kk: `💵 Іс жүзінде сіз доллармен ($${finalUsd.toLocaleString('en-US')}) тікелей аласыз — вон сомасы Корея негізімен салыстыру үшін ғана`,
        km: `💵 តាមពិតអ្នកទទួលបានជាដុល្លារ ($${finalUsd.toLocaleString('en-US')}) ដោយផ្ទាល់ — តួលេខវ៉ុនគឺសម្រាប់ប្រៀបធៀបជាមួយមូលដ្ឋានកូរ៉េប៉ុណ្ណោះ`,
        ky: `💵 Чындыгында сиз түз эле доллар ($${finalUsd.toLocaleString('en-US')}) аласыз — вон суммасы Корея негизи менен салыштыруу үчүн гана`,
        lo: `💵 ຕົວຈິງແລ້ວທ່ານໄດ້ຮັບເປັນໂດລາ ($${finalUsd.toLocaleString('en-US')}) ໂດຍກົງ — ຈຳນວນວອນແມ່ນສຳລັບປຽບທຽບກັບພື້ນຖານເກົາຫຼີເທົ່ານັ້ນ`,
        mn: `💵 Та бодит байдал дээр доллараар ($${finalUsd.toLocaleString('en-US')}) шууд авна — воны дүн зөвхөн Солонгосын суурьтай харьцуулахад зориулагдсан`,
        my: `💵 အမှန်တကယ်တွင် ဒေါ်လာ ($${finalUsd.toLocaleString('en-US')}) ကို တိုက်ရိုက်ရရှိမည် — ဝမ်းပမာဏသည် ကိုရီးယားအခြေခံနှင့် နှိုင်းယှဉ်ရန်အတွက်သာဖြစ်သည်`,
        ne: `💵 वास्तवमा तपाईंले सिधै डलर ($${finalUsd.toLocaleString('en-US')}) पाउनुहुन्छ — वोन अंक कोरिया आधारसँग तुलना गर्नका लागि मात्र हो`,
        si: `💵 ඔබ ඇත්ත වශයෙන්ම ඩොලර් ($${finalUsd.toLocaleString('en-US')}) සෘජුවම ලබා ගනී — වොන් අගය කොරියානු පදනම සමඟ සංසන්දනය සඳහා පමණි`,
        tl: `💵 Sa totoo lang, direktang tatanggap ka ng USD ($${finalUsd.toLocaleString('en-US')}) — ang KRW figure ay para lang sa paghahambing sa batayan ng Korea`,
        ur: `💵 آپ کو دراصل ڈالر ($${finalUsd.toLocaleString('en-US')}) براہ راست ملتے ہیں — وون کا ہندسہ صرف کوریائی بنیاد سے موازنے کے لیے ہے`,
        uz: `💵 Aslida siz to'g'ridan-to'g'ri dollar ($${finalUsd.toLocaleString('en-US')}) olasiz — von raqami faqat Koreya bazasi bilan taqqoslash uchun`,
      }
    );
    usdNote.style.display = 'block';

    // 중국 거주자는 실제 생활 통화가 위안화라, 달러 수령액만 보여주면 감이 잘 안 옴 —
    // 위안화 참고 환산액도 같이 보여줌(실시간 환율 시도, 실패 시 기본값 사용 — KRW와 동일한 방식)
    if (country === 'cn') {
      const finalCny = Math.round(finalUsd * EXCHANGE_RATE_CNY);
      cnyNote.textContent = pickLang(
        `💴 위안화로는 대략 ¥${finalCny.toLocaleString('zh-CN')}위안이에요 (참고용 환율)`,
        `💴 That's roughly ¥${finalCny.toLocaleString('en-US')} CNY (reference exchange rate)`,
        `💴 折合人民币约¥${finalCny.toLocaleString('zh-CN')}元（仅供参考的汇率）`,
        `💴 Tương đương khoảng ¥${finalCny.toLocaleString('vi-VN')} CNY (tỷ giá tham khảo)`,
        `💴 คิดเป็นประมาณ ¥${finalCny.toLocaleString('th-TH')} หยวน (อัตราแลกเปลี่ยนอ้างอิง)`,
        `💴 Это примерно ¥${finalCny.toLocaleString('ru-RU')} юаней (справочный курс)`,
        {
          ar: `💴 هذا تقريبًا ¥${finalCny.toLocaleString('en-US')} يوان صيني (سعر صرف مرجعي)`,
          bn: `💴 এটি প্রায় ¥${finalCny.toLocaleString('en-US')} CNY (রেফারেন্স বিনিময় হার)`,
          fr: `💴 Cela représente environ ¥${finalCny.toLocaleString('en-US')} CNY (taux de change de référence)`,
          hi: `💴 यह लगभग ¥${finalCny.toLocaleString('en-US')} CNY है (संदर्भ विनिमय दर)`,
          id: `💴 Itu sekitar ¥${finalCny.toLocaleString('en-US')} CNY (kurs referensi)`,
          ja: `💴 それはおよそ¥${finalCny.toLocaleString('en-US')} CNYです（参考為替レート）`,
          kk: `💴 Бұл шамамен ¥${finalCny.toLocaleString('en-US')} CNY (анықтамалық айырбас бағамы)`,
          km: `💴 នេះប្រហែល ¥${finalCny.toLocaleString('en-US')} CNY (អត្រាប្តូរប្រាក់សម្រាប់យោង)`,
          ky: `💴 Бул болжол менен ¥${finalCny.toLocaleString('en-US')} CNY (шилтемелик алмашуу курсу)`,
          lo: `💴 ນັ້ນປະມານ ¥${finalCny.toLocaleString('en-US')} CNY (ອັດຕາແລກປ່ຽນອ້າງອີງ)`,
          mn: `💴 Энэ нь ойролцоогоор ¥${finalCny.toLocaleString('en-US')} CNY (лавлагаа ханш)`,
          my: `💴 ၎င်းသည် ခန့်မှန်းခြေ ¥${finalCny.toLocaleString('en-US')} CNY ဖြစ်သည် (ရည်ညွှန်းငွေလဲနှုန်း)`,
          ne: `💴 यो लगभग ¥${finalCny.toLocaleString('en-US')} CNY हो (सन्दर्भ विनिमय दर)`,
          si: `💴 එය ආසන්න වශයෙන් ¥${finalCny.toLocaleString('en-US')} CNY වේ (යොමු විනිමය අනුපාතය)`,
          tl: `💴 Iyon ay humigit-kumulang ¥${finalCny.toLocaleString('en-US')} CNY (reference exchange rate)`,
          ur: `💴 یہ تقریباً ¥${finalCny.toLocaleString('en-US')} CNY ہے (حوالہ شرح مبادلہ)`,
          uz: `💴 Bu taxminan ¥${finalCny.toLocaleString('en-US')} CNY (ma'lumot uchun valyuta kursi)`,
        }
      );
      cnyNote.style.display = 'block';
    } else {
      cnyNote.style.display = 'none';
    }

    // 인도 거주자도 마찬가지로 실제 생활 통화가 루피라, 루피 참고 환산액을 같이 보여줌
    if (country === 'in') {
      const finalInr = Math.round(finalUsd * EXCHANGE_RATE_INR);
      inrNote.textContent = pickLang(
        `🇮🇳 루피로는 대략 ₹${finalInr.toLocaleString('en-IN')}루피예요 (참고용 환율)`,
        `🇮🇳 That's roughly ₹${finalInr.toLocaleString('en-IN')} INR (reference exchange rate)`,
        `🇮🇳 折合印度卢比约₹${finalInr.toLocaleString('en-IN')}（仅供参考的汇率）`,
        `🇮🇳 Tương đương khoảng ₹${finalInr.toLocaleString('en-IN')} INR (tỷ giá tham khảo)`,
        `🇮🇳 คิดเป็นประมาณ ₹${finalInr.toLocaleString('en-IN')} รูปี (อัตราแลกเปลี่ยนอ้างอิง)`,
        `🇮🇳 Это примерно ₹${finalInr.toLocaleString('en-IN')} рупий (справочный курс)`,
        {
          ar: `🇮🇳 هذا تقريبًا ₹${finalInr.toLocaleString('en-IN')} روبية هندية (سعر صرف مرجعي)`,
          bn: `🇮🇳 এটি প্রায় ₹${finalInr.toLocaleString('en-IN')} INR (রেফারেন্স বিনিময় হার)`,
          fr: `🇮🇳 Cela représente environ ₹${finalInr.toLocaleString('en-IN')} INR (taux de change de référence)`,
          hi: `🇮🇳 यह लगभग ₹${finalInr.toLocaleString('en-IN')} INR है (संदर्भ विनिमय दर)`,
          id: `🇮🇳 Itu sekitar ₹${finalInr.toLocaleString('en-IN')} INR (kurs referensi)`,
          ja: `🇮🇳 それはおよそ₹${finalInr.toLocaleString('en-IN')} INRです（参考為替レート）`,
          kk: `🇮🇳 Бұл шамамен ₹${finalInr.toLocaleString('en-IN')} INR (анықтамалық айырбас бағамы)`,
          km: `🇮🇳 នេះប្រហែល ₹${finalInr.toLocaleString('en-IN')} INR (អត្រាប្តូរប្រាក់សម្រាប់យោង)`,
          ky: `🇮🇳 Бул болжол менен ₹${finalInr.toLocaleString('en-IN')} INR (шилтемелик алмашуу курсу)`,
          lo: `🇮🇳 ນັ້ນປະມານ ₹${finalInr.toLocaleString('en-IN')} INR (ອັດຕາແລກປ່ຽນອ້າງອີງ)`,
          mn: `🇮🇳 Энэ нь ойролцоогоор ₹${finalInr.toLocaleString('en-IN')} INR (лавлагаа ханш)`,
          my: `🇮🇳 ၎င်းသည် ခန့်မှန်းခြေ ₹${finalInr.toLocaleString('en-IN')} INR ဖြစ်သည် (ရည်ညွှန်းငွေလဲနှုန်း)`,
          ne: `🇮🇳 यो लगभग ₹${finalInr.toLocaleString('en-IN')} INR हो (सन्दर्भ विनिमय दर)`,
          si: `🇮🇳 එය ආසන්න වශයෙන් ₹${finalInr.toLocaleString('en-IN')} INR වේ (යොමු විනිමය අනුපාතය)`,
          tl: `🇮🇳 Iyon ay humigit-kumulang ₹${finalInr.toLocaleString('en-IN')} INR (reference exchange rate)`,
          ur: `🇮🇳 یہ تقریباً ₹${finalInr.toLocaleString('en-IN')} INR ہے (حوالہ شرح مبادلہ)`,
          uz: `🇮🇳 Bu taxminan ₹${finalInr.toLocaleString('en-IN')} INR (ma'lumot uchun valyuta kursi)`,
        }
      );
      inrNote.style.display = 'block';
    } else {
      inrNote.style.display = 'none';
    }

    // cn·in을 제외한 나머지 나라도 실제 생활 통화가 달러가 아니라, 각자 통화 참고 환산액을 같이
    // 보여줌 — 구조는 다 동일하고 통화 기호/환율만 다르므로 하나의 참고표로 처리
    const LOCAL_CURRENCY_REF = {
      vn: { symbol: '₫', flagEmoji: '🇻🇳', rate: EXCHANGE_RATE_VND, locale: 'vi-VN', code: 'VND' },
      id: { symbol: 'Rp', flagEmoji: '🇮🇩', rate: EXCHANGE_RATE_IDR, locale: 'id-ID', code: 'IDR' },
      ph: { symbol: '₱', flagEmoji: '🇵🇭', rate: EXCHANGE_RATE_PHP, locale: 'en-PH', code: 'PHP' },
      th: { symbol: '฿', flagEmoji: '🇹🇭', rate: EXCHANGE_RATE_THB, locale: 'th-TH', code: 'THB' },
      jp: { symbol: '¥', flagEmoji: '🇯🇵', rate: EXCHANGE_RATE_JPY, locale: 'ja-JP', code: 'JPY' },
      ru: { symbol: '₽', flagEmoji: '🇷🇺', rate: EXCHANGE_RATE_RUB, locale: 'ru-RU', code: 'RUB' },
      np: { symbol: 'Rs', flagEmoji: '🇳🇵', rate: EXCHANGE_RATE_NPR, locale: 'ne-NP', code: 'NPR' },
      lk: { symbol: 'Rs', flagEmoji: '🇱🇰', rate: EXCHANGE_RATE_LKR, locale: 'si-LK', code: 'LKR' },
      uz: { symbol: '', flagEmoji: '🇺🇿', rate: EXCHANGE_RATE_UZS, locale: 'uz-UZ', code: 'UZS' },
      kz: { symbol: '', flagEmoji: '🇰🇿', rate: EXCHANGE_RATE_KZT, locale: 'kk-KZ', code: 'KZT' },
      kg: { symbol: '', flagEmoji: '🇰🇬', rate: EXCHANGE_RATE_KGS, locale: 'ky-KG', code: 'KGS' },
      mm: { symbol: 'K', flagEmoji: '🇲🇲', rate: EXCHANGE_RATE_MMK, locale: 'my-MM', code: 'MMK' },
      bd: { symbol: '৳', flagEmoji: '🇧🇩', rate: EXCHANGE_RATE_BDT, locale: 'bn-BD', code: 'BDT' },
      pk: { symbol: 'Rs', flagEmoji: '🇵🇰', rate: EXCHANGE_RATE_PKR, locale: 'ur-PK', code: 'PKR' },
      kh: { symbol: '៛', flagEmoji: '🇰🇭', rate: EXCHANGE_RATE_KHR, locale: 'km-KH', code: 'KHR' },
      mn: { symbol: '₮', flagEmoji: '🇲🇳', rate: EXCHANGE_RATE_MNT, locale: 'mn-MN', code: 'MNT' },
      la: { symbol: '₭', flagEmoji: '🇱🇦', rate: EXCHANGE_RATE_LAK, locale: 'lo-LA', code: 'LAK' }
    };
    if (otherNote && LOCAL_CURRENCY_REF[country]) {
      const ref = LOCAL_CURRENCY_REF[country];
      const finalLocal = Math.round(finalUsd * ref.rate);
      otherNote.textContent = pickLang(
        `${ref.flagEmoji} ${ref.code}로는 대략 ${ref.symbol}${finalLocal.toLocaleString(ref.locale)}이에요 (참고용 환율)`,
        `${ref.flagEmoji} That's roughly ${ref.symbol}${finalLocal.toLocaleString('en-US')} ${ref.code} (reference exchange rate)`,
        `${ref.flagEmoji} 折合${ref.code}约${ref.symbol}${finalLocal.toLocaleString(ref.locale)}（仅供参考的汇率）`,
        `${ref.flagEmoji} Tương đương khoảng ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (tỷ giá tham khảo)`,
        `${ref.flagEmoji} คิดเป็นประมาณ ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (อัตราแลกเปลี่ยนอ้างอิง)`,
        `${ref.flagEmoji} Это примерно ${ref.symbol}${finalLocal.toLocaleString('ru-RU')} ${ref.code} (справочный курс)`,
        {
          ar: `${ref.flagEmoji} هذا تقريبًا ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (سعر صرف مرجعي)`,
          bn: `${ref.flagEmoji} এটি প্রায় ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (রেফারেন্স বিনিময় হার)`,
          fr: `${ref.flagEmoji} Cela représente environ ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (taux de change de référence)`,
          hi: `${ref.flagEmoji} यह लगभग ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} है (संदर्भ विनिमय दर)`,
          id: `${ref.flagEmoji} Itu sekitar ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (kurs referensi)`,
          ja: `${ref.flagEmoji} それはおよそ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code}です（参考為替レート）`,
          kk: `${ref.flagEmoji} Бұл шамамен ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (анықтамалық айырбас бағамы)`,
          km: `${ref.flagEmoji} នេះប្រហែល ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (អត្រាប្តូរប្រាក់សម្រាប់យោង)`,
          ky: `${ref.flagEmoji} Бул болжол менен ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (шилтемелик алмашуу курсу)`,
          lo: `${ref.flagEmoji} ນັ້ນປະມານ ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (ອັດຕາແລກປ່ຽນອ້າງອີງ)`,
          mn: `${ref.flagEmoji} Энэ нь ойролцоогоор ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (лавлагаа ханш)`,
          my: `${ref.flagEmoji} ၎င်းသည် ခန့်မှန်းခြေ ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} ဖြစ်သည် (ရည်ညွှန်းငွေလဲနှုန်း)`,
          ne: `${ref.flagEmoji} यो लगभग ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} हो (सन्दर्भ विनिमय दर)`,
          si: `${ref.flagEmoji} එය ආසන්න වශයෙන් ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} වේ (යොමු විනිමය අනුපාතය)`,
          tl: `${ref.flagEmoji} Iyon ay humigit-kumulang ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (reference exchange rate)`,
          ur: `${ref.flagEmoji} یہ تقریباً ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} ہے (حوالہ شرح مبادلہ)`,
          uz: `${ref.flagEmoji} Bu taxminan ${ref.symbol}${finalLocal.toLocaleString(ref.locale)} ${ref.code} (ma'lumot uchun valyuta kursi)`,
        }
      );
      otherNote.style.display = 'block';
    } else if (otherNote) {
      otherNote.style.display = 'none';
    }
  } else {
    usdNote.style.display = 'none';
    cnyNote.style.display = 'none';
    inrNote.style.display = 'none';
    if (otherNote) otherNote.style.display = 'none';
  }

  const showFiling = (country === 'us');
  document.getElementById('home-state-row').style.display = showFiling ? 'flex' : 'none';
  document.getElementById('home-state-label').style.display = showFiling ? 'block' : 'none';
  const stateCompareToggle = document.getElementById('usStateCompareToggle');
  stateCompareToggle.style.display = showFiling ? 'block' : 'none';
  if (showFiling) renderUsStateCompareTable(억);
  else stateCompareToggle.open = false;
  updateFlexBox(final, country);
  document.getElementById('home-filing-label').style.display = showFiling ? 'block' : 'none';
  document.getElementById('home-filing-small').style.display = showFiling ? 'block' : 'none';
  const filingNote = document.getElementById('home-filing-note');
  if (!showFiling) {
    filingNote.innerHTML = (country === 'cn')
      ? pickLang(
          '💡 중국 거주자는 어느 <span style="white-space:nowrap">주(State)에서</span> 당첨되든 미국 비거주자 <span style="white-space:nowrap">원천징수(30%)가</span> 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 China residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 中国税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Cư dân Trung Quốc đều chịu mức khấu trừ 30% cho người không cư trú tại Mỹ bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ผู้พำนักในจีนจะเสียภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Резиденты Китая платят одинаковые 30% удержания для нерезидентов США независимо от штата выигрыша — налог штата учитывать не нужно.',
          { ar:'💡 يواجه المقيمون في الصين نفس نسبة الاستقطاع 30% لغير المقيمين في الولايات المتحدة بغض النظر عن الولاية التي فازوا فيها — لا داعي لحساب ضريبة الولاية.', bn:'💡 চীনা বাসিন্দারা যে রাজ্যেই জিতুক না কেন একই ৩০% মার্কিন অনাবাসী উৎসকর প্রযোজ্য হয় — রাজ্য কর আলাদাভাবে হিসাব করার দরকার নেই।', fr:"💡 Les résidents chinois font face à la même retenue de 30% pour non-résidents américains, quel que soit l'État où ils ont gagné — pas besoin de tenir compte de l'impôt d'État.", hi:'💡 चीनी निवासियों को चाहे किसी भी राज्य में जीत मिले, अमेरिकी गैर-निवासी 30% कटौती समान रूप से लागू होती है — राज्य कर अलग से जोड़ने की जरूरत नहीं।', id:'💡 Penduduk Tiongkok menghadapi pemotongan bukan penduduk AS sebesar 30% yang sama terlepas dari negara bagian mana mereka menang — tidak perlu memperhitungkan pajak negara bagian.', ja:'💡 中国居住者はどの州で当選しても同じ米国非居住者源泉徴収（30%）が適用されます — 州税を別途計算する必要はありません。', kk:'💡 Қытай резиденттері қай штатта ұтқанына қарамастан бірдей 30% АҚШ резидент емес адамдарға арналған ұстап қалуға тап болады — штат салығын есептеудің қажеті жоқ.', km:'💡 អ្នករស់នៅប្រទេសចិនប្រឈមមុខនឹងការកាត់ទុក 30% ដូចគ្នាសម្រាប់អ្នកមិនមែនអ្នករស់នៅអាមេរិក ដោយមិនគិតពីរដ្ឋដែលពួកគេឈ្នះ — មិនចាំបាច់គិតពន្ធរដ្ឋបន្ថែមទេ។', ky:'💡 Кытай резиденттери кайсы штатта уткандыгына карабастан бирдей 30% АКШнын резидент эмес адамдар үчүн кармап калуу коэффициентине туш болушат — штат салыгын эсептөөнүн кереги жок.', lo:'💡 ຜູ້ພຳນັກໃນຈີນຈະໄດ້ຮັບການຫັກພາສີ 30% ຜູ້ບໍ່ມີຖິ່ນພຳນັກໃນສະຫະລັດຄືກັນ ບໍ່ວ່າຈະຖືກລາງວັນໃນລັດໃດ — ບໍ່ຕ້ອງຄິດໄລ່ພາສີລັດເພີ່ມ.', mn:'💡 Хятадын оршин суугчид ямар мужид хожсноос үл хамааран ижил 30% АНУ-ын оршин суугч бус хувийн суутгалд өртдөг — мужийн татварыг тусад нь тооцох шаардлагагүй.', my:'💡 တရုတ်နိုင်ငံသားများသည် မည်သည့်ပြည်နယ်တွင် ဆွတ်ခူးစေကာမူ တူညီသော အမေရိကန် နေထိုင်သူမဟုတ်သူ ၃၀% ခုနှိမ်ခြင်းကို ရင်ဆိုင်ကြရသည် — ပြည်နယ်အခွန်ကို ထပ်မံတွက်ချက်စရာမလိုပါ။', ne:'💡 चिनियाँ बासिन्दाहरूले जुनसुकै राज्यमा जितेपनि उही ३०% अमेरिकी गैर-बासिन्दा कट्टी सामना गर्नुपर्छ — राज्य कर छुट्टै गणना गर्न आवश्यक छैन।', si:'💡 චීන පදිංචිකරුවන් ඔවුන් දිනූ ප්‍රාන්තය කුමක් වුවත් එකම 30% ඇමරිකානු පදිංචිකරුවකු නොවන අයට වන අඩු කිරීමට මුහුණ දෙයි — ප්‍රාන්ත බද්ද වෙන වශයෙන් සලකා බැලීමට අවශ්‍ය නැත.', tl:'💡 Ang mga residente ng China ay may parehong 30% US non-resident withholding anuman ang estadong pinanalunan nila — hindi na kailangang isama ang buwis ng estado.', ur:'💡 چینی رہائشیوں کو خواہ کسی بھی ریاست میں جیت ملے، امریکی غیر رہائشی 30% کٹوتی یکساں طور پر لاگو ہوتی ہے — ریاستی ٹیکس الگ سے شمار کرنے کی ضرورت نہیں۔', uz:"💡 Xitoy rezidentlari qaysi shtatda yutishidan qat'i nazar bir xil 30% AQSh norezident ushlab qolish stavkasiga duch keladi — shtat solig'ini alohida hisoblash shart emas." }
        )
      : (country === 'in')
      ? pickLang(
          '💡 인도 거주자는 어느 <span style="white-space:nowrap">주(State)에서</span> 당첨되든 미국 비거주자 <span style="white-space:nowrap">원천징수(30%)가</span> 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 India residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 印度税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Cư dân Ấn Độ đều chịu mức khấu trừ 30% cho người không cư trú tại Mỹ bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ผู้พำนักในอินเดียจะเสียภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Резиденты Индии платят одинаковые 30% удержания для нерезидентов США независимо от штата выигрыша — налог штата учитывать не нужно.',
          { ar:'💡 يواجه المقيمون في الهند نفس نسبة الاستقطاع 30% لغير المقيمين في الولايات المتحدة بغض النظر عن الولاية التي فازوا فيها — لا داعي لحساب ضريبة الولاية.', bn:'💡 ভারতীয় বাসিন্দারা যে রাজ্যেই জিতুক না কেন একই ৩০% মার্কিন অনাবাসী উৎসকর প্রযোজ্য হয় — রাজ্য কর আলাদাভাবে হিসাব করার দরকার নেই।', fr:"💡 Les résidents indiens font face à la même retenue de 30% pour non-résidents américains, quel que soit l'État où ils ont gagné — pas besoin de tenir compte de l'impôt d'État.", hi:'💡 भारतीय निवासियों को चाहे किसी भी राज्य में जीत मिले, अमेरिकी गैर-निवासी 30% कटौती समान रूप से लागू होती है — राज्य कर अलग से जोड़ने की जरूरत नहीं।', id:'💡 Penduduk India menghadapi pemotongan bukan penduduk AS sebesar 30% yang sama terlepas dari negara bagian mana mereka menang — tidak perlu memperhitungkan pajak negara bagian.', ja:'💡 インド居住者はどの州で当選しても同じ米国非居住者源泉徴収（30%）が適用されます — 州税を別途計算する必要はありません。', kk:'💡 Үндістан резиденттері қай штатта ұтқанына қарамастан бірдей 30% АҚШ резидент емес адамдарға арналған ұстап қалуға тап болады — штат салығын есептеудің қажеті жоқ.', km:'💡 អ្នករស់នៅប្រទេសឥណ្ឌាប្រឈមមុខនឹងការកាត់ទុក 30% ដូចគ្នាសម្រាប់អ្នកមិនមែនអ្នករស់នៅអាមេរិក ដោយមិនគិតពីរដ្ឋដែលពួកគេឈ្នះ — មិនចាំបាច់គិតពន្ធរដ្ឋបន្ថែមទេ។', ky:'💡 Индия резиденттери кайсы штатта уткандыгына карабастан бирдей 30% АКШнын резидент эмес адамдар үчүн кармап калуу коэффициентине туш болушат — штат салыгын эсептөөнүн кереги жок.', lo:'💡 ຜູ້ພຳນັກໃນອິນເດຍຈະໄດ້ຮັບການຫັກພາສີ 30% ຜູ້ບໍ່ມີຖິ່ນພຳນັກໃນສະຫະລັດຄືກັນ ບໍ່ວ່າຈະຖືກລາງວັນໃນລັດໃດ — ບໍ່ຕ້ອງຄິດໄລ່ພາສີລັດເພີ່ມ.', mn:'💡 Энэтхэгийн оршин суугчид ямар мужид хожсноос үл хамааран ижил 30% АНУ-ын оршин суугч бус хувийн суутгалд өртдөг — мужийн татварыг тусад нь тооцох шаардлагагүй.', my:'💡 အိန္ဒိယနိုင်ငံသားများသည် မည်သည့်ပြည်နယ်တွင် ဆွတ်ခူးစေကာမူ တူညီသော အမေရိကန် နေထိုင်သူမဟုတ်သူ ၃၀% ခုနှိမ်ခြင်းကို ရင်ဆိုင်ကြရသည် — ပြည်နယ်အခွန်ကို ထပ်မံတွက်ချက်စရာမလိုပါ။', ne:'💡 भारतीय बासिन्दाहरूले जुनसुकै राज्यमा जितेपनि उही ३०% अमेरिकी गैर-बासिन्दा कट्टी सामना गर्नुपर्छ — राज्य कर छुट्टै गणना गर्न आवश्यक छैन।', si:'💡 ඉන්දියානු පදිංචිකරුවන් ඔවුන් දිනූ ප්‍රාන්තය කුමක් වුවත් එකම 30% ඇමරිකානු පදිංචිකරුවකු නොවන අයට වන අඩු කිරීමට මුහුණ දෙයි — ප්‍රාන්ත බද්ද වෙන වශයෙන් සලකා බැලීමට අවශ්‍ය නැත.', tl:'💡 Ang mga residente ng India ay may parehong 30% US non-resident withholding anuman ang estadong pinanalunan nila — hindi na kailangang isama ang buwis ng estado.', ur:'💡 بھارتی رہائشیوں کو خواہ کسی بھی ریاست میں جیت ملے، امریکی غیر رہائشی 30% کٹوتی یکساں طور پر لاگو ہوتی ہے — ریاستی ٹیکس الگ سے شمار کرنے کی ضرورت نہیں۔', uz:"💡 Hindiston rezidentlari qaysi shtatda yutishidan qat'i nazar bir xil 30% AQSh norezident ushlab qolish stavkasiga duch keladi — shtat solig'ini alohida hisoblash shart emas." }
        )
      : (country !== 'kr')
      ? pickLang(
          '💡 어느 <span style="white-space:nowrap">주(State)에서</span> 당첨되든 미국 비거주자 <span style="white-space:nowrap">원천징수(30%)가</span> 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 The same 30% US non-resident withholding applies regardless of which state you won in — no need to factor in state tax.',
          '💡 无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Mức khấu trừ 30% cho người không cư trú tại Mỹ áp dụng như nhau bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Одинаковые 30% удержания для нерезидентов США применяются независимо от штата выигрыша — налог штата учитывать не нужно.',
          { ar:'💡 يُطبَّق نفس معدل الاستقطاع 30% لغير المقيمين في الولايات المتحدة بغض النظر عن الولاية التي فزت فيها — لا داعي لحساب ضريبة الولاية.', bn:'💡 আপনি যে রাজ্যেই জিতুন না কেন একই ৩০% মার্কিন অনাবাসী উৎসকর প্রযোজ্য হয় — রাজ্য কর আলাদাভাবে হিসাব করার দরকার নেই।', fr:"💡 La même retenue de 30% pour non-résidents américains s'applique quel que soit l'État où vous avez gagné — pas besoin de tenir compte de l'impôt d'État.", hi:'💡 आप चाहे किसी भी राज्य में जीतें, वही अमेरिकी गैर-निवासी 30% कटौती लागू होती है — राज्य कर अलग से जोड़ने की जरूरत नहीं।', id:'💡 Pemotongan bukan penduduk AS sebesar 30% yang sama berlaku terlepas dari negara bagian mana kamu menang — tidak perlu memperhitungkan pajak negara bagian.', ja:'💡 どの州で当選しても同じ米国非居住者源泉徴収（30%）が適用されます — 州税を別途計算する必要はありません。', kk:'💡 Қай штатта ұтқаныңызға қарамастан бірдей 30% АҚШ резидент емес адамдарға арналған ұстап қалу қолданылады — штат салығын есептеудің қажеті жоқ.', km:'💡 អត្រាកាត់ទុក 30% ដូចគ្នាសម្រាប់អ្នកមិនមែនអ្នករស់នៅអាមេរិកអនុវត្តដោយមិនគិតពីរដ្ឋដែលអ្នកឈ្នះ — មិនចាំបាច់គិតពន្ធរដ្ឋបន្ថែមទេ។', ky:'💡 Кайсы штатта уткандыгыңызга карабастан бирдей 30% АКШнын резидент эмес адамдар үчүн кармап калуу коэффициенти колдонулат — штат салыгын эсептөөнүн кереги жок.', lo:'💡 ອັດຕາການຫັກພາສີ 30% ຜູ້ບໍ່ມີຖິ່ນພຳນັກໃນສະຫະລັດຄືກັນຈະຖືກນຳໃຊ້ ບໍ່ວ່າຈະຖືກລາງວັນໃນລັດໃດ — ບໍ່ຕ້ອງຄິດໄລ່ພາສີລັດເພີ່ມ.', mn:'💡 Ямар мужид хожсноос үл хамааран ижил 30% АНУ-ын оршин суугч бус хувийн суутгал хэрэглэгддэг — мужийн татварыг тусад нь тооцох шаардлагагүй.', my:'💡 မည်သည့်ပြည်နယ်တွင် ဆွတ်ခူးစေကာမူ တူညီသော အမေရိကန် နေထိုင်သူမဟုတ်သူ ၃၀% ခုနှိမ်ခြင်းကို အသုံးပြုသည် — ပြည်နယ်အခွန်ကို ထပ်မံတွက်ချက်စရာမလိုပါ။', ne:'💡 तपाईंले जुनसुकै राज्यमा जित्नुभए पनि उही ३०% अमेरिकी गैर-बासिन्दा कट्टी लागू हुन्छ — राज्य कर छुट्टै गणना गर्न आवश्यक छैन।', si:'💡 ඔබ දිනූ ප්‍රාන්තය කුමක් වුවත් එකම 30% ඇමරිකානු පදිංචිකරුවකු නොවන අයට වන අඩු කිරීම අදාළ වේ — ප්‍රාන්ත බද්ද වෙන වශයෙන් සලකා බැලීමට අවශ්‍ය නැත.', tl:'💡 Parehong 30% US non-resident withholding ang mag-aapply anuman ang estadong pinanalunan mo — hindi na kailangang isama ang buwis ng estado.', ur:'💡 آپ خواہ کسی بھی ریاست میں جیتیں، وہی امریکی غیر رہائشی 30% کٹوتی لاگو ہوتی ہے — ریاستی ٹیکس الگ سے شمار کرنے کی ضرورت نہیں۔', uz:"💡 Qaysi shtatda yutganingizdan qat'i nazar bir xil 30% AQSh norezident ushlab qolish stavkasi qo'llaniladi — shtat solig'ini alohida hisoblash shart emas." }
        )
      : pickLang(
          '💡 한국 거주자는 어느 <span style="white-space:nowrap">주(State)에서</span> 당첨되든 미국 비거주자 <span style="white-space:nowrap">원천징수(30%)가</span> 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 Korean residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 韩国税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Cư dân Hàn Quốc đều chịu mức khấu trừ 30% cho người không cư trú tại Mỹ bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ผู้พำนักในเกาหลีจะเสียภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Резиденты Кореи платят одинаковые 30% удержания для нерезидентов США независимо от штата выигрыша — налог штата учитывать не нужно.',
          { ar:'💡 يواجه المقيمون في كوريا نفس نسبة الاستقطاع 30% لغير المقيمين في الولايات المتحدة بغض النظر عن الولاية التي فازوا فيها — لا داعي لحساب ضريبة الولاية.', bn:'💡 কোরিয়ান বাসিন্দারা যে রাজ্যেই জিতুক না কেন একই ৩০% মার্কিন অনাবাসী উৎসকর প্রযোজ্য হয় — রাজ্য কর আলাদাভাবে হিসাব করার দরকার নেই।', fr:"💡 Les résidents coréens font face à la même retenue de 30% pour non-résidents américains, quel que soit l'État où ils ont gagné — pas besoin de tenir compte de l'impôt d'État.", hi:'💡 कोरियाई निवासियों को चाहे किसी भी राज्य में जीत मिले, अमेरिकी गैर-निवासी 30% कटौती समान रूप से लागू होती है — राज्य कर अलग से जोड़ने की जरूरत नहीं।', id:'💡 Penduduk Korea menghadapi pemotongan bukan penduduk AS sebesar 30% yang sama terlepas dari negara bagian mana mereka menang — tidak perlu memperhitungkan pajak negara bagian.', ja:'💡 韓国居住者はどの州で当選しても同じ米国非居住者源泉徴収（30%）が適用されます — 州税を別途計算する必要はありません。', kk:'💡 Корея резиденттері қай штатта ұтқанына қарамастан бірдей 30% АҚШ резидент емес адамдарға арналған ұстап қалуға тап болады — штат салығын есептеудің қажеті жоқ.', km:'💡 អ្នករស់នៅកូរ៉េប្រឈមមុខនឹងការកាត់ទុក 30% ដូចគ្នាសម្រាប់អ្នកមិនមែនអ្នករស់នៅអាមេរិក ដោយមិនគិតពីរដ្ឋដែលពួកគេឈ្នះ — មិនចាំបាច់គិតពន្ធរដ្ឋបន្ថែមទេ។', ky:'💡 Корея резиденттери кайсы штатта уткандыгына карабастан бирдей 30% АКШнын резидент эмес адамдар үчүн кармап калуу коэффициентине туш болушат — штат салыгын эсептөөнүн кереги жок.', lo:'💡 ຜູ້ພຳນັກໃນເກົາຫຼີຈະໄດ້ຮັບການຫັກພາສີ 30% ຜູ້ບໍ່ມີຖິ່ນພຳນັກໃນສະຫະລັດຄືກັນ ບໍ່ວ່າຈະຖືກລາງວັນໃນລັດໃດ — ບໍ່ຕ້ອງຄິດໄລ່ພາສີລັດເພີ່ມ.', mn:'💡 Солонгосын оршин суугчид ямар мужид хожсноос үл хамааран ижил 30% АНУ-ын оршин суугч бус хувийн суутгалд өртдөг — мужийн татварыг тусад нь тооцох шаардлагагүй.', my:'💡 ကိုရီးယားနိုင်ငံသားများသည် မည်သည့်ပြည်နယ်တွင် ဆွတ်ခူးစေကာမူ တူညီသော အမေရိကန် နေထိုင်သူမဟုတ်သူ ၃၀% ခုနှိမ်ခြင်းကို ရင်ဆိုင်ကြရသည် — ပြည်နယ်အခွန်ကို ထပ်မံတွက်ချက်စရာမလိုပါ။', ne:'💡 कोरियाली बासिन्दाहरूले जुनसुकै राज्यमा जितेपनि उही ३०% अमेरिकी गैर-बासिन्दा कट्टी सामना गर्नुपर्छ — राज्य कर छुट्टै गणना गर्न आवश्यक छैन।', si:'💡 කොරියානු පදිංචිකරුවන් ඔවුන් දිනූ ප්‍රාන්තය කුමක් වුවත් එකම 30% ඇමරිකානු පදිංචිකරුවකු නොවන අයට වන අඩු කිරීමට මුහුණ දෙයි — ප්‍රාන්ත බද්ද වෙන වශයෙන් සලකා බැලීමට අවශ්‍ය නැත.', tl:'💡 Ang mga residente ng Korea ay may parehong 30% US non-resident withholding anuman ang estadong pinanalunan nila — hindi na kailangang isama ang buwis ng estado.', ur:'💡 کوریائی رہائشیوں کو خواہ کسی بھی ریاست میں جیت ملے، امریکی غیر رہائشی 30% کٹوتی یکساں طور پر لاگو ہوتی ہے — ریاستی ٹیکس الگ سے شمار کرنے کی ضرورت نہیں۔', uz:"💡 Koreya rezidentlari qaysi shtatda yutishidan qat'i nazar bir xil 30% AQSh norezident ushlab qolish stavkasiga duch keladi — shtat solig'ini alohida hisoblash shart emas." }
        );
  }
  filingNote.style.display = showFiling ? 'none' : 'block';

  // 세율 자체 또는 실제 적용 여부가 불확실한 나라만 별도 경고 배너로 표시 — 목록은 COUNTRY_TAX_DISCLAIMERS 참고
  const countryDisclaimer = document.getElementById('home-country-disclaimer');
  if (countryDisclaimer) {
    const noteFn = COUNTRY_TAX_DISCLAIMERS[country];
    if (noteFn) {
      countryDisclaimer.textContent = noteFn();
      countryDisclaimer.style.display = 'block';
    } else {
      countryDisclaimer.style.display = 'none';
    }
  }

  refreshDreamResultIfOpen(formatWon(final));
}

function onCompareAmountTyped(){
  const rawValue = document.getElementById('amountInput').value;
  if (rawValue.trim() !== '') isAmountManuallyEdited = true;
  const millions = parseMillionsInput(rawValue);
  const slider = document.getElementById('compareAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.step = 1;
  slider.min = Math.min(10, Math.round(millions));
  slider.value = Math.round(millions);
  updateSliderFill(slider);
  updateCalc(rawValue.trim() === '' ? undefined : millions * 1000000);
}

function onCompareSliderMoved(){
  isAmountManuallyEdited = true;
  const slider = document.getElementById('compareAmountSlider');
  slider.step = 10;
  const usdMillions = Number(slider.value);
  document.getElementById('amountInput').value = usdMillions;
  updateSliderFill(slider);
  updateCalc(usdMillions * 1000000);
}

function onCompareRateChanged(){
  isRateManuallyEdited = true;
  exchangeRateIsLive = false; // 수동으로 값을 고쳤으니 더 이상 "실시간 환율"이 아님
  exchangeRateFetchFailed = false;
  EXCHANGE_RATE = parseRateInput(document.getElementById('compare-rate-input').value);
  updateExchangeRateBadges();
  updateCalc();
  initJackpotCardAmt();
  refreshJackpotDrawerIfOpen();
}

function updateCalc(usdOverride){
  // 입력창이 비어있을 땐 0으로 계산하지 않고 마지막 유효값(sharedAmountUsd)을 씀 — updateHomeCalc()와
  // 동일한 패턴. 이게 없으면 입력칸을 지웠을 때 실수령액이 0으로 고정되고, 그 상태로 홈 화면에
  // 돌아가도(공유 상태라) 0이 그대로 유지되는 버그가 있었음
  const typedValue = parseMillionsInput(document.getElementById('amountInput').value);
  const usd = usdOverride !== undefined ? usdOverride : (typedValue > 0 ? typedValue * 1000000 : sharedAmountUsd);
  const stateCode = document.getElementById('compareStateSelect').value;
  sharedAmountUsd = usd;
  sharedState = stateCode;
  // sharedCountry가 'us'일 때만 실제로 랭킹 계산에 영향을 주지만(calcTakeHome은 country !== 'us'면
  // stateCode를 무시함), updateHomeCalc()와 동일하게 상태 변경 시마다 무조건 다시 그려서 확률체감
  // 탭이 이미 열려 있어도 즉시 반영되게 함 — renderJackpotTakeHomeRanking()은 안전하게 스킵 가능
  renderJackpotTakeHomeRanking();
  const 억 = (usd * EXCHANGE_RATE) / 100000000;

  document.getElementById('compare-krw-amt').textContent = formatWon(억);

  // "나라별로 나란히 놓고 보면" 표가 위 입력창이랑 연결돼 보이지 않는다는 지적(사용자가 직접
  // 스크린샷으로 지적) — 제목 아래 별도 문장 대신, 제목 자체에 금액을 붙여서 굵은 제목만 훑어도
  // 바로 기준이 보이게 함("100M USD 당첨 · 한국 거주자"처럼 이미 쓰는 "금액 · 라벨" 표기 재사용,
  // 언어별 문장을 새로 안 만들어도 됨)
  const usdMillionsForNote = Math.round(usd / 1000000).toLocaleString(LOCALE_MAP[currentLang] || 'ko-KR');
  document.getElementById('compare-side-title-amt').textContent = usdMillionsForNote + 'M USD · ';

  updateSideBySide(억, stateCode);
}

// COUNTRY_TAX_PROFILES 라벨·calcTakeHome()의 basisSuffix는 원래 ko/en/zh/vi/th/ru 6개 언어만
// 커버해서, 나머지 17개 언어(아랍어·벵골어·프랑스어·힌디어·인도네시아어·일본어·카자흐어·크메르어·
// 키르기스어·라오어·몽골어·미얀마어·네팔어·신할라어·타갈로그어·우르두어·우즈베크어)에서는 나라 이름이
// 전부 영어로 조용히 대체되고 있었음(일본어 화면에서 숫자는 일본어인데 나라 이름만 영어로 나오는 등)
// — 21개국 × 17개 언어 나라 이름표를 만들어 pickLang()의 7번째 more 인자로 채움
const COUNTRY_NAMES_MORE = {
  ar: { kr:'كوريا الجنوبية', us:'الولايات المتحدة', vn:'فيتنام', cn:'الصين', in:'الهند', id:'إندونيسيا', ph:'الفلبين', th:'تايلاند', jp:'اليابان', ru:'روسيا', np:'نيبال', lk:'سريلانكا', uz:'أوزبكستان', kz:'كازاخستان', kg:'قيرغيزستان', mm:'ميانمار', bd:'بنغلاديش', pk:'باكستان', kh:'كمبوديا', mn:'منغوليا', la:'لاوس' },
  bn: { kr:'দক্ষিণ কোরিয়া', us:'যুক্তরাষ্ট্র', vn:'ভিয়েতনাম', cn:'চীন', in:'ভারত', id:'ইন্দোনেশিয়া', ph:'ফিলিপাইন', th:'থাইল্যান্ড', jp:'জাপান', ru:'রাশিয়া', np:'নেপাল', lk:'শ্রীলঙ্কা', uz:'উজবেকিস্তান', kz:'কাজাখস্তান', kg:'কিরগিজস্তান', mm:'মিয়ানমার', bd:'বাংলাদেশ', pk:'পাকিস্তান', kh:'কম্বোডিয়া', mn:'মঙ্গোলিয়া', la:'লাওস' },
  fr: { kr:'Corée du Sud', us:'États-Unis', vn:'Vietnam', cn:'Chine', in:'Inde', id:'Indonésie', ph:'Philippines', th:'Thaïlande', jp:'Japon', ru:'Russie', np:'Népal', lk:'Sri Lanka', uz:'Ouzbékistan', kz:'Kazakhstan', kg:'Kirghizistan', mm:'Myanmar', bd:'Bangladesh', pk:'Pakistan', kh:'Cambodge', mn:'Mongolie', la:'Laos' },
  hi: { kr:'दक्षिण कोरिया', us:'अमेरिका', vn:'वियतनाम', cn:'चीन', in:'भारत', id:'इंडोनेशिया', ph:'फिलीपींस', th:'थाईलैंड', jp:'जापान', ru:'रूस', np:'नेपाल', lk:'श्रीलंका', uz:'उज़्बेकिस्तान', kz:'कज़ाकिस्तान', kg:'किर्गिज़स्तान', mm:'म्यांमार', bd:'बांग्लादेश', pk:'पाकिस्तान', kh:'कंबोडिया', mn:'मंगोलिया', la:'लाओस' },
  id: { kr:'Korea Selatan', us:'Amerika Serikat', vn:'Vietnam', cn:'Tiongkok', in:'India', id:'Indonesia', ph:'Filipina', th:'Thailand', jp:'Jepang', ru:'Rusia', np:'Nepal', lk:'Sri Lanka', uz:'Uzbekistan', kz:'Kazakhstan', kg:'Kirgistan', mm:'Myanmar', bd:'Bangladesh', pk:'Pakistan', kh:'Kamboja', mn:'Mongolia', la:'Laos' },
  ja: { kr:'韓国', us:'アメリカ', vn:'ベトナム', cn:'中国', in:'インド', id:'インドネシア', ph:'フィリピン', th:'タイ', jp:'日本', ru:'ロシア', np:'ネパール', lk:'スリランカ', uz:'ウズベキスタン', kz:'カザフスタン', kg:'キルギス', mm:'ミャンマー', bd:'バングラデシュ', pk:'パキスタン', kh:'カンボジア', mn:'モンゴル', la:'ラオス' },
  kk: { kr:'Оңтүстік Корея', us:'АҚШ', vn:'Вьетнам', cn:'Қытай', in:'Үндістан', id:'Индонезия', ph:'Филиппин', th:'Тайланд', jp:'Жапония', ru:'Ресей', np:'Непал', lk:'Шри-Ланка', uz:'Өзбекстан', kz:'Қазақстан', kg:'Қырғызстан', mm:'Мьянма', bd:'Бангладеш', pk:'Пәкістан', kh:'Камбоджа', mn:'Моңғолия', la:'Лаос' },
  km: { kr:'កូរ៉េខាងត្បូង', us:'សហរដ្ឋអាមេរិក', vn:'វៀតណាម', cn:'ចិន', in:'ឥណ្ឌា', id:'ឥណ្ឌូនេស៊ី', ph:'ហ្វីលីពីន', th:'ថៃ', jp:'ជប៉ុន', ru:'រុស្ស៊ី', np:'នេប៉ាល់', lk:'ស្រីលង្កា', uz:'អ៊ូសបេគីស្ថាន', kz:'កាហ្សាក់ស្ថាន', kg:'គារហ្គីស្ថាន', mm:'មីយ៉ាន់ម៉ា', bd:'បង់ក្លាដែស', pk:'ប៉ាគីស្ថាន', kh:'កម្ពុជា', mn:'ម៉ុងហ្គោលី', la:'ឡាវ' },
  ky: { kr:'Түштүк Корея', us:'АКШ', vn:'Вьетнам', cn:'Кытай', in:'Индия', id:'Индонезия', ph:'Филиппин', th:'Тайланд', jp:'Япония', ru:'Орусия', np:'Непал', lk:'Шри-Ланка', uz:'Өзбекстан', kz:'Казакстан', kg:'Кыргызстан', mm:'Мьянма', bd:'Бангладеш', pk:'Пакистан', kh:'Камбоджа', mn:'Монголия', la:'Лаос' },
  lo: { kr:'ເກົາຫຼີໃຕ້', us:'ສະຫະລັດ', vn:'ຫວຽດນາມ', cn:'ຈີນ', in:'ອິນເດຍ', id:'ອິນໂດເນເຊຍ', ph:'ຟີລິບປິນ', th:'ໄທ', jp:'ຍີ່ປຸ່ນ', ru:'ລັດເຊຍ', np:'ເນປານ', lk:'ສີລັງກາ', uz:'ອຸສເບກິສະຖານ', kz:'ຄາຊັກສະຖານ', kg:'ຄີກີສະຖານ', mm:'ມຽນມາ', bd:'ບັງກະລາເທດ', pk:'ປາກີສະຖານ', kh:'ກຳປູເຈຍ', mn:'ມົງໂກເລຍ', la:'ລາວ' },
  mn: { kr:'Өмнөд Солонгос', us:'АНУ', vn:'Вьетнам', cn:'Хятад', in:'Энэтхэг', id:'Индонез', ph:'Филиппин', th:'Тайланд', jp:'Япон', ru:'Орос', np:'Балба', lk:'Шри Ланка', uz:'Узбекистан', kz:'Казахстан', kg:'Киргизстан', mm:'Мьянмар', bd:'Бангладеш', pk:'Пакистан', kh:'Камбож', mn:'Монгол', la:'Лаос' },
  my: { kr:'တောင်ကိုရီးယား', us:'အမေရိကန်ပြည်ထောင်စု', vn:'ဗီယက်နမ်', cn:'တရုတ်', in:'အိန္ဒိယ', id:'အင်ဒိုနီးရှား', ph:'ဖိလစ်ပိုင်', th:'ထိုင်း', jp:'ဂျပန်', ru:'ရုရှား', np:'နီပေါ', lk:'သီရိလင်္ကာ', uz:'ဥဇဗက်ကစ္စတန်', kz:'ကာဇက်စတန်', kg:'ကာဂျစ္စတန်', mm:'မြန်မာ', bd:'ဘင်္ဂလားဒေ့ရှ်', pk:'ပါကစ္စတန်', kh:'ကမ္ဘောဒီးယား', mn:'မွန်ဂိုလီးယား', la:'လာအို' },
  ne: { kr:'दक्षिण कोरिया', us:'अमेरिका', vn:'भियतनाम', cn:'चीन', in:'भारत', id:'इन्डोनेसिया', ph:'फिलिपिन्स', th:'थाइल्यान्ड', jp:'जापान', ru:'रुस', np:'नेपाल', lk:'श्रीलंका', uz:'उज्बेकिस्तान', kz:'कजाकिस्तान', kg:'किर्गिस्तान', mm:'म्यानमार', bd:'बंगलादेश', pk:'पाकिस्तान', kh:'कम्बोडिया', mn:'मंगोलिया', la:'लाओस' },
  si: { kr:'දකුණු කොරියාව', us:'ඇමරිකා එක්සත් ජනපදය', vn:'වියට්නාමය', cn:'චීනය', in:'ඉන්දියාව', id:'ඉන්දුනීසියාව', ph:'පිලිපීනය', th:'තායිලන්තය', jp:'ජපානය', ru:'රුසියාව', np:'නේපාලය', lk:'ශ්‍රී ලංකාව', uz:'උස්බෙකිස්තානය', kz:'කසකස්තානය', kg:'කිර්ගිස්තානය', mm:'මියන්මාරය', bd:'බංග්ලාදේශය', pk:'පකිස්තානය', kh:'කාම්බෝජය', mn:'මොංගෝලියාව', la:'ලාඕසය' },
  tl: { kr:'Timog Korea', us:'Estados Unidos', vn:'Vietnam', cn:'Tsina', in:'India', id:'Indonesia', ph:'Pilipinas', th:'Thailand', jp:'Japan', ru:'Russia', np:'Nepal', lk:'Sri Lanka', uz:'Uzbekistan', kz:'Kazakhstan', kg:'Kyrgyzstan', mm:'Myanmar', bd:'Bangladesh', pk:'Pakistan', kh:'Cambodia', mn:'Mongolia', la:'Laos' },
  ur: { kr:'جنوبی کوریا', us:'امریکہ', vn:'ویتنام', cn:'چین', in:'بھارت', id:'انڈونیشیا', ph:'فلپائن', th:'تھائی لینڈ', jp:'جاپان', ru:'روس', np:'نیپال', lk:'سری لنکا', uz:'ازبکستان', kz:'قازقستان', kg:'کرغزستان', mm:'میانمار', bd:'بنگلہ دیش', pk:'پاکستان', kh:'کمبوڈیا', mn:'منگولیا', la:'لاؤس' },
  uz: { kr:'Janubiy Koreya', us:'AQSH', vn:'Vetnam', cn:'Xitoy', in:'Hindiston', id:'Indoneziya', ph:'Filippin', th:'Tailand', jp:'Yaponiya', ru:'Rossiya', np:'Nepal', lk:'Shri-Lanka', uz:'Oʻzbekiston', kz:'Qozogʻiston', kg:'Qirgʻiziston', mm:'Myanma', bd:'Bangladesh', pk:'Pokiston', kh:'Kambodja', mn:'Mongoliya', la:'Laos' },
};

// 언어별 "~ 거주자" 관용구 템플릿 — 위 COUNTRY_NAMES_MORE의 나라 이름을 채워서 완성
const RESIDENT_PHRASE_MORE = {
  ar: n => `مقيم في ${n}`,
  bn: n => `${n} বাসিন্দা`,
  fr: n => `Résident de ${n}`,
  hi: n => `${n} के निवासी`,
  id: n => `Penduduk ${n}`,
  ja: n => `${n}居住者`,
  kk: n => `${n} тұрғыны`,
  km: n => `អ្នករស់នៅ${n}`,
  ky: n => `${n} жашоочусу`,
  lo: n => `ຜູ້ອາໄສຢູ່${n}`,
  mn: n => `${n}-д оршин суугч`,
  my: n => `${n}နေထိုင်သူ`,
  ne: n => `${n}का बासिन्दा`,
  si: n => `${n} වැසියෙක්`,
  tl: n => `Residente ng ${n}`,
  ur: n => `${n} کا رہائشی`,
  uz: n => `${n} rezidenti`,
};

// 비교 카드 그룹핑 노트("N개국 동일")의 17개 언어 템플릿 — updateSideBySide()에서 씀
const SAME_COUNT_PHRASE_MORE = {
  ar: n => `متطابق في ${n} دول`,
  bn: n => `এই ${n}টি দেশে একই`,
  fr: n => `Identique pour ces ${n} pays`,
  hi: n => `इन ${n} देशों में समान`,
  id: n => `Sama untuk ${n} negara ini`,
  ja: n => `この${n}か国で同額`,
  kk: n => `Осы ${n} елде бірдей`,
  km: n => `ដូចគ្នាសម្រាប់ប្រទេស${n}`,
  ky: n => `Бул ${n} өлкөдө бирдей`,
  lo: n => `ເທົ່າກັນໃນ ${n} ປະເທດ`,
  mn: n => `Энэ ${n} улсад адилхан`,
  my: n => `ဤနိုင်ငံ ${n} ခုတွင် တူညီသည်`,
  ne: n => `यी ${n} देशहरूमा समान`,
  si: n => `මෙම රටවල් ${n}හි සමානයි`,
  tl: n => `Pareho para sa ${n} bansang ito`,
  ur: n => `ان ${n} ممالک میں یکساں`,
  uz: n => `Ushbu ${n} ta davlatda bir xil`,
};

function buildSameCountMore(n){
  const more = {};
  Object.keys(SAME_COUNT_PHRASE_MORE).forEach(lang => { more[lang] = SAME_COUNT_PHRASE_MORE[lang](n); });
  return more;
}

// "추정치"/"조약 정지"/"근사치" 등 이미 6개 핵심 언어에 붙어있는 경고 문구의 17개 언어 버전 —
// th/pk/kh/mn/la는 미검증 추정치(estimate), 러시아는 조세조약 정지(treatySuspended),
// ph/lk/mm은 경고 표시 없는 근사치(approx)
const QUALIFIER_WORDS_MORE = {
  estimate:        { ar:'تقديري ⚠️', bn:'আনুমানিক ⚠️', fr:'estimation ⚠️', hi:'अनुमानित ⚠️', id:'perkiraan ⚠️', ja:'推定 ⚠️', kk:'болжам ⚠️', km:'ប៉ាន់ស្មាន ⚠️', ky:'болжол ⚠️', lo:'ຄາດຄະເນ ⚠️', mn:'тооцоо ⚠️', my:'ခန့်မှန်း ⚠️', ne:'अनुमानित ⚠️', si:'ඇස්තමේන්තුගත ⚠️', tl:'tantiya ⚠️', ur:'تخمینی ⚠️', uz:'taxminiy ⚠️' },
  treatySuspended: { ar:'المعاهدة معلقة ⚠️', bn:'চুক্তি স্থগিত ⚠️', fr:'traité suspendu ⚠️', hi:'संधि निलंबित ⚠️', id:'perjanjian ditangguhkan ⚠️', ja:'条約停止中 ⚠️', kk:'келісім тоқтатылды ⚠️', km:'កិច្ចព្រមព្រៀងផ្អាក ⚠️', ky:'келишим токтотулду ⚠️', lo:'ສົນທິສັນຍາຢຸດ ⚠️', mn:'гэрээ түдгэлзсэн ⚠️', my:'စာချုပ်ရပ်ဆိုင်း ⚠️', ne:'सन्धि निलम्बित ⚠️', si:'ගිවිසුම අත්හිටුවා ⚠️', tl:'nasuspinde ang tratado ⚠️', ur:'معاہدہ معطل ⚠️', uz:'shartnoma toʻxtatilgan ⚠️' },
  // 일본: 미-일 조세조약상 도박/복권 소득이 미국 과세 면제 목록에 포함된다는 근거를 찾았지만,
  // 자동 적용이 아니라 W-8BEN 사전신청 또는 1040-NR 환급 청구가 필요해서 계산 자체는 30% 원천징수를
  // 그대로 유지하고(실제로 대부분 일단 원천징수당하는 게 현실이라) 라벨에 경고만 덧붙임
  treatyMayExempt: { ar:'قد يُعفى بموجب المعاهدة ⚠️', bn:'চুক্তির অধীনে ছাড় সম্ভব ⚠️', fr:'exonération possible par traité ⚠️', hi:'संधि के तहत छूट संभव ⚠️', id:'kemungkinan bebas pajak berdasarkan perjanjian ⚠️', ja:'条約により免除の可能性 ⚠️', kk:'келісім бойынша босатылуы мүмкін ⚠️', km:'អាចលើកលែងតាមកិច្ចព្រមព្រៀង ⚠️', ky:'келишим боюнча бошотулушу мүмкүн ⚠️', lo:'ອາດຍົກເວັ້ນຕາມສົນທິສັນຍາ ⚠️', mn:'гэрээгээр чөлөөлөгдөх боломжтой ⚠️', my:'စာချုပ်အရ ကင်းလွတ်နိုင်ခြေရှိ ⚠️', ne:'सन्धि अन्तर्गत छुट सम्भव ⚠️', si:'ගිවිසුම යටතේ නිදහස් විය හැක ⚠️', tl:'posibleng exempted sa kasunduan ⚠️', ur:'معاہدے کے تحت چھوٹ ممکن ⚠️', uz:"shartnoma bo'yicha ozod bo'lishi mumkin ⚠️" },
  approx:          { ar:'تقريبي', bn:'আনুমানিক', fr:'approximatif', hi:'लगभग', id:'perkiraan', ja:'概算', kk:'шамамен', km:'ប្រហែល', ky:'болжол менен', lo:'ປະມານ', mn:'ойролцоогоор', my:'ခန့်မှန်း', ne:'लगभग', si:'ආසන්න වශයෙන්', tl:'humigit-kumulang', ur:'تقریباً', uz:'taxminan' },
};

// 나라 코드(+선택적으로 qualifier 종류)를 넣으면 17개 언어 more 객체를 만들어줌 —
// COUNTRY_TAX_PROFILES 라벨과 calcTakeHome()의 basisSuffix가 공통으로 이 함수를 씀.
// getProfileShortLabel()이 끝의 괄호를 잘라내는 정규식과도 맞물리므로, qualifier가 있어도
// "이름(qualifier)" 형태로 붙여야 짧은 라벨에서 자동으로 깔끔하게 잘림
function buildCountryMore(code, qualifier){
  const more = {};
  Object.keys(RESIDENT_PHRASE_MORE).forEach(lang => {
    const name = COUNTRY_NAMES_MORE[lang][code];
    let phrase = RESIDENT_PHRASE_MORE[lang](name);
    if (qualifier) phrase += ` (${QUALIFIER_WORDS_MORE[qualifier][lang]})`;
    more[lang] = phrase;
  });
  return more;
}

// calcTakeHome()의 나라별 세금 상세 내역(label1/label2/val2)도 basisSuffix처럼 6개 언어만
// 있었던 걸 뒤늦게 발견 — "{나라} 추가 납부 (FTC 적용)" 패턴은 buildCountryMore와 같은 방식으로,
// 완전히 고정된 문구("미국 연방세 (비거주자)", "0원 (세액공제로 상계)")는 아래 상수로 채움
const ADDITIONAL_TAX_PHRASE_MORE = {
  ar: n => `ضريبة إضافية في ${n} (مع تطبيق FTC)`,
  bn: n => `${n} অতিরিক্ত কর (FTC প্রয়োগ)`,
  fr: n => `Taxe supplémentaire en ${n} (FTC appliqué)`,
  hi: n => `${n} में अतिरिक्त कर (FTC लागू)`,
  id: n => `Pajak tambahan di ${n} (FTC diterapkan)`,
  ja: n => `${n}での追加納税（FTC適用）`,
  kk: n => `${n}-де қосымша салық (FTC қолданылды)`,
  km: n => `ពន្ធបន្ថែមនៅ${n} (អនុវត្ត FTC)`,
  ky: n => `${n}да кошумча салык (FTC колдонулду)`,
  lo: n => `ພາສີເພີ່ມເຕີມໃນ${n} (ນຳໃຊ້ FTC)`,
  mn: n => `${n}-д нэмэлт татвар (FTC хэрэглэсэн)`,
  my: n => `${n}တွင်ထပ်ဆောင်းအခွန် (FTC အသုံးပြု)`,
  ne: n => `${n}मा थप कर (FTC लागू)`,
  si: n => `${n} හි අමතර බද්ද (FTC යොදන ලදී)`,
  tl: n => `Karagdagang buwis sa ${n} (FTC inilapat)`,
  ur: n => `${n} میں اضافی ٹیکس (FTC لاگو)`,
  uz: n => `${n}da qo'shimcha soliq (FTC qo'llanildi)`,
};

// "캄보디아 추가 납부 (근거 불명확 ⚠️)"처럼 FTC가 아니라 근거 자체가 불명확한 나라용 변형
const ADDITIONAL_TAX_UNCLEAR_PHRASE_MORE = {
  ar: n => `ضريبة إضافية في ${n} (الأساس غير واضح ⚠️)`,
  bn: n => `${n} অতিরিক্ত কর (ভিত্তি অস্পষ্ট ⚠️)`,
  fr: n => `Taxe supplémentaire en ${n} (base incertaine ⚠️)`,
  hi: n => `${n} में अतिरिक्त कर (आधार अस्पष्ट ⚠️)`,
  id: n => `Pajak tambahan di ${n} (dasar tidak jelas ⚠️)`,
  ja: n => `${n}での追加納税（根拠不明確 ⚠️）`,
  kk: n => `${n}-де қосымша салық (негізі анық емес ⚠️)`,
  km: n => `ពន្ធបន្ថែមនៅ${n} (មូលដ្ឋានមិនច្បាស់ ⚠️)`,
  ky: n => `${n}да кошумча салык (негизи так эмес ⚠️)`,
  lo: n => `ພາສີເພີ່ມເຕີມໃນ${n} (ພື້ນຖານບໍ່ຈະແຈ້ງ ⚠️)`,
  mn: n => `${n}-д нэмэлт татвар (үндэслэл тодорхойгүй ⚠️)`,
  my: n => `${n}တွင်ထပ်ဆောင်းအခွန် (အခြေခံမရှင်းလင်း ⚠️)`,
  ne: n => `${n}मा थप कर (आधार अस्पष्ट ⚠️)`,
  si: n => `${n} හි අමතර බද්ද (පදනම අපැහැදිලියි ⚠️)`,
  tl: n => `Karagdagang buwis sa ${n} (hindi malinaw ang basehan ⚠️)`,
  ur: n => `${n} میں اضافی ٹیکس (بنیاد غیر واضح ⚠️)`,
  uz: n => `${n}da qo'shimcha soliq (asos noaniq ⚠️)`,
};

// 나라 코드(+선택적으로 qualifier)로 label2("{나라} 추가 납부 (FTC 적용...)") 17개 언어 more 객체를 만듦
function buildAdditionalTaxMore(code, qualifier, unclear){
  const more = {};
  const template = unclear ? ADDITIONAL_TAX_UNCLEAR_PHRASE_MORE : ADDITIONAL_TAX_PHRASE_MORE;
  Object.keys(template).forEach(lang => {
    const name = COUNTRY_NAMES_MORE[lang][code];
    let phrase = template[lang](name);
    if (qualifier) phrase += ` (${QUALIFIER_WORDS_MORE[qualifier][lang]})`;
    more[lang] = phrase;
  });
  return more;
}

const US_FED_TAX_MORE = { ar:'الضريبة الفيدرالية الأمريكية', bn:'মার্কিন ফেডারেল কর', fr:'Impôt fédéral américain', hi:'अमेरिकी संघीय कर', id:'Pajak Federal AS', ja:'米国連邦税', kk:'АҚШ федералды салығы', km:'ពន្ធសហព័ន្ធអាមេរិក', ky:'АКШ федералдык салыгы', lo:'ພາສີກາງອາເມລິກາ', mn:'АНУ-ын холбооны татвар', my:'အမေရိကန်ဖက်ဒရယ်အခွန်', ne:'अमेरिकी संघीय कर', si:'ඇමරිකානු ෆෙඩරල් බද්ද', tl:'US Federal Tax', ur:'امریکی وفاقی ٹیکس', uz:"AQSh federal solig'i" };

const US_FED_TAX_NONRESIDENT_MORE = { ar:'الضريبة الفيدرالية الأمريكية (غير مقيم)', bn:'মার্কিন ফেডারেল কর (অনাবাসিক)', fr:'Impôt fédéral américain (non-résident)', hi:'अमेरिकी संघीय कर (गैर-निवासी)', id:'Pajak Federal AS (bukan penduduk)', ja:'米国連邦税（非居住者）', kk:'АҚШ федералды салығы (резидент емес)', km:'ពន្ធសហព័ន្ធអាមេរិក (មិនមែនអ្នករស់នៅ)', ky:'АКШ федералдык салыгы (резидент эмес)', lo:'ພາສີກາງອາເມລິກາ (ບໍ່ແມ່ນຜູ້ອາໄສ)', mn:'АНУ-ын холбооны татвар (оршин суугч бус)', my:'အမေရိကန်ဖက်ဒရယ်အခွန် (နေထိုင်သူမဟုတ်)', ne:'अमेरिकी संघीय कर (गैर-बासिन्दा)', si:'ඇමරිකානු ෆෙඩරල් බද්ද (පදිංචිකරුවෙකු නොවේ)', tl:'US Federal Tax (di-residente)', ur:'امریکی وفاقی ٹیکس (غیر رہائشی)', uz:"AQSh federal solig'i (norezident)" };

// 비교 페이지 "{나라}에서도 또 내요?" FAQ 패널 제목의 17개 언어 템플릿 + 헬퍼
const ALSO_PAY_PHRASE_MORE = {
  ar: n => `هل أدفع ضريبة في ${n} أيضًا؟`,
  bn: n => `${n}-তেও কি কর দিতে হবে?`,
  fr: n => `Dois-je aussi payer des impôts en ${n} ?`,
  hi: n => `क्या मुझे ${n} में भी टैक्स देना होगा?`,
  id: n => `Apakah saya juga bayar pajak di ${n}?`,
  ja: n => `${n}でも税金を払いますか？`,
  kk: n => `${n}-де де салық төлеу керек пе?`,
  km: n => `តើខ្ញុំបង់ពន្ធនៅ${n}ដែរឬទេ?`,
  ky: n => `${n}да да салык төлөшүм керекпи?`,
  lo: n => `ຕ້ອງເສຍພາສີໃນ${n}ນຳບໍ?`,
  mn: n => `${n}-д ч бас татвар төлөх үү?`,
  my: n => `${n}တွင်လည်း အခွန်ထပ်ပေးရမလား?`,
  ne: n => `के मैले ${n}मा पनि कर तिर्नुपर्छ?`,
  si: n => `${n} හිද මට බදු ගෙවීමට සිදුවේද?`,
  tl: n => `Magbabayad din ba ako ng buwis sa ${n}?`,
  ur: n => `کیا مجھے ${n} میں بھی ٹیکس دینا ہوگا؟`,
  uz: n => `${n}da ham soliq to'lashim kerakmi?`,
};
function buildAlsoPayMore(code, qualifier){
  const more = {};
  Object.keys(ALSO_PAY_PHRASE_MORE).forEach(lang => {
    const name = COUNTRY_NAMES_MORE[lang][code];
    let phrase = ALSO_PAY_PHRASE_MORE[lang](name);
    if (qualifier) phrase += ` (${QUALIFIER_WORDS_MORE[qualifier][lang]})`;
    more[lang] = phrase;
  });
  return more;
}

const ZERO_OFFSET_MORE ={ ar:'0 وون (تمت مقاصته بائتمان ضريبي)', bn:'০ ওন (কর ক্রেডিট দ্বারা অফসেট)', fr:"0 KRW (compensé par le crédit d'impôt)", hi:'₩0 (कर क्रेडिट द्वारा समायोजित)', id:'₩0 (dikompensasi kredit pajak)', ja:'0ウォン（税額控除で相殺）', kk:'0 вон (салық несиесімен есептелді)', km:'0 វอន (ទូទាត់ដោយឥណទានពន្ធ)', ky:'0 вон (салык кредити менен эсептелди)', lo:'0 ວອນ (ຫັກລ້າງດ້ວຍເຄຣດິດພາສີ)', mn:'0 вон (татварын хөнгөлөлтөөр нөхөгдсөн)', my:'၀ ဝမ်း (အခွန်ခရက်ဒစ်ဖြင့်ခုနှိမ်)', ne:'₩0 (कर क्रेडिटले अफसेट)', si:'0 වොන් (බදු ණයට වන්දි)', tl:'₩0 (na-offset ng tax credit)', ur:'0 وون (ٹیکس کریڈٹ سے پورا)', uz:'0 von (soliq krediti bilan qoplandi)' };

// "0원 (근거 불명확 ⚠️)" — ZERO_OFFSET_MORE와 짝을 이루는, FTC 상계가 아니라 근거 자체가
// 불명확해서 0원인 캄보디아 케이스용 (val2 표시, buildAdditionalTaxMore의 unclear 버전과 같은 문구)
const ZERO_UNCLEAR_MORE = { ar:'0 وون (الأساس غير واضح ⚠️)', bn:'০ ওন (ভিত্তি অস্পষ্ট ⚠️)', fr:'0 KRW (base incertaine ⚠️)', hi:'₩0 (आधार अस्पष्ट ⚠️)', id:'₩0 (dasar tidak jelas ⚠️)', ja:'0ウォン（根拠不明確 ⚠️）', kk:'0 вон (негізі анық емес ⚠️)', km:'0 វอน (មូលដ្ឋានមិនច្បាស់ ⚠️)', ky:'0 вон (негизи так эмес ⚠️)', lo:'0 ວອນ (ພື້ນຖານບໍ່ຈະແຈ້ງ ⚠️)', mn:'0 вон (үндэслэл тодорхойгүй ⚠️)', my:'၀ ဝမ်း (အခြေခံမရှင်းလင်း ⚠️)', ne:'₩0 (आधार अस्पष्ट ⚠️)', si:'0 වොන් (පදනම අපැහැදිලියි ⚠️)', tl:'₩0 (hindi malinaw ang basehan ⚠️)', ur:'0 وون (بنیاد غیر واضح ⚠️)', uz:"0 von (asos noaniq ⚠️)" };

// 공유 카드/토스트 등에서 여러 함수(shareLatestDraw/shareDreamResult/shareResult/
// shareRefundChecklist)가 똑같이 반복해서 쓰는 문구들의 17개 언어 버전 — 한 번만 정의해서 재사용함
const COPIED_TOAST_MORE = { ar:'تم النسخ! الصقه في أي مكان تريده :)', bn:'কপি হয়েছে! যেকোনো জায়গায় পেস্ট করুন :)', fr:'Copié ! Collez-le où vous voulez :)', hi:'कॉपी हो गया! कहीं भी पेस्ट कर लीजिए :)', id:'Disalin! Tempel di mana saja kamu suka :)', ja:'コピーしました！好きな場所に貼り付けてください :)', kk:'Көшірілді! Қалаған жеріңізге қойыңыз :)', km:'បានចម្លង! សូមបិទភ្ជាប់នៅកន្លែងណាក៏បាន :)', ky:'Көчүрүлдү! Каалаган жериңизге чаптаңыз :)', lo:'ສຳເນົາແລ້ວ! ວາງໃສ່ບ່ອນໃດກໍໄດ້ທີ່ທ່ານຕ້ອງການ :)', mn:'Хуулагдлаа! Хүссэн газартаа буулгаарай :)', my:'ကူးယူပြီးပါပြီ! နှစ်သက်ရာနေရာတွင် ကူးထည့်ပါ :)', ne:'प्रतिलिपि भयो! जुनसुकै ठाउँमा टाँस्नुहोस् :)', si:'පිටපත් විය! ඔබට කැමති ඕනෑම තැනක අලවන්න :)', tl:'Na-copy! I-paste kahit saan mo gusto :)', ur:'کاپی ہو گیا! جہاں چاہیں پیسٹ کریں :)', uz:"Nusxalandi! Xohlagan joyingizga joylashtiring :)" };

const LINK_COPIED_MORE = { ar:'✅ تم نسخ الرابط', bn:'✅ লিংক কপি হয়েছে', fr:'✅ Lien copié', hi:'✅ लिंक कॉपी हो गया', id:'✅ Tautan disalin', ja:'✅ リンクをコピーしました', kk:'✅ Сілтеме көшірілді', km:'✅ បានចម្លងតំណ', ky:'✅ Шилтеме көчүрүлдү', lo:'✅ ສຳເນົາລິ້ງແລ້ວ', mn:'✅ Холбоос хуулагдлаа', my:'✅ လင့်ခ်ကူးယူပြီးပါပြီ', ne:'✅ लिंक प्रतिलिपि भयो', si:'✅ සබැඳිය පිටපත් විය', tl:'✅ Na-copy ang link', ur:'✅ لنک کاپی ہو گیا', uz:"✅ Havola nusxalandi" };

const PRESS_HOLD_COPY_MORE = { ar:'اضغط مطولاً على المحتوى أدناه لنسخه، ثم شاركه', bn:'নিচের লেখাটি চেপে ধরে কপি করে শেয়ার করুন', fr:"Appuyez longuement ci-dessous pour copier, puis partagez-le", hi:'नीचे दिए गए टेक्स्ट को दबाकर रखें, कॉपी करके शेयर करें', id:'Tekan dan tahan di bawah untuk menyalin, lalu bagikan', ja:'下の内容を長押ししてコピーし、共有してください', kk:'Төмендегі мәтінді басып тұрып көшіріп алып, бөлісіңіз', km:'ចុចខ្លាំងលើអត្ថបទខាងក្រោមដើម្បីចម្លង រួចចែករំលែក', ky:'Төмөндөгү текстти басып туруп көчүрүп алып бөлүшүңүз', lo:'ກົດຄ້າງໄວ້ທີ່ຂໍ້ຄວາມຂ້າງລຸ່ມເພື່ອສຳເນົາ ແລ້ວແບ່ງປັນ', mn:'Доорх агуулгыг удаан дараад хуулж аваад хуваалцаарай', my:'အောက်ပါအကြောင်းအရာကို ဖိကိုင်ပြီး ကူးယူကာ မျှဝေပါ', ne:'तलको सामग्रीलाई थिचिराखेर प्रतिलिपि गरी सेयर गर्नुहोस्', si:'පහත අන්තර්ගතය දිගටම ඔබා පිටපත් කර බෙදාගන්න', tl:'Pindutin nang matagal ang nasa ibaba para kopyahin, pagkatapos ay i-share', ur:'نیچے دیے گئے مواد کو دبا کر رکھیں، کاپی کریں اور شیئر کریں', uz:"Quyidagi matnni bosib turib nusxalang, so'ng ulashing" };

const JACKPOT_HISTORY_EMPTY_MORE = { ar:'لا توجد سجلات بعد.', bn:'এখনো কোনো রেকর্ড নেই।', fr:"Aucun historique pour l'instant.", hi:'अभी तक कोई रिकॉर्ड नहीं है।', id:'Belum ada catatan.', ja:'まだ記録がありません。', kk:'Әзірге жазба жоқ.', km:'មិនទាន់មានកំណត់ត្រានៅឡើយទេ។', ky:'Азырынча жазуу жок.', lo:'ຍັງບໍ່ມີບັນທຶກ.', mn:'Одоогоор бичлэг алга байна.', my:'မှတ်တမ်းမရှိသေးပါ။', ne:'हालसम्म कुनै रेकर्ड छैन।', si:'තවම වාර්තා නැත.', tl:'Wala pang record.', ur:'ابھی تک کوئی ریکارڈ نہیں ہے۔', uz:"Hozircha yozuvlar yo'q." };

const LUMP_SUM_WORD_MORE = { ar:'دفعة واحدة', bn:'একবারে অর্থপ্রদান', fr:'paiement unique', hi:'एकमुश्त भुगतान', id:'sekaligus', ja:'一時金', kk:'бір жолғы төлем', km:'ទូទាត់តែម្តង', ky:'бир жолку төлөм', lo:'ຈ່າຍເທື່ອດຽວ', mn:'нэг удаагийн төлбөр', my:'တစ်ကြိမ်တည်း ငွေပေးချေမှု', ne:'एकमुष्ट भुक्तानी', si:'එකවර ගෙවීම', tl:'lump-sum', ur:'یکمشت ادائیگی', uz:"bir martalik to'lov" };

const STATE_TAX_TITLE_MORE = { ar:'كم تضيف ضريبة الولاية؟', bn:'রাজ্যের কর কতটা যোগ হয়?', fr:"De combien l'impôt d'État augmente-t-il ?", hi:'राज्य कर से कितना जुड़ता है?', id:'Berapa tambahan pajak negara bagian?', ja:'州税はどれくらい追加されますか？', kk:'Штат салығы қанша қосады?', km:'ពន្ធរដ្ឋបន្ថែមប៉ុន្មាន?', ky:'Штат салыгы канча кошот?', lo:'ພາສີລັດເພີ່ມເທົ່າໃດ?', mn:'Мужийн татвар хэр их нэмэгддэг вэ?', my:'ပြည်နယ်အခွန်က ဘယ်လောက်ထပ်တိုးလဲ?', ne:'राज्य करले कति थप्छ?', si:'ප්‍රාන්ත බද්ද කොපමණ එකතු කරයිද?', tl:'Magkano ang idinadagdag ng buwis ng estado?', ur:'ریاستی ٹیکس کتنا اضافہ کرتا ہے؟', uz:"Shtat solig'i qancha qo'shadi?" };

const COMING_SOON_MORE = { ar:'قريباً', bn:'শীঘ্রই আসছে', fr:'Bientôt disponible', hi:'जल्द आ रहा है', id:'Segera hadir', ja:'準備中', kk:'Жақында', km:'ឆាប់មកដល់', ky:'Жакында', lo:'ກຳລັງຈະມາ', mn:'Тун удахгүй', my:'မကြာမီလာမည်', ne:'चाँडै आउँदैछ', si:'ළඟදීම', tl:'Malapit nang dumating', ur:'جلد آ رہا ہے', uz:"Tez orada" };

const SHOW_LESS_MORE = { ar:'عرض أقل ▴', bn:'কম দেখান ▴', fr:'Afficher moins ▴', hi:'कम दिखाएं ▴', id:'Tampilkan lebih sedikit ▴', ja:'閉じる ▴', kk:'Азырақ көрсету ▴', km:'បង្ហាញតិច ▴', ky:'Азыраак көрсөтүү ▴', lo:'ສະແດງໜ້ອຍລົງ ▴', mn:'Багасгаж харуулах ▴', my:'လျှော့ပြပါ ▴', ne:'कम देखाउनुहोस् ▴', si:'අඩුවෙන් පෙන්වන්න ▴', tl:'Ipakita ang mas kaunti ▴', ur:'کم دکھائیں ▴', uz:"Kamroq ko'rsatish ▴" };

// "N개국 더 보기 ▾" 토글 버튼의 17개 언어 템플릿
const SHOW_MORE_COUNTRIES_PHRASE_MORE = {
  ar: n => `عرض ${n} دولة أخرى ▾`,
  bn: n => `আরও ${n}টি দেশ দেখান ▾`,
  fr: n => `Afficher ${n} pays de plus ▾`,
  hi: n => `${n} और देश दिखाएं ▾`,
  id: n => `Tampilkan ${n} negara lagi ▾`,
  ja: n => `他${n}か国を表示 ▾`,
  kk: n => `Тағы ${n} ел көрсету ▾`,
  km: n => `បង្ហាញប្រទេសបន្ថែម${n} ▾`,
  ky: n => `Дагы ${n} өлкө көрсөтүү ▾`,
  lo: n => `ສະແດງເພີ່ມອີກ ${n} ປະເທດ ▾`,
  mn: n => `Дахин ${n} улс харуулах ▾`,
  my: n => `နိုင်ငံ ${n} ခု ထပ်ပြပါ ▾`,
  ne: n => `थप ${n} देश देखाउनुहोस् ▾`,
  si: n => `තවත් රටවල් ${n} ක් පෙන්වන්න ▾`,
  tl: n => `Ipakita ang ${n} pang bansa ▾`,
  ur: n => `مزید ${n} ممالک دکھائیں ▾`,
  uz: n => `Yana ${n} ta davlatni ko'rsatish ▾`,
};
function buildShowMoreCountriesMore(n){
  const more = {};
  Object.keys(SHOW_MORE_COUNTRIES_PHRASE_MORE).forEach(lang => { more[lang] = SHOW_MORE_COUNTRIES_PHRASE_MORE[lang](n); });
  return more;
}

// 한국/미국 거주자 결과를 나란히(select와 무관하게 항상 둘 다) 보여주는 비교 카드용 계산
// 국가 비교 카드에 표시할 나라 목록 — 새 나라를 추가할 때는 이 배열에 항목만 추가하면
// 카드·breakdown이 자동으로 늘어남(HTML/CSS를 따로 손댈 필요 없음).
// implemented:false면 "준비 중" 카드로만 표시되고, calcTakeHome()에 해당 country 분기를
// 추가한 뒤 implemented:true로 바꾸면 실제 계산이 자동으로 반영됨.
const COUNTRY_TAX_PROFILES = [
  { code: 'kr', flagCode: 'KR', label: '한국 거주자', labelEn: 'Korea resident', labelZh: '韩国居民', labelVi: 'Cư dân Hàn Quốc', labelTh: 'ผู้พำนักในเกาหลี', labelRu: 'Резидент Кореи', implemented: true, needsState: false, more: buildCountryMore('kr') },
  { code: 'us', flagCode: 'US', label: '미국 거주자', labelEn: 'US resident', labelZh: '美国居民', labelVi: 'Cư dân Mỹ', labelTh: 'ผู้พำนักในสหรัฐฯ', labelRu: 'Резидент США', implemented: true, needsState: true, more: buildCountryMore('us') },
  { code: 'vn', flagCode: 'VN', label: '베트남 거주자 (실제 베트남 거주 기준)', labelEn: 'Vietnam resident (living in Vietnam)', labelZh: '越南居民（实际住在越南）', labelVi: 'Cư dân Việt Nam (sống thực tế tại Việt Nam)', labelTh: 'ผู้พำนักในเวียดนาม (อาศัยอยู่จริงในเวียดนาม)', labelRu: 'Резидент Вьетнама (проживающий во Вьетнаме)', implemented: true, needsState: false, more: buildCountryMore('vn') },
  { code: 'cn', flagCode: 'CN', label: '중국 거주자 (실제 중국 거주 기준)', labelEn: 'China resident (living in China)', labelZh: '中国居民（实际住在中国）', labelVi: 'Cư dân Trung Quốc (sống thực tế tại Trung Quốc)', labelTh: 'ผู้พำนักในจีน (อาศัยอยู่จริงในจีน)', labelRu: 'Резидент Китая (проживающий в Китае)', implemented: true, needsState: false, detailPage: 'china-resident-us-lottery-tax.html', detailLabel: '中文详情 →', more: buildCountryMore('cn') },
  { code: 'in', flagCode: 'IN', label: '인도 거주자 (실제 인도 거주 기준)', labelEn: 'India resident (living in India)', labelZh: '印度居民（实际住在印度）', labelVi: 'Cư dân Ấn Độ (sống thực tế tại Ấn Độ)', labelTh: 'ผู้พำนักในอินเดีย (อาศัยอยู่จริงในอินเดีย)', labelRu: 'Резидент Индии (проживающий в Индии)', implemented: true, needsState: false, more: buildCountryMore('in') },
  { code: 'id', flagCode: 'ID', label: '인도네시아 거주자 (실제 인도네시아 거주 기준)', labelEn: 'Indonesia resident (living in Indonesia)', labelZh: '印尼居民（实际住在印尼）', labelVi: 'Cư dân Indonesia (sống thực tế tại Indonesia)', labelTh: 'ผู้พำนักในอินโดนีเซีย (อาศัยอยู่จริงในอินโดนีเซีย)', labelRu: 'Резидент Индонезии (проживающий в Индонезии)', implemented: true, needsState: false, more: buildCountryMore('id') },
  { code: 'ph', flagCode: 'PH', label: '필리핀 거주자 (실제 필리핀 거주 기준, 근사치)', labelEn: 'Philippines resident (living in Philippines, approximate)', labelZh: '菲律宾居民（实际住在菲律宾，估算值）', labelVi: 'Cư dân Philippines (sống thực tế tại Philippines, ước tính)', labelTh: 'ผู้พำนักในฟิลิปปินส์ (อาศัยอยู่จริงในฟิลิปปินส์, ค่าประมาณ)', labelRu: 'Резидент Филиппин (проживающий на Филиппинах, приблизительно)', implemented: true, needsState: false, more: buildCountryMore('ph', 'approx') },
  { code: 'th', flagCode: 'TH', label: '태국 거주자 (실제 태국 거주 기준, 추정치 ⚠️)', labelEn: 'Thailand resident (living in Thailand, unverified estimate ⚠️)', labelZh: '泰国居民（实际住在泰国，估算值⚠️）', labelVi: 'Cư dân Thái Lan (sống thực tế tại Thái Lan, ước tính ⚠️)', labelTh: 'ผู้พำนักในไทย (อาศัยอยู่จริงในไทย, ค่าประมาณ ⚠️)', labelRu: 'Резидент Таиланда (проживающий в Таиланде, оценка ⚠️)', implemented: true, needsState: false, more: buildCountryMore('th', 'estimate') },
  { code: 'jp', flagCode: 'JP', label: '일본 거주자 (실제 일본 거주 기준)', labelEn: 'Japan resident (living in Japan)', labelZh: '日本居民（实际住在日本）', labelVi: 'Cư dân Nhật Bản (sống thực tế tại Nhật Bản)', labelTh: 'ผู้พำนักในญี่ปุ่น (อาศัยอยู่จริงในญี่ปุ่น)', labelRu: 'Резидент Японии (проживающий в Японии)', implemented: true, needsState: false, more: buildCountryMore('jp') },
  { code: 'ru', flagCode: 'RU', label: '러시아 거주자 (실제 러시아 거주 기준, 조약 정지 ⚠️)', labelEn: 'Russia resident (living in Russia, treaty suspended ⚠️)', labelZh: '俄罗斯居民（实际住在俄罗斯，条约暂停⚠️）', labelVi: 'Cư dân Nga (sống thực tế tại Nga, hiệp định bị đình chỉ ⚠️)', labelTh: 'ผู้พำนักในรัสเซีย (อาศัยอยู่จริงในรัสเซีย, สนธิสัญญาระงับ ⚠️)', labelRu: 'Резидент России (проживающий в России, договор приостановлен ⚠️)', implemented: true, needsState: false, more: buildCountryMore('ru', 'treatySuspended') },
  { code: 'np', flagCode: 'NP', label: '네팔 거주자 (실제 네팔 거주 기준)', labelEn: 'Nepal resident (living in Nepal)', labelZh: '尼泊尔居民（实际住在尼泊尔）', labelVi: 'Cư dân Nepal (sống thực tế tại Nepal)', labelTh: 'ผู้พำนักในเนปาล (อาศัยอยู่จริงในเนปาล)', labelRu: 'Резидент Непала (проживающий в Непале)', implemented: true, needsState: false, more: buildCountryMore('np') },
  { code: 'lk', flagCode: 'LK', label: '스리랑카 거주자 (실제 스리랑카 거주 기준, 근사치)', labelEn: 'Sri Lanka resident (living in Sri Lanka, approximate)', labelZh: '斯里兰卡居民（实际住在斯里兰卡，估算值）', labelVi: 'Cư dân Sri Lanka (sống thực tế tại Sri Lanka, ước tính)', labelTh: 'ผู้พำนักในศรีลังกา (อาศัยอยู่จริงในศรีลังกา, ค่าประมาณ)', labelRu: 'Резидент Шри-Ланки (проживающий в Шри-Ланке, приблизительно)', implemented: true, needsState: false, more: buildCountryMore('lk', 'approx') },
  { code: 'uz', flagCode: 'UZ', label: '우즈베키스탄 거주자 (실제 우즈베키스탄 거주 기준)', labelEn: 'Uzbekistan resident (living in Uzbekistan)', labelZh: '乌兹别克斯坦居民（实际住在乌兹别克斯坦）', labelVi: 'Cư dân Uzbekistan (sống thực tế tại Uzbekistan)', labelTh: 'ผู้พำนักในอุซเบกิสถาน (อาศัยอยู่จริงในอุซเบกิสถาน)', labelRu: 'Резидент Узбекистана (проживающий в Узбекистане)', implemented: true, needsState: false, more: buildCountryMore('uz') },
  { code: 'kz', flagCode: 'KZ', label: '카자흐스탄 거주자 (실제 카자흐스탄 거주 기준)', labelEn: 'Kazakhstan resident (living in Kazakhstan)', labelZh: '哈萨克斯坦居民（实际住在哈萨克斯坦）', labelVi: 'Cư dân Kazakhstan (sống thực tế tại Kazakhstan)', labelTh: 'ผู้พำนักในคาซัคสถาน (อาศัยอยู่จริงในคาซัคสถาน)', labelRu: 'Резидент Казахстана (проживающий в Казахстане)', implemented: true, needsState: false, more: buildCountryMore('kz') },
  { code: 'kg', flagCode: 'KG', label: '키르기스스탄 거주자 (실제 키르기스스탄 거주 기준)', labelEn: 'Kyrgyzstan resident (living in Kyrgyzstan)', labelZh: '吉尔吉斯斯坦居民（实际住在吉尔吉斯斯坦）', labelVi: 'Cư dân Kyrgyzstan (sống thực tế tại Kyrgyzstan)', labelTh: 'ผู้พำนักในคีร์กีซสถาน (อาศัยอยู่จริงในคีร์กีซสถาน)', labelRu: 'Резидент Кыргызстана (проживающий в Кыргызстане)', implemented: true, needsState: false, more: buildCountryMore('kg') },
  { code: 'mm', flagCode: 'MM', label: '미얀마 거주자 (실제 미얀마 거주 기준, 근사치)', labelEn: 'Myanmar resident (living in Myanmar, approximate)', labelZh: '缅甸居民（实际住在缅甸，估算值）', labelVi: 'Cư dân Myanmar (sống thực tế tại Myanmar, ước tính)', labelTh: 'ผู้พำนักในเมียนมา (อาศัยอยู่จริงในเมียนมา, ค่าประมาณ)', labelRu: 'Резидент Мьянмы (проживающий в Мьянме, приблизительно)', implemented: true, needsState: false, more: buildCountryMore('mm', 'approx') },
  { code: 'bd', flagCode: 'BD', label: '방글라데시 거주자 (실제 방글라데시 거주 기준)', labelEn: 'Bangladesh resident (living in Bangladesh)', labelZh: '孟加拉国居民（实际住在孟加拉国）', labelVi: 'Cư dân Bangladesh (sống thực tế tại Bangladesh)', labelTh: 'ผู้พำนักในบังกลาเทศ (อาศัยอยู่จริงในบังกลาเทศ)', labelRu: 'Резидент Бангладеш (проживающий в Бангладеш)', implemented: true, needsState: false, more: buildCountryMore('bd') },
  { code: 'pk', flagCode: 'PK', label: '파키스탄 거주자 (실제 파키스탄 거주 기준, 추정치 ⚠️)', labelEn: 'Pakistan resident (living in Pakistan, unverified estimate ⚠️)', labelZh: '巴基斯坦居民（实际住在巴基斯坦，估算值⚠️）', labelVi: 'Cư dân Pakistan (sống thực tế tại Pakistan, ước tính ⚠️)', labelTh: 'ผู้พำนักในปากีสถาน (อาศัยอยู่จริงในปากีสถาน, ค่าประมาณ ⚠️)', labelRu: 'Резидент Пакистана (проживающий в Пакистане, оценка ⚠️)', implemented: true, needsState: false, more: buildCountryMore('pk', 'estimate') },
  { code: 'kh', flagCode: 'KH', label: '캄보디아 거주자 (실제 캄보디아 거주 기준, 추정치 ⚠️)', labelEn: 'Cambodia resident (living in Cambodia, unverified estimate ⚠️)', labelZh: '柬埔寨居民（实际住在柬埔寨，估算值⚠️）', labelVi: 'Cư dân Campuchia (sống thực tế tại Campuchia, ước tính ⚠️)', labelTh: 'ผู้พำนักในกัมพูชา (อาศัยอยู่จริงในกัมพูชา, ค่าประมาณ ⚠️)', labelRu: 'Резидент Камбоджи (проживающий в Камбодже, оценка ⚠️)', implemented: true, needsState: false, more: buildCountryMore('kh', 'estimate') },
  { code: 'mn', flagCode: 'MN', label: '몽골 거주자 (실제 몽골 거주 기준, 추정치 ⚠️)', labelEn: 'Mongolia resident (living in Mongolia, unverified estimate ⚠️)', labelZh: '蒙古居民（实际住在蒙古，估算值⚠️）', labelVi: 'Cư dân Mông Cổ (sống thực tế tại Mông Cổ, ước tính ⚠️)', labelTh: 'ผู้พำนักในมองโกเลีย (อาศัยอยู่จริงในมองโกเลีย, ค่าประมาณ ⚠️)', labelRu: 'Резидент Монголии (проживающий в Монголии, оценка ⚠️)', implemented: true, needsState: false, more: buildCountryMore('mn', 'estimate') },
  { code: 'la', flagCode: 'LA', label: '라오스 거주자 (실제 라오스 거주 기준, 추정치 ⚠️)', labelEn: 'Laos resident (living in Laos, unverified estimate ⚠️)', labelZh: '老挝居民（实际住在老挝，估算值⚠️）', labelVi: 'Cư dân Lào (sống thực tế tại Lào, ước tính ⚠️)', labelTh: 'ผู้พำนักในลาว (อาศัยอยู่จริงในลาว, ค่าประมาณ ⚠️)', labelRu: 'Резидент Лаоса (проживающий в Лаосе, оценка ⚠️)', implemented: true, needsState: false, more: buildCountryMore('la', 'estimate') },
];

// 나라별 비교 카드가 텍스트/숫자로만 나열돼서 폰에서 심심하다는 피드백 — 카드를 탭하면 이
// 지도 위 해당 국가 위치에 핀이 표시되게 함. 실제 국경선 데이터(index.html의 country-map-land
// path들)에서 각 나라 폴리곤의 무게중심을 계산해 나온 x/y(%) 좌표라, 핀이 실제 그 나라 위에 찍힘
const COUNTRY_MAP_COORDS = {
  KR: { x: 90.1, y: 34.8 },
  US: { x: 17.9, y: 37.5 },
  VN: { x: 80.7, y: 54.1 },
  CN: { x: 79.6, y: 34.6 },
  IN: { x: 69.0, y: 48.0 },
  ID: { x: 84.1, y: 70.6 },
  PH: { x: 87.4, y: 55.0 },
  TH: { x: 78.4, y: 55.7 },
  JP: { x: 94.1, y: 35.2 },
  RU: { x: 80.0, y: 19.5 },
  NP: { x: 70.9, y: 42.8 },
  LK: { x: 69.5, y: 62.8 },
  UZ: { x: 61.8, y: 29.6 },
  KZ: { x: 63.8, y: 23.4 },
  KG: { x: 66.8, y: 29.9 },
  MM: { x: 76.4, y: 49.8 },
  BD: { x: 73.7, y: 47.1 },
  PK: { x: 64.5, y: 41.1 },
  KH: { x: 80.1, y: 58.0 },
  MN: { x: 79.2, y: 24.7 },
  LA: { x: 79.6, y: 52.4 },
};

let countryMapPinsRendered = false;
// 좌표가 고정값이라 여러 번 다시 그릴 필요 없음 — updateSideBySide()는 금액이 바뀔 때마다
// 반복 호출되므로, 핀 DOM은 최초 1회만 만들고 이후엔 그대로 재사용함
function renderCountryMapPinsOnce(){
  if (countryMapPinsRendered) return;
  const g = document.getElementById('countryMapPins');
  if (!g) return;
  Object.keys(COUNTRY_MAP_COORDS).forEach(code => {
    const { x, y } = COUNTRY_MAP_COORDS[code];
    const cx = (x / 100 * 1000).toFixed(1);
    const cy = (y / 100 * 450).toFixed(1);
    // 핀 뒤에 깔리는 파문(ping) 링 — 선택되면 이 링이 커지면서 흐려지는 걸 반복해, 지도 위치를
    // 찾는 순간이 더 눈에 띄고 재미있게 느껴지도록 함(핀 색이 바뀌기만 하는 것보다 생동감 있음)
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', cx);
    ring.setAttribute('cy', cy);
    ring.setAttribute('r', 5);
    ring.setAttribute('class', 'country-map-pin-ring');
    ring.dataset.flagCode = code;
    g.appendChild(ring);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', 5);
    circle.setAttribute('class', 'country-map-pin');
    circle.dataset.flagCode = code;
    circle.setAttribute('tabindex', '0');
    circle.setAttribute('role', 'button');
    circle.addEventListener('click', () => highlightCountryOnMap([code]));
    circle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); highlightCountryOnMap([code]); }
    });
    g.appendChild(circle);
  });
  countryMapPinsRendered = true;
}

// flagCodes: 카드 하나가 실수령액 동일 그룹(여러 나라 묶음)이면 전부 같이 하이라이트함.
// labelText가 없으면 콜아웃에 첫 번째 나라 코드를 그대로 표시함
function highlightCountryOnMap(flagCodes, labelText){
  const wrap = document.getElementById('countryMapWrap');
  if (!wrap) return;
  // 지도는 카드 목록보다 위에 있어서, 카드를 눌렀을 때 지도가 이미 화면 밖으로 스크롤돼
  // 있으면 하이라이트가 바뀌어도 안 보임(사용자 지적: "다른 나라 누르면 지도가 핸드폰으로
  // 한눈에 안 보임") — 지도가 화면에 없을 때만 부드럽게 스크롤해서 보이게 함
  // (block:'nearest'라 이미 보이는 상태면 스크롤이 발생하지 않음)
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  wrap.querySelectorAll('.country-map-pin').forEach(p => p.classList.remove('active'));
  wrap.querySelectorAll('.country-map-pin-ring').forEach(r => r.classList.remove('active'));
  wrap.querySelectorAll('.country-map-land').forEach(l => l.classList.remove('active'));
  let firstCoord = null;
  flagCodes.forEach(code => {
    const pin = wrap.querySelector(`.country-map-pin[data-flag-code="${code}"]`);
    const ring = wrap.querySelector(`.country-map-pin-ring[data-flag-code="${code}"]`);
    const land = wrap.querySelector(`.country-map-land[data-flag-code="${code}"]`);
    if (pin) {
      pin.classList.add('active');
      if (ring) ring.classList.add('active');
      if (land) land.classList.add('active');
      if (!firstCoord) firstCoord = COUNTRY_MAP_COORDS[code];
    }
  });
  const callout = document.getElementById('countryMapCallout');
  if (!callout || !firstCoord) return;
  callout.textContent = labelText || flagCodes[0];
  // 핀이 지도 가장자리(특히 한국·일본처럼 오른쪽 끝)에 있으면 말풍선이 중앙정렬 기준으로
  // 지도 밖까지 삐져나가므로, 좌우로 여유를 두고 위치를 clamp함
  const clampedX = Math.max(18, Math.min(82, firstCoord.x));
  callout.style.left = clampedX + '%';
  callout.style.top = firstCoord.y + '%';
  // 말풍선이 그냥 나타나기보다 살짝 통통 튀며 팝인되도록(is-visible 클래스의 CSS 트랜지션)
  callout.classList.add('is-visible');
}

// "(실제 OO 거주 기준)" 같은 부연설명 괄호를 뗀 짧은 라벨 — 좁은 카드/목록 칸에서 3~4줄로
// 지저분하게 줄바꿈되는 걸 막기 위해 씀(비교 카드·잭팟 히스토리 국가별 금액 목록 등 공용).
// 여백이 넉넉한 곳(breakdown 상세 섹션 등)에서는 원문 label을 그대로 써야 함
function getProfileShortLabel(profile){
  const full = pickLang(profile.label, profile.labelEn, profile.labelZh, profile.labelVi, profile.labelTh, profile.labelRu, profile.more);
  return full.replace(/\s*[（(][^）)]*[)）]\s*$/, '');
}

// 실수령액이 같은 나라끼리 묶은 카드/지도 라벨 — 국기 배지만 있고 나라 이름이 아예 안 보이면
// (특히 국기만 봐서는 못 알아보는 나라가 섞였을 때) 어느 나라들인지 알 길이 없어서, 3개국까지는
// 이름을 그대로 나열하고, 그보다 많아지면(카드 레이아웃도 이 기준으로 나뉨) "N개국 동일"로 축약함
function getGroupSameLabel(rows){
  if (rows.length <= 3) {
    return rows.map(row => getProfileShortLabel(row.profile)).join(' · ');
  }
  return pickLang(`${rows.length}개국 동일`, `Same for ${rows.length} countries`, `${rows.length}个国家相同`, `Giống nhau ở ${rows.length} nước`, `เท่ากันใน ${rows.length} ประเทศ`, `Одинаково для ${rows.length} стран`, buildSameCountMore(rows.length));
}

// breakdown 상세 섹션처럼 원문 label을 그대로 쓰는 곳은 "OO 거주자 (실제 OO 거주 기준)"처럼
// 괄호 안에 공백이 여러 개 있어서, 좁은 화면(아이폰 등)에서 줄바꿈이 괄호 중간("(실제"에서
// 뚝 끊기고 "우즈베키스탄 거주 기준)"이 다음 줄로 밀림)에 걸리는 문제가 있었음. 괄호 절 안의
// 공백을 줄바꿈 없는 공백(nbsp)으로 바꿔서 평소엔 절 전체가 붙어 다니게 하되, white-space:nowrap
// 처럼 완전히 줄바꿈을 막아버리진 않음 — 아주 좁은 화면에서 절 전체도 안 들어갈 만큼 길면
// (예: ", 근사치)"까지 붙는 경우) overflow-wrap:break-word 폴백으로 넘치지 않고 그냥 깨져서
// 들어가게 함(카드 밖으로 튀어나오는 것보단 나음)
function appendLabelWithNowrapParen(el, text){
  const parenStart = text.search(/[（(]/);
  if (parenStart === -1) { el.append(document.createTextNode(text)); return; }
  el.append(document.createTextNode(text.slice(0, parenStart)));
  const tail = text.slice(parenStart);
  const lastSpace = tail.lastIndexOf(' ');
  const fixedTail = lastSpace === -1 ? tail : tail.slice(0, lastSpace) + ' ' + tail.slice(lastSpace + 1);
  el.append(document.createTextNode(fixedTail));
}

// "한국에 사는 OO 국적자" 안내 페이지 목록 — 실제 그 나라 세법이 아니라 한국 세법(위 kr 기준)을
// 그대로 따르는 번역 콘텐츠라서, COUNTRY_TAX_PROFILES(진짜 다른 나라 세금 비교)와는 완전히 분리해서 관리함.
// 새 언어 추가할 땐 이 배열에 한 줄만 추가하면 됨.
const LANGUAGE_CONTENT_PAGES = [
  { flagCode: 'VN', label: '한국에 사는 베트남분이라면', labelEn: 'Living in Korea as a Vietnamese national', labelZh: '住在韩国的越南人', labelVi: 'Là công dân Việt Nam sống ở Hàn Quốc', labelTh: 'สำหรับชาวเวียดนามที่อาศัยในเกาหลี', labelRu: 'Для граждан Вьетнама, живущих в Корее', contentPage: 'vietnamese-in-korea-lottery-tax.html', contentLabel: 'Tiếng Việt →', more: buildCountryMore('vn') },
  { flagCode: 'CN', label: '한국에 사는 중국분이라면', labelEn: 'Living in Korea as a Chinese national', labelZh: '住在韩国的中国人', labelVi: 'Là công dân Trung Quốc sống ở Hàn Quốc', labelTh: 'สำหรับชาวจีนที่อาศัยในเกาหลี', labelRu: 'Для граждан Китая, живущих в Корее', contentPage: 'china_in_korea_lottery_tax.html', contentLabel: '中文 →', more: buildCountryMore('cn') },
  { flagCode: 'TH', label: '한국에 사는 태국분이라면', labelEn: 'Living in Korea as a Thai national', labelZh: '住在韩国的泰国人', labelVi: 'Là công dân Thái Lan sống ở Hàn Quốc', labelTh: 'สำหรับชาวไทยที่อาศัยในเกาหลี', labelRu: 'Для граждан Таиланда, живущих в Корее', contentPage: 'thai_in_korea_lottery_tax.html', contentLabel: 'ภาษาไทย →', more: buildCountryMore('th') },
  { flagCode: 'PH', label: '한국에 사는 필리핀분이라면', labelEn: 'Living in Korea as a Filipino national', labelZh: '住在韩国的菲律宾人', labelVi: 'Là công dân Philippines sống ở Hàn Quốc', labelTh: 'สำหรับชาวฟิลิปปินส์ที่อาศัยในเกาหลี', labelRu: 'Для граждан Филиппин, живущих в Корее', contentPage: 'philippines_in_korea_lottery_tax.html', contentLabel: 'Tagalog →', more: buildCountryMore('ph') },
  { flagCode: "AR", label: "한국에 사는 아랍어권 분이라면", labelEn: "Living in Korea and speak Arabic", labelZh: "住在韩国的阿拉伯语使用者", labelVi: "Nói tiếng Ả Rập và sống ở Hàn Quốc", labelTh: "สำหรับผู้พูดภาษาอาหรับที่อาศัยในเกาหลี", labelRu: "Для арабоговорящих, живущих в Корее", contentPage: "arabic_in_korea_lottery_tax.html", contentLabel: "العربية →", more: {
    km: "ប្រសិនបើអ្នកជាអ្នកប្រើប្រាស់ភាសាអារ៉ាប់ដែលរស់នៅក្នុងប្រទេសកូរ៉េ", ne: "यदि तपाईं कोरियामा बस्ने अरबी भाषी हुनुहुन्छ भने",
    id: "Jika Anda penutur bahasa Arab yang tinggal di Korea", my: "ကိုရီးယားတွင်နေထိုင်သော အာရပ်ဘာသာစကားပြောသူများအတွက်",
    si: "ඔබ කොරියාවේ වෙසෙන අරාබි භාෂාව කතා කරන අයෙක් නම්", uz: "Agar siz Koreyada yashovchi arab zaboni bo'lsangiz",
    mn: "Хэрэв та Солонгост амьдардаг араб хэлтэй хүн бол", kk: "Егер сіз Кореяда тұратын араб тілді адам болсаңыз",
    ky: "Эгер сиз Кореяда жашаган араб тилдүү адам болсоңуз", ur: "اگر آپ کوریا میں مقیم عربی بولنے والے فرد ہیں",
    bn: "আপনি যদি কোরিয়ায় বসবাসকারী আরবি ভাষী হন", lo: "ຖ້າທ່ານເປັນຜູ້ໃຊ້ພາສາອາຣັບທີ່ອາໄສຢູ່ໃນເກົາຫຼີ",
    ja: "韓国にお住まいのアラビア語圏の方はこちら", ar: "إذا كنت من الناطقين باللغة العربية المقيمين في كوريا",
    hi: "यदि आप कोरिया में रहने वाले अरबी भाषी व्यक्ति हैं", fr: "Si vous êtes un arabophone résidant en Corée",
    tl: "Kung ikaw ay nagsasalita ng Arabe na nakatira sa Korea",
  } },
  { flagCode: "BD", label: "한국에 사는 방글라데시분이라면", labelEn: "Living in Korea as a Bangladeshi national", labelZh: "住在韩国的孟加拉国人", labelVi: "Là công dân Bangladesh sống ở Hàn Quốc", labelTh: "สำหรับชาวบังกลาเทศที่อาศัยในเกาหลี", labelRu: "Для граждан Бангладеш, живущих в Корее", contentPage: "bengali_in_korea_lottery_tax.html", contentLabel: "বাংলা →", more: buildCountryMore('bd') },
  { flagCode: "KH", label: "한국에 사는 캄보디아분이라면", labelEn: "Living in Korea as a Cambodian national", labelZh: "住在韩国的柬埔寨人", labelVi: "Là công dân Campuchia sống ở Hàn Quốc", labelTh: "สำหรับชาวกัมพูชาที่อาศัยในเกาหลี", labelRu: "Для граждан Камбоджи, живущих в Корее", contentPage: "cambodian_in_korea_lottery_tax.html", contentLabel: "ខ្មែរ →", more: buildCountryMore('kh') },
  { flagCode: "FR", label: "한국에 사는 프랑스어권 분이라면", labelEn: "Living in Korea and speak French", labelZh: "住在韩国的法语使用者", labelVi: "Nói tiếng Pháp và sống ở Hàn Quốc", labelTh: "สำหรับผู้พูดภาษาฝรั่งเศสที่อาศัยในเกาหลี", labelRu: "Для франкоговорящих, живущих в Корее", contentPage: "french_in_korea_lottery_tax.html", contentLabel: "Français →", more: {
    km: "ប្រសិនបើអ្នកជាអ្នកប្រើប្រាស់ភាសាបារាំងដែលរស់នៅក្នុងប្រទេសកូរ៉េ", ne: "यदि तपाईं कोरियामा बस्ने फ्रान्सेली भाषी हुनुहुन्छ भने",
    id: "Jika Anda penutur bahasa Prancis yang tinggal di Korea", my: "ကိုရီးယားတွင်နေထိုင်သော ပြင်သစ်ဘာသာစကားပြောသူများအတွက်",
    si: "ඔබ කොරියාවේ වෙසෙන ප්‍රංශ භාෂාව කතා කරන අයෙක් නම්", uz: "Agar siz Koreyada yashovchi fransuz zaboni bo'lsangiz",
    mn: "Хэрэв та Солонгост амьдардаг франц хэлтэй хүн бол", kk: "Егер сіз Кореяда тұратын француз тілді адам болсаңыз",
    ky: "Эгер сиз Кореяда жашаган француз тилдүү адам болсоңуз", ur: "اگر آپ کوریا میں مقیم فرانسیسی بولنے والے فرد ہیں",
    bn: "আপনি যদি কোরিয়ায় বসবাসকারী ফরাসি ভাষী হন", lo: "ຖ້າທ່ານເປັນຜູ້ໃຊ້ພາສາຝຣັ່ງທີ່ອາໄສຢູ່ໃນເກົາຫຼີ",
    ja: "韓国にお住まいのフランス語圏の方はこちら", ar: "إذا كنت من الناطقين باللغة الفرنسية المقيمين في كوريا",
    hi: "यदि आप कोरिया में रहने वाले फ्रांसीसी भाषी व्यक्ति हैं", fr: "Si vous êtes un francophone résidant en Corée",
    tl: "Kung ikaw ay nagsasalita ng Pranses na nakatira sa Korea",
  } },
  { flagCode: "IN", label: "한국에 사는 인도분이라면 (힌디어)", labelEn: "Living in Korea as an Indian national (Hindi)", labelZh: "住在韩国的印度人（印地语）", labelVi: "Là công dân Ấn Độ sống ở Hàn Quốc (tiếng Hindi)", labelTh: "สำหรับชาวอินเดียที่อาศัยในเกาหลี (ภาษาฮินดี)", labelRu: "Для граждан Индии, живущих в Корее (хинди)", contentPage: "hindi_in_korea_lottery_tax.html", contentLabel: "हिन्दी →", more: buildCountryMore('in') },
  { flagCode: "ID", label: "한국에 사는 인도네시아분이라면", labelEn: "Living in Korea as an Indonesian national", labelZh: "住在韩国的印尼人", labelVi: "Là công dân Indonesia sống ở Hàn Quốc", labelTh: "สำหรับชาวอินโดนีเซียที่อาศัยในเกาหลี", labelRu: "Для граждан Индонезии, живущих в Корее", contentPage: "indonesian_in_korea_lottery_tax.html", contentLabel: "Bahasa Indonesia →", more: buildCountryMore('id') },
  { flagCode: "JP", label: "한국에 사는 일본분이라면", labelEn: "Living in Korea as a Japanese national", labelZh: "住在韩国的日本人", labelVi: "Là công dân Nhật Bản sống ở Hàn Quốc", labelTh: "สำหรับชาวญี่ปุ่นที่อาศัยในเกาหลี", labelRu: "Для граждан Японии, живущих в Корее", contentPage: "japanese_in_korea_lottery_tax.html", contentLabel: "日本語 →", more: buildCountryMore('jp') },
  { flagCode: "KZ", label: "한국에 사는 카자흐스탄분이라면", labelEn: "Living in Korea as a Kazakhstani national", labelZh: "住在韩国的哈萨克斯坦人", labelVi: "Là công dân Kazakhstan sống ở Hàn Quốc", labelTh: "สำหรับชาวคาซัคสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Казахстана, живущих в Корее", contentPage: "kazakh_in_korea_lottery_tax.html", contentLabel: "Қазақша →", more: buildCountryMore('kz') },
  { flagCode: "KG", label: "한국에 사는 키르기스스탄분이라면", labelEn: "Living in Korea as a Kyrgyzstani national", labelZh: "住在韩国的吉尔吉斯斯坦人", labelVi: "Là công dân Kyrgyzstan sống ở Hàn Quốc", labelTh: "สำหรับชาวคีร์กีซสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Кыргызстана, живущих в Корее", contentPage: "kyrgyz_in_korea_lottery_tax.html", contentLabel: "Кыргызча →", more: buildCountryMore('kg') },
  { flagCode: "LA", label: "한국에 사는 라오스분이라면", labelEn: "Living in Korea as a Laotian national", labelZh: "住在韩国的老挝人", labelVi: "Là công dân Lào sống ở Hàn Quốc", labelTh: "สำหรับชาวลาวที่อาศัยในเกาหลี", labelRu: "Для граждан Лаоса, живущих в Корее", contentPage: "lao_in_korea_lottery_tax.html", contentLabel: "ລາວ →", more: buildCountryMore('la') },
  { flagCode: "MN", label: "한국에 사는 몽골분이라면", labelEn: "Living in Korea as a Mongolian national", labelZh: "住在韩国的蒙古人", labelVi: "Là công dân Mông Cổ sống ở Hàn Quốc", labelTh: "สำหรับชาวมองโกเลียที่อาศัยในเกาหลี", labelRu: "Для граждан Монголии, живущих в Корее", contentPage: "mongolian_in_korea_lottery_tax.html", contentLabel: "Монгол →", more: buildCountryMore('mn') },
  { flagCode: "MM", label: "한국에 사는 미얀마분이라면", labelEn: "Living in Korea as a Myanmar national", labelZh: "住在韩国的缅甸人", labelVi: "Là công dân Myanmar sống ở Hàn Quốc", labelTh: "สำหรับชาวเมียนมาที่อาศัยในเกาหลี", labelRu: "Для граждан Мьянмы, живущих в Корее", contentPage: "myanmar_in_korea_lottery_tax.html", contentLabel: "မြန်မာ →", more: buildCountryMore('mm') },
  { flagCode: "NP", label: "한국에 사는 네팔분이라면", labelEn: "Living in Korea as a Nepali national", labelZh: "住在韩国的尼泊尔人", labelVi: "Là công dân Nepal sống ở Hàn Quốc", labelTh: "สำหรับชาวเนปาลที่อาศัยในเกาหลี", labelRu: "Для граждан Непала, живущих в Корее", contentPage: "nepali_in_korea_lottery_tax.html", contentLabel: "नेपाली →", more: buildCountryMore('np') },
  { flagCode: "RU", label: "한국에 사는 러시아분이라면", labelEn: "Living in Korea as a Russian national", labelZh: "住在韩国的俄罗斯人", labelVi: "Là công dân Nga sống ở Hàn Quốc", labelTh: "สำหรับชาวรัสเซียที่อาศัยในเกาหลี", labelRu: "Для граждан России, живущих в Корее", contentPage: "russian_in_korea_lottery_tax.html", contentLabel: "Русский →", more: buildCountryMore('ru') },
  { flagCode: "LK", label: "한국에 사는 스리랑카분이라면", labelEn: "Living in Korea as a Sri Lankan national", labelZh: "住在韩国的斯里兰卡人", labelVi: "Là công dân Sri Lanka sống ở Hàn Quốc", labelTh: "สำหรับชาวศรีลังกาที่อาศัยในเกาหลี", labelRu: "Для граждан Шри-Ланки, живущих в Корее", contentPage: "srilanka_in_korea_lottery_tax.html", contentLabel: "සිංහල →", more: buildCountryMore('lk') },
  { flagCode: "PK", label: "한국에 사는 파키스탄분이라면", labelEn: "Living in Korea as a Pakistani national", labelZh: "住在韩国的巴基斯坦人", labelVi: "Là công dân Pakistan sống ở Hàn Quốc", labelTh: "สำหรับชาวปากีสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Пакистана, живущих в Корее", contentPage: "urdu_in_korea_lottery_tax.html", contentLabel: "اردو →", more: buildCountryMore('pk') },
  { flagCode: "UZ", label: "한국에 사는 우즈베키스탄분이라면", labelEn: "Living in Korea as an Uzbekistani national", labelZh: "住在韩国的乌兹别克斯坦人", labelVi: "Là công dân Uzbekistan sống ở Hàn Quốc", labelTh: "สำหรับชาวอุซเบกิสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Узбекистана, живущих в Корее", contentPage: "uzbek_in_korea_lottery_tax.html", contentLabel: "O'zbek →", more: buildCountryMore('uz') },
  { flagCode: "ES", label: "한국에 사는 스페인어권 분이라면", labelEn: "Living in Korea and speak Spanish", labelZh: "住在韩国的西班牙语使用者", labelVi: "Nói tiếng Tây Ban Nha và sống ở Hàn Quốc", labelTh: "สำหรับผู้พูดภาษาสเปนที่อาศัยในเกาหลี", labelRu: "Для испаноговорящих, живущих в Корее", contentPage: "spanish_in_korea_lottery_tax.html", contentLabel: "Español →", more: {
    km: "ប្រសិនបើអ្នកជាអ្នកប្រើប្រាស់ភាសាអេស្ប៉ាញដែលរស់នៅក្នុងប្រទេសកូរ៉េ", ne: "यदि तपाईं कोरियामा बस्ने स्पेनिश भाषी हुनुहुन्छ भने",
    id: "Jika Anda penutur bahasa Spanyol yang tinggal di Korea", my: "ကိုရီးယားတွင်နေထိုင်သော စပိန်ဘာသာစကားပြောသူများအတွက်",
    si: "ඔබ කොරියාවේ වෙසෙන ස්පාඤ්ඤ භාෂාව කතා කරන අයෙක් නම්", uz: "Agar siz Koreyada yashovchi spanyon zaboni bo'lsangiz",
    mn: "Хэрэв та Солонгост амьдардаг испани хэлтэй хүн бол", kk: "Егер сіз Кореяда тұратын испан тілді адам болсаңыз",
    ky: "Эгер сиз Кореяда жашаган испан тилдүү адам болсоңуз", ur: "اگر آپ کوریا میں مقیم ہسپانوی بولنے والے فرد ہیں",
    bn: "আপনি যদি কোরিয়ায় বসবাসকারী স্প্যানিশ ভাষী হন", lo: "ຖ້າທ່ານເປັນຜູ້ໃຊ້ພາສາສະເປນທີ່ອາໄສຢູ່ໃນເກົາຫຼີ",
    ja: "韓国にお住まいのスペイン語圏の方はこちら", ar: "إذا كنت من الناطقين باللغة الإسبانية المقيمين في كوريا",
    hi: "यदि आप कोरिया में रहने वाले स्पैनिश भाषी व्यक्ति हैं", fr: "Si vous êtes un hispanophone résidant en Corée",
    tl: "Kung ikaw ay nagsasalita ng Espanyol na nakatira sa Korea",
  } },
  { flagCode: "BR", label: "한국에 사는 포르투갈어권 분이라면", labelEn: "Living in Korea and speak Portuguese", labelZh: "住在韩国的葡萄牙语使用者", labelVi: "Nói tiếng Bồ Đào Nha và sống ở Hàn Quốc", labelTh: "สำหรับผู้พูดภาษาโปรตุเกสที่อาศัยในเกาหลี", labelRu: "Для португалоговорящих, живущих в Корее", contentPage: "portuguese_in_korea_lottery_tax.html", contentLabel: "Português →", more: {
    km: "ប្រសិនបើអ្នកជាអ្នកប្រើប្រាស់ភាសាព័រទុយហ្គាល់ដែលរស់នៅក្នុងប្រទេសកូរ៉េ", ne: "यदि तपाईं कोरियामा बस्ने पोर्चुगेली भाषी हुनुहुन्छ भने",
    id: "Jika Anda penutur bahasa Portugis yang tinggal di Korea", my: "ကိုရီးယားတွင်နေထိုင်သော ပေါ်တူဂီဘာသာစကားပြောသူများအတွက်",
    si: "ඔබ කොරියාවේ වෙසෙන පෘතුගීසි භාෂාව කතා කරන අයෙක් නම්", uz: "Agar siz Koreyada yashovchi portugal zaboni bo'lsangiz",
    mn: "Хэрэв та Солонгост амьдардаг португал хэлтэй хүн бол", kk: "Егер сіз Кореяда тұратын португал тілді адам болсаңыз",
    ky: "Эгер сиз Кореяда жашаган португал тилдүү адам болсоңуз", ur: "اگر آپ کوریا میں مقیم پرتگالی بولنے والے فرد ہیں",
    bn: "আপনি যদি কোরিয়ায় বসবাসকারী পর্তুগিজ ভাষী হন", lo: "ຖ້າທ່ານເປັນຜູ້ໃຊ້ພາສາປອກຕຸຍການທີ່ອາໄສຢູ່ໃນເກົາຫຼີ",
    ja: "韓国にお住まいのポルトガル語圏の方はこちら", ar: "إذا كنت من الناطقين باللغة البرتغالية المقيمين في كوريا",
    hi: "यदि आप कोरिया में रहने वाले पुर्तगाली भाषी व्यक्ति हैं", fr: "Si vous êtes un lusophone résidant en Corée",
    tl: "Kung ikaw ay nagsasalita ng Portuges na nakatira sa Korea",
  } },
  { flagCode: "TW", label: "한국에 사는 대만·홍콩분이라면", labelEn: "Living in Korea as a Taiwanese or Hong Kong national", labelZh: "住在韩国的台湾人・香港人", labelVi: "Là người Đài Loan/Hồng Kông sống ở Hàn Quốc", labelTh: "สำหรับชาวไต้หวัน/ฮ่องกงที่อาศัยในเกาหลี", labelRu: "Для граждан Тайваня/Гонконга, живущих в Корее", contentPage: "taiwan_hk_in_korea_lottery_tax.html", contentLabel: "繁體中文 →", more: {
    km: "ប្រសិនបើអ្នកមកពីតៃវ៉ាន់ ឬហុងកុង ដែលរស់នៅក្នុងប្រទេសកូរ៉េ", ne: "यदि तपाईं कोरियामा बस्ने ताइवान वा हङकङका नागरिक हुनुहुन्छ भने",
    id: "Jika Anda warga Taiwan atau Hong Kong yang tinggal di Korea", my: "ကိုရီးယားတွင်နေထိုင်သော ထိုင်ဝမ် သို့မဟုတ် ဟောင်ကောင်မှ သူများအတွက်",
    si: "ඔබ කොරියාවේ වෙසෙන තායිවාන හෝ හොංකොං ජාතිකයෙක් නම්", uz: "Agar siz Koreyada yashovchi Tayvan yoki Gonkonglik bo'lsangiz",
    mn: "Хэрэв та Солонгост амьдардаг Тайвань эсвэл Хонконг гаралтай хүн бол", kk: "Егер сіз Кореяда тұратын Тайвань немесе Гонконг тұрғыны болсаңыз",
    ky: "Эгер сиз Кореяда жашаган Тайвань же Гонконгдон келген адам болсоңуз", ur: "اگر آپ کوریا میں مقیم تائیوان یا ہانگ کانگ کے شہری ہیں",
    bn: "আপনি যদি কোরিয়ায় বসবাসকারী তাইওয়ান বা হংকংয়ের নাগরিক হন", lo: "ຖ້າທ່ານເປັນຄົນໄຕ້ຫວັນ ຫຼື ຮ່ອງກົງ ທີ່ອາໄສຢູ່ໃນເກົາຫຼີ",
    ja: "韓国にお住まいの台湾・香港出身の方はこちら", ar: "إذا كنت من مقيمي كوريا القادمين من تايوان أو هونغ كونغ",
    hi: "यदि आप कोरिया में रहने वाले ताइवान या हांगकांग के निवासी हैं", fr: "Si vous êtes originaire de Taïwan ou de Hong Kong et résidez en Corée",
    tl: "Kung ikaw ay mula sa Taiwan o Hong Kong na nakatira sa Korea",
  } },
  { flagCode: "TL", label: "한국에 사는 동티모르분이라면", labelEn: "Living in Korea as a Timorese national", labelZh: "住在韩国的东帝汶人", labelVi: "Là công dân Đông Timor sống ở Hàn Quốc", labelTh: "สำหรับชาวติมอร์-เลสเตที่อาศัยในเกาหลี", labelRu: "Для граждан Восточного Тимора, живущих в Корее", contentPage: "timor_in_korea_lottery_tax.html", contentLabel: "Tetun →", more: {
    km: "ប្រសិនបើអ្នកមកពីទីម័រខាងកើតដែលរស់នៅក្នុងប្រទេសកូរ៉េ", ne: "यदि तपाईं कोरियामा बस्ने पूर्वी तिमोरका नागरिक हुनुहुन्छ भने",
    id: "Jika Anda warga Timor Leste yang tinggal di Korea", my: "ကိုရီးယားတွင်နေထိုင်သော အရှေ့တီမောမှ သူများအတွက်",
    si: "ඔබ කොරියාවේ වෙසෙන නැගෙනහිර තිමෝර ජාතිකයෙක් නම්", uz: "Agar siz Koreyada yashovchi Sharqiy Timorlik bo'lsangiz",
    mn: "Хэрэв та Солонгост амьдардаг Зүүн Тиморын иргэн бол", kk: "Егер сіз Кореяда тұратын Шығыс Тимор тұрғыны болсаңыз",
    ky: "Эгер сиз Кореяда жашаган Чыгыш Тимордон келген адам болсоңуз", ur: "اگر آپ کوریا میں مقیم مشرقی تیمور کے شہری ہیں",
    bn: "আপনি যদি কোরিয়ায় বসবাসকারী পূর্ব তিমুরের নাগরিক হন", lo: "ຖ້າທ່ານເປັນຄົນຕີມໍຕາເວັນອອກທີ່ອາໄສຢູ່ໃນເກົາຫຼີ",
    ja: "韓国にお住まいの東ティモール出身の方はこちら", ar: "إذا كنت من مقيمي كوريا القادمين من تیمور الشرقية",
    hi: "यदि आप कोरिया में रहने वाले पूर्वी तिमोर के निवासी हैं", fr: "Si vous êtes originaire du Timor oriental et résidez en Corée",
    tl: "Kung ikaw ay mula sa Timor-Leste na nakatira sa Korea",
  } },
  { flagCode: "UA", label: "한국에 사는 우크라이나분이라면", labelEn: "Living in Korea as a Ukrainian national", labelZh: "住在韩国的乌克兰人", labelVi: "Là công dân Ukraine sống ở Hàn Quốc", labelTh: "สำหรับชาวยูเครนที่อาศัยในเกาหลี", labelRu: "Для граждан Украины, живущих в Корее", contentPage: "ukrainian_in_korea_lottery_tax.html", contentLabel: "Українська →", more: {
    km: "ប្រសិនបើអ្នកមកពីអ៊ុយក្រែនដែលរស់នៅក្នុងប្រទេសកូរ៉េ", ne: "यदि तपाईं कोरियामा बस्ने युक्रेनी नागरिक हुनुहुन्छ भने",
    id: "Jika Anda warga Ukraina yang tinggal di Korea", my: "ကိုရီးယားတွင်နေထိုင်သော ယူကရိန်းမှ သူများအတွက်",
    si: "ඔබ කොරියාවේ වෙසෙන යුක්‍රේන ජාතිකයෙක් නම්", uz: "Agar siz Koreyada yashovchi Ukrainlik bo'lsangiz",
    mn: "Хэрэв та Солонгост амьдардаг Украин иргэн бол", kk: "Егер сіз Кореяда тұратын Украина тұрғыны болсаңыз",
    ky: "Эгер сиз Кореяда жашаган Украинадан келген адам болсоңуз", ur: "اگر آپ کوریا میں مقیم یوکرینی شہری ہیں",
    bn: "আপনি যদি কোরিয়ায় বসবাসকারী ইউক্রেনের নাগরিক হন", lo: "ຖ້າທ່ານເປັນຄົນຢູເຄຣນທີ່ອາໄສຢູ່ໃນເກົາຫຼີ",
    ja: "韓国にお住まいのウクライナ出身の方はこちら", ar: "إذا كنت من مقيمي كوريا القادمين من أوكرانيا",
    hi: "यदि आप कोरिया में रहने वाले यूक्रेनी निवासी हैं", fr: "Si vous êtes originaire d'Ukraine et résidez en Corée",
    tl: "Kung ikaw ay mula sa Ukraine na nakatira sa Korea",
  } },
];

// 국기 이모지(regional indicator 시퀀스)는 기기·브라우저에 따라 실제 국기 대신 "KR" 같은
// 문자로 깨져서 나오는 경우가 있어서(특히 일부 임베디드 웹뷰), 이모지 대신 항상 동일하게
// 렌더링되는 색 배지(span.flag-badge)로 통일해서 씀
function makeFlagBadge(code){
  const span = document.createElement('span');
  span.className = 'flag-badge';
  span.textContent = code;
  return span;
}

function renderLanguageContentLinks(){
  const container = document.getElementById('otherLanguagesList');
  if (!container) return;
  container.innerHTML = '';
  // 26개 항목 전부 "한국에 사는 OO분이라면"을 통째로 반복하면 목록 하나가 화면 여러 장
  // 분량으로 늘어져서, 국기 배지 + 언어명만 남기고 반복 문구는 뺌 — 위 아코디언 제목이
  // 이미 "한국에 사는 다른 나라 분이라면"으로 맥락을 잡아주므로 각 줄에서 또 반복할 필요 없음.
  // 전체 문장은 스크린리더용 aria-label로만 남겨서 접근성은 그대로 유지함
  LANGUAGE_CONTENT_PAGES.forEach(item => {
    const row = document.createElement('a');
    row.className = 'other-lang-row';
    row.href = item.contentPage;
    row.setAttribute('aria-label', pickLang(item.label, item.labelEn, item.labelZh, item.labelVi, item.labelTh, item.labelRu, item.more));
    row.append(makeFlagBadge(item.flagCode), document.createTextNode(' ' + item.contentLabel));
    container.appendChild(row);
  });
}

function updateSideBySide(eok, stateCode){
  const grid = document.getElementById('sideByCountryGrid');
  const breakdownContainer = document.getElementById('sideBreakdownContainer');
  if (!grid || !breakdownContainer) return;
  renderCountryMapPinsOnce();
  grid.innerHTML = '';
  breakdownContainer.innerHTML = '';

  // 실수령액이 큰 순서로 훑어볼 수 있게, 렌더링 전에 먼저 전부 계산해서 정렬함 —
  // 예전엔 COUNTRY_TAX_PROFILES에 적힌 순서 그대로(딱히 의미 없는 순서) 나열돼서
  // "어디가 제일 유리한지" 보려면 20개국을 하나하나 다 확인해야 했음
  const implementedRows = [];
  const pendingProfiles = [];
  COUNTRY_TAX_PROFILES.forEach(profile => {
    if (!profile.implemented) { pendingProfiles.push(profile); return; }
    const result = calcTakeHome(eok, profile.code, profile.needsState ? (stateCode || 'AVG') : null);
    const pct = eok > 0 ? (result.final / eok * 100) : 0;
    implementedRows.push({ profile, result, pct });
  });
  implementedRows.sort((a, b) => b.result.final - a.result.final);

  // 세율이 미국 원천징수(30%)보다 낮은 나라는 FTC로 자국세가 전부 상계돼서 실수령액이 서로 완전히
  // 같아지는 경우가 흔함(예: 베트남 10%, 중국 20%, 인도네시아 25%... 등이 전부 "미국 30%만" 남는
  // 동일한 결과가 됨) — 화면에 똑같은 카드가 5~6개씩 반복되면 "제대로 계산한 거 맞나" 싶어 보이므로,
  // 실수령액이 같은 나라들은 카드 하나로 묶어서 국기만 나란히 보여줌.
  // formatWon()의 표시 문자열이 아니라 억 단위 반올림 값으로 묶음 — en/zh/ja 등은 billion/million
  // 단위를 소수점 1자리로 뭉뚱그려 표시하므로, 표시 문자열 기준으로 묶으면 실제로는 세율 구조가
  // 전혀 다른 나라들이 반올림상 같은 문자열로 겹쳐 보인다는 이유만으로 잘못 묶일 수 있음
  const groups = [];
  implementedRows.forEach(row => {
    const key = Math.round(row.result.final);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(row);
    } else {
      groups.push({ key, rows: [row] });
    }
  });

  groups.forEach((group, gi) => {
    const { rows } = group;
    const { result, pct } = rows[0];

    const card = document.createElement('div');
    card.className = 'side-card';
    if (gi === 0) {
      card.classList.add('side-card-best');
      const bestBadge = document.createElement('p');
      bestBadge.className = 'side-card-best-badge';
      bestBadge.textContent = pickLang('🔥 실수령액 1위', '🔥 Highest take-home', '🔥 实得金额第一', '🔥 Thực nhận cao nhất', '🔥 ได้รับจริงสูงสุด', '🔥 Больше всех на руки', {
        ar:'🔥 أعلى صافي دخل', bn:'🔥 সর্বোচ্চ প্রকৃত আয়', fr:'🔥 Revenu net le plus élevé', hi:'🔥 सबसे ज़्यादा हाथ में आने वाली राशि', id:'🔥 Take-home tertinggi', ja:'🔥 手取り額1位', kk:'🔥 Ең жоғары қолға тиетін сома', km:'🔥 ចំណូលសុទ្ធខ្ពស់បំផុត', ky:'🔥 Эң жогорку кол алдырма акча', lo:'🔥 ໄດ້ຮັບຈິງສູງສຸດ', mn:'🔥 Гарт орох хамгийн их дүн', my:'🔥 လက်ခံရရှိမှု အများဆုံး', ne:'🔥 सबैभन्दा बढी हातमा पर्ने रकम', si:'🔥 වැඩිම අත් ලාභය', tl:'🔥 Pinakamataas na take-home', ur:'🔥 سب سے زیادہ ہاتھ میں آنے والی رقم', uz:'🔥 Eng yuqori qoʻlga tegadigan summa'
      });
      card.appendChild(bestBadge);
    }

    if (rows.length === 1) {
      const { profile } = rows[0];
      const shortLabelText = getProfileShortLabel(profile);
      let stateSuffix = '';
      if (profile.needsState) {
        const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
        stateSuffix = ` (${pickLang(stateInfo.label, stateInfo.labelEn, stateInfo.labelZh, stateInfo.labelEn, stateInfo.labelEn, stateInfo.labelEn, buildStateNameMore(stateCode))})`;
      }
      const flagEl = document.createElement('p'); flagEl.className = 'side-card-flag';
      flagEl.append(makeFlagBadge(profile.flagCode), document.createTextNode(' ' + shortLabelText + stateSuffix));
      card.appendChild(flagEl);
      if (profile.detailPage) {
        var pendingDetailLink = { href: profile.detailPage, text: profile.detailLabel };
      }
    } else {
      // 국기 3개까지는 카드 한 칸 폭에 한 줄로 들어가서 그대로 둬도 되지만, 그보다 많으면
      // 여러 줄로 접히면서 카드가 세로로 길어져 옆 칸 카드와 키 차이가 커짐 — 그리드 전체
      // 폭을 쓰게 해서 국기를 가로로 펼치고 옆에 어색한 빈 공간이 남지 않게 함.
      // 2~3개국은 국기는 한 줄에 들어가도 getGroupSameLabel()이 나라 이름을 그대로 풀어서
      // 보여주므로(예: "필리핀 거주자 · 태국 거주자 · 라오스 거주자") 좁은 카드 폭에선 그
      // 텍스트가 몇 줄로 접혀 옆 칸보다 길어짐 — 그룹 카드는 전부 전체 폭으로 통일함
      if (rows.length > 1) card.classList.add('side-card-full');
      const flagsRowEl = document.createElement('div'); flagsRowEl.className = 'side-card-flags-row';
      const flagGroupEl = document.createElement('p'); flagGroupEl.className = 'side-card-flag-group';
      rows.forEach(row => { flagGroupEl.appendChild(makeFlagBadge(row.profile.flagCode)); });
      flagsRowEl.appendChild(flagGroupEl);
      const noteEl = document.createElement('p'); noteEl.className = 'side-card-group-note';
      noteEl.textContent = getGroupSameLabel(rows);
      flagsRowEl.appendChild(noteEl);
      card.appendChild(flagsRowEl);
    }

    const amtEl = document.createElement('p'); amtEl.className = 'side-card-amt'; amtEl.textContent = formatWon(result.final);
    if (gi === 0) {
      // 실수령률 %와 breakdown 막대는 목업상 1위 카드에서만 보여주는 강조 요소 — 나머지
      // 카드는 금액만 담백하게 표시해서 1위 카드와의 시각적 위계 차이를 분명히 함
      const rateEl = document.createElement('p'); rateEl.className = 'side-card-rate';
      rateEl.textContent = pickLang('실수령률 약 ', 'Take-home rate about ', '实得比例约', 'Tỷ lệ thực nhận khoảng ', 'อัตราที่ได้รับจริงประมาณ ', 'Ставка на руки около ', {
        ar:'نسبة الصافي حوالي ', bn:'প্রকৃত হার প্রায় ', fr:'Taux net environ ', hi:'वास्तविक दर लगभग ', id:'Tingkat take-home sekitar ', ja:'手取り率 約', kk:'Қолға тию мөлшерлемесі шамамен ', km:'អត្រាទទួលបានប្រហែល ', ky:'Кол алдырма чени болжол менен ', lo:'ອັດຕາທີ່ໄດ້ຮັບຈິງປະມານ ', mn:'Гарт орох хувь ойролцоогоор ', my:'လက်ခံရရှိမှု နှုန်း ခန့်မှန်း ', ne:'वास्तविक दर लगभग ', si:'අත් ලාභ අනුපාතය ආසන්න වශයෙන් ', tl:'Take-home rate humigit-kumulang ', ur:'حقیقی شرح تقریباً ', uz:'Qoʻlga tegadigan foiz taxminan '
      }) + pct.toFixed(1) + '%';
      // 홈 화면 결과 카드와 동일한 시각적 breakdown 막대를 국가별 카드에도 작게 적용 —
      // 숫자(%)만으로는 나라 간 비교가 한눈에 안 들어와서, 막대 길이로 바로 비교되게 함
      const barEl = document.createElement('div'); barEl.className = 'side-card-bar';
      const barFillEl = document.createElement('div'); barFillEl.className = 'side-card-bar-fill';
      barFillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
      barEl.appendChild(barFillEl);
      // 1위 카드는 목업처럼 금액+비율을 한 줄에 나란히(baseline 정렬) 배치해서 공간을 아낌
      const amtRowEl = document.createElement('div'); amtRowEl.className = 'side-card-amt-row';
      amtRowEl.append(amtEl, rateEl);
      card.append(amtRowEl, barEl);
    } else {
      card.append(amtEl);
    }
    if (typeof pendingDetailLink !== 'undefined' && pendingDetailLink) {
      const detailEl = document.createElement('a');
      detailEl.className = 'side-card-detail-link';
      detailEl.href = pendingDetailLink.href;
      detailEl.textContent = pendingDetailLink.text;
      card.appendChild(detailEl);
      pendingDetailLink = null;
    }
    card.dataset.countryCount = rows.length;
    // 카드를 탭하면 위쪽 지도에서 해당 국가(들) 위치에 핀이 표시되게 함 — 국기 배지도 같이
    // 눌리게 해서 좁은 카드 안에서도 탭 영역이 너무 작지 않게 함
    const mapFlagCodes = rows.map(r => r.profile.flagCode);
    const mapLabel = getGroupSameLabel(rows);
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => highlightCountryOnMap(mapFlagCodes, mapLabel));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); highlightCountryOnMap(mapFlagCodes, mapLabel); }
    });
    grid.appendChild(card);
  });

  // breakdown 상세는 그룹과 무관하게 국가별로 하나씩 그대로 나열 — "왜 같은 금액인지" 궁금하면
  // 접힌 아코디언을 펼쳐서 나라별 세부 내역을 각각 확인할 수 있어야 하므로 여기선 합치지 않음
  implementedRows.forEach(row => {
    const { profile, result } = row;
    const baseLabelText = pickLang(profile.label, profile.labelEn, profile.labelZh, profile.labelVi, profile.labelTh, profile.labelRu, profile.more);
    let stateSuffix = '';
    if (profile.needsState) {
      const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
      stateSuffix = ` (${pickLang(stateInfo.label, stateInfo.labelEn, stateInfo.labelZh, stateInfo.labelEn, stateInfo.labelEn, stateInfo.labelEn, buildStateNameMore(stateCode))})`;
    }
    const groupLabel = document.createElement('p'); groupLabel.className = 'side-group-label';
    groupLabel.append(makeFlagBadge(profile.flagCode), document.createTextNode(' '));
    appendLabelWithNowrapParen(groupLabel, baseLabelText + stateSuffix);
    const bGrid = document.createElement('div'); bGrid.className = 'side-breakdown-grid';
    [[result.label1, result.val1], [result.label2, result.val2]].forEach(([label, val]) => {
      const cell = document.createElement('div'); cell.className = 'side-breakdown-cell';
      const l = document.createElement('p'); l.className = 'side-breakdown-label'; l.textContent = label;
      const v = document.createElement('p'); v.className = 'side-breakdown-val'; v.textContent = val;
      cell.append(l, v);
      bGrid.appendChild(cell);
    });
    breakdownContainer.append(groupLabel, bGrid);
  });

  // 아직 데이터가 준비 안 된 나라들은 정렬 대상이 아니라서 뒤쪽에 그대로 이어붙임
  pendingProfiles.forEach(profile => {
    const shortLabelText = getProfileShortLabel(profile);
    const card = document.createElement('div');
    card.className = 'side-card';
    card.dataset.countryCount = '1';
    const amtEl = document.createElement('p');
    amtEl.className = 'side-card-amt';
    amtEl.style.cssText = 'color:var(--text-muted); font-size:16px;';
    amtEl.textContent = pickLang('준비 중', 'Coming soon', '准备中', 'Sắp có', 'เร็วๆ นี้', 'Скоро', COMING_SOON_MORE);
    const flagP = document.createElement('p'); flagP.className = 'side-card-flag';
    flagP.append(makeFlagBadge(profile.flagCode), document.createTextNode(' ' + shortLabelText));
    card.appendChild(flagP);
    card.appendChild(amtEl);
    grid.appendChild(card);
  });

  // 모바일에서 카드를 한 번에 쭉 나열하면 스크롤이 너무 길어져서, 처음엔 상위 6개(이미
  // 실수령액 순 정렬됨)만 보여주고 나머지는 "더보기" 버튼으로 펼치게 함. 매번 다시 그릴 때마다
  // 접힌 상태로 리셋 — eok/국가가 바뀌면 순위도 달라지므로 이전 펼침 상태를 유지할 이유가 없음
  const SIDE_VISIBLE_COUNT = 6;
  const allCards = Array.from(grid.children);
  const showMoreBtn = document.getElementById('sideShowMoreBtn');
  // 카드 수가 아니라 그 안에 묶인 나라 수 합계로 세어줌 — 카드 하나가 여러 나라를
  // 대표할 수 있어서, 카드 개수로 세면 "더보기"가 실제 남은 나라 수보다 적게 나옴
  const remaining = allCards.slice(SIDE_VISIBLE_COUNT).reduce((sum, c) => sum + (parseInt(c.dataset.countryCount, 10) || 1), 0);
  // 남은 나라가 1개뿐이면 버튼을 눌러야 겨우 1개 더 보는 셈이라 번거로우니 그냥 다 펼쳐서
  // 보여줌 — 나중에 나라가 늘어 남는 수가 2개 이상이 되면 다시 자동으로 "더보기"가 나타남
  const shouldCollapse = remaining > 1;
  allCards.forEach((card, i) => { card.classList.toggle('side-card-hidden-extra', shouldCollapse && i >= SIDE_VISIBLE_COUNT); });
  if (showMoreBtn) {
    if (shouldCollapse) {
      showMoreBtn.style.display = 'block';
      showMoreBtn.dataset.expanded = 'false';
      showMoreBtn.textContent = pickLang(`${remaining}개국 더 보기 ▾`, `Show ${remaining} more ▾`, `再显示${remaining}个国家 ▾`, `Xem thêm ${remaining} nước ▾`, `ดูเพิ่มอีก ${remaining} ประเทศ ▾`, `Показать ещё ${remaining} стран ▾`, buildShowMoreCountriesMore(remaining));
    } else {
      showMoreBtn.style.display = 'none';
    }
  }

  fixSideCardOrphanRow();
  renderLanguageContentLinks();
}

// 카드 그리드가 auto-fit(가변 열 수)라서 마지막 줄에 카드 하나만 혼자 남으면 옆에 큰 여백이
// 생김 — 예전엔 CSS만으로(:last-child:nth-child(odd)) 처리하려 했지만, "더보기"로 접힌
// 카드도 DOM에는 여전히 남아있어서(display:none) :last-child가 항상 숨겨진 맨 마지막 카드를
// 가리키는 바람에 실제로는 한 번도 작동하지 않던 규칙이었음. 화면에 보이는 카드만 기준으로
// 실제 렌더링된 줄바꿈 위치(offsetTop 비교)를 봐야 정확해서 JS로 판단함
function fixSideCardOrphanRow(){
  const grid = document.getElementById('sideByCountryGrid');
  if (!grid) return;
  const visible = Array.from(grid.children).filter(c => !c.classList.contains('side-card-hidden-extra'));
  visible.forEach(c => c.classList.remove('side-card-span-full'));
  if (visible.length < 2) return;
  const last = visible[visible.length - 1];
  const prev = visible[visible.length - 2];
  if (last.offsetTop > prev.offsetTop) {
    last.classList.add('side-card-span-full');
  }
}

function toggleSideShowMore(){
  const grid = document.getElementById('sideByCountryGrid');
  const btn = document.getElementById('sideShowMoreBtn');
  if (!grid || !btn) return;
  const expanded = btn.dataset.expanded === 'true';
  if (!expanded) {
    // 펼치기 전 "N개국 더 보기" 라벨을 저장해뒀다가, 다시 접을 때 그대로 복원함
    btn.dataset.collapsedLabel = btn.textContent;
    grid.querySelectorAll('.side-card-hidden-extra').forEach(card => { card.classList.remove('side-card-hidden-extra'); });
    btn.dataset.expanded = 'true';
    btn.textContent = pickLang('접기 ▴', 'Show less ▴', '收起 ▴', 'Thu gọn ▴', 'ย่อ ▴', 'Свернуть ▴', SHOW_LESS_MORE);
  } else {
    Array.from(grid.children).slice(6).forEach(card => { card.classList.add('side-card-hidden-extra'); });
    btn.dataset.expanded = 'false';
    btn.textContent = btn.dataset.collapsedLabel || btn.textContent;
  }
  fixSideCardOrphanRow();
}
