/**
 * DOM Analyzer — Structural UI Model Builder
 *
 * Converts raw DOM extraction data into a structured UI model.
 * Groups elements into logical sections, detects page types,
 * identifies forms, authentication areas, and interactive components.
 *
 * Falls back to requirement text structural analysis when DOM is unavailable.
 *
 * Deterministic: Same input always produces same output.
 */

const PAGE_TYPE = {
  AUTHENTICATION: 'authentication',
  REGISTRATION: 'registration',
  SEARCH: 'search',
  PAYMENT: 'payment',
  FORM: 'form',
  LISTING: 'listing',
  NAVIGATION: 'navigation',
  GENERIC: 'generic',
};

// ═══════════════════════════════════════════════════
// Main Entry
// ═══════════════════════════════════════════════════

/**
 * @param {object|null} domData  - Raw DOM extraction output
 * @param {string}      reqText  - Requirement text (used as fallback)
 * @param {object|null} imgSigs  - Image signal data
 * @returns {object} Structured UI model
 */
function analyze(domData, reqText = '', imgSigs = null) {
  if (!domData || domData.error || isDOMEmpty(domData)) {
    console.log('[DOMAnalyzer] DOM verisi yok — gereksinim tabanlı yapısal analiz');
    return analyzeFromRequirement(reqText, imgSigs);
  }

  console.log('[DOMAnalyzer] DOM yapısal analizi başlatılıyor...');

  const inputs  = (domData.inputs  || []).map(normalizeInput);
  const buttons = (domData.buttons || []).map(normalizeButton);
  const links   = (domData.links   || []).map(normalizeLink);
  const ariaEls = domData.ariaElements || [];

  const forms = (domData.forms || []).map((f, i) => analyzeForm(f, inputs, buttons, i));

  // Inputs not inside any detected form → wrap in a virtual form
  if (forms.length === 0 && inputs.length > 0) {
    forms.push(buildVirtualForm(inputs, buttons));
  }

  const pageType        = detectPageType(forms, inputs, links);
  const stateIndicators = detectStateIndicators(inputs, buttons, ariaEls);
  const sections        = buildSections(forms, links, pageType);

  const interactiveElements = [
    ...inputs.map(i  => ({ ...i,  elementType: 'input'  })),
    ...buttons.map(b => ({ ...b,  elementType: 'button' })),
    ...links.filter(l => l.href).map(l => ({ ...l, elementType: 'link' })),
  ];

  const uiModel = {
    pageType,
    pageTitle: domData.pageTitle || '',
    sections,
    forms,
    inputs,
    buttons,
    links,
    interactiveElements,
    stateIndicators,
    source: 'dom',
  };

  console.log(`[DOMAnalyzer] Tamamlandı — Tür: ${pageType}, Form: ${forms.length}, Giriş: ${inputs.length}, Buton: ${buttons.length}`);
  return uiModel;
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function isDOMEmpty(d) {
  return (!d.inputs || d.inputs.length === 0)
      && (!d.buttons || d.buttons.length === 0)
      && (!d.forms || d.forms.length === 0)
      && (!d.links || d.links.length === 0);
}

function normalizeInput(i) {
  return {
    tag: i.tag || 'input',
    type: i.type || 'text',
    name: i.name || '',
    id: i.id || '',
    placeholder: i.placeholder || '',
    required: !!i.required,
    disabled: !!i.disabled,
    ariaLabel: i.ariaLabel || '',
    // Priority: explicit label > aria-label > placeholder > name > id
    label: i.label || i.ariaLabel || i.placeholder || i.name || i.id || '',
    maxLength: i.maxLength || null,
    pattern: i.pattern || null,
  };
}

function normalizeButton(b) {
  return {
    tag: b.tag || 'button',
    type: b.type || 'button',
    text: b.text || '',
    id: b.id || '',
    name: b.name || '',
    disabled: !!b.disabled,
    ariaLabel: b.ariaLabel || '',
    label: b.text || b.ariaLabel || b.id || '',
  };
}

function normalizeLink(l) {
  return {
    text: l.text || '',
    href: l.href || '',
    ariaLabel: l.ariaLabel || '',
    target: l.target || '',
    label: l.text || l.ariaLabel || l.href || '',
  };
}

// ═══════════════════════════════════════════════════
// Form Analysis
// ═══════════════════════════════════════════════════

function analyzeForm(raw, allInputs, allButtons, idx) {
  const fieldIds = new Set((raw.fields || []).map(f => f.name || f.id).filter(Boolean));
  const matched  = fieldIds.size > 0
    ? allInputs.filter(i => fieldIds.has(i.name) || fieldIds.has(i.id))
    : [];

  const fields    = matched.length > 0 ? matched : (raw.fields || []).map(normalizeInput);
  const purpose   = detectFormPurpose(fields);
  const submitBtn = allButtons.find(b => b.type === 'submit') || allButtons[0] || null;

  return {
    id: raw.id || `form-${idx}`,
    name: raw.name || '',
    purpose,
    method: (raw.method || 'POST').toUpperCase(),
    action: raw.action || '',
    fields,
    submitButton: submitBtn,
  };
}

function buildVirtualForm(inputs, buttons) {
  return {
    id: 'virtual-form-0',
    name: '',
    purpose: detectFormPurpose(inputs),
    method: 'POST',
    action: '',
    fields: inputs,
    submitButton: buttons.find(b => b.type === 'submit') || buttons[0] || null,
    synthetic: true,
  };
}

function detectFormPurpose(fields) {
  const hasPassword  = fields.some(f => f.type === 'password');
  const pwdCount     = fields.filter(f => f.type === 'password').length;
  const hasEmail     = fields.some(f => f.type === 'email' || lo(f.name).includes('email') || lo(f.placeholder).includes('e-posta'));
  const hasSearch    = fields.some(f => f.type === 'search');
  const hasCard      = fields.some(f => ['card','kart','cvv','expiry'].some(k => lo(f.name).includes(k)));
  // Count only text-type fields (exclude checkboxes, radios, hidden)
  const textFields   = fields.filter(f => !['checkbox', 'radio', 'hidden'].includes(f.type));
  const textCount    = textFields.length;

  if (hasPassword && pwdCount >= 2 && textCount >= 4) return 'registration';
  if (hasPassword && hasEmail && textCount <= 4)       return 'authentication';
  if (hasPassword && textCount <= 3)                   return 'authentication';
  if (hasSearch)                                       return 'search';
  if (hasCard)                                         return 'payment';
  if (textCount > 0)                                   return 'data_entry';
  return 'generic';
}

function lo(s) { return (s || '').toLowerCase(); }

// ═══════════════════════════════════════════════════
// Page Type / Sections / State
// ═══════════════════════════════════════════════════

function detectPageType(forms, inputs, links) {
  const purposes = forms.map(f => f.purpose);
  if (purposes.includes('authentication')) return PAGE_TYPE.AUTHENTICATION;
  if (purposes.includes('registration'))   return PAGE_TYPE.REGISTRATION;
  if (purposes.includes('payment'))        return PAGE_TYPE.PAYMENT;
  if (purposes.includes('search'))         return PAGE_TYPE.SEARCH;
  if (forms.length > 0)                    return PAGE_TYPE.FORM;
  if (links.length > 10 && inputs.length === 0) return PAGE_TYPE.NAVIGATION;
  if (links.length > 5)                    return PAGE_TYPE.LISTING;
  return PAGE_TYPE.GENERIC;
}

function detectStateIndicators(inputs, buttons, ariaEls) {
  const indicators = [];
  const dis_in = inputs.filter(i => i.disabled);
  if (dis_in.length)  indicators.push({ type: 'disabled_inputs',  count: dis_in.length,  elements: dis_in.map(i => i.label) });
  const dis_bt = buttons.filter(b => b.disabled);
  if (dis_bt.length)  indicators.push({ type: 'disabled_buttons', count: dis_bt.length,  elements: dis_bt.map(b => b.label) });
  const alerts = ariaEls.filter(e => e.role === 'alert' || e.role === 'status');
  if (alerts.length)  indicators.push({ type: 'alert_containers', count: alerts.length });
  const req = inputs.filter(i => i.required);
  if (req.length)     indicators.push({ type: 'required_fields',  count: req.length,     elements: req.map(i => i.label) });
  return indicators;
}

function buildSections(forms, links, pageType) {
  const s = [];
  forms.forEach(f => s.push({ id: `section-${f.id}`, type: f.purpose, formId: f.id, elementCount: f.fields.length }));
  const nav = links.filter(l => l.href && l.href !== '#' && !l.href.startsWith('javascript:'));
  if (nav.length > 3) s.push({ id: 'section-nav', type: 'navigation', elementCount: nav.length });
  if (s.length === 0) s.push({ id: 'section-main', type: pageType, elementCount: 0 });
  return s;
}

// ═══════════════════════════════════════════════════
// Requirement Text → Synthetic UI Model (fallback)
// ═══════════════════════════════════════════════════

const SCENARIO_DEFS = [
  {
    type: 'authentication', feature: 'Kimlik Doğrulama',
    triggers: [
      { actions: ['giriş', 'login', 'oturum aç'], entities: ['kullanıcı', 'hesap', 'üye', 'sayfa', 'sayfası', 'ekran', 'panel'] },
      { actions: ['doğrula', 'kimlik'],           entities: ['şifre', 'parola', 'e-posta'] },
      { actions: ['giriş yap', 'oturum aç'],     entities: [] },  // compound actions don't need entities
    ],
    fields: [
      { type: 'email',    name: 'email',    label: 'E-posta', required: true },
      { type: 'password', name: 'password', label: 'Şifre',   required: true },
    ],
    submit: 'Giriş Yap',
  },
  {
    type: 'registration', feature: 'Kayıt',
    triggers: [
      { actions: ['kayıt', 'kayıt ol', 'register', 'üye ol', 'hesap oluştur'], entities: ['kullanıcı', 'hesap', 'üye'] },
    ],
    fields: [
      { type: 'text',     name: 'fullname',         label: 'Ad Soyad',      required: true },
      { type: 'email',    name: 'email',             label: 'E-posta',      required: true },
      { type: 'password', name: 'password',           label: 'Şifre',       required: true },
      { type: 'password', name: 'password_confirm',   label: 'Şifre Tekrar', required: true },
    ],
    submit: 'Kayıt Ol',
  },
  {
    type: 'search', feature: 'Arama',
    triggers: [
      { actions: ['ara', 'arama', 'bul', 'search', 'filtrele'], entities: ['ürün', 'sonuç', 'içerik', 'veri'] },
    ],
    fields: [
      { type: 'search', name: 'query', label: 'Arama', required: true },
    ],
    submit: 'Ara',
  },
  {
    type: 'payment', feature: 'Ödeme',
    triggers: [
      { actions: ['öde', 'ödeme', 'satın al', 'checkout'], entities: ['kart', 'ürün', 'sepet', 'tutar'] },
    ],
    fields: [
      { type: 'text', name: 'card_number', label: 'Kart Numarası',       required: true },
      { type: 'text', name: 'card_expiry', label: 'Son Kullanma Tarihi', required: true },
      { type: 'text', name: 'card_cvv',    label: 'CVV',                 required: true },
      { type: 'text', name: 'card_holder', label: 'Kart Sahibi',         required: true },
    ],
    submit: 'Ödeme Yap',
  },
  {
    type: 'data_entry', feature: 'Form İşlemleri',
    triggers: [
      { actions: ['doldur', 'gir', 'ekle', 'oluştur', 'yaz'], entities: ['form', 'alan', 'veri', 'bilgi'] },
      { actions: ['iletişim', 'mesaj'],                         entities: ['form', 'gönder'] },
    ],
    fields: [
      { type: 'text',     name: 'field_1', label: 'Ad',     required: true },
      { type: 'email',    name: 'field_2', label: 'E-posta', required: true },
      { type: 'textarea', name: 'field_3', label: 'Mesaj',   required: true },
    ],
    submit: 'Gönder',
  },
  {
    type: 'navigation', feature: 'Navigasyon',
    triggers: [
      { actions: ['git', 'yönlendir', 'gezin', 'aç'], entities: ['sayfa', 'menü', 'bağlantı', 'link'] },
    ],
    fields: [],
    submit: '',
  },
];

function analyzeFromRequirement(text, imgSigs) {
  const lower = (text || '').toLowerCase();
  const detected = [];

  // Structural co-occurrence: require BOTH an action AND an entity (unless entities is empty = compound action)
  for (const def of SCENARIO_DEFS) {
    if (detected.find(d => d.type === def.type)) continue;
    for (const tr of def.triggers) {
      const hasAction = tr.actions.some(a => lower.includes(a));
      const hasEntity = tr.entities.length === 0 || tr.entities.some(e => lower.includes(e));
      if (hasAction && hasEntity) { detected.push(def); break; }
    }
  }

  // Image signal reinforcement
  if (imgSigs && imgSigs.signals) {
    const sigMap = { login_screen: 'authentication', form_screen: 'data_entry', payment_screen: 'payment', search_screen: 'search' };
    for (const sig of imgSigs.signals) {
      const mapped = sigMap[sig.signal];
      if (mapped && !detected.find(d => d.type === mapped)) {
        const def = SCENARIO_DEFS.find(s => s.type === mapped);
        if (def) detected.push(def);
      }
    }
  }

  // Fallback
  if (detected.length === 0) {
    detected.push(SCENARIO_DEFS.find(d => d.type === 'data_entry'));
    detected.push(SCENARIO_DEFS.find(d => d.type === 'navigation'));
  }

  // Build synthetic UI model
  const forms = detected
    .filter(d => d.fields.length > 0)
    .map((d, i) => ({
      id: `syn-form-${i}`,
      name: '',
      purpose: d.type,
      method: 'POST',
      action: '',
      fields: d.fields.map(f => normalizeInput({ ...f, tag: f.type === 'textarea' ? 'textarea' : 'input' })),
      submitButton: d.submit ? normalizeButton({ text: d.submit, type: 'submit', tag: 'button' }) : null,
      synthetic: true,
    }));

  const buttons = forms.map(f => f.submitButton).filter(Boolean);
  const inputs  = forms.flatMap(f => f.fields);
  const links   = detected.some(d => d.type === 'navigation')
    ? [ normalizeLink({ text: 'Ana Sayfa', href: '/' }), normalizeLink({ text: 'Hakkımızda', href: '/about' }), normalizeLink({ text: 'İletişim', href: '/contact' }) ]
    : [];

  const pageType = detected[0]?.type || PAGE_TYPE.GENERIC;
  const sections = forms.map(f => ({ id: `section-${f.id}`, type: f.purpose, formId: f.id, elementCount: f.fields.length }));
  if (links.length > 0) sections.push({ id: 'section-nav', type: 'navigation', elementCount: links.length });

  const uiModel = {
    pageType,
    pageTitle: '',
    sections,
    forms,
    inputs,
    buttons,
    links,
    interactiveElements: [
      ...inputs.map(i  => ({ ...i,  elementType: 'input'  })),
      ...buttons.map(b => ({ ...b,  elementType: 'button' })),
      ...links.map(l   => ({ ...l,  elementType: 'link'   })),
    ],
    stateIndicators: [],
    source: 'requirement',
    detectedScenarios: detected.map(d => d.type),
  };

  console.log(`[DOMAnalyzer] Gereksinim analizi — Tür: ${pageType}, Senaryolar: ${detected.map(d => d.type).join(', ')}`);
  return uiModel;
}

module.exports = { analyze };

