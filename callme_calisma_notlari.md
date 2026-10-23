# call me maybe — Savunma Çalışma Notları

> Bu dosya repoda **değil**, bilerek dışarıda duruyor. Commit etme.
> Kodun 23 Ekim 2026 tarihli haline (son commit `dfa70e3`) göre yazıldı.
> Kodda bir şey değiştirirsen ilgili bölümü de güncelle.

---

## İçindekiler

0. [Bu dosyayı nasıl çalışmalısın](#0-bu-dosyayı-nasıl-çalışmalısın)
1. [Proje ne yapıyor — büyük resim](#1-proje-ne-yapıyor--büyük-resim)
2. [Bilmen gereken temel kavramlar](#2-bilmen-gereken-temel-kavramlar)
3. [Proje yapısı ve dosyaların görevleri](#3-proje-yapısı-ve-dosyaların-görevleri)
4. [Programın baştan sona akışı](#4-programın-baştan-sona-akışı)
5. [Fonksiyonlar — çalışma sırasıyla, tek tek](#5-fonksiyonlar--çalışma-sırasıyla-tek-tek)
6. [Uçtan uca örnek: "What is the sum of 2 and 3?"](#6-uçtan-uca-örnek-what-is-the-sum-of-2-and-3)
7. [Hata yönetimi haritası](#7-hata-yönetimi-haritası)
8. [Subject gereksinimleri ↔ kod eşlemesi](#8-subject-gereksinimleri--kod-eşlemesi)
9. [Bilinen zayıflıklar ve sınırlar (dürüst liste)](#9-bilinen-zayıflıklar-ve-sınırlar-dürüst-liste)
10. [Savunmada sorulabilecek sorular ve cevapları](#10-savunmada-sorulabilecek-sorular-ve-cevapları)
11. [Canlı değişiklik istenirse: hazır tarifler](#11-canlı-değişiklik-istenirse-hazır-tarifler)
12. [Teslim öncesi kontrol listesi](#12-teslim-öncesi-kontrol-listesi)
13. [Kısa sözlük](#13-kısa-sözlük)

---

## 0. Bu dosyayı nasıl çalışmalısın

1. **Önce 1. ve 2. bölümü** oku. Kavramları oturtmadan fonksiyonlara geçme; savunmada ilk sorulan şey "constrained decoding nedir?" olur.
2. **4. bölümdeki akış şemasını** kâğıda kendin çiz. Ezberleme, çiz.
3. **5. bölümü editörde kod açıkken** oku. Her fonksiyonda dosyaya bak, satırları takip et.
4. **6. bölümdeki örneği** kendi kendine sesli anlat. Değerlendiriciye anlatacağın şey tam olarak bu.
5. **10. bölümdeki soruları** cevaplara bakmadan cevaplamaya çalış, sonra kontrol et.
6. **11. bölümdeki tariflerden en az 3 tanesini gerçekten uygula**, çalıştır, sonra `git checkout .` ile geri al. Canlı değişiklik istenirse eller alışkın olsun.

---

## 1. Proje ne yapıyor — büyük resim

### 1.1 Tek cümlede

**Doğal dilde yazılmış bir isteği** ("What is the sum of 2 and 3?") alıp, onu **çalıştırılabilir bir fonksiyon çağrısına** çeviriyor:

```json
{
  "prompt": "What is the sum of 2 and 3?",
  "name": "fn_add_numbers",
  "parameters": {"a": 2.0, "b": 3.0}
}
```

Program soruyu **cevaplamıyor** (5 demiyor). Soruyu cevaplamak için **hangi fonksiyonun hangi argümanlarla çağrılması gerektiğini** söylüyor.

### 1.2 Buna neden "function calling" deniyor, neden önemli

LLM'ler (büyük dil modelleri) insan dilini iyi anlar ama çıktıları **serbest metindir**. Bir programın bu metni kullanabilmesi için çıktının **yapılandırılmış** (JSON gibi) ve **şemaya uygun** (doğru anahtarlar, doğru tipler) olması gerekir.

Function calling bu köprüyü kuruyor:

- Asistanlar API çağırabiliyor, veritabanı sorgulayabiliyor ("yarın İstanbul'da hava?" → `get_weather(city="Istanbul", day="tomorrow")`).
- Hesaplamalar modelin kafasından değil, gerçek koddan geliyor.
- Uzun bir metinden yapılandırılmış veri çıkarılabiliyor.

### 1.3 Asıl problem: küçük model güvenilmez

Kullandığımız model **Qwen3-0.6B**, yani yaklaşık 0.6 milyar parametreli, çok küçük bir model. Subject'e göre böyle bir modele "bana JSON ver" diye sorunca belki **%30** oranında geçerli JSON üretir. Kalan durumlarda:

- parantez kapatmayı unutur,
- sayı yerine `"iki"` yazar,
- olmayan bir fonksiyon adı uydurur,
- JSON'un etrafına "Sure! Here is your answer:" gibi metin ekler.

### 1.4 Çözüm: constrained decoding (kısıtlı çözümleme)

Modele **rica etmek** yerine, modelin **seçebileceği tokenleri kısıtlıyoruz**. Model her adımda bütün kelime dağarcığı için bir puan üretir; biz geçersiz olan tokenlerin puanını **eksi sonsuz** yapıyoruz. Model istese bile geçersiz bir token seçemiyor.

Sonuç:

- Fonksiyon adı **her zaman** tanımlı fonksiyonlardan biri oluyor.
- `number` tipindeki argüman **her zaman** `float()` ile parse edilebilen bir sayı oluyor.
- `string` her zaman düzgün kapanmış bir metin oluyor.
- `boolean` her zaman `true` veya `false` oluyor.

**Kritik ayrım (savunmada mutlaka söyle):**

| Kavram | Garanti mi? | Neden |
|---|---|---|
| **Geçerlilik** (JSON doğru, tipler doğru) | ✅ %100 garanti | Geçersiz token fiziksel olarak seçilemiyor |
| **Doğruluk** (doğru fonksiyon, doğru değer) | ❌ Garanti değil | Geçerli seçenekler arasından seçimi hâlâ model yapıyor |

Constrained decoding modeli **akıllandırmaz**, sadece **kurallara uymaya zorlar**.

### 1.5 Subject'in hedefleri

- **%90+ doğruluk**: doğru fonksiyon ve doğru argümanlar.
- **%100 geçerli JSON**.
- **5 dakikanın altında** bütün test promptlarını işlemek.
- **Hiç çökmemek**: bozuk dosya, eksik dosya gibi durumlarda net hata mesajı vermek.

### 1.6 Yasaklar (mutlaka bil)

- `dspy`, `outlines`, `transformers`, `pytorch`, `huggingface` gibi paketleri **kendi kodunda** kullanmak yasak. (`llm_sdk` içeride kullanıyor, o serbest.)
- `llm_sdk` paketinin **private** (alt çizgiyle başlayan, örneğin `_model`, `_tokenizer`) üyelerine erişmek yasak.
- Fonksiyonu **heuristic** ile seçmek yasak ("promptta 'sum' geçiyorsa `fn_add_numbers` seç" gibi). Seçimi **LLM yapmalı**.
- İzinli paketler: `numpy`, `json`, `pydantic` (sınıflar pydantic ile yazılmak zorunda).

---

## 2. Bilmen gereken temel kavramlar

### 2.1 Token ve tokenizer

Model metni karakter karakter ya da kelime kelime görmez; **token** denen parçalara bölünmüş halini görür. Bir token bir harf, bir kelime parçası ya da tam bir kelime olabilir.

```
"What is the sum of 2 and 3?"
→ ["What", "Ġis", "Ġthe", "Ġsum", "Ġof", "Ġ", "2", "Ġand", "Ġ", "3", "?"]   (temsili)
```

Bu bölme işini **tokenizer** yapar. Qwen, **BPE (Byte Pair Encoding)** kullanır: sık geçen karakter çiftlerini tekrar tekrar birleştirerek bir kelime dağarcığı oluşturur.

**Qwen'e özgü faydalı bilgi:** Qwen tokenizer'ı rakamları **tek tek** böler. `265` sayısı tek bir token değil, `"2"`, `"6"`, `"5"` olarak üç token. Bu yüzden sayı üretimi rakam rakam ilerliyor.

### 2.2 Vocab (kelime dağarcığı) ve `vocab.json`

Modelin bildiği bütün tokenlerin listesi. Her tokenin bir **id**'si (tam sayı) var. `vocab.json` bunu bir sözlük olarak tutuyor:

```json
{"!": 0, "\"": 1, "#": 2, ..., "Ġthe": 279, ..., "fn": 8822, ...}
```

(id'ler temsili.) Qwen'de yaklaşık **151 bin** token var.

Subject'in ipucu: *"Think about how you can use the vocabulary JSON file to map between tokens and their string representations."* Tam olarak bunu yapıyoruz: hangi tokenin geçerli olduğuna karar vermek için her tokenin **metnini** bilmemiz gerekiyor.

### 2.3 `Ġ` ve `Ċ` nedir? (Byte-level BPE)

BPE tokenizer'ı her şeyi **bayt** düzeyinde çalışır. Ama vocab dosyası okunabilir metin olmalı ve içinde boşluk, satır sonu gibi görünmez karakterler sorun çıkarır. Çözüm olarak her bayt, **görünür bir Unicode karakterine** eşlenir:

| Bayt | Anlamı | Vocab'ta görünüşü |
|---|---|---|
| `0x20` (32) | boşluk | `Ġ` (U+0120) |
| `0x0A` (10) | satır sonu `\n` | `Ċ` (U+010A) |
| `0x41` (65) | `A` | `A` (kendisi) |

Yani:
- `"Ġhello"` aslında `" hello"` demek (başında boşluk).
- `"Ċ"` aslında `"\n"` demek.

Projede `Ċ` tokenini **sayının bittiğini** bildirmek için kullanıyoruz (`NUMBER_STOP_TOKEN`). `decode_bpe_string` fonksiyonu da bu eşlemeyi tersine çevirip gerçek metni elde ediyor.

### 2.4 Token id ve `input_ids`

Model metni değil, **id listesini** alır:

```
"What is the sum" → [3838, 374, 279, 2629]   (temsili)
```

Bu listeye `input_ids` diyoruz. `model.encode(text)` metni bu listeye çeviriyor.

### 2.5 Logit

Model bir `input_ids` listesi alınca, **bir sonraki token** için vocab'taki **her token** için bir puan döndürür. Bu puanlara **logit** denir.

```
model.get_logits_from_input_ids([3838, 374, 279, 2629])
→ [-3.2, 0.1, 5.7, ..., 12.4, ...]   # ~151 bin sayı
```

- Logit ne kadar yüksekse model o tokeni o kadar "istiyor".
- Logitler olasılık değil, ham puan. Olasılığa çevirmek için **softmax** uygulanır: `p_i = e^(logit_i) / Σ e^(logit_j)`.
- Biz softmax'a gerek duymuyoruz, çünkü sadece en yüksek puanı arıyoruz (**argmax**). Softmax sıralamayı değiştirmez.

### 2.6 Otoregresif üretim (token token)

Model metni **bir seferde** üretmez:

```
1. input_ids → model → logitler → en iyi token seçilir
2. seçilen token input_ids'e eklenir
3. 1. adıma dön
```

Her adımda bir **forward pass** (modelin bir kez çalıştırılması) yapılıyor. Programın hızını belirleyen şey bu forward pass sayısı.

### 2.7 Greedy seçim

Her adımda en yüksek logitli tokeni seçmeye **greedy decoding** denir. Projede bunu kullanıyoruz (rastgele örnekleme yok). Avantajı: **deterministik**, yani aynı girdi her zaman aynı çıktıyı verir.

### 2.8 Maskeleme ve `-inf`

Constrained decoding'in kalbi:

```
logitler:   [ 5.1,  9.8,  2.3,  7.7 ]
geçerli mi: [  ✗,    ✗,    ✓,    ✓  ]
maskeli:    [-inf, -inf,  2.3,  7.7 ]   → argmax = 3. index
```

Model 1. indexi (9.8) en çok istiyordu ama geçersizdi. Maskeden sonra en iyi **geçerli** token seçiliyor.

**Neden `-inf`, neden `0` değil?** Logitler negatif olabilir. `0` yapsaydık, bütün geçerli tokenlerin logiti negatifken geçersiz token (0) kazanırdı. `-inf` her sayıdan küçük, ayrıca softmax'ta `e^(-inf) = 0`, yani olasılığı tam sıfır.

### 2.9 Gramer, "fragment" ve "prefix" düşüncesi

Bir tokenin geçerli olup olmadığına karar verirken tek karakter değil, **şu ana kadar üretilen metin + aday token** birlikte kontrol ediliyor:

```
şu ana kadar: "12"
aday token:   "."    → "12."  → hâlâ sayı olabilir mi? EVET → geçerli
aday token:   "a"    → "12a"  → sayı olabilir mi? HAYIR → geçersiz
```

İki ayrı soru var. Bunları karıştırma:

| Soru | Fonksiyon örneği | `"12."` için |
|---|---|---|
| **Devam edebilir mi?** (validity) | `is_valid_number_fragment` | ✅ evet |
| **Burada bitebilir mi?** (completeness) | `is_complete_number` | ❌ hayır |

Kural: **gramerin kabul ettiği her parça, bir şekilde tamamlanabilir olmalı.** Aksi halde döngü takılır. (Projede `.5` hatası tam olarak buydu; bkz. 9. bölüm ve README "Challenges".)

---

## 3. Proje yapısı ve dosyaların görevleri

```
callme/
├── Makefile                 # install, run, debug, clean, lint, lint-strict
├── pyproject.toml           # bağımlılıklar + mypy ayarları
├── uv.lock                  # bağımlılıkların kilitli sürümleri
├── .flake8                  # flake8: llm_sdk ve .venv hariç
├── .gitignore               # data/output/, .venv, cache'ler
├── README.md                # zorunlu dokümantasyon (İngilizce)
├── data/input/
│   ├── functions_definition.json    # çağrılabilecek fonksiyonlar
│   └── function_calling_tests.json  # işlenecek promptlar
├── llm_sdk/                 # HAZIR VERİLEN paket (dokunmuyoruz)
│   └── llm_sdk/__init__.py  # Small_LLM_Model sınıfı
└── src/
    ├── __init__.py          # boş; src'yi paket yapıyor
    ├── __main__.py          # giriş noktası, dosya okuma/yazma, akış
    ├── models.py            # pydantic modelleri
    ├── vocab.py             # vocab.json'u okuma
    ├── grammar.py           # SAF kurallar: hangi token geçerli?
    └── decoding.py          # modelle konuşan üretim döngüleri
```

### 3.1 Katmanlar — neden böyle bölündü

```
__main__.py   → "Ne yapılacak?"     (dosyalar, akış, hatalar)
decoding.py   → "Nasıl üretilecek?" (model + döngüler)
grammar.py    → "Ne geçerli?"       (saf kurallar, model YOK)
models.py     → "Veri neye benzer?" (pydantic şemaları)
vocab.py      → "Tokenler neler?"   (vocab yükleme)
```

**En önemli tasarım kararı:** `grammar.py` modeli hiç kullanmıyor. Sadece metin ve vocab alıp token id'leri döndürüyor. Bu sayede:
- Kurallar tek başına okunabiliyor.
- 0.6B'lik modeli yüklemeden test edilebiliyor (sahte modelli test böyle yapıldı).

### 3.2 Yapılandırma dosyaları

**`pyproject.toml`**
- `requires-python = ">=3.10"` → subject 3.10+ istiyor.
- `dependencies`: `numpy`, `pydantic`, `llm-sdk`.
- `[tool.uv.sources] llm-sdk = { path = "llm_sdk", editable = true }` → `llm_sdk` PyPI'den değil, **yerel klasörden** kuruluyor. `editable` ise kopyalanmadan, klasördeki koddan doğrudan kullanılıyor demek.
- `[dependency-groups] dev`: `flake8`, `mypy` → `uv sync` bunları da kurar.
- `[tool.mypy]` ve `overrides`: `.venv` hariç, `llm_sdk` hataları yok sayılıyor (bizim kodumuz değil). `src.vocab` için `warn_return_any = false`, çünkü `json.load` tipi `Any` döndürüyor.

**`uv.lock`**: Bütün bağımlılıkların (dolaylı olanlar dahil) tam sürümleri. Değerlendirici `uv sync` çalıştırınca **birebir aynı** sürümler kurulur.

**`.flake8`**: `extend-exclude` ile `.venv`, `llm_sdk`, `.mypy_cache` hariç tutuluyor. `exclude` değil `extend-exclude`, çünkü `exclude` flake8'in kendi varsayılan listesini (`.git`, `__pycache__`) siler.

**`Makefile`**

| Kural | Komut | Ne yapar |
|---|---|---|
| `install` | `uv sync` | `.venv` oluşturur, bağımlılıkları `uv.lock`'a göre kurar |
| `run` | `uv run python -m src` | Programı varsayılan yollarla çalıştırır |
| `debug` | `uv run python -m pdb -m src` | pdb debugger altında çalıştırır |
| `clean` | `find ... -exec rm -rf` | `__pycache__`, `.mypy_cache`, `.pytest_cache`, `*.egg-info` siler |
| `lint` | `flake8 .` + `mypy` (subject'teki flag'ler) | Stil + tip kontrolü |
| `lint-strict` | `flake8 .` + `mypy --strict` | Daha sıkı tip kontrolü (opsiyonel) |

`.PHONY` satırı: bu isimlerin dosya değil komut olduğunu söyler. Aynı isimde bir dosya olsa bile kural çalışır.

**`python -m src` neden çalışıyor?** `-m src`, Python'a `src` paketini modül olarak çalıştırmasını söyler. Python da paket içindeki `__main__.py` dosyasını çalıştırır. Bu yüzden `__main__.py` içinde göreli importlar (`from .vocab import ...`) kullanabiliyoruz.

### 3.3 `llm_sdk` — ne kullanıyoruz, ne kullanmıyoruz

`Small_LLM_Model` sınıfının **public** metodları:

| Metod | Kullanıyor muyuz? | Nerede |
|---|---|---|
| `Small_LLM_Model()` | ✅ | `main` — modeli bir kez yükler (varsayılan `Qwen/Qwen3-0.6B`) |
| `get_logits_from_input_ids(ids)` | ✅ | `_select_next_token` — her adımda |
| `get_path_to_vocab_file()` | ✅ | `load_vocab` |
| `encode(text)` | ✅ | `generate_function_call` — promptu id'ye çevirmek için |
| `decode(ids)` | ❌ | Kendi `decode_bpe_string` fonksiyonumuzu kullanıyoruz |
| `get_path_to_merges_file()`, `get_path_to_tokenizer_file()` | ❌ | — |

Private üyelere (`_model`, `_tokenizer`, `_device` …) **hiç dokunmuyoruz** ✅.

---

## 4. Programın baştan sona akışı

```
uv run python -m src [--functions_definition F] [--input I] [--output O]
│
▼
main()
├─ parse_args()                          → F, I, O yolları
├─ load_functions(F)
│    └─ load_json_file(F) → pydantic FunctionDefinition listesi
├─ load_prompts(I)
│    └─ load_json_file(I) → pydantic PromptTest listesi
├─ Small_LLM_Model()                     → model BİR KEZ yüklenir
├─ load_vocab(model)                     → {"token": id}
├─ build_id_to_token(vocab)              → {id: "token"}
├─ process_prompts(...)                  → her prompt için:
│    └─ generate_function_call(...)
│         │
│         ├─ AŞAMA 1: FONKSİYON ADI
│         │   prompt = katalog + istek + "function name: "
│         │   generate_constrained_string(adaylar = ['"fn_add_numbers"', ...])
│         │     döngü:
│         │       get_valid_tokens_for_candidates → geçerli id'ler
│         │       _select_next_token              → maskele + argmax
│         │       filter_candidates               → imkânsız adayları at
│         │
│         ├─ AŞAMA 2: HER PARAMETRE İÇİN (sırayla)
│         │   prompt = fonksiyon + açıklama + istek + önceki değerler
│         │            + "first argument (a) value: "
│         │   tip == number  → generate_number              → float()
│         │   tip == integer → generate_number(no decimal)  → int()
│         │   tip == string  → generate_string              → str
│         │   tip == boolean → generate_constrained_string(["true","false"])
│         │   başka tip      → ValueError (sadece bu prompt başarısız)
│         │
│         └─ FunctionCallResult(prompt, name, parameters)
│
└─ write_results(O, results)             → JSON dosyası
```

**Hatalar:** Başlangıçtaki her hata `RuntimeError` olur → `main` yakalar → `Error: ...` + exit 1. Tek bir prompttaki hata ise `process_prompts` tarafından yakalanır → o prompt atlanır, diğerleri devam eder.

---

## 5. Fonksiyonlar — çalışma sırasıyla, tek tek

Her fonksiyon için: **Ne yapar → Neden var → Nasıl çalışır → Dikkat edilecekler.**

---

### 5.0 Pydantic modelleri — `src/models.py`

Fonksiyonlardan önce veri şekillerini bilmek gerekiyor, çünkü her yerde bunlar dolaşıyor.

```python
class ParameterSpec(BaseModel):
    type: str

class FunctionDefinition(BaseModel):
    name: str
    description: str
    parameters: dict[str, ParameterSpec]
    returns: ParameterSpec

class PromptTest(BaseModel):
    prompt: str

class FunctionCallResult(BaseModel):
    prompt: str
    name: str
    parameters: dict[str, Any]
```

**Ne yapar:** Girdi dosyalarının ve çıktının **şeklini** tanımlıyor.

**Neden pydantic:**
- Subject zorunlu tutuyor (*"All classes must use pydantic for validation"*).
- `FunctionDefinition.model_validate(item)` çağrısı `item` sözlüğünü kontrol ediyor: `name` var mı, string mi? `parameters` bir sözlük mü, her değerinde `type` var mı? Bir şey eksik ya da yanlış tipteyse **`ValidationError`** fırlatıyor.
- Doğrulama **sınırda** (dosya okunduğu anda) yapıldığı için programın geri kalanı güvenle `fn.name`, `param_spec.type` gibi alanlara erişebiliyor.

**`ParameterSpec.type` neden `str`, neden `Literal["number", ...]` değil:**
Eskiden `Literal` idi. Değerlendirici dosyaya `"type": "integer"` ya da `"array"` eklerse **bütün dosya reddediliyor**, hiçbir prompt işlenmiyordu. Şimdi her tip adı yüklemede kabul ediliyor; desteklenmeyen bir tip sadece o fonksiyonu seçen promptta hata veriyor. Pydantic doğrulaması hâlâ var: `type` alanı eksikse ya da string değilse yine hata veriyor.

**`returns` neden var ama kullanılmıyor:** Subject'teki dosya formatında var, şemaya uygun olsun diye doğrulanıyor. Üretimde kullanılmıyor, çünkü biz fonksiyonu **çağırmıyoruz**, sadece çağrıyı tarif ediyoruz.

**`FunctionCallResult.parameters` neden `dict[str, Any]`:** Değerler farklı tiplerde (`float`, `int`, `str`, `bool`) olabiliyor.

**Pydantic'in varsayılan davranışı:** Girdi sözlüğünde **fazladan** anahtarlar varsa (örneğin fonksiyon tanımında `"category": "math"`) **sessizce yok sayılıyor** (`extra='ignore'`). Hata vermiyor.

**Çıktı anahtarları:** `FunctionCallResult` tam olarak `prompt`, `name`, `parameters` alanlarına sahip. `model_dump()` bunları bu sırayla sözlüğe çeviriyor. Subject'in "exactly the following keys" şartı buradan karşılanıyor.

---

### 5.1 Sabitler — `src/__main__.py` başı

```python
DEFAULT_FUNCTIONS_PATH = "data/input/functions_definition.json"
DEFAULT_INPUT_PATH = "data/input/function_calling_tests.json"
DEFAULT_OUTPUT_PATH = "data/output/function_calls.json"
```

Subject'teki varsayılan yollar. Çıktı dosyasının adı **`function_calls.json`** olmak zorunda (V.4). `data/output/` klasörü `.gitignore` içinde, yani repoya girmiyor.

---

### 5.2 `main()` — `src/__main__.py`

**Ne yapar:** Programın tamamını yönetir; sırayla bütün adımları çağırır.

**Nasıl çalışır:**

```python
try:
    args = parse_args()
    functions = load_functions(args.functions_definition)
    prompts = load_prompts(args.input)
    try:
        model = Small_LLM_Model()
    except Exception as e:
        raise RuntimeError(f"Failed to load the model: {e}") from e
    vocab = load_vocab(model)
    id_to_token = build_id_to_token(vocab)
    results = process_prompts(model, prompts, functions, vocab, id_to_token)
    write_results(args.output, results)
except RuntimeError as e:
    print(f"Error: {e}", file=sys.stderr); sys.exit(1)
except KeyboardInterrupt:
    print("\nInterrupted by user.", file=sys.stderr); sys.exit(130)
except Exception as e:
    print(f"Unexpected error: {e}", file=sys.stderr); sys.exit(1)
```

**Neden bu sıra:**
1. **Önce dosyalar, sonra model.** Model yüklemek pahalı (saniyeler, ilk seferde indirme). Dosya bozuksa modeli hiç yüklemeden hızlıca hata vermek daha iyi.
2. **Model bir kez yükleniyor** ve bütün promptlara aynı nesne geçiriliyor. Bellek prompt sayısıyla artmıyor.
3. **`id_to_token` bir kez hesaplanıyor.**

**Hata stratejisi:**
- Her yardımcı fonksiyon beklediği hataları **`RuntimeError`**'a çevirip okunabilir bir mesaj ekliyor. `main`'in tek bir `except RuntimeError` ile hepsini yakalayabilmesi bu sayede.
- `Small_LLM_Model()` ne fırlatacağı bilinmeyen bir şey (internet hatası, disk, torch …). Bu yüzden içte `except Exception` var ve hata `RuntimeError`'a çevriliyor.
- **`except` sırası önemli:** Python yukarıdan aşağı dener. `RuntimeError` da bir `Exception` olduğu için `Exception` en alta konmalı. Yoksa düzgün mesajların yerine "Unexpected error" basılır.
- **`KeyboardInterrupt`** (Ctrl+C), `Exception`'ın alt sınıfı değil, `BaseException`'dan geliyor. Bu yüzden ayrı yakalanıyor. **130**, Unix'te Ctrl+C ile kesilen programların standart çıkış kodu (128 + sinyal numarası 2).
- **`from e`**: Orijinal hatayı zincire ekliyor (`__cause__`). Debug ederken asıl sebebi görebilmek için.

**`if __name__ == "__main__": main()`**: Dosya doğrudan çalıştırıldığında `main()` çağrılır, import edildiğinde çağrılmaz. `python -m src` ile çalıştırıldığında `__name__` değeri `"__main__"` olur.

---

### 5.3 `parse_args()` — `src/__main__.py`

**Ne yapar:** Komut satırı argümanlarını okur: `--functions_definition`, `--input`, `--output`.

**Nasıl:** `argparse.ArgumentParser` ve üç `add_argument`. Her birinin `default` değeri yukarıdaki sabitler; yani **hepsi isteğe bağlı**.

**Dikkat:**
- Argüman adı `--functions_definition` (**alt çizgili**). argparse bunu `args.functions_definition` olarak sunuyor.
- Bilinmeyen bir argüman verilirse (`--foo`) argparse kendi hata mesajını basıp `SystemExit(2)` ile çıkıyor. Bu bir traceback değil, normal bir kullanım hatası.
- `description="..."` ve `help="..."` şu an üç nokta. Değerlendirici `--help` çalıştırırsa anlamsız görünür. Bkz. 11. bölüm, Tarif 8.

---

### 5.4 `load_json_file(path)` — `src/__main__.py`

**Ne yapar:** Bir JSON dosyasını okuyup Python nesnesine çevirir.

```python
try:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
except FileNotFoundError as e:  → "File not found: ..."
except json.JSONDecodeError as e:  → "Invalid JSON in file ...: ..."
except UnicodeDecodeError as e:  → "File ... is not valid UTF-8: ..."
except OSError as e:  → "Error reading file ...: ..."
```

**Neden:**
- `with` (context manager): Subject istiyor. Hata olsa bile dosya **otomatik kapanır**, kaynak sızıntısı olmaz.
- `encoding="utf-8"`: Açıkça belirtilmezse sistem varsayılanı kullanılır; makineden makineye değişebilir.

**Hata sınıfları ve sıraları:**

| Hata | Ne zaman | Kimin alt sınıfı |
|---|---|---|
| `FileNotFoundError` | Dosya yok | `OSError` |
| `json.JSONDecodeError` | JSON bozuk | `ValueError` |
| `UnicodeDecodeError` | Dosya UTF-8 değil | `ValueError` |
| `OSError` | İzin yok, dizin verildi, vs. | — |

`FileNotFoundError` bir `OSError` olduğu için **`OSError`'dan önce** yazılmak zorunda. Yoksa özel mesaj ("File not found") hiç basılmaz.

**Dönüş tipi neden `object`:** JSON herhangi bir şey olabilir (liste, sözlük, sayı …). Şekli çağıran fonksiyon kontrol ediyor.

---

### 5.5 `load_functions(path)` — `src/__main__.py`

**Ne yapar:** Fonksiyon tanımları dosyasını okuyup `FunctionDefinition` listesine çevirir.

**Kontroller, sırasıyla:**
1. `load_json_file` → dosya okunabilir ve geçerli JSON mı?
2. `isinstance(payload, list)` → en dışta **liste** mi? (Örneğin bir sözlük verilirse: `Expected a list of function definitions ..., got dict`.)
3. `len(payload) == 0` → **boş liste** ise hata. Seçilecek hiçbir fonksiyon yoksa model bir şey üretemez.
4. Her eleman için `FunctionDefinition.model_validate(item)` → pydantic şema kontrolü. Bir tanesi bile bozuksa bütün dosya reddediliyor (fonksiyon listesi tutarlı olmalı).

---

### 5.6 `load_prompts(path)` — `src/__main__.py`

`load_functions` ile aynı mantık, tek farkla: **boş liste kabul ediliyor**. İşlenecek prompt yoksa çıktı `[]` olur; bu bir hata değil.

Her eleman `PromptTest.model_validate(item)` ile kontrol ediliyor: `{"prompt": "..."}` şeklinde olmalı.

---

### 5.7 `Small_LLM_Model()` — `llm_sdk` (hazır)

Bizim fonksiyonumuz değil ama bilmen gerekiyor:
- Varsayılan model `Qwen/Qwen3-0.6B`.
- Cihazı otomatik seçiyor: `mps` (Mac) > `cuda` (NVIDIA) > `cpu`.
- İlk çalıştırmada modeli Hugging Face'ten indiriyor (~1.5 GB), sonra önbellekten (`~/.cache/huggingface`) kullanıyor.

---

### 5.8 `load_vocab(model)` — `src/vocab.py`

**Ne yapar:** Modelin `vocab.json` dosyasını okuyup `{"token_metni": id}` sözlüğü döndürür.

```python
try:
    path = model.get_path_to_vocab_file()
except Exception as e:
    raise RuntimeError(f"Vocab file could not be found: {e}") from e

try:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
except (OSError, ValueError) as e:
    raise RuntimeError(f"Vocab file could not be read: {e}") from e
```

**Neden iki ayrı `try`:**
- **Birincisi:** `get_path_to_vocab_file` içeride `hf_hub_download` çağırıyor. Bu, huggingface ya da requests kütüphanelerinden önceden bilinmeyen hatalar fırlatabilir. Bu yüzden `Exception`.
- **İkincisi:** Dosya okuma. `OSError` bütün dosya hatalarını, `ValueError` hem `JSONDecodeError`'ı hem `UnicodeDecodeError`'ı kapsıyor.

**Neden vocab'a ihtiyacımız var:** Her adımda "bu token geçerli mi?" diye sormak için **her tokenin metnini** bilmemiz gerekiyor. Model bize sadece id'lere göre logit veriyor.

---

### 5.9 `build_id_to_token(token_to_id)` — `src/vocab.py`

**Ne yapar:** Sözlüğü ters çevirir: `{"token": id}` → `{id: "token"}`.

**Neden:** Model en iyi tokeni bir **index** (id) olarak veriyor. O tokenin **metnini** öğrenmemiz gerekiyor (`generated_so_far`'a eklemek için). Ters sözlük olmasaydı her adımda 151 bin elemanlı vocab'ı tarayıp id'yi aramamız gerekirdi (O(n)). Ters sözlükle bu O(1).

**Neden bir kez, `main` içinde:** Ters çevirme işi bir kez yapılıp bütün promptlara geçiriliyor; her promptta tekrar hesaplanmıyor.

---

### 5.10 `process_prompts(model, prompts, functions, vocab, id_to_token)` — `src/__main__.py`

**Ne yapar:** Her prompt için `generate_function_call` çağırır ve sonuçları toplar.

```python
for i, prompt_test in enumerate(prompts, start=1):
    print(f"[{i}/{len(prompts)}] Processing prompt: ...", file=sys.stderr)
    try:
        result = generate_function_call(...)
        results.append(result)
    except Exception as e:
        print(f"Failed to process prompt ...: {e}", file=sys.stderr)
failed = len(prompts) - len(results)
if failed:
    print(f"{failed}/{len(prompts)} prompt(s) could not be processed.", file=sys.stderr)
return results
```

**Neden her prompt ayrı `try` içinde:** Tek bir bozuk prompt (örneğin desteklenmeyen tipli bir fonksiyon seçen) bütün çalışmayı öldürmesin.

**Neden `except Exception` (geniş):** Bu bir "batch" döngüsü; hangi hatayla karşılaşırsak karşılaşalım diğer promptlara devam etmek istiyoruz. `KeyboardInterrupt` bunun içinde değil (`BaseException`), yani Ctrl+C hâlâ programı durdurabiliyor.

**Neden `stderr`:** İlerleme ve hata mesajları **insan için**, asıl çıktı (JSON dosyası) **makine için**. Bunları ayırmak iyi bir alışkanlık: `stdout`'u bir dosyaya yönlendiren biri log mesajlarıyla karışık bir çıktı almaz.

**Sondaki özet:** Kaç promptun başarısız olduğunu net olarak gösteriyor. Subject *"must always provide clear error messages"* diyor.

**Dikkat:** Başarısız prompt çıktı dosyasında **yer almıyor**. Bu bilinçli bir karar: sahte ya da uydurma bir sonuç yazmak, şemaya uygun ama yanlış veri üretmek demek.

---

### 5.11 `generate_function_call(model, prompt, functions, vocab, id_to_token)` — `src/decoding.py`

**Projenin merkezi.** Bir prompt için tam fonksiyon çağrısını iki aşamada üretiyor.

#### Aşama 1 — Fonksiyon adı

```python
name_candidate = ['"' + fn.name + '"' for fn in functions]
catalog = "Available functions:\n"
for fn in functions:
    catalog += f"- {fn.name}: {fn.description}\n"
name_prompt = catalog + "\n" + prompt + "\nfunction name: "
input_ids = model.encode(name_prompt)[0].tolist()
name_result = generate_constrained_string(model, input_ids, name_candidate, vocab, id_to_token)
function_name = name_result.strip('"')
```

Modele giden metin şöyle görünüyor:

```
Available functions:
- fn_add_numbers: Add two numbers together and return their sum.
- fn_greet: Generate a greeting message for a person by name.
- fn_reverse_string: Reverse a string and return the reversed result.
- fn_get_square_root: Calculate the square root of a number.
- fn_substitute_string_with_regex: Replace all occurrences matching a regex pattern in a string.

What is the sum of 2 and 3?
function name: 
```

**Adaylar neden tırnak içinde (`'"fn_add_numbers"'`):**
Asıl sebep **önek (prefix) problemi**. Diyelim ki `fn_add` ve `fn_add_numbers` adında iki fonksiyon var. Tırnaksız olsaydı model `fn_add` yazdığı anda iki aday da hâlâ mümkün olurdu: `fn_add` tamamlanmış, `fn_add_numbers` devam ediyor. Ne zaman duracağımızı bilemezdik. Kapanış tırnağı **adın bittiğini açıkça işaretliyor**: `"fn_add"` ile `"fn_add_numbers"` artık birbirinin öneki değil.

**`model.encode(...)[0].tolist()`:** `encode` 2 boyutlu bir tensör döndürüyor (şekli `[1, n]`, batch boyutu 1). `[0]` ilk satırı alıyor, `.tolist()` da Python `list[int]`'e çeviriyor.

**`.strip('"')`:** Baştaki ve sondaki tırnakları atıyor → `fn_add_numbers`.

**Seçimi kim yapıyor?** **Model.** Kod sadece "tanımlı adlardan biri olmak zorunda" kısıtını koyuyor. Hangisinin seçileceği tamamen logitlere bağlı. **Heuristic yok** (anahtar kelime eşleştirme, if-else yok).

**Güvenlik kontrolü:**
```python
for fn in functions:
    if fn.name == function_name:
        selected_functions = fn
        break
if selected_functions is None:
    raise ValueError(...)
```
Teoride buraya hiç düşülmez (aday listesi dışında bir şey üretilemez). Ama `selected_functions`'ın tipi `FunctionDefinition | None` olduğu için mypy'yi memnun etmek ve savunmacı programlama için var.

#### Aşama 2 — Parametreler

```python
context = ""
parameters = {}
for index, (param_name, param_spec) in enumerate(selected_functions.parameters.items()):
    ordinal = ORDINAL_WORDS[index] if index < 6 else f"{index + 1}th"   # (gerçek kodda if/else)
    param_prompt = (
        f"Function: {selected_functions.name}\n"
        f"Description: {selected_functions.description}\n"
        f"{prompt}"
        f"{context}"
        f"\n{ordinal} argument ({param_name}) value: "
    )
    param_input_ids = model.encode(param_prompt)[0].tolist()
    ... tipe göre üret ...
    context += f"\n{param_name}: {parameters[param_name]}"
```

İkinci parametre için modele giden metin:

```
Function: fn_add_numbers
Description: Add two numbers together and return their sum.
What is the sum of 2 and 3?
a: 2.0
second argument (b) value: 
```

**Neden her parametre için yeni bir prompt:** Her parametre farklı bir soru: "a nedir?", "b nedir?". Prompt bu soruyu açıkça soruyor.

**`context` neden var:** Önceki parametrelerin değerleri bir sonraki promptun içine ekleniyor (`a: 2.0`). Böylece model `b` için tekrar `2` yazmak yerine, `a`'nın zaten 2 olduğunu görüp sıradaki sayıya (`3`) geçiyor.

**Ordinal kelime (`first`, `second` …) neden var:** Modele hangi sıradaki argümanı istediğimizi doğal dille söylüyor. 6'dan fazla parametre için `7th`, `8th` … kullanılıyor (eskiden `IndexError` veriyordu).

**`dict` sırası:** Python 3.7+'ta sözlükler ekleme sırasını korur. Parametreler JSON dosyasındaki sırayla işleniyor.

**Tipe göre dallanma:**

| `param_spec.type` | Üretici | Dönüşüm | Çıktı tipi |
|---|---|---|---|
| `"number"` | `generate_number` | `float(raw)` | `float` (`2.0`) |
| `"integer"` | `generate_number(..., allow_decimal=False)` | `int(raw)` | `int` (`2`) |
| `"string"` | `generate_string` | `raw.strip('"')` | `str` |
| `"boolean"` | `generate_constrained_string(["true","false"])` | `raw == "true"` | `bool` |
| diğer | — | `ValueError("Unsupported type ...")` | prompt başarısız |

**`float()` ve `int()` neden hiç hata vermiyor:** Gramer sadece tamamlanmış sayılarda durmaya izin veriyor. `int()` için ayrıca nokta tamamen yasak. Yani `raw_value` her zaman `"2"`, `"-0.5"` gibi parse edilebilir bir metin.

**JSON'u model mi yazıyor?** **Hayır, ve bu önemli bir tasarım kararı.** JSON'un **iskeleti** (`{`, `"name":`, `"parameters":` …) program tarafından sabit olarak kuruluyor (`FunctionCallResult` + `json.dump`). Model **sadece serbest kısımları** üretiyor: fonksiyon adını ve argüman değerlerini. Bu sayede:
- İskelet hiçbir zaman bozulamıyor.
- Model gereksiz tokenler (`{`, `"`, `:` gibi) için forward pass harcamıyor; daha hızlı.
- Her değer, şemadaki tipine göre ayrı bir gramerle kısıtlanıyor.

Değerlendirici "model JSON üretmiyor ki?" derse cevap: *"Şema sabit; değişken olan yerler fonksiyon adı ve argüman değerleri. Bunları model üretiyor, constrained decoding ile her biri tipine göre kısıtlanıyor. Yapıyı modele bırakmak, geçerliliği riske atıp ekstra forward pass harcamak olurdu."*

---

### 5.12 `generate_constrained_string(model, input_ids, candidates, vocab, id_to_token)` — `src/decoding.py`

**Ne yapar:** Model, sabit bir aday listesinden (fonksiyon adları ya da `true`/`false`) **tam olarak birini** üretsin diye token token ilerler.

```python
generated_so_far = ""
input_ids = input_ids.copy()
candidates = candidates.copy()

for _ in range(MAX_ITERATIONS):
    candidates_list = get_valid_tokens_for_candidates(candidates, generated_so_far, vocab)
    chosen_id, chosen_token = _select_next_token(model, input_ids, candidates_list, id_to_token)
    generated_so_far += chosen_token
    input_ids.append(chosen_id)
    candidates = filter_candidates(candidates, generated_so_far)
    if len(candidates) == 1 and generated_so_far == candidates[0]:
        return candidates[0]

raise RuntimeError("Maximum number of iterations reached; ...")
```

**Adım adım:**
1. Şu ana kadar üretilen metni ileriye taşıyabilecek tokenleri bul (en az bir adayın öneki kalmalı).
2. Model bunlar arasından en iyisini seçsin.
3. Seçilen tokeni hem metne hem `input_ids`'e ekle (model bir sonraki adımda kendi seçimini görsün).
4. Artık mümkün olmayan adayları at.
5. Tek aday kaldıysa ve tamamen üretildiyse bitir.

**Neden `.copy()`:** `input_ids` ve `candidates` dışarıdan gelen listeler. Python'da listeler **referansla** geçer; `append` çağrısı çağıranın listesini de değiştirirdi. Kopyalayınca fonksiyonun yan etkisi olmuyor.

**Neden `MAX_ITERATIONS`:** Güvenlik sınırı (100). Normalde aday sayısı sınırlı olduğu için döngü kendiliğinden bitiyor. Her token en az 1 karakter eklediği için en fazla "aday uzunluğu" kadar adım sürüyor.

**Neden burada sınıra gelince hata veriyor (string'deki gibi kapatmıyor):** Yarım kalmış bir fonksiyon adı (`"fn_add_num`) ya da boolean (`tru`) anlamsız. Sessizce yanlış bir değer döndürmek yerine hata vermek daha doğru.

---

### 5.13 `get_valid_tokens_for_candidates(candidates, generated_so_far, vocab)` — `src/grammar.py`

**Ne yapar:** Her aday için geçerli tokenleri bulup birleştirir; tekrarları atar.

```python
ids_set = set()
for candidate in candidates:
    ids_set.update(get_valid_tokens_for_target(candidate, generated_so_far, vocab))
return list(ids_set)
```

**Neden `set`:** Aynı token birden fazla adaya uyabilir. Örneğin başta `"` tokeni bütün adaylara uyar. `set` tekrarları otomatik atıyor.

---

### 5.14 `get_valid_tokens_for_target(target, generated_so_far, vocab)` — `src/grammar.py`

**Ne yapar:** Tek bir hedef metin için geçerli tokenleri bulur.

```python
for token_str, token_id in vocab.items():
    unified = generated_so_far + token_str
    if target.startswith(unified):
        id_list.append(token_id)
```

**Kural:** `şu ana kadarki metin + token` hâlâ hedefin **başlangıcı** (öneki) ise token geçerli.

**Örnek:** hedef `"fn_greet"`, şu ana kadar `"fn_`

| Token | Birleşim | Hedefin öneki mi? |
|---|---|---|
| `gre` | `"fn_gre` | ✅ |
| `greet` | `"fn_greet` | ✅ |
| `greet"` | `"fn_greet"` | ✅ (tamamı) |
| `add` | `"fn_add` | ❌ |
| `Ġgreet` | `"fn_ greet` | ❌ (boşluk) |

**Neden tek karakter değil, bütün token:** Tokenler çok karakterli. Model `greet` gibi uzun bir token seçebilir. Karakter karakter kontrol etmek, birden fazla karakter içeren tokenleri kaçırırdı.

**Maliyet:** Her çağrıda bütün vocab (~151 bin) taranıyor. Aday sayısıyla çarpılıyor (5 fonksiyon → 5 tarama).

---

### 5.15 `_select_next_token(model, input_ids, valid_token_ids, id_to_token)` — `src/decoding.py`

**Constrained decoding'in tam olarak gerçekleştiği yer.**

```python
if not valid_token_ids:
    raise ValueError("No valid tokens left")

valid_token_ids_set = set(valid_token_ids)
raw_logits = model.get_logits_from_input_ids(input_ids)
masked_raw_logits = raw_logits.copy()

for token_id in range(len(masked_raw_logits)):
    if token_id not in valid_token_ids_set:
        masked_raw_logits[token_id] = float('-inf')

max_id = max(masked_raw_logits)
max_id_index = masked_raw_logits.index(max_id)
token_str = id_to_token[max_id_index]
return max_id_index, token_str
```

**Adım adım:**
1. Geçerli token yoksa hemen hata ver (yoksa hepsi `-inf` olur ve `max` anlamsızlaşır).
2. Geçerli id'leri `set`'e çevir: `in` kontrolü listede O(n), set'te O(1). 151 bin kontrol için bu fark çok büyük.
3. Modelden **ham logitleri** al (bir forward pass).
4. Geçersiz her tokenin logitini `-inf` yap.
5. En büyük logiti bul (greedy / argmax) ve indexini al.
6. Index = token id. `id_to_token` ile metnini bul.

**Değişken adı uyarısı:** `max_id` aslında bir id değil, **en büyük logit değeri**. `max_id_index` ise token id'si. Sorulursa bu karışıklığı bil.

**Eşitlik durumu:** `list.index()` ilk eşleşmeyi döndürüyor; iki token aynı logite sahipse küçük id'li kazanıyor. Pratikte float logitlerde tam eşitlik çok nadir.

**Logit listesi vocab'tan uzun:** Modelin çıktı katmanı, `vocab.json`'daki token sayısından biraz daha fazla eleman döndürüyor (özel tokenler ve dolgu). Bu fazladan id'ler hiçbir zaman geçerli listede olmadığı için her zaman `-inf` kalıyor ve **asla seçilmiyor**. Bu yüzden `id_to_token[max_id_index]` hiç `KeyError` vermiyor.

**Neden alt çizgiyle başlıyor (`_select_...`):** Python'da "modül içi yardımcı" anlamına gelen bir konvansiyon. Subject'teki yasak **`llm_sdk`'nın** private üyeleri için; kendi modülümüzdeki private fonksiyon serbest.

---

### 5.16 `filter_candidates(candidates, generated_so_far)` — `src/grammar.py`

**Ne yapar:** Hâlâ üretilen metinle başlayan adayları tutar, diğerlerini atar.

```python
return [c for c in candidates if c.startswith(generated_so_far)]   # (gerçek kod döngüyle)
```

**Örnek:** Adaylar `['"fn_add_numbers"', '"fn_greet"', '"fn_get_square_root"']`, üretilen `"fn_g`:
→ `['"fn_greet"', '"fn_get_square_root"']`

**Neden gerekli:** Bir sonraki adımda `get_valid_tokens_for_candidates` sadece kalan adaylara bakar; hem daha hızlı (daha az tarama) hem bitiş koşulu (`len(candidates) == 1`) bunun sayesinde çalışıyor.

---

### 5.17 `generate_number(model, input_ids, vocab, id_to_token, allow_decimal=True)` — `src/decoding.py`

**Ne yapar:** Bir sayıyı token token üretir. Sayının **nerede biteceğine model karar verir**.

```python
generated_so_far = ""
input_ids = input_ids.copy()
for _ in range(MAX_ITERATIONS):
    valid_ids = get_valid_tokens_for_number(generated_so_far, vocab, allow_decimal)
    chosen_id, chosen_token = _select_next_token(model, input_ids, valid_ids, id_to_token)
    if chosen_token == NUMBER_STOP_TOKEN:
        return generated_so_far
    generated_so_far += chosen_token
    input_ids.append(chosen_id)
raise RuntimeError(...)
```

**Bitiş mekanizması:** `Ċ` (satır sonu) tokeni "durdur" anlamına geliyor. Bu token **sadece sayı tamamlanmışsa** geçerli listeye ekleniyor. Model `"2"` yazdıktan sonra iki seçeneğe sahip: bir rakam daha eklemek (`"23"`) ya da `Ċ` seçip durmak. Model genelde durmayı seçiyor, çünkü promptta sayı 2.

**Neden `Ċ` (satır sonu):** Doğal bir seçim: prompt `... value: ` ile bitiyor; model değeri yazdıktan sonra satır sonuna geçmeye meyilli. Ayrıca `Ċ` hiçbir sayının parçası olamaz, karışıklık çıkmaz.

**Stop tokeni neden `generated_so_far`'a eklenmiyor:** O bir işaret, sayının parçası değil.

**`allow_decimal`:** `integer` tipi için `False` geçiliyor; nokta hiç önerilmiyor. Varsayılan `True`, böylece `number` için olan eski çağrılar hiç değişmeden çalışıyor.

**Dönüş tipi `str`:** Dönüşümü (`float`/`int`) çağıran yapıyor; bu fonksiyon iki tip için de kullanılıyor.

---

### 5.18 `get_valid_tokens_for_number(generated_so_far, vocab, allow_decimal=True)` — `src/grammar.py`

```python
id_list = []
if is_complete_number(generated_so_far):
    stop_id = vocab.get(NUMBER_STOP_TOKEN)
    if stop_id is not None:
        id_list.append(stop_id)
for token_str, token_id in vocab.items():
    if is_valid_number_fragment(generated_so_far + token_str, allow_decimal):
        id_list.append(token_id)
return id_list
```

**İki iş yapıyor:**
1. Sayı **tamamlanmışsa** stop tokenini ekliyor → model durabilir.
2. Sayıyı **geçerli tutan** her tokeni ekliyor → model devam edebilir.

**`vocab.get(...)` neden `[...]` değil:** Başka bir model kullanılırsa vocab'ta `Ċ` olmayabilir. `get`, `KeyError` yerine `None` döndürüyor.

**Örnek akış (Qwen'de rakamlar tek token):**

| `generated_so_far` | Tamam mı? | Geçerli tokenler |
|---|---|---|
| `""` | ❌ | `0-9`, `-` |
| `"2"` | ✅ | `Ċ`, `0-9`, `.` |
| `"2."` | ❌ | `0-9` |
| `"2.5"` | ✅ | `Ċ`, `0-9` |
| `"-"` | ❌ | `0-9` |

---

### 5.19 `is_valid_number_fragment(fragment, allow_decimal=True)` — `src/grammar.py`

**Soru:** "Bu metin **hâlâ** bir sayıya dönüşebilir mi?"

```python
if fragment == "":
    return True
allowed = "0123456789-"
if allow_decimal:
    allowed += "."
for index, part in enumerate(fragment):
    if part not in allowed:            return False   # izin verilmeyen karakter
    if part == "-" and index != 0:     return False   # eksi sadece başta
    if part == "." and (index == 0 or not fragment[index - 1].isdigit()):
                                       return False   # nokta sadece rakamdan sonra
if fragment.count(".") > 1:            return False   # en fazla bir nokta
return True
```

**Kurallar:**
- Sadece rakamlar, `-` ve (izin varsa) `.`.
- `-` sadece ilk karakter olabilir.
- `.` sadece bir **rakamdan sonra** gelebilir (`.5`, `-.` yasak).
- En fazla bir nokta.

**`index == 0` kontrolü neden şart:** Python'da `fragment[-1]` **son** karakteri verir. `index == 0` iken `fragment[index - 1]` hata vermez ama yanlış karakteri okur. `or` kısa devre yaptığı için `index == 0` ise ikinci kısım hiç çalışmaz.

**`.5` kuralının hikâyesi (savunmada anlat):** İlk versiyonda nokta başta olabiliyordu. `".5"` "geçerli" sayılıyordu ama `is_complete_number(".5")` hiçbir zaman `True` dönmüyordu (noktadan önce rakam yok). Sonuç: stop tokeni hiç sunulmuyordu, model 100 rakam boyunca devam ediyor ve hata alıyordu. Ders: **gramerin kabul ettiği her parça tamamlanabilir olmalı.**

**Neden bilimsel gösterim (`1e5`) yok:** Promptlar normal sayılar içeriyor; `e` eklemek grameri karmaşıklaştırırdı. Ama sınırlama olarak bil.

---

### 5.20 `is_complete_number(fragment)` — `src/grammar.py`

**Soru:** "Bu metin **burada** biterse geçerli bir sayı olur mu?"

```python
if fragment.startswith("-"):
    fragment = fragment[1:]
if "." not in fragment:
    return fragment.isdigit()
if fragment.count(".") > 1:
    return False
first, second = fragment.split(".")
return first.isdigit() and second.isdigit()
```

| Girdi | Sonuç | Neden |
|---|---|---|
| `"345"` | ✅ | rakamlardan oluşuyor |
| `"-5"` | ✅ | eksi atılınca `"5"` |
| `"3.14"` | ✅ | iki taraf da rakam |
| `""` | ❌ | `"".isdigit()` → False |
| `"-"` | ❌ | eksi atılınca boş |
| `"12."` | ❌ | `second = ""` |
| `".5"` | ❌ | `first = ""` |

**Neden önemli:** `""` için `False` döndüğü için model **en az bir rakam** yazmadan duramıyor; boş sayı üretilemiyor.

---

### 5.21 `generate_string(model, input_ids, vocab, id_to_token)` — `src/decoding.py`

**Ne yapar:** Tırnak içinde bir metin üretir.

```python
input_ids = input_ids.copy()
opening_id = vocab['"']
opening_str = id_to_token[opening_id]
generated_so_far = opening_str
input_ids.append(opening_id)
for _ in range(MAX_ITERATIONS):
    valid_ids = get_valid_tokens_for_string(generated_so_far[1:], vocab)
    chosen_id, chosen_token = _select_next_token(model, input_ids, valid_ids, id_to_token)
    generated_so_far += chosen_token
    input_ids.append(chosen_id)
    if is_complete_string(generated_so_far[1:]):
        return decode_bpe_string(generated_so_far, BYTE_DECODER)
return decode_bpe_string(generated_so_far + '"', BYTE_DECODER)
```

**Açılış tırnağını neden biz koyuyoruz:** `"` karakteri bir string'de **iki zıt anlam** taşıyor: başta "açılış", sonda "kapanış". Açılışı modele bırakırsak ilk `"`'nun hangisi olduğunu ayırt etmek zorlaşır. Çözüm: açılışı **biz** koyuyoruz (hem metne hem `input_ids`'e, böylece model tırnağın açıldığını "görüyor"). Ardından modelin ürettiği **ilk** `"` her zaman kapanış.

**`generated_so_far[1:]` neden:** Kontrol fonksiyonlarına açılış tırnağı **olmadan** içerik gönderiliyor. Aksi halde açılış tırnağı "ortada bir tırnak" sayılır ve her şey reddedilirdi.

**100 tokende kapanmazsa:** Hata vermek yerine **string'i biz kapatıyoruz**. Yarım bir string de geçerli bir string; çıktı şemaya uygun kalıyor. (Sayı ve aday için bunu yapmıyoruz, çünkü yarım bir sayı ya da fonksiyon adı anlamsız.)

**Sonuç:** `decode_bpe_string` BPE karakterlerini gerçek metne çeviriyor (`Ġ` → boşluk). Dönen değer tırnaklı (`"hello"`). Tırnakları çağıran `strip('"')` ile atıyor.

**Sınırlama:** String'in **içinde** `"` karakteri olamaz; ilk tırnak her zaman kapanış sayılıyor. (JSON'daki `\"` kaçış dizisi desteklenmiyor.)

---

### 5.22 `get_valid_tokens_for_string(generated_so_far, vocab)` — `src/grammar.py`

Bütün vocab'ı tarayıp `is_valid_string_fragment(generated_so_far + token)` olan tokenleri döndürüyor. Yapı `get_valid_tokens_for_number` ile aynı, sadece kural farklı.

---

### 5.23 `is_valid_string_fragment(fragment)` — `src/grammar.py`

```python
for index, control in enumerate(fragment):
    if control == '"':
        return index == len(fragment) - 1
return True
```

**Kural:** Tırnak varsa **sadece en sonda** olabilir.

| Birleşim | Sonuç | Neden |
|---|---|---|
| `hello` | ✅ | tırnak yok |
| `hello"` | ✅ | tırnak sonda → kapanış |
| `hel"lo` | ❌ | tırnak ortada |
| `hello",` | ❌ | tırnaktan sonra virgül var |

Bu sayede `",` gibi tırnak + başka karakter içeren tokenler otomatik reddediliyor; sadece temiz bir kapanış mümkün.

---

### 5.24 `is_complete_string(fragment)` — `src/grammar.py`

```python
if len(fragment) == 0:
    return False
return fragment[-1] == '"'
```

Son karakter tırnaksa string bitmiş demek. Boş kontrolü, `fragment[-1]`'in `IndexError` vermemesi için.

---

### 5.25 `build_byte_decoder()` ve `BYTE_DECODER` — `src/grammar.py`

**Ne yapar:** BPE'nin "görünür karakter → bayt" eşleme tablosunu kurar (GPT-2'nin `bytes_to_unicode` tablosunun tersi).

```python
byte_values = list(range(ord("!"), ord("~") + 1)) \
            + list(range(ord("¡"), ord("¬") + 1)) \
            + list(range(ord("®"), ord("ÿ") + 1))
char_codes = byte_values[:]
offset = 0
for byte in range(256):
    if byte not in byte_values:
        byte_values.append(byte)
        char_codes.append(256 + offset)
        offset += 1
return {chr(code): byte for code, byte in zip(char_codes, byte_values)}
```

**Mantık:**
- 256 baytın **yazdırılabilir** olanları (`!`–`~`, `¡`–`¬`, `®`–`ÿ`) kendi karakterleriyle eşleniyor: `A` → 65.
- Geri kalan **68 bayt** (boşluk, satır sonu, kontrol karakterleri …) sırayla 256, 257, 258 … kod noktalarına eşleniyor.
  - Bayt 10 (`\n`) → 256 + 10 = 266 → `Ċ`
  - Bayt 32 (boşluk) → 256 + 32 = 288 → `Ġ`

  (0–32 arasındaki baytların hepsi "yazdırılamaz" listesinde olduğu için offset bunlarda bayt değerine eşit.)

**`BYTE_DECODER = build_byte_decoder()`:** Modül yüklenirken **bir kez** hesaplanıyor, her string'de tekrar hesaplanmıyor.

---

### 5.26 `decode_bpe_string(raw, byte_decoder)` — `src/grammar.py`

```python
buffer = bytearray()
for char in raw:
    if char in byte_decoder:
        buffer.append(byte_decoder[char])
    else:
        buffer.extend(char.encode("utf-8"))
return buffer.decode("utf-8", errors="replace")
```

**Ne yapar:** Ham BPE metnini gerçek metne çevirir.

- `"Ġhello"` → baytlar `[32, 104, 101, 108, 108, 111]` → `" hello"`
- Türkçe `ö` gibi çok baytlı karakterler vocab'ta iki karakter olarak görünür (örneğin `Ã¶`). Bunlar iki bayta çevrilip UTF-8 olarak birleşince `ö` oluyor.

**Neden önce bayta çevirip sonra decode:** Çok baytlı bir karakter **iki ayrı tokene bölünmüş** olabilir. Karakter karakter çevirmek yerine bütün baytları biriktirip en sonda tek seferde decode etmek bu durumu doğru çözüyor.

**`errors="replace"`:** Bayt dizisi geçersiz UTF-8 ise (örneğin 100 token sınırında yarım kalmış bir karakter) çökmek yerine `�` koyuyor.

**`else` dalı:** Tablo dışında bir karakter gelirse (normalde olmaz) kendi UTF-8 baytları kullanılıyor; savunmacı programlama.

**Bu bir "kendi decode'umuz":** `model.decode()` kullanmıyoruz. Bonus maddelerindeki "tokenizer'ı yeniden yazma" yolunda kısmi bir adım; ama `encode` hâlâ kullanıldığı için bonus tam karşılanmıyor.

---

### 5.27 `write_results(path, results)` — `src/__main__.py`

```python
data = [result.model_dump() for result in results]
try:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
except OSError as e:
    raise RuntimeError(f"Error writing results to {path}: {e}") from e
```

- **`model_dump()`**: Pydantic nesnesini düz Python sözlüğüne çeviriyor.
- **`os.path.dirname(path)`**: `"data/output/function_calls.json"` → `"data/output"`. `"out.json"` gibi bir yol için boş string döner; bu yüzden `if directory:` kontrolü var (`os.makedirs("")` hata verir).
- **`exist_ok=True`**: Klasör zaten varsa hata vermiyor.
- **`makedirs` neden `try` içinde**: İzin yoksa (`PermissionError`) ya da yolda dizin yerine dosya varsa (`NotADirectoryError`) hata yakalanıyor. Hepsi `OSError`'ın alt sınıfı.
- **`indent=2`**: Okunabilir çıktı.
- **`ensure_ascii=False`**: `ö`, `ç` gibi karakterler `ö` olarak değil, olduğu gibi yazılıyor. İki durumda da geçerli JSON.
- **JSON geçerliliği**: `json.dump` Python nesnelerinden her zaman geçerli JSON üretiyor (sondaki virgül, yorum vs. olmaz). Değerler zaten doğru tipte olduğu için şema uyumu da garanti.

---

## 6. Uçtan uca örnek: "What is the sum of 2 and 3?"

> Token bölmeleri **temsili**; gerçek id'ler ve bölmeler farklı olabilir. Mantık aynı.

**1. Dosyalar okunur:** 5 fonksiyon, 11 prompt. Model yüklenir, vocab okunur, ters sözlük kurulur.

**2. Aşama 1 — fonksiyon adı**

Adaylar:
```
'"fn_add_numbers"'  '"fn_greet"'  '"fn_reverse_string"'
'"fn_get_square_root"'  '"fn_substitute_string_with_regex"'
```

| Adım | Şu ana kadar | Geçerli tokenlerden bazıları | Modelin seçimi | Kalan adaylar |
|---|---|---|---|---|
| 1 | `` | `"`, `"fn` | `"` | 5 |
| 2 | `"` | `fn`, `f`, `fn_` | `fn` | 5 |
| 3 | `"fn` | `_`, `_add`, `_g` … | `_add` | 1 (`"fn_add_numbers"`) |
| 4 | `"fn_add` | `_numbers`, `_`, … | `_numbers` | 1 |
| 5 | `"fn_add_numbers` | `"` | `"` | 1 → **bitti** |

Model 3. adımda `_add` tokenini seçti. Bunun sebebi promptta "sum" geçmesi ve `fn_add_numbers` açıklamasının "Add two numbers" olması. Bunu **model kendi logitleriyle** yaptı; kodda "sum" kelimesine bakan bir kural yok.

Sonuç: `function_name = "fn_add_numbers"`.

**3. Aşama 2 — parametre `a` (number)**

Prompt:
```
Function: fn_add_numbers
Description: Add two numbers together and return their sum.
What is the sum of 2 and 3?
first argument (a) value: 
```

| Adım | Şu ana kadar | Tamam mı | Geçerli | Seçim |
|---|---|---|---|---|
| 1 | `` | ❌ | `0-9`, `-` | `2` |
| 2 | `2` | ✅ | `Ċ`, `0-9`, `.` | `Ċ` → **dur** |

`float("2")` → `2.0`. `context = "\na: 2.0"`.

**4. Aşama 2 — parametre `b` (number)**

Prompt:
```
Function: fn_add_numbers
Description: Add two numbers together and return their sum.
What is the sum of 2 and 3?
a: 2.0
second argument (b) value: 
```

Model `3` seçiyor, sonra `Ċ`. → `3.0`.

**5. Sonuç:**
```python
FunctionCallResult(prompt="What is the sum of 2 and 3?",
                   name="fn_add_numbers",
                   parameters={"a": 2.0, "b": 3.0})
```

**Forward pass sayısı:** Ad için 5 + `a` için 2 + `b` için 2 = **9 forward pass**. Her forward pass öncesinde de vocab taramaları yapılıyor.

### Bir string örneği: "Greet shrek"

Fonksiyon `fn_greet` seçildikten sonra prompt `... first argument (name) value: ` ile bitiyor. Kod açılış tırnağını ekliyor:

| Adım | Şu ana kadar (ham) | Seçim |
|---|---|---|
| 0 | `"` (bizim koyduğumuz) | — |
| 1 | `"` | `sh` |
| 2 | `"sh` | `rek` |
| 3 | `"shrek` | `"` → **kapandı** |

`decode_bpe_string('"shrek"')` → `"shrek"` → `strip('"')` → `shrek`.

---

## 7. Hata yönetimi haritası

| Durum | Nerede yakalanıyor | Mesaj | Çıkış |
|---|---|---|---|
| Girdi dosyası yok | `load_json_file` | `Error: File not found: X` | 1 |
| Bozuk JSON | `load_json_file` | `Error: Invalid JSON in file X: ...` | 1 |
| UTF-8 değil | `load_json_file` | `Error: File X is not valid UTF-8: ...` | 1 |
| Okuma izni yok / dizin verildi | `load_json_file` (`OSError`) | `Error: Error reading file X: ...` | 1 |
| En dışta liste değil | `load_functions` / `load_prompts` | `Error: Expected a list of ...` | 1 |
| Boş fonksiyon listesi | `load_functions` | `Error: No function definitions found in X` | 1 |
| Şemaya uymayan eleman | `load_functions` / `load_prompts` (`ValidationError`) | `Error: Invalid function definition in X: ...` | 1 |
| Model yüklenemedi | `main` (iç try) | `Error: Failed to load the model: ...` | 1 |
| Vocab yolu alınamadı | `load_vocab` | `Error: Vocab file could not be found: ...` | 1 |
| Vocab okunamadı | `load_vocab` | `Error: Vocab file could not be read: ...` | 1 |
| Desteklenmeyen tip | `generate_function_call` → `process_prompts` | `Failed to process prompt '...': Unsupported type ...` | devam |
| Sayı/aday 100 adımda bitmedi | üreticiler → `process_prompts` | `Failed to process prompt ...: Maximum number of iterations ...` | devam |
| Çıktı yazılamıyor | `write_results` | `Error: Error writing results to X: ...` | 1 |
| Ctrl+C | `main` | `Interrupted by user.` | 130 |
| Öngörülmeyen her şey | `main` | `Unexpected error: ...` | 1 |

**Kendin dene** (uv kuruluyken):
```bash
uv run python -m src --input yok.json
echo '[{"prompt": ' > /tmp/bozuk.json && uv run python -m src --input /tmp/bozuk.json
printf '\xff\xfe' > /tmp/utf.json && uv run python -m src --input /tmp/utf.json
echo '{}' > /tmp/obj.json && uv run python -m src --input /tmp/obj.json
echo '[]' > /tmp/bos.json && uv run python -m src --functions_definition /tmp/bos.json
uv run python -m src --output /root/x/out.json
```
Her birinde traceback değil, tek satırlık bir `Error: ...` görmelisin. `echo $?` ile çıkış kodunu kontrol et.

---

## 8. Subject gereksinimleri ↔ kod eşlemesi

| Gereksinim | Nerede karşılanıyor |
|---|---|
| Python 3.10+ | `pyproject.toml` `requires-python` |
| flake8 | `make lint`, `.flake8` |
| mypy (belirtilen flag'ler) | `make lint`, `pyproject.toml [tool.mypy]` |
| Type hint'ler | Bütün fonksiyonlar |
| Docstring (PEP 257) | Bütün fonksiyon ve sınıflar |
| Context manager | `with open(...)` her yerde |
| Makefile kuralları | `install`, `run`, `debug`, `clean`, `lint`, `lint-strict` |
| `.gitignore` | var, `data/output/` dahil |
| Bütün sınıflar pydantic | `models.py` |
| Yasaklı paket yok | `src/` içinde sadece `json`, `argparse`, `os`, `sys`, `typing`, `pydantic`, `llm_sdk` |
| Qwen3-0.6B | `Small_LLM_Model()` varsayılanı |
| Fonksiyonu LLM seçiyor | `generate_constrained_string` + logitler |
| `llm_sdk` private yok | Sadece public metodlar |
| `uv sync` ile kurulum | `pyproject.toml` + `uv.lock` |
| Kullanım komutu ve varsayılanlar | `parse_args` |
| Çıktı: `data/output/function_calls.json` | `DEFAULT_OUTPUT_PATH` |
| Tam olarak `prompt`, `name`, `parameters` | `FunctionCallResult` |
| Constrained decoding (yapı + şema) | `grammar.py` + `_select_next_token` |
| Hatalı/eksik girdi dosyası | `load_json_file`, `load_functions`, `load_prompts` |
| Hiç çökmeme | Bkz. 7. bölüm |
| README zorunlu bölümleri | `README.md` |
| `output/` repoda yok | `.gitignore` |

---

## 9. Bilinen zayıflıklar ve sınırlar (dürüst liste)

Değerlendirici bulmadan **senin bilmen** daha iyi. Sorulursa saklama; nedenini ve nasıl düzeltilebileceğini anlat.

1. **Doğruluk sınırda.** Gerçek çalıştırmada 11 prompttan biri kesin yanlıştı: *"Replace all numbers in ... with NUMBERS"* → `fn_add_numbers` seçildi (promptta "numbers" kelimesi var). Bir diğerinde `replacement` `"*"` yerine `"**"` çıktı. Skor yaklaşık %82–91.
   - **Sebep:** Ad seçim promptunda sadece ad ve açıklama var; model **parametreleri görmüyor**.
   - **Olası iyileştirme:** Katalogda parametreleri de göstermek (`fn_add_numbers(a: number, b: number)`), ya da Qwen'in chat şablonunu kullanmak. Seçim hâlâ modelde kalır, heuristic olmaz.

2. **Hız.** Her adımda Python döngüsüyle ~151 bin token taranıyor (ad seçiminde aday sayısı kadar), maskeleme de Python döngüsüyle. numpy izinli ama kullanılmıyor.
   - **Olası iyileştirme:** Logitleri `numpy` dizisine çevirip maskeyi vektörel uygulamak; sayı tokenlerini (rakamlar, `.`, `-`) bir kez önceden hesaplamak.

3. **String içinde `"` olamaz.** İlk tırnak her zaman kapanış.

4. **String'de satır sonu serbest.** Model bir string'in içine `\n` koyabilir.

5. **String'lerin başında boşluk kalabilir.** Model `Ġhello` seçerse değer `" hello"` olur; sadece tırnaklar atılıyor, boşluk değil.

6. **Sayıda bilimsel gösterim yok** (`1e5`). Baştaki sıfırlar serbest (`007` → `7.0`).

7. **Greedy.** Her adımda en iyi token seçiliyor; global olarak en iyi diziyi garanti etmez. Ad seçiminde ilk ayrışan token tüm kararı veriyor.

8. **Başarısız prompt çıktıda yok.** Bilinçli karar ama "her prompt için bir obje" şartıyla gerilim var.

9. **`MAX_ITERATIONS = 100`.** Çok uzun bir fonksiyon adı (≈100 karakterden uzun) teoride sınırı aşabilir.

10. **`argparse` yardım metinleri `"..."`.** `--help` anlamsız görünüyor.

11. **README'de ölçülmüş süre yok.** "Performance analysis" bölümüne `time make run` sonucunu ekle.

---

## 10. Savunmada sorulabilecek sorular ve cevapları

**S1. Bu proje ne yapıyor?**
Doğal dildeki bir isteği, tanımlı fonksiyonlardan birine ve onun tipli argümanlarına çeviriyor. Soruyu cevaplamıyor; hangi fonksiyonun hangi argümanlarla çağrılacağını söylüyor. Küçük bir modelle bunu güvenilir yapmak için constrained decoding kullanıyor.

**S2. Constrained decoding nedir?**
Model her adımda bütün tokenler için logit üretir. Biz, yapıyı veya şemayı bozacak tokenlerin logitini `-inf` yapıyoruz; model sadece geçerli tokenler arasından seçebiliyor. Kod: `_select_next_token`.

**S3. Neden sadece prompt ile JSON istemiyorsun?**
0.6B'lik model bunu güvenilir yapamıyor (subject'e göre ~%30). Subject de açıkça yasaklıyor: *"must NOT rely on the model spontaneously producing correct JSON"*.

**S4. Logit nedir? Neden `-inf`?**
Modelin her token için ürettiği ham puan. `-inf` her sayıdan küçük olduğu için argmax onu asla seçmez; softmax'ta da olasılığı tam sıfır (`e^-inf = 0`). `0` yetmezdi, çünkü logitler negatif olabilir.

**S5. Fonksiyonu kim seçiyor? Heuristic var mı?**
Model seçiyor. Kod sadece "tanımlı adlardan biri olmalı" diyor. Hangisinin seçileceği logitlere bağlı. Kodda anahtar kelimeye bakan hiçbir kural yok.

**S6. Aday adlarını neden tırnak içine aldın?**
Önek problemi yüzünden. `fn_add` ve `fn_add_numbers` olsaydı, `fn_add` yazıldığında durup durmayacağımızı bilemezdik. Kapanış tırnağı adın bittiğini kesin olarak işaretliyor.

**S7. Sayının bittiğini nasıl anlıyorsun?**
`Ċ` (satır sonu) tokenini stop tokeni olarak kullanıyorum. Bu token sadece `is_complete_number` `True` dönünce geçerli listeye ekleniyor. Durup durmamaya model karar veriyor.

**S8. `Ġ` ve `Ċ` nedir?**
Byte-level BPE'de boşluk (bayt 32) `Ġ`, satır sonu (bayt 10) `Ċ` olarak gösteriliyor. Vocab dosyası okunabilir olsun diye yazdırılamayan baytlar 256'dan başlayan karakterlere eşleniyor. `build_byte_decoder` bunun tersini kuruyor.

**S9. Vocab dosyasını neden kullanıyorsun?**
Bir tokenin geçerli olup olmadığına karar vermek için onun metnini bilmem gerekiyor. Model sadece id ve logit veriyor. Vocab, id ile metin arasındaki köprü.

**S10. `id_to_token` neden var, neden bir kez hesaplanıyor?**
Argmax bana bir id veriyor; metni lazım. Ters sözlükle O(1) erişim. Bir kez `main`'de kurulup her yere geçiriliyor.

**S11. Neden `input_ids.copy()`?**
Listeler referansla geçiyor. Kopyalamazsam `append` çağıranın listesini de değiştirir; bir sonraki parametrede yanlış bir prompt gider.

**S12. Çıktının %100 geçerli JSON olduğunu nasıl garanti ediyorsun?**
İskelet (`prompt`, `name`, `parameters`) program tarafından sabit kuruluyor ve `json.dump` ile yazılıyor. Model sadece değerleri üretiyor ve her değer tipine göre kısıtlanıyor: ad mutlaka tanımlı bir ad, sayı mutlaka `float()` ile parse edilebilir, string mutlaka kapanmış, boolean mutlaka `true`/`false`.

**S13. Doğruluğu da garanti ediyor musun?**
Hayır. Constrained decoding geçerliliği garanti eder, doğruluğu değil. Geçerli seçenekler arasında seçimi model yapıyor. 11 prompttan biri yanlış fonksiyonla sonuçlandı.

**S14. Neden greedy, neden sampling değil?**
Deterministik: aynı girdi aynı çıktıyı verir, test edilebilir. Function calling'de yaratıcılık değil kesinlik istiyoruz.

**S15. Neden pydantic?**
Subject zorunlu tutuyor. Ayrıca girdi doğrulamasını tek satıra indiriyor (`model_validate`) ve hatalı dosyayı en başta, net bir mesajla yakalıyor.

**S16. `type` neden `Literal` değil `str`?**
Değerlendirici yeni bir tip eklerse (`integer`, `array`) `Literal` bütün dosyayı reddediyordu ve hiçbir prompt işlenmiyordu. Şimdi sadece o tipi kullanan promptlar başarısız oluyor.

**S17. `integer` ile `number` farkı?**
`integer` için `allow_decimal=False`: gramer noktayı hiç önermiyor. Sonuç `int()` ile çevriliyor, çıktıda `5.0` değil `5` oluyor.

**S18. Bir prompt hata verirse ne oluyor?**
`process_prompts` hatayı yakalıyor, stderr'e yazıyor, diğer promptlara devam ediyor. Sonda "X/Y prompt(s) could not be processed" yazıyor.

**S19. Girdi dosyası bozuksa?**
`load_json_file` hatayı yakalayıp `RuntimeError`'a çeviriyor; `main` `Error: ...` basıp 1 ile çıkıyor. Traceback yok.

**S20. `except` sırası neden önemli?**
Python yukarıdan aşağı deniyor. `FileNotFoundError`, `OSError`'ın alt sınıfı, bu yüzden önce gelmeli. `main`'de `Exception` en sonda olmalı, yoksa `RuntimeError`'ları da yutar.

**S21. Neden `stderr`?**
İlerleme ve hata mesajları insan için; asıl çıktı dosyada. İkisi ayrı kalıyor.

**S22. `MAX_ITERATIONS` neden var? String'de neden farklı davranıyor?**
Sonsuz döngüye karşı güvenlik sınırı. String'de yarım bir değer bile geçerli bir string, bu yüzden kapatıp döndürüyorum. Sayı ve fonksiyon adında yarım değer anlamsız, bu yüzden hata.

**S23. Hız nasıl? Nasıl hızlandırırsın?**
Maliyetin çoğu forward pass sayısında (her token bir pass). Bunun yanında her adımda Python döngüsüyle vocab taranıyor. İyileştirme: numpy ile vektörel maskeleme, rakam ve nokta tokenlerini önceden hesaplama, aday ağacını bir kez kurma.

**S24. `model.encode` kullanıyorsun, bonus yaptın mı?**
`encode` mandatory kısımda serbest. Bonus "tokenizer'ı yeniden yazmak" demek; `decode`'u kendim yazdım (`decode_bpe_string`), ama `encode` hâlâ SDK'dan. Yani bonus tam değil.

**S25. `llm_sdk`'nın private bir şeyini kullanıyor musun?**
Hayır. Sadece `Small_LLM_Model()`, `encode`, `get_logits_from_input_ids`, `get_path_to_vocab_file`.

**S26. `_select_next_token` alt çizgiyle başlıyor, yasak değil mi?**
Yasak `llm_sdk`'nın private üyeleri için. Bu benim modülümün kendi yardımcı fonksiyonu.

**S27. `context` ne işe yarıyor?**
Önceki parametrelerin değerlerini sonraki promptlara ekliyor. Model `b` için `a`'nın değerini tekrar yazmasın, sıradakine geçsin diye.

**S28. 9. prompt neden yanlış?**
Promptta "numbers" kelimesi var ve model ad seçerken parametreleri görmüyor. `fn_add_numbers` ile kelime benzerliği modeli yanılttı. Katalogda parametreleri göstermek muhtemelen düzeltir.

**S29. `uv sync` ne yapıyor?**
`.venv` oluşturup `pyproject.toml` ve `uv.lock`'a göre birebir aynı sürümleri kuruyor. `llm_sdk` yerel klasörden editable olarak kuruluyor.

**S30. flake8'de `llm_sdk`'yı neden hariç tuttun?**
Hazır verilen paket, benim kodum değil; subject onu kopyalamamı istiyor. İçini değiştirmek yerine lint dışında bıraktım. `.venv` de içinde binlerce üçüncü parti dosya olduğu için hariç.

---

## 11. Canlı değişiklik istenirse: hazır tarifler

Her tarifi bir kez dene, çalıştır, sonra `git checkout .` ile geri al.

### Tarif 1 — Üretilen tokenleri canlı göster (görselleştirme)

`src/decoding.py` → `_select_next_token`, `return`'den hemen önce:

```python
    print(f"  token: {token_str!r} (id={max_id_index})", file=sys.stderr)
```

Dosyanın başına `import sys` ekle. (Modele dokunmadan her adımda hangi tokenin seçildiğini gösterir.)

### Tarif 2 — Negatif sayıları yasakla

`src/grammar.py` → `is_valid_number_fragment`:

```python
    allowed = "0123456789"          # "-" çıkarıldı
```

### Tarif 3 — Ondalık basamağı en fazla 2 yap

`is_valid_number_fragment` sonuna, `return True`'dan önce:

```python
    if "." in fragment and len(fragment.split(".")[1]) > 2:
        return False
```

### Tarif 4 — Yeni bir tip: `"float"` (number ile aynı)

`src/decoding.py` → `generate_function_call`:

```python
        if param_spec.type in ("number", "float"):
```

### Tarif 5 — String uzunluğunu ayrı sınırla

`src/decoding.py`:

```python
MAX_STRING_TOKENS = 30
...
    for _ in range(MAX_STRING_TOKENS):     # generate_string içinde
```

### Tarif 6 — Prompt başına süre ölç

`src/__main__.py` → `process_prompts`. Başa `import time` ekle:

```python
        start = time.perf_counter()
        try:
            result = generate_function_call(...)
            results.append(result)
        except Exception as e:
            ...
        print(f"  took {time.perf_counter() - start:.2f}s", file=sys.stderr)
```

### Tarif 7 — Ad seçiminde parametreleri de göster (doğruluğu artırabilir)

`src/decoding.py` → `generate_function_call`:

```python
    for fn in functions:
        params = ", ".join(f"{n}: {s.type}" for n, s in fn.parameters.items())
        catalog += f"- {fn.name}({params}): {fn.description}\n"
```

Sonra çıktıyı eskisiyle karşılaştır.

### Tarif 8 — `--help` metinlerini anlamlı yap

`src/__main__.py` → `parse_args`:

```python
    parser = argparse.ArgumentParser(
        description="Translate natural language prompts into function calls."
    )
    parser.add_argument("--functions_definition", type=str,
                        default=DEFAULT_FUNCTIONS_PATH,
                        help="JSON file with the available functions")
```

### Tarif 9 — Çıktıya başarısız promptları da ekle

Subject "tam olarak 3 anahtar" dediği için **sadece istenirse** yap. `process_prompts` içindeki `except` bloğunda bir hata listesi tut, sonra `main`'de ayrı bir dosyaya yaz.

### Tarif 10 — Çıktıda sayıları tam sayı olarak yaz (2.0 yerine 2)

`generate_function_call` → `number` dalı:

```python
            value = float(raw_value)
            parameters[param_name] = int(value) if value.is_integer() else value
```

(Subject örneği `2.0` kullandığı için **istenmedikçe** yapma.)

### Tarif 11 — Varsayılan çıktı yolunu değiştir

`DEFAULT_OUTPUT_PATH` sabitini değiştir. Tek yer.

### Tarif 12 — `MAX_ITERATIONS` değiştir

`src/decoding.py` başındaki sabit. Tek yer; hem aday, hem sayı, hem string döngüleri kullanıyor.

---

## 12. Teslim öncesi kontrol listesi

```bash
git status                      # temiz olmalı; data/output/ görünmemeli
make clean
rm -rf .venv
make install                    # sıfırdan kurulum çalışıyor mu?
make lint                       # flake8 + mypy hatasız
time make run                   # süre < 5 dk; süreyi README'ye yaz
cat data/output/function_calls.json   # 11 obje, anahtarlar doğru
```

- [ ] README'nin ilk satırı: `*This project has been created as part of the 42 curriculum by sekartav.*`
- [ ] README "Performance analysis" bölümüne ölçülmüş süre ve doğruluk eklendi
- [ ] `data/output/` repoda yok (`git ls-files | grep output` boş dönmeli)
- [ ] `diger/` veya bu çalışma dosyası repoda yok
- [ ] 7. bölümdeki hata testlerinin hepsinde traceback yok
- [ ] 11. bölümden en az 3 tarif denendi ve geri alındı
- [ ] 10. bölümdeki soruları cevaplara bakmadan cevaplayabiliyorsun

---

## 13. Kısa sözlük

| Terim | Anlamı |
|---|---|
| **LLM** | Büyük dil modeli |
| **Token** | Modelin gördüğü metin parçası |
| **Tokenizer** | Metni tokenlere bölen araç |
| **BPE** | Byte Pair Encoding; sık karakter çiftlerini birleştiren tokenizasyon yöntemi |
| **Vocab** | Modelin bildiği bütün tokenler ve id'leri |
| **Token id** | Tokenin vocab'taki numarası |
| **`input_ids`** | Modele verilen token id listesi |
| **Forward pass** | Modelin bir kez çalıştırılması; bir sonraki token için logit üretir |
| **Logit** | Bir token için ham (normalize edilmemiş) puan |
| **Softmax** | Logitleri olasılığa çeviren fonksiyon |
| **Argmax / greedy** | En yüksek puanlı seçeneği seçmek |
| **Maskeleme** | Geçersiz tokenlerin logitini `-inf` yapmak |
| **Constrained decoding** | Üretimi kurallara uyacak şekilde kısıtlamak |
| **Gramer** | Hangi metnin geçerli olduğunu söyleyen kurallar |
| **Fragment** | Henüz tamamlanmamış metin parçası |
| **Önek (prefix)** | Bir metnin başlangıç kısmı |
| **Stop token** | Üretimin bittiğini işaretleyen token (burada `Ċ`) |
| **Otoregresif** | Her adımda önceki çıktıyı girdiye ekleyerek ilerleyen üretim |
| **Heuristic** | Kural tabanlı tahmin (bu projede fonksiyon seçimi için yasak) |
| **Schema** | Verinin beklenen şekli (anahtarlar ve tipler) |
| **Pydantic** | Python'da veri doğrulama kütüphanesi |
| **Context manager** | `with` bloğu; kaynakları otomatik kapatır |
| **uv** | Python paket ve sanal ortam yöneticisi |
| **Editable install** | Paketi kopyalamadan kaynak klasörden kullanmak |
