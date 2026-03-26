/**
 * Test Case Builder — Matrix → Detailed Turkish Test Cases
 *
 * Converts scenario matrix rows into professional, detailed
 * Turkish test cases. Uses real element names from the UI model.
 *
 * Rules:
 *  - Professional QA language
 *  - No repetition
 *  - No generic placeholders
 *  - Minimum 15 test cases
 *  - Fully Turkish
 *  - Deterministic
 *  - Structured JSON only
 *
 * Deterministic: Same input always produces same output.
 */

const MINIMUM = 15;

// ═══════════════════════════════════════════════════
// Main Entry
// ═══════════════════════════════════════════════════

/**
 * @param {{ matrix: Array }} matrixResult
 * @param {object} uiModel
 * @param {string} platform
 * @returns {Array} Test cases
 */
function buildTestCases(matrixResult, uiModel, platform = 'Web') {
  console.log('[TestCaseBuilder] Test vakaları oluşturuluyor...');

  let cases = matrixResult.matrix.map((row, i) => build(row, i + 1, uiModel, platform));

  // Ensure minimum
  if (cases.length < MINIMUM) {
    cases.push(...supplementary(cases.length, uiModel, platform));
  }

  // Deduplicate by title
  const seen = new Set();
  cases = cases.filter(tc => { if (seen.has(tc.title)) return false; seen.add(tc.title); return true; });

  // Re-index
  cases.forEach((tc, i) => { tc.id = i + 1; });

  console.log(`[TestCaseBuilder] Tamamlandı — ${cases.length} test vakası`);
  return cases;
}

// ═══════════════════════════════════════════════════
// Single Test Case Builder
// ═══════════════════════════════════════════════════

function build(row, id, uiModel, platform) {
  const { steps, expected } = stepsFor(row, uiModel);
  return {
    id,
    feature:       row.feature,
    title:         row.scenarioIntent,
    preconditions: row.preconditions,
    steps,
    expected,
    priority:      row.riskLevel,
    type:          row.scenarioType,
    platform,
  };
}

function stepsFor(row, ui) {
  const ct  = row.coverageRef?.coverageType || 'positive';
  const ctx = row.context || {};
  const form = ui.forms.find(f => f.id === ctx.formId) || ui.forms[0];
  const sub  = form?.submitButton?.label || 'Gönder';
  const page = pageLabel(ctx.purpose || form?.purpose || ui.pageType);

  switch (ct) {
    case 'positive':         return positiveSteps(ctx, form, sub, page);
    case 'negative':         return negativeSteps(ctx, form, sub, page);
    case 'boundary':         return boundarySteps(ctx);
    case 'security':         return securitySteps(ctx, form, sub, page);
    case 'state_transition': return stateSteps(ctx, form, sub);
    case 'ui_state':         return uiSteps(ctx, page);
    case 'error_handling':   return errorSteps(ctx, sub, page);
    case 'accessibility':    return a11ySteps(ctx, page);
    case 'input_validation': return validationSteps(ctx);
    default:                 return { steps: `1. ${page} sayfasına git\n2. İşlemi gerçekleştir`, expected: 'Beklenen davranış gözlemlenir' };
  }
}

// ── Positive ──
function positiveSteps(ctx, form, sub, page) {
  if (ctx.fields && form) {
    const textFields = form.fields.filter(f => f.type !== 'checkbox' && f.type !== 'radio');
    const fs = textFields.map((f, i) => `${i + 2}. "${f.label}" alanına geçerli ${hint(f)} gir`);
    return {
      steps: [`1. ${page} sayfasına git`, ...fs, `${fs.length + 2}. "${sub}" butonuna tıkla`].join('\n'),
      expected: expectedForPurpose(ctx.purpose),
    };
  }
  // Checkbox positive
  if (ctx.checkbox && ctx.state === 'checked') {
    return {
      steps: `1. ${page} sayfasına git\n2. "${ctx.checkbox}" seçeneğini bul\n3. Seçeneği işaretle\n4. Formu doldur ve gönder`,
      expected: `"${ctx.checkbox}" seçeneği aktifken ilgili işlev doğru çalışır`,
    };
  }
  if (ctx.checkbox && ctx.state === 'unchecked') {
    return {
      steps: `1. ${page} sayfasına git\n2. "${ctx.checkbox}" seçeneğinin işaretli olmadığını doğrula\n3. Formu doldur ve gönder`,
      expected: `"${ctx.checkbox}" seçeneği işaretlenmediğinde varsayılan davranış korunur`,
    };
  }
  if (ctx.linkCount) {
    return {
      steps: `1. Sayfadaki bağlantıları tespit et\n2. Her bağlantıya sırasıyla tıkla\n3. Hedef sayfanın yüklendiğini doğrula`,
      expected: `Tüm ${ctx.linkCount} bağlantı doğru hedef sayfalara yönlendirir, 404 hatası oluşmaz`,
    };
  }
  if (ctx.button) {
    return {
      steps: `1. ${page} sayfasına git\n2. "${ctx.button}" butonunu bul\n3. Butona tıkla`,
      expected: 'Beklenen işlem gerçekleştirilir ve sonuç ekrana yansır',
    };
  }
  return { steps: `1. ${page} sayfasına git\n2. İşlemi gerçekleştir`, expected: 'İşlem başarıyla tamamlanır' };
}

function expectedForPurpose(p) {
  return {
    authentication: 'Kullanıcı başarıyla giriş yapar ve ana sayfaya yönlendirilir',
    registration:   'Kayıt başarıyla tamamlanır ve onay mesajı gösterilir',
    search:         'Arama terimiyle eşleşen sonuçlar listelenir',
    payment:        'Ödeme başarıyla işlenir ve onay ekranı gösterilir',
  }[p] || 'İşlem başarıyla tamamlanır ve olumlu geri bildirim gösterilir';
}

// ── Negative ──
function negativeSteps(ctx, form, sub, page) {
  if (ctx.emptyField && form) {
    const others = form.fields.filter(f => f.label !== ctx.emptyField);
    const fill   = others.map((f, i) => `${i + 2}. "${f.label}" alanına geçerli ${hint(f)} gir`);
    return {
      steps: [`1. ${page} sayfasına git`, ...fill, `${fill.length + 2}. "${ctx.emptyField}" alanını boş bırak`, `${fill.length + 3}. "${sub}" butonuna tıkla`].join('\n'),
      expected: `"${ctx.emptyField}" alanı için zorunlu alan uyarısı gösterilir ve form gönderimi engellenir`,
    };
  }
  if (ctx.fields) {
    return {
      steps: `1. ${page} sayfasına git\n2. Tüm zorunlu alanları boş bırak\n3. "${sub}" butonuna tıkla`,
      expected: 'Tüm zorunlu alanlar için doğrulama hata mesajları gösterilir ve form gönderimi engellenir',
    };
  }
  if (ctx.check === 'broken_links') {
    return {
      steps: '1. Sayfadaki tüm bağlantıları tespit et\n2. Her bağlantının hedef URL\'sini kontrol et\n3. Var olmayan bir sayfaya yönlendiren bağlantıyı tıkla',
      expected: 'Kırık bağlantılar tespit edilir ve uygun 404 hata sayfası gösterilir',
    };
  }
  return { steps: `1. ${page} sayfasına git\n2. Geçersiz veri gir\n3. İşlemi dene`, expected: 'Hata mesajı gösterilir ve geçersiz işlem engellenir' };
}

// ── Boundary ──
function boundarySteps(ctx) {
  const f = ctx.field || 'giriş alanı';
  if (ctx.maxLength) {
    return {
      steps: `1. İlgili sayfaya git\n2. "${f}" alanına ${ctx.maxLength + 10} karakterlik metin gir\n3. Alanın davranışını gözlemle`,
      expected: `"${f}" alanı maksimum ${ctx.maxLength} karakter kabul eder ve fazla karakterler reddedilir`,
    };
  }
  return {
    steps: `1. İlgili sayfaya git\n2. "${f}" alanına özel karakterler gir (!@#$%^&*<>)\n3. İşlemi tamamlamaya çalış`,
    expected: 'Özel karakterler güvenli şekilde işlenir, sistem hatası oluşmaz',
  };
}

// ── Security ──
function securitySteps(ctx, form, sub, page) {
  const target = form?.fields[0]?.label || 'giriş alanı';
  if (ctx.attackType === 'sql_injection') {
    return {
      steps: `1. ${page} sayfasına git\n2. "${target}" alanına SQL enjeksiyon dizesi gir (örn: ' OR 1=1 --)\n3. Diğer alanları doldur\n4. "${sub}" butonuna tıkla`,
      expected: 'SQL enjeksiyonu engellenir, veri ihlali gerçekleşmez',
    };
  }
  if (ctx.attackType === 'xss') {
    return {
      steps: `1. ${page} sayfasına git\n2. "${target}" alanına script etiketi gir: <script>alert("XSS")</script>\n3. "${sub}" butonuna tıkla`,
      expected: 'Script temizlenir ve çalıştırılmaz, giriş güvenli şekilde işlenir',
    };
  }
  if (ctx.attackType === 'brute_force') {
    return {
      steps: `1. ${page} sayfasına git\n2. Geçerli kullanıcı adı gir\n3. Art arda 5 kez yanlış şifre ile giriş dene\n4. Hesap durumunu kontrol et`,
      expected: 'Belirli sayıda başarısız denemeden sonra hesap geçici olarak kilitlenir veya ek doğrulama istenir',
    };
  }
  if (ctx.attackType === 'transport_security') {
    return {
      steps: '1. Ödeme sayfasına git\n2. Tarayıcı adres çubuğundaki güvenlik kilidini kontrol et\n3. Ağ trafiğini incele',
      expected: 'Tüm ödeme verileri HTTPS üzerinden şifreli olarak iletilir',
    };
  }
  if (ctx.attackType === 'invalid_credentials') {
    const emailField = form?.fields.find(f => f.type === 'email')?.label || 'E-posta';
    const pwdField = form?.fields.find(f => f.type === 'password')?.label || 'Şifre';
    return {
      steps: `1. ${page} sayfasına git\n2. "${emailField}" alanına kayıtlı olmayan bir e-posta adresi gir\n3. "${pwdField}" alanına herhangi bir şifre gir\n4. "${sub}" butonuna tıkla`,
      expected: 'Kullanıcıya "Geçersiz e-posta veya şifre" gibi anlaşılır hata mesajı gösterilir, hangi alanın yanlış olduğu belirtilmez',
    };
  }
  return {
    steps: `1. ${page} sayfasına git\n2. Güvenlik açığı oluşturabilecek veri gir\n3. İşlemi dene`,
    expected: 'Güvenlik mekanizmaları saldırıyı engeller',
  };
}

// ── State Transition ──
function stateSteps(ctx, form, sub) {
  if (ctx.transition === 'login_to_dashboard') {
    return {
      steps: '1. Giriş sayfasına git\n2. Geçerli kimlik bilgilerini gir\n3. Giriş Yap butonuna tıkla\n4. Yönlendirme sonrası oturum durumunu kontrol et',
      expected: 'Oturum oluşturulur, kullanıcı ana sayfaya yönlendirilir ve oturum bilgileri gösterilir',
    };
  }
  // Checkbox session persistence (e.g. "Beni hatırla")
  if (ctx.checkbox && ctx.state === 'session_persistence') {
    return {
      steps: `1. Giriş sayfasına git\n2. "${ctx.checkbox}" seçeneğini işaretle\n3. Geçerli kimlik bilgileri ile giriş yap\n4. Tarayıcıyı kapat ve yeniden aç\n5. Uygulamaya tekrar eriş`,
      expected: `"${ctx.checkbox}" seçeneği aktifken oturum korunur, kullanıcı tekrar giriş yapmak zorunda kalmaz`,
    };
  }
  if (ctx.button) {
    return {
      steps: `1. Sayfaya git\n2. "${ctx.button}" butonunun başlangıç durumunu gözlemle\n3. Gerekli koşulları sağla\n4. Butonun durumunun değiştiğini doğrula`,
      expected: `"${ctx.button}" butonu koşullar sağlandığında aktif hale gelir ve tıklanabilir olur`,
    };
  }
  if (ctx.elements) {
    return {
      steps: `1. Sayfaya git\n2. Devre dışı öğeleri tespit et: ${ctx.elements.join(', ')}\n3. Aktifleşme koşullarını sağla\n4. Öğelerin durumlarını kontrol et`,
      expected: 'Devre dışı öğeler belirlenen koşullar sağlandığında aktif hale gelir',
    };
  }
  return {
    steps: '1. Başlangıç durumunu gözlemle\n2. Durum değişikliğini tetikleyen işlemi gerçekleştir\n3. Yeni durumu doğrula',
    expected: 'Durum geçişi başarılı şekilde gerçekleşir',
  };
}

// ── UI State ──
function uiSteps(ctx, page) {
  if (ctx.uiCheck === 'masking') {
    return {
      steps: `1. ${page} sayfasına git\n2. "${ctx.field}" alanına tıkla\n3. Metin yaz ve görüntüsünü gözlemle`,
      expected: `"${ctx.field}" alanında girilen karakterler maskelenerek gösterilir (nokta veya yıldız)`,
    };
  }
  if (ctx.uiCheck === 'password_toggle') {
    return {
      steps: `1. ${page} sayfasına git\n2. "${ctx.field}" alanına bir şifre yaz\n3. Şifre göster/gizle ikonuna (göz ikonu) tıkla\n4. Şifrenin görünür olduğunu doğrula\n5. Tekrar ikona tıkla`,
      expected: `Şifre göster/gizle butonu çalışır: tıklandığında şifre okunabilir metin olarak görünür, tekrar tıklandığında maskelenir`,
    };
  }
  if (ctx.uiCheck === 'password_visible_text') {
    return {
      steps: `1. ${page} sayfasına git\n2. "${ctx.field}" alanına "Test1234!" yaz\n3. Göz ikonuna tıklayarak şifreyi görünür yap\n4. Görüntülenen metnin doğruluğunu kontrol et`,
      expected: `Şifre görünür modda girilen metin olduğu gibi gösterilir, karakter kaybı veya bozulma olmaz`,
    };
  }
  if (ctx.check === 'visual_feedback') {
    return {
      steps: `1. Sayfaya git\n2. "${ctx.button}" butonunun üzerine gel\n3. Butona tıkla\n4. Görsel değişiklikleri gözlemle`,
      expected: 'Buton hover ve tıklama durumlarında uygun görsel geri bildirim verir',
    };
  }
  if (ctx.check === 'load_time') {
    return {
      steps: '1. Tarayıcı geliştirici araçlarını aç\n2. Sayfayı yeniden yükle\n3. Yükleme süresini ölç\n4. Görsel tutarlılığı kontrol et',
      expected: 'Sayfa 3 saniye içinde yüklenir ve tüm görsel öğeler düzgün render edilir',
    };
  }
  return {
    steps: `1. ${page} sayfasına git\n2. Arayüz öğelerini incele\n3. Duyarlı tasarımı farklı ekran boyutlarında test et`,
    expected: 'Arayüz tutarlı, duyarlı ve tasarım standartlarına uygun şekilde görüntülenir',
  };
}

// ── Error Handling ──
function errorSteps(ctx, sub, page) {
  if (ctx.errorType === 'server_error') {
    return {
      steps: `1. ${page} sayfasına git\n2. Formu geçerli verilerle doldur\n3. Sunucu bağlantısı kesildiğinde "${sub}" butonuna tıkla`,
      expected: 'Kullanıcıya anlaşılır hata mesajı gösterilir, girilen veriler korunur ve sistem kararlı kalır',
    };
  }
  return {
    steps: `1. ${page} sayfasına git\n2. Beklenmeyen hata durumu oluştur\n3. Hata mesajını gözlemle`,
    expected: 'Kullanıcıya anlamlı ve yönlendirici hata mesajı gösterilir, uygulama çökmez',
  };
}

// ── Accessibility ──
function a11ySteps(ctx, page) {
  if (ctx.check === 'keyboard_nav') {
    return {
      steps: '1. Sayfaya git\n2. Tab tuşu ile tüm etkileşimli öğeler arasında gezin\n3. Enter ile bağlantıları ve butonları etkinleştir\n4. Odak göstergesinin görünürlüğünü kontrol et',
      expected: 'Tüm etkileşimli öğelere klavye ile erişilebilir, odak göstergesi açıkça görünür',
    };
  }
  return {
    steps: `1. ${page} sayfasına git\n2. Tab tuşu ile form elemanları arasında gezin\n3. Ekran okuyucu ile aria etiketlerini doğrula\n4. Renk kontrastını kontrol et`,
    expected: 'Sayfa WCAG 2.1 erişilebilirlik standartlarına uygun şekilde çalışır',
  };
}

// ── Input Validation ──
function validationSteps(ctx) {
  const f = ctx.field || 'giriş alanı';
  if (ctx.validationType === 'format') {
    return {
      steps: `1. İlgili sayfaya git\n2. "${f}" alanına geçersiz format gir (örn: "test@")\n3. Formu göndermeye çalış`,
      expected: `Doğrulama hatası gösterilir: "Geçerli bir e-posta adresi giriniz"`,
    };
  }
  if (ctx.validationType === 'min_length') {
    return {
      steps: `1. İlgili sayfaya git\n2. "${f}" alanına çok kısa değer gir (1-2 karakter)\n3. Formu göndermeye çalış`,
      expected: `"${f}" alanı için minimum uzunluk doğrulama hatası gösterilir`,
    };
  }
  if (ctx.validationType === 'numeric') {
    return {
      steps: `1. İlgili sayfaya git\n2. "${f}" alanına harf ve özel karakter gir\n3. Sonucu gözlemle`,
      expected: `"${f}" alanı yalnızca sayısal değer kabul eder, geçersiz karakterler reddedilir`,
    };
  }
  if (ctx.validationType === 'url_format') {
    return {
      steps: `1. İlgili sayfaya git\n2. "${f}" alanına geçersiz URL gir (örn: "http://")\n3. Formu göndermeye çalış`,
      expected: `"${f}" alanı için geçerli URL formatı doğrulama hatası gösterilir`,
    };
  }
  return {
    steps: `1. İlgili sayfaya git\n2. "${f}" alanına geçersiz veri gir\n3. Doğrulama mesajını kontrol et`,
    expected: 'Geçersiz veri reddedilir ve kullanıcıya doğrulama mesajı gösterilir',
  };
}

// ═══════════════════════════════════════════════════
// Supplementary Cases (to reach minimum 15)
// ═══════════════════════════════════════════════════

function supplementary(current, ui, platform) {
  const needed = MINIMUM - current;
  if (needed <= 0) return [];

  const page    = pageLabel(ui.pageType);
  const feature = featureFor(ui.forms[0]?.purpose || ui.pageType);

  // Auth-specific supplementary cases
  const authPool = [
    { feature: 'Kimlik Doğrulama', title: 'Oturum zaman aşımı sonrası kullanıcının giriş sayfasına yönlendirilmesi', preconditions: 'Kullanıcı giriş yapmış olmalıdır', steps: '1. Geçerli kimlik bilgileri ile giriş yap\n2. Oturum zaman aşımı süresini bekle\n3. Korumalı bir sayfaya erişmeye çalış', expected: 'Kullanıcı giriş sayfasına yönlendirilir ve bilgilendirme mesajı gösterilir', priority: 'Yüksek', type: 'Güvenlik' },
    { feature: 'Kimlik Doğrulama', title: 'Şifremi unuttum bağlantısının çalışması kontrolü', preconditions: 'Giriş sayfası erişilebilir olmalıdır', steps: '1. Giriş sayfasına git\n2. "Şifremi unuttum" veya benzeri bağlantıyı ara\n3. Bağlantıya tıkla', expected: 'Şifre sıfırlama sayfası açılır veya şifre sıfırlama akışı başlatılır', priority: 'Yüksek', type: 'Fonksiyonel' },
    { feature: 'Kimlik Doğrulama', title: 'Enter tuşu ile form gönderiminin çalışması', preconditions: 'Giriş sayfası erişilebilir olmalıdır', steps: '1. Giriş sayfasına git\n2. E-posta ve şifre alanlarını doldur\n3. Şifre alanındayken Enter tuşuna bas', expected: 'Form Enter tuşu ile başarıyla gönderilir, butona tıklamaya gerek kalmaz', priority: 'Orta', type: 'Kullanılabilirlik' },
    { feature: 'Kimlik Doğrulama', title: 'Tarayıcı otomatik doldurma özelliğinin uyumu', preconditions: 'Tarayıcıda kayıtlı kimlik bilgileri mevcut olmalıdır', steps: '1. Giriş sayfasına git\n2. Tarayıcının otomatik doldurma önerisini kontrol et\n3. Otomatik doldurma ile alanları doldur\n4. Giriş yap', expected: 'Tarayıcı otomatik doldurma özelliği sorunsuz çalışır ve giriş başarılı olur', priority: 'Orta', type: 'Uyumluluk' },
  ];

  // General supplementary cases
  const generalPool = [
    { feature, title: `${page} sayfasının farklı tarayıcılarda tutarlı görüntülenmesi`, preconditions: 'Chrome, Firefox ve Safari tarayıcıları mevcut olmalıdır', steps: `1. ${page} sayfasını Chrome tarayıcısında aç\n2. Firefox tarayıcısında aç\n3. Safari tarayıcısında aç\n4. Görsel tutarlılığı karşılaştır`, expected: 'Sayfa tüm desteklenen tarayıcılarda tutarlı görüntülenir ve işlevsellik korunur', priority: 'Orta', type: 'Uyumluluk' },
    { feature, title: `${page} sayfasının mobil görünümde duyarlı tasarım kontrolü`, preconditions: 'Tarayıcı duyarlı tasarım modu mevcut olmalıdır', steps: '1. Duyarlı tasarım modunu etkinleştir\n2. 320px, 768px, 1024px ekran boyutlarını dene\n3. Düzenin uyumunu kontrol et', expected: 'Sayfa tüm ekran boyutlarında düzgün uyum sağlar, öğeler üst üste binmez', priority: 'Orta', type: 'Uyumluluk' },
    { feature, title: `${page} sayfasında çift tıklama ile mükerrer işlem engelleme kontrolü`, preconditions: `${page} sayfası erişilebilir olmalıdır`, steps: '1. Formu geçerli verilerle doldur\n2. Gönder butonuna hızlıca iki kez tıkla\n3. İşlem sonucunu kontrol et', expected: 'Mükerrer gönderim engellenir, işlem yalnızca bir kez gerçekleştirilir', priority: 'Yüksek', type: 'Fonksiyonel' },
    { feature, title: 'Doğrulama hatası sonrası girilen verilerin korunması', preconditions: `${page} sayfası erişilebilir olmalıdır`, steps: '1. Formu kısmen doldur\n2. Zorunlu bir alanı boş bırak\n3. Gönder butonuna tıkla\n4. Önceki verileri kontrol et', expected: 'Hata mesajları gösterilir ancak daha önce girilen geçerli veriler korunur', priority: 'Orta', type: 'Kullanılabilirlik' },
  ];

  const isAuth = ui.pageType === 'authentication' || ui.forms.some(f => f.purpose === 'authentication');
  const pool = isAuth ? [...authPool, ...generalPool] : generalPool;

  return pool.slice(0, needed).map((p, i) => ({ id: current + i + 1, ...p, platform }));
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function pageLabel(p) {
  return { authentication:'Giriş', registration:'Kayıt', search:'Arama', payment:'Ödeme', data_entry:'Form', form:'Form', navigation:'Ana Sayfa', listing:'Liste', generic:'Uygulama' }[p] || 'Uygulama';
}

function featureFor(p) {
  return { authentication:'Kimlik Doğrulama', registration:'Kayıt', search:'Arama', payment:'Ödeme', data_entry:'Form İşlemleri', form:'Form İşlemleri', navigation:'Navigasyon', listing:'Listeleme', generic:'Genel İşlevsellik' }[p] || 'Genel İşlevsellik';
}

function hint(field) {
  return { email:'e-posta adresi', password:'şifre', text:'metin', number:'sayısal değer', tel:'telefon numarası', url:'URL adresi', search:'arama terimi', textarea:'metin', select:'seçim' }[field.type] || 'değer';
}

module.exports = { buildTestCases };

