# REBORN in ELONTH — Prolog

Tamamen **kodla çizilmiş ve canlandırılmış**, 60 saniyelik özgün bir anime kısa film.
Tek bir PNG, tek bir ses dosyası yok: her kare Canvas 2D ile vektörel olarak çiziliyor,
her ses Tone.js ile sentezleniyor.

- ▶️ **İzle (GitHub Pages):** https://farfromtrue01.github.io/reborn-anime/
- ⬇️ **MP4 indir (1080p30, sesli):** https://github.com/FarFromTrue01/reborn-anime/releases/latest/download/reborn-prolog.mp4
  (tüm sürümler: https://github.com/FarFromTrue01/reborn-anime/releases)

> Gündüzleri avukat, geceleri oyun tutkunu Nolan yağmurlu bir gecede yaya geçidinde
> farların içinde kaybolur… ve Elonth dünyasında Joseph olarak yeniden doğar.

> **Tek seferlik Pages ayarı:** Oynatıcı her push'ta `gh-pages` dalına yayımlanır. Depoda Pages kapalıysa
> (workflow token'ı Pages'i açamaz) bir kez **Settings → Pages → Build and deployment → Source: "Deploy from a branch"
> → Branch: `gh-pages` / `(root)` → Save** yapın; birkaç dakika içinde yukarıdaki bağlantı açılır.

## Hızlı başlangıç

```bash
npm install          # bağımlılıklar (Playwright tarayıcısı ayrıca: npx playwright install chromium)
npm run dev          # http://localhost:5173 — oynatıcı
npm run build        # dist/ — statik site (GitHub Pages'e bu gider)
npm run frames       # export/keyframes/*.png — her sahneden anahtar kareler (görsel kontrol)
npm run frames -- 9.6 42.2   # belirli saniyeler
npm run export       # export/reborn-prolog.mp4 — kare kare 1080p30 PNG + WAV + ffmpeg
```

`npm run export` gereksinimleri: Node 20+, `ffmpeg` (PATH'te) ve Playwright Chromium.
Ayarlar: `WORKERS=4` (paralel sekme sayısı), `KEEP_FRAMES=1` (tüm PNG'leri `export/frames/` içine de yazar).
Dışa aktarım sırası: Playwright headless Chromium'da sayfayı `?export` modunda açar →
müziği `Tone.OfflineContext` ile WAV olarak render eder → her kareyi `t = kare/30` için çizip
PNG olarak ffmpeg'e akıtır → ffmpeg H.264 + AAC olarak birleştirir ve süreleri doğrular.

Geliştirme yardımcıları: `sheet.html` (dev sunucusunda `/sheet.html`) tüm karakter kafalarını,
`/sheet.html?body=1` kıyafetleri, `/sheet.html?hands=1` elleri gösteren bir model sayfasıdır.

## Oynatıcı

- Açılışta **"İzlemek için dokun"** ekranı (tarayıcıların otomatik ses kısıtlaması için). Müzik bu sırada arka planda üretilir.
- Oynat/duraklat, zaman çubuğu ile ileri-geri sarma, ses aç/kapat, altyazı aç/kapat (CC), tam ekran.
- Klavye: `Boşluk` oynat/duraklat, `←/→` 5 sn, `M` ses, `C` altyazı, `F` tam ekran.
- Tablet/telefonda ekrana sığar; iç çözünürlük ekran boyutuna göre ölçeklenir (performans için).
  Telefonda dikey tutulduğunda yatay çevirme ipucu gösterilir.

## Altyazıları düzenleme — `src/subtitles.json`

```json
{ "start": 37.4, "end": 39.3, "speaker": "Selene", "kind": "dialogue", "text": "Hiç ağlamıyor, Aldric..." }
```

| alan | anlamı |
|---|---|
| `start`, `end` | saniye cinsinden görünme aralığı (0.25 sn yumuşak geçişle) |
| `speaker` | konuşan kişi (`Nolan`, `Joseph`, `Selene`, `Aldric`, `Mira`) |
| `kind` | `"inner"` → iç ses: *italik*, isim yazılmaz · `"dialogue"` → **İsim:** metin |
| `text` | metin (uzun satırlar otomatik iki satıra bölünür) |

Altyazılar sinema bandının (2.39:1) alt siyah şeridine çizilir; bu yüzden MP4'e de gömülüdür.
Kaydedip sayfayı yenilemek (veya `npm run export`) yeterli.

## Karakter renklerini değiştirme — `src/characters.ts`

Her karakterin `skin` (ten: base/shadow/deep/blush), `hair` (saç: base/shadow/highlight, Mira için `tip` gradyanı,
Aldric için `streak` kır tutamlar), `eyes` (iris/dark/light/lash), `line` (çizgi rengi) ve `outfit`
(kıyafet) renkleri burada. Değiştirdiğiniz renk tüm sahnelere yansır.
Renkler `reference/` klasöründeki karakter sayfalarındaki örneklerden alındı ve cel-shading için biraz aydınlatıldı.

- Saç modelleri: `src/lib/hair.ts` (`HAIR`) — bezier tutamlardan oluşur.
- Yüz oranları (yetişkin/bebek/1 yaş/3 yaş): `src/lib/face.ts` (`PROPORTIONS`).
- Kıyafetler/eller: `src/lib/bodies.ts`.

## Zamanlama — `src/cues.ts`

Tüm sahne ve ses olaylarının saniyeleri tek dosyada (`CUE.levelUp`, `CUE.horn`, `CUE.silence`, …).
Hem görüntü hem müzik buradan okur; bir değeri değiştirince ses–görüntü senkronu korunur.

## Proje yapısı

```
src/
  main.ts            oynatıcı + ?export modu (Playwright kancası window.__film)
  film.ts            sahne listesi, renderFrame(ctx, t), sinema bantları, gren, vinyet, altyazılar
  timeline.ts        GSAP master timeline (duraklatılmış; her karede seek(t))
  cues.ts            ortak zaman işaretleri
  characters.ts      karakter tasarımları (renkler)
  subtitles.json     altyazılar
  scenes/            s00_black … s07_title (her sahne ayrı modül) + ortak arka planlar
  lib/               fırça (değişken kalınlıkta çizgi), yüz, saç, kıyafet, efektler
  audio/score.ts     Tone.js ile prosedürel müzik ve efektler
scripts/             keyframes.mjs, export.mjs, server.mjs
.github/workflows/   pages.yml (yayın), release.yml (MP4 + GitHub Release)
```

## Sahne akışı

| süre | sahne |
|---|---|
| 0:00–0:03 | Siyah ekran, uzaktan yağmur ve kalp atışı |
| 0:03–0:15 | Nolan'ın dairesi: geniş plan → monitör ışığında yüz → uydurma RPG'de **LEVEL UP** → yağmurlu sokak |
| 0:15–0:23 | Yaya geçidi, farlar, fren ve korna, ağır çekimde düşen telefon ("Devam edilsin mi?"), ani sessizlik, beyaz ekran ve kulak çınlaması |
| 0:23–0:33 | Bebek bakış açısı: bulanık sıcak ışık → Selene'nin yüzü ve ninnisi, minik eller, Aldric |
| 0:33–0:41 | Pencereden mevsimler (kar, çiçek, yaz) ve büyüyen saksı; "Hiç ağlamıyor…" |
| 0:41–0:49 | Yeşil şifa büyüsü, Joseph'in gözlerinde yansıması, Selene'nin üstünde beliren yarı saydam durum paneli |
| 0:49–0:57 | Mum ışığında Mira'nın doğumu ve ağlaması; 3 yaşındaki Joseph'in küçük gülümsemesi |
| 0:57–1:00 | Başlık kartı ve yavaş kararma |

## Kararlar

Belirsiz noktalarda aldığım kararlar:

1. **Teknoloji:** PixiJS yerine Canvas 2D seçildi (bağımlılık az, kare kare dışa aktarım basit, her şey vektör).
   Film 1920×1080 mantıksal koordinatta çizilir; telefonlarda iç çözünürlük düşürülür.
2. **Determinizm:** Görüntüde `Math.random()` yok; tüm rastgelelikler tohumlu hash'lerden. GSAP timeline
   oynatılmaz, her karede `seek(t)` yapılır ve anahtar kareler `fromTo` zinciriyle kurulur — bu yüzden
   herhangi bir saniyeye atlamak birebir aynı kareyi verir.
3. **Ses ve senkron:** Müzik sayfa açılırken tarayıcıda `Tone.OfflineContext` ile tek bir tampona render edilir;
   oynatıcı bu tamponu çalar ve görüntü saatini doğrudan `AudioContext` saatinden alır. MP4 de aynı tamponu
   kullanır; böylece canlı oynatım ile video aynı sesi, aynı zamanlamayla içerir. Hız için skor bölümlere
   ayrılıp paralel render edilir (tüm skor tek parça render edildiğinde ~10 kat yavaştı).
4. **Altyazılar** canvas'a, sinema bandının alt şeridine çizilir (MP4'e gömülü; oynatıcıda CC ile kapatılabilir).
   İlk iki iç ses Nolan'a, sonrakiler Joseph'e atandı. "Büyü… gerçekmiş. Ve bu dünyanın seviyeleri var…"
   repliği okunabilirlik için iki altyazıya bölündü.
5. **Kaza:** Çarpma, kan ya da yaralanma gösterilmez. Farlar → korna/fren → ağır çekim (yağmur damlaları havada
   asılı) → 20.4 sn'de tam sessizlik → beyaz ekran + yüksek frekanslı çınlama.
6. **Mira'nın ağlaması** sentezlenmedi (kötü duyulma riski): ağlama yüz ifadesi, gözyaşı ve anime "ağlama çizgileri"
   ile görsel olarak; duygusal yükseliş ise yaylılar + piyano ile veriliyor.
7. **Ana tema:** Selene'nin ninnisi (Re majör, 3/4) filmin ana teması; montajda müzik kutusunda,
   Joseph gülümserken piyanoda, başlık kartında güçlü bir tekrar olarak duyulur.
8. **Büyü sahnesi:** Selene, Aldric'in yorgun elini iyileştirir (yara gösterilmez). Durum paneli Selene'nin üstünde
   (Lv. 23 · Şifacı) bir an belirip "glitch" ile kaybolur; paneldeki ses, Nolan'ın oyunundaki level-up sesinin
   camsı bir yankısıdır. Joseph'in kendi paneli yok.
9. **Yaşlar:** Joseph bebek / ~1 yaş / 3 yaş, Mira yeni doğmuş olarak çizildi (büyük kafa, kısa yüz, seyrek saç;
   Mira'da pembe-lavanta tek tutam). Saç, göz ve ten renkleri referans sayfalarından.
10. **Markasız:** Telefon ve oyun tamamen özgün; referanstaki konsol logosu kullanılmadı. Oyunun adı uydurma:
    "AETHERFALL · Ember Chronicle".
11. **Renk dili:** Nolan'ın dünyası soğuk mavi/gri (soft-light mavi grade), Elonth sıcak amber/altın;
    büyü yeşili ve durum paneli camgöbeği bilinçli kontrast olarak kullanıldı.
12. **Sinematik dil:** 2.39:1 bantlar, hafif film greni ve vinyet her karede; yavaş kamera yaklaşmaları,
    çok yakın planlar (göz), "match cut" kafiyeleri (Nolan'ın gözü ↔ Joseph'in gözü aynı kadrajda;
    beyaz far ışığı ↔ yeniden doğuşun beyaz ışığı).
13. **Yayın:** Pages, `main` veya `claude/**` dallarına her push'ta `gh-pages` dalına yayımlanır.
    MP4, CI'da yeniden render edilip her seferinde yeni bir release'e (`prolog-rN`) eklenir; "latest" bağlantısı
    her zaman en yeni videoyu indirir.
14. **Referans dosyaları** `nolan.png`, `selene.png`, `aldric.png`, `joseph.png`, `mira.png` olarak yeniden adlandırıldı.
15. **Fontlar:** Türkçe karakterler için Noto Sans, başlık için Cinzel (ikisi de OFL, npm üzerinden pakete gömülü —
    dışa aktarımda makineden bağımsız aynı görünüm).

Telif: Her şey özgün; dış ses/görsel dosyası yok. Ayrıntılar için [CREDITS.md](CREDITS.md).
