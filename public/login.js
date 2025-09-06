import { updateAuthUI } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');
  const showLoginBtn = document.getElementById('show-login-btn');
  const error = document.getElementById('error');

  loginBtn.addEventListener('click', async () => {
    const username = loginUsername.value.trim();
    const password = loginPassword.value;
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        updateAuthUI(true, username);
        error.classList.remove('hidden');
        error.textContent = `Logged in as ${username}`;
      } else {
        error.classList.remove('hidden');
        error.textContent = data.error || 'Login failed.';
      }
    } catch (err) {
      error.classList.remove('hidden');
      error.textContent = 'Error connecting to server.';
    }
  });

  showLoginBtn.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    loginUsername.value = '';
    loginPassword.value = '';
    error.classList.add('hidden');
  });
});
