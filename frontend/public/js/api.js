/**
 * API Client & Utility Helper (Vanilla JS)
 * Handles AJAX / fetch requests with JWT authentication header.
 */

const API_BASE = '/api';

const api = {
  /**
   * Get JWT token from browser localStorage
   */
  getToken() {
    return localStorage.getItem('token');
  },

  /**
   * Common request dispatcher using native fetch API
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      // Handle unauthorized session expiration
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('/login')) {
          window.location.href = 'login.html';
        }
        throw new Error(data.message || 'Session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: Request failed`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  /**
   * HTTP GET with optional query parameters object
   */
  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    const queryString = query.toString();
    const fullPath = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(fullPath, { method: 'GET' });
  },

  /**
   * HTTP POST with JSON body
   */
  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  /**
   * HTTP PUT with JSON body
   */
  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  /**
   * HTTP PATCH with JSON body
   */
  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  /**
   * HTTP DELETE
   */
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

/**
 * Format numeric value as Indian Rupees (Rs. 1,234.56)
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format ISO date string into DD MMM YYYY (e.g. 15 Nov 2026)
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Convert Date object to YYYY-MM-DD input format
 */
function toInputDateFormat(date = new Date()) {
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}
