/**
 * Gemini Adapter — Google Gemini AI Integration for Test Case Generation
 *
 * Supports:
 *  - Text-only generation (requirement text + optional DOM data)
 *  - Multimodal generation (requirement text + screenshot image)
 *  - Structured JSON output
 *  - Turkish professional QA test cases
 *
 * Model: gemini-2.0-flash (free tier, multimodal, fast)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const MODEL_NAME = 'gemini-2.5-flash';

// ═══════════════════════════════════════════════════
// System Prompt
// ═══════════════════════════════════════════════════

const SYSTEM_PROMPT = `Sen profesyonel bir QA Test Mühendisisin. Görevin, verilen gereksinimler, ekran görüntüleri ve DOM verileri doğrultusunda kapsamlı, detaylı ve gerçekçi test vakaları üretmektir.

KURALLAR:
1. Kullanıcının yazdığı dilde yanıt ver. Eğer Türkçe yazıyorsa Türkçe, İngilizce yazıyorsa İngilizce yanıt ver. Hangi dilde yazıyorsa o dilde çıktı üret.
2. Açıklama, yorum veya ek metin YAZMA. SADECE JSON döndür.
3. Gereksinimin karmaşıklığına göre 30 ile 50 arasında test vakası üret. Basit gereksinimler için en az 30, karmaşık veya çok özellikli gereksinimler için 40-50 arası üret.
4. Her test vakası benzersiz olmalı, tekrar YAPMA.
5. Gerçek alan adlarını, buton isimlerini ve sayfa öğelerini kullan.
6. Şablon cümleler kullanma, her test vakası bağlama özel olsun.
7. Test adımları somut, spesifik ve uygulanabilir olmalı. Her adımda:
   - Hangi UI elemanıyla (buton adı, alan adı, menü) etkileşim yapılacağını belirt
   - Girilecek veriyi örnekle göster (örn: "test@example.com", "Abc123!", "05551234567")
   - Kullanıcının fiziksel eylemini yaz (tıkla, yaz, seç, kaydır, bekle, vs.)
   - Genel ifadeler KULLANMA ("bilgileri gir" yerine "E-posta alanına 'test@example.com' yaz")
8. Beklenen sonuçlar net, doğrulanabilir ve spesifik olmalı. Genel ifadeler yerine tam olarak ne görülmesi/olması gerektiğini yaz.
9. Her test kategorisinden birden fazla test vakası üret — yüzeysel geçme, derinlemesine kapsa.

TEST KAPSAMI (her biri için en az 2-3 test vakası üret):
- Fonksiyonel testler (başarılı akışlar, farklı senaryolar)
- Negatif testler (boş alan, geçersiz veri, hatalı format, eksik bilgi)
- Güvenlik testleri (SQL injection, XSS, brute force, CSRF, yetkilendirme)
- Sınır değer testleri (max karakter, özel karakter, minimum değer, sıfır değer)
- Kullanılabilirlik testleri (UX, erişilebilirlik, kullanıcı deneyimi)
- Durum geçişi testleri (giriş sonrası yönlendirme, durum değişiklikleri)
- Hata yönetimi testleri (sunucu hatası, bağlantı kopması, timeout)
- Arayüz testleri (görsel tutarlılık, responsive tasarım, farklı çözünürlükler)
- Doğrulama testleri (e-posta formatı, şifre kuralları, telefon formatı vb.)
- Performans testleri (yükleme süresi, eşzamanlı işlem)
- Uyumluluk testleri (farklı tarayıcılar, farklı cihazlar)

EĞER EKRAN GÖRÜNTÜSÜ VERİLDİYSE:
- Görseldeki TÜM form alanlarını, butonları, menüleri, hata mesajlarını analiz et.
- Görüntüdeki gerçek metin ve etiketleri kullan (placeholder, buton yazıları vb.)
- Sayfanın amacını görsellerden anla (giriş sayfası, kayıt, ödeme, vb.)
- Görsel tasarımdaki olası sorunları da test et.

EĞER DOM VERİSİ VERİLDİYSE:
- DOM'daki gerçek alan isimlerini, placeholder değerlerini, buton metinlerini kullan.
- disabled, required gibi HTML özelliklerini dikkate al.
- Form action ve method bilgilerini kullan.

ÖNCELİK SEVİYELERİ:
- "Kritik": Güvenlik açıkları, veri kaybı riski
- "Yüksek": Temel işlevsellik bozulması
- "Orta": Kullanılabilirlik sorunları
- "Düşük": Kozmetik ve minor sorunlar

TÜR (type) DEĞERLERİ:
"Fonksiyonel", "Negatif", "Güvenlik", "Sınır Değer", "Kullanılabilirlik", "Durum Geçişi", "Hata Yönetimi", "Arayüz", "Doğrulama", "Erişilebilirlik", "Uyumluluk", "Performans"

ÇIKTI FORMATI (SADECE bu JSON formatında döndür, başka hiçbir şey yazma):
[
  {
    "id": 1,
    "feature": "Kullanıcı Girişi",
    "title": "Geçerli e-posta ve şifre ile başarılı giriş",
    "preconditions": "Kullanıcı kayıtlı bir hesaba sahip olmalı. Tarayıcıda çerezler etkin olmalı.",
    "steps": "1. Tarayıcıda giriş sayfasını aç (örn: https://example.com/login)\\n2. 'E-posta' alanına kayıtlı e-posta adresini yaz (örn: kullanici@example.com)\\n3. 'Şifre' alanına doğru şifreyi yaz (örn: Test1234!)\\n4. 'Beni Hatırla' kutucuğunun işaretli olmadığını doğrula\\n5. 'Giriş Yap' butonuna tıkla\\n6. Sayfanın ana panele yönlendirilmesini bekle",
    "expected": "Kullanıcı başarıyla giriş yapar ve ana panel sayfasına yönlendirilir. Sağ üst köşede kullanıcı adı görüntülenir. URL 'dashboard' içerir.",
    "priority": "Kritik|Yüksek|Orta|Düşük",
    "type": "Tür değeri",
    "platform": "PLATFORM_PLACEHOLDER"
  }
]`;

// ═══════════════════════════════════════════════════
// Main Entry
// ═══════════════════════════════════════════════════

/**
 * Generate test cases using Google Gemini AI.
 *
 * @param {object} params
 * @param {string} params.requirement  - Requirement text
 * @param {string} params.platform     - Web | Mobile | API
 * @param {object|null} params.domData - Raw DOM extraction data
 * @param {Array} params.imagePaths - Array of absolute paths to uploaded image files
 * @param {object|null} params.imageSignals - Image signal metadata
 * @returns {Promise<{ testCases: Array, metadata: object }>}
 */
async function generateTestCases({ requirement, platform = 'Web', domData = null, imagePaths = [], imageSignals = null, apiKey: userApiKey = null }) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('API key not configured. Please add your Gemini API key in Settings.');
  }

  // Backwards compatibility
  if (!Array.isArray(imagePaths)) imagePaths = imagePaths ? [imagePaths] : [];

  console.log('\n' + '═'.repeat(70));
  console.log('[GeminiAdapter] AI test vakası üretimi başlatılıyor...');
  console.log(`[GeminiAdapter] Model: ${MODEL_NAME}`);
  console.log(`[GeminiAdapter] API key kaynağı: ${userApiKey ? 'Kullanıcı (Settings)' : 'Sunucu (.env)'}`);
  console.log(`[GeminiAdapter] Gereksinim: ${requirement.substring(0, 100)}...`);
  console.log(`[GeminiAdapter] Platform: ${platform}`);
  console.log(`[GeminiAdapter] DOM: ${domData ? 'Var' : 'Yok'}`);
  console.log(`[GeminiAdapter] Görseller: ${imagePaths.length > 0 ? `${imagePaths.length} adet` : 'Yok'}`);
  console.log('═'.repeat(70));

  const startTime = Date.now();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 32768,
      responseMimeType: 'application/json',
    },
  });

  // Build prompt parts
  const parts = [];

  // System instruction
  const systemPrompt = SYSTEM_PROMPT.replace('PLATFORM_PLACEHOLDER', platform);
  parts.push({ text: systemPrompt });

  // User content
  let userPrompt = `\n\n--- GEREKSİNİM ---\n${requirement}\n\nPlatform: ${platform}\n`;

  // Add DOM data if available
  if (domData && !domData.error) {
    const domSummary = buildDOMSummary(domData);
    userPrompt += `\n--- DOM VERİSİ (gerçek sayfa yapısı) ---\n${domSummary}\n`;
  }

  // Add image signals if available
  if (imageSignals && imageSignals.signals && imageSignals.signals.length > 0) {
    userPrompt += `\n--- GÖRSEL SİNYALLERİ ---\nDosya: ${imageSignals.fileName}\nBoyut: ${imageSignals.fileSize?.humanReadable || 'Bilinmiyor'}\nSinyaller: ${imageSignals.signals.map(s => s.signal).join(', ')}\n`;
  }

  userPrompt += `\n--- TALİMAT ---\nYukarıdaki gereksinime ve sayfa verilerine göre minimum 30 detaylı test vakası üret (kullanıcının yazdığı dilde). Her test adımı spesifik, somut ve örnek verilerle zenginleştirilmiş olsun. SADECE JSON array döndür.\n`;

  parts.push({ text: userPrompt });

  // Add images if available (multimodal — up to 5)
  let addedImageCount = 0;
  for (const imgPath of imagePaths) {
    try {
      const absPath = path.isAbsolute(imgPath) ? imgPath : path.join(__dirname, '..', '..', 'uploads', imgPath);
      if (fs.existsSync(absPath)) {
        const imageData = fs.readFileSync(absPath);
        const ext = path.extname(absPath).toLowerCase().slice(1);
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
        const mimeType = mimeMap[ext] || 'image/png';

        parts.push({
          inlineData: {
            data: imageData.toString('base64'),
            mimeType,
          },
        });
        addedImageCount++;
        console.log(`[GeminiAdapter] Görsel ${addedImageCount} eklendi: ${path.basename(absPath)} (${mimeType})`);
      } else {
        console.warn(`[GeminiAdapter] Görsel bulunamadı: ${absPath}`);
      }
    } catch (imgError) {
      console.warn(`[GeminiAdapter] Görsel yükleme hatası: ${imgError.message}`);
    }
  }
  if (addedImageCount > 0) {
    console.log(`[GeminiAdapter] Toplam ${addedImageCount} görsel Gemini'ye gönderilecek`);
  }

  // Call Gemini API
  console.log('[GeminiAdapter] Gemini API çağrılıyor...');

  let rawResponse;
  try {
    const result = await model.generateContent(parts);
    rawResponse = result.response.text();
    console.log(`[GeminiAdapter] API yanıtı alındı (${Date.now() - startTime}ms)`);
    console.log(`[GeminiAdapter] Ham yanıt uzunluğu: ${rawResponse.length} karakter`);
  } catch (apiError) {
    console.error(`[GeminiAdapter] API hatası: ${apiError.message}`);
    if (apiError.cause) {
      console.error(`[GeminiAdapter] Hata nedeni (cause): ${apiError.cause.message || apiError.cause}`);
    }
    const isNetworkError = apiError.message && apiError.message.toLowerCase().includes('fetch failed');
    const userMessage = isNetworkError
      ? 'Ağ bağlantı hatası. İnternet bağlantınızı, VPN ve güvenlik duvarı ayarlarınızı kontrol edin.'
      : `Gemini API hatası: ${apiError.message}`;
    throw new Error(userMessage);
  }

  // Parse JSON response
  let testCases;
  try {
    testCases = parseTestCases(rawResponse, platform);
    console.log(`[GeminiAdapter] ${testCases.length} test vakası parse edildi ✅`);
  } catch (parseError) {
    console.error(`[GeminiAdapter] JSON parse hatası: ${parseError.message}`);
    console.error(`[GeminiAdapter] Ham yanıt (ilk 500 karakter): ${rawResponse.substring(0, 500)}`);

    // Retry once
    console.log('[GeminiAdapter] Tekrar deneniyor...');
    try {
      const retryParts = [...parts, { text: '\n\nÖNCEKİ YANITINDA JSON PARSE HATASI OLUŞTU. SADECE geçerli JSON array döndür, başka hiçbir metin ekleme. [ ile başla, ] ile bitir.' }];
      const retryResult = await model.generateContent(retryParts);
      rawResponse = retryResult.response.text();
      testCases = parseTestCases(rawResponse, platform);
      console.log(`[GeminiAdapter] Tekrar deneme başarılı — ${testCases.length} test vakası ✅`);
    } catch (retryError) {
      console.error(`[GeminiAdapter] Tekrar deneme de başarısız: ${retryError.message}`);
      throw new Error('Gemini yanıtı geçerli JSON formatında değil. Lütfen tekrar deneyin.');
    }
  }

  const totalTime = Date.now() - startTime;

  console.log('\n' + '═'.repeat(70));
  console.log(`[GeminiAdapter] Tamamlandı!`);
  console.log(`  Model           : ${MODEL_NAME}`);
  console.log(`  Toplam süre     : ${totalTime}ms`);
  console.log(`  Test vakası     : ${testCases.length}`);
  console.log(`  Multimodal      : ${addedImageCount > 0 ? `Evet (${addedImageCount} görsel analiz edildi)` : 'Hayır'}`);
  console.log('═'.repeat(70) + '\n');

  return {
    testCases,
    metadata: {
      engine: 'gemini-ai',
      model: MODEL_NAME,
      platform,
      totalCases: testCases.length,
      executionTimeMs: totalTime,
      multimodal: addedImageCount > 0,
      imageCount: addedImageCount,
      domUsed: !!domData && !domData.error,
      source: domData ? 'dom+ai' : addedImageCount > 0 ? 'image+ai' : 'requirement+ai',
    },
  };
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function buildDOMSummary(domData) {
  const lines = [];

  if (domData.pageTitle) lines.push(`Sayfa Başlığı: ${domData.pageTitle}`);
  if (domData.url) lines.push(`URL: ${domData.url}`);

  if (domData.inputs && domData.inputs.length > 0) {
    lines.push('\nForm Alanları:');
    for (const inp of domData.inputs) {
      const attrs = [];
      if (inp.type) attrs.push(`type="${inp.type}"`);
      if (inp.placeholder) attrs.push(`placeholder="${inp.placeholder}"`);
      if (inp.label) attrs.push(`label="${inp.label}"`);
      if (inp.name) attrs.push(`name="${inp.name}"`);
      if (inp.required) attrs.push('zorunlu');
      if (inp.disabled) attrs.push('devre dışı');
      lines.push(`  - <${inp.tag || 'input'}> ${attrs.join(', ')}`);
    }
  }

  if (domData.buttons && domData.buttons.length > 0) {
    lines.push('\nButonlar:');
    for (const btn of domData.buttons) {
      const attrs = [];
      if (btn.text) attrs.push(`"${btn.text}"`);
      if (btn.type) attrs.push(`type="${btn.type}"`);
      if (btn.disabled) attrs.push('devre dışı');
      lines.push(`  - <button> ${attrs.join(', ')}`);
    }
  }

  if (domData.forms && domData.forms.length > 0) {
    lines.push('\nFormlar:');
    for (const form of domData.forms) {
      lines.push(`  - <form> action="${form.action || ''}" method="${form.method || 'GET'}" (${form.fields?.length || 0} alan)`);
    }
  }

  if (domData.links && domData.links.length > 0) {
    lines.push(`\nBağlantılar: ${domData.links.length} adet`);
    for (const link of domData.links.slice(0, 10)) {
      if (link.text) lines.push(`  - "${link.text}" → ${link.href}`);
    }
  }

  return lines.join('\n');
}

function parseTestCases(raw, platform) {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (directError) {
    // Truncated JSON recovery: find last complete object in array
    console.log('[GeminiAdapter] Doğrudan parse başarısız, kısmi JSON kurtarma deneniyor...');
    parsed = recoverTruncatedArray(cleaned);
    if (!parsed) throw directError;
    console.log(`[GeminiAdapter] Kısmi JSON'dan ${parsed.length} test vakası kurtarıldı`);
  }

  if (!Array.isArray(parsed)) {
    if (parsed.testCases && Array.isArray(parsed.testCases)) {
      parsed = parsed.testCases;
    } else if (parsed.test_cases && Array.isArray(parsed.test_cases)) {
      parsed = parsed.test_cases;
    } else {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          parsed = parsed[key];
          break;
        }
      }
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Yanıt bir JSON array değil');
  }

  return parsed.map((tc, i) => ({
    id: tc.id || i + 1,
    feature: tc.feature || tc.özellik || 'Genel',
    title: tc.title || tc.başlık || tc.baslik || 'Test vakası',
    preconditions: tc.preconditions || tc.ön_koşullar || tc.onkosullar || tc.on_kosullar || '',
    steps: tc.steps || tc.adımlar || tc.adimlar || '',
    expected: tc.expected || tc.beklenen || tc.beklenen_sonuç || tc.beklenen_sonuc || '',
    priority: tc.priority || tc.öncelik || tc.oncelik || 'Orta',
    type: tc.type || tc.tür || tc.tur || 'Fonksiyonel',
    platform: tc.platform || platform,
  }));
}

function recoverTruncatedArray(raw) {
  // Find the last complete JSON object closing brace+bracket pattern
  let lastGoodEnd = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 1 && ch === '}') {
        // We just closed an object at array depth — mark as recovery point
        lastGoodEnd = i;
      }
    }
  }

  if (lastGoodEnd === -1) return null;

  const truncated = raw.substring(0, lastGoodEnd + 1) + ']';
  try {
    const result = JSON.parse(truncated);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * Check if Gemini API key is configured.
 * @returns {boolean}
 */
function isConfigured(userApiKey = null) {
  const key = userApiKey || process.env.GEMINI_API_KEY;
  return !!key && key !== 'your_api_key_here';
}

module.exports = { generateTestCases, isConfigured };

