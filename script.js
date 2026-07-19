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
  return fetch(`i18n/${lang}.json?v=20260719`)
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
  applyJackpotData();
  updateDrawCountdown();
  initJackpotCardAmt();
  refreshJackpotDrawerIfOpen();
  updateJcTapLabel();
  updateHiddenMoneyChannelsForLang();
  renderJackpotHistory();
}

// 최초 로드 시, data-i18n 요소들의 원본 한국어를 저장해둠(다시 한국어로 돌아갈 때 쓰기 위함)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.setAttribute('data-i18n-ko', el.textContent);
  });
});

let EXCHANGE_RATE = 1503.40; // 기본값(fallback). 중앙은행 고시 기반 기준환율(2026-07-13 확인) — 페이지 로드 시 실시간 환율로 자동 갱신을 시도함. 이 기본값은 주기적으로 수동 업데이트 필요
let EXCHANGE_RATE_CNY = 6.77; // 기본값(fallback), USD/CNY (2026-07-17 확인). 중국 거주자 기준 결과에서 위안화 참고 환산용 — KRW와 마찬가지로 실시간 조회 시도, 실패하면 이 기본값 사용
let EXCHANGE_RATE_INR = 87.0; // 기본값(fallback), USD/INR (2026-07-18 확인). 인도 거주자 기준 결과에서 루피 참고 환산용 — KRW와 마찬가지로 실시간 조회 시도, 실패하면 이 기본값 사용
let EXCHANGE_RATE_VND = 26150; // 기본값(fallback), USD/VND (2026-07-18 확인). 베트남 거주자 기준 결과에서 동화 참고 환산용
let EXCHANGE_RATE_IDR = 16650; // 기본값(fallback), USD/IDR (2026-07-18 확인). 인도네시아 거주자 기준 결과에서 루피아 참고 환산용
let EXCHANGE_RATE_PHP = 58.7;  // 기본값(fallback), USD/PHP (2026-07-18 확인). 필리핀 거주자 기준 결과에서 페소 참고 환산용
let EXCHANGE_RATE_THB = 34.2;  // 기본값(fallback), USD/THB (2026-07-18 확인). 태국 거주자 기준 결과에서 바트 참고 환산용
let EXCHANGE_RATE_JPY = 162;    // 기본값(fallback), USD/JPY (2026-07-18 확인)
let EXCHANGE_RATE_RUB = 77.6;   // 기본값(fallback), USD/RUB (2026-07-18 확인) — 변동성이 커서 실시간 조회 실패 시 오차가 클 수 있음
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
    b.title = pickLang('환율 확인 중...', 'Checking exchange rate...', '正在查询汇率...', 'Đang kiểm tra tỷ giá...', 'กำลังตรวจสอบอัตราแลกเปลี่ยน...', 'Проверка курса...');
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
      el.title = pickLang('환율 조회 실패 · 탭해서 재시도', 'Couldn\u2019t fetch live rate · tap to retry', '汇率获取失败 · 点击重试', 'Không lấy được tỷ giá · nhấn để thử lại', 'ดึงอัตราแลกเปลี่ยนไม่สำเร็จ · แตะเพื่อลองใหม่', 'Не удалось получить курс · нажмите, чтобы повторить');
    } else if (exchangeRateIsLive) {
      el.classList.add('is-live');
      el.title = pickLang('실시간 환율 적용 중 · 탭하면 새로고침', 'Live exchange rate applied · tap to refresh', '正在使用实时汇率 · 点击刷新', 'Đang áp dụng tỷ giá trực tiếp · nhấn để làm mới', 'ใช้อัตราแลกเปลี่ยนแบบเรียลไทม์ · แตะเพื่อรีเฟรช', 'Применён актуальный курс · нажмите для обновления');
    } else {
      el.title = pickLang('기본값 사용 중 · 탭하면 실시간 환율로 갱신', 'Using default rate · tap to fetch live rate', '正在使用默认汇率 · 点击获取实时汇率', 'Đang dùng tỷ giá mặc định · nhấn để lấy tỷ giá trực tiếp', 'ใช้อัตราแลกเปลี่ยนเริ่มต้น · แตะเพื่อดึงอัตราแบบเรียลไทม์', 'Используется курс по умолчанию · нажмите, чтобы получить актуальный курс');
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

// ⚠️ [향후 다국가·다통화 확장 시 필독] 이 사이트의 모든 금액 표시(세금 비교표, 잭팟 계산기,
// 역산 계산기 등)가 이 함수 하나를 거치는데, 지금은 "억원"이 고정 접미사로 박혀 있음.
// 베트남 동(₫)·태국 바트 등 다른 통화로 보여주려면 국가별 통화 포맷터로 새로 짜야 하고,
// 코드 곳곳에 "억원"이 리터럴 문자열로도 흩어져 있어(2026년 7월 기준 약 25곳) 같이 찾아 바꿔야 함.
function formatWon(n){
  if (typeof currentLang !== 'undefined' && currentLang === 'en') return formatWonEn(n);
  // 중국어·일본어는 억/亿/億=10^8 단위 체계가 한국과 같아서, 영어처럼 별도 million/billion
  // 변환 없이 접미사만 그 언어 한자로 바꿔주면 됨(중국어·일본어 화자는 이 단위를 그대로 이해함)
  if (typeof currentLang !== 'undefined' && currentLang === 'zh') return Math.round(n).toLocaleString('zh-CN') + '亿韩元';
  if (typeof currentLang !== 'undefined' && currentLang === 'ja') return Math.round(n).toLocaleString('ja-JP') + '億ウォン';
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
    // 베트남 개인소득세법 시행규칙 Circular 111/2013/TT-BTC 제15조: 복권 등 상금(trúng thưởng) 소득은
    // 1,000만동(VND, 약 40만원 수준) 초과분에 대해 10% 단일세율 원천징수. 잭팟 규모는 이 기준을 항상 훨씬 넘음.
    prize_income_rate: 0.10
    // 베트남-미국 조세조약(DTA)에 따라 FTC로 미국 원천징수분을 베트남 세액 한도 내에서 상계 가능.
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
    // 면제)가 있지만, 해외에서 받은 복권 당첨금을 태국 거주자가 어떻게 신고해야 하는지는 2024년 해외소득
    // 송금 과세 개편(부분 시행) 이후로도 명확한 공식 가이드라인을 찾지 못함. 아래 수치는 태국 개인소득세
    // 최고세율(35%)을 그대로 가져온 "추정치"이며, 실제 세율과 다를 수 있음 — UI에도 이 불확실성을 별도 표시함.
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
    // 스리랑카 국세법(Inland Revenue Act No.24 of 2017) — 복권·베팅·도박 당첨금은 "이익 및 수익"에
    // 포함돼 일반 누진세율로 과세(자국 지급기관 대상 10% 원천징수(제157·158조)는 해외 지급에는
    // 적용 안 되고 그냥 누진세율로 직접 신고). 2025/26년 개인소득세 최고구간은 36%(과세표준
    // 430만 루피 초과) — 잭팟 규모는 항상 이 구간을 초과.
    top_bracket_rate: 0.36
  },
  uz_resident: {
    // 우즈베키스탄 세법(Tax Code of the Republic of Uzbekistan) 개인소득세 — 상금·복권 당첨금을
    // 포함한 모든 개인소득에 단일 12% 세율 적용(2023년부터 시행).
    flat_rate: 0.12
  },
  kz_resident: {
    // 카자흐스탄 세법("국가예산에 대한 조세 및 기타 의무납부에 관한 법전") — "당첨금"(выигрыш)은
    // 일반 근로소득 구간과 별도로 거주자 기준 10% 단일세율로 원천징수(비거주자는 20%). 국내 복권
    // 소액(월 계산지수 6배, 약 6만원 이하) 면제는 해외 당첨금에는 적용 안 됨.
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
    // (비신고자) 세율을 두지만, 이는 "파키스탄 내 지급기관이 원천징수"하는 걸 전제로 한 조항이라
    // 미국에서 직접 받는 당첨금에 그대로 적용되는지 불명확함. 이 계산기는 더 안전한 기본값으로
    // 일반 소득세 최고구간(35%)을 사용 — UI에도 이 불확실성을 별도 표시함.
    unverified_approx_rate: 0.35
  },
  kh_resident: {
    // ⚠️ 캄보디아 세법(Law on Taxation)에는 급여·사업소득 외 개인의 복권·상금 소득을 과세하는
    // 일반 조항을 찾지 못함(2025년 신설 자본이득세도 부동산·주식 등 특정 자산에만 적용되고 복권은
    // 대상 아님). 명확한 근거가 없어 캄보디아 추가세를 0으로 두고 UI에 이 불확실성을 별도 표시함.
    unverified_rate: 0
  },
  mn_resident: {
    // ⚠️ 몽골 개인소득세법(2019)은 베팅·도박성 당첨금에 40% 세율을 두지만, 2025년 몽골 내 베팅·도박업
    // 자체가 전면 금지되면서 이 조항이 정식 해외 복권 당첨금에도 그대로 적용되는지 불명확함.
    // 이 계산기는 그 40% 조항을 그대로 가져와 추정치로 사용 — UI에도 이 불확실성을 별도 표시함.
    unverified_approx_rate: 0.40
  },
  la_resident: {
    // ⚠️ 라오스 신설 소득세법(No.67/NA, 2026년 7월 시행) — 복권 당첨소득(1천만 킵 초과분)에 5%
    // 단일세율을 처음으로 도입. 시행된 지 얼마 안 돼 실제 적용 사례가 없고, 라오스는 미국과
    // 조세조약이 없어 FTC(세액공제)도 적용 안 됨(미국 원천징수세에 이 5%가 그대로 추가됨).
    // UI에도 이 불확실성을 별도 표시함.
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
  ME:  { label: '메인', labelEn: 'Maine', labelZh: '缅因', rate: 0.0715 },
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

function calcTakeHome(amount, country, stateCode){
  if (country === 'us') {
    const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
    const afterUS = amount * (1 - TAX_MODEL.us_resident.federal);
    const final = amount * (1 - TAX_MODEL.us_resident.federal - stateInfo.rate);
    return {
      afterUS, final,
      label1: pickLang('미국 연방세', 'US Federal Tax', '美国联邦税', 'Thuế liên bang Mỹ', 'ภาษีกลางสหรัฐฯ', 'Федеральный налог США'), val1: '-' + (TAX_MODEL.us_resident.federal * 100) + '%',
      label2: pickLang(`${stateInfo.label} 주세`, `${stateInfo.labelEn} State Tax`, `${stateInfo.labelZh}州税`, `Thuế bang ${stateInfo.labelEn}`, `ภาษีมลรัฐ${stateInfo.labelEn}`, `Налог штата ${stateInfo.labelEn}`),
      val2: '-' + (stateInfo.rate * 100).toFixed(stateInfo.rate * 100 % 1 === 0 ? 0 : 2) + '%',
      basisSuffix: pickLang('미국 거주자', 'US resident', '美国居民', 'Cư dân Mỹ', 'ผู้พำนักในสหรัฐฯ', 'Резидент США')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('중국 추가 납부 (FTC 적용)', 'China additional tax (FTC applied)', '中国追加缴税（已抵免FTC）', 'Thuế bổ sung tại Trung Quốc (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของจีน (ใช้ FTC แล้ว)', 'Дополнительный налог в Китае (с учётом FTC)'),
      val2: chinaAdditionalTaxWon > 0 ? '-' + chinaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('중국 거주자', 'China resident', '中国居民', 'Cư dân Trung Quốc', 'ผู้พำนักในจีน', 'Резидент Китая')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('인도 추가 납부 (FTC 적용)', 'India additional tax (FTC applied)', '印度追加缴税（已抵免FTC）', 'Thuế bổ sung tại Ấn Độ (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของอินเดีย (ใช้ FTC แล้ว)', 'Дополнительный налог в Индии (с учётом FTC)'),
      val2: indiaAdditionalTaxWon > 0 ? '-' + indiaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('인도 거주자', 'India resident', '印度居民', 'Cư dân Ấn Độ', 'ผู้พำนักในอินเดีย', 'Резидент Индии')
    };
  } else if (country === 'vn') {
    // 베트남 개인소득세법 시행규칙 Circular 111/2013/TT-BTC 제15조: 복권 등 상금(trúng thưởng) 소득 10% 단일세율.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const vnCalculatedTaxWon = wonAmount * TAX_MODEL.vn_resident.prize_income_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, vnCalculatedTaxWon); // FTC 공제액(DTA 기준, 한도 내 상계)
    const vnAdditionalTaxWon = Math.max(vnCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (vnAdditionalTaxWon / 100000000);
    const vnEffectivePct = wonAmount > 0 ? (vnAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('베트남 추가 납부 (FTC 적용)', 'Vietnam additional tax (FTC applied)', '越南追加缴税（已抵免FTC）', 'Thuế bổ sung tại Việt Nam (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของเวียดนาม (ใช้ FTC แล้ว)', 'Дополнительный налог во Вьетнаме (с учётом FTC)'),
      val2: vnAdditionalTaxWon > 0 ? '-' + vnEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('베트남 거주자', 'Vietnam resident', '越南居民', 'Cư dân Việt Nam', 'ผู้พำนักในเวียดนาม', 'Резидент Вьетнама')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('인도네시아 추가 납부 (FTC 적용)', 'Indonesia additional tax (FTC applied)', '印尼追加缴税（已抵免FTC）', 'Thuế bổ sung tại Indonesia (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของอินโดนีเซีย (ใช้ FTC แล้ว)', 'Дополнительный налог в Индонезии (с учётом FTC)'),
      val2: idAdditionalTaxWon > 0 ? '-' + idEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('인도네시아 거주자', 'Indonesia resident', '印尼居民', 'Cư dân Indonesia', 'ผู้พำนักในอินโดนีเซีย', 'Резидент Индонезии')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('필리핀 추가 납부 (FTC 적용, 근사치)', 'Philippines additional tax (FTC applied, approximate)', '菲律宾追加缴税（已抵免FTC，估算值）', 'Thuế bổ sung tại Philippines (đã áp dụng FTC, ước tính)', 'ภาษีเพิ่มเติมของฟิลิปปินส์ (ใช้ FTC แล้ว, ค่าประมาณ)', 'Дополнительный налог на Филиппинах (с учётом FTC, приблизительно)'),
      val2: phAdditionalTaxWon > 0 ? '-' + phEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('필리핀 거주자', 'Philippines resident', '菲律宾居民', 'Cư dân Philippines', 'ผู้พำนักในฟิลิปปินส์', 'Резидент Филиппин')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('태국 추가 납부 (FTC 적용, 추정치 ⚠️)', 'Thailand additional tax (FTC applied, unverified estimate ⚠️)', '泰国追加缴税（已抵免FTC，估算值⚠️）', 'Thuế bổ sung tại Thái Lan (đã áp dụng FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของไทย (ใช้ FTC แล้ว, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Таиланде (с учётом FTC, неподтверждённая оценка ⚠️)'),
      val2: thAdditionalTaxWon > 0 ? '-' + thEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('태국 거주자 (추정치 ⚠️)', 'Thailand resident (estimate ⚠️)', '泰国居民（估算值⚠️）', 'Cư dân Thái Lan (ước tính ⚠️)', 'ผู้พำนักในไทย (ค่าประมาณ ⚠️)', 'Резидент Таиланда (оценка ⚠️)')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('일본 추가 납부 (FTC 적용)', 'Japan additional tax (FTC applied)', '日本追加缴税（已抵免FTC）', 'Thuế bổ sung tại Nhật Bản (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของญี่ปุ่น (ใช้ FTC แล้ว)', 'Дополнительный налог в Японии (с учётом FTC)'),
      val2: jpAdditionalTaxWon > 0 ? '-' + jpEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('일본 거주자', 'Japan resident', '日本居民', 'Cư dân Nhật Bản', 'ผู้พำนักในญี่ปุ่น', 'Резидент Японии')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('러시아 추가 납부 (FTC 적용, 조약 정지로 불확실 ⚠️)', 'Russia additional tax (FTC applied, uncertain due to suspended treaty ⚠️)', '俄罗斯追加缴税（已抵免FTC，条约暂停致不确定⚠️）', 'Thuế bổ sung tại Nga (đã áp dụng FTC, không chắc do hiệp định bị đình chỉ ⚠️)', 'ภาษีเพิ่มเติมของรัสเซีย (ใช้ FTC แล้ว, ไม่แน่นอนจากสนธิสัญญาที่ระงับ ⚠️)', 'Дополнительный налог в России (с учётом FTC, неопределённость из-за приостановки договора ⚠️)'),
      val2: ruAdditionalTaxWon > 0 ? '-' + ruEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('러시아 거주자 (조약 정지 ⚠️)', 'Russia resident (treaty suspended ⚠️)', '俄罗斯居民（条约暂停⚠️）', 'Cư dân Nga (hiệp định bị đình chỉ ⚠️)', 'ผู้พำนักในรัสเซีย (สนธิสัญญาระงับ ⚠️)', 'Резидент России (договор приостановлен ⚠️)')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('네팔 추가 납부 (FTC 적용)', 'Nepal additional tax (FTC applied)', '尼泊尔追加缴税（已抵免FTC）', 'Thuế bổ sung tại Nepal (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของเนปาล (ใช้ FTC แล้ว)', 'Дополнительный налог в Непале (с учётом FTC)'),
      val2: npAdditionalTaxWon > 0 ? '-' + npEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('네팔 거주자', 'Nepal resident', '尼泊尔居民', 'Cư dân Nepal', 'ผู้พำนักในเนปาล', 'Резидент Непала')
    };
  } else if (country === 'lk') {
    // 스리랑카: 해외 복권 당첨금은 일반 누진세율(최고 36%)로 직접 신고.
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('스리랑카 추가 납부 (FTC 적용, 근사치)', 'Sri Lanka additional tax (FTC applied, approximate)', '斯里兰卡追加缴税（已抵免FTC，估算值）', 'Thuế bổ sung tại Sri Lanka (đã áp dụng FTC, ước tính)', 'ภาษีเพิ่มเติมของศรีลังกา (ใช้ FTC แล้ว, ค่าประมาณ)', 'Дополнительный налог в Шри-Ланке (с учётом FTC, приблизительно)'),
      val2: lkAdditionalTaxWon > 0 ? '-' + lkEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('스리랑카 거주자', 'Sri Lanka resident', '斯里兰卡居民', 'Cư dân Sri Lanka', 'ผู้พำนักในศรีลังกา', 'Резидент Шри-Ланки')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('우즈베키스탄 추가 납부 (FTC 적용)', 'Uzbekistan additional tax (FTC applied)', '乌兹别克斯坦追加缴税（已抵免FTC）', 'Thuế bổ sung tại Uzbekistan (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของอุซเบกิสถาน (ใช้ FTC แล้ว)', 'Дополнительный налог в Узбекистане (с учётом FTC)'),
      val2: uzAdditionalTaxWon > 0 ? '-' + uzEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('우즈베키스탄 거주자', 'Uzbekistan resident', '乌兹别克斯坦居民', 'Cư dân Uzbekistan', 'ผู้พำนักในอุซเบกิสถาน', 'Резидент Узбекистана')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('카자흐스탄 추가 납부 (FTC 적용)', 'Kazakhstan additional tax (FTC applied)', '哈萨克斯坦追加缴税（已抵免FTC）', 'Thuế bổ sung tại Kazakhstan (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของคาซัคสถาน (ใช้ FTC แล้ว)', 'Дополнительный налог в Казахстане (с учётом FTC)'),
      val2: kzAdditionalTaxWon > 0 ? '-' + kzEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('카자흐스탄 거주자', 'Kazakhstan resident', '哈萨克斯坦居民', 'Cư dân Kazakhstan', 'ผู้พำนักในคาซัคสถาน', 'Резидент Казахстана')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('키르기스스탄 추가 납부 (FTC 적용)', 'Kyrgyzstan additional tax (FTC applied)', '吉尔吉斯斯坦追加缴税（已抵免FTC）', 'Thuế bổ sung tại Kyrgyzstan (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของคีร์กีซสถาน (ใช้ FTC แล้ว)', 'Дополнительный налог в Кыргызстане (с учётом FTC)'),
      val2: kgAdditionalTaxWon > 0 ? '-' + kgEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('키르기스스탄 거주자', 'Kyrgyzstan resident', '吉尔吉斯斯坦居民', 'Cư dân Kyrgyzstan', 'ผู้พำนักในคีร์กีซสถาน', 'Резидент Кыргызстана')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('미얀마 추가 납부 (FTC 적용, 근사치)', 'Myanmar additional tax (FTC applied, approximate)', '缅甸追加缴税（已抵免FTC，估算值）', 'Thuế bổ sung tại Myanmar (đã áp dụng FTC, ước tính)', 'ภาษีเพิ่มเติมของเมียนมา (ใช้ FTC แล้ว, ค่าประมาณ)', 'Дополнительный налог в Мьянме (с учётом FTC, приблизительно)'),
      val2: mmAdditionalTaxWon > 0 ? '-' + mmEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('미얀마 거주자', 'Myanmar resident', '缅甸居民', 'Cư dân Myanmar', 'ผู้พำนักในเมียนมา', 'Резидент Мьянмы')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('방글라데시 추가 납부 (FTC 적용)', 'Bangladesh additional tax (FTC applied)', '孟加拉国追加缴税（已抵免FTC）', 'Thuế bổ sung tại Bangladesh (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของบังกลาเทศ (ใช้ FTC แล้ว)', 'Дополнительный налог в Бангладеш (с учётом FTC)'),
      val2: bdAdditionalTaxWon > 0 ? '-' + bdEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('방글라데시 거주자', 'Bangladesh resident', '孟加拉国居民', 'Cư dân Bangladesh', 'ผู้พำนักในบังกลาเทศ', 'Резидент Бангладеш')
    };
  } else if (country === 'pk') {
    // ⚠️ 파키스탄: 복권 원천징수 규정(20~40%)이 자국 지급기관 전제라 적용 여부 불명확 — 일반 소득세
    // 최고구간(35%)으로 추정.
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const pkCalculatedTaxWon = wonAmount * TAX_MODEL.pk_resident.unverified_approx_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, pkCalculatedTaxWon);
    const pkAdditionalTaxWon = Math.max(pkCalculatedTaxWon - ftcCreditWon, 0);
    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (pkAdditionalTaxWon / 100000000);
    const pkEffectivePct = wonAmount > 0 ? (pkAdditionalTaxWon / wonAmount * 100) : 0;
    return {
      afterUS, final,
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('파키스탄 추가 납부 (FTC 적용, 추정치 ⚠️)', 'Pakistan additional tax (FTC applied, unverified estimate ⚠️)', '巴基斯坦追加缴税（已抵免FTC，估算值⚠️）', 'Thuế bổ sung tại Pakistan (đã áp dụng FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของปากีสถาน (ใช้ FTC แล้ว, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Пакистане (с учётом FTC, неподтверждённая оценка ⚠️)'),
      val2: pkAdditionalTaxWon > 0 ? '-' + pkEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('파키스탄 거주자 (추정치 ⚠️)', 'Pakistan resident (estimate ⚠️)', '巴基斯坦居民（估算值⚠️）', 'Cư dân Pakistan (ước tính ⚠️)', 'ผู้พำนักในปากีสถาน (ค่าประมาณ ⚠️)', 'Резидент Пакистана (оценка ⚠️)')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('캄보디아 추가 납부 (근거 불명확 ⚠️)', 'Cambodia additional tax (no clear basis found ⚠️)', '柬埔寨追加缴税（依据不明⚠️）', 'Thuế bổ sung tại Campuchia (chưa rõ căn cứ ⚠️)', 'ภาษีเพิ่มเติมของกัมพูชา (ไม่พบหลักเกณฑ์ชัดเจน ⚠️)', 'Дополнительный налог в Камбодже (основание неясно ⚠️)'),
      val2: khAdditionalTaxWon > 0 ? '-' + khEffectivePct.toFixed(1) + '%' : pickLang('0원 (근거 불명확 ⚠️)', '₩0 (no clear basis found ⚠️)', '0元（依据不明⚠️）', '0 KRW (chưa rõ căn cứ ⚠️)', '0 วอน (ไม่พบหลักเกณฑ์ชัดเจน ⚠️)', '0 вон (основание неясно ⚠️)'),
      basisSuffix: pickLang('캄보디아 거주자 (추정치 ⚠️)', 'Cambodia resident (estimate ⚠️)', '柬埔寨居民（估算值⚠️）', 'Cư dân Campuchia (ước tính ⚠️)', 'ผู้พำนักในกัมพูชา (ค่าประมาณ ⚠️)', 'Резидент Камбоджи (оценка ⚠️)')
    };
  } else if (country === 'mn') {
    // ⚠️ 몽골: 베팅·도박성 당첨금 40% 조항은 있으나 2025년 국내 베팅업 전면 금지 후 적용 여부 불명확 — 그대로 추정 적용.
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('몽골 추가 납부 (FTC 적용, 추정치 ⚠️)', 'Mongolia additional tax (FTC applied, unverified estimate ⚠️)', '蒙古追加缴税（已抵免FTC，估算值⚠️）', 'Thuế bổ sung tại Mông Cổ (đã áp dụng FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของมองโกเลีย (ใช้ FTC แล้ว, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Монголии (с учётом FTC, неподтверждённая оценка ⚠️)'),
      val2: mnAdditionalTaxWon > 0 ? '-' + mnEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('몽골 거주자 (추정치 ⚠️)', 'Mongolia resident (estimate ⚠️)', '蒙古居民（估算值⚠️）', 'Cư dân Mông Cổ (ước tính ⚠️)', 'ผู้พำนักในมองโกเลีย (ค่าประมาณ ⚠️)', 'Резидент Монголии (оценка ⚠️)')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('라오스 추가 납부 (FTC 없음, 추정치 ⚠️)', 'Laos additional tax (no FTC, unverified estimate ⚠️)', '老挝追加缴税（无FTC抵免，估算值⚠️）', 'Thuế bổ sung tại Lào (không có FTC, ước tính chưa xác minh ⚠️)', 'ภาษีเพิ่มเติมของลาว (ไม่มี FTC, ค่าประมาณที่ยังไม่ยืนยัน ⚠️)', 'Дополнительный налог в Лаосе (без FTC, неподтверждённая оценка ⚠️)'),
      val2: laAdditionalTaxWon > 0 ? '-' + laEffectivePct.toFixed(1) + '%' : pickLang('0원', '₩0', '0元', '0 KRW', '0 วอน', '0 вон'),
      basisSuffix: pickLang('라오스 거주자 (추정치 ⚠️)', 'Laos resident (estimate ⚠️)', '老挝居民（估算值⚠️）', 'Cư dân Lào (ước tính ⚠️)', 'ผู้พำนักในลาว (ค่าประมาณ ⚠️)', 'Резидент Лаоса (оценка ⚠️)')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）', 'Thuế liên bang Mỹ (không cư trú)', 'ภาษีกลางสหรัฐฯ (ผู้ไม่มีถิ่นพำนัก)', 'Федеральный налог США (нерезидент)'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('한국 추가 납부 (FTC 적용)', 'Korea additional tax (FTC applied)', '韩国追加缴税（已抵免FTC）', 'Thuế bổ sung tại Hàn Quốc (đã áp dụng FTC)', 'ภาษีเพิ่มเติมของเกาหลี (ใช้ FTC แล้ว)', 'Дополнительный налог в Корее (с учётом FTC)'),
      val2: koreaAdditionalNationalTaxWon > 0 ? '-' + koreaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）', '0 KRW (đã bù trừ bằng tín dụng thuế)', '0 วอน (หักล้างด้วยเครดิตภาษีแล้ว)', '0 вон (зачтено налоговым кредитом)'),
      basisSuffix: pickLang('한국 거주자', 'Korea resident', '韩国居民', 'Cư dân Hàn Quốc', 'ผู้พำนักในเกาหลี', 'Резидент Кореи')
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

function goToFaqItem(query){
  go('faq');
  const searchBox = document.getElementById('faqSearch');
  searchBox.value = query;
  filterFaq();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  } else if (view === 'compare') {
    syncCompareFromShared();
  } else if (view === 'faq') {
    // 국가 토글을 한 번도 안 건드린 상태로 FAQ 탭을 바로 누르면 filterFaq()가 아직 한 번도
    // 실행된 적이 없어서, 세금 기준(kr/us/cn)과 무관한 질문까지 전부 보이던 버그가 있었음
    filterFaq();
  }

  document.querySelector('.page').scrollIntoView({behavior:'smooth', block:'start'});
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
      '\u0415\u0441\u043B\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u0438\u0437 \u044D\u0442\u043E\u0433\u043E \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u043A \u0432\u0430\u043C, \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u0438\u0436\u0435, \u0447\u0442\u043E\u0431\u044B \u0443\u0437\u043D\u0430\u0442\u044C \u0431\u043E\u043B\u044C\u0448\u0435 \uD83D\uDC47'
    );
    resultEl.className = 'refund-wizard-result';
  } else if (checkedCount === 1) {
    resultEl.textContent = pickLang(
      '\u2705 \uD574\uB2F9\uD558\uC2DC\uB294 \uAC8C \uC788\uB124\uC694 \u2014 \uBABB \uBC1B\uC740 \uB3C8\uC774 \uC788\uC744 \uAC00\uB2A5\uC131\uC774 \uC788\uC5B4\uC694. \uC544\uB798\uC5D0\uC11C \uD68C\uC6D0\uB2D8\uD55C\uD14C \uB9DE\uB294 \uACF3\uC744 \uCD94\uCC9C\uD574\uB4DC\uB838\uC5B4\uC694',
      '\u2705 You checked one \u2014 there may be money you haven\u2019t claimed. We\u2019ve highlighted the right place for you below',
      '\u2705 \u6709\u4E00\u9879\u7B26\u5408\u2014\u2014\u53EF\u80FD\u6709\u60A8\u8FD8\u6CA1\u9886\u53D6\u7684\u94B1\u3002\u6211\u4EEC\u5DF2\u7ECF\u5728\u4E0B\u65B9\u4E3A\u60A8\u6807\u51FA\u4E86\u5BF9\u5E94\u7684\u67E5\u8BE2\u6E20\u9053',
      '\u2705 B\u1EA1n c\u00F3 m\u1ED9t m\u1EE5c \u0111\u00FAng \u2014 c\u00F3 th\u1EC3 b\u1EA1n c\u00F3 kho\u1EA3n ti\u1EC1n ch\u01B0a nh\u1EADn. Ch\u00FAng t\u00F4i \u0111\u00E3 \u0111\u00E1nh d\u1EA5u n\u01A1i ph\u00F9 h\u1EE3p cho b\u1EA1n b\u00EAn d\u01B0\u1EDBi',
      '\u2705 \u0E04\u0E38\u0E13\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E02\u0E49\u0E2D \u2014 \u0E2D\u0E32\u0E08\u0E21\u0E35\u0E40\u0E07\u0E34\u0E19\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A \u0E40\u0E23\u0E32\u0E44\u0E2E\u0E44\u0E25\u0E15\u0E4C\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E04\u0E38\u0E13\u0E44\u0E27\u0E49\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E41\u0E25\u0E49\u0E27',
      '\u2705 \u0423 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u043E\u0434\u043D\u043E \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u2014 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0443 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u043D\u0435\u0432\u043E\u0441\u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0434\u0435\u043D\u044C\u0433\u0438. \u041C\u044B \u0432\u044B\u0434\u0435\u043B\u0438\u043B\u0438 \u0434\u043B\u044F \u0432\u0430\u0441 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0435 \u043C\u0435\u0441\u0442\u043E \u043D\u0438\u0436\u0435'
    );
    resultEl.className = 'refund-wizard-result tag-hit';
  } else {
    resultEl.textContent = pickLang(
      `\u2705 ${checkedCount}\uAC1C\uB098 \uD574\uB2F9\uB418\uC2DC\uB124\uC694 \u2014 \uC2E4\uC81C\uB85C \uBABB \uBC1B\uC740 \uB3C8\uC774 \uC788\uC744 \uAC00\uB2A5\uC131\uC774 \uAF64 \uB192\uC544\uC694. \uC544\uB798\uC5D0\uC11C \uD68C\uC6D0\uB2D8\uD55C\uD14C \uB9DE\uB294 \uACF3\uC744 \uCD94\uCC9C\uD574\uB4DC\uB838\uC5B4\uC694`,
      `\u2705 You checked ${checkedCount} \u2014 there\u2019s a good chance you have unclaimed money. We\u2019ve highlighted the right places for you below`,
      `\u2705 \u6709${checkedCount}\u9879\u7B26\u5408\u2014\u2014\u5F88\u6709\u53EF\u80FD\u6709\u60A8\u8FD8\u6CA1\u9886\u53D6\u7684\u94B1\u3002\u6211\u4EEC\u5DF2\u7ECF\u5728\u4E0B\u65B9\u4E3A\u60A8\u6807\u51FA\u4E86\u5BF9\u5E94\u7684\u67E5\u8BE2\u6E20\u9053`,
      `\u2705 B\u1EA1n c\u00F3 ${checkedCount} m\u1EE5c \u0111\u00FAng \u2014 r\u1EA5t c\u00F3 th\u1EC3 b\u1EA1n c\u00F3 kho\u1EA3n ti\u1EC1n ch\u01B0a nh\u1EADn. Ch\u00FAng t\u00F4i \u0111\u00E3 \u0111\u00E1nh d\u1EA5u nh\u1EEFng n\u01A1i ph\u00F9 h\u1EE3p cho b\u1EA1n b\u00EAn d\u01B0\u1EDBi`,
      `\u2705 \u0E04\u0E38\u0E13\u0E21\u0E35 ${checkedCount} \u0E02\u0E49\u0E2D\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07 \u2014 \u0E21\u0E35\u0E42\u0E2D\u0E01\u0E32\u0E2A\u0E2A\u0E39\u0E07\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E21\u0E35\u0E40\u0E07\u0E34\u0E19\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A \u0E40\u0E23\u0E32\u0E44\u0E2E\u0E44\u0E25\u0E15\u0E4C\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E01\u0E31\u0E1A\u0E04\u0E38\u0E13\u0E44\u0E27\u0E49\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E41\u0E25\u0E49\u0E27`,
      `\u2705 \u0423 \u0432\u0430\u0441 ${checkedCount} \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u2014 \u0432\u043F\u043E\u043B\u043D\u0435 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0443 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u043D\u0435\u0432\u043E\u0441\u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0434\u0435\u043D\u044C\u0433\u0438. \u041C\u044B \u0432\u044B\u0434\u0435\u043B\u0438\u043B\u0438 \u0434\u043B\u044F \u0432\u0430\u0441 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0435 \u043C\u0435\u0441\u0442\u0430 \u043D\u0438\u0436\u0435`
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
      '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0448\u0442\u0430\u0442, \u0438 \u043C\u044B \u0441\u0440\u0430\u0437\u0443 \u0441\u043A\u0430\u0436\u0435\u043C, \u0432\u0435\u0440\u043E\u044F\u0442\u0435\u043D \u043B\u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0442'
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
  const stateName = pickLang(STATE_DISPLAY_NAMES[stateCode], STATE_DISPLAY_NAMES_EN[stateCode], STATE_DISPLAY_NAMES_ZH[stateCode], STATE_DISPLAY_NAMES_EN[stateCode], STATE_DISPLAY_NAMES_TH[stateCode], STATE_DISPLAY_NAMES_RU[stateCode]);

  let msg, cls;
  if (NO_TAX_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u2715 \uC774 \uC8FC(${stateName})\uB294 \uC8FC \uC18C\uB4DD\uC138 \uC790\uCCB4\uAC00 \uC5C6\uB294 \uBB34\uACFC\uC138 \uC8FC\uC608\uC694. \uC560\uCD08\uC5D0 \uC6D0\uCC9C\uC9D5\uC218\uB41C \uAC8C \uC5C6\uC5B4\uC11C \uB3CC\uB824\uBC1B\uC744 \uAC83\uB3C4 \uC5C6\uC5B4\uC694.`,
      `\u2715 This state (${stateName}) has no state income tax at all. Nothing was withheld in the first place, so there\u2019s nothing to get back.`,
      `\u2715 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u6839\u672C\u6CA1\u6709\u5DDE\u6240\u5F97\u7A0E\u3002\u672C\u6765\u5C31\u6CA1\u6709\u9884\u6263\u8FC7\u7A0E\u6B3E\uFF0C\u6240\u4EE5\u6CA1\u6709\u53EF\u9000\u7684\u90E8\u5206\u3002`,
      `\u2715 Bang n\u00E0y (${stateName}) ho\u00E0n to\u00E0n kh\u00F4ng c\u00F3 thu\u1EBF thu nh\u1EADp bang. V\u00EC kh\u00F4ng b\u1ECB kh\u1EA5u tr\u1EEB g\u00EC ngay t\u1EEB \u0111\u1EA7u n\u00EAn kh\u00F4ng c\u00F3 g\u00EC \u0111\u1EC3 l\u1EA5y l\u1EA1i.`,
      `\u2715 \u0E21\u0E25\u0E23\u0E31\u0E10\u0E19\u0E35\u0E49 (${stateName}) \u0E44\u0E21\u0E48\u0E21\u0E35\u0E20\u0E32\u0E29\u0E35\u0E40\u0E07\u0E34\u0E19\u0E44\u0E14\u0E49\u0E21\u0E25\u0E23\u0E31\u0E10\u0E40\u0E25\u0E22 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E41\u0E23\u0E01 \u0E08\u0E36\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E02\u0E2D\u0E04\u0E37\u0E19`,
      `\u2715 \u0412 \u044D\u0442\u043E\u043C \u0448\u0442\u0430\u0442\u0435 (${stateName}) \u0432\u043E\u043E\u0431\u0449\u0435 \u043D\u0435\u0442 \u043F\u043E\u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u043D\u0430\u043B\u043E\u0433\u0430 \u0448\u0442\u0430\u0442\u0430. \u0418\u0437\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u043B\u043E\u0441\u044C, \u0442\u0430\u043A \u0447\u0442\u043E \u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E.`
    );
    cls = 'tag-none';
  } else if (EXEMPT_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u2715 \uC774 \uC8FC(${stateName})\uB294 \uC8FC \uC18C\uB4DD\uC138\uB294 \uC788\uC9C0\uB9CC \uBCF5\uAD8C \uB2F9\uCCA8\uAE08\uC740 \uBCC4\uB3C4\uB85C \uBA74\uC81C\uD574\uC918\uC694. \uC774\uAC83\uB3C4 \uB3CC\uB824\uBC1B\uC744 \uAC8C \uC5C6\uB294 \uACBD\uC6B0\uC608\uC694.`,
      `\u2715 This state (${stateName}) has state income tax, but exempts lottery winnings specifically. This is also a case where there\u2019s nothing to get back.`,
      `\u2715 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u6709\u5DDE\u6240\u5F97\u7A0E\uFF0C\u4F46\u5F69\u7968\u4E2D\u5956\u91D1\u5355\u72EC\u514D\u7A0E\u3002\u8FD9\u4E5F\u662F\u6CA1\u6709\u53EF\u9000\u90E8\u5206\u7684\u60C5\u51B5\u3002`,
      `\u2715 Bang n\u00E0y (${stateName}) c\u00F3 thu\u1EBF thu nh\u1EADp bang, nh\u01B0ng mi\u1EC5n ri\u00EAng cho ti\u1EC1n th\u1EAFng x\u1ED5 s\u1ED1. \u0110\u00E2y c\u0169ng l\u00E0 tr\u01B0\u1EDDng h\u1EE3p kh\u00F4ng c\u00F3 g\u00EC \u0111\u1EC3 l\u1EA5y l\u1EA1i.`,
      `\u2715 \u0E21\u0E25\u0E23\u0E31\u0E10\u0E19\u0E35\u0E49 (${stateName}) \u0E21\u0E35\u0E20\u0E32\u0E29\u0E35\u0E40\u0E07\u0E34\u0E19\u0E44\u0E14\u0E49\u0E21\u0E25\u0E23\u0E31\u0E10 \u0E41\u0E15\u0E48\u0E22\u0E01\u0E40\u0E27\u0E49\u0E19\u0E40\u0E07\u0E34\u0E19\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25\u0E25\u0E2D\u0E15\u0E40\u0E15\u0E2D\u0E23\u0E35\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E32\u0E23\u0E40\u0E09\u0E1E\u0E32\u0E30 \u0E19\u0E35\u0E48\u0E01\u0E47\u0E40\u0E1B\u0E47\u0E19\u0E01\u0E23\u0E13\u0E35\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E2B\u0E49\u0E02\u0E2D\u0E04\u0E37\u0E19\u0E40\u0E0A\u0E48\u0E19\u0E01\u0E31\u0E19`,
      `\u2715 \u0412 \u044D\u0442\u043E\u043C \u0448\u0442\u0430\u0442\u0435 (${stateName}) \u0435\u0441\u0442\u044C \u043F\u043E\u0434\u043E\u0445\u043E\u0434\u043D\u044B\u0439 \u043D\u0430\u043B\u043E\u0433 \u0448\u0442\u0430\u0442\u0430, \u043D\u043E \u0432\u044B\u0438\u0433\u0440\u044B\u0448\u0438 \u0432 \u043B\u043E\u0442\u0435\u0440\u0435\u044E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u044B \u043E\u0442 \u043D\u0435\u0433\u043E. \u042D\u0442\u043E \u0442\u043E\u0436\u0435 \u0441\u043B\u0443\u0447\u0430\u0439, \u043A\u043E\u0433\u0434\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E.`
    );
    cls = 'tag-none';
  } else if (UNCERTAIN_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u26A0 \uC774 \uC8FC(${stateName})\uB294 \uC6D0\uCC9C\uC9D5\uC218\uC728 \uC815\uBCF4\uAC00 \uACF5\uC2DD \uC790\uB8CC\uB9C8\uB2E4 \uC870\uAE08\uC529 \uB2EC\uB77C\uC11C(8.75~9.5%) \uC815\uD655\uD55C \uD655\uC778\uC774 \uB354 \uD544\uC694\uD574\uC694. \uB2F9\uCCA8 \uC2DC \uC8FC \uBCF5\uAD8C \uACF5\uC2DD \uC0AC\uC774\uD2B8\uC5D0\uC11C \uC2E4\uC81C \uC6D0\uCC9C\uC9D5\uC218\uC728\uC744 \uAF2D \uD655\uC778\uD558\uC138\uC694.`,
      `\u26A0 This state (${stateName}) has withholding rate figures that vary slightly across official sources (8.75~9.5%), so it needs more checking. Be sure to confirm the actual withholding rate on the state lottery\u2019s official site if you win.`,
      `\u26A0 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u7684\u9884\u6263\u7A0E\u7387\u5728\u5B98\u65B9\u8D44\u6599\u4E2D\u7565\u6709\u5DEE\u5F02\uFF088.75~9.5%\uFF09\uFF0C\u9700\u8981\u8FDB\u4E00\u6B65\u786E\u8BA4\u3002\u4E2D\u5956\u65F6\u8BF7\u52A1\u5FC5\u5728\u8BE5\u5DDE\u5F69\u7968\u5B98\u7F51\u786E\u8BA4\u5B9E\u9645\u9884\u6263\u7A0E\u7387\u3002`,
      `\u26A0 Bang n\u00E0y (${stateName}) c\u00F3 s\u1ED1 li\u1EC7u thu\u1EBF kh\u1EA5u tr\u1EEB h\u01A1i kh\u00E1c nhau gi\u1EEFa c\u00E1c ngu\u1ED3n ch\u00EDnh th\u1EE9c (8,75~9,5%), n\u00EAn c\u1EA7n ki\u1EC3m tra k\u1EF9 h\u01A1n. N\u1EBFu tr\u00FAng s\u1ED1, h\u00E3y ch\u1EAFc ch\u1EAFn x\u00E1c nh\u1EADn t\u1EF7 l\u1EC7 kh\u1EA5u tr\u1EEB th\u1EF1c t\u1EBF tr\u00EAn trang ch\u00EDnh th\u1EE9c c\u1EE7a x\u1ED5 s\u1ED1 bang.`,
      `\u26A0 \u0E21\u0E25\u0E23\u0E31\u0E10\u0E19\u0E35\u0E49 (${stateName}) \u0E21\u0E35\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E17\u0E35\u0E48\u0E41\u0E15\u0E01\u0E15\u0E48\u0E32\u0E07\u0E01\u0E31\u0E19\u0E40\u0E25\u0E47\u0E01\u0E19\u0E49\u0E2D\u0E22\u0E43\u0E19\u0E41\u0E2B\u0E25\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23 (8.75~9.5%) \u0E08\u0E36\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21 \u0E2B\u0E32\u0E01\u0E16\u0E39\u0E01\u0E23\u0E32\u0E07\u0E27\u0E31\u0E25 \u0E2D\u0E22\u0E48\u0E32\u0E25\u0E37\u0E21\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2B\u0E31\u0E01 \u0E13 \u0E17\u0E35\u0E48\u0E08\u0E48\u0E32\u0E22\u0E08\u0E23\u0E34\u0E07\u0E1A\u0E19\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E0B\u0E15\u0E4C\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07\u0E25\u0E2D\u0E15\u0E40\u0E15\u0E2D\u0E23\u0E35\u0E21\u0E25\u0E23\u0E31\u0E10`,
      `\u26A0 \u0412 \u044D\u0442\u043E\u043C \u0448\u0442\u0430\u0442\u0435 (${stateName}) \u0441\u0442\u0430\u0432\u043A\u0430 \u0443\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u044F \u043D\u0435\u043C\u043D\u043E\u0433\u043E \u043E\u0442\u043B\u0438\u0447\u0430\u0435\u0442\u0441\u044F \u0432 \u0440\u0430\u0437\u043D\u044B\u0445 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0445 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430\u0445 (8,75\u20139,5%), \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043D\u0443\u0436\u043D\u0430 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430. \u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u0441\u0442\u0430\u0432\u043A\u0443 \u043D\u0430 \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u043C \u0441\u0430\u0439\u0442\u0435 \u043B\u043E\u0442\u0435\u0440\u0435\u0438 \u0448\u0442\u0430\u0442\u0430, \u0435\u0441\u043B\u0438 \u0432\u044B\u0438\u0433\u0440\u0430\u0435\u0442\u0435.`
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
    );
    cls = 'tag-check';
  }
  resultEl.textContent = msg;
  resultEl.className = 'refund-wizard-result ' + cls;
}

let activeFaqCategory = 'all';

function setFaqCategory(cat, btnEl){
  activeFaqCategory = cat;
  document.querySelectorAll('.faq-chip').forEach(c => c.classList.remove('active'));
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
  const items = document.querySelectorAll('#view-faq .faq-item, #view-faq .refund-step-card[data-basis]');
  let visibleCount = 0;
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const searchMatch = query === '' || text.includes(query);
    const catMatch = activeFaqCategory === 'all' || !item.dataset.cat || item.dataset.cat === activeFaqCategory;
    const basisMatch = !item.dataset.basis || item.dataset.basis.split(',').includes(currentBasis);
    const match = searchMatch && catMatch && basisMatch;
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

function drawLightningNumbers(){
  const nums = new Set();
  while (nums.size < 5) nums.add(Math.floor(Math.random() * 69) + 1);
  const sorted = [...nums].sort((a,b) => a-b);
  const pb = Math.floor(Math.random() * 26) + 1;
  const balls = document.querySelectorAll('#lightning-result .lightning-ball');
  sorted.forEach((n, i) => {
    balls[i].textContent = n;
    balls[i].classList.remove('drawn');
    void balls[i].offsetWidth;
    balls[i].classList.add('drawn');
  });
  balls[5].textContent = pb;
  balls[5].classList.remove('drawn');
  void balls[5].offsetWidth;
  balls[5].classList.add('drawn');
}

function updateDrawCountdown(){
  // 파워볼: 월(1)/수(3)/토(6), 메가밀리언즈: 화(2)/금(5)
  // 실제 추첨은 미국 동부시간 기준이라, 방문자가 어느 나라/시간대에서 접속하든
  // 항상 미국 동부시간 기준 요일로 계산해야 정확함 (로컬 시간 기준이면 해외 접속 시 하루 오차 발생 가능)
  function getUsEasternDayOfWeek(){
    const now = new Date();
    const easternStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    return new Date(easternStr).getDay();
  }
  function nextDrawInfo(drawDays){
    const todayDow = getUsEasternDayOfWeek();
    if (drawDays.includes(todayDow)) return 'D-0';
    let diff = 1;
    while (!drawDays.includes((todayDow + diff) % 7)) diff++;
    return `D-${diff}`;
  }
  document.getElementById('dday-powerball').textContent = nextDrawInfo([1,3,6]);
  document.getElementById('dday-mega').textContent = nextDrawInfo([2,5]);
}

// ============================================================================
// 🎟️ 오늘 잭팟 수동 업데이트 존 — 추첨(파워볼 월/수/토, 메가밀리언즈 화/금) 다음날
// amountUsd만 공식 사이트 보고 고치면 30초로 끝납니다.
// ============================================================================
const JACKPOT_DATA = {
  powerball:    { amountUsd: 526000000 },
  megamillions: { amountUsd: 707000000 },
};

// 🗂️ 역대 잭팟 확인 기록 — JACKPOT_DATA를 갱신할 때마다 그 시점 금액을 한 줄씩 추가.
// 경쟁사가 하루 만에 못 베끼는 누적형 콘텐츠(가이드북 Moat Rule 참고). date는 YYYY-MM-DD.
// cashUsd: 실제 당첨자가 받은 일시불 금액이 공식 확인된 경우 그 실제값(출처: powerball.com/megamillions.com
// 공식 발표, CNN·CBS 등 언론 보도) — 없으면 렌더링 시 CASH_VALUE_RATIO(0.58)로 추정.
// stateCode: 당첨 주(State) — 세율 있는 주로 단일 특정 가능한 경우만 표기, 복수 주 분할 당첨은 'AVG' 처리.
const JACKPOT_HISTORY = [
  // 역대 최고액 기록 5건 (공식 발표·언론 보도로 확인된 실제 일시불 금액 기준)
  { date: '2022-11-07', game: 'powerball', amountUsd: 2040000000, cashUsd: 997600000, stateCode: 'CA', noteKo: '역대 최고액 (캘리포니아, 1인)', noteEn: 'All-time record (California, single winner)', noteZh: '历史最高纪录（加利福尼亚，1人独得）', noteVi: 'Kỷ lục mọi thời đại (California, 1 người trúng)', noteTh: 'สถิติสูงสุดตลอดกาล (แคลิฟอร์เนีย ผู้ถูกรางวัลคนเดียว)', noteRu: 'Абсолютный рекорд (Калифорния, один победитель)' },
  { date: '2025-09-06', game: 'powerball', amountUsd: 1787000000, cashUsd: 820600000, stateCode: 'AVG', noteKo: '역대 2위 (미주리·텍사스 2인 분할)', noteEn: '2nd all-time (Missouri & Texas, split 2 ways)', noteZh: '历史第二（密苏里·得克萨斯 2人平分）', noteVi: 'Xếp thứ 2 mọi thời đại (Missouri & Texas, chia 2 người)', noteTh: 'อันดับ 2 ตลอดกาล (มิสซูรีและเท็กซัส แบ่ง 2 คน)', noteRu: '2-е место за всё время (Миссури и Техас, поделено на 2)' },
  { date: '2016-01-13', game: 'powerball', amountUsd: 1586000000, cashUsd: 983400000, stateCode: 'AVG', noteKo: '캘리포니아·플로리다·테네시 3인 분할', noteEn: 'California, Florida & Tennessee, split 3 ways', noteZh: '加利福尼亚·佛罗里达·田纳西 3人平分', noteVi: 'California, Florida & Tennessee, chia 3 người', noteTh: 'แคลิฟอร์เนีย ฟลอริดา และเทนเนสซี แบ่ง 3 คน', noteRu: 'Калифорния, Флорида и Теннесси, поделено на 3' },
  { date: '2023-10-11', game: 'powerball', amountUsd: 1765000000, cashUsd: 774100000, stateCode: 'CA', noteKo: '캘리포니아, 1인', noteEn: 'California, single winner', noteZh: '加利福尼亚，1人独得', noteVi: 'California, 1 người trúng', noteTh: 'แคลิฟอร์เนีย ผู้ถูกรางวัลคนเดียว', noteRu: 'Калифорния, один победитель' },
  { date: '2023-08-08', game: 'megamillions', amountUsd: 1602000000, cashUsd: 794200000, stateCode: 'FL', noteKo: '역대 메가밀리언즈 최고액 (플로리다, 1인)', noteEn: 'Mega Millions all-time record (Florida, single winner)', noteZh: '超级百万历史最高纪录（佛罗里达，1人独得）', noteVi: 'Kỷ lục Mega Millions mọi thời đại (Florida, 1 người trúng)', noteTh: 'สถิติเมกะมิลเลียนสูงสุดตลอดกาล (ฟลอริดา ผู้ถูกรางวัลคนเดียว)', noteRu: 'Абсолютный рекорд Mega Millions (Флорида, один победитель)' },
  { date: '2026-07-19', game: 'powerball', amountUsd: 526000000 },
  { date: '2026-07-19', game: 'megamillions', amountUsd: 707000000 },
];

function renderJackpotHistory(){
  const listEl = document.getElementById('jackpot-history-list');
  if (!listEl) return;
  if (!JACKPOT_HISTORY.length) {
    listEl.innerHTML = `<p class="jackpot-history-empty">${pickLang('아직 기록이 없어요.', 'No records yet.', '暂无记录。', 'Chưa có kỷ lục nào.', 'ยังไม่มีบันทึก', 'Пока нет записей.')}</p>`;
    return;
  }
  const gameNameKo = { powerball: '파워볼', megamillions: '메가밀리언즈' };
  const gameNameEn = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameZh = { powerball: '强力球', megamillions: '超级百万' };
  const gameNameVi = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameTh = { powerball: 'พาวเวอร์บอล', megamillions: 'เมกะมิลเลียน' };
  const gameNameRu = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const sorted = [...JACKPOT_HISTORY].sort((a, b) => b.date.localeCompare(a.date));
  listEl.innerHTML = sorted.map(entry => {
    const cashUsd = entry.cashUsd || entry.amountUsd * CASH_VALUE_RATIO;
    const cashKrw = cashUsd * EXCHANGE_RATE;
    const gameLabel = pickLang(gameNameKo[entry.game], gameNameEn[entry.game], gameNameZh[entry.game], gameNameVi[entry.game], gameNameTh[entry.game], gameNameRu[entry.game]);
    const note = pickLang(entry.noteKo, entry.noteEn, entry.noteZh, entry.noteVi, entry.noteTh, entry.noteRu);
    const noteHtml = note ? `<p class="jh-note">${note}</p>` : '';
    // 나라 목록·주세 등은 COUNTRY_TAX_PROFILES 하나로 관리되므로, 여기서도 kr/us만 하드코딩하지
    // 않고 구현된 나라 전체(현재 kr/us/cn/in)를 순회함 — 새 나라가 추가되면 자동으로 같이 늘어남
    const amtResults = COUNTRY_TAX_PROFILES.filter(p => p.implemented).map(profile => {
      const r = calcTakeHome(cashKrw / 100000000, profile.code, profile.needsState ? (entry.stateCode || 'AVG') : null);
      const label = getProfileShortLabel(profile);
      return { label, final: r.final };
    }).sort((a, b) => b.final - a.final);
    const JH_VISIBLE_COUNT = 4;
    const toAmtItem = (item) => `<span class="jh-amt-item"><span class="jh-amt-label">${item.label}</span><span class="jh-amt">${formatWon(item.final)}</span></span>`;
    const visibleItems = amtResults.slice(0, JH_VISIBLE_COUNT).map(toAmtItem).join('');
    const hiddenItems = amtResults.slice(JH_VISIBLE_COUNT);
    const hiddenHtml = hiddenItems.length
      ? `<details class="jh-more"><summary class="jh-more-summary">${pickLang(`나머지 ${hiddenItems.length}개국 더보기`, `${hiddenItems.length} more countries`, `其他${hiddenItems.length}个国家`, `Xem thêm ${hiddenItems.length} nước`, `ดูอีก ${hiddenItems.length} ประเทศ`, `Ещё ${hiddenItems.length} стран`)}</summary><div class="jh-amounts">${hiddenItems.map(toAmtItem).join('')}</div></details>`
      : '';
    return `<div class="jackpot-history-row">
      <div class="jh-top">
        <span class="jh-date">${entry.date}</span>
        <span class="jh-game">${gameLabel}</span>
      </div>
      ${noteHtml}
      <div class="jh-amounts">
        ${visibleItems}
      </div>
      ${hiddenHtml}
    </div>`;
  }).join('');
}

function applyJackpotData(){
  document.getElementById('jp-powerball').setAttribute('data-target', JACKPOT_DATA.powerball.amountUsd);
  document.getElementById('jp-mega').setAttribute('data-target', JACKPOT_DATA.megamillions.amountUsd);
}

const CASH_VALUE_RATIO = 0.58; // 일시불(lump sum)은 발표된 연금 기준 잭팟의 약 45~60% (현재가치 할인) — 중간값 사용, 화면 표시 문구와 일치

function initJackpotCardAmt(){
  const krw = getJackpotKRW();
  // formatWon()이 이미 언어별(ko/en/zh/vi/th/ru) 단위 변환·표기를 전부 처리하므로 재사용
  document.getElementById('jackpot-card-amt').textContent = pickLang('약 ', 'About ', '约', 'Khoảng ', 'ประมาณ ', 'Около ') + formatWon((krw * CASH_VALUE_RATIO) / 100000000);
  document.getElementById('jackpot-card-amt-note').textContent = pickLang('(일시불 세전)', '(lump-sum, pre-tax)', '(一次性支付，税前)', '(một lần, trước thuế)', '(จ่ายครั้งเดียว ก่อนหักภาษี)', '(единовременно, до налогов)');

  const pbUsd = Number(document.getElementById('jp-powerball').getAttribute('data-target'));
  const mgUsd = Number(document.getElementById('jp-mega').getAttribute('data-target'));
  document.getElementById('jp-powerball-krw').textContent = usdToKrwLabel(pbUsd);
  document.getElementById('jp-mega-krw').textContent = usdToKrwLabel(mgUsd);

  // "million/billion 감이 안 온다"는 사용자에게 숫자를 직접 타이핑하게 하는 대신,
  // 오늘 실제 잭팟의 일시불 환산액을 버튼에 미리 보여주고 누르면 바로 채워지게 함.
  // 버튼에는 실제로 입력창에 채워질 값(M USD)과 그 원화 감(약 -억원)을 같이 보여줘서,
  // "버튼을 누르면 아래 M USD 칸에 정확히 이 숫자가 들어간다"는 걸 한눈에 알 수 있게 함
  // ko/zh는 "M USD"만, 그 외(en/vi/th/ru)는 국제 독자에게 익숙한 "$" 접두사를 붙임
  const showDollarSign = (typeof currentLang !== 'undefined' && currentLang !== 'ko' && currentLang !== 'zh');
  const quickfillLabel = (usd) => {
    const cashUsd = usd * CASH_VALUE_RATIO;
    const millions = Math.round(cashUsd / 1000000);
    const krwLabel = usdToKrwLabel(cashUsd).replace(/^\(|\)$/g, '');
    return showDollarSign ? `$${millions}M USD (${krwLabel})` : `${millions}M USD (${krwLabel})`;
  };
  document.getElementById('quickfill-pb-amt').textContent = quickfillLabel(pbUsd);
  document.getElementById('quickfill-mm-amt').textContent = quickfillLabel(mgUsd);
}

function fillHomeAmountFromJackpot(game){
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
  input.focus();
}

function refreshJackpotDrawerIfOpen(){
  const box = document.getElementById('jackpot-calc-box');
  if (box && box.classList.contains('show')) {
    const announcedKrw = getJackpotKRW();
    const cashKrw = announcedKrw * CASH_VALUE_RATIO;
    const r = calcTakeHome(cashKrw / 100000000, 'kr');
    // formatWon()이 이미 언어별(ko/en/zh/vi/th/ru) 단위 변환·표기를 전부 처리하므로 재사용
    const about = pickLang('약 ', 'About ', '约', 'Khoảng ', 'ประมาณ ', 'Около ');
    document.getElementById('jc-jackpot').textContent = about + formatWon(announcedKrw / 100000000);
    document.getElementById('jc-cash').textContent = about + formatWon(cashKrw / 100000000);
    document.getElementById('jc-final').textContent = about + formatWon(r.final);
    document.getElementById('jc-note-basis').textContent = pickLang(
      `한국 거주자 기준 (미국 비거주자 원천징수 30% + 한국 종합소득세 누진세율/FTC 적용, 환율 약 ${EXCHANGE_RATE.toLocaleString('ko-KR')}원 적용)`,
      `Korea resident basis (30% US non-resident withholding + Korean progressive income tax/FTC, ~${EXCHANGE_RATE.toLocaleString('en-US')} KRW/USD)`,
      `以韩国居民为基准（美国非居民预扣30% + 韩国累进所得税/FTC 抵免，汇率约${EXCHANGE_RATE.toLocaleString('zh-CN')}韩元/美元）`,
      `Theo tiêu chuẩn cư dân Hàn Quốc (khấu trừ 30% cho người không cư trú tại Mỹ + thuế thu nhập lũy tiến Hàn Quốc/FTC, tỷ giá khoảng ${EXCHANGE_RATE.toLocaleString('vi-VN')} KRW/USD)`,
      `เกณฑ์ผู้พำนักในเกาหลี (หัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ + ภาษีเงินได้แบบก้าวหน้าของเกาหลี/FTC อัตราแลกเปลี่ยนประมาณ ${EXCHANGE_RATE.toLocaleString('th-TH')} วอน/ดอลลาร์)`,
      `По правилам резидента Кореи (30% удержание для нерезидентов США + прогрессивный подоходный налог Кореи/FTC, курс около ${EXCHANGE_RATE.toLocaleString('ru-RU')} вон/долл.)`
    );

    // 연금(annuity) 선택 시 — 발표 잭팟 총액을 30회로 단순 평균해 희망적인 그림도 함께 보여줌
    const ANNUITY_PAYMENTS = 30;
    const perYearKrw = announcedKrw / ANNUITY_PAYMENTS;
    const rYear = calcTakeHome(perYearKrw / 100000000, 'kr');
    document.getElementById('jc-annuity-year').textContent = about + 억(perYearKrw);
    document.getElementById('jc-annuity-year-net').textContent = about + formatWon(rYear.final);
    document.getElementById('jc-annuity-month-net').textContent = about + formatWon(rYear.final / 12);
  }
}

// "자세히 보기" 류의 링크에서 공용으로 사용 — details를 펼친 뒤, 펼쳐지는 애니메이션으로 인해
// 레이아웃 높이가 바뀌는 것을 브라우저가 반영할 시간(한 프레임)을 준 다음에 스크롤함.
// 펼치자마자 바로 스크롤하면 "펼치기 전" 높이를 기준으로 위치를 계산해서 엉뚱한 곳으로 이동할 수 있음.
function openDetailAndScroll(selector){
  const el = document.querySelector(selector);
  if (!el) return;
  el.open = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
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
    el.textContent = pickLang('👆 카드를 다시 누르면 접혀요', '👆 Tap the card again to collapse', '👆 再次点击卡片可收起', '👆 Nhấn lại vào thẻ để thu gọn', '👆 แตะการ์ดอีกครั้งเพื่อย่อ', '👆 Нажмите на карточку ещё раз, чтобы свернуть');
  } else {
    el.textContent = pickLang('👇 눌러서 세후 실수령액 보기', '👇 Tap to see your after-tax take-home', '👇 点击查看税后实得金额', '👇 Nhấn để xem số tiền thực nhận sau thuế', '👇 แตะเพื่อดูจำนวนที่ได้รับจริงหลังหักภาษี', '👇 Нажмите, чтобы увидеть сумму на руки после налогов');
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

document.addEventListener('DOMContentLoaded', () => { applyJackpotData(); runCountUps(); updateHomeCalc(100000000); updateCalc(); initJackpotCardAmt(); updateDrawCountdown(); syncRateInputsDisplay(); setupRevealAnimation(); renderJackpotHistory(); fetchLiveExchangeRate(); });

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
  } else if (SUPPORTED_LANGS.includes(urlLang)) {
    setLanguage(urlLang);
  } else {
    const detected = detectBrowserLanguage();
    if (detected) setLanguage(detected);
  }

  if (SUPPORTED_LANGS.includes(urlLang)) {
    // 한 번 적용한 뒤엔 URL에서 ?lang= 을 지워야 함 — 남겨두면, 방문자가 이후 언어 토글로
    // 직접 다른 언어를 골라도 새로고침하는 순간 주소창에 남아있는 이 값이 다시 강제로
    // 적용되면서 "내가 방금 고른 언어가 마음대로 바뀌는" 것처럼 보이는 문제가 있었음
    params.delete('lang');
    const newSearch = params.toString();
    history.replaceState(null, '', location.pathname + (newSearch ? '?' + newSearch : '') + location.hash);
  }
});
setInterval(() => { fetchLiveExchangeRate(); }, 60 * 60 * 1000); // 1시간마다 환율 자동 재조회 — 유저가 직접 수정한 경우는 fetchLiveExchangeRate 내부에서 자동으로 건너뜀

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
    requestAnimationFrame(() => { fitAmountFontSize(document.getElementById('home-final-amt')); });
  }, 200);
});

function fitAmountFontSize(el){
  if (!el) return;
  const container = el.parentElement;
  if (!container) return;
  el.style.fontSize = ''; // CSS clamp 기본값으로 리셋
  let fontSize = parseFloat(getComputedStyle(el).fontSize);
  const minFontSize = 20; // 아무리 길어도 이 밑으로는 안 줄임 (그 이하는 가독성 문제)
  const safetyMargin = 22; // 기기별 폰트 렌더링(서브픽셀 anti-aliasing, 폰트 로딩 전/후 폭 차이 등) 오차를 감안한 여유폭.
  // 이전엔 14px였는데, 딱 안 넘치는 수준이라 "билл" 등 긴 단위가 붙으면 폭을 꽉 채워 답답해 보인다는
  // 피드백이 있어서 시각적 여유를 더 확보하도록 확대함
  let guard = 0;
  while (el.scrollWidth > container.clientWidth - safetyMargin && fontSize > minFontSize && guard < 30) {
    fontSize -= 1;
    el.style.fontSize = fontSize + 'px';
    guard++;
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

function onHomeAmountTyped(){
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
    `🤑 Что можно купить на ${amt}? (просто для развлечения)`
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
    apt:    { currency: 'krw', price: 2500000000, label: () => pickLang('강남 아파트 (25억 기준)', 'Gangnam apartment (based on ₩2.5B)', '江南公寓（按25亿韩元计算）', 'Căn hộ Gangnam (dựa trên ₩2,5 tỷ)', 'อพาร์ตเมนต์กังนัม (อิงจาก ₩2.5 พันล้าน)', 'Квартира в Каннаме (по ₩2,5 млрд)') },
    car:    { currency: 'krw', price: 350000000,  label: () => pickLang('페라리 로마 (3.5억원 기준)', 'Ferrari Roma (based on ₩350M)', '法拉利Roma（按3.5亿韩元计算）', 'Ferrari Roma (dựa trên ₩350 triệu)', 'เฟอร์รารี โรม่า (อิงจาก ₩350 ล้าน)', 'Ferrari Roma (по ₩350 млн)') },
    coffee: { currency: 'krw', price: 5000,        label: () => pickLang('스타벅스 아메리카노 (5천원)', 'Starbucks Americano (₩5,000)', '星巴克美式咖啡（5,000韩元）', 'Starbucks Americano (₩5.000)', 'สตาร์บัคส์ อเมริกาโน่ (₩5,000)', 'Starbucks Americano (₩5 000)') }
  },
  us: {
    apt:    { currency: 'usd', price: 1500000, label: () => pickLang('맨해튼 아파트 (150만 달러 기준)', 'Manhattan apartment (based on $1.5M)', '曼哈顿公寓（按150万美元计算）', 'Căn hộ Manhattan (dựa trên $1,5 triệu)', 'อพาร์ตเมนต์แมนฮัตตัน (อิงจาก $1.5 ล้าน)', 'Квартира на Манхэттене (по $1,5 млн)') },
    car:    { currency: 'usd', price: 275000,  label: () => pickLang('페라리 로마 (27.5만 달러 기준)', 'Ferrari Roma (based on $275,000)', '法拉利Roma（按27.5万美元计算）', 'Ferrari Roma (dựa trên $275.000)', 'เฟอร์รารี โรม่า (อิงจาก $275,000)', 'Ferrari Roma (по $275 000)') },
    coffee: { currency: 'usd', price: 3.75,    label: () => pickLang('스타벅스 아메리카노 (3.75달러)', 'Starbucks Americano ($3.75)', '星巴克美式咖啡（3.75美元）', 'Starbucks Americano ($3,75)', 'สตาร์บัคส์ อเมริกาโน่ ($3.75)', 'Starbucks Americano ($3,75)') }
  },
  cn: {
    apt:    { currency: 'cny', price: 30000000, label: () => pickLang('상하이 고급 아파트 (3천만 위안 기준)', 'Shanghai luxury apartment (based on ¥30M)', '上海高档公寓（按3000万元计算）', 'Căn hộ cao cấp Thượng Hải (dựa trên ¥30 triệu)', 'อพาร์ตเมนต์หรูเซี่ยงไฮ้ (อิงจาก ¥30 ล้าน)', 'Элитная квартира в Шанхае (по ¥30 млн)') },
    car:    { currency: 'cny', price: 2760000,  label: () => pickLang('페라리 로마 (276만 위안 기준)', 'Ferrari Roma (based on ¥2.76M)', '法拉利Roma（按276万元计算）', 'Ferrari Roma (dựa trên ¥2,76 triệu)', 'เฟอร์รารี โรม่า (อิงจาก ¥2.76 ล้าน)', 'Ferrari Roma (по ¥2,76 млн)') },
    coffee: { currency: 'cny', price: 30,       label: () => pickLang('스타벅스 아메리카노 (30위안)', 'Starbucks Americano (¥30)', '星巴克美式咖啡（30元）', 'Starbucks Americano (¥30)', 'สตาร์บัคส์ อเมริกาโน่ (¥30)', 'Starbucks Americano (¥30)') }
  },
  // 인도는 수입차에 100%가 넘는 관세가 붙어서 페라리 로마 실거래가가 미국 정가의 두 배 이상임 —
  // 아래 가격은 참고용 대략치(위 kr/us/cn과 동일하게 정확한 출처 표기 없는 재미 콘텐츠)
  in: {
    apt:    { currency: 'inr', price: 200000000, label: () => pickLang('뭄바이 고급 아파트 (2억 루피 기준)', 'Mumbai luxury apartment (based on ₹20 crore)', '孟买豪华公寓（按2亿卢比计算）', 'Căn hộ cao cấp Mumbai (dựa trên ₹20 crore)', 'อพาร์ตเมนต์หรูมุมไบ (อิงจาก ₹20 โครร์)', 'Элитная квартира в Мумбаи (по ₹20 крор)') },
    car:    { currency: 'inr', price: 65000000,  label: () => pickLang('페라리 로마 (6,500만 루피 기준)', 'Ferrari Roma (based on ₹6.5 crore)', '法拉利Roma（按6500万卢比计算）', 'Ferrari Roma (dựa trên ₹6,5 crore)', 'เฟอร์รารี โรม่า (อิงจาก ₹6.5 โครร์)', 'Ferrari Roma (по ₹6,5 крор)') },
    coffee: { currency: 'inr', price: 300,       label: () => pickLang('스타벅스 아메리카노 (300루피)', 'Starbucks Americano (₹300)', '星巴克美式咖啡（300卢比）', 'Starbucks Americano (₹300)', 'สตาร์บัคส์ อเมริกาโน่ (₹300)', 'Starbucks Americano (₹300)') }
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

  document.getElementById('flex-apt').textContent = apt.toLocaleString(localeStr) + pickLang('채', ' units', '套', ' căn', ' หลัง', ' шт.');
  document.getElementById('flex-car').textContent = car.toLocaleString(localeStr) + pickLang('대', ' cars', '辆', ' chiếc', ' คัน', ' шт.');
  document.getElementById('flex-coffee').textContent = coffeeYears > 0
    ? pickLang(`하루 3잔씩 ${coffeeYears.toLocaleString(localeStr)}년`, `3/day for ${coffeeYears.toLocaleString(localeStr)} years`, `每天3杯，喝${coffeeYears.toLocaleString(localeStr)}年`, `3 ly/ngày trong ${coffeeYears.toLocaleString(localeStr)} năm`, `วันละ 3 แก้ว เป็นเวลา ${coffeeYears.toLocaleString(localeStr)} ปี`, `по 3 в день в течение ${coffeeYears.toLocaleString(localeStr)} лет`)
    : coffeeCups.toLocaleString(localeStr) + pickLang('잔', ' cups', '杯', ' ly', ' แก้ว', ' чашек');
}

// FAQ "세금 가이드" 3칸 요약 카드의 2번째 칸 — "다른 나라에서도 또 내는지"는 세금 계산
// 기준(kr/us/cn)에 따라 완전히 다른 질문이라(한국은 종합소득세, 미국은 이미 federal에 다 포함,
// 중국은 우연소득세), 항상 "한국에서도 또 내요?"로 고정돼 있으면 미국·중국 기준에서는 내용이 안 맞음
const FAQ_TG2 = {
  kr: {
    title: () => pickLang('한국에서도 또 내요?', 'Do I also pay in Korea?', '在韩国也要交税吗？', 'Có phải đóng thuế ở Hàn Quốc nữa không?', 'ต้องเสียภาษีในเกาหลีด้วยไหม?', 'Нужно ли платить налог ещё и в Корее?'),
    sub: () => pickLang('종합소득세 누진세율(최고 45%), 외국납부세액공제(FTC)로 조정 — 참고용 계산', 'Progressive comprehensive income tax (up to 45%), adjusted by Foreign Tax Credit (FTC) — reference estimate', '综合所得税累进税率（最高45%），通过外国税收抵免（FTC）调整 — 仅供参考', 'Thuế thu nhập tổng hợp lũy tiến (tối đa 45%), điều chỉnh bằng Tín dụng thuế nước ngoài (FTC) — ước tính tham khảo', 'ภาษีเงินได้แบบก้าวหน้า (สูงสุด 45%) ปรับด้วยเครดิตภาษีต่างประเทศ (FTC) — ประมาณการอ้างอิง', 'Прогрессивный совокупный подоходный налог (до 45%), скорректированный иностранным налоговым кредитом (FTC) — справочная оценка')
  },
  us: {
    title: () => pickLang('주(State) 세금은 얼마나 붙어요?', 'How much does state tax add?', '州税会加多少？', 'Thuế bang tính thêm bao nhiêu?', 'ภาษีมลรัฐเพิ่มเท่าไหร่?', 'Сколько добавляет налог штата?'),
    sub: () => pickLang('주에 따라 0%~10.9%까지 다양해요 — 텍사스·플로리다 등은 아예 없어요', 'Ranges from 0%–10.9% depending on the state — some states like Texas and Florida have none', '因州而异，从0%到10.9%不等 — 德克萨斯、佛罗里达等州完全没有州税', 'Dao động từ 0%–10,9% tùy bang — một số bang như Texas, Florida không có thuế này', 'อยู่ระหว่าง 0%–10.9% ขึ้นอยู่กับมลรัฐ — บางมลรัฐเช่นเท็กซัสและฟลอริดาไม่มีเลย', 'От 0% до 10,9% в зависимости от штата — в некоторых, как Техас и Флорида, налога нет вообще')
  },
  cn: {
    title: () => pickLang('중국에서도 또 내요?', 'Do I also pay in China?', '在中国也要交税吗？', 'Có phải đóng thuế ở Trung Quốc nữa không?', 'ต้องเสียภาษีในจีนด้วยไหม?', 'Нужно ли платить налог ещё и в Китае?'),
    sub: () => pickLang('우연소득 20% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 20% rate on incidental income — the US tax already paid can offset it via tax credit', '偶然所得20%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 20% trên thu nhập ngẫu nhiên — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 20% สำหรับรายได้ที่เกิดขึ้นโดยบังเอิญ — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 20% на случайный доход — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  in: {
    title: () => pickLang('인도에서도 또 내요?', 'Do I also pay in India?', '在印度也要交税吗？', 'Có phải đóng thuế ở Ấn Độ nữa không?', 'ต้องเสียภาษีในอินเดียด้วยไหม?', 'Нужно ли платить налог ещё и в Индии?'),
    sub: () => pickLang('복권 당첨소득 30% 단일세율 + 서차지·세스 포함 실효 약 39% — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 30% rate on lottery winnings plus surcharge/cess, ~39% effective — the US tax already paid can offset it via tax credit', '彩票中奖所得30%单一税率，加上附加税和税捐后实际约39% — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 30% trên tiền thắng xổ số cộng phụ phí/thuế bổ sung, hiệu quả khoảng 39% — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 30% สำหรับเงินรางวัลลอตเตอรีบวกภาษีเพิ่มและค่าธรรมเนียม รวมประมาณ 39% — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 30% на выигрыш в лотерею плюс надбавка/сбор, эффективно около 39% — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  vn: {
    title: () => pickLang('베트남에서도 또 내요?', 'Do I also pay in Vietnam?', '在越南也要交税吗？', 'Có phải đóng thuế ở Việt Nam nữa không?', 'ต้องเสียภาษีในเวียดนามด้วยไหม?', 'Нужно ли платить налог ещё и во Вьетнаме?'),
    sub: () => pickLang('상금소득 10% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 10% rate on prize income — the US tax already paid can offset it via tax credit', '奖金所得10%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 10% trên thu nhập tiền thưởng — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 10% สำหรับรายได้เงินรางวัล — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 10% на доход от приза — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  id: {
    title: () => pickLang('인도네시아에서도 또 내요?', 'Do I also pay in Indonesia?', '在印尼也要交税吗？', 'Có phải đóng thuế ở Indonesia nữa không?', 'ต้องเสียภาษีในอินโดนีเซียด้วยไหม?', 'Нужно ли платить налог ещё и в Индонезии?'),
    sub: () => pickLang('복권 당첨소득 25% 단일 최종세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 25% final tax rate on lottery winnings — the US tax already paid can offset it via tax credit', '彩票中奖所得25%单一最终税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 25% (thuế cuối cùng) trên tiền thắng xổ số — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราภาษีสุดท้ายคงที่ 25% สำหรับเงินรางวัลลอตเตอรี — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная итоговая ставка 25% на выигрыш в лотерею — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  ph: {
    title: () => pickLang('필리핀에서도 또 내요?', 'Do I also pay in the Philippines?', '在菲律宾也要交税吗？', 'Có phải đóng thuế ở Philippines nữa không?', 'ต้องเสียภาษีในฟิลิปปินส์ด้วยไหม?', 'Нужно ли платить налог ещё и на Филиппинах?'),
    sub: () => pickLang('해외 당첨금은 누진세율(최고 35%)로 합산 과세 — 이 계산기는 최고구간으로 근사, 미국에서 낸 세금은 세액공제로 상계 가능', 'Foreign winnings are taxed at progressive rates (up to 35%) as part of overall income — this calculator approximates using the top bracket; the US tax already paid can offset it via tax credit', '境外中奖所得按累进税率（最高35%）合并征税 — 本计算器按最高档估算，已在美国缴纳的税款可通过税收抵免抵消', 'Tiền thắng từ nước ngoài bị đánh thuế lũy tiến (tối đa 35%) hợp nhất vào thu nhập — máy tính này ước tính theo bậc cao nhất, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'เงินรางวัลจากต่างประเทศเสียภาษีแบบก้าวหน้า (สูงสุด 35%) รวมกับรายได้ — เครื่องคำนวณนี้ประมาณการที่อัตราสูงสุด ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Иностранный выигрыш облагается прогрессивным налогом (до 35%) в составе общего дохода — этот калькулятор использует приближение по верхней ставке, уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  th: {
    title: () => pickLang('태국에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Thailand? (estimate ⚠️)', '在泰国也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Thái Lan nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในไทยด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Таиланде? (оценка ⚠️)'),
    sub: () => pickLang('해외 복권 당첨금 과세 기준이 명확히 확인되지 않아, 개인소득세 최고세율(35%)로 추정 계산했어요 — 실제와 다를 수 있어요', 'The tax rule for foreign lottery winnings isn’t clearly confirmed, so we estimated using the top personal income tax rate (35%) — the real amount may differ', '境外彩票中奖收入的征税依据尚未明确确认，故按个人所得税最高税率（35%）估算 — 可能与实际不同', 'Quy định thuế cho tiền thắng xổ số nước ngoài chưa được xác nhận rõ ràng, nên chúng tôi ước tính theo thuế suất thu nhập cá nhân cao nhất (35%) — số tiền thực tế có thể khác', 'ยังไม่ยืนยันหลักเกณฑ์ภาษีสำหรับเงินรางวัลลอตเตอรีจากต่างประเทศอย่างชัดเจน จึงประมาณการด้วยอัตราภาษีเงินได้บุคคลธรรมดาสูงสุด (35%) — จำนวนจริงอาจแตกต่างออกไป', 'Правило налогообложения иностранных лотерейных выигрышей чётко не подтверждено, поэтому мы использовали оценку по максимальной ставке подоходного налога (35%) — реальная сумма может отличаться')
  },
  jp: {
    title: () => pickLang('일본에서도 또 내요?', 'Do I also pay in Japan?', '在日本也要交税吗？', 'Có phải đóng thuế ở Nhật Bản nữa không?', 'ต้องเสียภาษีในญี่ปุ่นด้วยไหม?', 'Нужно ли платить налог ещё и в Японии?'),
    sub: () => pickLang('일본 자국 복권만 비과세이고 해외 복권은 「일시소득」으로 과세 — 절반만 과세표준에 포함(1/2 특례) 후 누진세율 적용, 미국에서 낸 세금은 세액공제로 상계 가능', 'Only Japan’s own lottery is tax-free — foreign lottery winnings are taxed as “temporary income”, with only half included in the tax base, then taxed at progressive rates; the US tax already paid can offset it via tax credit', '仅日本本国彩票免税，境外彩票按「一时所得」征税——仅一半计入应税额后按累进税率征税，已在美国缴纳的税款可通过税收抵免抵消', 'Chỉ xổ số của chính Nhật Bản mới miễn thuế — tiền thắng xổ số nước ngoài bị đánh thuế là "thu nhập tạm thời", chỉ tính một nửa vào cơ sở thuế rồi áp thuế lũy tiến, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'มีเพียงลอตเตอรีของญี่ปุ่นเองเท่านั้นที่ปลอดภาษี — เงินรางวัลลอตเตอรีต่างประเทศถูกเก็บภาษีเป็น "รายได้ชั่วคราว" โดยนับเพียงครึ่งหนึ่งเข้าฐานภาษีแล้วใช้อัตราก้าวหน้า ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Только собственная лотерея Японии не облагается налогом — иностранный лотерейный выигрыш облагается как «временный доход», в налоговую базу включается лишь половина суммы, затем применяется прогрессивная ставка; уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  ru: {
    title: () => pickLang('러시아에서도 또 내요? (조약 정지 ⚠️)', 'Do I also pay in Russia? (treaty suspended ⚠️)', '在俄罗斯也要交税吗？（条约暂停⚠️）', 'Có phải đóng thuế ở Nga nữa không? (hiệp định bị đình chỉ ⚠️)', 'ต้องเสียภาษีในรัสเซียด้วยไหม? (สนธิสัญญาระงับ ⚠️)', 'Нужно ли платить налог ещё и в России? (договор приостановлен ⚠️)'),
    sub: () => pickLang('일반 누진세율 최고구간 22% 적용(국내 판촉경품 전용 35%는 해당 없음) — 단, 2023년 미-러 조세조약 핵심 조항 정지로 미국 세금 상계가 지금도 되는지 불확실해요', 'The standard top progressive rate of 22% applies (the 35% rate is only for domestic promotional prizes) — but since Russia suspended key US treaty provisions in 2023, it’s unclear whether the US tax can still be offset', '适用一般累进税率最高档22%（35%的特别税率仅针对国内促销奖品）——但由于俄罗斯2023年暂停了与美国税收协定的核心条款，能否抵免美国税款尚不确定', 'Áp dụng thuế suất lũy tiến cao nhất 22% (mức 35% chỉ dành cho giải thưởng khuyến mãi trong nước) — nhưng do Nga đình chỉ các điều khoản cốt lõi trong hiệp định thuế với Mỹ từ 2023, chưa rõ liệu có còn khấu trừ thuế Mỹ được không', 'ใช้อัตราภาษีก้าวหน้าสูงสุด 22% ตามปกติ (อัตรา 35% ใช้เฉพาะของรางวัลส่งเสริมการขายในประเทศ) — แต่เนื่องจากรัสเซียระงับข้อกำหนดหลักของสนธิสัญญากับสหรัฐฯ ตั้งแต่ปี 2023 จึงยังไม่แน่ชัดว่าจะหักลบภาษีสหรัฐฯ ได้หรือไม่', 'Применяется стандартная максимальная прогрессивная ставка 22% (35% — только для внутренних промо-призов) — но поскольку Россия приостановила ключевые положения договора с США в 2023 году, неясно, можно ли по-прежнему зачесть налог США')
  },
  np: {
    title: () => pickLang('네팔에서도 또 내요?', 'Do I also pay in Nepal?', '在尼泊尔也要交税吗？', 'Có phải đóng thuế ở Nepal nữa không?', 'ต้องเสียภาษีในเนปาลด้วยไหม?', 'Нужно ли платить налог ещё и в Непале?'),
    sub: () => pickLang('복권·상금 등 우발이득에 25% 단일 최종세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 25% final tax on windfall income like lottery/prizes — the US tax already paid can offset it via tax credit', '彩票、奖金等偶然所得适用25%单一最终税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 25% (thuế cuối cùng) trên thu nhập bất ngờ như xổ số/tiền thưởng — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราภาษีสุดท้ายคงที่ 25% สำหรับรายได้ที่ไม่คาดคิด เช่น ลอตเตอรี/เงินรางวัล — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная итоговая ставка 25% на случайный доход, например от лотереи/приза — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  lk: {
    title: () => pickLang('스리랑카에서도 또 내요?', 'Do I also pay in Sri Lanka?', '在斯里兰卡也要交税吗？', 'Có phải đóng thuế ở Sri Lanka nữa không?', 'ต้องเสียภาษีในศรีลังกาด้วยไหม?', 'Нужно ли платить налог ещё и в Шри-Ланке?'),
    sub: () => pickLang('해외 당첨금은 누진세율(최고 36%)로 직접 신고 — 이 계산기는 최고구간으로 근사, 미국에서 낸 세금은 세액공제로 상계 가능', 'Foreign winnings are self-declared at progressive rates (up to 36%) — this calculator approximates using the top bracket; the US tax already paid can offset it via tax credit', '境外中奖所得按累进税率（最高36%）自行申报 — 本计算器按最高档估算，已在美国缴纳的税款可通过税收抵免抵消', 'Tiền thắng từ nước ngoài tự khai báo theo thuế suất lũy tiến (tối đa 36%) — máy tính này ước tính theo bậc cao nhất, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'เงินรางวัลจากต่างประเทศต้องยื่นภาษีเองตามอัตราก้าวหน้า (สูงสุด 36%) — เครื่องคำนวณนี้ประมาณการที่อัตราสูงสุด ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Иностранный выигрыш декларируется самостоятельно по прогрессивной ставке (до 36%) — этот калькулятор использует приближение по верхней ставке, уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  uz: {
    title: () => pickLang('우즈베키스탄에서도 또 내요?', 'Do I also pay in Uzbekistan?', '在乌兹别克斯坦也要交税吗？', 'Có phải đóng thuế ở Uzbekistan nữa không?', 'ต้องเสียภาษีในอุซเบกิสถานด้วยไหม?', 'Нужно ли платить налог ещё и в Узбекистане?'),
    sub: () => pickLang('모든 개인소득에 12% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 12% rate on all personal income — the US tax already paid can offset it via tax credit', '所有个人所得适用12%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 12% trên mọi thu nhập cá nhân — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 12% สำหรับรายได้บุคคลทั้งหมด — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 12% на весь личный доход — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  kz: {
    title: () => pickLang('카자흐스탄에서도 또 내요?', 'Do I also pay in Kazakhstan?', '在哈萨克斯坦也要交税吗？', 'Có phải đóng thuế ở Kazakhstan nữa không?', 'ต้องเสียภาษีในคาซัคสถานด้วยไหม?', 'Нужно ли платить налог ещё и в Казахстане?'),
    sub: () => pickLang('"당첨금" 항목에 거주자 기준 10% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 10% resident rate on the "winnings" category — the US tax already paid can offset it via tax credit', '"中奖所得"项目对居民适用10%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 10% cho cư dân trong danh mục "tiền thắng" — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 10% สำหรับผู้พำนักในหมวด "เงินรางวัล" — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 10% для резидентов по категории «выигрыш» — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  kg: {
    title: () => pickLang('키르기스스탄에서도 또 내요?', 'Do I also pay in Kyrgyzstan?', '在吉尔吉斯斯坦也要交税吗？', 'Có phải đóng thuế ở Kyrgyzstan nữa không?', 'ต้องเสียภาษีในคีร์กีซสถานด้วยไหม?', 'Нужно ли платить налог ещё и в Кыргызстане?'),
    sub: () => pickLang('당첨금 포함 모든 개인소득에 10% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 10% rate on all personal income including winnings — the US tax already paid can offset it via tax credit', '包括中奖所得在内的所有个人所得适用10%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Thuế suất cố định 10% trên mọi thu nhập cá nhân kể cả tiền thắng — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'อัตราคงที่ 10% สำหรับรายได้บุคคลทั้งหมดรวมถึงเงินรางวัล — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Фиксированная ставка 10% на весь личный доход, включая выигрыши — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  mm: {
    title: () => pickLang('미얀마에서도 또 내요?', 'Do I also pay in Myanmar?', '在缅甸也要交税吗？', 'Có phải đóng thuế ở Myanmar nữa không?', 'ต้องเสียภาษีในเมียนมาด้วยไหม?', 'Нужно ли платить налог ещё и в Мьянме?'),
    sub: () => pickLang('"기타 소득"으로 분류돼 누진세율(최고 25%) 적용 — 이 계산기는 최고구간으로 근사, 미국에서 낸 세금은 세액공제로 상계 가능', 'Classified as "other income" and taxed at progressive rates (up to 25%) — this calculator approximates using the top bracket; the US tax already paid can offset it via tax credit', '归类为"其他所得"，适用累进税率（最高25%）— 本计算器按最高档估算，已在美国缴纳的税款可通过税收抵免抵消', 'Được phân loại là "thu nhập khác" và đánh thuế lũy tiến (tối đa 25%) — máy tính này ước tính theo bậc cao nhất, thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'จัดเป็น "รายได้อื่น" และเก็บภาษีแบบก้าวหน้า (สูงสุด 25%) — เครื่องคำนวณนี้ประมาณการที่อัตราสูงสุด ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Классифицируется как «прочий доход» и облагается прогрессивным налогом (до 25%) — этот калькулятор использует приближение по верхней ставке, уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  bd: {
    title: () => pickLang('방글라데시에서도 또 내요?', 'Do I also pay in Bangladesh?', '在孟加拉国也要交税吗？', 'Có phải đóng thuế ở Bangladesh nữa không?', 'ต้องเสียภาษีในบังกลาเทศด้วยไหม?', 'Нужно ли платить налог ещё и в Бангладеш?'),
    sub: () => pickLang('"기타 소득"으로 분류돼 25% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Classified as "other income" with a flat 25% rate — the US tax already paid can offset it via tax credit', '归类为"其他所得"，适用25%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消', 'Được phân loại là "thu nhập khác" với thuế suất cố định 25% — thuế đã nộp ở Mỹ có thể bù trừ qua tín dụng thuế', 'จัดเป็น "รายได้อื่น" อัตราคงที่ 25% — ภาษีที่จ่ายในสหรัฐฯ แล้วสามารถหักลบได้ด้วยเครดิตภาษี', 'Классифицируется как «прочий доход» с фиксированной ставкой 25% — уже уплаченный в США налог можно зачесть налоговым кредитом')
  },
  pk: {
    title: () => pickLang('파키스탄에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Pakistan? (estimate ⚠️)', '在巴基斯坦也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Pakistan nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในปากีสถานด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Пакистане? (оценка ⚠️)'),
    sub: () => pickLang('복권 원천징수 규정(20~40%)이 자국 지급기관 전제라 적용 여부 불명확해, 일반 소득세 최고구간(35%)으로 추정 계산했어요 — 실제와 다를 수 있어요', 'Pakistan’s lottery withholding rule (20–40%) assumes a local payer, so it’s unclear if it applies here — we estimated using the top general income tax rate (35%) instead; the real amount may differ', '巴基斯坦彩票预扣规定（20%~40%）以境内支付方为前提，是否适用尚不明确，故按一般所得税最高档（35%）估算 — 可能与实际不同', 'Quy định khấu trừ xổ số của Pakistan (20–40%) giả định bên chi trả trong nước nên chưa rõ có áp dụng không — chúng tôi ước tính theo thuế suất thu nhập chung cao nhất (35%) thay thế, số tiền thực tế có thể khác', 'กฎการหักภาษี ณ ที่จ่ายลอตเตอรีของปากีสถาน (20–40%) อ้างอิงกรณีผู้จ่ายในประเทศ จึงยังไม่ชัดเจนว่าใช้ได้หรือไม่ เราจึงประมาณด้วยอัตราภาษีเงินได้ทั่วไปสูงสุด (35%) แทน — จำนวนจริงอาจแตกต่างออกไป', 'Пакистанское правило удержания налога с лотереи (20–40%) предполагает местного плательщика, поэтому неясно, применимо ли оно — мы использовали оценку по максимальной обычной ставке подоходного налога (35%); реальная сумма может отличаться')
  },
  kh: {
    title: () => pickLang('캄보디아에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Cambodia? (estimate ⚠️)', '在柬埔寨也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Campuchia nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในกัมพูชาด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Камбодже? (оценка ⚠️)'),
    sub: () => pickLang('개인 복권·상금 소득을 과세하는 명확한 캄보디아 법 조항을 찾지 못해, 추가 세금을 0원으로 가정했어요 — 실제로는 과세될 수도 있어요', 'We couldn’t find a clear Cambodian law provision taxing personal lottery/prize income, so we assumed ₩0 additional tax — you could still owe tax in reality', '未能找到明确对个人彩票、奖金所得征税的柬埔寨法律条款，故假设追加税额为0韩元 — 实际仍可能需要纳税', 'Chúng tôi không tìm thấy quy định rõ ràng trong luật Campuchia đánh thuế thu nhập cá nhân từ xổ số/tiền thưởng, nên giả định thuế bổ sung là 0 won — thực tế bạn vẫn có thể phải đóng thuế', 'เราไม่พบข้อกำหนดที่ชัดเจนในกฎหมายกัมพูชาที่เก็บภาษีรายได้บุคคลจากลอตเตอรี/เงินรางวัล จึงสมมติว่าภาษีเพิ่มเติมเป็น 0 วอน — ในความเป็นจริงคุณอาจยังต้องเสียภาษี', 'Мы не смогли найти чёткого положения в законодательстве Камбоджи, облагающего налогом личный доход от лотереи/приза, поэтому предположили дополнительный налог в 0 вон — на практике налог всё же может взиматься')
  },
  mn: {
    title: () => pickLang('몽골에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Mongolia? (estimate ⚠️)', '在蒙古也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Mông Cổ nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในมองโกเลียด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Монголии? (оценка ⚠️)'),
    sub: () => pickLang('베팅·도박성 당첨금 40% 조항이 있으나 2025년 국내 베팅업 금지 후 적용 여부 불명확해, 그대로 추정 적용했어요 — 실제와 다를 수 있어요', 'There’s a 40% rate for gambling/betting winnings, but it’s unclear whether it still applies after Mongolia’s 2025 domestic betting ban — we used it as an estimate anyway; the real amount may differ', '存在博彩类中奖40%的条款，但蒙古2025年境内禁止博彩业后是否仍适用尚不明确，暂按此估算 — 可能与实际不同', 'Có mức thuế 40% cho tiền thắng cờ bạc/cá cược, nhưng chưa rõ có còn áp dụng sau lệnh cấm cá cược trong nước năm 2025 của Mông Cổ hay không — chúng tôi vẫn dùng làm ước tính, số tiền thực tế có thể khác', 'มีอัตราภาษี 40% สำหรับเงินได้จากการพนัน/พนันขันต่อ แต่ยังไม่ชัดเจนว่ายังใช้ได้หรือไม่หลังมองโกเลียสั่งห้ามพนันในประเทศปี 2025 เราจึงใช้เป็นค่าประมาณ — จำนวนจริงอาจแตกต่างออกไป', 'Есть ставка 40% для выигрышей от азартных игр/ставок, но неясно, применяется ли она после запрета внутреннего игорного бизнеса в Монголии в 2025 году — мы всё же использовали её как оценку; реальная сумма может отличаться')
  },
  la: {
    title: () => pickLang('라오스에서도 또 내요? (추정치 ⚠️)', 'Do I also pay in Laos? (estimate ⚠️)', '在老挝也要交税吗？（估算值⚠️）', 'Có phải đóng thuế ở Lào nữa không? (ước tính ⚠️)', 'ต้องเสียภาษีในลาวด้วยไหม? (ค่าประมาณ ⚠️)', 'Нужно ли платить налог ещё и в Лаосе? (оценка ⚠️)'),
    sub: () => pickLang('2026년 7월 시행된 신설법으로 복권 당첨소득에 5% 세율이 처음 생겼지만, 조세조약이 없어 미국 세금 상계(FTC)가 안 돼요 — 30% 원천징수에 이 5%가 그대로 더해져요', 'A brand-new July 2026 law introduced a 5% rate on lottery winnings for the first time, but since there’s no tax treaty with the US, this 5% cannot be offset (FTC) — it stacks fully on top of the 30% withholding', '2026年7月生效的新法首次对彩票中奖所得设定5%税率，但因无税收协定无法抵免（FTC）——这5%会全额叠加在30%预扣税之上', 'Luật mới có hiệu lực từ tháng 7/2026 lần đầu áp thuế 5% cho tiền thắng xổ số, nhưng do không có hiệp định thuế với Mỹ nên không thể bù trừ (FTC) — mức 5% này cộng dồn đầy đủ lên trên khoản khấu trừ 30%', 'กฎหมายใหม่ที่มีผลตั้งแต่กรกฎาคม 2026 กำหนดอัตราภาษี 5% สำหรับเงินรางวัลลอตเตอรีเป็นครั้งแรก แต่เนื่องจากไม่มีสนธิสัญญาภาษีกับสหรัฐฯ จึงไม่สามารถหักลบได้ (FTC) — 5% นี้จะถูกบวกเพิ่มเต็มจำนวนจากภาษีหัก ณ ที่จ่าย 30%', 'Совершенно новый закон, вступивший в силу в июле 2026 года, впервые ввёл ставку 5% на лотерейный выигрыш, но из-за отсутствия налогового соглашения с США зачесть её (FTC) нельзя — эти 5% добавляются полностью сверх удержания 30%')
  }
};

// FAQ 상단 소개문 — "국세청 상담 기준"이라는 출처 표기가 세금 기준(kr/us/cn)과 무관하게
// 항상 똑같이 나오고 있었음. us/cn 기준 방문자에게는 실제로 확인 근거가 국세청이 아니라
// IRS·중국 국가세무총국 쪽인데 "국세청"이라고만 말하는 건 부정확해서, 기준별로 출처를 다르게 표기함
const FAQ_PANEL_DESC = {
  kr: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 국세청 상담 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Korea’s National Tax Service consultations', '搜索到这里的朋友们经常问的问题 · 已通过韩国国税厅咨询确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên tư vấn của Cơ quan Thuế Hàn Quốc', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามคำปรึกษาของกรมสรรพากรเกาหลี', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе консультаций Налоговой службы Кореи'),
  us: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · IRS 공식 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on official IRS sources', '搜索到这里的朋友们经常问的问题 · 已根据美国国税局（IRS）官方资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn chính thức của IRS', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลทางการของ IRS', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе официальных источников IRS'),
  cn: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 중국 국가세무총국 공고 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on China’s State Taxation Administration notices', '搜索到这里的朋友们经常问的问题 · 已根据中国国家税务总局公告确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên thông báo của Tổng cục Thuế Nhà nước Trung Quốc', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามประกาศของกรมสรรพากรแห่งชาติจีน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе уведомлений Государственного налогового управления Китая'),
  in: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 인도 소득세청 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on India’s Income Tax Department sources', '搜索到这里的朋友们经常问的问题 · 已根据印度所得税局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Thu nhập Ấn Độ', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรอินเดีย', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента подоходного налога Индии'),
  vn: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 베트남 세무총국 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Vietnam’s General Department of Taxation sources', '搜索到这里的朋友们经常问的问题 · 已根据越南税务总局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Tổng cục Thuế Việt Nam', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรทั่วไปเวียดนาม', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Главного налогового управления Вьетнама'),
  id: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 인도네시아 국세청 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Indonesia’s Directorate General of Taxes sources', '搜索到这里的朋友们经常问的问题 · 已根据印尼税务总局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Tổng cục Thuế Indonesia', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรอินโดนีเซีย', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Налогового управления Индонезии'),
  ph: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 필리핀 국세청(BIR) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Philippines Bureau of Internal Revenue sources', '搜索到这里的朋友们经常问的问题 · 已根据菲律宾国税局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Philippines', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรฟิลิปปินส์', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Налогового управления Филиппин'),
  th: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 태국은 해외 복권 세금 기준이 명확하지 않아 추정치예요', 'Common questions from people who searched their way here · ⚠️ Thailand’s rule for foreign lottery tax isn’t clearly confirmed, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 泰国境外彩票税收依据尚不明确，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Quy định thuế xổ số nước ngoài của Thái Lan chưa rõ ràng nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ หลักเกณฑ์ภาษีลอตเตอรีต่างประเทศของไทยยังไม่ชัดเจน ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Правило налога на иностранную лотерею в Таиланде чётко не подтверждено, поэтому цифры являются оценкой'),
  jp: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 일본 국세청(NTA) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Japan’s National Tax Agency sources', '搜索到这里的朋友们经常问的问题 · 已根据日本国税厅资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cơ quan Thuế Quốc gia Nhật Bản', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรแห่งชาติญี่ปุ่น', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Национального налогового управления Японии'),
  ru: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 러시아는 미-러 조세조약 정지로 세액공제 여부가 불확실해요', 'Common questions from people who searched their way here · ⚠️ Russia’s US tax treaty is suspended, so tax-credit eligibility is uncertain', '搜索到这里的朋友们经常问的问题 · ⚠️ 俄美税收协定已暂停，税收抵免是否可用尚不确定', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Hiệp định thuế Nga-Mỹ bị đình chỉ nên chưa chắc chắn về tín dụng thuế', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ สนธิสัญญาภาษีรัสเซีย-สหรัฐฯ ถูกระงับ จึงยังไม่แน่ชัดเรื่องเครดิตภาษี', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Налоговое соглашение России и США приостановлено, поэтому доступность налогового кредита под вопросом'),
  np: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 네팔 국세청(IRD) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Nepal’s Inland Revenue Department sources', '搜索到这里的朋友们经常问的问题 · 已根据尼泊尔国内税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Nepal', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรเนปาล', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента внутренних доходов Непала'),
  lk: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 스리랑카 국세청(IRD) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Sri Lanka’s Inland Revenue Department sources', '搜索到这里的朋友们经常问的问题 · 已根据斯里兰卡国内税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Sri Lanka', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรศรีลังกา', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента внутренних доходов Шри-Ланки'),
  uz: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 우즈베키스탄 국가조세위원회 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Uzbekistan’s State Tax Committee sources', '搜索到这里的朋友们经常问的问题 · 已根据乌兹别克斯坦国家税务委员会资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Ủy ban Thuế Nhà nước Uzbekistan', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของคณะกรรมการภาษีแห่งรัฐอุซเบกิสถาน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Государственного налогового комитета Узбекистана'),
  kz: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 카자흐스탄 국가세입위원회 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Kazakhstan’s Committee of State Revenues sources', '搜索到这里的朋友们经常问的问题 · 已根据哈萨克斯坦国家税收委员会资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Ủy ban Thu ngân sách Nhà nước Kazakhstan', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของคณะกรรมการรายได้แห่งรัฐคาซัคสถาน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Комитета государственных доходов Казахстана'),
  kg: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 키르기스스탄 국가조세청 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Kyrgyzstan’s State Tax Service sources', '搜索到这里的朋友们经常问的问题 · 已根据吉尔吉斯斯坦国家税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cơ quan Thuế Nhà nước Kyrgyzstan', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรแห่งรัฐคีร์กีซสถาน', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Государственной налоговой службы Кыргызстана'),
  mm: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 미얀마 내국세청(IRD) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Myanmar’s Internal Revenue Department sources', '搜索到这里的朋友们经常问的问题 · 已根据缅甸内税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Cục Thuế Nội địa Myanmar', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของกรมสรรพากรภายในเมียนมา', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Департамента внутренних доходов Мьянмы'),
  bd: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 방글라데시 국세청(NBR) 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Bangladesh’s National Board of Revenue sources', '搜索到这里的朋友们经常问的问题 · 已根据孟加拉国国家税务局资料确认', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · Đã xác nhận dựa trên nguồn của Ủy ban Thuế Quốc gia Bangladesh', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ยืนยันข้อมูลตามแหล่งข้อมูลของคณะกรรมการรายได้แห่งชาติบังกลาเทศ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · Подтверждено на основе источников Национального совета по доходам Бангладеш'),
  pk: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 파키스탄은 규정 적용 여부가 불명확해 추정치예요', 'Common questions from people who searched their way here · ⚠️ Pakistan’s applicable rule is unclear, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 巴基斯坦适用规定不明确，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Quy định áp dụng của Pakistan chưa rõ ràng nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ กฎที่ใช้บังคับของปากีสถานยังไม่ชัดเจน ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Применимое правило Пакистана неясно, поэтому цифры являются оценкой'),
  kh: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 캄보디아는 관련 법 조항을 찾지 못해 추정치예요', 'Common questions from people who searched their way here · ⚠️ We couldn’t find a Cambodian law provision on point, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 未找到相关柬埔寨法律条款，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Chúng tôi không tìm thấy quy định luật Campuchia liên quan nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ ไม่พบข้อกำหนดกฎหมายกัมพูชาที่เกี่ยวข้อง ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Мы не нашли соответствующего положения в законодательстве Камбоджи, поэтому цифры являются оценкой'),
  mn: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 몽골은 2025년 베팅업 금지 후 적용 여부가 불명확해 추정치예요', 'Common questions from people who searched their way here · ⚠️ It’s unclear whether Mongolia’s rule still applies after its 2025 betting ban, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 蒙古2025年禁止博彩业后适用性不明确，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Chưa rõ quy định của Mông Cổ có còn áp dụng sau lệnh cấm cá cược 2025 hay không nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ ยังไม่ชัดเจนว่ากฎของมองโกเลียยังใช้ได้หรือไม่หลังห้ามพนันปี 2025 ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Неясно, действует ли ещё правило Монголии после запрета ставок в 2025 году, поэтому цифры являются оценкой'),
  la: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · ⚠️ 라오스는 법이 시행된 지 얼마 안 돼 추정치예요', 'Common questions from people who searched their way here · ⚠️ Laos’s law is very new, so figures are estimates', '搜索到这里的朋友们经常问的问题 · ⚠️ 老挝法律施行不久，以下为估算值', 'Tổng hợp các câu hỏi thường gặp từ người tìm kiếm đến đây · ⚠️ Luật của Lào vừa có hiệu lực nên đây là ước tính', 'รวบรวมคำถามที่คนค้นหามาถึงที่นี่มักถาม · ⚠️ กฎหมายของลาวเพิ่งมีผลบังคับใช้ ตัวเลขนี้เป็นค่าประมาณ', 'Часто задаваемые вопросы от тех, кто искал этот сайт · ⚠️ Закон Лаоса вступил в силу совсем недавно, поэтому цифры являются оценкой')
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
  subEl.textContent = entry.sub();
}

const DREAM_DATA = {
  freedom: {
    emoji: '🕊️',
    title: '자유의 몸', desc: '월요일 아침이 더 이상 두렵지 않은 삶. 사표는 이미 냈어요.',
    titleEn: 'Free at last', descEn: 'Monday mornings don\u2019t scare you anymore. You already handed in your resignation.',
    titleZh: '自由之身', descZh: '不再害怕星期一早晨的生活。辞职信已经交了。',
    titleVi: 'Cuối cùng cũng tự do', descVi: 'Sáng thứ Hai không còn đáng sợ nữa. Bạn đã nộp đơn xin nghỉ việc rồi.',
    titleTh: 'อิสระในที่สุด', descTh: 'เช้าวันจันทร์ไม่น่ากลัวอีกต่อไป คุณยื่นใบลาออกไปแล้ว',
    titleRu: 'Наконец-то свободен', descRu: 'Утро понедельника больше не пугает. Заявление об увольнении уже подано.'
  },
  family:  {
    emoji: '🏠',
    title: '가족 부동산왕', desc: '온 가족이 집 걱정 없이 사는 명절, 그 주인공이 바로 나예요.',
    titleEn: 'Family real-estate mogul', descEn: 'The whole family lives worry-free about housing \u2014 and you\u2019re the reason why.',
    titleZh: '家族房产大亨', descZh: '全家人过节不再为住房发愁，而这一切都是因为你。',
    titleVi: 'Ông trùm bất động sản gia đình', descVi: 'Cả gia đình sống không lo về nhà cửa \u2014 và bạn chính là lý do.',
    titleTh: 'เจ้าพ่ออสังหาริมทรัพย์ของครอบครัว', descTh: 'ทั้งครอบครัวอยู่อย่างไม่ต้องกังวลเรื่องที่อยู่อาศัย \u2014 และคุณคือเหตุผล',
    titleRu: 'Магнат недвижимости для семьи', descRu: 'Вся семья живёт без забот о жилье \u2014 и всё это благодаря вам.'
  },
  travel:  {
    emoji: '✈️',
    title: '지구 한 바퀴 클럽', desc: '여권에 도장이 모자랄 지경이에요. 다음 목적지는 어디로 갈까요?',
    titleEn: 'Around-the-world club', descEn: 'Your passport is running out of pages for stamps. Where\u2019s next?',
    titleZh: '环游世界俱乐部', descZh: '护照上的印章都快盖不下了。下一站去哪里呢？',
    titleVi: 'Câu lạc bộ vòng quanh thế giới', descVi: 'Hộ chiếu của bạn sắp hết trang để đóng dấu. Điểm đến tiếp theo là đâu?',
    titleTh: 'คลับรอบโลก', descTh: 'พาสปอร์ตของคุณหน้ากระดาษไม่พอประทับตราแล้ว จุดหมายต่อไปคือที่ไหน?',
    titleRu: 'Клуб кругосветных путешественников', descRu: 'В паспорте почти не осталось места для штампов. Куда дальше?'
  },
  calm:    {
    emoji: '💼',
    title: '현실주의자', desc: '화려하게 안 살아도 괜찮아요. 잔고만 봐도 웃음이 나요.',
    titleEn: 'The realist', descEn: 'No need for a flashy lifestyle \u2014 just checking your balance makes you smile.',
    titleZh: '现实主义者', descZh: '不用活得多风光也没关系。光是看着余额就会笑出来。',
    titleVi: 'Người thực tế', descVi: 'Không cần lối sống hào nhoáng \u2014 chỉ cần xem số dư tài khoản cũng đủ khiến bạn mỉm cười.',
    titleTh: 'นักสัจนิยม', descTh: 'ไม่จำเป็นต้องใช้ชีวิตหรูหรา \u2014 แค่เช็คยอดเงินก็ยิ้มได้แล้ว',
    titleRu: 'Реалист', descRu: 'Не нужен showy образ жизни \u2014 достаточно проверить баланс, чтобы улыбнуться.'
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
  document.getElementById('dream-title').textContent = data.emoji + ' ' + pickLang(data.title, data.titleEn, data.titleZh, data.titleVi, data.titleTh, data.titleRu);
  document.getElementById('dream-desc').textContent = pickLang(data.desc, data.descEn, data.descZh, data.descVi, data.descTh, data.descRu);
  document.getElementById('dream-amt').textContent = pickLang(finalAmt + '의 주인공', `The one taking home ${finalAmt}`, `坐拥${finalAmt}的人`, `Người sở hữu ${finalAmt}`, `เจ้าของเงิน ${finalAmt}`, `Обладатель ${finalAmt}`);
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
    `Я [${title}]! ${amt}. Что бы вы сделали в первую очередь, если бы выиграли?`
  );
  const shareUrl = location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: pickLang('당첨되면 나는?', 'What would I do if I won?', '如果中奖了，我会……', 'Nếu trúng số tôi sẽ?', 'ถ้าถูกรางวัลฉันจะ?', 'Что бы я сделал, если бы выиграл?'), text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    alert(pickLang('복사됐어요! 카톡에 붙여넣기 해보세요 :)', 'Copied! Paste it anywhere you like :)', '已复制！粘贴到任何地方分享吧 :)', 'Đã sao chép! Dán vào bất cứ đâu bạn muốn :)', 'คัดลอกแล้ว! วางที่ไหนก็ได้ที่คุณต้องการ :)', 'Скопировано! Вставьте куда угодно :)'));
  } catch (e) {
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享', 'Nhấn giữ để sao chép rồi chia sẻ', 'กดค้างเพื่อคัดลอกแล้วแชร์', 'Нажмите и удерживайте, чтобы скопировать, затем поделитесь'), `${shareText} ${shareUrl}`);
  }
}

async function shareResult(){
  const amountText = document.getElementById('homeAmountInput').value || '100';
  const finalAmt = document.getElementById('home-final-amt').textContent;
  const homeCountryVal = document.getElementById('homeCountrySelect').value;
  const country = homeCountryVal === 'us'
    ? pickLang('미국 거주자', 'US resident', '美国居民', 'Cư dân Mỹ', 'ผู้พำนักในสหรัฐฯ', 'Резидент США')
    : homeCountryVal === 'cn'
    ? pickLang('중국 거주자', 'China resident', '中国居民', 'Cư dân Trung Quốc', 'ผู้พำนักในจีน', 'Резидент Китая')
    : homeCountryVal === 'in'
    ? pickLang('인도 거주자', 'India resident', '印度居民', 'Cư dân Ấn Độ', 'ผู้พำนักในอินเดีย', 'Резидент Индии')
    : pickLang('한국 거주자', 'Korea resident', '韩国居民', 'Cư dân Hàn Quốc', 'ผู้พำนักในเกาหลี', 'Резидент Кореи');
  const article = homeCountryVal === 'in' ? 'an' : 'a'; // "an India resident" vs "a US/China/Korea resident"
  const shareText = pickLang(
    `미국 복권(${amountText} Million USD) 당첨되면 ${country} 기준 실수령액이 약 ${finalAmt}이래요. 세금 떼고 나면 실제로 얼마 남는지 참택스에서 계산해보세요! (참고용 시뮬레이션 결과예요)`,
    `If I won the US lottery (${amountText} Million USD), my take-home as ${article} ${country} would be about ${finalAmt}. See how much you'd actually keep after tax on ChamTax! (This is a reference simulation)`,
    `如果中了美国彩票（${amountText} Million USD），按${country}计算实得金额大约是${finalAmt}。来ChamTax算算你扣税后实际能拿到多少吧！（仅供参考的模拟计算）`,
    `Nếu trúng xổ số Mỹ (${amountText} Million USD), số tiền thực nhận theo ${country} sẽ khoảng ${finalAmt}. Xem bạn thực sự giữ lại bao nhiêu sau thuế trên ChamTax! (Đây là kết quả mô phỏng tham khảo)`,
    `ถ้าถูกลอตเตอรีสหรัฐฯ (${amountText} Million USD) เงินที่ได้รับจริงตาม${country}จะอยู่ที่ประมาณ ${finalAmt} ลองดูว่าคุณจะเหลือเงินจริงเท่าไหร่หลังหักภาษีที่ ChamTax! (นี่เป็นผลจำลองเพื่ออ้างอิง)`,
    `Если бы я выиграл в американскую лотерею (${amountText} Million USD), моя сумма на руки как ${country} составила бы около ${finalAmt}. Узнайте, сколько реально останется после налогов на ChamTax! (Это справочное моделирование)`
  );
  const shareUrl = location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: pickLang('미국 복권 세금 계산기 - 참택스', 'US Lottery Tax Calculator - ChamTax', '美国彩票税金计算器 - ChamTax', 'Máy tính thuế xổ số Mỹ - ChamTax', 'เครื่องคำนวณภาษีลอตเตอรีสหรัฐฯ - ChamTax', 'Калькулятор налога на американскую лотерею - ChamTax'), text: shareText, url: shareUrl });
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
      btn.textContent = pickLang('✅ 링크가 복사됐어요', '✅ Link copied', '✅ 链接已复制', '✅ Đã sao chép liên kết', '✅ คัดลอกลิงก์แล้ว', '✅ Ссылка скопирована');
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    // 클립보드 API까지 막힌 환경(카카오톡 등 인앱 브라우저 등) — 사용자가 직접 보고 복사할 수 있게 표시
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享', 'Nhấn giữ để sao chép rồi chia sẻ', 'กดค้างเพื่อคัดลอกแล้วแชร์', 'Нажмите и удерживайте, чтобы скопировать, затем поделитесь'), `${shareText} ${shareUrl}`);
  }
}

async function shareRefundChecklist(){
  const shareText = pickLang(
    '나도 모르게 못 받은 돈이 있는지 체크리스트로 확인해봐요. 국세환급금만 매년 수천억 원대가 안 찾아가서 사라진대요 (5년 지나면 국고로 귀속). 참택스 FAQ에서 10분이면 확인 끝나요!',
    'I checked whether I had unclaimed money using this checklist. Apparently hundreds of billions of won in unclaimed tax refunds go unclaimed every year in Korea (reverts to the treasury after 5 years). Takes 10 minutes to check on the ChamTax FAQ!',
    '我用这个清单确认了自己是否有不知道的未领取的钱。据说韩国每年都有数百亿韩元的税款没人领取（5年后归国库）。在ChamTax的FAQ里10分钟就能确认完！',
    'Tôi đã kiểm tra xem mình có khoản tiền chưa nhận nào không bằng danh sách này. Ở Hàn Quốc, mỗi năm có hàng trăm tỷ won tiền hoàn thuế không ai nhận (sẽ thuộc về ngân khố sau 5 năm). Chỉ mất 10 phút để kiểm tra trên FAQ của ChamTax!',
    'ฉันตรวจสอบว่ามีเงินที่ไม่รู้ว่ายังไม่ได้รับหรือไม่ด้วยเช็คลิสต์นี้ ในเกาหลีมีเงินคืนภาษีหลายแสนล้านวอนที่ไม่มีใครมารับทุกปี (จะตกเป็นของคลังหลัง 5 ปี) ใช้เวลาแค่ 10 นาทีในการตรวจสอบที่ FAQ ของ ChamTax!',
    'Я проверил, есть ли у меня невостребованные деньги, с помощью этого чек-листа. В Корее ежегодно остаются невостребованными сотни миллиардов вон возврата налогов (переходят в казну через 5 лет). Проверка на FAQ ChamTax занимает всего 10 минут!'
  );
  const shareUrl = location.href;
  const btn = document.getElementById('refund-share-btn');

  if (navigator.share) {
    try {
      await navigator.share({ title: pickLang(
        '나도 모르는 잠자는 내 돈 찾기 체크리스트',
        'Find money you didn’t know you had — checklist',
        '找出你不知道的沉睡资产 — 检查清单',
        'Danh sách tìm tiền bạn không biết mình có',
        'เช็คลิสต์ค้นหาเงินที่คุณไม่รู้ว่ามี',
        'Чек-лист: найдите деньги, о которых не знали'
      ), text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = pickLang('✅ 링크가 복사됐어요', '✅ Link copied', '✅ 链接已复制', '✅ Đã sao chép liên kết', '✅ คัดลอกลิงก์แล้ว', '✅ Ссылка скопирована');
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
      'Нажмите и удерживайте, чтобы скопировать, затем поделитесь'
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
  cn: () => pickLang('중국 국가세무총국·IRS', 'China State Taxation Administration/IRS', '中国国家税务总局·IRS', 'Tổng cục Thuế Nhà nước Trung Quốc·IRS', 'กรมสรรพากรแห่งชาติจีน·IRS', 'Государственное налоговое управление Китая·IRS'),
  in: () => pickLang('인도 소득세청·IRS', 'India Income Tax Department/IRS', '印度所得税局·IRS', 'Cục Thuế Thu nhập Ấn Độ·IRS', 'กรมสรรพากรอินเดีย·IRS', 'Департамент подоходного налога Индии·IRS'),
  vn: () => pickLang('베트남 세무총국·IRS', 'Vietnam General Department of Taxation/IRS', '越南税务总局·IRS', 'Tổng cục Thuế Việt Nam·IRS', 'กรมสรรพากรทั่วไปเวียดนาม·IRS', 'Главное налоговое управление Вьетнама·IRS'),
  id: () => pickLang('인도네시아 국세청(DJP)·IRS', 'Indonesia Directorate General of Taxes/IRS', '印尼税务总局·IRS', 'Tổng cục Thuế Indonesia·IRS', 'กรมสรรพากรอินโดนีเซีย·IRS', 'Налоговое управление Индонезии·IRS'),
  ph: () => pickLang('필리핀 국세청(BIR)·IRS', 'Philippines Bureau of Internal Revenue/IRS', '菲律宾国税局·IRS', 'Cục Thuế Nội địa Philippines·IRS', 'กรมสรรพากรฟิลิปปินส์·IRS', 'Налоговое управление Филиппин·IRS'),
  th: () => pickLang('태국 국세청 자료 기준 추정치·IRS ⚠️', 'Estimate based on Thailand Revenue Department data/IRS ⚠️', '基于泰国税务厅资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu Cục Thuế Thái Lan·IRS ⚠️', 'ค่าประมาณจากข้อมูลกรมสรรพากรไทย·IRS ⚠️', 'Оценка на основе данных налогового управления Таиланда·IRS ⚠️'),
  jp: () => pickLang('일본 국세청(NTA)·IRS', 'Japan National Tax Agency (NTA)/IRS', '日本国税厅·IRS', 'Cơ quan Thuế Quốc gia Nhật Bản (NTA)·IRS', 'กรมสรรพากรแห่งชาติญี่ปุ่น (NTA)·IRS', 'Национальное налоговое управление Японии (NTA)·IRS'),
  ru: () => pickLang('러시아 연방국세청(ФНС)·IRS ⚠️', 'Russia Federal Tax Service (FNS)/IRS ⚠️', '俄罗斯联邦税务局·IRS ⚠️', 'Cơ quan Thuế Liên bang Nga (FNS)·IRS ⚠️', 'กรมสรรพากรกลางรัสเซีย (FNS)·IRS ⚠️', 'Федеральная налоговая служба России (ФНС)·IRS ⚠️'),
  np: () => pickLang('네팔 국세청(IRD)·IRS', 'Nepal Inland Revenue Department (IRD)/IRS', '尼泊尔国内税务局·IRS', 'Cục Thuế Nội địa Nepal (IRD)·IRS', 'กรมสรรพากรเนปาล (IRD)·IRS', 'Департамент внутренних доходов Непала (IRD)·IRS'),
  lk: () => pickLang('스리랑카 국세청(IRD)·IRS', 'Sri Lanka Inland Revenue Department (IRD)/IRS', '斯里兰卡国内税务局·IRS', 'Cục Thuế Nội địa Sri Lanka (IRD)·IRS', 'กรมสรรพากรศรีลังกา (IRD)·IRS', 'Департамент внутренних доходов Шри-Ланки (IRD)·IRS'),
  uz: () => pickLang('우즈베키스탄 국가조세위원회·IRS', 'Uzbekistan State Tax Committee/IRS', '乌兹别克斯坦国家税务委员会·IRS', 'Ủy ban Thuế Nhà nước Uzbekistan·IRS', 'คณะกรรมการภาษีแห่งรัฐอุซเบกิสถาน·IRS', 'Государственный налоговый комитет Узбекистана·IRS'),
  kz: () => pickLang('카자흐스탄 국가세입위원회·IRS', 'Kazakhstan Committee of State Revenues/IRS', '哈萨克斯坦国家税收委员会·IRS', 'Ủy ban Thu ngân sách Nhà nước Kazakhstan·IRS', 'คณะกรรมการรายได้แห่งรัฐคาซัคสถาน·IRS', 'Комитет государственных доходов Казахстана·IRS'),
  kg: () => pickLang('키르기스스탄 국가조세청·IRS', 'Kyrgyzstan State Tax Service/IRS', '吉尔吉斯斯坦国家税务局·IRS', 'Cơ quan Thuế Nhà nước Kyrgyzstan·IRS', 'กรมสรรพากรแห่งรัฐคีร์กีซสถาน·IRS', 'Государственная налоговая служба Кыргызстана·IRS'),
  mm: () => pickLang('미얀마 내국세청(IRD)·IRS', 'Myanmar Internal Revenue Department (IRD)/IRS', '缅甸内税务局·IRS', 'Cục Thuế Nội địa Myanmar (IRD)·IRS', 'กรมสรรพากรภายในเมียนมา (IRD)·IRS', 'Департамент внутренних доходов Мьянмы (IRD)·IRS'),
  bd: () => pickLang('방글라데시 국세청(NBR)·IRS', 'Bangladesh National Board of Revenue (NBR)/IRS', '孟加拉国国家税务局·IRS', 'Ủy ban Thuế Quốc gia Bangladesh (NBR)·IRS', 'คณะกรรมการรายได้แห่งชาติบังกลาเทศ (NBR)·IRS', 'Национальный совет по доходам Бангладеш (NBR)·IRS'),
  pk: () => pickLang('파키스탄 연방국세청(FBR) 자료 기준 추정치·IRS ⚠️', 'Estimate based on Pakistan FBR data/IRS ⚠️', '基于巴基斯坦联邦税务局资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu FBR Pakistan·IRS ⚠️', 'ค่าประมาณจากข้อมูล FBR ปากีสถาน·IRS ⚠️', 'Оценка на основе данных FBR Пакистана·IRS ⚠️'),
  kh: () => pickLang('캄보디아 국세청(GDT) 자료 기준 추정치·IRS ⚠️', 'Estimate based on Cambodia GDT data/IRS ⚠️', '基于柬埔寨税务总局资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu GDT Campuchia·IRS ⚠️', 'ค่าประมาณจากข้อมูล GDT กัมพูชา·IRS ⚠️', 'Оценка на основе данных GDT Камбоджи·IRS ⚠️'),
  mn: () => pickLang('몽골 국세청 자료 기준 추정치·IRS ⚠️', 'Estimate based on Mongolia Tax Administration data/IRS ⚠️', '基于蒙古税务局资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu Cơ quan Thuế Mông Cổ·IRS ⚠️', 'ค่าประมาณจากข้อมูลกรมสรรพากรมองโกเลีย·IRS ⚠️', 'Оценка на основе данных налогового управления Монголии·IRS ⚠️'),
  la: () => pickLang('라오스 재정부 자료 기준 추정치·IRS ⚠️', 'Estimate based on Laos Ministry of Finance data/IRS ⚠️', '基于老挝财政部资料估算·IRS ⚠️', 'Ước tính dựa trên dữ liệu Bộ Tài chính Lào·IRS ⚠️', 'ค่าประมาณจากข้อมูลกระทรวงการคลังลาว·IRS ⚠️', 'Оценка на основе данных Министерства финансов Лаоса·IRS ⚠️'),
  kr: () => pickLang('국세청·IRS', 'IRS/NTS', 'IRS·韩国国税厅', 'Cơ quan Thuế Hàn Quốc·IRS', 'กรมสรรพากรเกาหลี·IRS', 'Налоговая служба Кореи·IRS'),
  us: () => pickLang('IRS', 'IRS', 'IRS', 'IRS', 'IRS', 'IRS')
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
    '⚠️ Мы не смогли найти чёткого официального правила о том, как Таиланд облагает налогом иностранные лотерейные выигрыши. Показанный здесь налог — это оценка на основе максимальной ставки подоходного налога Таиланда (35%), которая может отличаться от реальной суммы. Уточните точную сумму в налоговом управлении Таиланда или у налогового специалиста.'
  ),
  ru: () => pickLang(
    '⚠️ 러시아는 2023년에 미국과의 조세조약 핵심 조항(이중과세 조정 포함)의 효력을 정지시켰어요. 세율(22%) 자체는 확인된 정보지만, 미국에서 이미 낸 세금을 러시아 세금에서 빼주는 게 지금도 되는지는 불확실해요 — 최악의 경우 여기 나온 것보다 세금을 더 낼 수도 있어요. 정확한 처리는 러시아 세무 전문가에게 확인하세요.',
    '⚠️ In 2023, Russia suspended key parts of its US tax treaty (including double-taxation relief). The 22% rate itself is well documented, but whether tax already paid in the US can still offset Russian tax is uncertain — in the worst case you could owe more than shown here. Please confirm the details with a Russian tax professional.',
    '⚠️ 俄罗斯于2023年暂停了与美国税收协定核心条款（含避免双重征税条款）的效力。22%这个税率本身有据可查，但已在美国缴纳的税款能否抵免俄罗斯税额尚不确定——最坏情况下实际要交的税可能比这里显示的更多。请务必向俄罗斯税务专家确认。',
    '⚠️ Năm 2023, Nga đã đình chỉ các điều khoản cốt lõi trong hiệp định thuế với Mỹ (bao gồm điều khoản tránh đánh thuế hai lần). Mức thuế 22% được xác nhận rõ ràng, nhưng liệu thuế đã nộp ở Mỹ có còn được khấu trừ vào thuế Nga hay không thì chưa chắc chắn — trường hợp xấu nhất bạn có thể phải nộp nhiều hơn số hiển thị ở đây. Vui lòng xác nhận với chuyên gia thuế Nga.',
    '⚠️ ในปี 2023 รัสเซียได้ระงับข้อกำหนดหลักของสนธิสัญญาภาษีกับสหรัฐฯ (รวมถึงข้อกำหนดป้องกันการเก็บภาษีซ้อน) อัตราภาษี 22% นี้มีข้อมูลยืนยันชัดเจน แต่ยังไม่แน่ชัดว่าภาษีที่จ่ายในสหรัฐฯ แล้วจะยังนำมาหักลบภาษีรัสเซียได้หรือไม่ — กรณีเลวร้ายที่สุดคุณอาจต้องจ่ายภาษีมากกว่าที่แสดงไว้นี้ กรุณายืนยันกับผู้เชี่ยวชาญด้านภาษีของรัสเซีย',
    '⚠️ В 2023 году Россия приостановила действие ключевых положений налогового соглашения с США (включая устранение двойного налогообложения). Сама ставка 22% хорошо подтверждена, но неясно, можно ли по-прежнему зачесть уже уплаченный в США налог в счёт российского — в худшем случае налог может оказаться выше показанного здесь. Уточните детали у российского налогового специалиста.'
  ),
  pk: () => pickLang(
    '⚠️ 파키스탄은 복권 당첨금에 대한 법(20~40%)이 있지만, 이건 파키스탄 안에서 지급하는 경우를 전제로 한 규정이라 미국에서 직접 받는 당첨금에도 그대로 적용되는지 명확하지 않아요. 여기 나온 세금은 일반 소득세 최고세율(35%)로 추정한 참고치예요. 정확한 처리는 파키스탄 국세청(FBR)이나 세무 전문가에게 확인하세요.',
    '⚠️ Pakistan has a specific law for lottery prizes (20–40%), but it assumes the payer is based in Pakistan, so it’s unclear whether it applies to winnings paid directly from the US. The tax shown here is an estimate based on the top general income tax rate (35%). Please confirm with Pakistan’s Federal Board of Revenue (FBR) or a tax professional.',
    '⚠️ 巴基斯坦对彩票奖金有专门规定（20%~40%），但该规定以巴基斯坦境内支付方为前提，是否适用于从美国直接领取的奖金尚不明确。这里显示的税额是按一般所得税最高税率（35%）估算的参考值。请务必向巴基斯坦联邦税务局（FBR）或税务专家确认。',
    '⚠️ Pakistan có luật riêng cho tiền thưởng xổ số (20–40%), nhưng luật này giả định bên chi trả ở Pakistan, nên chưa rõ có áp dụng cho tiền thắng nhận trực tiếp từ Mỹ hay không. Số thuế hiển thị ở đây là ước tính theo thuế suất thu nhập chung cao nhất (35%). Vui lòng xác nhận với Cục Thuế Liên bang Pakistan (FBR) hoặc chuyên gia thuế.',
    '⚠️ ปากีสถานมีกฎหมายเฉพาะสำหรับเงินรางวัลลอตเตอรี (20–40%) แต่กฎหมายนี้อ้างอิงกรณีผู้จ่ายอยู่ในปากีสถาน จึงยังไม่ชัดเจนว่าจะใช้กับเงินรางวัลที่ได้รับโดยตรงจากสหรัฐฯ หรือไม่ ภาษีที่แสดงนี้เป็นค่าประมาณจากอัตราภาษีเงินได้ทั่วไปสูงสุด (35%) กรุณายืนยันกับคณะกรรมการรายได้กลางปากีสถาน (FBR) หรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ В Пакистане есть отдельный закон о лотерейных призах (20–40%), но он рассчитан на случай, когда плательщик находится в Пакистане, поэтому неясно, применяется ли он к выигрышу, полученному напрямую из США. Показанный здесь налог — оценка по максимальной обычной ставке подоходного налога (35%). Уточните детали в Федеральном налоговом управлении Пакистана (FBR) или у налогового специалиста.'
  ),
  kh: () => pickLang(
    '⚠️ 캄보디아 세법에서는 복권 당첨 같은 개인 소득에 매기는 명확한 조항을 찾지 못했어요. 그래서 이 계산기는 캄보디아 추가 세금을 0원으로 가정하고 있는데, 실제로는 세금이 부과될 수도 있어요. 정확한 처리는 캄보디아 국세청(GDT)이나 세무 전문가에게 반드시 확인하세요.',
    '⚠️ We couldn’t find a clear provision in Cambodian tax law covering personal windfall income like lottery winnings. This calculator therefore assumes ₩0 additional Cambodian tax, but you could still owe tax in reality. Please confirm with Cambodia’s General Department of Taxation (GDT) or a tax professional.',
    '⚠️ 未能在柬埔寨税法中找到针对彩票中奖等个人意外所得的明确条款。因此本计算器暂按柬埔寨追加税额为0韩元计算，但实际仍可能需要纳税。请务必向柬埔寨税务总局（GDT）或税务专家确认。',
    '⚠️ Chúng tôi không tìm thấy quy định rõ ràng trong luật thuế Campuchia về thu nhập bất ngờ cá nhân như trúng số. Vì vậy máy tính này giả định thuế bổ sung tại Campuchia là 0 won, nhưng thực tế bạn vẫn có thể phải đóng thuế. Vui lòng xác nhận với Tổng cục Thuế Campuchia (GDT) hoặc chuyên gia thuế.',
    '⚠️ เราไม่พบข้อกำหนดที่ชัดเจนในกฎหมายภาษีกัมพูชาเกี่ยวกับรายได้ที่ไม่คาดคิดส่วนบุคคล เช่น เงินรางวัลลอตเตอรี เครื่องคำนวณนี้จึงสมมติว่าภาษีเพิ่มเติมของกัมพูชาเป็น 0 วอน แต่ในความเป็นจริงคุณอาจยังต้องเสียภาษี กรุณายืนยันกับกรมสรรพากรกัมพูชา (GDT) หรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ Мы не смогли найти в налоговом законодательстве Камбоджи чёткого положения о случайном личном доходе, например, о лотерейном выигрыше. Поэтому калькулятор считает дополнительный камбоджийский налог равным 0 вон, но на практике налог всё же может взиматься. Уточните детали в Генеральном департаменте налогообложения Камбоджи (GDT) или у налогового специалиста.'
  ),
  mn: () => pickLang(
    '⚠️ 몽골법에는 도박·베팅성 당첨소득에 40% 세율을 매기는 조항이 있지만, 2025년에 몽골 내 베팅·도박 사업 자체가 금지되면서 이 조항이 해외 정식 복권 당첨금에도 그대로 적용되는지는 불확실해요. 여기 나온 세금은 이 40% 조항 기준으로 추정한 참고치예요. 정확한 처리는 몽골 국세청이나 세무 전문가에게 확인하세요.',
    '⚠️ Mongolian law has a 40% rate for gambling/betting winnings, but since Mongolia banned domestic betting/gambling businesses in 2025, it’s unclear whether this still applies to a legitimate foreign lottery prize. The tax shown here is an estimate based on that 40% provision. Please confirm with Mongolia’s Tax Administration or a tax professional.',
    '⚠️ 蒙古法律对博彩类中奖所得规定了40%的税率，但由于蒙古在2025年禁止了境内博彩业务，该条款是否仍适用于境外正规彩票奖金尚不明确。这里显示的税额是按该40%条款估算的参考值。请务必向蒙古税务局或税务专家确认。',
    '⚠️ Luật Mông Cổ có mức thuế 40% cho tiền thắng từ cờ bạc/cá cược, nhưng do Mông Cổ đã cấm hoạt động cá cược/cờ bạc trong nước từ năm 2025, chưa rõ quy định này có còn áp dụng cho tiền thưởng xổ số nước ngoài hợp pháp hay không. Số thuế hiển thị ở đây là ước tính theo mức 40% đó. Vui lòng xác nhận với Cơ quan Thuế Mông Cổ hoặc chuyên gia thuế.',
    '⚠️ กฎหมายมองโกเลียมีอัตราภาษี 40% สำหรับเงินได้จากการพนัน/พนันขันต่อ แต่เนื่องจากมองโกเลียสั่งห้ามธุรกิจพนันในประเทศตั้งแต่ปี 2025 จึงยังไม่ชัดเจนว่าข้อกำหนดนี้ยังใช้กับเงินรางวัลลอตเตอรีต่างประเทศที่ถูกต้องตามกฎหมายหรือไม่ ภาษีที่แสดงนี้เป็นค่าประมาณจากข้อกำหนด 40% ดังกล่าว กรุณายืนยันกับกรมสรรพากรมองโกเลียหรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ В законодательстве Монголии есть ставка 40% для выигрышей от азартных игр/ставок, но поскольку в 2025 году Монголия запретила внутренний игорный бизнес, неясно, применяется ли это положение к легальному иностранному лотерейному призу. Показанный здесь налог — оценка по этой ставке 40%. Уточните детали в налоговом управлении Монголии или у налогового специалиста.'
  ),
  la: () => pickLang(
    '⚠️ 라오스는 2026년 7월부터 시행된 아주 새로운 법(5%)으로 복권 당첨소득을 처음 과세하기 시작했어요. 법이 너무 최근에 생겨서 실제 적용 사례가 아직 없고, 미국에서 낸 세금을 빼주는 조세조약도 없어서 미국 원천징수(30%)에 이 5%가 그대로 더해질 가능성이 높아요. 정확한 처리는 라오스 재정부나 세무 전문가에게 확인하세요.',
    '⚠️ Laos only just began taxing lottery-type winnings (5%) under a brand-new law that took effect in July 2026 — too recent for any real enforcement track record. Laos also has no tax treaty with the US, so this 5% likely stacks fully on top of the US withholding (30%) rather than being offset. Please confirm with Laos’s Ministry of Finance or a tax professional.',
    '⚠️ 老挝根据2026年7月才刚生效的全新法律（5%）首次对彩票类中奖所得征税——法律施行时间太短，尚无实际执行案例。老挝与美国也没有税收协定，因此这5%很可能会在美国预扣税（30%）之外全额叠加，而不是抵免。请务必向老挝财政部或税务专家确认。',
    '⚠️ Lào chỉ mới bắt đầu đánh thuế tiền thắng dạng xổ số (5%) theo luật hoàn toàn mới có hiệu lực từ tháng 7/2026 — quá gần đây để có tiền lệ thực thi. Lào cũng không có hiệp định thuế với Mỹ, nên mức 5% này nhiều khả năng cộng dồn đầy đủ lên trên khoản khấu trừ của Mỹ (30%) thay vì được khấu trừ. Vui lòng xác nhận với Bộ Tài chính Lào hoặc chuyên gia thuế.',
    '⚠️ ลาวเพิ่งเริ่มเก็บภาษีเงินรางวัลประเภทลอตเตอรี (5%) ตามกฎหมายใหม่ล่าสุดที่มีผลบังคับใช้ตั้งแต่กรกฎาคม 2026 — ใหม่เกินกว่าจะมีแนวปฏิบัติจริง ลาวยังไม่มีสนธิสัญญาภาษีกับสหรัฐฯ ด้วย จึงมีแนวโน้มว่า 5% นี้จะถูกบวกเพิ่มเต็มจำนวนจากภาษีหัก ณ ที่จ่ายของสหรัฐฯ (30%) แทนที่จะหักลบกัน กรุณายืนยันกับกระทรวงการคลังลาวหรือผู้เชี่ยวชาญด้านภาษี',
    '⚠️ Лаос только начал облагать налогом лотерейные выигрыши (5%) по совершенно новому закону, вступившему в силу в июле 2026 года — слишком недавно, чтобы была практика применения. У Лаоса также нет налогового соглашения с США, поэтому эти 5%, скорее всего, добавятся сверх удержания США (30%) полностью, без зачёта. Уточните детали в Министерстве финансов Лаоса или у налогового специалиста.'
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
          `На основе официальных данных ${authorityText} · налоговые ставки 2026 · курс ${rateStr} вон/долл.`
        )
      : pickLang(
          `${authorityText} 공식 자료 기반 · 2026년 세율 (원화 환산은 비교용)`,
          `Based on ${authorityText} official data · 2026 tax rates (KRW figure is for comparison only)`,
          `基于${authorityText}官方数据 · 2026年税率（韩元金额仅供对比参考）`,
          `Dựa trên dữ liệu chính thức của ${authorityText} · thuế suất 2026 (số liệu KRW chỉ để so sánh)`,
          `อ้างอิงข้อมูลทางการจาก ${authorityText} · อัตราภาษีปี 2026 (ตัวเลขวอนใช้เพื่อเปรียบเทียบเท่านั้น)`,
          `На основе официальных данных ${authorityText} · налоговые ставки 2026 (сумма в вонах — только для сравнения)`
        );
  }

  const milestoneEl = document.getElementById('home-milestone');
  const newMilestoneTier = final >= 10000 ? 2 : (final >= 1000 ? 1 : 0);
  if (newMilestoneTier === 2) {
    milestoneEl.textContent = pickLang('🎉 실수령액만 1조원이 넘어요!', '🎉 Your take-home tops ₩1 trillion!', '🎉 实得金额突破1万亿韩元！', '🎉 Số tiền thực nhận vượt quá 1 nghìn tỷ won!', '🎉 เงินที่ได้รับจริงเกิน 1 ล้านล้านวอน!', '🎉 Сумма на руки превысила 1 триллион вон!');
    milestoneEl.style.display = 'block';
  } else if (newMilestoneTier === 1) {
    milestoneEl.textContent = pickLang('💎 실수령액이 1,000억원을 넘었어요', '💎 Your take-home tops ₩100 billion', '💎 实得金额突破1000亿韩元', '💎 Số tiền thực nhận vượt quá 100 tỷ won', '💎 เงินที่ได้รับจริงเกิน 1 แสนล้านวอน', '💎 Сумма на руки превысила 100 миллиардов вон');
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
    formatWon(억) + ' основа приза · ' + basisSuffix
  );
  const usdMillions = Math.round(usd / 1000000).toLocaleString(LOCALE_MAP[currentLang] || 'ko-KR');
  document.getElementById('home-final-basis-mini').textContent = pickLang(
    `${usdMillions}M USD 당첨 · ${basisSuffix}`,
    `${usdMillions}M USD prize · ${basisSuffix}`,
    `${usdMillions}M USD 中奖 · ${basisSuffix}`,
    `${usdMillions}M USD trúng thưởng · ${basisSuffix}`,
    `${usdMillions}M USD เงินรางวัล · ${basisSuffix}`,
    `${usdMillions}M USD приз · ${basisSuffix}`
  );
  document.getElementById('home-tax1-label').textContent = label1;
  document.getElementById('home-tax1-val').textContent = val1;
  document.getElementById('home-tax2-label').textContent = label2;
  document.getElementById('home-tax2-val').textContent = val2;

  const taxImpactPct = 억 > 0 ? Math.round(100 - (final / 억 * 100)) : 0;
  document.getElementById('tax-impact-before').textContent = formatWon(억);
  document.getElementById('tax-impact-after').textContent = formatWon(final);
  document.getElementById('tax-impact-diff').textContent = '-' + formatWon(억 - final) + ` (${taxImpactPct}%)`;

  // 실수령/세금 비율을 숫자로만 보여주는 대신 막대그래프로도 한눈에 보이게 함 —
  // 다른 복권 세금 계산기들(infinitycalculator 등)에 공통으로 있는 시각적 breakdown 패턴 참고
  const takeHomePct = Math.max(0, Math.min(100, 100 - taxImpactPct));
  document.getElementById('result-visual-take').style.width = takeHomePct + '%';
  document.getElementById('result-visual-take-pct').textContent = takeHomePct + '%';
  document.getElementById('result-visual-tax-pct').textContent = taxImpactPct + '%';

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
      `💵 На самом деле вы получаете доллары ($${finalUsd.toLocaleString('en-US')}) напрямую — сумма в вонах приведена только для сравнения с корейской базой`
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
        `💴 Это примерно ¥${finalCny.toLocaleString('ru-RU')} юаней (справочный курс)`
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
        `🇮🇳 Это примерно ₹${finalInr.toLocaleString('en-IN')} рупий (справочный курс)`
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
        `${ref.flagEmoji} Это примерно ${ref.symbol}${finalLocal.toLocaleString('ru-RU')} ${ref.code} (справочный курс)`
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
  updateFlexBox(final, country);
  document.getElementById('home-filing-label').style.display = showFiling ? 'block' : 'none';
  document.getElementById('home-filing-small').style.display = showFiling ? 'block' : 'none';
  const filingNote = document.getElementById('home-filing-note');
  if (!showFiling) {
    filingNote.textContent = (country === 'cn')
      ? pickLang(
          '💡 중국 거주자는 어느 주(State)에서 당첨되든 미국 비거주자 원천징수(30%)가 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 China residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 中国税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Cư dân Trung Quốc đều chịu mức khấu trừ 30% cho người không cư trú tại Mỹ bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ผู้พำนักในจีนจะเสียภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Резиденты Китая платят одинаковые 30% удержания для нерезидентов США независимо от штата выигрыша — налог штата учитывать не нужно.'
        )
      : (country === 'in')
      ? pickLang(
          '💡 인도 거주자는 어느 주(State)에서 당첨되든 미국 비거주자 원천징수(30%)가 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 India residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 印度税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Cư dân Ấn Độ đều chịu mức khấu trừ 30% cho người không cư trú tại Mỹ bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ผู้พำนักในอินเดียจะเสียภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Резиденты Индии платят одинаковые 30% удержания для нерезидентов США независимо от штата выигрыша — налог штата учитывать не нужно.'
        )
      : (country !== 'kr')
      ? pickLang(
          '💡 어느 주(State)에서 당첨되든 미국 비거주자 원천징수(30%)가 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 The same 30% US non-resident withholding applies regardless of which state you won in — no need to factor in state tax.',
          '💡 无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Mức khấu trừ 30% cho người không cư trú tại Mỹ áp dụng như nhau bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Одинаковые 30% удержания для нерезидентов США применяются независимо от штата выигрыша — налог штата учитывать не нужно.'
        )
      : pickLang(
          '💡 한국 거주자는 어느 주(State)에서 당첨되든 미국 비거주자 원천징수(30%)가 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 Korean residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 韩国税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税',
          '💡 Cư dân Hàn Quốc đều chịu mức khấu trừ 30% cho người không cư trú tại Mỹ bất kể trúng số ở bang nào — không cần tính thêm thuế bang.',
          '💡 ผู้พำนักในเกาหลีจะเสียภาษีหัก ณ ที่จ่าย 30% สำหรับผู้ไม่มีถิ่นพำนักในสหรัฐฯ เท่ากันไม่ว่าจะถูกรางวัลในมลรัฐใด — ไม่ต้องคำนวณภาษีมลรัฐเพิ่ม',
          '💡 Резиденты Кореи платят одинаковые 30% удержания для нерезидентов США независимо от штата выигрыша — налог штата учитывать не нужно.'
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
  const 억 = (usd * EXCHANGE_RATE) / 100000000;

  document.getElementById('compare-krw-amt').textContent = formatWon(억);

  updateSideBySide(억, stateCode);
}

// 한국/미국 거주자 결과를 나란히(select와 무관하게 항상 둘 다) 보여주는 비교 카드용 계산
// 국가 비교 카드에 표시할 나라 목록 — 새 나라를 추가할 때는 이 배열에 항목만 추가하면
// 카드·breakdown이 자동으로 늘어남(HTML/CSS를 따로 손댈 필요 없음).
// implemented:false면 "준비 중" 카드로만 표시되고, calcTakeHome()에 해당 country 분기를
// 추가한 뒤 implemented:true로 바꾸면 실제 계산이 자동으로 반영됨.
const COUNTRY_TAX_PROFILES = [
  { code: 'kr', flagCode: 'KR', label: '한국 거주자', labelEn: 'Korea resident', labelZh: '韩国居民', labelVi: 'Cư dân Hàn Quốc', labelTh: 'ผู้พำนักในเกาหลี', labelRu: 'Резидент Кореи', implemented: true, needsState: false },
  { code: 'us', flagCode: 'US', label: '미국 거주자', labelEn: 'US resident', labelZh: '美国居民', labelVi: 'Cư dân Mỹ', labelTh: 'ผู้พำนักในสหรัฐฯ', labelRu: 'Резидент США', implemented: true, needsState: true },
  { code: 'vn', flagCode: 'VN', label: '베트남 거주자 (실제 베트남 거주 기준)', labelEn: 'Vietnam resident (living in Vietnam)', labelZh: '越南居民（实际住在越南）', labelVi: 'Cư dân Việt Nam (sống thực tế tại Việt Nam)', labelTh: 'ผู้พำนักในเวียดนาม (อาศัยอยู่จริงในเวียดนาม)', labelRu: 'Резидент Вьетнама (проживающий во Вьетнаме)', implemented: true, needsState: false },
  { code: 'cn', flagCode: 'CN', label: '중국 거주자 (실제 중국 거주 기준)', labelEn: 'China resident (living in China)', labelZh: '中国居民（实际住在中国）', labelVi: 'Cư dân Trung Quốc (sống thực tế tại Trung Quốc)', labelTh: 'ผู้พำนักในจีน (อาศัยอยู่จริงในจีน)', labelRu: 'Резидент Китая (проживающий в Китае)', implemented: true, needsState: false, detailPage: 'china-resident-us-lottery-tax.html', detailLabel: '中文详情 →' },
  { code: 'in', flagCode: 'IN', label: '인도 거주자 (실제 인도 거주 기준)', labelEn: 'India resident (living in India)', labelZh: '印度居民（实际住在印度）', labelVi: 'Cư dân Ấn Độ (sống thực tế tại Ấn Độ)', labelTh: 'ผู้พำนักในอินเดีย (อาศัยอยู่จริงในอินเดีย)', labelRu: 'Резидент Индии (проживающий в Индии)', implemented: true, needsState: false },
  { code: 'id', flagCode: 'ID', label: '인도네시아 거주자 (실제 인도네시아 거주 기준)', labelEn: 'Indonesia resident (living in Indonesia)', labelZh: '印尼居民（实际住在印尼）', labelVi: 'Cư dân Indonesia (sống thực tế tại Indonesia)', labelTh: 'ผู้พำนักในอินโดนีเซีย (อาศัยอยู่จริงในอินโดนีเซีย)', labelRu: 'Резидент Индонезии (проживающий в Индонезии)', implemented: true, needsState: false },
  { code: 'ph', flagCode: 'PH', label: '필리핀 거주자 (실제 필리핀 거주 기준, 근사치)', labelEn: 'Philippines resident (living in Philippines, approximate)', labelZh: '菲律宾居民（实际住在菲律宾，估算值）', labelVi: 'Cư dân Philippines (sống thực tế tại Philippines, ước tính)', labelTh: 'ผู้พำนักในฟิลิปปินส์ (อาศัยอยู่จริงในฟิลิปปินส์, ค่าประมาณ)', labelRu: 'Резидент Филиппин (проживающий на Филиппинах, приблизительно)', implemented: true, needsState: false },
  { code: 'th', flagCode: 'TH', label: '태국 거주자 (실제 태국 거주 기준, 추정치 ⚠️)', labelEn: 'Thailand resident (living in Thailand, unverified estimate ⚠️)', labelZh: '泰国居民（实际住在泰国，估算值⚠️）', labelVi: 'Cư dân Thái Lan (sống thực tế tại Thái Lan, ước tính ⚠️)', labelTh: 'ผู้พำนักในไทย (อาศัยอยู่จริงในไทย, ค่าประมาณ ⚠️)', labelRu: 'Резидент Таиланда (проживающий в Таиланде, оценка ⚠️)', implemented: true, needsState: false },
  { code: 'jp', flagCode: 'JP', label: '일본 거주자 (실제 일본 거주 기준)', labelEn: 'Japan resident (living in Japan)', labelZh: '日本居民（实际住在日本）', labelVi: 'Cư dân Nhật Bản (sống thực tế tại Nhật Bản)', labelTh: 'ผู้พำนักในญี่ปุ่น (อาศัยอยู่จริงในญี่ปุ่น)', labelRu: 'Резидент Японии (проживающий в Японии)', implemented: true, needsState: false },
  { code: 'ru', flagCode: 'RU', label: '러시아 거주자 (실제 러시아 거주 기준, 조약 정지 ⚠️)', labelEn: 'Russia resident (living in Russia, treaty suspended ⚠️)', labelZh: '俄罗斯居民（实际住在俄罗斯，条约暂停⚠️）', labelVi: 'Cư dân Nga (sống thực tế tại Nga, hiệp định bị đình chỉ ⚠️)', labelTh: 'ผู้พำนักในรัสเซีย (อาศัยอยู่จริงในรัสเซีย, สนธิสัญญาระงับ ⚠️)', labelRu: 'Резидент России (проживающий в России, договор приостановлен ⚠️)', implemented: true, needsState: false },
  { code: 'np', flagCode: 'NP', label: '네팔 거주자 (실제 네팔 거주 기준)', labelEn: 'Nepal resident (living in Nepal)', labelZh: '尼泊尔居民（实际住在尼泊尔）', labelVi: 'Cư dân Nepal (sống thực tế tại Nepal)', labelTh: 'ผู้พำนักในเนปาล (อาศัยอยู่จริงในเนปาล)', labelRu: 'Резидент Непала (проживающий в Непале)', implemented: true, needsState: false },
  { code: 'lk', flagCode: 'LK', label: '스리랑카 거주자 (실제 스리랑카 거주 기준, 근사치)', labelEn: 'Sri Lanka resident (living in Sri Lanka, approximate)', labelZh: '斯里兰卡居民（实际住在斯里兰卡，估算值）', labelVi: 'Cư dân Sri Lanka (sống thực tế tại Sri Lanka, ước tính)', labelTh: 'ผู้พำนักในศรีลังกา (อาศัยอยู่จริงในศรีลังกา, ค่าประมาณ)', labelRu: 'Резидент Шри-Ланки (проживающий в Шри-Ланке, приблизительно)', implemented: true, needsState: false },
  { code: 'uz', flagCode: 'UZ', label: '우즈베키스탄 거주자 (실제 우즈베키스탄 거주 기준)', labelEn: 'Uzbekistan resident (living in Uzbekistan)', labelZh: '乌兹别克斯坦居民（实际住在乌兹别克斯坦）', labelVi: 'Cư dân Uzbekistan (sống thực tế tại Uzbekistan)', labelTh: 'ผู้พำนักในอุซเบกิสถาน (อาศัยอยู่จริงในอุซเบกิสถาน)', labelRu: 'Резидент Узбекистана (проживающий в Узбекистане)', implemented: true, needsState: false },
  { code: 'kz', flagCode: 'KZ', label: '카자흐스탄 거주자 (실제 카자흐스탄 거주 기준)', labelEn: 'Kazakhstan resident (living in Kazakhstan)', labelZh: '哈萨克斯坦居民（实际住在哈萨克斯坦）', labelVi: 'Cư dân Kazakhstan (sống thực tế tại Kazakhstan)', labelTh: 'ผู้พำนักในคาซัคสถาน (อาศัยอยู่จริงในคาซัคสถาน)', labelRu: 'Резидент Казахстана (проживающий в Казахстане)', implemented: true, needsState: false },
  { code: 'kg', flagCode: 'KG', label: '키르기스스탄 거주자 (실제 키르기스스탄 거주 기준)', labelEn: 'Kyrgyzstan resident (living in Kyrgyzstan)', labelZh: '吉尔吉斯斯坦居民（实际住在吉尔吉斯斯坦）', labelVi: 'Cư dân Kyrgyzstan (sống thực tế tại Kyrgyzstan)', labelTh: 'ผู้พำนักในคีร์กีซสถาน (อาศัยอยู่จริงในคีร์กีซสถาน)', labelRu: 'Резидент Кыргызстана (проживающий в Кыргызстане)', implemented: true, needsState: false },
  { code: 'mm', flagCode: 'MM', label: '미얀마 거주자 (실제 미얀마 거주 기준, 근사치)', labelEn: 'Myanmar resident (living in Myanmar, approximate)', labelZh: '缅甸居民（实际住在缅甸，估算值）', labelVi: 'Cư dân Myanmar (sống thực tế tại Myanmar, ước tính)', labelTh: 'ผู้พำนักในเมียนมา (อาศัยอยู่จริงในเมียนมา, ค่าประมาณ)', labelRu: 'Резидент Мьянмы (проживающий в Мьянме, приблизительно)', implemented: true, needsState: false },
  { code: 'bd', flagCode: 'BD', label: '방글라데시 거주자 (실제 방글라데시 거주 기준)', labelEn: 'Bangladesh resident (living in Bangladesh)', labelZh: '孟加拉国居民（实际住在孟加拉国）', labelVi: 'Cư dân Bangladesh (sống thực tế tại Bangladesh)', labelTh: 'ผู้พำนักในบังกลาเทศ (อาศัยอยู่จริงในบังกลาเทศ)', labelRu: 'Резидент Бангладеш (проживающий в Бангладеш)', implemented: true, needsState: false },
  { code: 'pk', flagCode: 'PK', label: '파키스탄 거주자 (실제 파키스탄 거주 기준, 추정치 ⚠️)', labelEn: 'Pakistan resident (living in Pakistan, unverified estimate ⚠️)', labelZh: '巴基斯坦居民（实际住在巴基斯坦，估算值⚠️）', labelVi: 'Cư dân Pakistan (sống thực tế tại Pakistan, ước tính ⚠️)', labelTh: 'ผู้พำนักในปากีสถาน (อาศัยอยู่จริงในปากีสถาน, ค่าประมาณ ⚠️)', labelRu: 'Резидент Пакистана (проживающий в Пакистане, оценка ⚠️)', implemented: true, needsState: false },
  { code: 'kh', flagCode: 'KH', label: '캄보디아 거주자 (실제 캄보디아 거주 기준, 추정치 ⚠️)', labelEn: 'Cambodia resident (living in Cambodia, unverified estimate ⚠️)', labelZh: '柬埔寨居民（实际住在柬埔寨，估算值⚠️）', labelVi: 'Cư dân Campuchia (sống thực tế tại Campuchia, ước tính ⚠️)', labelTh: 'ผู้พำนักในกัมพูชา (อาศัยอยู่จริงในกัมพูชา, ค่าประมาณ ⚠️)', labelRu: 'Резидент Камбоджи (проживающий в Камбодже, оценка ⚠️)', implemented: true, needsState: false },
  { code: 'mn', flagCode: 'MN', label: '몽골 거주자 (실제 몽골 거주 기준, 추정치 ⚠️)', labelEn: 'Mongolia resident (living in Mongolia, unverified estimate ⚠️)', labelZh: '蒙古居民（实际住在蒙古，估算值⚠️）', labelVi: 'Cư dân Mông Cổ (sống thực tế tại Mông Cổ, ước tính ⚠️)', labelTh: 'ผู้พำนักในมองโกเลีย (อาศัยอยู่จริงในมองโกเลีย, ค่าประมาณ ⚠️)', labelRu: 'Резидент Монголии (проживающий в Монголии, оценка ⚠️)', implemented: true, needsState: false },
  { code: 'la', flagCode: 'LA', label: '라오스 거주자 (실제 라오스 거주 기준, 추정치 ⚠️)', labelEn: 'Laos resident (living in Laos, unverified estimate ⚠️)', labelZh: '老挝居民（实际住在老挝，估算值⚠️）', labelVi: 'Cư dân Lào (sống thực tế tại Lào, ước tính ⚠️)', labelTh: 'ผู้พำนักในลาว (อาศัยอยู่จริงในลาว, ค่าประมาณ ⚠️)', labelRu: 'Резидент Лаоса (проживающий в Лаосе, оценка ⚠️)', implemented: true, needsState: false },
];

// "(실제 OO 거주 기준)" 같은 부연설명 괄호를 뗀 짧은 라벨 — 좁은 카드/목록 칸에서 3~4줄로
// 지저분하게 줄바꿈되는 걸 막기 위해 씀(비교 카드·잭팟 히스토리 국가별 금액 목록 등 공용).
// 여백이 넉넉한 곳(breakdown 상세 섹션 등)에서는 원문 label을 그대로 써야 함
function getProfileShortLabel(profile){
  const full = pickLang(profile.label, profile.labelEn, profile.labelZh, profile.labelVi, profile.labelTh, profile.labelRu);
  return full.replace(/\s*[（(][^）)]*[)）]\s*$/, '');
}

// "한국에 사는 OO 국적자" 안내 페이지 목록 — 실제 그 나라 세법이 아니라 한국 세법(위 kr 기준)을
// 그대로 따르는 번역 콘텐츠라서, COUNTRY_TAX_PROFILES(진짜 다른 나라 세금 비교)와는 완전히 분리해서 관리함.
// 새 언어 추가할 땐 이 배열에 한 줄만 추가하면 됨.
const LANGUAGE_CONTENT_PAGES = [
  { flagCode: 'VN', label: '한국에 사는 베트남분이라면', labelEn: 'Living in Korea as a Vietnamese national', labelZh: '住在韩国的越南人', labelVi: 'Là công dân Việt Nam sống ở Hàn Quốc', labelTh: 'สำหรับชาวเวียดนามที่อาศัยในเกาหลี', labelRu: 'Для граждан Вьетнама, живущих в Корее', contentPage: 'vietnamese-in-korea-lottery-tax.html', contentLabel: 'Tiếng Việt →' },
  { flagCode: 'CN', label: '한국에 사는 중국분이라면', labelEn: 'Living in Korea as a Chinese national', labelZh: '住在韩国的中国人', labelVi: 'Là công dân Trung Quốc sống ở Hàn Quốc', labelTh: 'สำหรับชาวจีนที่อาศัยในเกาหลี', labelRu: 'Для граждан Китая, живущих в Корее', contentPage: 'china_in_korea_lottery_tax.html', contentLabel: '中文 →' },
  { flagCode: 'TH', label: '한국에 사는 태국분이라면', labelEn: 'Living in Korea as a Thai national', labelZh: '住在韩国的泰国人', labelVi: 'Là công dân Thái Lan sống ở Hàn Quốc', labelTh: 'สำหรับชาวไทยที่อาศัยในเกาหลี', labelRu: 'Для граждан Таиланда, живущих в Корее', contentPage: 'thai_in_korea_lottery_tax.html', contentLabel: 'ภาษาไทย →' },
  { flagCode: 'PH', label: '한국에 사는 필리핀분이라면', labelEn: 'Living in Korea as a Filipino national', labelZh: '住在韩国的菲律宾人', labelVi: 'Là công dân Philippines sống ở Hàn Quốc', labelTh: 'สำหรับชาวฟิลิปปินส์ที่อาศัยในเกาหลี', labelRu: 'Для граждан Филиппин, живущих в Корее', contentPage: 'philippines_in_korea_lottery_tax.html', contentLabel: 'Tagalog →' },
  { flagCode: "AR", label: "한국에 사는 아랍어권 분이라면", labelEn: "Living in Korea and speak Arabic", labelZh: "住在韩国的阿拉伯语使用者", labelVi: "Nói tiếng Ả Rập và sống ở Hàn Quốc", labelTh: "สำหรับผู้พูดภาษาอาหรับที่อาศัยในเกาหลี", labelRu: "Для арабоговорящих, живущих в Корее", contentPage: "arabic_in_korea_lottery_tax.html", contentLabel: "العربية →" },
  { flagCode: "BD", label: "한국에 사는 방글라데시분이라면", labelEn: "Living in Korea as a Bangladeshi national", labelZh: "住在韩国的孟加拉国人", labelVi: "Là công dân Bangladesh sống ở Hàn Quốc", labelTh: "สำหรับชาวบังกลาเทศที่อาศัยในเกาหลี", labelRu: "Для граждан Бангладеш, живущих в Корее", contentPage: "bengali_in_korea_lottery_tax.html", contentLabel: "বাংলা →" },
  { flagCode: "KH", label: "한국에 사는 캄보디아분이라면", labelEn: "Living in Korea as a Cambodian national", labelZh: "住在韩国的柬埔寨人", labelVi: "Là công dân Campuchia sống ở Hàn Quốc", labelTh: "สำหรับชาวกัมพูชาที่อาศัยในเกาหลี", labelRu: "Для граждан Камбоджи, живущих в Корее", contentPage: "cambodian_in_korea_lottery_tax.html", contentLabel: "ខ្មែរ →" },
  { flagCode: "FR", label: "한국에 사는 프랑스어권 분이라면", labelEn: "Living in Korea and speak French", labelZh: "住在韩国的法语使用者", labelVi: "Nói tiếng Pháp và sống ở Hàn Quốc", labelTh: "สำหรับผู้พูดภาษาฝรั่งเศสที่อาศัยในเกาหลี", labelRu: "Для франкоговорящих, живущих в Корее", contentPage: "french_in_korea_lottery_tax.html", contentLabel: "Français →" },
  { flagCode: "IN", label: "한국에 사는 인도분이라면 (힌디어)", labelEn: "Living in Korea as an Indian national (Hindi)", labelZh: "住在韩国的印度人（印地语）", labelVi: "Là công dân Ấn Độ sống ở Hàn Quốc (tiếng Hindi)", labelTh: "สำหรับชาวอินเดียที่อาศัยในเกาหลี (ภาษาฮินดี)", labelRu: "Для граждан Индии, живущих в Корее (хинди)", contentPage: "hindi_in_korea_lottery_tax.html", contentLabel: "हिन्दी →" },
  { flagCode: "ID", label: "한국에 사는 인도네시아분이라면", labelEn: "Living in Korea as an Indonesian national", labelZh: "住在韩国的印尼人", labelVi: "Là công dân Indonesia sống ở Hàn Quốc", labelTh: "สำหรับชาวอินโดนีเซียที่อาศัยในเกาหลี", labelRu: "Для граждан Индонезии, живущих в Корее", contentPage: "indonesian_in_korea_lottery_tax.html", contentLabel: "Bahasa Indonesia →" },
  { flagCode: "JP", label: "한국에 사는 일본분이라면", labelEn: "Living in Korea as a Japanese national", labelZh: "住在韩国的日本人", labelVi: "Là công dân Nhật Bản sống ở Hàn Quốc", labelTh: "สำหรับชาวญี่ปุ่นที่อาศัยในเกาหลี", labelRu: "Для граждан Японии, живущих в Корее", contentPage: "japanese_in_korea_lottery_tax.html", contentLabel: "日本語 →" },
  { flagCode: "KZ", label: "한국에 사는 카자흐스탄분이라면", labelEn: "Living in Korea as a Kazakhstani national", labelZh: "住在韩国的哈萨克斯坦人", labelVi: "Là công dân Kazakhstan sống ở Hàn Quốc", labelTh: "สำหรับชาวคาซัคสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Казахстана, живущих в Корее", contentPage: "kazakh_in_korea_lottery_tax.html", contentLabel: "Қазақша →" },
  { flagCode: "KG", label: "한국에 사는 키르기스스탄분이라면", labelEn: "Living in Korea as a Kyrgyzstani national", labelZh: "住在韩国的吉尔吉斯斯坦人", labelVi: "Là công dân Kyrgyzstan sống ở Hàn Quốc", labelTh: "สำหรับชาวคีร์กีซสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Кыргызстана, живущих в Корее", contentPage: "kyrgyz_in_korea_lottery_tax.html", contentLabel: "Кыргызча →" },
  { flagCode: "LA", label: "한국에 사는 라오스분이라면", labelEn: "Living in Korea as a Laotian national", labelZh: "住在韩国的老挝人", labelVi: "Là công dân Lào sống ở Hàn Quốc", labelTh: "สำหรับชาวลาวที่อาศัยในเกาหลี", labelRu: "Для граждан Лаоса, живущих в Корее", contentPage: "lao_in_korea_lottery_tax.html", contentLabel: "ລາວ →" },
  { flagCode: "MN", label: "한국에 사는 몽골분이라면", labelEn: "Living in Korea as a Mongolian national", labelZh: "住在韩国的蒙古人", labelVi: "Là công dân Mông Cổ sống ở Hàn Quốc", labelTh: "สำหรับชาวมองโกเลียที่อาศัยในเกาหลี", labelRu: "Для граждан Монголии, живущих в Корее", contentPage: "mongolian_in_korea_lottery_tax.html", contentLabel: "Монгол →" },
  { flagCode: "MM", label: "한국에 사는 미얀마분이라면", labelEn: "Living in Korea as a Myanmar national", labelZh: "住在韩国的缅甸人", labelVi: "Là công dân Myanmar sống ở Hàn Quốc", labelTh: "สำหรับชาวเมียนมาที่อาศัยในเกาหลี", labelRu: "Для граждан Мьянмы, живущих в Корее", contentPage: "myanmar_in_korea_lottery_tax.html", contentLabel: "မြန်မာ →" },
  { flagCode: "NP", label: "한국에 사는 네팔분이라면", labelEn: "Living in Korea as a Nepali national", labelZh: "住在韩国的尼泊尔人", labelVi: "Là công dân Nepal sống ở Hàn Quốc", labelTh: "สำหรับชาวเนปาลที่อาศัยในเกาหลี", labelRu: "Для граждан Непала, живущих в Корее", contentPage: "nepali_in_korea_lottery_tax.html", contentLabel: "नेपाली →" },
  { flagCode: "RU", label: "한국에 사는 러시아분이라면", labelEn: "Living in Korea as a Russian national", labelZh: "住在韩国的俄罗斯人", labelVi: "Là công dân Nga sống ở Hàn Quốc", labelTh: "สำหรับชาวรัสเซียที่อาศัยในเกาหลี", labelRu: "Для граждан России, живущих в Корее", contentPage: "russian_in_korea_lottery_tax.html", contentLabel: "Русский →" },
  { flagCode: "LK", label: "한국에 사는 스리랑카분이라면", labelEn: "Living in Korea as a Sri Lankan national", labelZh: "住在韩国的斯里兰卡人", labelVi: "Là công dân Sri Lanka sống ở Hàn Quốc", labelTh: "สำหรับชาวศรีลังกาที่อาศัยในเกาหลี", labelRu: "Для граждан Шри-Ланки, живущих в Корее", contentPage: "srilanka_in_korea_lottery_tax.html", contentLabel: "සිංහල →" },
  { flagCode: "PK", label: "한국에 사는 파키스탄분이라면", labelEn: "Living in Korea as a Pakistani national", labelZh: "住在韩国的巴基斯坦人", labelVi: "Là công dân Pakistan sống ở Hàn Quốc", labelTh: "สำหรับชาวปากีสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Пакистана, живущих в Корее", contentPage: "urdu_in_korea_lottery_tax.html", contentLabel: "اردو →" },
  { flagCode: "UZ", label: "한국에 사는 우즈베키스탄분이라면", labelEn: "Living in Korea as an Uzbekistani national", labelZh: "住在韩国的乌兹别克斯坦人", labelVi: "Là công dân Uzbekistan sống ở Hàn Quốc", labelTh: "สำหรับชาวอุซเบกิสถานที่อาศัยในเกาหลี", labelRu: "Для граждан Узбекистана, живущих в Корее", contentPage: "uzbek_in_korea_lottery_tax.html", contentLabel: "O'zbek →" },
  { flagCode: "ES", label: "한국에 사는 스페인어권 분이라면", labelEn: "Living in Korea and speak Spanish", labelZh: "住在韩国的西班牙语使用者", labelVi: "Nói tiếng Tây Ban Nha và sống ở Hàn Quốc", labelTh: "สำหรับผู้พูดภาษาสเปนที่อาศัยในเกาหลี", labelRu: "Для испаноговорящих, живущих в Корее", contentPage: "spanish_in_korea_lottery_tax.html", contentLabel: "Español →" },
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
  LANGUAGE_CONTENT_PAGES.forEach(item => {
    const row = document.createElement('div');
    row.className = 'other-lang-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'other-lang-label';
    labelEl.append(makeFlagBadge(item.flagCode), document.createTextNode(' ' + pickLang(item.label, item.labelEn, item.labelZh, item.labelVi, item.labelTh, item.labelRu)));
    const linkEl = document.createElement('a');
    linkEl.className = 'other-lang-link';
    linkEl.href = item.contentPage;
    linkEl.textContent = item.contentLabel;
    row.append(labelEl, linkEl);
    container.appendChild(row);
  });
}

function updateSideBySide(eok, stateCode){
  const grid = document.getElementById('sideByCountryGrid');
  const breakdownContainer = document.getElementById('sideBreakdownContainer');
  if (!grid || !breakdownContainer) return;
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

  implementedRows.forEach((row, i) => {
    const { profile, result, pct } = row;
    const baseLabelText = pickLang(profile.label, profile.labelEn, profile.labelZh, profile.labelVi, profile.labelTh, profile.labelRu);
    // 카드 안 배지 라벨(side-card-flag)은 좁아서 짧은 라벨을 쓰고, 여백이 넉넉한 아래 breakdown
    // 섹션(side-group-label)에서는 원문 label을 그대로 보여줌
    const shortLabelText = getProfileShortLabel(profile);
    // labelText가 뒤에 (주 이름) 등 접미사가 붙을 수 있어서, 배지+본문 텍스트를 한번에 만들어주는
    // 헬퍼로 side-card-flag/side-group-label 양쪽에 그대로 재사용함
    function buildLabelNode(suffix, useShort){
      const frag = document.createDocumentFragment();
      frag.append(makeFlagBadge(profile.flagCode), document.createTextNode(' ' + (useShort ? shortLabelText : baseLabelText) + (suffix || '')));
      return frag;
    }

    let stateSuffix = '';
    if (profile.needsState) {
      const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
      stateSuffix = ` (${pickLang(stateInfo.label, stateInfo.labelEn, stateInfo.labelZh, stateInfo.labelEn, stateInfo.labelEn, stateInfo.labelEn)})`;
    }

    const card = document.createElement('div');
    card.className = 'side-card';
    if (i === 0) {
      card.classList.add('side-card-best');
      const bestBadge = document.createElement('p');
      bestBadge.className = 'side-card-best-badge';
      bestBadge.textContent = pickLang('👑 실수령액 1위', '👑 Highest take-home', '👑 实得金额第一', '👑 Thực nhận cao nhất', '👑 ได้รับจริงสูงสุด', '👑 Больше всех на руки');
      card.appendChild(bestBadge);
    }
    const flagEl = document.createElement('p'); flagEl.className = 'side-card-flag'; flagEl.appendChild(buildLabelNode(stateSuffix, true));
    const amtEl = document.createElement('p'); amtEl.className = 'side-card-amt'; amtEl.textContent = formatWon(result.final);
    const rateEl = document.createElement('p'); rateEl.className = 'side-card-rate';
    rateEl.textContent = pickLang('실수령률 약 ', 'Take-home rate about ', '实得比例约', 'Tỷ lệ thực nhận khoảng ', 'อัตราที่ได้รับจริงประมาณ ', 'Ставка на руки около ') + pct.toFixed(1) + '%';
    // 홈 화면 결과 카드와 동일한 시각적 breakdown 막대를 국가별 카드에도 작게 적용 —
    // 숫자(%)만으로는 나라 간 비교가 한눈에 안 들어와서, 막대 길이로 바로 비교되게 함
    const barEl = document.createElement('div'); barEl.className = 'side-card-bar';
    const barFillEl = document.createElement('div'); barFillEl.className = 'side-card-bar-fill';
    barFillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
    barEl.appendChild(barFillEl);
    card.append(flagEl, amtEl, rateEl, barEl);
    if (profile.detailPage) {
      const detailEl = document.createElement('a');
      detailEl.className = 'side-card-detail-link';
      detailEl.href = profile.detailPage;
      detailEl.textContent = profile.detailLabel;
      card.appendChild(detailEl);
    }
    grid.appendChild(card);

    const groupLabel = document.createElement('p'); groupLabel.className = 'side-group-label'; groupLabel.appendChild(buildLabelNode(stateSuffix));
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
    const amtEl = document.createElement('p');
    amtEl.className = 'side-card-amt';
    amtEl.style.cssText = 'color:var(--text-muted); font-size:16px;';
    amtEl.textContent = pickLang('준비 중', 'Coming soon', '准备中', 'Sắp có', 'เร็วๆ นี้', 'Скоро');
    const flagP = document.createElement('p'); flagP.className = 'side-card-flag';
    flagP.append(makeFlagBadge(profile.flagCode), document.createTextNode(' ' + shortLabelText));
    card.appendChild(flagP);
    card.appendChild(amtEl);
    grid.appendChild(card);
  });

  // 모바일에서 카드 20개를 한 번에 쭉 나열하면 스크롤이 너무 길어져서, 처음엔 상위 6개(이미
  // 실수령액 순 정렬됨)만 보여주고 나머지는 "더보기" 버튼으로 펼치게 함. 매번 다시 그릴 때마다
  // 접힌 상태로 리셋 — eok/국가가 바뀌면 순위도 달라지므로 이전 펼침 상태를 유지할 이유가 없음
  const SIDE_VISIBLE_COUNT = 6;
  const allCards = Array.from(grid.children);
  const showMoreBtn = document.getElementById('sideShowMoreBtn');
  allCards.forEach((card, i) => { card.classList.toggle('side-card-hidden-extra', i >= SIDE_VISIBLE_COUNT); });
  if (showMoreBtn) {
    if (allCards.length > SIDE_VISIBLE_COUNT) {
      showMoreBtn.style.display = 'block';
      showMoreBtn.dataset.expanded = 'false';
      const remaining = allCards.length - SIDE_VISIBLE_COUNT;
      showMoreBtn.textContent = pickLang(`${remaining}개국 더 보기 ▾`, `Show ${remaining} more ▾`, `再显示${remaining}个国家 ▾`, `Xem thêm ${remaining} nước ▾`, `ดูเพิ่มอีก ${remaining} ประเทศ ▾`, `Показать ещё ${remaining} стран ▾`);
    } else {
      showMoreBtn.style.display = 'none';
    }
  }

  renderLanguageContentLinks();
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
    btn.textContent = pickLang('접기 ▴', 'Show less ▴', '收起 ▴', 'Thu gọn ▴', 'ย่อ ▴', 'Свернуть ▴');
  } else {
    Array.from(grid.children).slice(6).forEach(card => { card.classList.add('side-card-hidden-extra'); });
    btn.dataset.expanded = 'false';
    btn.textContent = btn.dataset.collapsedLabel || btn.textContent;
  }
}
