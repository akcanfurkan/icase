import { useState, useEffect, useRef } from 'react';
import { Globe, ImageIcon, Sparkles, ShieldCheck, CheckCircle, Loader2, Circle, AlertTriangle } from 'lucide-react';

const STEP_CONFIG = {
  testCases: [
    { key: 'dom', label: 'DOM Extraction', icon: Globe },
    { key: 'image', label: 'Image Analysis', icon: ImageIcon },
    { key: 'ai', label: 'AI Test Generation', icon: Sparkles },
    { key: 'validation', label: 'Validation', icon: ShieldCheck },
  ],
  bugReport: [
    { key: 'image', label: 'Image Analysis', icon: ImageIcon },
    { key: 'ai', label: 'AI Bug Report Generation', icon: Sparkles },
    { key: 'validation', label: 'Validation', icon: ShieldCheck },
  ],
};

const TIPS = [
  'Detailed requirements produce higher quality test cases.',
  'Adding screenshots helps the AI understand the UI context better.',
  'The AI model analyzes both text and visual content simultaneously.',
  'You can paste images directly with Ctrl+V / Cmd+V.',
  'Each platform (Web, Mobile, API) generates platform-specific test scenarios.',
  'DOM extraction captures form fields, buttons, and page structure automatically.',
];

export default function StepProgress({ steps: stepEvents, mode = 'testCases', error = null }) {
  const config = STEP_CONFIG[mode] || STEP_CONFIG.testCases;
  const [elapsed, setElapsed] = useState(0);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(((Date.now() - startRef.current) / 1000));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIdx((prev) => (prev + 1) % TIPS.length);
    }, 6000);
    return () => clearInterval(tipTimer);
  }, []);

  const getStepStatus = (key) => {
    const events = (stepEvents || []).filter((e) => e.step === key);
    if (events.length === 0) return 'waiting';
    const last = events[events.length - 1];
    return last.status;
  };

  const getStepTime = (key) => {
    const events = (stepEvents || []).filter((e) => e.step === key && e.status === 'done');
    if (events.length === 0) return null;
    return events[0].timeMs;
  };

  const formatTime = (ms) => {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="step-progress">
      <div className="step-progress-steps">
        {config.map((step, i) => {
          const status = getStepStatus(step.key);
          const time = getStepTime(step.key);
          const Icon = step.icon;

          return (
            <div key={step.key} className={`step-progress-item step-${status}`}>
              <div className="step-progress-connector">
                {i > 0 && <div className={`step-line step-line-${status === 'waiting' ? 'waiting' : 'active'}`} />}
              </div>
              <div className="step-progress-icon">
                {status === 'done' && <CheckCircle size={20} />}
                {status === 'running' && <Loader2 size={20} className="step-spinner" />}
                {status === 'skipped' && <Circle size={20} className="step-skipped-icon" />}
                {status === 'waiting' && <Circle size={20} />}
              </div>
              <div className="step-progress-label">
                <span className="step-name">{step.label}</span>
                {status === 'skipped' && <span className="step-badge step-badge-skip">Skipped</span>}
                {status === 'running' && <span className="step-badge step-badge-active">In progress...</span>}
                {status === 'done' && time != null && <span className="step-time">{formatTime(time)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="step-progress-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="step-progress-footer">
        <div className="step-elapsed">
          <Loader2 size={14} className="step-spinner" />
          <span>Elapsed: {elapsed.toFixed(1)}s</span>
        </div>
        <div className="step-tip" key={tipIdx}>
          <span className="step-tip-label">Tip:</span> {TIPS[tipIdx]}
        </div>
      </div>
    </div>
  );
}
