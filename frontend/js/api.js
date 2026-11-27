/**
 * OverThink Frontend API Client
 * Single source of truth for API_BASE_URL, JWT storage, and fetch helpers.
 */
(function (global) {
  const isLocalHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

  // Update the production URL below once your backend is deployed (e.g., Render or Railway)
  const API_BASE_URL = isLocalHost
    ? 'http://localhost:5000/api'
    : 'https://overthink-api.onrender.com/api';

  const TOKEN_KEY = 'overthink_jwt_token';
  const USER_KEY = 'overthink_auth_user';

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  const getStoredUser = () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  };

  const setSession = (token, user) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  /**
   * Perform a JSON fetch request with optional JWT Authorization header.
   */
  const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();
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
      message: `Server returned status ${response.status}`,
      data: null,
    }));

    if (!response.ok || payload.success === false) {
      const error = new Error(payload.message || 'Request failed');
      error.status = response.status;
      error.data = payload.data || null;
      throw error;
    }

    return payload;
  };

  const OverThinkAPI = {
    API_BASE_URL,
    getToken,
    getStoredUser,
    setSession,
    clearSession,

    healthCheck: () => apiRequest('/health'),

    register: async (body) => {
      const res = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.data?.token) {
        setSession(res.data.token, res.data.user);
      }
      return res;
    },

    login: async (body) => {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.data?.token) {
        setSession(res.data.token, res.data.user);
      }
      return res;
    },

    getMe: () => apiRequest('/auth/me'),

    logout: () => {
      clearSession();
    },

    submitThought: (body) =>
      apiRequest('/thoughts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    getMyThoughts: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/thoughts/my${query ? `?${query}` : ''}`);
    },

    getThoughtById: (id) => apiRequest(`/thoughts/${encodeURIComponent(id)}`),

    getThoughts: (params = {}) => {
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
      );
      const query = new URLSearchParams(cleanParams).toString();
      return apiRequest(`/thoughts${query ? `?${query}` : ''}`);
    },

    updateThoughtStatus: (id, status) =>
      apiRequest(`/thoughts/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    submitReply: (body) =>
      apiRequest('/replies', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    subscribeNewsletter: (body) =>
      apiRequest('/newsletter', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };

  global.OverThinkAPI = OverThinkAPI;
})(window);
