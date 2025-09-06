import { updateAuthUI } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const loginForm = document.getElementById('login-form');
  const signupUsername = document.getElementById('signup-username');
  const signupPassword = document.getElementById('signup-password');
  const signupBtn = document.getElementById('signup-btn');
  const showSignupBtn = document.getElementById('show-signup-btn');
  const error = document.getElementById('error');

  signupBtn.addEventListener('click', async () => {
    const username = signupUsername.value.trim();
    const password = signupPassword.value;
    try {
      const response = await fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        updateAuthUI(true, username);
        error.classList.remove('hidden');
        error.textContent = `Signed up and logged in as ${username}`;
      } else {
        error.classList.remove('hidden');
        error.textContent = data.error || 'Signup failed.';
      }
    } catch (err) {
      error.classList.remove('hidden');
      error.textContent = 'Error connecting to server.';
    }
  });

  showSignupBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    signupUsername.value = '';
    signupPassword.value = '';
    error.classList.add('hidden');
  });
});
