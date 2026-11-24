/**
 * Authentication & Session Management (Vanilla JS)
 */

const auth = {
  /**
   * Check if current user is logged in
   */
  isAuthenticated() {
    return Boolean(localStorage.getItem('token'));
  },

  /**
   * Get logged-in user details object
   */
  getUser() {
    try {
      const data = localStorage.getItem('user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Save session data upon successful login
   */
  saveSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  /**
   * Clear session and redirect to login page
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  },

  /**
   * Protect private pages. Call at top of authenticated HTML pages.
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
    }
  },

  /**
   * Redirect away from login page if already logged in
   */
  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = 'index.html';
    }
  }
};
