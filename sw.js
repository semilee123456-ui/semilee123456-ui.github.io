// ============================================================
// 참택스(ChamTax) 서비스 워커 — PWA "홈 화면에 추가" 설치 배너를 띄우기 위한 최소 조건 충족용
// ============================================================
// 목적은 오프라인 지원이 아니라 "설치 가능한 앱"으로 인정받는 것(Chrome 등은 서비스 워커가
// 없으면 manifest.json이 있어도 설치 프롬프트를 안 띄움). 그래서 캐싱 범위를 앱 셸(껍데기)
// 몇 개 파일로 최소화하고, 전략은 반드시 "네트워크 우선(network-first), 캐시는 폴백"으로 함
// — 캐시 우선(cache-first)으로 하면 안 됨.
//
// 왜 네트워크 우선인가: 이 프로젝트는 "고쳤다고 기록했는데 실제로는 라이브에 반영 안 됨"
// 사고가 반복된 이력이 있음(odds-data.js 하이픈 업로드 버그로 구버전이 몇 주간 라이브에
// 남아있던 사고, 인수인계 문서 자체가 커밋 안 된 채 방치된 사고 등 — 자세한 건 HANDOFF.md
// 참고). 서비스 워커 캐시가 하나 더 추가되면 "배포는 됐는데 캐시가 옛날 걸 계속 보여준다"는
// 새로운 종류의 스테일 콘텐츠 사고가 또 생길 수 있으므로, 온라인 상태에서는 항상 최신
// 네트워크 응답을 우선 사용하고, 캐시는 오프라인일 때만 폴백으로 씀.
//
// odds-data.js(확률체감 탭 전용, 492KB)는 이미 자체 쿼리스트링 캐시버스팅
// (?v=YYYYMMDD, 손으로 버전을 올리는 방식)을 쓰고 있어서, 이 서비스 워커가 그 파일을
// 가로채거나 캐싱하면 두 캐싱 메커니즘이 충돌할 위험이 있음 — 그래서 아래 APP_SHELL_PATHS에
// odds-data.js는 절대 넣지 않고, 애초에 이 파일에 대한 요청은 fetch 핸들러에서 걸러져서
// (allowlist에 없으므로) 서비스 워커를 아예 거치지 않고 브라우저 기본 동작으로 그대로 흘러감.
// 환율 API·애드센스·GA4·Formspree 문의폼도 같은 이유(외부 origin, 캐싱 대상 아님)로 거름.

// 캐시 이름 버전 — 앱 셸 파일(아래 APP_SHELL_PATHS) 내용이 바뀔 때마다 이 문자열을 올릴 것.
// 버전을 안 올리면 재방문자 브라우저에 남아있는 이전 캐시가 계속 쓰이고, activate 핸들러의
// 구버전 캐시 정리 로직도 "이름이 다른 캐시"를 못 찾아서 아무 효과가 없음.
const CACHE_NAME = 'chamtax-shell-v1';

// 서비스 워커가 미리 캐싱하고, 오프라인일 때 폴백으로 쓸 "앱 셸" 파일 전체 목록.
// index.html에서만 서비스 워커를 등록하므로(랜딩 페이지 41개는 등록 안 함), 실질적으로
// 이 워커가 관리하는 건 메인 계산기 SPA 하나뿐 — 절대 이 배열을 넓혀서 랜딩 페이지나
// odds-data.js, i18n/*.json 등을 넣지 말 것(캐싱 대상을 최소한으로 유지하는 게 이 워커의
// 설계 의도).
const APP_SHELL_PATHS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  // cache.addAll()은 목록 중 하나라도 실패(404 등)하면 전체가 롤백되는데, 그러면 정상 파일들도
  // 하나도 캐싱이 안 되고 install 자체가 실패함. Promise.allSettled로 개별 실패를 서로 격리해서
  // "일부만 캐싱 성공"도 정상적으로 install이 끝나도록 함
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        APP_SHELL_PATHS.map(path =>
          // cache: 'no-store' — 브라우저 자체 HTTP 캐시(heuristic freshness)를 거치지 않고
          // 항상 서버에 새로 요청함. 안 붙이면 fetch()가 "네트워크 우선"이라고 우리가 믿고 있어도
          // 실제로는 브라우저 HTTP 캐시가 아직 신선하다고 판단해 서버에 요청조차 안 보내고
          // 조용히 구버전을 돌려줄 수 있음 — install 단계에서부터 옛 버전을 캐싱해버리면 이후
          // networkFirst()의 네트워크 우선 원칙 자체가 무의미해짐
          fetch(path, { cache: 'no-store' })
            .then(response => {
              if (response && response.ok) return cache.put(path, response);
            })
            .catch(err => console.warn('[sw] install precache 실패(무시하고 계속):', path, err))
        )
      );
    })
  );
  // 새 서비스 워커를 곧바로 활성화 — 구버전 워커가 계속 페이지를 붙들고 있으면(기존 탭이
  // 열려있는 동안) 새 워커의 네트워크 우선 로직이 적용 안 되는 기간이 길어질 수 있어서,
  // 이 프로젝트의 "고쳤는데 실제로 반영 안 됨" 사고 이력을 감안해 최대한 빨리 새 버전으로 전환함
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name.startsWith('chamtax-shell-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // GET이 아닌 요청(Formspree POST 등)은 손대지 않음
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 다른 origin(애드센스, GA4, 환율 API, Formspree 등)은 캐시를 열어보지도 않고 즉시 건너뜀
  // — 크로스오리진 요청을 캐시 API로 match/put 시도하는 것 자체를 피하기 위한 안전장치
  if (url.origin !== self.location.origin) return;

  // 앱 셸 allowlist에 없는 경로(odds-data.js, 41개 랜딩 페이지, i18n/*.json, 기타 이미지 등)는
  // 전부 그대로 통과시켜 브라우저 기본 네트워크 동작에 맡김 — event.respondWith를 호출하지 않음
  if (!APP_SHELL_PATHS.includes(url.pathname)) return;

  event.respondWith(networkFirst(request));
});

// 네트워크 우선, 캐시는 폴백. 캐시 우선(cache-first)으로 절대 바꾸지 말 것 — 위 상단 주석 참고
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // cache: 'no-store'로 브라우저 HTTP 캐시를 우회 — 안 그러면 배포 직후에도 HTTP 캐시가
    // "아직 신선하다"고 판단해 서버에 요청조차 안 보내고 구버전을 돌려줄 수 있어서, 이 서비스
    // 워커 자체가 "고쳤는데 라이브에 반영 안 됨" 사고를 하나 더 추가하는 셈이 됨(install
    // 핸들러 주석 참고). 매번 실제 네트워크까지 가야만 "네트워크 우선"이 의미가 있음
    const networkResponse = await fetch(request, { cache: 'no-store' });
    if (networkResponse && networkResponse.ok) {
      // 다음 오프라인 방문을 위해 최신 응답으로 캐시 갱신(clone은 응답 스트림을 한 번만 읽을
      // 수 있어서 필수 — 하나는 브라우저에 반환, 하나는 캐시 저장용)
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // 네트워크 실패(오프라인 등) — script.js?v=YYYYMMDD처럼 쿼리스트링이 버전마다 달라지는
    // 요청도 폴백에서는 찾을 수 있도록 ignoreSearch로 매칭
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}
