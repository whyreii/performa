import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
});

// Request interceptor: attach JWT bearer token
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('performa_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      try {
        localStorage.removeItem('performa_token');
        localStorage.removeItem('performa_user');
      } catch {}
      window.dispatchEvent(new CustomEvent('performa:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Normalize FastAPI errors (including 422 detail list)
export function getApiErrorMessage(error, defaultMsg = 'An unexpected error occurred.') {
  if (!error) return defaultMsg;
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
    }
    return JSON.stringify(detail);
  }
  return error.message || defaultMsg;
}

// Authentication API methods
export const authApi = {
  login: async (email, password) => {
    const params = new URLSearchParams();
    params.append('username', email.trim());
    params.append('password', password);

    const response = await apiClient.post('/api/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data; // { access_token, token_type }
  },
  getCurrentUser: async () => {
    const response = await apiClient.get('/api/auth/me');
    return response.data; // UserResponse: { id, email, full_name, role, organization_id, is_active }
  },
  changePassword: async (currentPassword, newPassword) => {
    const response = await apiClient.post('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },
  updateProfile: async (payload) => {
    const response = await apiClient.patch('/api/auth/me', payload);
    return response.data;
  },
};

// KPI Rubric configuration API methods
export const kpiApi = {
  list: async () => {
    const response = await apiClient.get('/api/kpi-rubrics');
    return response.data;
  },
  update: async (competency, data) => {
    const response = await apiClient.put(`/api/kpi-rubrics/${competency}`, data);
    return response.data;
  },
  templates: async () => {
    const response = await apiClient.get('/api/kpi-rubrics/templates');
    return response.data;
  },
  reset: async () => {
    const response = await apiClient.post('/api/kpi-rubrics/reset');
    return response.data;
  },
};

// Employee API methods
export const employeeApi = {
  list: async (params = {}) => {
    const response = await apiClient.get('/api/employees/', { params });
    return response.data;
  },
  getMilestones: async () => {
    const response = await apiClient.get('/api/employees/milestones');
    return response.data;
  },
  listSupervisors: async () => {
    const response = await apiClient.get('/api/employees/supervisors');
    return response.data;
  },
  getById: async (id) => {
    const response = await apiClient.get(`/api/employees/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await apiClient.post('/api/employees/', data);
    return response.data;
  },
  updateStatus: async (id, status, reason) => {
    const payload = { status };
    if (reason) payload.reason = reason;
    const response = await apiClient.patch(`/api/employees/${id}/status`, payload);
    return response.data;
  },
  acknowledgeStandards: async (id) => {
    const response = await apiClient.post(`/api/employees/${id}/acknowledge-standards`);
    return response.data;
  },
};

// Evaluation & Scorecard API methods
export const evaluationApi = {
  getTenantAuditTrail: async () => {
    const response = await apiClient.get('/api/evaluations/audit-trail');
    return response.data;
  },
  getScorecard: async (employeeId) => {
    const response = await apiClient.get(`/api/evaluations/${employeeId}/scorecard`);
    return response.data;
  },
  getAuditTrail: async (employeeId) => {
    const response = await apiClient.get(`/api/evaluations/${employeeId}/audit-trail`);
    return response.data;
  },
  submitWeeklyRating: async (employeeId, data) => {
    const response = await apiClient.post(`/api/evaluations/${employeeId}/weekly`, data);
    return response.data;
  },
  getRiskExplanation: async (employeeId) => {
    const response = await apiClient.get(`/api/evaluations/${employeeId}/risk-explanation`);
    return response.data;
  },
  getTrend: async (employeeId) => {
    const response = await apiClient.get(`/api/evaluations/${employeeId}/trend`);
    return response.data;
  },
  getRegularization: async (employeeId) => {
    const response = await apiClient.get(
      `/api/evaluations/${employeeId}/regularization-recommendation`
    );
    return response.data;
  },
  generateRegularization: async (employeeId) => {
    const response = await apiClient.post(
      `/api/evaluations/${employeeId}/regularization-recommendation`
    );
    return response.data;
  },
  getReportHtml: async (employeeId) => {
    const response = await apiClient.get(`/api/evaluations/${employeeId}/report`, {
      responseType: 'text',
      headers: { Accept: 'text/html' },
    });
    return response.data;
  },
};

// Interventions & Rollups API methods
export const interventionApi = {
  listPending: async () => {
    const response = await apiClient.get('/api/interventions/pending');
    return response.data;
  },
  listMine: async () => {
    const response = await apiClient.get('/api/interventions/mine');
    return response.data;
  },
  signOff: async (planId, approved) => {
    const response = await apiClient.post(`/api/interventions/${planId}/sign-off`, { approved });
    return response.data;
  },
  generateRollup: async (employeeId, monthNumber) => {
    const response = await apiClient.post(
      `/api/interventions/${employeeId}/monthly-rollup?month_number=${monthNumber}`
    );
    return response.data;
  },
  listSummaries: async () => {
    const response = await apiClient.get('/api/interventions/summaries');
    return response.data;
  },
  listMySummaries: async () => {
    const response = await apiClient.get('/api/interventions/summaries/mine');
    return response.data;
  },
  dispatchSummary: async (summaryId) => {
    const response = await apiClient.post(`/api/interventions/summaries/${summaryId}/dispatch`);
    return response.data;
  },
  acknowledgeSummary: async (summaryId) => {
    const response = await apiClient.post(`/api/interventions/summaries/${summaryId}/acknowledge`);
    return response.data;
  },
};

// Notifications API methods
export const notificationApi = {
  list: async (params = {}) => {
    const response = await apiClient.get('/api/notifications', { params });
    return response.data;
  },
  markRead: async (id) => {
    const response = await apiClient.post(`/api/notifications/${id}/read`);
    return response.data;
  },
  markAllRead: async () => {
    const response = await apiClient.post('/api/notifications/read-all');
    return response.data;
  },
};

// Admin User Management API methods
export const adminApi = {
  listUsers: async () => {
    const response = await apiClient.get('/api/admin/users');
    return response.data;
  },
  createUser: async (data) => {
    const response = await apiClient.post('/api/admin/users', data);
    return response.data;
  },
  updateStatus: async (userId, isActive) => {
    const response = await apiClient.patch(`/api/admin/users/${userId}/status`, { is_active: isActive });
    return response.data;
  },
  resetPassword: async (userId, password) => {
    const response = await apiClient.post(`/api/admin/users/${userId}/reset-password`, { password });
    return response.data;
  },
  listActivity: async (params = {}) => {
    const response = await apiClient.get('/api/admin/activity', { params });
    return response.data;
  },
  getSettings: async () => {
    const response = await apiClient.get('/api/admin/settings');
    return response.data;
  },
  getReportsOverview: async () => {
    const response = await apiClient.get('/api/admin/reports/overview');
    return response.data;
  },
};

export default apiClient;

