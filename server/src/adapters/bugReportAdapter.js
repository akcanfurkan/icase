/**
 * Bug Report Adapter — Google Gemini AI Integration for Bug Report Generation
 *
 * Generates professional QA bug reports from:
 *  - Bug description text
 *  - Screenshot images (multimodal, up to 5)
 *
 * Output: Single structured bug report object (not array)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Sen profesyonel bir QA Test Mühendisisin. Görevin, verilen hata açıklaması ve ekran görüntüleri doğrultusunda standart QA bug raporu şablonuna göre detaylı ve profesyonel bir bug raporu üretmektir.

KURALLAR:
1. Kullanıcının yazdığı dilde yanıt ver. Eğer Türkçe yazıyorsa Türkçe, İngilizce yazıyorsa İngilizce yanıt ver.
2. Açıklama, yorum veya ek metin YAZMA. SADECE JSON döndür.
3. Tek bir bug raporu üret (array değil, tek JSON objesi).
4. Her alan detaylı ve profesyonel olmalı — genel ifadeler kullanma.
5. Steps to Reproduce adımları somut, spesifik ve numaralı olmalı.
6. Actual Result ve Expected Result net ve doğrulanabilir olmalı.
7. Environment alanı tahmini olarak doldurulmalı (görselden veya bağlamdan çıkar).

EĞER EKRAN GÖRÜNTÜSÜ VERİLDİYSE:
- Görseldeki hata mesajlarını, UI durumunu, URL'yi analiz et
- Görüntüdeki gerçek metin ve etiketleri kullan
- Hatanın görsel kanıtlarını "Additional Notes" alanında belirt

SEVERITY SEVİYELERİ:
- "Critical": Uygulama çökmesi, veri kaybı, güvenlik açığı
- "High": Temel işlevsellik bozuk, kullanıcı engellenmiş
- "Medium": İşlevsellik kısmen bozuk, geçici çözüm var
- "Low": Kozmetik, yazım hatası, minor UI sorunu

ÇIKTI FORMATI (SADECE bu JSON formatında döndür):
{
  "title": "Kısa ve açıklayıcı bug başlığı",
  "severity": "Critical|High|Medium|Low",
  "priority": "Critical|High|Medium|Low",
  "environment": "Tahmini ortam bilgisi (tarayıcı, OS, cihaz vb.)",
  "steps_to_reproduce": "1. İlk adım\\n2. İkinci adım\\n3. Üçüncü adım\\n4. Hatanın gözlemlenmesi",
  "actual_result": "Gerçekte ne oluyor — detaylı açıklama",
  "expected_result": "Ne olması gerekiyordu — detaylı açıklama",
  "additional_notes": "Ek bilgiler, gözlemler, olası nedenler"
}`;

/**
 * Generate a bug report using Google Gemini AI.
 */
async function generateBugReport({ errorDescription, imagePaths = [], apiKey: userApiKey = null, onProgress = null }) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('API key not configured. Please add your Gemini API key in Settings.');
  }

  if (!Array.isArray(imagePaths)) imagePaths = imagePaths ? [imagePaths] : [];

  const emit = (step, status, timeMs) => {
    if (typeof onProgress === 'function') {
      try { onProgress({ step, status, timeMs }); } catch (_) {}
    }
  };

  console.log('\n' + '═'.repeat(70));
  console.log('[BugReportAdapter] AI bug raporu üretimi başlatılıyor...');
  console.log(`[BugReportAdapter] Model: ${MODEL_NAME}`);
  console.log(`[BugReportAdapter] API key kaynağı: ${userApiKey ? 'Kullanıcı (Settings)' : 'Sunucu (.env)'}`);
  console.log(`[BugReportAdapter] Açıklama: ${errorDescription.substring(0, 100)}...`);
  console.log(`[BugReportAdapter] Görseller: ${imagePaths.length > 0 ? `${imagePaths.length} adet` : 'Yok'}`);
  console.log('═'.repeat(70));

  const startTime = Date.now();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const parts = [];

  parts.push({ text: SYSTEM_PROMPT });

  let userPrompt = `\n\n--- HATA AÇIKLAMASI ---\n${errorDescription}\n`;
  userPrompt += `\n--- TALİMAT ---\nYukarıdaki hata açıklamasına göre profesyonel bir QA bug raporu üret. SADECE JSON objesi döndür.\n`;

  parts.push({ text: userPrompt });

  emit('image', imagePaths.length > 0 ? 'running' : 'skipped');

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
        console.log(`[BugReportAdapter] Görsel ${addedImageCount} eklendi: ${path.basename(absPath)} (${mimeType})`);
      }
    } catch (imgError) {
      console.warn(`[BugReportAdapter] Görsel yükleme hatası: ${imgError.message}`);
    }
  }

  if (imagePaths.length > 0) emit('image', 'done', Date.now() - startTime);

  emit('ai', 'running');
  console.log('[BugReportAdapter] Gemini API çağrılıyor...');
  const aiStart = Date.now();

  let rawResponse;
  try {
    const result = await model.generateContent(parts);
    rawResponse = result.response.text();
    const aiTime = Date.now() - aiStart;
    console.log(`[BugReportAdapter] API yanıtı alındı (${aiTime}ms)`);
    emit('ai', 'done', aiTime);
  } catch (apiError) {
    console.error(`[BugReportAdapter] API hatası: ${apiError.message}`);
    if (apiError.cause) {
      console.error(`[BugReportAdapter] Hata nedeni (cause): ${apiError.cause.message || apiError.cause}`);
    }
    const isNetworkError = apiError.message && apiError.message.toLowerCase().includes('fetch failed');
    const userMessage = isNetworkError
      ? 'Network connection error. Please check your internet connection, VPN, and firewall settings.'
      : `Gemini API error: ${apiError.message}`;
    throw new Error(userMessage);
  }

  emit('validation', 'running');
  let report;
  try {
    report = parseReport(rawResponse);
    console.log(`[BugReportAdapter] Bug raporu parse edildi ✅`);
  } catch (parseError) {
    console.error(`[BugReportAdapter] JSON parse hatası: ${parseError.message}`);

    try {
      const retryParts = [...parts, { text: '\n\nÖNCEKİ YANITINDA JSON PARSE HATASI OLUŞTU. SADECE geçerli JSON objesi döndür.' }];
      const retryResult = await model.generateContent(retryParts);
      rawResponse = retryResult.response.text();
      report = parseReport(rawResponse);
      console.log(`[BugReportAdapter] Tekrar deneme başarılı ✅`);
    } catch (retryError) {
      throw new Error('Gemini yanıtı geçerli JSON formatında değil. Lütfen tekrar deneyin.');
    }
  }

  emit('validation', 'done', 0);
  const totalTime = Date.now() - startTime;
  console.log(`[BugReportAdapter] Tamamlandı! (${totalTime}ms)\n`);

  return {
    ...report,
    status: 'Open',
    metadata: {
      engine: 'gemini-ai',
      model: MODEL_NAME,
      executionTimeMs: totalTime,
      multimodal: addedImageCount > 0,
      imageCount: addedImageCount,
    },
  };
}

function parseReport(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  const obj = Array.isArray(parsed) ? parsed[0] : parsed;

  return {
    title: obj.title || 'Bug Report',
    severity: obj.severity || 'Medium',
    priority: obj.priority || 'Medium',
    environment: obj.environment || '',
    steps_to_reproduce: obj.steps_to_reproduce || obj.stepsToReproduce || '',
    actual_result: obj.actual_result || obj.actualResult || '',
    expected_result: obj.expected_result || obj.expectedResult || '',
    additional_notes: obj.additional_notes || obj.additionalNotes || '',
  };
}

/**
 * Check if Gemini API key is configured.
 */
function isConfigured(userApiKey = null) {
  const key = userApiKey || process.env.GEMINI_API_KEY;
  return !!key && key !== 'your_api_key_here';
}

module.exports = { generateBugReport, isConfigured };
