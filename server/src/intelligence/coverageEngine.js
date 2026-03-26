/**
 * Coverage Engine — Deterministic Test Intelligence Orchestrator
 *
 * Pipeline:
 *   DOM → domAnalyzer
 *       → interactionMapper
 *       → coveragePlanner
 *       → testMatrixGenerator
 *       → testCaseBuilder
 *
 * No AI.  No randomness.  Same input → same output.
 * Execution target: < 100 ms (excluding DOM extraction).
 */

const { analyze }           = require('./domAnalyzer');
const { mapInteractions }   = require('./interactionMapper');
const { planCoverage }      = require('./coveragePlanner');
const { generateMatrix }    = require('./testMatrixGenerator');
const { buildTestCases }    = require('./testCaseBuilder');

// ═══════════════════════════════════════════════════
// Main Entry
// ═══════════════════════════════════════════════════

/**
 * @param {object}      params
 * @param {object|null} params.domData      - Raw DOM extraction data
 * @param {string}      params.requirement  - Requirement text
 * @param {string}      params.platform     - Web | Mobile | API
 * @param {object|null} params.imageSignals - Image signal data
 * @returns {{ testCases: Array, metadata: object }}
 */
function execute({ domData = null, requirement = '', platform = 'Web', imageSignals = null }) {
  console.log('\n' + '═'.repeat(70));
  console.log('[CoverageEngine] Deterministik test zekâsı motoru başlatılıyor...');
  console.log('═'.repeat(70));

  const t0 = Date.now();
  const steps = {};

  // ── 1. DOM Analysis → UI Model ──
  let t = Date.now();
  const uiModel = analyze(domData, requirement, imageSignals);
  steps.domAnalysis = { ms: Date.now() - t, pageType: uiModel.pageType, source: uiModel.source };

  // ── 2. Interaction Mapping ──
  t = Date.now();
  const graph = mapInteractions(uiModel);
  steps.interactionMapping = { ms: Date.now() - t, count: graph.interactions.length };

  // ── 3. Coverage Planning ──
  t = Date.now();
  const plan = planCoverage(graph, uiModel);
  steps.coveragePlanning = { ms: Date.now() - t, items: plan.coverageItems.length };

  // Coverage summary
  const coverageSummary = {};
  for (const ci of plan.coverageItems) {
    coverageSummary[ci.coverageType] = (coverageSummary[ci.coverageType] || 0) + 1;
  }

  // ── 4. Matrix Generation ──
  t = Date.now();
  const matrix = generateMatrix(plan, uiModel);
  steps.matrixGeneration = { ms: Date.now() - t, rows: matrix.matrix.length };

  // ── 5. Test Case Building ──
  t = Date.now();
  const testCases = buildTestCases(matrix, uiModel, platform);
  steps.testCaseBuilding = { ms: Date.now() - t, cases: testCases.length };

  const totalMs = Date.now() - t0;

  // ── Summary ──
  console.log('\n' + '═'.repeat(70));
  console.log('[CoverageEngine] Pipeline tamamlandı!');
  console.log(`  Toplam süre       : ${totalMs}ms`);
  console.log(`  Sayfa türü        : ${uiModel.pageType} (${uiModel.source})`);
  console.log(`  Etkileşim         : ${graph.interactions.length}`);
  console.log(`  Kapsam öğesi      : ${plan.coverageItems.length}`);
  console.log(`  Test vakası       : ${testCases.length}`);
  console.log(`  Kapsam dağılımı   : ${JSON.stringify(coverageSummary)}`);
  console.log('═'.repeat(70) + '\n');

  return {
    testCases,
    metadata: {
      engine: 'deterministic-coverage-v1',
      platform,
      totalCases: testCases.length,
      executionTimeMs: totalMs,
      deterministic: true,
      pageType: uiModel.pageType,
      source: uiModel.source,
      coverageSummary,
      pipelineSteps: steps,
    },
  };
}

module.exports = { execute };

