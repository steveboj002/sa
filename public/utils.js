export let watchlist = [];
let analysisIntervalId = null;
export let countdownIntervalId = null;
export let timeLeft = 0;
// const alertCooldownMinutes = 5; // Now configured via UI
export const lastAlertSent = {}; // Stores timestamps of last sent alerts: { symbol_type: timestamp }
export const mutedUntil = {}; // Stores timestamps until an alert type for a symbol is muted: { symbol_alertType: unmuteTimestamp }

export function updateAuthUI(isLoggedIn, username) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const userSection = document.getElementById('user-section');
  
  // New dashboard panels
  const authSectionPanel = document.getElementById('auth-section-panel');
  const inputActionPanel = document.getElementById('input-action-panel');
  const watchlistPanel = document.getElementById('watchlist-panel');
  const settingsPanel = document.getElementById('settings-panel');
  const resultsAdsPanel = document.getElementById('results-ads-panel');

  const userGreeting = document.getElementById('user-greeting');
  const symbolInput = document.getElementById('symbol');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const signupUsername = document.getElementById('signup-username');
  const signupPassword = document.getElementById('signup-password');
  const error = document.getElementById('error');

  // Toggle visibility of auth forms and user section
  loginForm.classList.toggle('hidden', isLoggedIn);
  signupForm.classList.add('hidden'); // Always hide signup when updating auth UI
  userSection.classList.toggle('hidden', !isLoggedIn);

  // Toggle visibility of dashboard panels
  inputActionPanel.classList.toggle('hidden', !isLoggedIn);
  watchlistPanel.classList.toggle('hidden', !isLoggedIn);
  settingsPanel.classList.toggle('hidden', !isLoggedIn);
  resultsAdsPanel.classList.toggle('hidden', !isLoggedIn);
  authSectionPanel.classList.toggle('hidden', isLoggedIn); // Hide auth panel when logged in

  if (isLoggedIn) {
    userGreeting.textContent = `Logged in as ${username}`;
    symbolInput.value = '';
    loginUsername.value = '';
    loginPassword.value = '';
    signupUsername.value = '';
    signupPassword.value = '';
    error.classList.add('hidden');
    fetchWatchlist();
  } else {
    watchlist = [];
    renderWatchlist();
    signupUsername.value = '';
    signupPassword.value = '';
    error.classList.add('hidden');
  }
}

export function renderWatchlist() {
  const watchlistDiv = document.getElementById('watchlist');
  const analyzeWatchlistBtn = document.getElementById('analyze-watchlist-btn');
  watchlistDiv.innerHTML = '';
  if (watchlist.length === 0) {
    watchlistDiv.innerHTML = '<p class="text-gray-500">No symbols in watchlist.</p>';
  } else {
    watchlist.forEach(symbol => {
      const symbolDiv = document.createElement('div');
      symbolDiv.className = 'flex items-center bg-gray-200 px-2 py-1 rounded';
      symbolDiv.innerHTML = `
        <span class="mr-2">${symbol}</span>
        <button class="analyze-single-btn text-blue-500 hover:text-blue-700 mr-2" data-symbol="${symbol}">Analyze</button>
        <button class="remove-watchlist-btn text-red-500 hover:text-red-700" data-symbol="${symbol}">Remove</button>
      `;
      watchlistDiv.appendChild(symbolDiv);
    });
  }
  analyzeWatchlistBtn.classList.toggle('hidden', watchlist.length === 0);
}

export async function fetchWatchlist() {
  const error = document.getElementById('error');
  try {
    const response = await fetch('/watchlist', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await response.json();
    if (response.ok) {
      watchlist = data.watchlist || [];
      renderWatchlist();
    } else {
      error.classList.remove('hidden');
      error.textContent = data.error || 'Failed to fetch watchlist.';
    }
  } catch (err) {
    error.classList.remove('hidden');
    error.textContent = 'Error connecting to server.';
  }
}

export async function addToWatchlist(input) {
  const error = document.getElementById('error');
  const symbols = input ? input.split(',').map(s => s.trim().toUpperCase()).filter(s => s) : [];
  if (symbols.length === 0 || symbols.some(s => !/^[A-Z]{1,5}$/.test(s))) {
    error.classList.remove('hidden');
    error.textContent = 'Please enter valid stock symbols (1-5 uppercase letters, separated by commas, e.g., NVDA,ASTS).';
    return false;
  }
  try {
    const response = await fetch('/watchlist/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ symbols })
    });
    const data = await response.json();
    if (response.ok) {
      watchlist = data.watchlist;
      renderWatchlist();
      error.classList.remove('hidden');
      error.textContent = `Added ${symbols.filter(s => !data.existing.includes(s)).join(', ')} to watchlist.`;
      return true;
    } else {
      error.classList.remove('hidden');
      error.textContent = data.error || 'Failed to add to watchlist.';
      return false;
    }
  } catch (err) {
    error.classList.remove('hidden');
    error.textContent = 'Error connecting to server.';
    return false;
  }
}

export async function removeFromWatchlist(symbol) {
  const error = document.getElementById('error');
  try {
    const response = await fetch('/watchlist/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ symbol })
    });
    const data = await response.json();
    if (response.ok) {
      watchlist = data.watchlist;
      renderWatchlist();
      error.classList.remove('hidden');
      error.textContent = `Removed ${symbol} from watchlist.`;
    } else {
      error.classList.remove('hidden');
      error.textContent = data.error || 'Failed to remove from watchlist.';
    }
  } catch (err) {
    error.classList.remove('hidden');
    error.textContent = 'Error connecting to server.';
  }
}

export async function sendEmailAlert(symbol, subject, body) {
  const recipientEmail = document.getElementById('alertEmail').value.trim();
  const error = document.getElementById('error');

  if (!recipientEmail) {
    console.warn('No recipient email provided for alert.');
    return;
  }

  if (!/^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,6}$/.test(recipientEmail)) {
    console.error('Invalid email format for alert recipient.');
    error.classList.remove('hidden');
    error.textContent = 'Invalid email format for alert recipient.';
    return;
  }

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found for sending email alert.');
      error.classList.remove('hidden');
      error.textContent = 'Authentication required to send email alerts.';
      return;
    }

    const now = new Date();
    const dateTimeString = now.toLocaleString();
    const fullSubject = `${dateTimeString} - ${subject}`;

    const response = await fetch('/send-alert-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ recipientEmail, subject: fullSubject, body: `${body}<br/><br/>This alert was triggered for ${symbol}.` })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Failed to send email alert:', data.error);
      error.classList.remove('hidden');
      error.textContent = `Failed to send email alert for ${symbol}: ${data.error}`;
    } else {
      console.log(`Email alert sent successfully for ${symbol}`);
    }
  } catch (err) {
    console.error('Error sending email alert:', err);
    error.classList.remove('hidden');
    error.textContent = `Error sending email alert for ${symbol}.`;
  }
}

export function triggerAlert(symbol, type, muteCheckboxState, subject, body) {
  const alertKey = `${symbol}_${type}`;
  const now = new Date().getTime();
  const lastSent = lastAlertSent[alertKey] || 0;
  const alertCooldownSeconds = parseFloat(document.getElementById('alertCooldown').value);
  const cooldownMillis = (isNaN(alertCooldownSeconds) || alertCooldownSeconds < 1) ? (5 * 60 * 1000) : (alertCooldownSeconds * 1000);

  const isCurrentlyMuted = mutedUntil[alertKey] && mutedUntil[alertKey] > now;

  if (isCurrentlyMuted) {
    if (!muteCheckboxState) {
      delete mutedUntil[alertKey];
      delete lastAlertSent[alertKey];
      console.log(`Alert for ${symbol} (${type}) manually unmuted.`);
    } else {
      console.log(`Alert for ${symbol} (${type}) is muted until ${new Date(mutedUntil[alertKey]).toLocaleTimeString()}.`);
      return;
    }
  }

  if (now - lastSent > cooldownMillis) {
    sendEmailAlert(symbol, subject, body);
    lastAlertSent[alertKey] = now;

    if (muteCheckboxState) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        mutedUntil[alertKey] = tomorrow.getTime();
        console.log(`Alert for ${symbol} (${type}) muted until tomorrow: ${tomorrow.toLocaleDateString()} ${tomorrow.toLocaleTimeString()}`);
    } else {
        delete mutedUntil[alertKey];
    }
  } else {
    console.log(`Alert for ${symbol} (${type}) throttled. Next alert in ${Math.ceil((cooldownMillis - (now - lastSent)) / 1000)} seconds.`);
  }
}

export function startCountdown(duration) {
  const countdownTimer = document.getElementById('countdown-timer');
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
  }
  timeLeft = duration;
  countdownTimer.classList.remove('hidden');
  countdownTimer.textContent = `Next analysis in ${timeLeft} seconds`;

  countdownIntervalId = setInterval(() => {
    timeLeft--;
    if (timeLeft < 0) {
      timeLeft = 0; // Ensure timeLeft doesn't go below 0
    }

    if (timeLeft === 0) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null; // Set to null when countdown finishes
    }
    countdownTimer.textContent = `Next analysis in ${timeLeft} seconds`;
  }, 1000);
}

export function stopCountdown() {
  const countdownTimer = document.getElementById('countdown-timer');
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    timeLeft = 0; // Reset timeLeft when stopping
    countdownTimer.classList.add('hidden');
  }
}
