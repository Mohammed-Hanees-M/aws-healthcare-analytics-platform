import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── API Methods ──────────────────────────────────────────────────────────────

// Auth
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  register: (data) => api.post('/auth/register', data)
};

// Patients
export const patientsAPI = {
  getAll: (params) => api.get('/patients', { params }),
  getById: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
  addVitals: (id, data) => api.post(`/patients/${id}/vitals`, data),
  getVitals: (id, params) => api.get(`/patients/${id}/vitals`, { params })
};

// Analytics
export const analyticsAPI = {
  getSummary: () => api.get('/analytics/summary'),
  getVitalsTrend: (params) => api.get('/analytics/vitals-trend', { params }),
  getStatusDistribution: () => api.get('/analytics/status-distribution'),
  getAdmissionsTrend: (params) => api.get('/analytics/admissions-trend', { params }),
  getAnomalyStats: () => api.get('/analytics/anomaly-stats'),
  getWardOccupancy: () => api.get('/analytics/ward-occupancy')
};

// Anomalies
export const anomaliesAPI = {
  getAll: (params) => api.get('/anomalies', { params }),
  acknowledge: (id, data) => api.patch(`/anomalies/${id}/acknowledge`, data)
};

// Metrics
export const metricsAPI = {
  getSystem: () => api.get('/metrics/system')
};

export default api;
