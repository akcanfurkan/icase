/**
 * JSON Schema Validator Module
 * Provides strict validation for test case and bug report structures
 * before they are saved to the database.
 *
 * No external dependencies — pure JavaScript implementation.
 */

// ═══════════════════════════════════════════════════
// Test Case Schema Definition
// ═══════════════════════════════════════════════════

const TEST_CASE_SCHEMA = {
  id: { type: 'number', required: true },
  feature: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  title: { type: 'string', required: true, minLength: 5, maxLength: 500 },
  preconditions: { type: 'string', required: true, minLength: 1, maxLength: 1000 },
  steps: { type: 'string', required: true, minLength: 5, maxLength: 2000 },
  expected: { type: 'string', required: true, minLength: 5, maxLength: 1000 },
  priority: {
    type: 'string',
    required: true,
    enum: ['Kritik', 'Yüksek', 'Orta', 'Düşük', 'Critical', 'High', 'Medium', 'Low'],
  },
  type: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  platform: {
    type: 'string',
    required: true,
    enum: ['Web', 'Mobile', 'API', 'Desktop', 'Mobil', 'Masaüstü'],
  },
};

const BUG_REPORT_SCHEMA = {
  title: { type: 'string', required: true, minLength: 3, maxLength: 500 },
  steps_to_reproduce: { type: 'string', required: true, minLength: 5, maxLength: 2000 },
  actual_result: { type: 'string', required: true, minLength: 3, maxLength: 1000 },
  expected_result: { type: 'string', required: true, minLength: 3, maxLength: 1000 },
  severity: {
    type: 'string',
    required: true,
    enum: ['Critical', 'High', 'Medium', 'Low', 'Kritik', 'Yüksek', 'Orta', 'Düşük'],
  },
  priority: {
    type: 'string',
    required: true,
    enum: ['Critical', 'High', 'Medium', 'Low', 'Kritik', 'Yüksek', 'Orta', 'Düşük'],
  },
  status: {
    type: 'string',
    required: false,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Açık', 'Devam Ediyor', 'Çözüldü', 'Kapatıldı'],
  },
};

// ═══════════════════════════════════════════════════
// Validation Engine
// ═══════════════════════════════════════════════════

/**
 * Validates a single field against its schema definition.
 *
 * @param {string} fieldName
 * @param {*} value
 * @param {object} rules
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateField(fieldName, value, rules) {
  const errors = [];

  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`"${fieldName}" alanı zorunludur`);
    return errors;
  }

  // If not required and not provided, skip other checks
  if (value === undefined || value === null) {
    return errors;
  }

  // Type check
  if (rules.type === 'string' && typeof value !== 'string') {
    errors.push(`"${fieldName}" alanı metin (string) tipinde olmalıdır, alınan: ${typeof value}`);
    return errors;
  }

  if (rules.type === 'number' && typeof value !== 'number') {
    errors.push(`"${fieldName}" alanı sayı (number) tipinde olmalıdır, alınan: ${typeof value}`);
    return errors;
  }

  // String-specific validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`"${fieldName}" alanı en az ${rules.minLength} karakter olmalıdır (mevcut: ${value.length})`);
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`"${fieldName}" alanı en fazla ${rules.maxLength} karakter olmalıdır (mevcut: ${value.length})`);
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`"${fieldName}" alanı şu değerlerden biri olmalıdır: [${rules.enum.join(', ')}], alınan: "${value}"`);
    }
  }

  return errors;
}

/**
 * Validates a single test case object against the schema.
 *
 * @param {object} testCase
 * @param {number} index - Index in array (for error messages)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTestCase(testCase, index = 0) {
  const errors = [];

  if (!testCase || typeof testCase !== 'object') {
    return { valid: false, errors: [`Test vakası #${index + 1}: Geçerli bir nesne değil`] };
  }

  for (const [fieldName, rules] of Object.entries(TEST_CASE_SCHEMA)) {
    const fieldErrors = validateField(fieldName, testCase[fieldName], rules);
    errors.push(...fieldErrors.map((e) => `Test vakası #${index + 1}: ${e}`));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an array of test cases.
 *
 * @param {Array} testCases
 * @returns {{ valid: boolean, errors: string[], validCases: Array, invalidCases: Array }}
 */
function validateTestCases(testCases) {
  const allErrors = [];
  const validCases = [];
  const invalidCases = [];

  if (!Array.isArray(testCases)) {
    return {
      valid: false,
      errors: ['Test vakaları bir dizi (array) olmalıdır'],
      validCases: [],
      invalidCases: [],
    };
  }

  if (testCases.length === 0) {
    return {
      valid: false,
      errors: ['En az 1 test vakası gereklidir'],
      validCases: [],
      invalidCases: [],
    };
  }

  testCases.forEach((tc, idx) => {
    const result = validateTestCase(tc, idx);
    if (result.valid) {
      validCases.push(tc);
    } else {
      allErrors.push(...result.errors);
      invalidCases.push({ index: idx, testCase: tc, errors: result.errors });
    }
  });

  const isValid = allErrors.length === 0;

  if (!isValid) {
    console.warn(`[JSONValidator] Validation failed with ${allErrors.length} error(s):`);
    allErrors.forEach((e) => console.warn(`  - ${e}`));
  } else {
    console.log(`[JSONValidator] All ${testCases.length} test cases passed validation ✅`);
  }

  return {
    valid: isValid,
    errors: allErrors,
    validCases,
    invalidCases,
  };
}

/**
 * Validates a bug report object.
 *
 * @param {object} bugReport
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBugReport(bugReport) {
  const errors = [];

  if (!bugReport || typeof bugReport !== 'object') {
    return { valid: false, errors: ['Geçerli bir bug report nesnesi değil'] };
  }

  for (const [fieldName, rules] of Object.entries(BUG_REPORT_SCHEMA)) {
    const fieldErrors = validateField(fieldName, bugReport[fieldName], rules);
    errors.push(...fieldErrors);
  }

  if (errors.length > 0) {
    console.warn(`[JSONValidator] Bug report validation failed:`);
    errors.forEach((e) => console.warn(`  - ${e}`));
  } else {
    console.log(`[JSONValidator] Bug report passed validation ✅`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Attempts to sanitize and fix common issues in test case data.
 * Returns a cleaned version of the test case.
 *
 * @param {object} testCase
 * @returns {object} Sanitized test case
 */
function sanitizeTestCase(testCase) {
  return {
    id: typeof testCase.id === 'number' ? testCase.id : parseInt(testCase.id) || 0,
    feature: String(testCase.feature || '').trim(),
    title: String(testCase.title || '').trim(),
    preconditions: String(testCase.preconditions || '').trim(),
    steps: String(testCase.steps || '').trim(),
    expected: String(testCase.expected || '').trim(),
    priority: String(testCase.priority || 'Orta').trim(),
    type: String(testCase.type || 'Fonksiyonel').trim(),
    platform: String(testCase.platform || 'Web').trim(),
  };
}

/**
 * Validates and sanitizes an array of test cases.
 * Invalid cases are attempted to be fixed via sanitization.
 *
 * @param {Array} testCases
 * @returns {{ valid: boolean, testCases: Array, errors: string[] }}
 */
function validateAndSanitize(testCases) {
  if (!Array.isArray(testCases)) {
    return { valid: false, testCases: [], errors: ['Test vakaları bir dizi olmalıdır'] };
  }

  const sanitized = testCases.map((tc) => sanitizeTestCase(tc));
  const result = validateTestCases(sanitized);

  return {
    valid: result.valid,
    testCases: result.valid ? sanitized : result.validCases,
    errors: result.errors,
  };
}

module.exports = {
  validateTestCase,
  validateTestCases,
  validateBugReport,
  sanitizeTestCase,
  validateAndSanitize,
  TEST_CASE_SCHEMA,
  BUG_REPORT_SCHEMA,
};

