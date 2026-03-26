const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { db } = require('../db/database');
const { generateTestCases, isAIAvailable } = require('../services/testCaseService');

// Configure multer for image uploads on generate endpoint
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'gen-' + uniqueSuffix + path.extname(file.originalname));
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
      cb(new Error('Sadece görsel dosyaları kabul edilir'));
    }
  },
});

// GET /api/test-cases - List test cases
router.get('/', (req, res) => {
  try {
    const { project_id, test_run_id } = req.query;
    let cases;

    if (test_run_id) {
      cases = db.prepare('SELECT * FROM test_cases WHERE test_run_id = ? ORDER BY id ASC').all(test_run_id);
    } else if (project_id) {
      cases = db.prepare('SELECT * FROM test_cases WHERE project_id = ? ORDER BY id ASC').all(project_id);
    } else {
      cases = db.prepare('SELECT * FROM test_cases ORDER BY created_at DESC LIMIT 200').all();
    }

    res.json(cases);
  } catch (error) {
    console.error('Error fetching test cases:', error);
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
});

// GET /api/test-cases/ai-status - Check if AI mode is available
router.get('/ai-status', (req, res) => {
  const userKey = req.user?.gemini_api_key || null;
  res.json({
    aiAvailable: isAIAvailable(userKey),
    engine: isAIAvailable(userKey) ? 'gemini-ai' : 'deterministic-coverage',
  });
});

// POST /api/test-cases/generate - Generate test cases (preview)
// Supports: requirement + platform + optional URL + optional images (up to 5)
router.post('/generate', upload.array('images', 5), async (req, res) => {
  try {
    const { requirement, platform, url } = req.body;
    if (!requirement || !requirement.trim()) {
      return res.status(400).json({ error: 'Gereksinim metni zorunludur' });
    }

    const result = await generateTestCases({
      requirement: requirement.trim(),
      platform: platform || 'Web',
      url: url?.trim() || null,
      imageFiles: req.files || [],
      apiKey: req.user?.gemini_api_key || null,
    });

    res.json(result);
  } catch (error) {
    console.error('Error generating test cases:', error);
    res.status(500).json({ error: error.message || 'Test vakası üretimi başarısız' });
  }
});

// POST /api/test-cases/generate-stream - SSE endpoint with real-time progress
router.post('/generate-stream', upload.array('images', 5), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const keepalive = setInterval(() => {
    try { sendEvent('progress', { step: 'ai', status: 'running' }); } catch {}
  }, 10000);

  try {
    const { requirement, platform, url } = req.body;
    if (!requirement || !requirement.trim()) {
      clearInterval(keepalive);
      sendEvent('error', { error: 'Gereksinim metni zorunludur' });
      return res.end();
    }

    const result = await generateTestCases({
      requirement: requirement.trim(),
      platform: platform || 'Web',
      url: url?.trim() || null,
      imageFiles: req.files || [],
      apiKey: req.user?.gemini_api_key || null,
      onProgress: ({ step, status, timeMs }) => {
        sendEvent('progress', { step, status, timeMs });
      },
    });

    clearInterval(keepalive);
    sendEvent('complete', result);
    res.end();
  } catch (error) {
    clearInterval(keepalive);
    console.error('Error generating test cases (stream):', error);
    sendEvent('error', { error: error.message || 'Test vakası üretimi başarısız' });
    res.end();
  }
});

// GET /api/test-cases/export - Export test cases to Excel
router.get('/export', (req, res) => {
  try {
    const { project_id, test_run_id } = req.query;
    let cases;

    if (test_run_id) {
      cases = db.prepare('SELECT * FROM test_cases WHERE test_run_id = ? ORDER BY id ASC').all(test_run_id);
    } else if (project_id) {
      cases = db.prepare('SELECT * FROM test_cases WHERE project_id = ? ORDER BY id ASC').all(project_id);
    } else {
      cases = db.prepare('SELECT * FROM test_cases ORDER BY id ASC').all();
    }

    if (cases.length === 0) {
      return res.status(404).json({ error: 'No test cases found to export' });
    }

    const data = cases.map((tc) => ({
      'ID': tc.id,
      'Feature': tc.feature,
      'Title': tc.title,
      'Preconditions': tc.preconditions,
      'Steps': tc.steps,
      'Expected': tc.expected,
      'Priority': tc.priority,
      'Type': tc.type,
      'Platform': tc.platform,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Cases');

    worksheet['!cols'] = [
      { wch: 6 },   // ID
      { wch: 18 },  // Feature
      { wch: 45 },  // Title
      { wch: 30 },  // Preconditions
      { wch: 55 },  // Steps
      { wch: 45 },  // Expected
      { wch: 10 },  // Priority
      { wch: 12 },  // Type
      { wch: 10 },  // Platform
    ];

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=test-cases.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting test cases:', error);
    res.status(500).json({ error: 'Failed to export test cases' });
  }
});

// GET /api/test-cases/:id - Get single test case
router.get('/:id', (req, res) => {
  try {
    const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    if (!tc) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    res.json(tc);
  } catch (error) {
    console.error('Error fetching test case:', error);
    res.status(500).json({ error: 'Failed to fetch test case' });
  }
});

// PUT /api/test-cases/:id - Update a test case
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    const { feature, title, preconditions, steps, expected, priority, type, platform, status } = req.body;
    db.prepare(`
      UPDATE test_cases SET
        feature = COALESCE(?, feature),
        title = COALESCE(?, title),
        preconditions = COALESCE(?, preconditions),
        steps = COALESCE(?, steps),
        expected = COALESCE(?, expected),
        priority = COALESCE(?, priority),
        type = COALESCE(?, type),
        platform = COALESCE(?, platform),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(feature, title, preconditions, steps, expected, priority, type, platform, status, req.params.id);

    const updated = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating test case:', error);
    res.status(500).json({ error: 'Failed to update test case' });
  }
});

// DELETE /api/test-cases/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    db.prepare('DELETE FROM test_cases WHERE id = ?').run(req.params.id);
    res.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    console.error('Error deleting test case:', error);
    res.status(500).json({ error: 'Failed to delete test case' });
  }
});

module.exports = router;
