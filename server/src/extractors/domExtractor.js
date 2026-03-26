/**
 * DOM Extractor Module
 * Uses Playwright to extract structured DOM data from a given URL.
 *
 * Extracts:
 *  - All input fields (name, id, type, placeholder)
 *  - All buttons (text, id, disabled state)
 *  - All forms (action, method, fields)
 *  - All links (text, href, aria-label)
 *  - All aria labels
 */

let chromium;
try {
  chromium = require('playwright').chromium;
} catch {
  console.warn('[DOMExtractor] Playwright not installed — DOM extraction will be unavailable');
}

/**
 * Launches a headless Chromium browser, navigates to the given URL,
 * and extracts structured DOM information.
 *
 * @param {string} url - The URL to extract DOM data from
 * @param {object} options - Optional configuration
 * @param {number} options.timeout - Navigation timeout in ms (default: 15000)
 * @param {boolean} options.waitForNetworkIdle - Wait for network idle (default: true)
 * @returns {Promise<object>} Structured DOM data
 */
async function extractDOM(url, options = {}) {
  if (!chromium) {
    console.warn('[DOMExtractor] Skipping — Playwright not available');
    return {
      url,
      extractedAt: new Date().toISOString(),
      error: 'Playwright not installed',
      pageTitle: '',
      meta: {},
      summary: { totalInputs: 0, totalButtons: 0, totalForms: 0, totalLinks: 0, totalAriaElements: 0 },
      inputs: [], buttons: [], forms: [], links: [], ariaElements: [],
    };
  }

  const {
    timeout = 15000,
    waitForNetworkIdle = true,
  } = options;

  let browser = null;

  try {
    console.log(`[DOMExtractor] Launching headless browser for: ${url}`);

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Navigate to URL
    await page.goto(url, {
      timeout,
      waitUntil: waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
    });

    // Wait a bit for any JS rendering
    await page.waitForTimeout(1000);

    console.log(`[DOMExtractor] Page loaded, extracting DOM data...`);

    // Extract all DOM data in a single evaluate call for performance
    const domData = await page.evaluate(() => {
      // Helper: get clean text content
      const getText = (el) => (el.textContent || '').trim().substring(0, 200);
      const getAttr = (el, attr) => el.getAttribute(attr) || '';

      // Helper: find associated label for an input element
      const findLabel = (el) => {
        // 1. Explicit <label for="id">
        const elId = el.getAttribute('id');
        if (elId) {
          const labelEl = document.querySelector(`label[for="${elId}"]`);
          if (labelEl) return labelEl.textContent.trim().substring(0, 200);
        }
        // 2. Wrapping <label> parent
        const parentLabel = el.closest('label');
        if (parentLabel) {
          // Get label text excluding the input's own text
          const clone = parentLabel.cloneNode(true);
          const childInputs = clone.querySelectorAll('input, textarea, select');
          childInputs.forEach(ci => ci.remove());
          const text = clone.textContent.trim();
          if (text) return text.substring(0, 200);
        }
        // 3. Adjacent sibling text (common for checkboxes)
        const next = el.nextElementSibling || el.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim()) {
          return next.textContent.trim().substring(0, 200);
        }
        if (next && next.nodeType === Node.ELEMENT_NODE && next.tagName !== 'INPUT') {
          const t = next.textContent.trim();
          if (t && t.length < 100) return t;
        }
        return '';
      };

      // ── Input Fields ──
      const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || (el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'SELECT' ? 'select' : 'text'),
        name: getAttr(el, 'name'),
        id: getAttr(el, 'id'),
        placeholder: getAttr(el, 'placeholder'),
        label: findLabel(el),
        required: el.hasAttribute('required'),
        disabled: el.disabled || false,
        ariaLabel: getAttr(el, 'aria-label'),
        maxLength: el.maxLength > 0 && el.maxLength < 10000 ? el.maxLength : null,
        pattern: getAttr(el, 'pattern') || null,
        value: el.tagName === 'SELECT'
          ? Array.from(el.options).map((o) => ({ value: o.value, text: o.text }))
          : null,
      }));

      // ── Buttons ──
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: getAttr(el, 'type') || 'button',
        text: getText(el) || getAttr(el, 'value'),
        id: getAttr(el, 'id'),
        name: getAttr(el, 'name'),
        disabled: el.disabled || el.hasAttribute('disabled'),
        ariaLabel: getAttr(el, 'aria-label'),
        classes: el.className ? el.className.substring(0, 100) : '',
      }));

      // ── Forms ──
      const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
        id: getAttr(form, 'id'),
        name: getAttr(form, 'name'),
        action: getAttr(form, 'action'),
        method: (getAttr(form, 'method') || 'GET').toUpperCase(),
        fields: Array.from(form.querySelectorAll('input, textarea, select')).map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || el.tagName.toLowerCase(),
          name: getAttr(el, 'name'),
          id: getAttr(el, 'id'),
          required: el.hasAttribute('required'),
        })),
      }));

      // ── Links ──
      const links = Array.from(document.querySelectorAll('a[href]')).map((el) => ({
        text: getText(el).substring(0, 100),
        href: getAttr(el, 'href'),
        ariaLabel: getAttr(el, 'aria-label'),
        target: getAttr(el, 'target'),
        rel: getAttr(el, 'rel'),
      }));

      // ── Aria Labels (all elements with aria attributes) ──
      const ariaElements = Array.from(document.querySelectorAll('[aria-label], [aria-describedby], [aria-labelledby], [role]')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: getAttr(el, 'role'),
        ariaLabel: getAttr(el, 'aria-label'),
        ariaDescribedBy: getAttr(el, 'aria-describedby'),
        ariaLabelledBy: getAttr(el, 'aria-labelledby'),
        id: getAttr(el, 'id'),
      }));

      // ── Page Meta ──
      const meta = {
        title: document.title || '',
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        lang: document.documentElement.lang || '',
        charset: document.characterSet || '',
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
      };

      return {
        meta,
        inputs,
        buttons,
        forms,
        links,
        ariaElements,
      };
    });

    // Add extraction metadata
    const result = {
      url,
      extractedAt: new Date().toISOString(),
      pageTitle: domData.meta.title,
      meta: domData.meta,
      summary: {
        totalInputs: domData.inputs.length,
        totalButtons: domData.buttons.length,
        totalForms: domData.forms.length,
        totalLinks: domData.links.length,
        totalAriaElements: domData.ariaElements.length,
      },
      inputs: domData.inputs,
      buttons: domData.buttons,
      forms: domData.forms,
      links: domData.links,
      ariaElements: domData.ariaElements,
    };

    console.log(`[DOMExtractor] Extraction complete:`, JSON.stringify(result.summary));
    console.log(`[DOMExtractor] DOM Output:\n${JSON.stringify(result, null, 2)}`);

    await browser.close();
    return result;

  } catch (error) {
    console.error(`[DOMExtractor] Error extracting DOM from ${url}:`, error.message);

    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      url,
      extractedAt: new Date().toISOString(),
      error: error.message,
      pageTitle: '',
      meta: {},
      summary: {
        totalInputs: 0,
        totalButtons: 0,
        totalForms: 0,
        totalLinks: 0,
        totalAriaElements: 0,
      },
      inputs: [],
      buttons: [],
      forms: [],
      links: [],
      ariaElements: [],
    };
  }
}

module.exports = { extractDOM };

