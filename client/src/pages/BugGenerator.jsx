import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug, Save, RefreshCw, Sparkles, Cpu, Copy, CheckCircle, Image as ImageIcon, X, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProjects, generateBugReport, generateBugReportStream, createBugReport, getBugAIStatus } from '../api/client';
import StepProgress from '../components/StepProgress';

const MAX_IMAGES = 5;

export default function BugGenerator() {
  const [projects, setProjects] = useState([]);
  const [errorDesc, setErrorDesc] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiStatus, setAIStatus] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [progressEvents, setProgressEvents] = useState([]);
  const [progressError, setProgressError] = useState(null);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
    getBugAIStatus().then(setAIStatus).catch(() => setAIStatus({ aiAvailable: false }));
  }, []);

  useEffect(() => {
    if (!lightboxImg) return;
    function handleKey(e) {
      if (e.key === 'Escape') setLightboxImg(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxImg]);

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

  useEffect(() => {
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
  }, [images]);

  async function handleGenerate() {
    if (!errorDesc.trim()) return toast.error('Please describe the error');
    setGenerating(true);
    setSaved(false);
    setProgressEvents([]);
    setProgressError(null);
    try {
      const formData = new FormData();
      formData.append('error_description', errorDesc);
      images.forEach((img) => formData.append('images', img));

      const data = await generateBugReportStream(formData, (event) => {
        setProgressEvents((prev) => [...prev, event]);
      });
      setReport(data);
      toast.success('Bug report generated!');
    } catch (err) {
      setProgressError(err.message);
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!report) return;
    setSaving(true);
    try {
      await createBugReport({
        project_id: selectedProject || null,
        title: report.title,
        steps_to_reproduce: report.steps_to_reproduce,
        actual_result: report.actual_result,
        expected_result: report.expected_result,
        severity: report.severity,
        priority: report.priority,
      });
      toast.success('Bug report saved!');
      setSaved(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(field, value) {
    setReport({ ...report, [field]: value });
    setSaved(false);
  }

  function handleReset() {
    setErrorDesc('');
    setReport(null);
    setSaved(false);
    setSelectedProject('');
    setImages([]);
    setImagePreviews([]);
  }

  function handleCopyToClipboard() {
    if (!report) return;
    const md = [
      `## ${report.title}`,
      '',
      `**Severity:** ${report.severity}`,
      `**Priority:** ${report.priority}`,
      report.environment ? `**Environment:** ${report.environment}` : null,
      `**Status:** ${report.status || 'Open'}`,
      '',
      '### Steps to Reproduce',
      report.steps_to_reproduce,
      '',
      '### Actual Result',
      report.actual_result,
      '',
      '### Expected Result',
      report.expected_result,
      report.additional_notes ? `\n### Additional Notes\n${report.additional_notes}` : null,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(md).then(() => {
      toast.success('Copied to clipboard! (Markdown format)');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }

  const isAI = aiStatus?.aiAvailable;

  return (
    <>
      <div className="page-header">
        <h2>Bug Report Generator</h2>
        <p>Describe a bug and upload screenshots to auto-generate a professional QA bug report</p>
      </div>

      <div className="page-body">
        {/* AI Banner */}
        <div className={`ai-banner ${isAI ? 'ai-active' : 'ai-inactive'}`}>
          {isAI ? (
            <>
              <Sparkles size={18} className="text-purple" />
              <span><strong className="text-purple">AI Mode Active</strong> — Generating professional bug reports with Google Gemini. Upload screenshots for visual analysis.</span>
            </>
          ) : (
            <>
              <Cpu size={18} className="text-amber" />
              <span><strong className="text-amber">Deterministic Mode</strong> — AI is not active. Add your Gemini API key in <Link to="/settings">Settings</Link> to enable AI mode.</span>
            </>
          )}
        </div>

        {/* Input */}
        <div className="card mb-6">
          <div className="card-body">
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
                value={errorDesc}
                onChange={(e) => setErrorDesc(e.target.value)}
              />
              {errorDesc.length > 0 && (
                <div className="char-counter">{errorDesc.length} characters</div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Project <span>(optional, for linking)</span></label>
                <select
                  className="form-control"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="flex items-center gap-2">
                  <ImageIcon size={14} />
                  Screenshots
                  {isAI && <span className="text-purple text-sm">(AI will analyze)</span>}
                  <span className="text-sm text-secondary">— max {MAX_IMAGES}, paste with Ctrl+V</span>
                </label>
                <input
                  className="form-control"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {imagePreviews.length > 0 && (
              <div className="image-preview-grid" style={{ marginBottom: 12 }}>
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="image-preview-item">
                    <img src={preview} alt={`Bug screenshot ${idx + 1}`} onClick={() => setLightboxImg(preview)} />
                    <button className="image-remove-btn" onClick={() => removeImage(idx)} type="button">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="image-counter">{images.length}/{MAX_IMAGES} images</div>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-danger" onClick={handleGenerate} disabled={generating}>
                {isAI ? <Sparkles size={16} /> : <Bug size={16} />}
                {generating ? 'Generating...' : (isAI ? 'Generate with AI' : 'Generate Bug Report')}
              </button>
              {report && !generating && (
                <button className="btn btn-secondary" onClick={handleReset}>
                  <RefreshCw size={16} /> Reset
                </button>
              )}
            </div>
            {generating && (
              <StepProgress steps={progressEvents} mode="bugReport" error={progressError} />
            )}
          </div>
        </div>

        {/* Metadata */}
        {report?.metadata && (
          <div className="metadata-bar">
            <span>
              {report.metadata.engine === 'gemini-ai' ? <Sparkles size={14} className="text-purple" /> : <Bug size={14} />}
              Engine: <strong>{report.metadata.engine === 'gemini-ai' ? 'Gemini AI' : 'Rule-based'}</strong>
            </span>
            {report.metadata.model && <span>Model: <strong>{report.metadata.model}</strong></span>}
            {report.metadata.executionTimeMs && <span>Time: <strong>{report.metadata.executionTimeMs}ms</strong></span>}
            {report.metadata.multimodal && (
              <span className="text-purple"><strong>{report.metadata.imageCount} images analyzed</strong></span>
            )}
          </div>
        )}

        {/* Generated Report */}
        {report && (
          <div className="card">
            <div className="card-header">
              <h3>Generated Bug Report</h3>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-secondary" onClick={handleCopyToClipboard}>
                  <Copy size={14} /> Copy to Clipboard
                </button>
                <button className="btn btn-sm btn-success" onClick={handleSave} disabled={saving || saved}>
                  <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Report'}
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Title</label>
                <input
                  className="form-control"
                  value={report.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Severity</label>
                  <select
                    className="form-control"
                    value={report.severity}
                    onChange={(e) => handleFieldChange('severity', e.target.value)}
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
                    value={report.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
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
                    value={report.status || 'Open'}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                  >
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                    <option>Closed</option>
                  </select>
                </div>
              </div>

              {report.environment && (
                <div className="form-group">
                  <label>Environment</label>
                  <input
                    className="form-control"
                    value={report.environment}
                    onChange={(e) => handleFieldChange('environment', e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Steps to Reproduce</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={report.steps_to_reproduce}
                  onChange={(e) => handleFieldChange('steps_to_reproduce', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Actual Result</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={report.actual_result}
                  onChange={(e) => handleFieldChange('actual_result', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Expected Result</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={report.expected_result}
                  onChange={(e) => handleFieldChange('expected_result', e.target.value)}
                />
              </div>

              {report.additional_notes && (
                <div className="form-group">
                  <label>Additional Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={report.additional_notes}
                    onChange={(e) => handleFieldChange('additional_notes', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Preview" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
