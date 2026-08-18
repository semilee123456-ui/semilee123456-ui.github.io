# 제미나이 검수 요청 — 폴란드어(pl) UI 언어 + 폴란드 세금 계산 콘텐츠

## 배경
"참택스(ChamTax)"는 미국 복권(파워볼·메가밀리언즈) 당첨금의 세후 실수령액을 계산해주는
한국어 우선 웹 계산기입니다. 이번 라운드에서 폴란드어(pl)를 31번째 UI 언어로 새로 추가하고,
폴란드를 세금 계산 대상 국가로 추가했습니다(PR #260, 병합 완료:
`https://github.com/semilee123456-ui/semilee123456-ui.github.io/pull/260`).

- 정적 텍스트 807개 키(`i18n-source/translations.json`) + 동적 문자열 305개 `more` 객체
  (`script.js`)에 실제 폴란드어 번역 추가
- `poland-resident-us-lottery-tax.html` 신규 랜딩페이지 작성
- PLN(즈워티) 신규 통화 배선 (유로존 재사용이 아닌 진짜 신규 환율)

앞서 이탈리아 라운드처럼, ①세금 조사 내용의 사실 정확성(우선순위 높음)과 ②번역 품질을 나눠서
정리했습니다.

---

## ① 세금 조사 내용 사실 검증 요청 (우선순위 높음)

**결론 요약**: 폴란드 거주자가 미국 복권에 당첨되면 폴란드 소득세법(PIT법)상 "기타소득"으로
분류되어 누진세(12%/32%) + 연대세(danina solidarnościowa, 100만 즈워티 초과분 +4%)가 적용되어
실효세율 약 **36%**. 미국 원천징수 30%는 비례 외국세액공제로 상쇄되지만 폴란드 세율이 더 높아
**약 6%p의 잔여세액**이 남습니다 — 지금까지 다룬 나라 중 (0이 아닌) 잔여세액 중 가장 작은 규모.

**근거로 사용한 자료**:
- 폴란드 PIT법(ustawa o PIT) 제30조 1항 2호 — EU/EEA에서 조직된 게임에만 적용되는 10~15%
  우대 정률세는 미국 복권엔 해당 없음을 확인, 미국 복권은 제20조/제10조1항9호(기타소득) →
  제27조 누진세율(12%/32%) 적용
- 제30h조 — 연대세(100만 즈워티 초과분 +4%, 폴란드 고유 세목)
- **미-폴란드 조세조약 원문을 IRS.gov에서 직접 열람** — 1974년 체결 조약이 현재도 유효한
  유일한 조약임을 확인(IRS가 2026년 5월 갱신한 조약 목록에도 이것만 등재). 독일·네덜란드·
  덴마크·핀란드·이탈리아 조약에 있는 "기타소득(Other Income)" 별도 조항이 **폴란드 조약엔
  아예 없음** — 즉 미국의 30% 원천징수가 이론상으로도 조약과 상충하지 않는, 다른 6개국과는
  다른 구조

**에이전트가 스스로 표시한 불확실성 3가지**:
1. 연대세(danina solidarnościowa, +4%)가 외국세액공제로 상쇄 가능한지 1차 자료를 못 찾아
   보수적으로 "공제 불가"로 계산 — 실제로는 공제 가능할 수도 있음
2. 36% 정률 모델은 큰 잭팟엔 정확하지만 $100만 근처 금액엔 약간 과대추정(정밀 구간 계산 시
   약 34.2%) — 랜딩페이지 gray-zone-box에 명시
3. 2013년 미-폴란드 신규 조세조약이 실제 발효됐는지 — 정황상(IRS 목록에 1974년 조약만 등재)
   미발효로 판단했으나, 명시적 "미발효" 확인 자료는 못 찾음

**요청**: 위 1974년 조약 사용 판단(신규 조약 미발효 추정), PIT법 제30조/제27조/제30h조 인용,
36%(≈$1,000,000 예시 기준 실제 계산은 –$60,000, 세율 다소 다름) 세율 구성이 맞는지 교차검증
부탁드립니다. 원문은 `poland-resident-us-lottery-tax.html`(저장소 루트)에서 확인 가능합니다.

---

## ② 번역 품질 검수 요청 — 대표 샘플

| 키 | 영어(참고) | 폴란드어(신규) |
|---|---|---|
| faq.a2 (FTC 설명) | Tax already paid in the US can offset via Foreign Tax Credit (FTC). | Podatek zapłacony już w USA można zaliczyć dzięki uldze z tytułu podatku zagranicznego (FTC). |
| faq.a3 (원천징수 환급 불가) | The 30% US federal withholding is practically non-refundable. | 30% federalnego podatku pobranego u źródła w USA praktycznie nie podlega zwrotowi. |
| faq.a6 (사기 경고) | Common scam patterns: impersonating card companies... | Typowe schematy oszustw: podszywanie się pod firmy kartowe... |
| result.taxLabel | Tax | Podatek |
| odds.annuityScheduleGross | Pre-tax payment | Wypłata przed opodatkowaniem |
| compare.disclaimer | Built with reference to IRS and Korean NTS guidance | Stworzone na podstawie wytycznych IRS i koreańskiego urzędu skarbowego NTS |

세무 용어(ulga z tytułu podatku zagranicznego = FTC, podatek pobrany u źródła = 원천징수)가
표준적인 폴란드 세무 용어로 보입니다만, 자연스러운 폴란드어 원어민 관점에서 어색한 부분이
있는지 봐주시면 좋겠습니다.

---

## 참고 — 이번 라운드에서 재확인/적용한 이전 라운드의 교훈
- 이탈리아 라운드가 남긴 두 함정(2글자 언어코드 가정 정규식 버그, `${...}` 보간 문자열이
  `JSON.stringify` 큰따옴표로 잘못 삽입되는 버그)을 이번 라운드에서 사전 방지 조치함(정규식을
  `[a-z]{2,3}`로 수정, 47개 보간 문자열 전부 백틱 템플릿 리터럴로 삽입됐는지 직접 검증).
