/**
 * Interaction Mapper — Builds Interaction Graph from UI Model
 *
 * Maps UI elements to interaction nodes with actions and possible outcomes.
 * Identifies form submissions, input validations, checkbox toggles,
 * password visibility, button states, navigation, and state transitions.
 *
 * Deterministic: Same input always produces same output.
 */

let _counter = 0;
function nextId() { return `int-${++_counter}`; }

// ═══════════════════════════════════════════════════
// Main Entry
// ═══════════════════════════════════════════════════

/**
 * @param {object} uiModel - Structured UI model from domAnalyzer
 * @returns {{ interactions: Array }}
 */
function mapInteractions(uiModel) {
  console.log('[InteractionMapper] Etkileşim haritası oluşturuluyor...');
  _counter = 0;
  const interactions = [];

  // Form-level interactions
  for (const form of uiModel.forms) {
    interactions.push(...mapFormInteractions(form));
  }

  // Standalone buttons (not tied to a form submit)
  const formBtnIds = new Set(uiModel.forms.map(f => f.submitButton?.id).filter(Boolean));
  for (const btn of uiModel.buttons) {
    if (btn.id && !formBtnIds.has(btn.id)) {
      interactions.push(mapStandaloneButton(btn));
    }
  }

  // Navigation
  const navLinks = uiModel.links.filter(l => l.href && l.href !== '#' && !l.href.startsWith('javascript:'));
  if (navLinks.length > 0) {
    interactions.push(mapNavigation(navLinks));
  }

  // Disabled-element state interactions
  for (const ind of uiModel.stateIndicators) {
    if (ind.type === 'disabled_buttons' || ind.type === 'disabled_inputs') {
      interactions.push(mapDisabledState(ind));
    }
  }

  console.log(`[InteractionMapper] Tamamlandı — ${interactions.length} etkileşim`);
  return { interactions };
}

// ═══════════════════════════════════════════════════
// Mappers
// ═══════════════════════════════════════════════════

function mapFormInteractions(form) {
  const out = [];

  // Separate checkboxes from regular text inputs
  const textFields = form.fields.filter(f => f.type !== 'checkbox' && f.type !== 'radio');
  const checkboxes = form.fields.filter(f => f.type === 'checkbox');
  const hasPassword = form.fields.some(f => f.type === 'password');

  // 1. Form submission (only count text-type required fields for validation)
  out.push({
    id: nextId(),
    type: 'form_submission',
    source: {
      formId: form.id,
      purpose: form.purpose,
      method: form.method,
      action: form.action,
      submitLabel: form.submitButton?.label || 'Gönder',
    },
    action: `${form.method} ${form.action || 'form'}`,
    requiredFields: textFields.filter(f => f.required).map(f => f.label || f.name),
    allFields: textFields.map(f => ({
      name: f.name, type: f.type, label: f.label, required: f.required, maxLength: f.maxLength, pattern: f.pattern,
    })),
    possibleOutcomes: ['success', 'validation_error', 'server_error'],
  });

  // 2. Individual text field interactions
  for (const field of textFields) {
    out.push({
      id: nextId(),
      type: 'input_interaction',
      source: {
        formId: form.id,
        fieldName: field.name,
        fieldType: field.type,
        fieldLabel: field.label,
        required: field.required,
        maxLength: field.maxLength,
        pattern: field.pattern,
      },
      action: `input_${field.type || 'text'}`,
      possibleOutcomes: inputOutcomes(field),
    });
  }

  // 3. Checkbox interactions (e.g., "Beni hatırla")
  for (const cb of checkboxes) {
    out.push({
      id: nextId(),
      type: 'checkbox_interaction',
      source: {
        formId: form.id,
        fieldName: cb.name,
        fieldLabel: cb.label,
        formPurpose: form.purpose,
      },
      action: 'toggle_checkbox',
      possibleOutcomes: ['checked', 'unchecked', 'state_persisted'],
    });
  }

  // 4. Password visibility toggle (structurally: any form with password field)
  if (hasPassword) {
    out.push({
      id: nextId(),
      type: 'password_visibility',
      source: {
        formId: form.id,
        passwordFields: form.fields.filter(f => f.type === 'password').map(f => f.label || f.name),
      },
      action: 'toggle_password_visibility',
      possibleOutcomes: ['password_shown', 'password_hidden'],
    });
  }

  // 5. Submit-button state
  if (form.submitButton) {
    out.push({
      id: nextId(),
      type: 'button_state',
      source: {
        formId: form.id,
        buttonLabel: form.submitButton.label,
        initialDisabled: form.submitButton.disabled || false,
      },
      action: 'click_submit',
      possibleOutcomes: ['enabled_click', 'disabled_state', 'loading_state'],
    });
  }

  return out;
}

function inputOutcomes(field) {
  const o = ['valid_input', 'empty_input'];
  if (field.type === 'email')                          o.push('invalid_format');
  if (field.type === 'password')                       o.push('weak_password', 'masked_display');
  if (field.type === 'number' || field.type === 'tel') o.push('non_numeric_input');
  if (field.type === 'url')                            o.push('invalid_url');
  if (field.maxLength)                                 o.push('max_length_exceeded');
  if (field.pattern)                                   o.push('pattern_mismatch');
  if (field.required)                                  o.push('required_violation');
  return o;
}

function mapStandaloneButton(btn) {
  return {
    id: nextId(),
    type: 'button_click',
    source: { buttonLabel: btn.label, buttonId: btn.id, disabled: btn.disabled },
    action: `click_${btn.id || 'button'}`,
    possibleOutcomes: btn.disabled
      ? ['disabled_state', 'enable_condition']
      : ['action_performed', 'error_response'],
  };
}

function mapNavigation(links) {
  return {
    id: nextId(),
    type: 'navigation',
    source: { totalLinks: links.length, linkLabels: links.slice(0, 10).map(l => l.label) },
    action: 'navigate',
    possibleOutcomes: ['page_load_success', 'page_not_found', 'redirect'],
  };
}

function mapDisabledState(indicator) {
  return {
    id: nextId(),
    type: 'state_change',
    source: { disabledElements: indicator.elements, count: indicator.count },
    action: 'state_transition',
    possibleOutcomes: ['disabled_to_enabled', 'stays_disabled', 'visual_feedback'],
  };
}

module.exports = { mapInteractions };
