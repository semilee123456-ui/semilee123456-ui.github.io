# 인수인계 — 공유 카드(OG 이미지) 작업 (2026-07-31)

이 세션(다른 세션/토큰 소진으로 종료)에서 한 작업과, **아직 안 풀린 버그** 정리.

## 이 세션에서 완료한 것

1. **GitHub App 연결** — Claude GitHub 앱을 `semilee123456-ui.github.io`에 설치 완료.
2. **PR #1 병합** — `claude/progress-checkpoint-pbf93h` 브랜치(정리·디자인 수정)를 `main`에 병합.
   병합된 브랜치는 아직 GitHub에 남아있음(기능상 문제 없음, 안 지워도 됨) — 지우려면
   저장소 Branches 탭에서 수동으로.
3. **자동 루틴 5개 전부 push_files 방식으로 전환** (기존엔 "git push는 항상 403이라 zip으로
   전달" 워크플로였는데, 실제로는 raw git push가 이 환경에서 여전히 403 — API 기반
   `mcp__github__push_files`만 동작 확인됨). 현재 트리거 ID(계속 바뀌었을 수 있으니
   `list_triggers`로 최신 확인):
   - 파워볼 잭팟 갱신 체크 (일/화/목 09:00 KST)
   - 메가밀리언즈 잭팟 갱신 체크 (수/토 09:00 KST)
   - 참택스 주간 버그·오버플로우 점검 (매주 월 09:00 KST) — SEO/QA/저장소 위생 체크 항목도
     추가해둠
   - 참택스 세법 변경 분기별 체크 (분기 1일 09:00 KST)
   - 참택스 월간 세율·환율 재검증 (매월 1일 09:00 KST)
   전부 이 세션(session_01QdsganyFSpsNLiyH9QrqBL)에 `persistent_session_id`로 고정됨 —
   이 세션이 끝나면 다음 실행 때 어떻게 되는지(새 세션? 오류?) 미확인, 다음 실행 결과를
   지켜볼 것.
4. **공유 카드(OG 이미지) 기능 신규 구축**:
   - `og-share-worker/` 폴더(Cloudflare Worker 소스, `workers-og` 패키지로 카드 PNG 생성)
   - 사용자가 Cloudflare 계정 만들어서 GitHub 연동으로 배포 완료.
     **배포된 실제 URL: `https://semilee123456-ui-github-io.semilee123456.workers.dev`**
     (Cloudflare 프로젝트 이름이 `wrangler.toml`의 `chamtax-og-share`가 아니라 CI가 정한
     `semilee123456-ui-github-io`로 override됨 — 무해하지만 참고할 것)
   - `script.js` 23번째 줄 `OG_SHARE_WORKER_BASE`에 위 주소 반영 완료(GitHub 웹 에디터로
     사용자가 직접 커밋 — 파일이 1.7MB라 push_files로는 못 올림, 앞으로도 script.js를
     통째로 고칠 일이 있으면 이 방법(정확한 줄 번호 + find/replace 지시)을 쓸 것).
   - `shareResult()` 함수(9193번째 줄 근처)에서 `OG_SHARE_WORKER_BASE`가 설정돼 있으면
     공유 URL을 `${OG_SHARE_WORKER_BASE}/s?final=...&before=...&taxpct=...&country=...&to=...`
     형태로 감싸서 내보냄. Playwright로 직접 캡처해서 URL이 정확히 만들어지는 것까지 확인함.
   - Worker의 `/api/og.png?final=223억원&before=415억원&taxpct=46&country=한국+거주자`를
     사용자가 브라우저에서 직접 열어서 카드 이미지가 뜨는 것도 육안 확인함.

## ⚠️ 2026-07-31 후속 세션 진단 — 부분 대응함, 완전히 안 풀림

**증상**: 사용자가 실제로 홈 화면에서 "이 결과 공유하기"를 눌러 카카오톡 등으로 공유했더니,
카드에 뜨는 금액이 **화면에서 본 실제 값이 아니라 예전(고정) 카드와 동일하게** 나옴.
("공유 눌러도 금액이 내가 본 금액이랑 똑같이 안나오고 기존에 나오던거랑 똑같이 나와")

**이 세션에서 확인한 것**:
- `script.js`(`shareResult()`) → Worker `/s`(`handleSharePage`) → `/api/og.png`(`handleOgImage`)
  전체 파라미터 라운드트립을 코드 리뷰로 재확인 — `final`/`before`/`taxpct`↔`takepct` 변환
  로직에 버그 없음(직접 손으로 값 대입해서 추적 완료).
- Playwright로 `shareResult()`를 실제 실행해서 `navigator.share`에 전달되는 `url`을 캡처 —
  777 Million USD 입력 시 `final=₩ 618.5 billion&taxpct=46&...`으로 **정확하게 현재 계산
  결과가 실려서 나감**을 확인함(이 세션이 만든 재현 스크립트, 아래 참고). 즉 클라이언트 쪽은
  정상.
- 이 환경(샌드박스)은 외부 네트워크가 막혀있어서(`WebFetch`/`curl` 둘 다 workers.dev에
  403) 실제 배포된 Worker에 직접 요청을 못 보내봄 — Worker 자체가 살아있는 상태에서 실제로
  뭘 돌려주는지는 이 세션에서 검증 불가능했음. `og-share-worker/src/index.js`의 git 이력은
  커밋 1개뿐(`620d5e3`)이라 배포본과 저장소 코드가 다를 가능성은 낮음.
- **가장 유력한 원인(이전 세션도 지목함)**: 카카오톡 등 링크 미리보기 봇의 URL 단위 캐싱.
  같은 파라미터 조합(특히 테스트 중 반복 사용한 금액)으로 이미 한 번 스크랩된 URL은, 실제
  카드 내용이 맞더라도 그 이후엔 캐시된 옛 미리보기를 계속 보여줄 수 있음.
- **적용한 조치**: `shareResult()`가 만드는 `/s` URL에 매번 바뀌는 캐시버스팅 파라미터
  (`t=<타임스탬프 base36>`)를 추가함 — Worker는 이 파라미터를 안 읽으므로 리다이렉트(`to=`)나
  카드 내용에는 영향 없고, 그저 "이 URL은 매번 처음 보는 URL"처럼 보이게 해서 미리보기 봇의
  URL 단위 캐시를 우회하는 목적. `node --check` 통과, Playwright 재현 스크립트로 `t=` 파라미터가
  실제로 붙는 것 확인, `home_audit.js` 등 회귀 없음 확인.
- **이걸로 완전히 해결됐다는 보장은 없음** — 캐싱이 진짜 원인이라면 이 조치로 고쳐지지만,
  다른 원인(예: 카카오톡 자체의 OS/앱 레벨 공유 캐시, 아직 못 찾은 Worker 쪽 버그)이라면
  안 고쳐질 수 있음. **사용자가 이 커밋 반영 후 "지금까지 한 번도 안 써본 완전히 새로운
  금액"으로 다시 테스트해서 결과를 알려줘야 다음 단계를 판단 가능.**

**아직 확인 안 된 것 / 다음 세션이 확인해야 할 것 (이번 세션도 못함)**:

1. **가장 유력한 원인 — 카카오톡 등 링크 미리보기 캐시**: 카톡/페이스북 등은 같은 URL의
   미리보기를 한 번 만들면 상당 기간(수 시간~며칠) 캐시해둠. 사용자가 테스트하면서 같은
   금액(예: 이전에 테스트했던 값)으로 여러 번 공유했다면, 배포 전/디버깅 중에 만들어진
   옛 미리보기가 캐시되어 그대로 보이는 것일 수 있음.
   - 확인 방법: **이전에 한 번도 공유해본 적 없는 완전히 새로운 금액**으로 다시 테스트.
   - 카카오는 자체 캐시 초기화 도구가 따로 없을 수 있음 — 대신 URL 끝에 더미 파라미터를
     붙여(`&t=아무숫자`) 매번 새 URL처럼 보이게 하는 우회도 고려 가능(단, `to=` 파라미터로
     감싸인 실제 리다이렉트 대상엔 영향 없어야 함 — Worker의 `handleSharePage`가 `to`만
     검증하고 나머지 파라미터는 미리보기 생성에만 쓰므로 안전).
   - 페이스북은 `https://developers.facebook.com/tools/debug/`에서 URL 넣고 "다시 스크랩"
     가능 — 카카오는 비슷한 공개 도구가 있는지 확인 필요.
2. **Worker 자체 로그 확인**: Cloudflare 대시보드 → Workers & Pages →
   `semilee123456-ui-github-io` 프로젝트 → **Logs**(또는 Observability) 탭에서, 실제로
   카카오봇이 `/s`와 `/api/og.png`를 요청했는지, 어떤 쿼리 파라미터로 요청했는지 확인.
   요청 자체가 안 왔다면 링크 자체가 Worker로 안 가고 있다는 뜻(예: `navigator.share`가
   실패해서 다른 경로로 공유됐을 가능성) — 요청은 왔는데 파라미터가 이상하면 `shareResult()`
   쪽 로직 재확인.
3. **`navigator.share` 실패/폴백 경로 재확인**: `shareResult()` 맨 아래, `navigator.share`가
   없거나 실패하면 클립보드 복사로 폴백함(`${shareText} ${shareUrl}`를 복사). 사용자가 이
   폴백 경로로 카카오톡에 "붙여넣기"했다면, 붙여넣은 텍스트 안의 `shareUrl`이 실제로 Worker
   주소인지(아니면 예전 `chamtax.com/?amount=...` 그대로인지) 확인 필요 — 캐시된 브라우저가
   구 버전 script.js를 물고 있었을 가능성도 배제 말 것(script.js에
   `?v=` 캐시버스팅 쿼리스트링이 있는지, 있다면 최근 갱신했는지 index.html에서 확인).
4. **직접 재현 테스트 절차**(다음 세션이 바로 실행 가능):
   ```bash
   cd /workspace/semilee123456-ui.github.io  # 없으면 add_repo(access:"push")로 재클론
   python3 -m http.server 9000 --directory . &  # 반드시 run_in_background로, 포트 9000 고정(테스트 스크립트들이 하드코딩)
   NODE_PATH=/opt/node22/lib/node_modules node -e "
   const { chromium } = require('playwright');
   (async () => {
     const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
     const page = await browser.newPage();
     await page.goto('http://127.0.0.1:9000/index.html?v=' + Date.now());
     await page.waitForTimeout(300);
     const result = await page.evaluate(async () => {
       document.getElementById('homeAmountInput').value = '<지금까지 한 번도 안 써본 금액>';
       onHomeAmountTyped();
       await new Promise(r => setTimeout(r, 1200));
       let captured = null;
       navigator.share = async (opts) => { captured = opts; };
       await shareResult();
       return captured;
     });
     console.log(JSON.stringify(result, null, 2));
     await browser.close();
   })();
   "
   ```
   여기서 나온 `url` 값을 실제 브라우저(또는 카카오톡 링크 미리보기 시뮬레이터 등)에 넣어서
   카드가 맞게 뜨는지 확인. 이 자체가 맞으면 Worker/script.js 쪽은 정상이고, 카카오 캐시
   문제로 좁혀짐.

## 알아둘 것

- `script.js`는 1.7MB라 `push_files`/`create_or_update_file`로 통째로 못 올림 — 항상
  정확한 줄 번호 + find/replace로 사용자에게 GitHub 웹 에디터 수정을 안내할 것(이번 세션에서
  2번 다 사용자가 원본 줄 삭제를 빼먹어서 중복 선언 문법 오류가 났었음 — "이 줄을 통째로
  **바꿔주세요**"라고 명확히 하고, 바뀐 뒤 스크린샷으로 재확인하는 절차를 꼭 거칠 것).
- 로컬 git push는 이 환경에서 항상 403 — `mcp__github__push_files`/`create_or_update_file`
  API만 사용할 것(자세한 진단 과정은 메인 `HANDOFF.md`의 "정정" 섹션 참고, 단 그 파일도
  10만 토큰 넘어서 통째로 못 올림 — grep으로 필요한 부분만 읽을 것).
- `og-share-worker/`는 Cloudflare 대시보드에서 GitHub 연동(Git 기반 자동 배포)으로 붙여둠 —
  앞으로 `og-share-worker/` 폴더에 커밋이 올라가면 Cloudflare가 알아서 재배포함(수동 재배포
  불필요).
