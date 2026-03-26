const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/database');
const { generateBugReport: generateBugReportRule } = require('../engines/bugReportEngine');

// AI adapter (optional)
let bugReportAdapter = null;
try {
  bugReportAdapter = require('../adapters/bugReportAdapter');
} catch (e) {
  console.log('[BugReports] AI adapter not available, using rule-based engine.');
}

// Multer config
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'bug-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    cb(null, ext && mime);
  },
});

// GET /api/bug-reports - List all bug reports
router.get('/', (req, res) => {
  try {
    const { project_id } = req.query;
    let reports;

    if (project_id) {
      reports = db.prepare(`
        SELECT br.*, p.name as project_name
        FROM bug_reports br
        LEFT JOIN projects p ON br.project_id = p.id
        WHERE br.project_id = ?
        ORDER BY br.created_at DESC
      `).all(project_id);
    } else {
      reports = db.prepare(`
        SELECT br.*, p.name as project_name
        FROM bug_reports br
        LEFT JOIN projects p ON br.project_id = p.id
        ORDER BY br.created_at DESC
      `).all();
    }

    res.json(reports);
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
});

// GET /api/bug-reports/ai-status - Check if AI is available for bug reports
// IMPORTANT: Must be before /:id to avoid being caught by the param route
router.get('/ai-status', (req, res) => {
  const userKey = req.user?.gemini_api_key || null;
  const aiAvailable = bugReportAdapter && bugReportAdapter.isConfigured(userKey);
  res.json({ aiAvailable });
});

// GET /api/bug-reports/:id - Get single bug report
router.get('/:id', (req, res) => {
  try {
    const report = db.prepare(`
      SELECT br.*, p.name as project_name
      FROM bug_reports br
      LEFT JOIN projects p ON br.project_id = p.id
      WHERE br.id = ?
    `).get(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching bug report:', error);
    res.status(500).json({ error: 'Failed to fetch bug report' });
  }
});

// POST /api/bug-reports/generate - Generate bug report (preview, not saved)
router.post('/generate', upload.array('images', 5), async (req, res) => {
  try {
    const { error_description } = req.body;
    if (!error_description || !error_description.trim()) {
      return res.status(400).json({ error: 'Error description is required' });
    }

    const userKey = req.user?.gemini_api_key || null;
    const useAI = bugReportAdapter && bugReportAdapter.isConfigured(userKey);
    const imageFiles = req.files || [];

    if (useAI) {
      const imagePaths = imageFiles.map((f) => f.path || path.join(uploadsDir, f.filename));
      const report = await bugReportAdapter.generateBugReport({
        errorDescription: error_description.trim(),
        imagePaths,
        apiKey: userKey,
      });
      res.json(report);
    } else {
      // Fallback: rule-based engine
      const report = generateBugReportRule(error_description.trim());
      report.metadata = { engine: 'rule-based', aiMode: false };
      res.json(report);
    }
  } catch (error) {
    console.error('Error generating bug report:', error);
    res.status(500).json({ error: error.message || 'Failed to generate bug report' });
  }
});

// POST /api/bug-reports/generate-stream - SSE endpoint with real-time progress
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
    res.write(': keepalive\n\n');
  }, 15000);

  try {
    const { error_description } = req.body;
    if (!error_description || !error_description.trim()) {
      clearInterval(keepalive);
      sendEvent('error', { error: 'Error description is required' });
      return res.end();
    }

    const userKey = req.user?.gemini_api_key || null;
    const useAI = bugReportAdapter && bugReportAdapter.isConfigured(userKey);
    const imageFiles = req.files || [];

    if (useAI) {
      const imagePaths = imageFiles.map((f) => f.path || path.join(uploadsDir, f.filename));
      const report = await bugReportAdapter.generateBugReport({
        errorDescription: error_description.trim(),
        imagePaths,
        apiKey: userKey,
        onProgress: ({ step, status, timeMs }) => {
          sendEvent('progress', { step, status, timeMs });
        },
      });
      sendEvent('complete', report);
    } else {
      sendEvent('progress', { step: 'ai', status: 'running' });
      const report = generateBugReportRule(error_description.trim());
      report.metadata = { engine: 'rule-based', aiMode: false };
      sendEvent('progress', { step: 'ai', status: 'done', timeMs: 0 });
      sendEvent('complete', report);
    }
    clearInterval(keepalive);
    res.end();
  } catch (error) {
    clearInterval(keepalive);
    console.error('Error generating bug report (stream):', error);
    sendEvent('error', { error: error.message || 'Failed to generate bug report' });
    res.end();
  }
});

// POST /api/bug-reports - Create and save a bug report
router.post('/', (req, res) => {
  try {
    const { project_id, title, steps_to_reproduce, actual_result, expected_result, severity, priority } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = db.prepare(`
      INSERT INTO bug_reports (project_id, title, steps_to_reproduce, actual_result, expected_result, severity, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')
    `).run(
      project_id || null,
      title.trim(),
      steps_to_reproduce?.trim() || '',
      actual_result?.trim() || '',
      expected_result?.trim() || '',
      severity || 'Medium',
      priority || 'Medium'
    );

    const report = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating bug report:', error);
    res.status(500).json({ error: 'Failed to create bug report' });
  }
});

// PUT /api/bug-reports/:id - Update bug report
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    const { title, steps_to_reproduce, actual_result, expected_result, severity, priority, status } = req.body;
    db.prepare(`
      UPDATE bug_reports
      SET title = COALESCE(?, title),
          steps_to_reproduce = COALESCE(?, steps_to_reproduce),
          actual_result = COALESCE(?, actual_result),
          expected_result = COALESCE(?, expected_result),
          severity = COALESCE(?, severity),
          priority = COALESCE(?, priority),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(title, steps_to_reproduce, actual_result, expected_result, severity, priority, status, req.params.id);

    const report = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(req.params.id);
    res.json(report);
  } catch (error) {
    console.error('Error updating bug report:', error);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
});

// DELETE /api/bug-reports/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM bug_reports WHERE id = ?').run(req.params.id);
    res.json({ message: 'Bug report deleted successfully' });
  } catch (error) {
    console.error('Error deleting bug report:', error);
    res.status(500).json({ error: 'Failed to delete bug report' });
  }
});

module.exports = router;

