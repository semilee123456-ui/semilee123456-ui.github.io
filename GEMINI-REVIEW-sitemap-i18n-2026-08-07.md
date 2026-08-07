# 제미나이 검수 요청 — 사이트맵 페이지 26개 언어 번역 품질 확인

## 배경
"참택스(ChamTax)"는 미국 복권(파워볼·메가밀리언즈) 당첨금의 세후 실수령액을 계산해주는
한국어 우선 웹 계산기입니다. 계산기 본체(`index.html`)는 27개 언어(한국어+26개)를 지원하는데,
`sitemap.html`(전체 페이지 목록 페이지)은 지금까지 한국어 고정이었습니다. 사용자가 계산기에서
중국어로 언어를 바꾼 뒤 사이트맵 링크를 눌렀는데 페이지가 여전히 한국어로만 나온다고 제보해서,
사이트맵 페이지의 **틀(제목·설명·섹션 소제목 등)**도 계산기와 동일하게 26개 언어로 번역했습니다.

**개별 링크 목록의 표시 텍스트는 번역하지 않았습니다** — 이건 의도적입니다. 각 나라/언어별
안내 페이지(예: 중국 거주자 페이지, 베트남어 가이드)는 원래 그 나라/언어 그대로 표기하는 게
기존 관례라서(`index.html`의 "더 알아보기" 링크 목록도 같은 원칙), 이번엔 손 안 댔습니다.
번역이 필요한 건 h1·리드 문단·섹션 제목(h2)·섹션 설명·뒤로가기 링크·disclaimer·title/meta
태그, 총 13개의 새 문구(+ 계산기에서 이미 번역돼있던 3개 문구를 그대로 재사용)입니다.

## 구현 방식 (검토해주시면 좋은 부분)
- 언어 감지 우선순위: `?lang=` URL 파라미터 → `localStorage.getItem('chamtax_lang')` → 기본값 `ko`.
  계산기(`index.html`)와 동일한 우선순위를 그대로 씀. 이 페이지 자체에는 언어를 바꾸는 UI가
  없고, 오직 계산기 쪽에서 이미 저장된 값을 "읽기"만 함(이 페이지에서 `localStorage.setItem`은
  절대 안 함 — 계산기 설정을 덮어쓸 위험 방지).
- 아랍어(ar)·우르두어(ur)일 때 `dir="rtl"` 적용, 나머지는 기본 LTR.
- `<title>`/`meta description`/`og:title`/`og:description`/`twitter:title`/`twitter:description`/
  `og:locale`도 함께 번역·전환.
- **알려진 한계**: 이 페이지는 정적 HTML이라 서버사이드 렌더링이 아니라 클라이언트 JS로
  텍스트를 교체하는 방식이에요. 즉 URL 파라미터 없이 직접 방문(구글 검색 등)하면 여전히
  한국어로 보이고, 검색엔진도 기본적으로 한국어 버전만 색인함 — 이건 `index.html`도 이미
  같은 구조라 새로운 문제는 아니고, 기존 설계와 일관성을 맞춘 것입니다. 이 부분에 대한 의견도
  주시면 좋겠습니다(예: 26개 언어 검색 노출까지 원한다면 이 방식으론 부족하고 별도 정적 페이지가
  필요한데, 그 정도 투자가 이 낮은 우선순위 페이지에 맞는 방향인지).

## 번역 검수를 요청하는 이유
13개 문구 × 26개 언어 = 338개 문자열을 제가 직접 번역했습니다. 크메르어·라오어·싱할라어·
키르기스어·카자흐어·테툼어·우즈베크어·몽골어·미얀마어처럼 자원이 적은 언어는 특히 자신이
없어서, 자연스러운지/의미가 맞는지 교차검수를 부탁드립니다. **이미 직접 발견해서 고친 실수**:
아랍어 문장 2곳에 실수로 중국어식 마침표(。)가 섞여있던 걸 발견해서 일반 마침표(.)로
고쳤습니다 — 비슷한 복사 실수가 다른 언어에도 있는지 함께 봐주시면 좋겠습니다.

## 번역 문구 전체 (한국어 원문 → 26개 언어)

### 1. `<title>` / og:title / twitter:title
- ko: 사이트맵 — 전체 페이지 목록 | 참택스
- en: Sitemap — All Pages | ChamTax
- zh: 网站地图 — 全部页面 | ChamTax
- vi: Sơ đồ trang web — Toàn bộ trang | ChamTax
- th: แผนผังเว็บไซต์ — หน้าทั้งหมด | ChamTax
- ru: Карта сайта — Все страницы | ChamTax
- km: ផែនទីគេហទំព័រ — ទំព័រទាំងអស់ | ChamTax
- ne: साइटम्याप — सबै पृष्ठहरू | ChamTax
- id: Peta Situs — Semua Halaman | ChamTax
- my: ဆိုက်မြေပုံ — စာမျက်နှာအားလုံး | ChamTax
- si: අඩවි සිතියම — සියලුම පිටු | ChamTax
- uz: Sayt xaritasi — Barcha sahifalar | ChamTax
- mn: Сайтын зураглал — Бүх хуудас | ChamTax
- kk: Сайт картасы — Барлық беттер | ChamTax
- ky: Сайт картасы — Бардык баракчалар | ChamTax
- ur: سائٹ میپ — تمام صفحات | ChamTax
- bn: সাইটম্যাপ — সব পৃষ্ঠা | ChamTax
- lo: ຜັງເວັບໄຊທ໌ — ໜ້າທັງໝົດ | ChamTax
- ja: サイトマップ — 全ページ | ChamTax
- ar: خريطة الموقع — كل الصفحات | ChamTax
- hi: साइटमैप — सभी पेज | ChamTax
- fr: Plan du site — Toutes les pages | ChamTax
- tl: Sitemap — Lahat ng Pahina | ChamTax
- pt: Mapa do site — Todas as páginas | ChamTax
- es: Mapa del sitio — Todas las páginas | ChamTax
- uk: Карта сайту — Усі сторінки | ChamTax
- tet: Mapa Website — Pájina Hotu | ChamTax

### 2. h1 (제목만, "| ChamTax" 없이)
- ko: 사이트맵
- en: Sitemap / zh: 网站地图 / vi: Sơ đồ trang web / th: แผนผังเว็บไซต์ / ru: Карта сайта /
  km: ផែនទីគេហទំព័រ / ne: साइटम्याप / id: Peta Situs / my: ဆိုက်မြေပုံ / si: අඩවි සිතියම /
  uz: Sayt xaritasi / mn: Сайтын зураглал / kk: Сайт картасы / ky: Сайт картасы /
  ur: سائٹ میپ / bn: সাইটম্যাপ / lo: ຜັງເວັບໄຊທ໌ / ja: サイトマップ / ar: خريطة الموقع /
  hi: साइटमैप / fr: Plan du site / tl: Sitemap / pt: Mapa do site / es: Mapa del sitio /
  uk: Карта сайту / tet: Mapa Website

### 3. meta description / og:description / twitter:description
- ko: 참택스의 모든 페이지를 한눈에 — 계산기, 21개국 거주자별 세금 안내, 26개 언어 가이드, 한국 거주 외국인용 페이지까지 전체 목록이에요.
- en: All ChamTax pages at a glance — the calculator, tax guides by country of residence (21 countries), guides in 26 languages, and pages for foreign residents in Korea.
- zh: 一览ChamTax全部页面 — 计算器、21个国家/地区居民税务指南、26种语言指南，以及面向在韩外国人的页面。
- vi: Toàn bộ trang của ChamTax trong một cái nhìn — máy tính, hướng dẫn thuế theo quốc gia cư trú (21 quốc gia), hướng dẫn bằng 26 ngôn ngữ, và trang dành cho người nước ngoài sống tại Hàn Quốc.
- th: หน้าทั้งหมดของ ChamTax ในที่เดียว — เครื่องคำนวณ คู่มือภาษีตามประเทศที่พำนัก (21 ประเทศ) คู่มือ 26 ภาษา และหน้าสำหรับชาวต่างชาติที่อาศัยในเกาหลี
- ru: Все страницы ChamTax в одном месте — калькулятор, налоговые руководства по 21 стране проживания, руководства на 26 языках и страницы для иностранцев, живущих в Корее.
- km: ទំព័រទាំងអស់របស់ ChamTax នៅកន្លែងតែមួយ — ម៉ាស៊ីនគណនា មគ្គុទ្ទេសក៍ពន្ធតាមប្រទេសនៅ (២១ប្រទេស) មគ្គុទ្ទេសក៍ជា ២៦ ភាសា និងទំព័រសម្រាប់ជនបរទេសរស់នៅកូរ៉េ។
- ne: ChamTax का सबै पृष्ठ एकै ठाउँमा — क्यालकुलेटर, बसोबास गर्ने देश अनुसार कर गाइड (२१ देश), २६ भाषामा गाइड, र कोरियामा बस्ने विदेशीहरूका लागि पृष्ठहरू।
- id: Semua halaman ChamTax dalam satu tempat — kalkulator, panduan pajak berdasarkan negara domisili (21 negara), panduan dalam 26 bahasa, dan halaman untuk warga asing yang tinggal di Korea.
- my: ChamTax ရဲ့ စာမျက်နှာအားလုံးကို တစ်နေရာတည်းမှာ — ဂဏန်းတွက်စက်၊ နေထိုင်သည့်နိုင်ငံအလိုက် အခွန်လမ်းညွှန် (နိုင်ငံ ၂၁ ခု)၊ ဘာသာစကား ၂၆ မျိုးဖြင့် လမ်းညွှန်များနှင့် ကိုရီးယားတွင်နေထိုင်သော နိုင်ငံခြားသားများအတွက် စာမျက်နှာများ။
- si: ChamTax හි සියලුම පිටු එකම තැනක — ගණකය, පදිංචි රට අනුව බදු මාර්ගෝපදේශ (රටවල් 21), භාෂා 26කින් මාර්ගෝපදේශ, සහ කොරියාවේ පදිංචි විදේශිකයන් සඳහා පිටු.
- uz: ChamTax'ning barcha sahifalari bir joyda — kalkulyator, yashash mamlakati bo'yicha soliq qo'llanmalari (21 mamlakat), 26 tilda qo'llanmalar va Koreyada yashovchi xorijliklar uchun sahifalar.
- mn: ChamTax-ийн бүх хуудсыг нэг дороос — тооцоолуур, оршин суугаа улсаар татварын гарын авлага (21 улс), 26 хэл дээрх гарын авлага, Солонгост амьдардаг гадаадынхны хуудас.
- kk: ChamTax-тың барлық беттері бір жерде — калькулятор, тұратын елі бойынша салық нұсқаулықтары (21 ел), 26 тілдегі нұсқаулықтар және Кореяда тұратын шетелдіктерге арналған беттер.
- ky: ChamTax'тын бардык баракчалары бир жерде — эсептегич, жашаган өлкө боюнча салык колдонмолору (21 өлкө), 26 тилде колдонмолор жана Кореяда жашаган чет элдиктер үчүн баракчалар.
- ur: ChamTax کے تمام صفحات ایک جگہ — کیلکولیٹر، رہائشی ملک کے مطابق ٹیکس گائیڈز (21 ممالک)، 26 زبانوں میں گائیڈز، اور کوریا میں رہنے والے غیر ملکیوں کے لیے صفحات۔
- bn: ChamTax-এর সব পৃষ্ঠা এক জায়গায় — ক্যালকুলেটর, বসবাসের দেশ অনুযায়ী কর গাইড (২১টি দেশ), ২৬টি ভাষায় গাইড, এবং কোরিয়ায় বসবাসরত বিদেশিদের জন্য পৃষ্ঠা।
- lo: ໜ້າທັງໝົດຂອງ ChamTax ຢູ່ບ່ອນດຽວ — ເຄື່ອງຄິດໄລ່, ຄູ່ມືພາສີຕາມປະເທດທີ່ອາໄສຢູ່ (21 ປະເທດ), ຄູ່ມື 26 ພາສາ, ແລະໜ້າສຳລັບຄົນຕ່າງຊາດທີ່ອາໄສຢູ່ເກົາຫຼີ.
- ja: ChamTaxの全ページを一覧で — 計算機、居住国別の税金ガイド（21カ国）、26言語のガイド、韓国在住外国人向けページまで。
- ar: جميع صفحات ChamTax في مكان واحد — الآلة الحاسبة، أدلة الضرائب حسب بلد الإقامة (21 دولة)، أدلة بـ26 لغة، وصفحات للأجانب المقيمين في كوريا.
- hi: ChamTax के सभी पेज एक ही जगह — कैलकुलेटर, निवास देश के अनुसार टैक्स गाइड (21 देश), 26 भाषाओं में गाइड, और कोरिया में रहने वाले विदेशियों के लिए पेज।
- fr: Toutes les pages de ChamTax en un coup d'œil — le calculateur, des guides fiscaux par pays de résidence (21 pays), des guides en 26 langues, et des pages pour les résidents étrangers en Corée.
- tl: Lahat ng pahina ng ChamTax sa isang tingin — ang calculator, gabay sa buwis ayon sa bansang tinitirhan (21 bansa), gabay sa 26 wika, at mga pahina para sa mga dayuhang naninirahan sa Korea.
- pt: Todas as páginas do ChamTax em um só lugar — a calculadora, guias fiscais por país de residência (21 países), guias em 26 idiomas e páginas para estrangeiros residentes na Coreia.
- es: Todas las páginas de ChamTax en un vistazo — la calculadora, guías fiscales por país de residencia (21 países), guías en 26 idiomas y páginas para extranjeros residentes en Corea.
- uk: Усі сторінки ChamTax в одному місці — калькулятор, податкові гіди за країною проживання (21 країна), гіди 26 мовами та сторінки для іноземців, які живуть у Кореї.
- tet: Pájina hotu ChamTax nia iha fatin ida — kalkuladora, gia impostu tuir nasaun hela (nasaun 21), gia iha lian 26, no pájina ba estranjeiru sira hela iha Koreia.

### 4. 리드 문단
- ko: 참택스에 있는 전체 페이지 목록이에요. 계산기 안에서 드롭다운으로도 갈 수 있지만, 여기서 한 번에 찾는 게 더 빠를 수도 있어요.
- en: This is the full list of pages on ChamTax. You can also reach them from the dropdown inside the calculator, but finding them here all at once might be faster.
- zh: 这是ChamTax全部页面的列表。您也可以通过计算器内的下拉菜单前往，但在这里一次找到可能更快。
- vi: Đây là danh sách đầy đủ các trang trên ChamTax. Bạn cũng có thể vào từ menu thả xuống trong máy tính, nhưng tìm ở đây một lần có thể nhanh hơn.
- th: นี่คือรายชื่อหน้าทั้งหมดบน ChamTax คุณสามารถไปที่หน้าเหล่านี้ผ่านเมนูดรอปดาวน์ในเครื่องคำนวณได้เช่นกัน แต่การหาที่นี่ทีเดียวอาจเร็วกว่า
- ru: Это полный список страниц ChamTax. Их также можно найти через выпадающее меню в калькуляторе, но здесь искать всё сразу может быть быстрее.
- km: នេះជាបញ្ជីទំព័រទាំងអស់នៅលើ ChamTax។ អ្នកក៏អាចចូលទៅកាន់វាតាមម៉ឺនុយទម្លាក់ចុះនៅក្នុងម៉ាស៊ីនគណនាបានដែរ ប៉ុន្តែស្វែងរកនៅទីនេះម្តងអាចនឹងលឿនជាង។
- ne: यो ChamTax मा भएका सबै पृष्ठहरूको सूची हो। तपाईं क्यालकुलेटर भित्रको ड्रपडाउनबाट पनि जान सक्नुहुन्छ, तर यहाँ एकैचोटि खोज्दा छिटो हुन सक्छ।
- id: Ini adalah daftar lengkap halaman di ChamTax. Anda juga bisa mengaksesnya lewat dropdown di dalam kalkulator, tapi mencarinya di sini sekaligus mungkin lebih cepat.
- my: ဒါက ChamTax ပေါ်က စာမျက်နှာအားလုံးရဲ့ စာရင်းပါ။ ဂဏန်းတွက်စက်ထဲက dropdown ကနေလည်း သွားလို့ရပေမယ့် ဒီမှာ တစ်ခါတည်း ရှာတာက ပိုမြန်နိုင်ပါတယ်။
- si: මෙය ChamTax හි ඇති සියලුම පිටුවල සම්පූර්ණ ලැයිස්තුවයි. ඔබට ගණකය තුළ ඇති dropdown එකෙන් ද යා හැකි නමුත්, මෙතැනින් එකවර සොයා ගැනීම වේගවත් විය හැක.
- uz: Bu ChamTax'dagi barcha sahifalarning to'liq ro'yxati. Ularga kalkulyator ichidagi dropdown orqali ham kirish mumkin, lekin bu yerda bir zumda topish tezroq bo'lishi mumkin.
- mn: Энэ бол ChamTax дээрх бүх хуудасны бүрэн жагсаалт юм. Тооцоолуур доторх унжлагаас ч орж болно, гэхдээ энд нэг дор хайх нь илүү хурдан байж магадгүй.
- kk: Бұл ChamTax-тағы барлық беттердің толық тізімі. Оларға калькулятор ішіндегі ашылмалы мәзірден де кіруге болады, бірақ мұнда бірден іздеу тезірек болуы мүмкін.
- ky: Бул ChamTax'тагы бардык баракчалардын толук тизмеси. Аларга эсептегичтин ичиндеги ачылуучу менюдан да кирүүгө болот, бирок бул жерден бир жолу издөө тезирээк болушу мүмкүн.
- ur: یہ ChamTax پر موجود تمام صفحات کی مکمل فہرست ہے۔ آپ کیلکولیٹر کے اندر ڈراپ ڈاؤن سے بھی وہاں جا سکتے ہیں، لیکن یہاں ایک ساتھ تلاش کرنا زیادہ تیز ہو سکتا ہے۔
- bn: এটি ChamTax-এর সব পৃষ্ঠার সম্পূর্ণ তালিকা। আপনি ক্যালকুলেটরের ভেতরের ড্রপডাউন থেকেও যেতে পারেন, তবে এখানে একসাথে খুঁজে পাওয়া বেশি দ্রুত হতে পারে।
- lo: ນີ້ແມ່ນລາຍຊື່ໜ້າທັງໝົດຂອງ ChamTax. ທ່ານສາມາດໄປຫາໄດ້ຜ່ານ dropdown ພາຍໃນເຄື່ອງຄິດໄລ່ນຳ, ແຕ່ການຄົ້ນຫາຢູ່ບ່ອນນີ້ຄັ້ງດຽວອາດໄວກວ່າ.
- ja: これはChamTaxにある全ページのリストです。計算機内のドロップダウンからも移動できますが、ここで一度に探すほうが早い場合もあります。
- ar: هذه هي القائمة الكاملة لصفحات ChamTax. يمكنك أيضًا الوصول إليها من القائمة المنسدلة داخل الآلة الحاسبة، لكن البحث هنا دفعة واحدة قد يكون أسرع.
- hi: यह ChamTax के सभी पेजों की पूरी सूची है। आप कैलकुलेटर के अंदर मौजूद ड्रॉपडाउन से भी वहाँ जा सकते हैं, लेकिन यहाँ एक साथ ढूंढना ज़्यादा तेज़ हो सकता है।
- fr: Voici la liste complète des pages de ChamTax. Vous pouvez aussi y accéder via le menu déroulant du calculateur, mais les trouver ici en une fois peut être plus rapide.
- tl: Ito ang kumpletong listahan ng mga pahina sa ChamTax. Maaari mo ring puntahan ang mga ito mula sa dropdown sa loob ng calculator, pero mas mabilis marahil na hanapin ang mga ito dito nang sabay-sabay.
- pt: Esta é a lista completa de páginas do ChamTax. Você também pode acessá-las pelo menu suspenso dentro da calculadora, mas encontrá-las aqui de uma vez pode ser mais rápido.
- es: Esta es la lista completa de páginas de ChamTax. También puedes acceder a ellas desde el menú desplegable dentro de la calculadora, pero encontrarlas aquí de una vez puede ser más rápido.
- uk: Це повний список сторінок ChamTax. До них також можна перейти через випадаюче меню в калькуляторі, але знайти все тут одразу може бути швидше.
- tet: Ida ne'e lista kompletu husi pájina sira iha ChamTax. Ita bele mos tama liu husi dropdown iha kalkuladora nia laran, maibé buka iha ne'e dala ida bele lais liu.

### 5. h2 "계산기 & 핵심 도구"
en: Calculator & Core Tools / zh: 计算器与核心工具 / vi: Máy tính & Công cụ chính /
th: เครื่องคำนวณและเครื่องมือหลัก / ru: Калькулятор и основные инструменты /
km: ម៉ាស៊ីនគណនា និងឧបករណ៍សំខាន់ៗ / ne: क्यालकुलेटर र मुख्य उपकरणहरू / id: Kalkulator & Alat Utama /
my: ဂဏန်းတွက်စက်နှင့် အဓိကကိရိယာများ / si: ගණකය සහ ප්‍රධාන මෙවලම් / uz: Kalkulyator va asosiy vositalar /
mn: Тооцоолуур ба гол хэрэгслүүд / kk: Калькулятор және негізгі құралдар / ky: Эсептегич жана негизги куралдар /
ur: کیلکولیٹر اور بنیادی اوزار / bn: ক্যালকুলেটর ও মূল টুলস / lo: ເຄື່ອງຄິດໄລ່ ແລະ ເຄື່ອງມືຫຼັກ / ja: 計算機＆主要ツール /
ar: الآلة الحاسبة والأدوات الأساسية / hi: कैलकुलेटर और मुख्य टूल्स / fr: Calculateur et outils essentiels /
tl: Calculator at Pangunahing Tool / pt: Calculadora e ferramentas principais /
es: Calculadora y herramientas principales / uk: Калькулятор і основні інструменти / tet: Kalkuladora & Ferramenta Prinsipál

### 6. h2 "거주 국가별 미국 복권 세금 안내 (21개국)"
en: US Lottery Tax Guide by Country of Residence (21 countries) / zh: 按居住国划分的美国彩票税务指南（21个国家/地区） /
vi: Hướng dẫn thuế xổ số Mỹ theo quốc gia cư trú (21 quốc gia) / th: คู่มือภาษีลอตเตอรีสหรัฐฯ ตามประเทศที่พำนัก (21 ประเทศ) /
ru: Руководство по налогам на американскую лотерею по стране проживания (21 страна) /
km: មគ្គុទ្ទេសក៍ពន្ធឆ្នោតអាមេរិកតាមប្រទេសនៅ (២១ប្រទេស) / ne: बसोबास गर्ने देश अनुसार अमेरिकी लटरी कर गाइड (२१ देश) /
id: Panduan Pajak Lotre AS Berdasarkan Negara Domisili (21 negara) / my: နေထိုင်သည့်နိုင်ငံအလိုက် အမေရိကန်ထီအခွန်လမ်းညွှန် (နိုင်ငံ ၂၁ ခု) /
si: පදිංචි රට අනුව ඇමරිකානු ලොතරැයි බදු මාර්ගෝපදේශය (රටවල් 21) / uz: Yashash mamlakati bo'yicha AQSh lotereyasi soliq qo'llanmasi (21 mamlakat) /
mn: Оршин суугаа улсаар АНУ-ын сугалааны татварын гарын авлага (21 улс) / kk: Тұратын елі бойынша АҚШ лотереясы салығы нұсқаулығы (21 ел) /
ky: Жашаган өлкө боюнча АКШ лотереясынын салык колдонмосу (21 өлкө) / ur: رہائشی ملک کے مطابق امریکی لاٹری ٹیکس گائیڈ (21 ممالک) /
bn: বসবাসের দেশ অনুযায়ী মার্কিন লটারি কর গাইড (২১টি দেশ) / lo: ຄູ່ມືພາສີລອດເຕີລີອາເມລິກາ ຕາມປະເທດທີ່ອາໄສຢູ່ (21 ປະເທດ) /
ja: 居住国別 米国宝くじ税金ガイド（21カ国） / ar: دليل ضرائب اليانصيب الأمريكي حسب بلد الإقامة (21 دولة) /
hi: निवास देश के अनुसार यूएस लॉटरी टैक्स गाइड (21 देश) / fr: Guide fiscal de la loterie américaine par pays de résidence (21 pays) /
tl: Gabay sa Buwis ng US Lottery ayon sa Bansang Tinitirhan (21 bansa) / pt: Guia de impostos da loteria dos EUA por país de residência (21 países) /
es: Guía de impuestos de la lotería de EE. UU. por país de residencia (21 países) / uk: Гід з податків на американську лотерею за країною проживання (21 країна) /
tet: Gia Impostu Lotaria EUA tuir Nasaun Hela (nasaun 21)

### 7. 섹션 설명 (국가별 안내)
- ko: 본인이 거주하는 나라를 기준으로 미국 복권에 당첨되면 세금을 얼마나 내는지 정리한 페이지예요.
- en: Pages that break down how much tax you'd pay on a US lottery win, based on your country of residence.
- (나머지 25개 언어는 코드 `sitemap.html`의 `SM_I18N.noteCountry` 참고 — 이 문서에 전부 다시
  옮기면 너무 길어져서, 이 항목부터는 원문 파일을 직접 열어 확인해주세요: 저장소의
  `sitemap.html`에서 `SM_I18N` 객체를 검색하면 13개 키 전부의 26개 언어 값을 한 번에 볼 수
  있어요. 검수는 파일을 직접 보고 해주시는 게 정확할 것 같습니다.)

## 구체적으로 확인해주셨으면 하는 것
1. **번역 품질**: 위 4개 문구(특히 자원이 적은 언어)와 `sitemap.html`의 `SM_I18N` 객체 전체
   (나머지 9개 키: h2Foreign/noteForeign/h2Abroad/h2Basics/noteBasics/h2EnZh 등)를 보고,
   부자연스럽거나 뜻이 어긋난 번역이 있으면 언어 코드+수정안을 알려주세요.
2. **아랍어 문장부호**: 제가 발견해서 고친 것 같은 복사 실수(중국어식 마침표 등)가 다른
   언어에도 남아있는지 확인해주세요.
3. **언어 감지 방식**: `?lang=` 우선, 그다음 `localStorage`, 기본값 한국어 — 이 우선순위가
   합리적인지, 놓친 엣지케이스가 있는지 의견 부탁드립니다.
4. **SEO 트레이드오프**: 클라이언트 JS 렌더링이라 직접 방문/구글 검색 시엔 한국어로만
   보인다는 한계를 그대로 받아들여도 되는지, 아니면 이 페이지만이라도 정적 다국어 버전을
   따로 만드는 게 나을지 — 이 페이지의 낮은 우선순위(전체 목록 페이지, 검색 유입 목적이
   아님)를 고려했을 때 의견 주세요.

## 답변 형식 요청
일반론이 아니라 이 파일에 적힌 실제 문구를 근거로 구체적으로 답해주세요. 확실하지 않은
언어는 "확실하지 않음"이라고 솔직히 표시해도 됩니다.
