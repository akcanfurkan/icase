# iCase - AI-Powered QA Platform

Yapay zeka destekli, full-stack bir QA Test Yonetim platformu. Google Gemini AI ile akilli test vakasi uretimi, Playwright ile DOM cikarma, yapilandirilmis bug raporu olusturma ve Excel export ozellikleri sunar.

## Ozellikler

- **AI Destekli Test Uretimi** — Google Gemini ile gereksinim, URL ve ekran goruntusu analizi
- **Deterministik Mod** — AI olmadan da yapisal analiz tabanli test uretimi (fallback)
- **DOM Cikarma** — Playwright ile web sayfasindan otomatik eleman analizi
- **Gorsel Analiz** — Ekran goruntusunden AI ile test vakasi uretimi
- **Bug Raporu Olusturucu** — Hata tanimlarindan yapilandirilmis bug raporu
- **Excel Export** — Test vakalarini .xlsx olarak indirme
- **Proje Yonetimi** — Projeleri, test kosularini ve bug raporlarini organize etme
- **Kimlik Dogrulama** — Kullanici bazli giris, kayit ve API key yonetimi

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React (Vite) |
| Backend | Node.js + Express |
| Veritabani | SQLite (better-sqlite3) |
| AI | Google Gemini API (gemini-2.5-flash) |
| DOM | Playwright (headless Chromium) |
| Export | xlsx |

## Hizli Baslangic

### Gereksinimler

- Node.js v18+
- npm

### Kurulum ve Calistirma

```bash
# 1. Tum bagimliliklari yukle (root + server + client)
npm run install:all

# 2. Server ve client'i baslat
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

### API Key Ayari

Giris yaptiktan sonra **Settings** sayfasindan Gemini API key'inizi girebilirsiniz. Key almak icin:

1. https://aistudio.google.com adresine gidin
2. Google hesabinizla giris yapin
3. "Get API Key" butonuna tiklayin
4. Yeni bir key olusturun ve kopyalayin
5. iCase Settings sayfasina yapisitirin

**Ucretsiz Kullanim:** Gemini API ucretsiz katmanda dakikada 15, gunde 1500 istek destekler.

### Manuel Kurulum

```bash
# Root bagimliliklari yukle
npm install

# Server bagimliliklari yukle
cd server && npm install && cd ..

# Client bagimliliklari yukle
cd client && npm install && cd ..

# Playwright tarayicilari yukle (bir kerelik)
cd server && npx playwright install chromium && cd ..

# Calistir
npm run dev
```

## Proje Yapisi

```
icase/
├── package.json
├── README.md
├── server/
│   ├── package.json
│   ├── .env                  # Gemini API key (git'e eklenmez)
│   ├── .env.example          # Ornek .env dosyasi
│   ├── data/                 # SQLite veritabani (otomatik olusur)
│   ├── uploads/              # Yuklenen gorseller (otomatik olusur)
│   └── src/
│       ├── index.js          # Express giris noktasi
│       ├── db/
│       │   └── database.js   # SQLite sema ve indexler
│       ├── adapters/
│       │   ├── geminiAdapter.js      # Google Gemini AI entegrasyonu
│       │   └── bugReportAdapter.js   # Bug raporu AI entegrasyonu
│       ├── extractors/
│       │   ├── domExtractor.js         # Playwright DOM cikarma
│       │   └── imageSignalExtractor.js # Gorsel metadata analizi
│       ├── intelligence/               # Deterministik test motoru
│       │   ├── domAnalyzer.js
│       │   ├── interactionMapper.js
│       │   ├── coveragePlanner.js
│       │   ├── testMatrixGenerator.js
│       │   ├── testCaseBuilder.js
│       │   └── coverageEngine.js
│       ├── services/
│       │   └── testCaseService.js      # Ust duzey orkestrasyon
│       ├── validators/
│       │   └── jsonValidator.js
│       ├── engines/
│       │   └── bugReportEngine.js
│       ├── middleware/
│       │   └── auth.js
│       └── routes/
│           ├── auth.js
│           ├── settings.js
│           ├── projects.js
│           ├── testRuns.js
│           ├── testCases.js
│           └── bugReports.js
└── client/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── api/
        │   └── client.js
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Sidebar.jsx
        │   └── StepProgress.jsx
        └── pages/
            ├── Dashboard.jsx
            ├── Projects.jsx
            ├── ProjectDetail.jsx
            ├── GenerateTests.jsx
            ├── BugGenerator.jsx
            ├── TestCases.jsx
            ├── TestRunDetail.jsx
            ├── Login.jsx
            ├── Register.jsx
            └── Settings.jsx
```

## API Endpointleri

### Kimlik Dogrulama
| Metot | Endpoint | Aciklama |
|-------|----------|----------|
| POST | /api/auth/register | Yeni kullanici kaydi |
| POST | /api/auth/login | Giris yap |
| GET | /api/auth/me | Mevcut kullanici bilgisi |

### Ayarlar
| Metot | Endpoint | Aciklama |
|-------|----------|----------|
| GET | /api/settings | Kullanici ayarlari |
| PUT | /api/settings/api-key | API key kaydet |
| DELETE | /api/settings/api-key | API key sil |

### Projeler
| Metot | Endpoint | Aciklama |
|-------|----------|----------|
| GET | /api/projects | Tum projeleri listele |
| GET | /api/projects/:id | Proje detayi |
| POST | /api/projects | Proje olustur |
| PUT | /api/projects/:id | Proje guncelle |
| DELETE | /api/projects/:id | Proje sil |

### Test Kosulari
| Metot | Endpoint | Aciklama |
|-------|----------|----------|
| GET | /api/test-runs | Tum test kosularini listele |
| GET | /api/test-runs/:id | Test kosusu detayi + test vakalari |
| POST | /api/test-runs | Kosu olustur & test vakalarini uret |
| POST | /api/test-runs/stream | SSE ile kosu olustur |
| PUT | /api/test-runs/:id | Test kosusunu guncelle |
| DELETE | /api/test-runs/:id | Test kosusunu sil |

### Test Vakalari
| Metot | Endpoint | Aciklama |
|-------|----------|----------|
| GET | /api/test-cases | Test vakalarini listele |
| GET | /api/test-cases/:id | Tekil test vakasi |
| POST | /api/test-cases/generate | Onizleme icin test uret |
| POST | /api/test-cases/generate-stream | SSE ile test uret |
| GET | /api/test-cases/ai-status | AI durumunu kontrol et |
| PUT | /api/test-cases/:id | Test vakasini guncelle |
| DELETE | /api/test-cases/:id | Test vakasini sil |
| GET | /api/test-cases/export | Excel olarak indir |

### Bug Raporlari
| Metot | Endpoint | Aciklama |
|-------|----------|----------|
| GET | /api/bug-reports | Bug raporlarini listele |
| GET | /api/bug-reports/:id | Bug raporu detayi |
| POST | /api/bug-reports/generate | Bug raporu onizleme |
| POST | /api/bug-reports/generate-stream | SSE ile bug raporu uret |
| POST | /api/bug-reports | Bug raporu kaydet |
| PUT | /api/bug-reports/:id | Bug raporu guncelle |
| DELETE | /api/bug-reports/:id | Bug raporu sil |

## Notlar

- AI modu icin Settings sayfasindan Gemini API key girilmesi gereklidir, yoksa deterministik mod calisir
- SQLite veritabani ilk calistirmada otomatik olusur
- Yuklenen gorseller `server/uploads/` klasorunde saklanir
- `.env` dosyasi git'e eklenmez (guvenlik)
- Performans indexleri veritabaninda otomatik olusturulur
