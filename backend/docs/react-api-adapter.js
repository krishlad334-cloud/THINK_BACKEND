/**
 * Drop-in API client for the OverThink React + Vite frontend (http://localhost:5173)
 * Save inside your React project as: src/lib/api.js
 * Set VITE_API_URL=http://localhost:5000/api in your React project's .env.local
 */
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_STORAGE_KEY = 'overthink_jwt_token';

export const getAuthToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

export const setAuthToken = (token) => {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({
    success: false,
    message: `Request failed with status ${response.status}`,
    data: null,
  }));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'API error');
  }

  return payload;
}

export const overthinkApi = {
  health: () => apiRequest('/health'),
  register: async (body) => {
    const res = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    if (res.data?.token) setAuthToken(res.data.token);
    return res;
  },
  login: async (body) => {
    const res = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    if (res.data?.token) setAuthToken(res.data.token);
    return res;
  },
  logout: () => setAuthToken(null),
  getMe: () => apiRequest('/auth/me'),
  updateMe: (body) => apiRequest('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  getConsultants: () => apiRequest('/auth/consultants'),
  submitThought: (body) => apiRequest('/thoughts', { method: 'POST', body: JSON.stringify(body) }),
  getMyThoughts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/thoughts/my${q ? `?${q}` : ''}`);
  },
  getThoughts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/thoughts${q ? `?${q}` : ''}`);
  },
  acceptThought: (id) => apiRequest(`/thoughts/${id}/accept`, { method: 'POST' }),
  updateThoughtStatus: (id, body) =>
    apiRequest(`/thoughts/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
  submitReply: (body) => apiRequest('/replies', { method: 'POST', body: JSON.stringify(body) }),
  getConversations: () => apiRequest('/conversations'),
  sendMessage: (convId, body) =>
    apiRequest(`/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  markConversationRead: (convId) =>
    apiRequest(`/conversations/${convId}/read`, { method: 'PATCH' }),
  deleteMessage: (convId, msgId) =>
    apiRequest(`/conversations/${convId}/messages/${msgId}`, { method: 'DELETE' }),
  getNotifications: () => apiRequest('/notifications'),
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'PATCH' }),
};
