const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET /api/projects - List all projects
router.get('/', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM test_runs WHERE project_id = p.id) as test_run_count,
        (SELECT COUNT(*) FROM test_cases WHERE project_id = p.id) as test_case_count,
        (SELECT COUNT(*) FROM bug_reports WHERE project_id = p.id) as bug_report_count
      FROM projects p
      ORDER BY p.created_at DESC
    `).all();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id - Get project details
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM test_runs WHERE project_id = p.id) as test_run_count,
        (SELECT COUNT(*) FROM test_cases WHERE project_id = p.id) as test_case_count,
        (SELECT COUNT(*) FROM bug_reports WHERE project_id = p.id) as bug_report_count
      FROM projects p
      WHERE p.id = ?
    `).get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const testRuns = db.prepare(`
      SELECT tr.*,
        (SELECT COUNT(*) FROM test_cases WHERE test_run_id = tr.id) as test_case_count
      FROM test_runs tr
      WHERE tr.project_id = ?
      ORDER BY tr.created_at DESC
    `).all(req.params.id);

    const testCases = db.prepare(`
      SELECT * FROM test_cases WHERE project_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    const bugReports = db.prepare(`
      SELECT * FROM bug_reports WHERE project_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ ...project, testRuns, testCases, bugReports });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects - Create a new project
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = db.prepare(`
      INSERT INTO projects (name, description) VALUES (?, ?)
    `).run(name.trim(), description?.trim() || '');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update a project
router.put('/:id', (req, res) => {
  try {
    const { name, description, status } = req.body;
    db.prepare(`
      UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description),
      status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(name, description, status, req.params.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete a project
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;

