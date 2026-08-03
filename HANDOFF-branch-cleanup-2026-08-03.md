# 인수인계 — 브랜치 정리 (2026-08-03)

## 배경

저장소에 다른 세션들이 만든 `claude/*` 브랜치가 10개 쌓여있는 걸 발견(사용자가 여러 다른
"아이디"/세션에서 각각 작업을 시켜서 생김). 삭제 전에 병합 안 된 진짜 작업이 있는지 확인함.

## 이번에 한 것

**PR #86 생성·병합** — `claude/github-handover-file-check-29r6r0` 브랜치에 main에 반영 안 된
커밋 2개가 남아있던 걸 발견해서 병합함:
- "이 결과 공유하기" 항상 금액 카드로 공유하도록 변경(기존엔 금액을 직접 입력/조작 안 했으면
  금액 없는 소개 카드로 대체됐음 — 더 이상 안 쓰는 `shareGenericPromo()` 제거)
- 홈 결과 카드 "합계" 줄에 일시불 기준 표기 추가

병합 시 "Workers Builds: semilee123456-ui-github-io" 체크가 실패 상태였는데, 이 PR은
`script.js` 한 파일만 건드려서 `og-share-worker/`와는 무관 — 관계없는 파일 변경인데도 이
체크가 실패로 뜨는 것으로 확인됨(다른 여러 브랜치에서도 동일 증상). 무시하고 병합했음.

**✅ 이후 원인 파악·해결함 (같은 날 후속 작업)**: Cloudflare 대시보드 →
Workers & Pages → `semilee123456-ui-github-io` → Settings → Build 확인 결과, 두 가지가
원인이었음:
1. **Branch control**: "Builds for non-production branches"가 Enabled로 되어 있어서,
   `main`이 아닌 아무 브랜치에 푸시만 해도 실제 **production**에 배포를 시도하고 있었음
   (details_url이 `.../production/builds/...`였던 이유). 이건 단순 CI 소음이 아니라, 오래된/
   미완성 브랜치가 실수로 라이브 Worker를 덮어쓸 수 있는 실제 위험이었음.
2. **Build watch paths**: "Include paths: `*`"(저장소 전체)로 되어 있어서, `og-share-worker`와
   무관한 파일(예: script.js, HTML 페이지)이 바뀌어도 이 빌드가 매번 돌았음.

**조치 완료**: ① Branch control → "Builds for non-production branches" **Disabled**로 변경
(이제 `main` 병합 시에만 배포됨). ② Build watch paths → `*`를 지우고 **`og-share-worker/*`**로
변경(이제 그 폴더가 바끈 때만 빌드가 돌). 둘 다 사용자가 대시보드에서 직접 저장 완료,
설정 화면에 반영된 것까지 확인함. 앞으로 무관한 PR/브랜치에서 이 체크가 실패로 뜨는 일은
없을 것으로 예상됨 — 혼시 또 발생하면 이 두 설정이 원래대로 되돌아갔는지부터 확인할 것.

## 브랜치별 상태 (2026-08-03 기준)

| 브랜치 | 상태 | 삭제해도 되나 |
|---|---|---|
| `claude/progress-checkpoint-pbf93h` | PR #1로 병합됨 | ✅ 안전 |
| `claude/github-latest-files-check-j9xthk` | main 대비 0 ahead | ✅ 안전 |
| `claude/github-file-review-handover-9up48b` | PR #80으로 병합됨 | ✅ 안전 |
| `claude/github-handover-review-ma18qt` | PR #77로 병합됨 | ✅ 안전 |
| `claude/handover-file-review-0l6xtv` | 고유 커밋이 PR #83/84/85 내용과 중복(이미 main에 다른 SHA로 반영됨) | ✅ 안전 |
| `claude/github-handover-file-check-29r6r0` | PR #86으로 병합 완료(이번에 처리함) | ✅ 이제 안전 |
| `claude/connection-issue-tqhm4t` | 고유 커밋 전부 오래된 PR(#29~#70) — main에 이미 반영됨 | ✅ 안전 |
| `claude/github-file-check-g50n55` | 고유 커밋 전부 오래된 PR(#29~#49) — main에 이미 반영됨 | ✅ 안전 |
| `claude/github-handover-index-review-49ksjq` | 고유 커밋 전부 오래된 PR(#22~#40) — main에 이미 반영됨 | ✅ 안전 |
| `claude/github-work-handover-lqgr9p` | 고유 커밋 전부 오래된 PR(#1~#27) — main에 이미 반영됨 | ✅ 안전 |

(2026-08-03 후속 세션에서 확인 완료) 위 4개를 `git fetch` + `git merge-base --is-ancestor`로
직접 검사함 — main의 최신 스냅샷과 diff하면 4개 전부 "추가 218~698줄 / 삭제 1243~3313줄"로
**main보다 뒤처진 오래된 브랜치**였고(새 작업이 없고 오히려 그 뒤 main에서 지워진/바뀐
내용을 아직 갖고 있는 상태), 고유 커밋에 찍힌 PR 번호(#1~#70)가 전부 이미 main에 반영된
범위였음. 결정적 확인: `claude/connection-issue-tqhm4t`의 유일한 실작업 커밋("TTS 이모지
제거", PR #70)의 실제 코드(`speechSynthesis` 관련 이모지 제거 로직)가 현재 `script.js`에
이미 존재하고, `HANDOFF.md`에도 PR #70 기록이 이미 있음을 확인 → 4개 전부 안전하게 삭제
가능. 이제 10개 브랜치(`main` 제외) 전부 확인 완료.

## 남은 일

- 위 10개 브랜치(`main` 제외) 전부 GitHub 웹 UI(Branches 탭)에서 삭제 —
  git push/API로 브랜치 삭제하는 도구가 없어서 사용자가 직접 해야 함(자세한 내용은
  `HANDOFF-og-share-2026-07-31.md`의 "알아둘 것" 섹션 참고).
