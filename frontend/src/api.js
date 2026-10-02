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
  getById: async (id) => {
    const response = await apiClient.get(`/api/employees/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await apiClient.post('/api/employees/', data);
    return response.data;
  },
  updateStatus: async (id, status) => {
    const response = await apiClient.patch(`/api/employees/${id}/status`, { status });
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
};

// Interventions & Rollups API methods
export const interventionApi = {
  listPending: async () => {
    const response = await apiClient.get('/api/interventions/pending');
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
};

export default apiClient;
