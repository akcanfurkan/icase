import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Download, Save, Info, CheckCircle, AlertTriangle, Sparkles, Cpu, Image as ImageIcon, HelpCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  getProjects, generateTestCases, generateTestCasesStream, saveTestRun, getAIStatus,
} from '../api/client';
import StepProgress from '../components/StepProgress';

const PAGE_SIZE = 15;

export default function GenerateTests() {
  const [projects, setProjects] = useState([]);
  const [requirement, setRequirement] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [platform, setPlatform] = useState('Web');
  const [url, setUrl] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [validation, setValidation] = useState(null);
  const [domInfo, setDomInfo] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiStatus, setAIStatus] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [progressEvents, setProgressEvents] = useState([]);
  const [progressError, setProgressError] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
    getAIStatus().then(setAIStatus).catch(() => setAIStatus({ aiAvailable: false }));
  }, []);

  useEffect(() => {
    if (!lightboxImg) return;
    function handleKey(e) {
      if (e.key === 'Escape') setLightboxImg(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxImg]);

  const MAX_IMAGES = 5;

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
    const newImages = [...images, ...toAdd];
    setImages(newImages);

    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleImageChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      addImages(e.target.files);
    }
    e.target.value = '';
  }

  function removeImage(index) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePaste(e) {
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
      addImages(imageFiles);
    }
  }

  async function handleGenerate() {
    if (!requirement.trim()) return toast.error('Please enter a requirement');
    setGenerating(true);
    setSaved(false);
    setProgressEvents([]);
    setProgressError(null);
    try {
      const formData = new FormData();
      formData.append('requirement', requirement);
      formData.append('platform', platform);
      if (url.trim()) formData.append('url', url.trim());
      images.forEach((img) => formData.append('images', img));

      const result = await generateTestCasesStream(formData, (event) => {
        setProgressEvents((prev) => [...prev, event]);
      });
      const cases = result.testCases || result;
      setTestCases(cases);
      setMetadata(result.metadata || null);
      setValidation(result.validation || null);
      setDomInfo(result.domData || null);
      setCurrentPage(1);
      toast.success(`${cases.length} test cases generated!`);
    } catch (err) {
      setProgressError(err.message);
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!selectedProject) return toast.error('Please select a project to save');
    if (testCases.length === 0) return toast.error('Generate test cases first');
    setSaving(true);
    try {
      const result = await saveTestRun({
        project_id: selectedProject,
        requirement,
        url: url || null,
        testCases,
      });
      toast.success(`Saved! Test Run #${result.id} — ${result.testCases?.length || testCases.length} test cases`);
      setSaved(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    if (testCases.length === 0) return toast.error('Generate test cases first');

    try {
      const data = testCases.map((tc, i) => ({
        'ID': tc.id || i + 1,
        'Feature': tc.feature,
        'Title': tc.title,
        'Preconditions': tc.preconditions,
        'Steps': tc.steps,
        'Expected': tc.expected,
        'Priority': tc.priority,
        'Type': tc.type,
        'Platform': tc.platform || platform,
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

      XLSX.writeFile(workbook, 'test-cases.xlsx');
      toast.success('Excel file downloaded!');
    } catch (err) {
      toast.error('Failed to export Excel');
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
    const map = {
      'Fonksiyonel': 'badge-functional', 'Negatif': 'badge-negative', 'Guvenlik': 'badge-security',
      'Sinir Deger': 'badge-boundary', 'Kullanilabilirlik': 'badge-usability', 'Arayuz': 'badge-ui',
      'Performans': 'badge-performance', 'Durum Gecisi': 'badge-high', 'Hata Yonetimi': 'badge-critical',
      'Dogrulama': 'badge-medium', 'Erisilebilirlik': 'badge-low', 'Uyumluluk': 'badge-info',
      'Functional': 'badge-functional', 'Negative': 'badge-negative', 'Security': 'badge-security',
      'Boundary': 'badge-boundary', 'Usability': 'badge-usability', 'UI': 'badge-ui',
      'Performance': 'badge-performance',
    };
    return map[type] || 'badge-info';
  }

  const isAI = aiStatus?.aiAvailable;

  return (
    <>
      <div className="page-header">
        <h2>Generate Test Cases</h2>
        <p>Generate intelligent test cases using requirements, URL, or screenshots</p>
      </div>

      <div className="page-body">
        {/* AI Status Banner */}
        <div className={`ai-banner ${isAI ? 'ai-active' : 'ai-inactive'}`}>
          {isAI ? (
            <>
              <Sparkles size={18} className="text-purple" />
              <span><strong className="text-purple">AI Mode Active</strong> — Generating smart test cases with Google Gemini. Upload a screenshot for visual analysis.</span>
            </>
          ) : (
            <>
              <Cpu size={18} className="text-amber" />
              <span><strong className="text-amber">Deterministic Mode</strong> — AI is not active. Add your Gemini API key in <Link to="/settings">Settings</Link> to enable AI mode.</span>
            </>
          )}
        </div>

        <div className="card mb-6">
          <div className="card-body">
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
                rows={4}
                placeholder="e.g. User should be able to login with email and password, show error for invalid credentials, remember me option... (Paste screenshots with Ctrl+V)"
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                onPaste={handlePaste}
              />
              {requirement.length > 0 && (
                <div className="char-counter">{requirement.length} characters</div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Project <span>(for saving)</span></label>
                <select
                  className="form-control"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
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
                onPaste={handlePaste}
              />
              {imagePreviews.length > 0 && (
                <div className="image-preview-grid">
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

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {isAI ? <Sparkles size={16} /> : <FlaskConical size={16} />}
                {generating
                  ? 'Generating...'
                  : (isAI ? 'Generate with AI' : 'Generate Test Cases')
                }
              </button>
              {testCases.length > 0 && !generating && (
                <>
                  <button className="btn btn-success" onClick={handleSave} disabled={saving || saved}>
                    <Save size={16} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Project'}
                  </button>
                  <button className="btn btn-secondary" onClick={handleExport}>
                    <Download size={16} /> Export Excel
                  </button>
                </>
              )}
            </div>
            {generating && (
              <StepProgress steps={progressEvents} mode="testCases" error={progressError} />
            )}
          </div>
        </div>

        {/* Intelligence Metadata */}
        {metadata && (
          <div className="metadata-bar">
            <span>
              {metadata.aiMode ? <Sparkles size={14} className="text-purple" /> : <Info size={14} />}
              Engine: <strong>{metadata.engine === 'gemini-ai' ? 'Gemini AI' : 'Deterministic'}</strong>
            </span>
            {metadata.model && <span>Model: <strong>{metadata.model}</strong></span>}
            <span>Platform: <strong>{metadata.platform}</strong></span>
            <span>Total: <strong>{metadata.totalCases} cases</strong></span>
            {(metadata.executionTimeMs || metadata.pipelineTimeMs) && (
              <span>Time: <strong>{metadata.pipelineTimeMs || metadata.executionTimeMs}ms</strong></span>
            )}
            {metadata.multimodal && (
              <span className="text-purple"><strong>{metadata.imageCount ? `${metadata.imageCount} images analyzed` : 'Image analyzed'}</strong></span>
            )}
            {metadata.domExtracted && (
              <span className="text-emerald"><strong>DOM extracted</strong></span>
            )}
            {domInfo?.pageTitle && (
              <span>Page: <strong>{domInfo.pageTitle}</strong></span>
            )}
            {validation && (
              validation.valid ? (
                <span style={{ color: 'var(--success)' }}>
                  <CheckCircle size={14} />
                  <strong>All cases verified</strong>
                </span>
              ) : (
                <span style={{ color: 'var(--warning)' }}>
                  <AlertTriangle size={14} />
                  <strong>{validation.errors.length} cases need review</strong>
                </span>
              )
            )}
          </div>
        )}

        {/* Results */}
        {testCases.length > 0 && (() => {
          const totalPages = Math.ceil(testCases.length / PAGE_SIZE);
          const paginated = testCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
          const startIdx = (currentPage - 1) * PAGE_SIZE;

          function goToPage(page) {
            setCurrentPage(page);
            if (tableRef.current) {
              tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }

          return (
            <div className="card" ref={tableRef}>
              <div className="card-header">
                <h3>Generated Test Cases ({testCases.length})</h3>
                {totalPages > 1 && (
                  <span className="text-sm text-secondary">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Feature</th>
                      <th>Title</th>
                      <th>Preconditions</th>
                      <th>Steps</th>
                      <th>Expected</th>
                      <th>Priority</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((tc, i) => (
                      <tr key={tc.id || startIdx + i}>
                        <td>{tc.id || startIdx + i + 1}</td>
                        <td><span className="badge badge-info">{tc.feature}</span></td>
                        <td><strong>{tc.title}</strong></td>
                        <td className="text-sm">{tc.preconditions}</td>
                        <td className="pre-wrap text-sm max-w-250">{tc.steps}</td>
                        <td className="text-sm max-w-200">{tc.expected}</td>
                        <td><span className={`badge ${badgeClassForPriority(tc.priority)}`}>{tc.priority}</span></td>
                        <td><span className={`badge ${badgeClassForType(tc.type)}`}>{tc.type}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <button disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={currentPage === page ? 'active' : ''}
                      onClick={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>
                    Next
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Preview" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
