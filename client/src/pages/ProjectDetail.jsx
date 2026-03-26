import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, FileText, Bug, FlaskConical, Trash2, Download, ArrowRight, X,
  Sparkles, Cpu, Image as ImageIcon, HelpCircle, Copy, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getProject, createTestRun, createTestRunStream, deleteTestRun, exportTestCases, deleteBugReport, getAIStatus,
  updateBugReport, generateBugReport, generateBugReportStream, createBugReport, getBugAIStatus,
} from '../api/client';
import StepProgress from '../components/StepProgress';

const MAX_IMAGES = 5;

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRunModal, setShowRunModal] = useState(false);
  const [requirement, setRequirement] = useState('');
  const [platform, setPlatform] = useState('Web');
  const [url, setUrl] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [aiStatus, setAIStatus] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [selectedBug, setSelectedBug] = useState(null);
  const [savingBug, setSavingBug] = useState(false);
  // Bug Generator modal state
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugDesc, setBugDesc] = useState('');
  const [bugImages, setBugImages] = useState([]);
  const [bugImagePreviews, setBugImagePreviews] = useState([]);
  const [bugReport, setBugReport] = useState(null);
  const [generatingBug, setGeneratingBug] = useState(false);
  const [savingNewBug, setSavingNewBug] = useState(false);
  const [savedNewBug, setSavedNewBug] = useState(false);
  const [bugAIStatus, setBugAIStatus] = useState(null);
  const [runProgressEvents, setRunProgressEvents] = useState([]);
  const [runProgressError, setRunProgressError] = useState(null);
  const [bugProgressEvents, setBugProgressEvents] = useState([]);
  const [bugProgressError, setBugProgressError] = useState(null);

  async function load() {
    try {
      const data = await getProject(id);
      setProject(data);
    } catch (err) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => { getAIStatus().then(setAIStatus).catch(() => setAIStatus({ aiAvailable: false })); }, []);
  useEffect(() => { getBugAIStatus().then(setBugAIStatus).catch(() => setBugAIStatus({ aiAvailable: false })); }, []);

  // Lightbox ESC key
  useEffect(() => {
    if (!lightboxImg) return;
    function handleKey(e) { if (e.key === 'Escape') setLightboxImg(null); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxImg]);

  // Global paste listener for images (active only when modal is open)
  useEffect(() => {
    if (!showRunModal) return;
    function handleGlobalPaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    }
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [showRunModal, images]);

  function addImages(files) {
    const available = MAX_IMAGES - images.length;
    if (available <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    const toAdd = Array.from(files).slice(0, available);
    if (files.length > available) {
      toast(`Only ${available} more image(s) can be added (max ${MAX_IMAGES})`, { icon: 'ℹ️' });
    }
    setImages((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  }

  function handleImageChange(e) {
    if (e.target.files && e.target.files.length > 0) addImages(e.target.files);
    e.target.value = '';
  }

  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function resetModal() {
    setRequirement('');
    setPlatform('Web');
    setUrl('');
    setImages([]);
    setImagePreviews([]);
    setShowRunModal(false);
  }

  // Bug modal paste listener
  useEffect(() => {
    if (!showBugModal) return;
    function handleBugPaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addBugImages(imageFiles);
      }
    }
    document.addEventListener('paste', handleBugPaste);
    return () => document.removeEventListener('paste', handleBugPaste);
  }, [showBugModal, bugImages]);

  function addBugImages(files) {
    const available = MAX_IMAGES - bugImages.length;
    if (available <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    const toAdd = Array.from(files).slice(0, available);
    if (files.length > available) {
      toast(`Only ${available} more image(s) can be added (max ${MAX_IMAGES})`, { icon: 'ℹ️' });
    }
    setBugImages((prev) => [...prev, ...toAdd]);
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setBugImagePreviews((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  }

  function handleBugImageChange(e) {
    if (e.target.files && e.target.files.length > 0) addBugImages(e.target.files);
    e.target.value = '';
  }

  function removeBugImage(index) {
    setBugImages((prev) => prev.filter((_, i) => i !== index));
    setBugImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function resetBugModal() {
    setBugDesc('');
    setBugImages([]);
    setBugImagePreviews([]);
    setBugReport(null);
    setSavedNewBug(false);
    setShowBugModal(false);
  }

  async function handleGenerateBug() {
    if (!bugDesc.trim()) return toast.error('Please describe the error');
    setGeneratingBug(true);
    setSavedNewBug(false);
    setBugProgressEvents([]);
    setBugProgressError(null);
    try {
      const formData = new FormData();
      formData.append('error_description', bugDesc);
      bugImages.forEach((img) => formData.append('images', img));
      const data = await generateBugReportStream(formData, (event) => {
        setBugProgressEvents((prev) => [...prev, event]);
      });
      setBugReport(data);
      toast.success('Bug report generated!');
    } catch (err) {
      setBugProgressError(err.message);
      toast.error(err.message);
    } finally {
      setGeneratingBug(false);
    }
  }

  async function handleSaveNewBug() {
    if (!bugReport) return;
    setSavingNewBug(true);
    try {
      await createBugReport({
        project_id: id,
        title: bugReport.title,
        steps_to_reproduce: bugReport.steps_to_reproduce,
        actual_result: bugReport.actual_result,
        expected_result: bugReport.expected_result,
        severity: bugReport.severity,
        priority: bugReport.priority,
      });
      toast.success('Bug report saved to project!');
      setSavedNewBug(true);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingNewBug(false);
    }
  }

  function handleNewBugFieldChange(field, value) {
    setBugReport({ ...bugReport, [field]: value });
    setSavedNewBug(false);
  }

  function handleCopyNewBug() {
    if (!bugReport) return;
    const md = [
      `## ${bugReport.title}`,
      '',
      `**Severity:** ${bugReport.severity}`,
      `**Priority:** ${bugReport.priority}`,
      bugReport.environment ? `**Environment:** ${bugReport.environment}` : null,
      `**Status:** ${bugReport.status || 'Open'}`,
      '',
      '### Steps to Reproduce',
      bugReport.steps_to_reproduce,
      '',
      '### Actual Result',
      bugReport.actual_result,
      '',
      '### Expected Result',
      bugReport.expected_result,
      bugReport.additional_notes ? `\n### Additional Notes\n${bugReport.additional_notes}` : null,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(md).then(() => {
      toast.success('Copied to clipboard! (Markdown format)');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }

  async function handleCreateRun(e) {
    e.preventDefault();
    if (!requirement.trim()) return toast.error('Requirement text is required');
    setSubmitting(true);
    setRunProgressEvents([]);
    setRunProgressError(null);
    try {
      const formData = new FormData();
      formData.append('project_id', id);
      formData.append('requirement', requirement);
      formData.append('platform', platform);
      if (url.trim()) formData.append('url', url.trim());
      images.forEach((img) => formData.append('images', img));

      await createTestRunStream(formData, (event) => {
        setRunProgressEvents((prev) => [...prev, event]);
      });
      toast.success('Test run created with generated test cases!');
      resetModal();
      load();
    } catch (err) {
      setRunProgressError(err.message);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRun(runId) {
    try {
      await deleteTestRun(runId);
      toast.success('Test run deleted');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDeleteBug(bugId) {
    try {
      await deleteBugReport(bugId);
      toast.success('Bug report deleted');
      setDeleteConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleExport() {
    try {
      await exportTestCases({ project_id: id });
      toast.success('Excel file downloaded!');
    } catch (err) {
      toast.error(err.message || 'No test cases to export');
    }
  }

  function severityBadge(val) {
    const v = (val || '').toLowerCase();
    if (v === 'critical') return 'badge-critical';
    if (v === 'high') return 'badge-high';
    if (v === 'medium') return 'badge-medium';
    if (v === 'low') return 'badge-low';
    return 'badge-info';
  }

  function statusBadge(val) {
    const v = (val || '').toLowerCase();
    if (v === 'open') return 'badge-open';
    if (v === 'closed') return 'badge-closed';
    if (v === 'resolved') return 'badge-resolved';
    if (v === 'in progress') return 'badge-in-progress';
    if (v === 'completed') return 'badge-completed';
    if (v === 'processing') return 'badge-processing';
    return 'badge-info';
  }

  function handleBugFieldChange(field, value) {
    setSelectedBug({ ...selectedBug, [field]: value });
  }

  async function handleSaveBug() {
    if (!selectedBug) return;
    setSavingBug(true);
    try {
      await updateBugReport(selectedBug.id, {
        title: selectedBug.title,
        steps_to_reproduce: selectedBug.steps_to_reproduce,
        actual_result: selectedBug.actual_result,
        expected_result: selectedBug.expected_result,
        severity: selectedBug.severity,
        priority: selectedBug.priority,
        status: selectedBug.status,
      });
      toast.success('Bug report updated!');
      setSelectedBug(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingBug(false);
    }
  }

  function handleCopyBug() {
    if (!selectedBug) return;
    const md = [
      `## ${selectedBug.title}`,
      '',
      `**Severity:** ${selectedBug.severity}`,
      `**Priority:** ${selectedBug.priority}`,
      `**Status:** ${selectedBug.status || 'Open'}`,
      '',
      '### Steps to Reproduce',
      selectedBug.steps_to_reproduce || 'N/A',
      '',
      '### Actual Result',
      selectedBug.actual_result || 'N/A',
      '',
      '### Expected Result',
      selectedBug.expected_result || 'N/A',
    ].join('\n');

    navigator.clipboard.writeText(md).then(() => {
      toast.success('Copied to clipboard! (Markdown format)');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }

  const isAI = aiStatus?.aiAvailable;
  const isBugAI = bugAIStatus?.aiAvailable;

  if (loading) {
    return (
      <>
        <div className="page-header"><h2>Loading...</h2></div>
        <div className="loading-center"><div className="spinner" /></div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <div className="page-header"><h2>Project not found</h2></div>
        <div className="page-body">
          <Link to="/projects" className="btn btn-secondary"><ArrowLeft size={16} /> Back to Projects</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/projects" className="btn-icon"><ArrowLeft size={20} /></Link>
          <div>
            <h2>{project.name}</h2>
            <p>{project.description || 'No description'}</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple"><FlaskConical size={24} /></div>
            <div className="stat-info">
              <h4>{project.testRuns?.length || 0}</h4>
              <p>Test Runs</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><FileText size={24} /></div>
            <div className="stat-info">
              <h4>{project.testCases?.length || 0}</h4>
              <p>Test Cases</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><Bug size={24} /></div>
            <div className="stat-info">
              <h4>{project.bugReports?.length || 0}</h4>
              <p>Bug Reports</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <button className="btn btn-primary" onClick={() => setShowRunModal(true)}>
            <Plus size={16} /> New Test Run
          </button>
          <button className="btn btn-danger" onClick={() => setShowBugModal(true)}>
            <Bug size={16} /> New Bug Report
          </button>
          <button className="btn btn-success" onClick={handleExport}>
            <Download size={16} /> Export Test Cases
          </button>
        </div>

        {/* Test Runs */}
        <div className="card mb-6">
          <div className="card-header">
            <h3>Test Runs</h3>
          </div>
          {project.testRuns?.length === 0 ? (
            <div className="empty-state">
              <FlaskConical size={40} />
              <h3>No test runs yet</h3>
              <p>Create a test run to auto-generate test cases</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Requirement</th>
                    <th>Test Cases</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="w-120">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.testRuns.map((run) => (
                    <tr key={run.id}>
                      <td>#{run.id}</td>
                      <td className="max-w-300">
                        <div className="truncate max-w-300">
                          {run.requirement}
                        </div>
                      </td>
                      <td>{run.test_case_count}</td>
                      <td><span className={`badge ${statusBadge(run.status)}`}>{run.status}</span></td>
                      <td className="text-sm text-secondary">
                        {new Date(run.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link to={`/test-runs/${run.id}`} className="btn btn-sm btn-secondary">
                            <ArrowRight size={14} />
                          </Link>
                          <button className="btn-icon" onClick={() => setDeleteConfirm({ type: 'run', id: run.id, name: `Test Run #${run.id}` })}>
                            <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bug Reports */}
        <div className="card">
          <div className="card-header">
            <h3>Bug Reports</h3>
          </div>
          {project.bugReports?.length === 0 ? (
            <div className="empty-state">
              <Bug size={40} />
              <h3>No bug reports</h3>
              <p>Bug reports linked to this project will appear here</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="w-120">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.bugReports.map((bug) => (
                    <tr key={bug.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedBug({ ...bug })}>
                      <td>#{bug.id}</td>
                      <td><strong>{bug.title}</strong></td>
                      <td><span className={`badge ${severityBadge(bug.severity)}`}>{bug.severity}</span></td>
                      <td><span className={`badge ${severityBadge(bug.priority)}`}>{bug.priority}</span></td>
                      <td><span className={`badge ${statusBadge(bug.status)}`}>{bug.status}</span></td>
                      <td className="text-sm text-secondary">
                        {new Date(bug.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setSelectedBug({ ...bug }); }}>
                            <ArrowRight size={14} />
                          </button>
                          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'bug', id: bug.id, name: bug.title }); }}>
                            <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="confirm-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm Delete</h4>
            <p>Delete "{deleteConfirm.name}"? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                if (deleteConfirm.type === 'run') handleDeleteRun(deleteConfirm.id);
                else handleDeleteBug(deleteConfirm.id);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Test Run Modal */}
      {showRunModal && (
        <div className="modal-overlay" onClick={() => resetModal()}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Test Run</h3>
              <button className="btn-icon" onClick={() => resetModal()}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateRun}>
              <div className="modal-body">
                {/* AI Banner */}
                <div className={`ai-banner ${isAI ? 'ai-active' : 'ai-inactive'}`} style={{ marginBottom: 16 }}>
                  {isAI ? (
                    <>
                      <Sparkles size={16} className="text-purple" />
                      <span><strong className="text-purple">AI Mode Active</strong> — Test cases will be generated with Google Gemini.</span>
                    </>
                  ) : (
                    <>
                      <Cpu size={16} className="text-amber" />
                      <span><strong className="text-amber">Deterministic Mode</strong> — AI is not active. Add your API key in <Link to="/settings">Settings</Link>.</span>
                    </>
                  )}
                </div>

                {/* Requirement */}
                <div className="form-group">
                  <label className="label-with-tooltip">
                    Requirement Text *
                    <span className="tooltip-trigger">
                      <HelpCircle size={15} />
                      <span className="tooltip-content">
                        <strong>Tips for better AI results:</strong>
                        <ul>
                          <li>Specify the page or feature you want to test</li>
                          <li>Name UI elements explicitly (button names, field labels)</li>
                          <li>Describe expected behaviors and business rules</li>
                          <li>Mention user roles if applicable (admin, member, guest)</li>
                          <li>Include error scenarios you want covered</li>
                          <li>Upload a screenshot for visual AI analysis</li>
                        </ul>
                      </span>
                    </span>
                  </label>
                  <textarea
                    className="form-control"
                    placeholder="e.g. User should be able to login with email and password, show error for invalid credentials... (Paste screenshots with Ctrl+V)"
                    rows={4}
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    autoFocus
                  />
                  {requirement.length > 0 && (
                    <div className="char-counter">{requirement.length} characters</div>
                  )}
                </div>

                {/* Platform & URL */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Platform</label>
                    <select
                      className="form-control"
                      value={platform}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlatform(val);
                        if (val !== 'Web') setUrl('');
                      }}
                    >
                      <option value="Web">Web</option>
                      <option value="Mobile">Mobile</option>
                      <option value="API">API</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>URL {platform === 'Web'
                      ? <span>(for DOM extraction)</span>
                      : <span>(only available for Web)</span>
                    }</label>
                    <input
                      className="form-control"
                      type="url"
                      placeholder={platform === 'Web' ? 'https://example.com/login' : 'Not available for this platform'}
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={platform !== 'Web'}
                    />
                  </div>
                </div>

                {/* Screenshots */}
                <div className="form-group">
                  <label className="flex items-center gap-2">
                    <ImageIcon size={14} />
                    Screenshots
                    {isAI && <span className="text-purple text-sm">(AI will analyze all images)</span>}
                    {!isAI && <span>(optional)</span>}
                    <span className="text-sm text-secondary">— max {MAX_IMAGES}, paste with Ctrl+V</span>
                  </label>
                  <input
                    className="form-control"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                  />
                  {imagePreviews.length > 0 && (
                    <div className="image-preview-grid" style={{ marginTop: 10 }}>
                      {imagePreviews.map((preview, idx) => (
                        <div key={idx} className="image-preview-item">
                          <img src={preview} alt={`Screenshot ${idx + 1}`} onClick={() => setLightboxImg(preview)} />
                          <button className="image-remove-btn" onClick={() => removeImage(idx)} type="button">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <div className="image-counter">{images.length}/{MAX_IMAGES} images</div>
                    </div>
                  )}
                </div>
              </div>
              {submitting && (
                <div style={{ padding: '0 24px 16px' }}>
                  <StepProgress steps={runProgressEvents} mode="testCases" error={runProgressError} />
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => resetModal()}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {isAI ? <Sparkles size={16} /> : <FlaskConical size={16} />}
                  {submitting ? 'Generating...' : (isAI ? 'Generate with AI' : 'Create & Generate Tests')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Bug Report Modal */}
      {showBugModal && (
        <div className="modal-overlay" onClick={() => resetBugModal()}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Bug Report</h3>
              <button className="btn-icon" onClick={() => resetBugModal()}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* AI Banner */}
              <div className={`ai-banner ${isBugAI ? 'ai-active' : 'ai-inactive'}`} style={{ marginBottom: 16 }}>
                {isBugAI ? (
                  <>
                    <Sparkles size={16} className="text-purple" />
                    <span><strong className="text-purple">AI Mode Active</strong> — Bug reports will be generated with Google Gemini.</span>
                  </>
                ) : (
                  <>
                    <Cpu size={16} className="text-amber" />
                    <span><strong className="text-amber">Deterministic Mode</strong> — AI is not active. Add your API key in <Link to="/settings">Settings</Link>.</span>
                  </>
                )}
              </div>

              {!bugReport ? (
                <>
                  {/* Error Description */}
                  <div className="form-group">
                    <label className="label-with-tooltip">
                      Error Description *
                      <span className="tooltip-trigger">
                        <HelpCircle size={15} />
                        <span className="tooltip-content">
                          <strong>Tips for better bug reports:</strong>
                          <ul>
                            <li>Describe what you were doing when the bug occurred</li>
                            <li>Mention error messages or codes you saw</li>
                            <li>Specify which page or feature is affected</li>
                            <li>Note if the bug is consistent or intermittent</li>
                            <li>Upload a screenshot for visual AI analysis</li>
                          </ul>
                        </span>
                      </span>
                    </label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="e.g. Login button not working after entering valid credentials. Page shows a 500 error... (Paste screenshots with Ctrl+V)"
                      value={bugDesc}
                      onChange={(e) => setBugDesc(e.target.value)}
                      autoFocus
                    />
                    {bugDesc.length > 0 && (
                      <div className="char-counter">{bugDesc.length} characters</div>
                    )}
                  </div>

                  {/* Screenshots */}
                  <div className="form-group">
                    <label className="flex items-center gap-2">
                      <ImageIcon size={14} />
                      Screenshots
                      {isBugAI && <span className="text-purple text-sm">(AI will analyze)</span>}
                      <span className="text-sm text-secondary">— max {MAX_IMAGES}, paste with Ctrl+V</span>
                    </label>
                    <input
                      className="form-control"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleBugImageChange}
                    />
                    {bugImagePreviews.length > 0 && (
                      <div className="image-preview-grid" style={{ marginTop: 10 }}>
                        {bugImagePreviews.map((preview, idx) => (
                          <div key={idx} className="image-preview-item">
                            <img src={preview} alt={`Bug screenshot ${idx + 1}`} onClick={() => setLightboxImg(preview)} />
                            <button className="image-remove-btn" onClick={() => removeBugImage(idx)} type="button">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <div className="image-counter">{bugImages.length}/{MAX_IMAGES} images</div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Generated Report - Editable Form */}
                  {bugReport.metadata && (
                    <div className="metadata-bar" style={{ marginBottom: 16 }}>
                      <span>
                        {bugReport.metadata.engine === 'gemini-ai' ? <Sparkles size={14} className="text-purple" /> : <Bug size={14} />}
                        Engine: <strong>{bugReport.metadata.engine === 'gemini-ai' ? 'Gemini AI' : 'Rule-based'}</strong>
                      </span>
                      {bugReport.metadata.executionTimeMs && <span>Time: <strong>{bugReport.metadata.executionTimeMs}ms</strong></span>}
                      {bugReport.metadata.multimodal && (
                        <span className="text-purple"><strong>{bugReport.metadata.imageCount} images analyzed</strong></span>
                      )}
                    </div>
                  )}

                  <div className="form-group">
                    <label>Title</label>
                    <input
                      className="form-control"
                      value={bugReport.title || ''}
                      onChange={(e) => handleNewBugFieldChange('title', e.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Severity</label>
                      <select className="form-control" value={bugReport.severity || 'Medium'} onChange={(e) => handleNewBugFieldChange('severity', e.target.value)}>
                        <option>Critical</option>
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Priority</label>
                      <select className="form-control" value={bugReport.priority || 'Medium'} onChange={(e) => handleNewBugFieldChange('priority', e.target.value)}>
                        <option>Critical</option>
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select className="form-control" value={bugReport.status || 'Open'} onChange={(e) => handleNewBugFieldChange('status', e.target.value)}>
                        <option>Open</option>
                        <option>In Progress</option>
                        <option>Resolved</option>
                        <option>Closed</option>
                      </select>
                    </div>
                  </div>

                  {bugReport.environment && (
                    <div className="form-group">
                      <label>Environment</label>
                      <input className="form-control" value={bugReport.environment} onChange={(e) => handleNewBugFieldChange('environment', e.target.value)} />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Steps to Reproduce</label>
                    <textarea className="form-control" rows={5} value={bugReport.steps_to_reproduce || ''} onChange={(e) => handleNewBugFieldChange('steps_to_reproduce', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>Actual Result</label>
                    <textarea className="form-control" rows={3} value={bugReport.actual_result || ''} onChange={(e) => handleNewBugFieldChange('actual_result', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>Expected Result</label>
                    <textarea className="form-control" rows={3} value={bugReport.expected_result || ''} onChange={(e) => handleNewBugFieldChange('expected_result', e.target.value)} />
                  </div>

                  {bugReport.additional_notes && (
                    <div className="form-group">
                      <label>Additional Notes</label>
                      <textarea className="form-control" rows={3} value={bugReport.additional_notes} onChange={(e) => handleNewBugFieldChange('additional_notes', e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>
            {generatingBug && (
              <div style={{ padding: '0 24px 16px' }}>
                <StepProgress steps={bugProgressEvents} mode="bugReport" error={bugProgressError} />
              </div>
            )}
            <div className="modal-footer">
              {!bugReport ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => resetBugModal()}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={handleGenerateBug} disabled={generatingBug}>
                    {isBugAI ? <Sparkles size={16} /> : <Bug size={16} />}
                    {generatingBug ? 'Generating...' : (isBugAI ? 'Generate with AI' : 'Generate Bug Report')}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={handleCopyNewBug}>
                    <Copy size={14} /> Copy to Clipboard
                  </button>
                  <div className="flex gap-2" style={{ marginLeft: 'auto' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setBugReport(null)}>Back</button>
                    <button type="button" className="btn btn-success" onClick={handleSaveNewBug} disabled={savingNewBug || savedNewBug}>
                      <Save size={14} /> {savedNewBug ? 'Saved!' : savingNewBug ? 'Saving...' : 'Save to Project'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bug Detail Modal */}
      {selectedBug && (
        <div className="modal-overlay" onClick={() => setSelectedBug(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bug Report #{selectedBug.id}</h3>
              <button className="btn-icon" onClick={() => setSelectedBug(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input
                  className="form-control"
                  value={selectedBug.title || ''}
                  onChange={(e) => handleBugFieldChange('title', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Severity</label>
                  <select
                    className="form-control"
                    value={selectedBug.severity || 'Medium'}
                    onChange={(e) => handleBugFieldChange('severity', e.target.value)}
                  >
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    className="form-control"
                    value={selectedBug.priority || 'Medium'}
                    onChange={(e) => handleBugFieldChange('priority', e.target.value)}
                  >
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-control"
                    value={selectedBug.status || 'Open'}
                    onChange={(e) => handleBugFieldChange('status', e.target.value)}
                  >
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                    <option>Closed</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Steps to Reproduce</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={selectedBug.steps_to_reproduce || ''}
                  onChange={(e) => handleBugFieldChange('steps_to_reproduce', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Actual Result</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={selectedBug.actual_result || ''}
                  onChange={(e) => handleBugFieldChange('actual_result', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Expected Result</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={selectedBug.expected_result || ''}
                  onChange={(e) => handleBugFieldChange('expected_result', e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCopyBug}>
                <Copy size={14} /> Copy to Clipboard
              </button>
              <div className="flex gap-2" style={{ marginLeft: 'auto' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedBug(null)}>Close</button>
                <button type="button" className="btn btn-success" onClick={handleSaveBug} disabled={savingBug}>
                  <Save size={14} /> {savingBug ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Preview" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
