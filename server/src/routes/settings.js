const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET /api/settings - Get current user's settings
router.get('/', (req, res) => {
  const user = db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').get(req.user.id);

  const hasApiKey = !!user?.gemini_api_key;
  const apiKeyLast4 = hasApiKey ? user.gemini_api_key.slice(-4) : null;

  res.json({
    hasApiKey,
    apiKeyLast4,
  });
});

// PUT /api/settings/api-key - Save or update API key
router.put('/api-key', (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ error: 'API key is required' });
  }

  db.prepare('UPDATE users SET gemini_api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(apiKey.trim(), req.user.id);

  res.json({
    message: 'API key saved successfully',
    hasApiKey: true,
    apiKeyLast4: apiKey.trim().slice(-4),
  });
});

// DELETE /api/settings/api-key - Remove API key
router.delete('/api-key', (req, res) => {
  db.prepare('UPDATE users SET gemini_api_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(req.user.id);

  res.json({
    message: 'API key removed successfully',
    hasApiKey: false,
    apiKeyLast4: null,
  });
});

module.exports = router;
