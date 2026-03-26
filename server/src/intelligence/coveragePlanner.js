/**
 * Coverage Planner — Structural Coverage Generation
 *
 * For each interaction generates coverage items based on
 * structural analysis of the interaction type, source elements,
 * and possible outcomes.  NO simple keyword matching.
 *
 * Coverage types:
 *   positive, negative, boundary, state_transition,
 *   security, ui_state, error_handling, accessibility,
 *   input_validation
 *
 * Deterministic: Same input always produces same output.
 */

// ═══════════════════════════════════════════════════
// Main Entry
// ═══════════════════════════════════════════════════

/**
 * @param {{ interactions: Array }} graph
 * @param {object} uiModel
 * @returns {{ coverageItems: Array }}
 */
function planCoverage(graph, uiModel) {
  console.log('[CoveragePlanner] Kapsam planı oluşturuluyor...');
  const items = [];

  for (const inter of graph.interactions) {
    switch (inter.type) {
      case 'form_submission':      items.push(...formSubmissionCoverage(inter));   break;
      case 'input_interaction':    items.push(...inputCoverage(inter));           break;
      case 'checkbox_interaction': items.push(...checkboxCoverage(inter));        break;
      case 'password_visibility':  items.push(...passwordVisibilityCoverage(inter)); break;
      case 'button_state':         items.push(...buttonStateCoverage(inter));     break;
      case 'button_click':         items.push(...buttonClickCoverage(inter));     break;
      case 'navigation':           items.push(...navigationCoverage(inter));      break;
      case 'state_change':         items.push(...stateChangeCoverage(inter));     break;
    }
  }

  // Page-level cross-cutting coverage
  items.push(...pageLevelCoverage(uiModel));

  console.log(`[CoveragePlanner] Tamamlandı — ${items.length} kapsam öğesi`);
  return { coverageItems: items };
}

// ═══════════════════════════════════════════════════
// Coverage Generators  (structural, not keyword-based)
// ═══════════════════════════════════════════════════

function formSubmissionCoverage(inter) {
  const items = [];
  const p = inter.source.purpose;
  const label = purposeLabel(p);

  // Positive
  items.push(item(inter, 'positive',
    `Tüm alanlar geçerli verilerle doldurularak başarılı ${label} işlemi`,
    { purpose: p, fields: inter.requiredFields }));

  // Negative — all required empty
  if (inter.requiredFields.length > 0) {
    items.push(item(inter, 'negative',
      `Tüm zorunlu alanlar boş bırakılarak ${label} denemesi`,
      { fields: inter.requiredFields }));
  }

  // Negative — each required field individually empty
  for (const f of inter.requiredFields) {
    items.push(item(inter, 'negative',
      `"${f}" alanı boş bırakılarak gönderim denemesi`,
      { emptyField: f }));
  }

  // Security (structural: forms that accept text are attack surfaces)
  if (['authentication','data_entry','registration','payment'].includes(p)) {
    items.push(item(inter, 'security',
      `SQL enjeksiyon saldırısına karşı ${label} formunun korunması`,
      { attackType: 'sql_injection' }));
    items.push(item(inter, 'security',
      `XSS saldırısına karşı giriş alanlarının korunması`,
      { attackType: 'xss' }));
  }

  // Auth-specific security & state
  if (p === 'authentication') {
    items.push(item(inter, 'security',
      'Başarısız giriş denemelerinde hesap kilitleme mekanizması kontrolü',
      { attackType: 'brute_force' }));
    items.push(item(inter, 'security',
      'Geçersiz kimlik bilgileri ile giriş yapıldığında uygun hata mesajı gösterilmesi',
      { attackType: 'invalid_credentials' }));
    items.push(item(inter, 'state_transition',
      'Başarılı giriş sonrası oturum oluşturulması ve yönlendirme',
      { transition: 'login_to_dashboard' }));
  }

  // Payment-specific
  if (p === 'payment') {
    items.push(item(inter, 'security',
      'Ödeme verilerinin HTTPS üzerinden şifreli iletilmesi kontrolü',
      { attackType: 'transport_security' }));
  }

  // Error handling
  items.push(item(inter, 'error_handling',
    `${label} formunda sunucu hatası durumunda kullanıcıya bilgilendirme`,
    { errorType: 'server_error' }));

  return items;
}

function inputCoverage(inter) {
  const items = [];
  const s = inter.source;

  // Type-driven structural rules
  if (s.fieldType === 'email') {
    items.push(item(inter, 'input_validation',
      `"${s.fieldLabel}" alanına geçersiz e-posta formatı girilmesi`,
      { field: s.fieldLabel, validationType: 'format' }));
  }

  if (s.fieldType === 'password') {
    items.push(item(inter, 'ui_state',
      `"${s.fieldLabel}" alanında karakterlerin maskelenmesi kontrolü`,
      { field: s.fieldLabel, uiCheck: 'masking' }));
    items.push(item(inter, 'input_validation',
      `"${s.fieldLabel}" alanına çok kısa değer girilmesi`,
      { field: s.fieldLabel, validationType: 'min_length' }));
  }

  if (s.fieldType === 'number' || s.fieldType === 'tel') {
    items.push(item(inter, 'input_validation',
      `"${s.fieldLabel}" alanına sayısal olmayan değer girilmesi`,
      { field: s.fieldLabel, validationType: 'numeric' }));
  }

  if (s.fieldType === 'url') {
    items.push(item(inter, 'input_validation',
      `"${s.fieldLabel}" alanına geçersiz URL girilmesi`,
      { field: s.fieldLabel, validationType: 'url_format' }));
  }

  // Boundary — maxLength
  if (s.maxLength) {
    items.push(item(inter, 'boundary',
      `"${s.fieldLabel}" alanında maksimum karakter sınırının (${s.maxLength}) aşılma denemesi`,
      { field: s.fieldLabel, maxLength: s.maxLength }));
  }

  // Boundary — special chars (any text-accepting field is a boundary surface)
  items.push(item(inter, 'boundary',
    `"${s.fieldLabel}" alanına özel karakterler girilmesi`,
    { field: s.fieldLabel, boundaryType: 'special_chars' }));

  return items;
}

function checkboxCoverage(inter) {
  const s = inter.source;
  const items = [];
  const lbl = s.fieldLabel || s.fieldName;

  // Positive: functionality works in both states
  items.push(item(inter, 'positive',
    `"${lbl}" seçeneği işaretlendiğinde ilgili işlevin aktif olması`,
    { checkbox: lbl, state: 'checked', formPurpose: s.formPurpose }));
  items.push(item(inter, 'positive',
    `"${lbl}" seçeneği işaretlenmediğinde varsayılan davranışın korunması`,
    { checkbox: lbl, state: 'unchecked', formPurpose: s.formPurpose }));

  // State: persistence after page reload (e.g., "Beni hatırla")
  if (s.formPurpose === 'authentication') {
    items.push(item(inter, 'state_transition',
      `"${lbl}" seçeneği işaretlenerek giriş yapıldığında oturumun tarayıcı kapandıktan sonra korunması`,
      { checkbox: lbl, state: 'session_persistence' }));
  }

  return items;
}

function passwordVisibilityCoverage(inter) {
  const s = inter.source;
  const pwdLabel = s.passwordFields[0] || 'Şifre';
  return [
    item(inter, 'ui_state',
      `"${pwdLabel}" alanında şifre göster/gizle butonunun çalışması`,
      { field: pwdLabel, uiCheck: 'password_toggle' }),
    item(inter, 'ui_state',
      `"${pwdLabel}" alanında şifre gösterildiğinde metnin okunabilir olması`,
      { field: pwdLabel, uiCheck: 'password_visible_text' }),
  ];
}

function buttonStateCoverage(inter) {
  const s = inter.source;
  return [
    item(inter, 'state_transition',
      `"${s.buttonLabel}" butonunun form doldurulmadan önce ve sonra durumlarının kontrolü`,
      { button: s.buttonLabel }),
    item(inter, 'ui_state',
      `"${s.buttonLabel}" butonuna tıklandığında görsel geri bildirimin kontrolü`,
      { button: s.buttonLabel, check: 'visual_feedback' }),
  ];
}

function buttonClickCoverage(inter) {
  const s = inter.source;
  if (s.disabled) {
    return [item(inter, 'state_transition',
      `Devre dışı "${s.buttonLabel}" butonunun aktifleşme koşullarının kontrolü`,
      { button: s.buttonLabel, state: 'disabled' })];
  }
  return [item(inter, 'positive',
    `"${s.buttonLabel}" butonuna tıklanarak beklenen işlemin gerçekleşmesi`,
    { button: s.buttonLabel })];
}

function navigationCoverage(inter) {
  const s = inter.source;
  return [
    item(inter, 'positive',
      `Sayfadaki ${s.totalLinks} bağlantının doğru hedeflere yönlendirmesi`,
      { linkCount: s.totalLinks }),
    item(inter, 'negative',
      'Kırık bağlantı kontrolü ve hata sayfası yönlendirmesi',
      { check: 'broken_links' }),
    item(inter, 'accessibility',
      'Bağlantılarda klavye navigasyonu ve odak yönetimi kontrolü',
      { check: 'keyboard_nav' }),
  ];
}

function stateChangeCoverage(inter) {
  return [item(inter, 'state_transition',
    `Devre dışı öğelerin (${inter.source.count} adet) koşullu aktifleşme mekanizması`,
    { elements: inter.source.disabledElements })];
}

function pageLevelCoverage(uiModel) {
  const pt = uiModel.pageType;
  return [
    item({ id: 'page-level' }, 'accessibility',
      'Sayfa genelinde klavye erişilebilirliği ve ekran okuyucu uyumluluğu',
      { pageType: pt }),
    item({ id: 'page-level' }, 'ui_state',
      'Sayfa yükleme süresi ve görsel tutarlılık kontrolü',
      { pageType: pt, check: 'load_time' }),
    item({ id: 'page-level' }, 'error_handling',
      'Beklenmeyen hata durumlarında kullanıcıya anlamlı mesaj gösterimi',
      { pageType: pt }),
  ];
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function item(inter, coverageType, scenarioIntent, context) {
  return { interactionId: inter.id, coverageType, scenarioIntent, context: context || {} };
}

function purposeLabel(p) {
  return { authentication:'giriş', registration:'kayıt', search:'arama',
           payment:'ödeme', data_entry:'form gönderim', generic:'işlem' }[p] || 'işlem';
}

module.exports = { planCoverage };
