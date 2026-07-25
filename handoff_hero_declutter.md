# 참택스(ChamTax) 홈 화면 정리 — 코드팀 인수인계 (2026-07-25)

이 문서는 `styles.css` 한 파일(+ 색상 팔레트를 복제해 쓰는 랜딩페이지 5개)에 적용된
수정 내역을 속성 단위로 전부 나열합니다. 실제로 로컬 서버 + Playwright로 라이트/다크
모드 모바일 화면(390px)을 캡처해서 시각적으로도 확인했습니다(첨부 스크린샷 참고).

---

## 1. 히어로 섹션 정리 (홈 화면 최상단)

목표: 알약(pill) 모양 배지가 3개 겹쳐 보이던 것(네비 필·카테고리 태그·제목)을
네비 필 + 일반 제목으로 단순화.

| 선택자 | 속성 | 변경 전 | 변경 후 |
|---|---|---|---|
| `.nav` | `margin-bottom` | `24px` | `16px` |
| `.hero` | `padding` | `16px 0 24px` | `8px 0 20px` |
| `.hero-category-tag` | `font-weight` | `800` | `600` |
| `.hero-category-tag` | `color` | `var(--teal)` | `var(--text-muted)` |
| `.hero-category-tag` | `background` | `rgba(var(--teal-rgb),0.08)` | `none` |
| `.hero-category-tag` | `padding` | `5px 14px` | `0` |
| `.hero-category-tag` | `margin` | `0 0 10px` | `0 0 8px` |
| `.hero-amount` | `line-height` | `1.4` | `1.3` |

`.hero-category-tag`는 "📋 US Lottery Tax Calculator" 배지, `.hero-amount`는
`<h1>` 메인 제목("내 통장에는 실제로 얼마 들어올까?")에만 쓰이는 클래스라 다른 화면에
영향 없음(index.html 전체에서 각각 1곳씩만 사용).

---

## 2. 정보 배지 2개 — 알약형 → 일반 텍스트

### `.same-place-box` ("📍 파는 곳: 동일!" — FAQ 탭, 용어 비교 아코디언 안)

| 속성 | 변경 전 | 변경 후 |
|---|---|---|
| `background` | `rgba(var(--ink-rgb),0.06)` | `none` |
| `border` | `1.5px dashed var(--seafoam)` | `none` |
| `border-radius` | `10px` | `0` |
| `padding` | `10px 14px` | `0` |

(`text-align`, `font-size`, `font-weight`, `color`, `margin-top`은 그대로 유지)

### `.faq-audience-badge` ("🌏 해외 거주 한국인 전용" 등 — FAQ 질문 옆 태그)

| 속성 | 변경 전 | 변경 후 |
|---|---|---|
| `font-size` | `14px` | `16px` |
| `background` | `rgba(var(--teal-rgb),0.1)` | `none` |
| `padding` | `2px 8px` | `0` |

**14px→16px는 단순 미관이 아니라 접근성 수정**입니다 — 이 사이트 CSS 최상단에
"본문 최소 폰트는 16px(시니어 가독성 연구 최소 권장치)"라고 명시된 하한선이 있는데,
이 배지만 14px로 그 아래였던 걸 맞춘 것.

---

## 3. 다크모드 죽은 코드 제거

`.country-map-land.active`의 다크모드 전용 override 한 줄을 삭제:

```css
/* 삭제된 줄 */
:root[data-theme="dark"] .country-map-land.active{ fill:rgba(58,169,138,0.35); }
```

이유: 이미 base 규칙(`.country-map-land.active{ fill:rgba(var(--teal-rgb),0.35); ... }`)이
`--teal-rgb` 변수를 쓰고 있고, 이 변수는 다크모드에서 `58,169,138`로 자동 치환되므로
(`:root[data-theme="dark"]{ --teal-rgb: 58,169,138; }`) 위 override는 정확히 같은 값을
하드코딩으로 중복 선언한 죽은 코드였음. 삭제해도 렌더링 결과는 100% 동일.

---

## 4. 랜딩페이지 5개 — 다크모드 teal 틴트 버그 동기화

`styles.css`에는 이미 적용됐던 `--teal-rgb` 다크모드 수정(이전 커밋)을, 색상 팔레트를
각자 `:root`로 중복 정의해 쓰는 아래 5개 독립 페이지에도 동일하게 적용:

- `korea-resident-us-lottery-tax.html`
- `megamillions-tax.html`
- `powerball-tax.html`
- `us-lottery-take-home.html`
- `us-lottery-tax-rate.html`

각 파일 `:root`에 `--teal-rgb:21,84,69;`, `:root[data-theme="dark"]`에
`--teal-rgb:58,169,138;` 추가 후, 파일 내 모든 `rgba(21,84,69,...)` 하드코딩을
`rgba(var(--teal-rgb),...)`로 치환(korea-resident 4곳, 나머지 4개 파일 각 2~3곳).

---

## 검증 방법

- 로컬 서버(`python3 -m http.server 9000`) + Playwright로 390px 모바일 뷰포트에서
  라이트/다크 모드 실제 렌더링 스크린샷 확인(`screenshots/` 폴더, 01~05번)
- 전체 회귀 테스트 스위트 통과 (`home_audit`, `audit_odds_compare`,
  `console_error_audit`, `wrap_audit`, `faq_audit`, `nav_slider_audit`,
  `broken_link_audit`, `i18n_attr_lint` — 전부 `ISSUES: 0`)
- **서브에이전트 독립 재검증 완료(PASS)** — 이 세션과 별개로 새로 띄운 서브에이전트가
  git diff, 라이브 렌더링(라이트+다크, `screenshots/` 06~08번), 회귀 테스트를 처음부터
  다시 전부 재실행해서 확인. 발견된 불일치 사항 없음. 추가로:
  - 접근성: `.faq-audience-badge` 16px는 사이트 자체 하한선(`--fs-small:16px`) 충족
  - 명암비 실측: 라이트모드 `--teal(#155445)` on `--bg(#FAF6EC)` = 8.16:1,
    다크모드 `--teal(#3AA98A)` on `--bg(#1B1917)` = 6.03:1 — 둘 다 WCAG AA(4.5:1) 여유 통과
  - 사이드이펙트 없음 확인: `.hero-category-tag`/`.hero-amount`/`.faq-audience-badge`/
    `.same-place-box`는 각각 index.html에서 딱 1곳씩만 쓰여서 다른 화면에 영향 없음.
    `.country-map-land`(active 아닌 기본 규칙)는 script.js에서 여러 곳에 재사용되지만
    이번엔 건드리지 않았고, 지운 건 다크모드 `.active` 전용 중복 override 한 줄뿐.

## 커밋

- `c0983df` — Declutter hero section and downgrade two info badges to plain text
- `4062a16` — Apply --teal-rgb dark-mode fix to the 5 standalone landing pages

(브랜치: `claude/new-session-98ztv4`)
