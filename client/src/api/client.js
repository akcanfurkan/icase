const BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('qa_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...getAuthHeaders(),
      ...options.headers,
    },
    ...options,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('qa_token');
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(error.error || 'An error occurred');
  }

  if (res.headers.get('content-type')?.includes('spreadsheetml')) {
    return res.blob();
  }

  return res.json();
}

// Projects
export const getProjects = () => request('/projects');
export const getProject = (id) => request(`/projects/${id}`);
export const createProject = (data) => request('/projects', { method: 'POST', body: data });
export const updateProject = (id, data) => request(`/projects/${id}`, { method: 'PUT', body: data });
export const deleteProject = (id) => request(`/projects/${id}`, { method: 'DELETE' });

// Test Runs
export const getTestRuns = (projectId) => request(`/test-runs${projectId ? `?project_id=${projectId}` : ''}`);
export const getTestRun = (id) => request(`/test-runs/${id}`);
export const createTestRun = (formData) => request('/test-runs', { method: 'POST', body: formData });
export const saveTestRun = (data) => request('/test-runs/save', { method: 'POST', body: data });
export const updateTestRun = (id, data) => request(`/test-runs/${id}`, { method: 'PUT', body: data });
export const deleteTestRun = (id) => request(`/test-runs/${id}`, { method: 'DELETE' });

// Test Cases
export const getTestCases = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/test-cases${qs ? `?${qs}` : ''}`);
};
export const getTestCase = (id) => request(`/test-cases/${id}`);
export const getAIStatus = () => request('/test-cases/ai-status');
export const generateTestCases = (formData) =>
  request('/test-cases/generate', { method: 'POST', body: formData });
export const updateTestCase = (id, data) => request(`/test-cases/${id}`, { method: 'PUT', body: data });
export const deleteTestCase = (id) => request(`/test-cases/${id}`, { method: 'DELETE' });
export const exportTestCases = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const blob = await request(`/test-cases/export${qs ? `?${qs}` : ''}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test-cases.xlsx';
  a.click();
  URL.revokeObjectURL(url);
};

// Bug Reports
export const getBugReports = (projectId) => request(`/bug-reports${projectId ? `?project_id=${projectId}` : ''}`);
export const getBugReport = (id) => request(`/bug-reports/${id}`);
export const getBugAIStatus = () => request('/bug-reports/ai-status');
export const generateBugReport = (formData) => request('/bug-reports/generate', { method: 'POST', body: formData });
export const createBugReport = (data) => request('/bug-reports', { method: 'POST', body: data });
export const updateBugReport = (id, data) => request(`/bug-reports/${id}`, { method: 'PUT', body: data });
export const deleteBugReport = (id) => request(`/bug-reports/${id}`, { method: 'DELETE' });

// Settings
export const getSettings = () => request('/settings');
export const saveApiKey = (apiKey) => request('/settings/api-key', { method: 'PUT', body: { apiKey } });
export const removeApiKey = () => request('/settings/api-key', { method: 'DELETE' });

// SSE stream helpers
async function streamRequest(url, formData, onProgress) {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (res.status === 401) {
    localStorage.removeItem('qa_token');
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(error.error || 'An error occurred');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ') && eventType) {
        try {
          const data = JSON.parse(line.slice(6));
          if (eventType === 'progress' && onProgress) {
            onProgress(data);
          } else if (eventType === 'complete') {
            result = data;
          } else if (eventType === 'error') {
            throw new Error(data.error || 'Generation failed');
          }
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
        eventType = null;
      }
    }
  }

  if (!result) throw new Error('No result received from server');
  return result;
}

export const generateTestCasesStream = (formData, onProgress) =>
  streamRequest('/test-cases/generate-stream', formData, onProgress);

export const generateBugReportStream = (formData, onProgress) =>
  streamRequest('/bug-reports/generate-stream', formData, onProgress);

export const createTestRunStream = (formData, onProgress) =>
  streamRequest('/test-runs/stream', formData, onProgress);
