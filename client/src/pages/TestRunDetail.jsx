import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTestRun, exportTestCases } from '../api/client';

export default function TestRunDetail() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getTestRun(id);
        setRun(data);
      } catch (err) {
        toast.error('Failed to load test run');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleExport() {
    try {
      await exportTestCases({ test_run_id: id });
      toast.success('Excel downloaded!');
    } catch (err) {
      toast.error(err.message || 'No test cases to export');
    }
  }

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
    return 'badge-info';
  }

  if (loading) {
    return (
      <>
        <div className="page-header"><h2>Loading...</h2></div>
        <div className="loading-center"><div className="spinner" /></div>
      </>
    );
  }

  if (!run) {
    return (
      <>
        <div className="page-header"><h2>Test Run not found</h2></div>
        <div className="page-body">
          <Link to="/projects" className="btn btn-secondary"><ArrowLeft size={16} /> Back</Link>
        </div>
      </>
    );
  }

  const statusBadge = run.status === 'completed' ? 'badge-completed'
    : run.status === 'processing' ? 'badge-processing'
    : 'badge-pending';

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to={`/projects/${run.project_id}`} className="btn-icon"><ArrowLeft size={20} /></Link>
          <div>
            <h2>Test Run #{run.id}</h2>
            <p>{run.project_name ? `Project: ${run.project_name}` : ''} — {new Date(run.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Run Info */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>Requirement</h3>
            <div className="flex gap-2">
              <span className={`badge ${statusBadge}`}>{run.status}</span>
              <button className="btn btn-sm btn-success" onClick={handleExport}>
                <Download size={14} /> Export Excel
              </button>
            </div>
          </div>
          <div className="card-body">
            <p className="pre-wrap">{run.requirement}</p>
            {run.url && (
              <p className="mt-2 text-sm">
                <strong>URL:</strong>{' '}
                <a href={run.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>{run.url}</a>
              </p>
            )}
            {run.image_path && (
              <div className="mt-3">
                <strong className="text-sm">Attached Image:</strong>
                <div className="image-preview mt-2">
                  <img src={`/uploads/${run.image_path}`} alt="Attached" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Cases */}
        <div className="card">
          <div className="card-header">
            <h3>Test Cases ({run.testCases?.length || 0})</h3>
          </div>
          {run.testCases?.length === 0 ? (
            <div className="empty-state">
              <FileText size={40} />
              <h3>No test cases</h3>
            </div>
          ) : (
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
                  </tr>
                </thead>
                <tbody>
                  {run.testCases.map((tc) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
