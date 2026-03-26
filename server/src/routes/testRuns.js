const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/database');
const { generateTestCases } = require('../services/testCaseService');

// Configure multer for image uploads
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// GET /api/test-runs - List all test runs
router.get('/', (req, res) => {
  try {
    const { project_id } = req.query;
    let runs;
    if (project_id) {
      runs = db.prepare(`
        SELECT tr.*, p.name as project_name,
          (SELECT COUNT(*) FROM test_cases WHERE test_run_id = tr.id) as test_case_count
        FROM test_runs tr
        LEFT JOIN projects p ON tr.project_id = p.id
        WHERE tr.project_id = ?
        ORDER BY tr.created_at DESC
      `).all(project_id);
    } else {
      runs = db.prepare(`
        SELECT tr.*, p.name as project_name,
          (SELECT COUNT(*) FROM test_cases WHERE test_run_id = tr.id) as test_case_count
        FROM test_runs tr
        LEFT JOIN projects p ON tr.project_id = p.id
        ORDER BY tr.created_at DESC
      `).all();
    }
    res.json(runs);
  } catch (error) {
    console.error('Error fetching test runs:', error);
    res.status(500).json({ error: 'Failed to fetch test runs' });
  }
});

// GET /api/test-runs/:id - Get test run details
router.get('/:id', (req, res) => {
  try {
    const run = db.prepare(`
      SELECT tr.*, p.name as project_name
      FROM test_runs tr
      LEFT JOIN projects p ON tr.project_id = p.id
      WHERE tr.id = ?
    `).get(req.params.id);

    if (!run) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    const testCases = db.prepare(`
      SELECT * FROM test_cases WHERE test_run_id = ? ORDER BY id ASC
    `).all(req.params.id);

    res.json({ ...run, testCases });
  } catch (error) {
    console.error('Error fetching test run:', error);
    res.status(500).json({ error: 'Failed to fetch test run' });
  }
});

// POST /api/test-runs - Create a new test run and generate test cases
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const { project_id, requirement, url } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    if (!requirement || !requirement.trim()) {
      return res.status(400).json({ error: 'Requirement text is required' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const imagePath = req.files && req.files.length > 0 ? req.files[0].filename : null;

    // Insert the test run
    const result = db.prepare(`
      INSERT INTO test_runs (project_id, requirement, url, image_path, status)
      VALUES (?, ?, ?, ?, 'processing')
    `).run(project_id, requirement.trim(), url?.trim() || null, imagePath);

    const testRunId = result.lastInsertRowid;

    // Generate test cases using the intelligence pipeline
    const pipelineResult = await generateTestCases({
      requirement: requirement.trim(),
      platform: req.body.platform || 'Web',
      url: url?.trim() || null,
      imageFiles: req.files || [],
      apiKey: req.user?.gemini_api_key || null,
    });

    // Insert generated test cases
    const insertCase = db.prepare(`
      INSERT INTO test_cases (test_run_id, project_id, feature, title, preconditions, steps, expected, priority, type, platform)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((cases) => {
      for (const tc of cases) {
        insertCase.run(
          testRunId, project_id,
          tc.feature, tc.title, tc.preconditions,
          tc.steps, tc.expected, tc.priority, tc.type, tc.platform
        );
      }
    });

    insertMany(pipelineResult.testCases);

    // Update test run status to completed
    db.prepare(`UPDATE test_runs SET status = 'completed' WHERE id = ?`).run(testRunId);

    // Fetch the complete test run with cases
    const testRun = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(testRunId);
    const testCases = db.prepare('SELECT * FROM test_cases WHERE test_run_id = ?').all(testRunId);

    res.status(201).json({
      ...testRun,
      testCases,
      intelligence: {
        domData: pipelineResult.domData,
        imageSignals: pipelineResult.imageSignals,
        validation: pipelineResult.validation,
        metadata: pipelineResult.metadata,
      },
    });
  } catch (error) {
    console.error('Error creating test run:', error);
    res.status(500).json({ error: 'Failed to create test run' });
  }
});

// POST /api/test-runs/stream - Create a test run with SSE progress
router.post('/stream', upload.array('images', 5), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { project_id, requirement, url } = req.body;
    if (!project_id) {
      sendEvent('error', { error: 'Project ID is required' });
      return res.end();
    }
    if (!requirement || !requirement.trim()) {
      sendEvent('error', { error: 'Requirement text is required' });
      return res.end();
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
    if (!project) {
      sendEvent('error', { error: 'Project not found' });
      return res.end();
    }

    const imagePath = req.files && req.files.length > 0 ? req.files[0].filename : null;

    const result = db.prepare(`
      INSERT INTO test_runs (project_id, requirement, url, image_path, status)
      VALUES (?, ?, ?, ?, 'processing')
    `).run(project_id, requirement.trim(), url?.trim() || null, imagePath);

    const testRunId = result.lastInsertRowid;

    const pipelineResult = await generateTestCases({
      requirement: requirement.trim(),
      platform: req.body.platform || 'Web',
      url: url?.trim() || null,
      imageFiles: req.files || [],
      apiKey: req.user?.gemini_api_key || null,
      onProgress: ({ step, status, timeMs }) => {
        sendEvent('progress', { step, status, timeMs });
      },
    });

    const insertCase = db.prepare(`
      INSERT INTO test_cases (test_run_id, project_id, feature, title, preconditions, steps, expected, priority, type, platform)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((cases) => {
      for (const tc of cases) {
        insertCase.run(
          testRunId, project_id,
          tc.feature, tc.title, tc.preconditions,
          tc.steps, tc.expected, tc.priority, tc.type, tc.platform
        );
      }
    });

    insertMany(pipelineResult.testCases);
    db.prepare(`UPDATE test_runs SET status = 'completed' WHERE id = ?`).run(testRunId);

    const testRun = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(testRunId);
    const testCases = db.prepare('SELECT * FROM test_cases WHERE test_run_id = ?').all(testRunId);

    sendEvent('complete', {
      ...testRun,
      testCases,
      intelligence: {
        domData: pipelineResult.domData,
        imageSignals: pipelineResult.imageSignals,
        validation: pipelineResult.validation,
        metadata: pipelineResult.metadata,
      },
    });
    res.end();
  } catch (error) {
    console.error('Error creating test run (stream):', error);
    sendEvent('error', { error: 'Failed to create test run' });
    res.end();
  }
});

// POST /api/test-runs/save - Save already-generated test cases (no AI re-call)
router.post('/save', express.json({ limit: '5mb' }), (req, res) => {
  try {
    const { project_id, requirement, url, testCases } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    if (!requirement || !requirement.trim()) {
      return res.status(400).json({ error: 'Requirement text is required' });
    }
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({ error: 'Test cases are required' });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Insert test run
    const result = db.prepare(`
      INSERT INTO test_runs (project_id, requirement, url, image_path, status)
      VALUES (?, ?, ?, NULL, 'completed')
    `).run(project_id, requirement.trim(), url?.trim() || null);

    const testRunId = result.lastInsertRowid;

    // Batch insert all test cases in a single transaction
    const insertCase = db.prepare(`
      INSERT INTO test_cases (test_run_id, project_id, feature, title, preconditions, steps, expected, priority, type, platform)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((cases) => {
      for (const tc of cases) {
        insertCase.run(
          testRunId, project_id,
          tc.feature || '', tc.title || '', tc.preconditions || '',
          tc.steps || '', tc.expected || '', tc.priority || 'Medium',
          tc.type || 'Functional', tc.platform || 'Web'
        );
      }
    });

    insertMany(testCases);

    // Return saved run with cases
    const testRun = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(testRunId);
    const savedCases = db.prepare('SELECT * FROM test_cases WHERE test_run_id = ?').all(testRunId);

    console.log(`[SaveTestRun] Saved ${savedCases.length} test cases to project ${project_id} (run #${testRunId})`);

    res.status(201).json({ ...testRun, testCases: savedCases });
  } catch (error) {
    console.error('Error saving test run:', error);
    res.status(500).json({ error: 'Failed to save test run' });
  }
});

// PUT /api/test-runs/:id - Update a test run
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    const { requirement, url, status } = req.body;
    db.prepare(`
      UPDATE test_runs SET
        requirement = COALESCE(?, requirement),
        url = COALESCE(?, url),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requirement, url, status, req.params.id);

    const updated = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating test run:', error);
    res.status(500).json({ error: 'Failed to update test run' });
  }
});

// DELETE /api/test-runs/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Test run not found' });
    }
    db.prepare('DELETE FROM test_runs WHERE id = ?').run(req.params.id);
    res.json({ message: 'Test run deleted successfully' });
  } catch (error) {
    console.error('Error deleting test run:', error);
    res.status(500).json({ error: 'Failed to delete test run' });
  }
});

module.exports = router;
