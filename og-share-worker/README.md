# 참택스 공유 카드 Worker — 배포 가이드

카카오톡 등에 링크를 공유했을 때, 실제 계산 결과(예: "223억원")가 미리보기 카드에 그대로
보이게 해주는 서버리스 함수입니다. **chamtax.com(GitHub Pages)과는 완전히 분리된 별도
배포**라서, 이 배포를 안 하거나 실패해도 지금 사이트는 전혀 영향받지 않습니다.

## 1. Cloudflare 계정 준비 (무료)

1. https://dash.cloudflare.com/sign-up 에서 계정 생성 (신용카드 필요 없음, 무료 플랜으로 충분)
2. 로그인 상태 유지

## 2. 이 폴더 배포하기

터미널에서 이 폴더(`og-share-worker/`)로 이동한 뒤:

```bash
npm install
npx wrangler login   # 브라우저가 열리면 Cloudflare 계정으로 로그인/승인
npx wrangler deploy
```

배포가 끝나면 터미널에 아래처럼 URL이 출력됩니다(계정마다 서브도메인 부분이 다름):

```
https://chamtax-og-share.<당신의-서브도메인>.workers.dev
```

**이 URL을 저장해두세요** — 다음 단계에서 필요합니다.

## 3. 배포 확인

브라우저에서 아래 주소를 열어서 카드 이미지가 정상적으로 뜨는지 확인:

```
https://chamtax-og-share.<당신의-서브도메인>.workers.dev/api/og.png?final=223억원&before=415억원&taxpct=46&country=한국+거주자
```

"223억원"이 보이는 카드 이미지가 뜨면 성공입니다.

## 4. 사이트 쪽 연동

`script.js` 맨 위쪽에 있는 `OG_SHARE_WORKER_BASE` 상수(현재 빈 문자열 `''`로 되어 있어
이 기능이 꺼져 있음)를 2번 단계에서 받은 실제 workers.dev 주소로 채운 뒤, 평소처럼
`push_files`(또는 GitHub 웹 업로드)로 반영하면 "이 결과 공유하기" 버튼이 자동으로 이
Worker를 거쳐 공유하기 시작합니다. 값을 비워두면 예전처럼(카드 없이 링크만) 동작하니,
배포 전에는 사이트에 아무 영향 없습니다.

## 참고

- 이 Worker는 사람이 링크를 클릭하면 0초 만에 실제 계산기 페이지(chamtax.com)로
  리다이렉트합니다 — 카카오톡 같은 미리보기 봇만 리다이렉트를 따라가지 않고 이 페이지의
  메타 태그(og:image 등)를 읽어서 카드를 만듭니다.
- 나중에 원하면 `wrangler.toml`의 주석 처리된 `[[routes]]` 부분을 활성화해서
  `share.chamtax.com` 같은 커스텀 서브도메인을 연결할 수 있습니다(그 경우 도메인 DNS가
  Cloudflare에 있어야 함) — 지금 당장은 필요 없습니다, workers.dev 주소로 충분합니다.
- 무료 플랜 한도: 하루 100,000 요청 — 개인 사이트 공유 트래픽으로는 충분합니다.
