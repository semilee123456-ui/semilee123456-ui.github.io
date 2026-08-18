# 제미나이 검수 요청 — 터키어(tr) UI 언어 + 터키 세금 계산 콘텐츠

## 배경
"참택스(ChamTax)"는 미국 복권(파워볼·메가밀리언즈) 당첨금의 세후 실수령액을 계산해주는
한국어 우선 웹 계산기입니다. 이번 라운드에서 터키어(tr)를 32번째 UI 언어로 새로 추가하고,
터키를 세금 계산 대상 국가로 추가했습니다(PR #262, 병합 완료:
`https://github.com/semilee123456-ui/semilee123456-ui.github.io/pull/262`).

이 라운드는 이탈리아·폴란드와 성격이 또 달라서 특히 교차검증이 필요합니다 — **터키는
소득세가 아니라 상속·증여세법(VİVK)으로 과세되고, 거주지가 아니라 국적 기준**이라는,
지금까지 다룬 8개국 중 가장 이질적인 구조로 조사됐습니다.

---

## ① 세금 조사 내용 사실 검증 요청 (우선순위 높음 — 이번 라운드는 특히 신중한 확인 필요)

**결론 요약**: 터키인이 미국 복권에 당첨되면 **소득세(GVK)가 아니라 상속·증여세법
(Veraset ve İntikal Vergisi Kanunu, VİVK) 제16조**에 따라 게임/경품 당첨금에 **정률 20%**가
과세됩니다. 미국 원천징수 30%와 **상계(FTC) 불가** — 두 세금이 그냥 합산되어 실효세율
약 **50%**(예시: $100만 중 미국 -$30만, 터키 VİVK -$20만, 실수령 약 $50만).

**근거로 사용한 자료 및 핵심 논리**:
- 터키 소득세법(Gelir Vergisi Kanunu, GVK) 제82조("arızi kazançlar", 우발소득) 목록에
  복권 당첨금이 **없음**을 터키 국세청(GİB) 공식 페이지로 직접 확인
- 대신 VİVK 제16조가 "şans oyunları"(사행성 게임)·"yarışma ve çekiliş"(경연/추첨) 당첨금에
  별도로 20% 정률 과세를 규정 — 일반 상속·증여 누진 구간과 별개
- **VİVK 제1조는 과세 기준이 거주지가 아니라 터키 국적**임을 확인 — 지금까지 다룬 다른
  나라(거주지국 과세) 전부와 구조적으로 다름. 랜딩페이지에도 이 특이점을 별도로 명시
- 미-터키 조세조약(1998년 발효) 원문을 IRS PDF에서 직접 추출(pypdf/pdfminer)해서 확인:
  **제2조(대상 조세)가 소득세·법인세만 열거**하고 있어 VİVK(상속·증여세)는 애초에 이
  조약의 적용 대상이 아님 — 제21조("기타소득") 조항이 있지만 VİVK엔 적용 안 됨
- VİVK 자체의 국내법상 세액공제(제20조)도 **외국의 상속·증여세만** 상계 대상이라, 미국의
  "소득세" 원천징수는 애초에 공제 대상이 아님 — **두 가지 독립적인 이유로 FTC 자체가
  구조적으로 불가능**하다고 결론

**에이전트가 스스로 표시한 불확실성 2가지**:
1. VİVK 제16조의 "경연/추첨" 조항이 **순수 해외(미국)에서 조직된 추첨**에도 적용되는지는
   제1조의 "국적 기준 전세계 과세 범위"에 근거한 추론이며, 이를 직접 확인해주는 판례·유권
   해석은 못 찾음 — 랜딩페이지에 눈에 띄게 표시함
2. 증여형(상속이 아닌) VİVK 신고 기한의 정확한 개월 수는 확정 못함(세율 자체엔 영향 없는
   절차적 디테일)

**요청**: 특히 "① GVK 82조엔 복권이 없고 VİVK 16조가 적용된다"는 소득 성격 판단과
"② 조세조약 제2조 대상조세 목록에 VİVK가 빠져 있어 FTC가 원천적으로 불가하다"는 결론 두
가지가 이번 라운드의 핵심 주장이라, 이 부분을 최우선으로 교차검증 부탁드립니다. 원문은
`turkey-resident-us-lottery-tax.html`(저장소 루트)에서 확인 가능합니다.

---

## ② 번역 품질 검수 요청 — 대표 샘플

| 키 | 영어(참고) | 터키어(신규) |
|---|---|---|
| faq.a2 (FTC 설명, 한국 거주자용 공용 FAQ) | Tax already paid in the US can offset via Foreign Tax Credit (FTC). | ABD'de zaten ödenen vergi, Yabancı Vergi Kredisi (FTC) yoluyla mahsup edilebilir. |
| faq.a1 (원천징수 설명) | Non-US residents ... have 30% withheld by the US first | ABD'de mukim olmayanlardan ... önce ABD tarafından %30 kesilir |
| odds.jcAnnuityNote (연금 설명) | an annuity pays out the full announced jackpot over 30 payments across 29 years | taksitli ödeme açıklanan büyük ikramiyenin tamamını 29 yıl boyunca 30 ödeme halinde öder |
| result.taxLabel | Tax | Vergi |
| compare.disclaimer | Built with reference to IRS and Korean NTS guidance | IRS ve Kore Ulusal Vergi Dairesi (NTS) rehberliği referans alınarak hazırlanmıştır |

터키어 특유의 대소문자 규칙(İ/I, ı/i 점 유무)이 코드에서 문자열을 기계적으로 변환하는
부분(있다면)에 영향을 줄 수 있어 이 부분도 자연스러움과 함께 봐주시면 좋겠습니다.

---

## 참고 — 이번 라운드에서 발견·수정된 코드 버그 1건
자동 삽입 스크립트가 실수로 폴란드(`pl`)의 `COUNTRY_TAX_AUTHORITY` 항목을 터키 값으로
덮어썼던 걸 Playwright 렌더링 확인 중 발견해 커밋 전에 수정함(이탈리아·폴란드 라운드의
`${...}` 보간 문자열 버그와는 다른 종류 — 47개 보간 문자열은 이번에도 전부 정상 확인).
