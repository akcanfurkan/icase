import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, ArrowRight, FolderKanban, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProjects, createProject, deleteProject } from '../api/client';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function load() {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Project name is required');
    setSubmitting(true);
    try {
      await createProject(form);
      toast.success('Project created!');
      setShowModal(false);
      setForm({ name: '', description: '' });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteProject(id);
      toast.success('Project deleted');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Projects</h2>
          <p>Manage your QA projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : projects.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <FolderKanban size={48} />
              <h3>No projects yet</h3>
              <p>Create your first project to start organizing test activities</p>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Create Project
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Test Runs</th>
                    <th>Test Cases</th>
                    <th>Bugs</th>
                    <th>Created</th>
                    <th className="w-120">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td className="text-sm text-secondary">{p.description || '\u2014'}</td>
                      <td>{p.test_run_count}</td>
                      <td>{p.test_case_count}</td>
                      <td>{p.bug_report_count}</td>
                      <td className="text-sm text-secondary">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link to={`/projects/${p.id}`} className="btn btn-sm btn-secondary">
                            <ArrowRight size={14} />
                          </Link>
                          <button className="btn-icon" onClick={() => setDeleteConfirm(p)}>
                            <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="confirm-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Delete Project</h4>
            <p>Delete "{deleteConfirm.name}" and all related data? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Project</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Project Name *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. E-Commerce Platform"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Description <span>(optional)</span></label>
                  <textarea
                    className="form-control"
                    placeholder="Brief description of the project..."
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
