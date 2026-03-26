import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSettings, saveApiKey, removeApiKey } from '../api/client';
import {
  Settings as SettingsIcon,
  Key,
  User,
  Mail,
  Save,
  Trash2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setSaving(true);
    try {
      const result = await saveApiKey(apiKeyInput.trim());
      setSettings({ hasApiKey: result.hasApiKey, apiKeyLast4: result.apiKeyLast4 });
      setApiKeyInput('');
      setShowKey(false);
      await refreshUser();
      toast.success('API key saved successfully!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!confirm('Are you sure you want to remove your API key?')) return;

    setRemoving(true);
    try {
      await removeApiKey();
      setSettings({ hasApiKey: false, apiKeyLast4: null });
      await refreshUser();
      toast.success('API key removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2><SettingsIcon size={24} /> Settings</h2>
        </div>
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2><SettingsIcon size={24} /> Settings</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Configure your profile and API preferences.
        </p>
      </div>

      {/* Profile Section */}
      <div className="card settings-section">
        <h3 className="settings-section-title">
          <User size={20} /> Profile
        </h3>
        <div className="settings-profile-grid">
          <div className="settings-field">
            <label><User size={14} /> Name</label>
            <div className="settings-value">{user?.name}</div>
          </div>
          <div className="settings-field">
            <label><Mail size={14} /> Email</label>
            <div className="settings-value">{user?.email}</div>
          </div>
        </div>
      </div>

      {/* API Key Section */}
      <div className="card settings-section">
        <h3 className="settings-section-title">
          <Key size={20} /> Gemini API Configuration
        </h3>
        <p className="settings-subtitle">
          Add your Google Gemini API key to enable AI-powered test case and bug report generation.
        </p>

        {/* Status */}
        <div className={`settings-status ${settings?.hasApiKey ? 'configured' : 'not-configured'}`}>
          {settings?.hasApiKey ? (
            <>
              <CheckCircle size={18} />
              <span>API key is configured (ending in ...{settings.apiKeyLast4})</span>
            </>
          ) : (
            <>
              <AlertCircle size={18} />
              <span>API key is not configured. AI features are disabled.</span>
            </>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSaveKey} className="settings-api-form">
          <label>
            {settings?.hasApiKey ? 'Update API Key' : 'Enter API Key'}
          </label>
          <div className="settings-api-input-row">
            <div className="input-with-icon" style={{ flex: 1 }}>
              <Key size={18} />
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={settings?.hasApiKey ? 'Enter new key to update...' : 'AIzaSy...'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <button
                type="button"
                className="settings-eye-btn"
                onClick={() => setShowKey(!showKey)}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving || !apiKeyInput.trim()}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            {settings?.hasApiKey && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRemoveKey}
                disabled={removing}
              >
                <Trash2 size={16} />
                {removing ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Guide Section */}
      <div className="card settings-section">
        <h3 className="settings-section-title">
          <Info size={20} /> How to Get a Gemini API Key
        </h3>
        <p className="settings-subtitle">
          Follow these steps to get your free Google Gemini API key:
        </p>

        <ol className="settings-guide-steps">
          <li>
            <strong>Go to Google AI Studio</strong>
            <p>
              Visit{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                aistudio.google.com/apikey <ExternalLink size={12} />
              </a>
            </p>
          </li>
          <li>
            <strong>Sign in with your Google account</strong>
            <p>Use any Gmail or Google Workspace account.</p>
          </li>
          <li>
            <strong>Click "Create API Key"</strong>
            <p>You'll see a button to create a new key. Click it.</p>
          </li>
          <li>
            <strong>Select or create a Google Cloud project</strong>
            <p>If you don't have one, Google will create a default project for you.</p>
          </li>
          <li>
            <strong>Copy your API key</strong>
            <p>The generated key will start with "AIza...". Copy it.</p>
          </li>
          <li>
            <strong>Paste it above and save</strong>
            <p>Enter the key in the field above and click Save.</p>
          </li>
        </ol>

        <div className="settings-guide-notes">
          <h4>Important Notes</h4>
          <ul>
            <li><strong>Free tier:</strong> 15 requests per minute, 1 million tokens per day — more than enough for most teams.</li>
            <li><strong>Security:</strong> Your API key is stored only on this server and never shared externally.</li>
            <li><strong>Team usage:</strong> Each team member should get their own API key for independent usage quotas.</li>
            <li><strong>Model used:</strong> Gemini 2.5 Flash — fast, multimodal, supports text + image analysis.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
