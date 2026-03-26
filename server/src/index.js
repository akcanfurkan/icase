// Load .env — try multiple possible locations
const dotenvPath = require('path').resolve(__dirname, '..', '.env');
const dotenvResult = require('dotenv').config({ path: dotenvPath });
if (dotenvResult.error) {
  require('dotenv').config();
}
console.log(`[ENV] GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`);

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./db/database');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Initialize database
initializeDatabase();

// Routes
const authRouter = require('./routes/auth');
const settingsRouter = require('./routes/settings');
const projectsRouter = require('./routes/projects');
const testRunsRouter = require('./routes/testRuns');
const testCasesRouter = require('./routes/testCases');
const bugReportsRouter = require('./routes/bugReports');

// Public routes (no auth required)
app.use('/api/auth', authRouter);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes (auth required)
app.use('/api/settings', authMiddleware, settingsRouter);
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/test-runs', authMiddleware, testRunsRouter);
app.use('/api/test-cases', authMiddleware, testCasesRouter);
app.use('/api/bug-reports', authMiddleware, bugReportsRouter);

// Serve React production build (if available)
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
const fs = require('fs');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log('[Production] Serving React build from client/dist');
}

// Start server
app.listen(PORT, () => {
  console.log(`\niCase Server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`   POST   /api/auth/register`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/settings`);
  console.log(`   PUT    /api/settings/api-key`);
  console.log(`   GET    /api/projects`);
  console.log(`   POST   /api/projects`);
  console.log(`   GET    /api/test-runs`);
  console.log(`   POST   /api/test-runs`);
  console.log(`   GET    /api/test-cases`);
  console.log(`   POST   /api/test-cases/generate`);
  console.log(`   GET    /api/bug-reports`);
  console.log(`   POST   /api/bug-reports/generate\n`);
});
