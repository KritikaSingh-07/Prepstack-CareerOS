const TOKEN_KEY = 'careeros_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('careeros:logout'));
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data.details);
  return data;
}

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  me: () => request('/auth/me'),

  getProfile: () => request('/profile'),
  updateProfile: (body) => request('/profile', { method: 'PUT', body }),

  jobFilters: () => request('/jobs/meta/filters'),
  recommendedJobs: (limit = 10) => request(`/jobs/recommended${qs({ limit })}`),
  searchJobs: (params) => request(`/jobs${qs(params)}`),
  getJob: (id) => request(`/jobs/${id}`),
  createJob: (body) => request('/jobs', { method: 'POST', body }),
  analyzeJob: (id, resumeId) => request(`/jobs/${id}/analyze`, { method: 'POST', body: { resumeId } }),
  jobAnalyses: (id) => request(`/jobs/${id}/analyses`),
  saveJob: (id) => request(`/jobs/${id}/save`, { method: 'POST' }),
  unsaveJob: (id) => request(`/jobs/${id}/save`, { method: 'DELETE' }),

  resumes: () => request('/resumes'),
  getResume: (id) => request(`/resumes/${id}`),
  uploadResume: (file, label, applyToProfile) => {
    const form = new FormData();
    form.append('resume', file);
    if (label) form.append('label', label);
    form.append('applyToProfile', String(applyToProfile));
    return request('/resumes/upload', { method: 'POST', form });
  },
  setPrimaryResume: (id) => request(`/resumes/${id}/primary`, { method: 'POST' }),
  compareResume: (id, jobId) => request(`/resumes/${id}/compare`, { method: 'POST', body: { jobId } }),
  tailorResume: (id, body) => request(`/resumes/${id}/tailor`, { method: 'POST', body }),
  deleteResume: (id) => request(`/resumes/${id}`, { method: 'DELETE' }),

  applications: () => request('/applications'),
  createApplication: (body) => request('/applications', { method: 'POST', body }),
  getApplication: (id) => request(`/applications/${id}`),
  updateApplication: (id, body) => request(`/applications/${id}`, { method: 'PATCH', body }),
  moveApplication: (id, stage, note) => request(`/applications/${id}/stage`, { method: 'PATCH', body: { stage, note } }),
  deleteApplication: (id) => request(`/applications/${id}`, { method: 'DELETE' }),

  learningTasks: () => request('/learning'),
  planLearning: (jobId) => request('/learning/plan', { method: 'POST', body: { jobId } }),
  updateLearningTask: (id, status) => request(`/learning/${id}`, { method: 'PATCH', body: { status } }),
  deleteLearningTask: (id) => request(`/learning/${id}`, { method: 'DELETE' }),

  copilotStatus: () => request('/copilot/status'),
  coverLetter: (appId) => request(`/copilot/${appId}/cover-letter`, { method: 'POST' }),
  projectSelection: (appId) => request(`/copilot/${appId}/projects`, { method: 'POST' }),
  bulletSuggestions: (appId) => request(`/copilot/${appId}/bullets`, { method: 'POST' }),
  checklist: (appId) => request(`/copilot/${appId}/checklist`, { method: 'POST' }),
  interviewPack: (appId) => request(`/copilot/${appId}/interview-pack`, { method: 'POST' }),

  insights: () => request('/insights'),
};
