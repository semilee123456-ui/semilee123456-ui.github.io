# 제미나이 검수 요청 — 이탈리아어(it) UI 언어 + 이탈리아 세금 계산 콘텐츠

## 배경
"참택스(ChamTax)"는 미국 복권(파워볼·메가밀리언즈) 당첨금의 세후 실수령액을 계산해주는
한국어 우선 웹 계산기입니다. 이번 라운드에서 이탈리아어(it)를 30번째 UI 언어로 새로 추가하고,
이탈리아를 세금 계산 대상 국가로 추가했습니다(PR #259, 병합 완료:
`https://github.com/semilee123456-ui/semilee123456-ui.github.io/pull/259`).

- 정적 텍스트 807개 키(`i18n-source/translations.json`) + 동적 문자열 304개 `more` 객체
  (`script.js`)에 실제 이탈리아어 번역 추가
- `italy-resident-us-lottery-tax.html` 신규 랜딩페이지 작성
- EUR 통화는 기존(핀란드·독일 라운드에서 이미 배선됨)을 재사용

**검수를 요청하는 두 가지가 성격이 다릅니다** — ①번역 품질(자연스러움), ②세금 조사 내용의
사실 정확성(더 중요·더 위험). 특히 ②는 실제 법조문·조세조약을 근거로 계산 로직에 반영되므로
틀리면 사용자에게 잘못된 세금 정보를 줄 수 있어 우선순위가 높습니다.

---

## ① 세금 조사 내용 사실 검증 요청 (우선순위 높음)

**결론 요약**: 이탈리아 거주자가 미국 복권에 당첨되면 "기타소득"(redditi diversi)으로 분류되어
누진세(IRPEF) 최고구간까지 과세되며, 실효세율 약 **47.23%**(IRPEF 43% + 지역세·시세 부가세
평균치). 미국 원천징수 30%는 외국세액공제(FTC)로 상쇄되지만, 이탈리아 세율이 더 높아
**약 17.23%p의 잔여세액**이 남습니다(핀란드와 구조상 가장 유사, 핀란드는 약 16.17%p).

**근거로 사용한 자료**:
- TUIR(소득세법 통합본) 제67조 1항 d호 / 제69조 1항·1-bis항 / 제165조(외국세액공제)
- Legge(법률) 122/2016 — CJEU(EU사법재판소) 판례 C-344/13 및 C-367/13(EU/EEA 외 도박소득
  과세 관련 판례)를 국내법에 반영한 개정
- 2026년 IRPEF 세율 구간 + 라치오주(Lazio)/로마시 지방세·시세 부가세(addizionale regionale
  3.33% + comunale 0.90%) — 전국 평균치가 없어 참고용 상한 근사치로 사용
- 미-이탈리아 조세조약(1984년 체결, 1999년 의정서) 제22조 원문 + 미 재무부 Technical
  Explanation(home.treasury.gov)

**에이전트가 스스로 표시한 불확실성 3가지** — 이 부분을 특히 봐주세요:
1. TUIR 제69조 1-bis항의 면세 문구가 "case da gioco"(카지노/도박장)로 되어 있어 "lotterie"
   (복권)를 명시하지 않음 — 파워볼 결론 자체는 안 바뀐다고 판단했지만 확실친 않음.
2. 지역세·시세 부가세의 전국 평균치를 찾지 못해 라치오주/로마시 수치를 상한 근사치로 사용함 —
   더 나은 전국 평균 출처가 있는지 확인 부탁드립니다.
3. 이 소득 유형에 제165조 FTC가 실제로 적용된다고 명시적으로 확인해주는 국세청(Agenzia delle
   Entrate) 해석 회신(interpello)을 찾지 못함 — 일반 원칙을 유추 적용함(덴마크·핀란드
   라운드와 동일한 신뢰도 수준).

**요청**: 위 세율 구성(43%+3.33%+0.90%=47.23%)과 조세조약 제22조 해석, TUIR 조문 인용이
실제로 맞는지 교차검증 부탁드립니다. 랜딩페이지 원문은 `italy-resident-us-lottery-tax.html`
(저장소 루트)에서 확인 가능합니다.

---

## ② 번역 품질 검수 요청 — 대표 샘플 (전체 807키 중 세무/법률 용어 위주 발췌)

전체를 다 붙이면 너무 길어서, 오역 위험이 큰 세무·법률 용어 위주로 추렸습니다. 전체 diff는
PR #259에서 확인 가능합니다.

| 키 | 영어(참고) | 이탈리아어(신규) |
|---|---|---|
| compare.disclaimer | Built with reference to IRS and Korean National Tax Service guidelines (we hope you actually get the chance to win!) | Realizzato facendo riferimento alle linee guida dell'IRS e dell'Agenzia delle Entrate coreana (speriamo tu abbia davvero la possibilità di vincere!) |
| faq.a2 | US lottery winnings aren't a domestic lottery, so they're folded into comprehensive income tax (up to 45%). Tax already paid in the US can be offset via the Foreign Tax Credit (FTC). | Sì. Le vincite alla lotteria USA non sono una lotteria nazionale, quindi vengono incluse nell'imposta complessiva sul reddito (fino al 45%). La tassa già pagata negli USA può essere compensata tramite il credito d'imposta estero (FTC). |
| faq.a3 | The 30% US federal withholding is essentially non-refundable. State tax varies — Maryland and Arizona are unusual in taxing non-residents too. | La ritenuta federale USA del 30% è praticamente non rimborsabile. La tassa statale varia — Maryland e Arizona sono insoliti nel tassare anche i non residenti. |
| faq.a6 | Common scam patterns: fake card-company reps asking for card details to "refund" a losing ticket... | Schemi di truffa comuni: finti operatori di carte di credito che chiedono i dati della carta per "rimborsare" un biglietto perdente... |
| faq.a7 | Up to 600M won to a spouse, up to 50M to adult children are tax-exempt. Amounts above are subject to a progressive 10-50% rate. | Fino a 600 milioni di won al coniuge, fino a 50 milioni ai figli maggiorenni sono esenti da imposta. Gli importi superiori sono soggetti a un'aliquota progressiva dal 10 al 50%. |
| result.taxLabel | Tax | Tasse |
| odds.disclaimer | Odds data is based on officially published figures... | I dati sulle probabilità si basano su dati ufficiali pubblicati... |

**문법 관련**: 에이전트가 자체 검토 중 "Residente di" → "Residente in"(전치사 오류) 1건을
직접 발견해 수정했다고 보고했습니다. 비슷한 전치사·관사 오류가 다른 곳에도 남아있는지
자연스러움 위주로 봐주시면 좋겠습니다.

---

## 참고 — 이번 라운드에서 발견·수정된 코드 버그 2건 (번역 내용과 무관, 참고용)
1. 2글자 언어코드를 가정한 정규식이 3글자 `tet`(테툼어) 행을 건너뛰는 버그
2. 자동 삽입 스크립트가 `${...}` 템플릿 리터럴을 백틱 대신 `JSON.stringify` 큰따옴표로 감싸
   47개 문자열이 깨졌던 버그 — Playwright로 실제 함수 반환값을 확인해서 발견함

두 버그 모두 다음 라운드(폴란드·터키)에서 재발 방지하도록 HANDOFF.md에 기록해뒀습니다.
