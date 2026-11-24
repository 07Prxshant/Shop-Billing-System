/**
 * Login Page Script (Vanilla JS)
 */

document.addEventListener('DOMContentLoaded', () => {
  // If already authenticated, redirect straight to dashboard
  auth.redirectIfAuthenticated();

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorBox = document.getElementById('error-box');
  const errorText = document.getElementById('error-text');
  const submitBtn = document.getElementById('submit-btn');
  const demoFillBtn = document.getElementById('demo-fill-btn');

  // Demo auto-fill helper
  if (demoFillBtn) {
    demoFillBtn.addEventListener('click', () => {
      emailInput.value = 'admin@shop.com';
      passwordInput.value = 'admin123';
      hideError();
    });
  }

  function showError(msg) {
    if (errorBox && errorText) {
      errorText.textContent = msg;
      errorBox.style.display = 'flex';
    } else {
      alert(msg);
    }
  }

  function hideError() {
    if (errorBox) {
      errorBox.style.display = 'none';
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email || !password) {
        showError('Please enter both email and password.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        const res = await api.post('/auth/login', { email, password });
        if (res.success && res.data) {
          auth.saveSession(res.data.token, res.data.user);
          window.location.href = 'index.html';
        } else {
          showError(res.message || 'Login failed.');
        }
      } catch (err) {
        showError(err.message || 'Invalid email or password.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Shop';
      }
    });
  }
});
