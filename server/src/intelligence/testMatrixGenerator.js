/**
 * Test Matrix Generator
 *
 * Converts a coverage plan into a structured scenario matrix.
 * Each row defines: feature, scenario type, risk level,
 * preconditions, and expected transition.
 *
 * Deterministic: Same input always produces same output.
 */

const TYPE_MAP = {
  positive:         'Fonksiyonel',
  negative:         'Negatif',
  boundary:         'Sınır Değer',
  state_transition: 'Durum Geçişi',
  security:         'Güvenlik',
  ui_state:         'Arayüz',
  error_handling:   'Hata Yönetimi',
  accessibility:    'Erişilebilirlik',
  input_validation: 'Doğrulama',
};

const PRIORITY_MAP = {
  security:         'Kritik',
  positive:         'Yüksek',
  negative:         'Yüksek',
  error_handling:   'Yüksek',
  input_validation: 'Orta',
  boundary:         'Orta',
  state_transition: 'Orta',
  ui_state:         'Orta',
  accessibility:    'Orta',
};

const FEATURE_MAP = {
  authentication: 'Kimlik Doğrulama',
  registration:   'Kayıt',
  search:         'Arama',
  payment:        'Ödeme',
  data_entry:     'Form İşlemleri',
  navigation:     'Navigasyon',
  generic:        'Genel İşlevsellik',
  form:           'Form İşlemleri',
  listing:        'Listeleme',
};

const PRECONDITIONS = {
  authentication: 'Kullanıcının kayıtlı bir hesabı bulunmalı ve giriş sayfası erişilebilir olmalıdır',
  registration:   'Kayıt sayfası erişilebilir olmalıdır',
  search:         'Arama sayfası erişilebilir ve aranabilir veri mevcut olmalıdır',
  payment:        'Kullanıcı giriş yapmış ve sepetinde ürün bulunmalıdır',
  data_entry:     'Form sayfası erişilebilir olmalıdır',
  navigation:     'Uygulama erişilebilir durumda olmalıdır',
  generic:        'Sistem erişilebilir durumda olmalıdır',
};

const TRANSITIONS = {
  positive:         'İşlem başarıyla tamamlanır ve olumlu geri bildirim gösterilir',
  negative:         'Doğrulama hata mesajı gösterilir ve form gönderimi engellenir',
  boundary:         'Sınır değer kontrolü uygulanır ve uygun uyarı gösterilir',
  state_transition: 'Öğenin durumu beklenen şekilde değişir',
  security:         'Saldırı engellenir, veri ihlali oluşmaz',
  ui_state:         'Arayüz tutarlı görüntülenir ve tasarım standartlarına uyar',
  error_handling:   'Kullanıcıya anlaşılır hata mesajı gösterilir, sistem çökmez',
  accessibility:    'Özellik klavye ve ekran okuyucu ile erişilebilir çalışır',
  input_validation: 'Geçersiz veri reddedilir ve doğrulama mesajı gösterilir',
};

// ═══════════════════════════════════════════════════
// Main Entry
// ═══════════════════════════════════════════════════

/**
 * @param {{ coverageItems: Array }} plan
 * @param {object} uiModel
 * @returns {{ matrix: Array }}
 */
function generateMatrix(plan, uiModel) {
  console.log('[TestMatrixGenerator] Senaryo matrisi oluşturuluyor...');

  const matrix = plan.coverageItems.map((ci, idx) => ({
    id: `matrix-${idx + 1}`,
    feature:            resolveFeature(ci, uiModel),
    scenarioType:       TYPE_MAP[ci.coverageType]     || 'Fonksiyonel',
    riskLevel:          PRIORITY_MAP[ci.coverageType]  || 'Orta',
    preconditions:      resolvePreconditions(ci, uiModel),
    expectedTransition: TRANSITIONS[ci.coverageType]   || 'Beklenen davranış gözlemlenir',
    coverageRef:        { interactionId: ci.interactionId, coverageType: ci.coverageType },
    scenarioIntent:     ci.scenarioIntent,
    context:            ci.context || {},
  }));

  console.log(`[TestMatrixGenerator] Tamamlandı — ${matrix.length} matris satırı`);
  return { matrix };
}

// ═══════════════════════════════════════════════════
// Resolvers
// ═══════════════════════════════════════════════════

function resolveFeature(ci, uiModel) {
  if (ci.context?.purpose) return FEATURE_MAP[ci.context.purpose] || 'Genel İşlevsellik';
  const form = uiModel.forms.find(f => f.id === ci.context?.formId);
  if (form) return FEATURE_MAP[form.purpose] || 'Form İşlemleri';
  if (ci.interactionId === 'page-level') return FEATURE_MAP[uiModel.pageType] || 'Genel İşlevsellik';
  if (ci.context?.field) {
    for (const f of uiModel.forms) {
      if (f.fields.some(fl => fl.label === ci.context.field || fl.name === ci.context.field)) {
        return FEATURE_MAP[f.purpose] || 'Form İşlemleri';
      }
    }
  }
  return FEATURE_MAP[uiModel.pageType] || 'Genel İşlevsellik';
}

function resolvePreconditions(ci, uiModel) {
  const purpose = ci.context?.purpose
    || uiModel.forms.find(f => f.id === ci.context?.formId)?.purpose
    || uiModel.pageType;
  return PRECONDITIONS[purpose] || PRECONDITIONS.generic;
}

module.exports = { generateMatrix };

