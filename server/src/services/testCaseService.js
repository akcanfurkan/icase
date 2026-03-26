/**
 * Test Case Service — Orchestration Layer
 *
 * Dual-mode intelligence pipeline:
 *  - AI Mode (Gemini): When API key is configured → uses Google Gemini AI
 *    with multimodal support (text + image + DOM)
 *  - Deterministic Mode: Fallback when no API key → uses coverage engine
 *
 * Pipeline:
 *  1. DOM extraction (if URL provided)
 *  2. Image signal extraction (if image provided)
 *  3. AI generation (Gemini) or deterministic coverage engine
 *  4. JSON validation
 *  5. Return validated response
 */

const path = require('path');
const { extractDOM } = require('../extractors/domExtractor');
const { extractImageSignals } = require('../extractors/imageSignalExtractor');
const { execute: runCoverageEngine } = require('../intelligence/coverageEngine');
const { validateAndSanitize } = require('../validators/jsonValidator');

// Gemini adapter (optional — only used when API key is configured)
let geminiAdapter = null;
try {
  geminiAdapter = require('../adapters/geminiAdapter');
} catch (e) {
  console.log('[TestCaseService] Gemini adapter yüklenemedi, deterministik mod kullanılacak.');
}

/**
 * Check if AI mode is available.
 */
function isAIAvailable(userApiKey = null) {
  return geminiAdapter && geminiAdapter.isConfigured(userApiKey);
}

/**
 * Generates test cases with full intelligence pipeline.
 *
 * @param {object} params
 * @param {string} params.requirement - Requirement text (required)
 * @param {string} params.platform - Target platform: Web, Mobile, API
 * @param {string|null} params.url - URL for DOM extraction (optional)
 * @param {Array|null} params.imageFiles - Array of Multer file objects (optional)
 * @returns {Promise<object>}
 */
async function generateTestCases({ requirement, platform = 'Web', url = null, imageFiles = [], apiKey = null, onProgress = null }) {
  const useAI = isAIAvailable(apiKey);
  if (!imageFiles || !Array.isArray(imageFiles)) imageFiles = [];

  const emit = (step, status, timeMs) => {
    if (typeof onProgress === 'function') {
      try { onProgress({ step, status, timeMs }); } catch (_) {}
    }
  };

  console.log('\n' + '═'.repeat(70));
  console.log(`[TestCaseService] Pipeline başlatılıyor... [${useAI ? '🤖 AI Modu (Gemini)' : '⚙️ Deterministik Mod'}]`);
  console.log('═'.repeat(70));
  console.log(`[TestCaseService] Gereksinim: ${requirement}`);
  console.log(`[TestCaseService] Platform: ${platform}`);
  console.log(`[TestCaseService] URL: ${url || 'Yok'}`);
  console.log(`[TestCaseService] Görseller: ${imageFiles.length > 0 ? imageFiles.map(f => f.originalname).join(', ') : 'Yok'}`);
  console.log('─'.repeat(70));

  const pipelineStart = Date.now();

  // ── Step 1: DOM Extraction ──
  let domData = null;
  if (url) {
    emit('dom', 'running');
    console.log('\n[TestCaseService] Adım 1: DOM Çıkarma başlatılıyor...');
    const domStart = Date.now();
    try {
      domData = await extractDOM(url);
      const domTime = Date.now() - domStart;
      console.log(`[TestCaseService] DOM Çıkarma tamamlandı (${domTime}ms)`);
      console.log(`[TestCaseService] DOM Özeti: ${JSON.stringify(domData.summary)}`);
      emit('dom', 'done', domTime);
    } catch (error) {
      console.error(`[TestCaseService] DOM Çıkarma hatası: ${error.message}`);
      domData = { error: error.message, inputs: [], buttons: [], forms: [], links: [], ariaElements: [] };
      emit('dom', 'done', Date.now() - domStart);
    }
  } else {
    console.log('\n[TestCaseService] Adım 1: URL sağlanmadı, DOM çıkarma atlanıyor.');
    emit('dom', 'skipped');
  }

  // ── Step 2: Image Signal Extraction (multiple images) ──
  let imageSignals = null;
  const imagePaths = [];
  if (imageFiles.length > 0) {
    emit('image', 'running');
    console.log(`\n[TestCaseService] Adım 2: ${imageFiles.length} görsel işleniyor...`);
    const imgStart = Date.now();
    for (const imgFile of imageFiles) {
      try {
        const imgPath = imgFile.path || path.join(__dirname, '..', '..', 'uploads', imgFile.filename);
        imagePaths.push(imgPath);
        const signals = extractImageSignals(imgPath, imgFile.originalname);
        if (!imageSignals) {
          imageSignals = signals;
        } else {
          imageSignals.signals = [...(imageSignals.signals || []), ...(signals.signals || [])];
        }
      } catch (error) {
        console.error(`[TestCaseService] Görsel Sinyal Çıkarma hatası (${imgFile.originalname}): ${error.message}`);
      }
    }
    if (!imageSignals) imageSignals = { error: 'Tüm görseller başarısız', signals: [] };
    const imgTime = Date.now() - imgStart;
    console.log(`[TestCaseService] Görsel Sinyal Çıkarma tamamlandı (${imgTime}ms) — ${imagePaths.length} görsel`);
    emit('image', 'done', imgTime);
  } else {
    console.log('\n[TestCaseService] Adım 2: Görsel sağlanmadı, sinyal çıkarma atlanıyor.');
    emit('image', 'skipped');
  }

  // ── Step 3: Test Case Generation ──
  let engineResult;
  emit('ai', 'running');

  if (useAI) {
    console.log('\n[TestCaseService] Adım 3: 🤖 Gemini AI test üretimi başlatılıyor...');
    const aiStart = Date.now();

    try {
      engineResult = await geminiAdapter.generateTestCases({
        requirement,
        platform,
        domData: domData && !domData.error ? domData : null,
        imagePaths,
        imageSignals,
        apiKey,
      });
      const aiTime = Date.now() - aiStart;
      console.log(`[TestCaseService] Gemini AI tamamlandı (${aiTime}ms) — ${engineResult.testCases.length} test vakası`);
      emit('ai', 'done', aiTime);
    } catch (aiError) {
      console.error(`[TestCaseService] Gemini AI hatası: ${aiError.message}`);
      console.log('[TestCaseService] Deterministik motora geçiliyor (fallback)...');
      emit('ai', 'done', Date.now() - aiStart);

      engineResult = runCoverageEngine({
        domData,
        requirement,
        platform,
        imageSignals,
      });
      engineResult.metadata.fallbackReason = aiError.message;
    }
  } else {
    console.log('\n[TestCaseService] Adım 3: ⚙️ Deterministik kapsam motoru başlatılıyor...');
    const engineStart = Date.now();

    engineResult = runCoverageEngine({
      domData,
      requirement,
      platform,
      imageSignals,
    });

    const engineTime = Date.now() - engineStart;
    console.log(`[TestCaseService] Kapsam Motoru tamamlandı (${engineTime}ms)`);
    emit('ai', 'done', engineTime);
  }

  console.log(`[TestCaseService] Üretilen test vakası sayısı: ${engineResult.testCases.length}`);

  // ── Step 4: JSON Validation ──
  emit('validation', 'running');
  console.log('\n[TestCaseService] Adım 4: JSON Doğrulama başlatılıyor...');
  const valStart = Date.now();
  const validationResult = validateAndSanitize(engineResult.testCases);

  if (!validationResult.valid) {
    console.warn(`[TestCaseService] Doğrulama uyarıları: ${validationResult.errors.length} hata bulundu`);
    console.warn(`[TestCaseService] Geçerli vakalar: ${validationResult.testCases.length}/${engineResult.testCases.length}`);
  } else {
    console.log(`[TestCaseService] Tüm test vakaları doğrulamadan geçti ✅`);
  }
  emit('validation', 'done', Date.now() - valStart);

  // ── Pipeline Complete ──
  const totalTime = Date.now() - pipelineStart;
  console.log('\n' + '═'.repeat(70));
  console.log(`[TestCaseService] Pipeline tamamlandı! Toplam süre: ${totalTime}ms`);
  console.log(`[TestCaseService] Mod: ${useAI ? '🤖 AI (Gemini)' : '⚙️ Deterministik'}`);
  console.log(`[TestCaseService] Sonuç: ${validationResult.testCases.length} geçerli test vakası`);
  console.log('═'.repeat(70) + '\n');

  return {
    testCases: validationResult.testCases,
    domData: domData ? {
      url: domData.url,
      pageTitle: domData.pageTitle,
      summary: domData.summary,
      extractedAt: domData.extractedAt,
    } : null,
    imageSignals: imageSignals ? {
      fileName: imageSignals.fileName,
      fileSize: imageSignals.fileSize,
      dimensions: imageSignals.dimensions,
      signals: imageSignals.signals,
    } : null,
    validation: {
      valid: validationResult.valid,
      totalGenerated: engineResult.testCases.length,
      totalValid: validationResult.testCases.length,
      errors: validationResult.errors,
    },
    metadata: {
      ...engineResult.metadata,
      pipelineTimeMs: totalTime,
      domExtracted: !!domData && !domData.error,
      imageAnalyzed: imagePaths.length > 0,
      imageCount: imagePaths.length,
      aiMode: useAI,
    },
  };
}

module.exports = { generateTestCases, isAIAvailable };
