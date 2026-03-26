import { useEffect, useState } from 'react';
import { FileText, Download, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTestCases, deleteTestCase, exportTestCases, getProjects } from '../api/client';

const PAGE_SIZE = 25;

export default function TestCases() {
  const [testCases, setTestCases] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function load(projectId) {
    setLoading(true);
    try {
      const params = projectId ? { project_id: projectId } : {};
      const [cases, projs] = await Promise.all([
        getTestCases(params),
        getProjects(),
      ]);
      setTestCases(cases);
      setProjects(projs);
    } catch (err) {
      toast.error('Failed to load test cases');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filterProject);
    setCurrentPage(1);
  }, [filterProject]);

  async function handleDelete(id) {
    try {
      await deleteTestCase(id);
      toast.success('Test case deleted');
      setDeleteConfirm(null);
      load(filterProject);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleExport() {
    try {
      const params = filterProject ? { project_id: filterProject } : {};
      await exportTestCases(params);
      toast.success('Excel file downloaded!');
    } catch (err) {
      toast.error(err.message || 'No test cases to export');
    }
  }

  // Filter by search
  const filtered = testCases.filter((tc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tc.feature?.toLowerCase().includes(q) ||
      tc.title?.toLowerCase().includes(q) ||
      tc.steps?.toLowerCase().includes(q) ||
      tc.expected?.toLowerCase().includes(q)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function badgeClassForPriority(priority) {
    const p = (priority || '').toLowerCase();
    if (p === 'kritik' || p === 'critical') return 'badge-critical';
    if (p === 'yuksek' || p === 'high') return 'badge-high';
    if (p === 'orta' || p === 'medium') return 'badge-medium';
    if (p === 'dusuk' || p === 'low') return 'badge-low';
    return 'badge-info';
  }

  function badgeClassForType(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('fonksiyon') || t === 'functional') return 'badge-functional';
    if (t.includes('negatif') || t === 'negative') return 'badge-negative';
    if (t.includes('guvenlik') || t === 'security') return 'badge-security';
    if (t.includes('sinir') || t === 'boundary') return 'badge-boundary';
    if (t.includes('performans') || t === 'performance') return 'badge-performance';
    if (t.includes('arayuz') || t === 'ui') return 'badge-ui';
    if (t.includes('kullanilabilir') || t === 'usability') return 'badge-usability';
    return 'badge-info';
  }

  return (
    <>
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>All Test Cases</h2>
          <p>Browse and manage all generated test cases</p>
        </div>
        <button className="btn btn-success" onClick={handleExport}>
          <Download size={16} /> Export Excel
        </button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="filter-row">
            <select
              className="form-control"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, maxWidth: 300 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                className="form-control"
                style={{ paddingLeft: 36 }}
                placeholder="Search test cases..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <FileText size={48} />
              <h3>No test cases found</h3>
              <p>Generate test cases from the "Generate Tests" page or create a test run in a project</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h3>{filtered.length} Test Cases</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Feature</th>
                    <th>Title</th>
                    <th>Preconditions</th>
                    <th>Steps</th>
                    <th>Expected</th>
                    <th>Priority</th>
                    <th>Type</th>
                    <th>Platform</th>
                    <th className="w-50"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((tc) => (
                    <tr key={tc.id}>
                      <td>{tc.id}</td>
                      <td><span className="badge badge-info">{tc.feature}</span></td>
                      <td><strong className="text-sm">{tc.title}</strong></td>
                      <td className="text-sm">{tc.preconditions}</td>
                      <td className="pre-wrap text-sm max-w-250">{tc.steps}</td>
                      <td className="text-sm max-w-200">{tc.expected}</td>
                      <td><span className={`badge ${badgeClassForPriority(tc.priority)}`}>{tc.priority}</span></td>
                      <td><span className={`badge ${badgeClassForType(tc.type)}`}>{tc.type}</span></td>
                      <td>{tc.platform}</td>
                      <td>
                        <button className="btn-icon" onClick={() => setDeleteConfirm(tc)}>
                          <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="confirm-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Delete Test Case</h4>
            <p>Delete "{deleteConfirm.title}"? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
