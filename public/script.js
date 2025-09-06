document.addEventListener('DOMContentLoaded', () => {
  const symbolInput = document.getElementById('symbol');
  const analyzeBtn = document.getElementById('analyze-btn');
  const addWatchlistBtn = document.getElementById('add-watchlist-btn');
  const analyzeWatchlistBtn = document.getElementById('analyze-watchlist-btn');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const userSection = document.getElementById('user-section');
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const showLoginBtn = document.getElementById('show-login-btn');
  const showSignupBtn = document.getElementById('show-signup-btn');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const signupUsername = document.getElementById('signup-username');
  const signupPassword = document.getElementById('signup-password');
  const userGreeting = document.getElementById('user-greeting');
  const analysisSection = document.getElementById('analysis-section');
  const watchlistSection = document.getElementById('watchlist-section');
  const watchlistDiv = document.getElementById('watchlist');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const results = document.getElementById('results');
  const providerSelect = document.getElementById('provider');
  const toleranceInput = document.getElementById('tolerance');
  const volumeToleranceInput = document.getElementById('volumeTolerance');
  const priceChangeToleranceInput = document.getElementById('priceChangeTolerance');
  const intervalInput = document.getElementById('interval');
  const stopAnalysisBtn = document.getElementById('stop-analysis-btn');
  const countdownTimer = document.getElementById('countdown-timer');
  const alertEmailInput = document.getElementById('alertEmail');
  const muteMaAlertsCheckbox = document.getElementById('muteMaAlerts');
  const muteVolumeAlertsCheckbox = document.getElementById('muteVolumeAlerts');
  const mutePriceChangeAlertsCheckbox = document.getElementById('mutePriceChangeAlerts');
  const alertCooldownInput = document.getElementById('alertCooldown');
  const crossoverLookbackDaysInput = document.getElementById('crossoverLookbackDays');

  let watchlist = [];
  let analysisIntervalId = null;
  let countdownIntervalId = null;
  let timeLeft = 0;
  // const alertCooldownMinutes = 5; // Now configured via UI
  const lastAlertSent = {}; // Stores timestamps of last sent alerts: { symbol_type: timestamp }
  const mutedUntil = {}; // Stores timestamps until an alert type for a symbol is muted: { symbol_alertType: unmuteTimestamp }

  function updateAuthUI(isLoggedIn, username) {
    loginForm.classList.toggle('hidden', isLoggedIn);
    signupForm.classList.add('hidden');
    userSection.classList.toggle('hidden', !isLoggedIn);
    analysisSection.classList.toggle('hidden', !isLoggedIn);
    watchlistSection.classList.toggle('hidden', !isLoggedIn);
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
      // loginUsername.value = ''; // Temporarily commented out for pre-population
      // loginPassword.value = ''; // Temporarily commented out for pre-population
      signupUsername.value = '';
      signupPassword.value = '';
      error.classList.add('hidden');
    }
  }

  function renderWatchlist() {
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

  async function fetchWatchlist() {
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

  async function addToWatchlist(input) {
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

  async function removeFromWatchlist(symbol) {
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

  async function analyzeSymbols(symbols, duration = 0) {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    results.classList.add('hidden');
    results.innerHTML = '';
    error.textContent = '';
    stopCountdown(); // Stop countdown when analysis starts

    if (symbols.length === 0 || symbols.some(s => !/^[A-Z]{1,5}$/.test(s))) {
      loading.classList.add('hidden');
      error.classList.remove('hidden');
      error.textContent = 'Please enter valid stock symbols (1-5 uppercase letters, separated by commas, e.g., NVDA,ASTS).';
      return;
    }

    const intervalMinutes = parseFloat(intervalInput.value);
    if (isNaN(intervalMinutes) || intervalMinutes < 1) {
      error.classList.remove('hidden');
      error.textContent = 'Please enter a valid interval in minutes (minimum 1).';
      return;
    }
    const lookbackDays = parseFloat(crossoverLookbackDaysInput.value);
    if (isNaN(lookbackDays) || lookbackDays < 1 || lookbackDays > 365) {
        error.classList.remove('hidden');
        error.textContent = 'Please enter a valid number of lookback days (1-365).';
        return;
    }

    const apiUrl = `/analyze?symbols=${symbols.join(',')}&provider=${providerSelect.value}&lookbackDays=${lookbackDays}`;
    console.log('Fetching data from URL:', apiUrl);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();

      if (response.ok) {
        data.forEach(result => {
          const resultDiv = document.createElement('div');
          resultDiv.className = 'mb-6';
          if (result.error) {
            resultDiv.innerHTML = `
              <h2 class="text-xl font-semibold mb-2">Results for ${result.symbol}</h2>
              <p class="text-red-500">${result.error}</p>
            `;
          } else {
            const stock = result.data;
            displayStockData(stock, lookbackDays);
          }
          results.appendChild(resultDiv);
        });
        results.classList.remove('hidden');
      } else {
        error.classList.remove('hidden');
        error.textContent = data.error || 'Failed to fetch data. Check symbols or API key.';
      }
    } catch (err) {
      error.classList.remove('hidden');
      error.textContent = 'Error connecting to server. Please try again.';
    } finally {
      loading.classList.add('hidden');
      if (analysisIntervalId) {
        startCountdown(duration); // Restart countdown if continuous analysis is active
      }
    }
  }

  function displayStockData(stock, lookbackDays) {
      const stockDiv = document.createElement('div');
      stockDiv.className = 'bg-white p-4 rounded-lg shadow mb-4';

      const percent50Day = parseFloat(stock.quote?.percentFrom50DayMA);
      const percent200Day = parseFloat(stock.quote?.percentFrom200DayMA);
      const tolerance = parseFloat(toleranceInput.value);
      const volumeTolerance = parseFloat(volumeToleranceInput.value);
      const priceChangeTolerance = parseFloat(priceChangeToleranceInput.value);

      let ma50ColorClass = '';
      if (!isNaN(percent50Day) && percent50Day >= -tolerance && percent50Day <= tolerance) {
          ma50ColorClass = 'text-green-600 font-semibold';
          triggerAlert(
            stock.symbol,
            'MA50',
            muteMaAlertsCheckbox.checked,
            `Percent from 50-Day MA Alert: ${percent50Day}% within ${tolerance}%`,
            `<p>Stock: ${stock.symbol}</p><p>Percent from 50-Day MA: ${percent50Day}%</p><p>Tolerance: ${tolerance}%</p>`
          );
      }

      let ma200ColorClass = '';
      if (!isNaN(percent200Day) && percent200Day >= -tolerance && percent200Day <= tolerance) {
          ma200ColorClass = 'text-green-600 font-semibold';
          triggerAlert(
            stock.symbol,
            'MA200',
            muteMaAlertsCheckbox.checked,
            `Percent from 200-Day MA Alert: ${percent200Day}% within ${tolerance}%`,
            `<p>Stock: ${stock.symbol}</p><p>Percent from 200-Day MA: ${percent200Day}%</p><p>Tolerance: ${tolerance}%</p>`
          );
      }

      // New logic for MA200 Crossover Up alert
      const currentPrice = parseFloat(stock.quote?.price);
      const previousClose = parseFloat(stock.quote?.previousClose);
      const sma200 = parseFloat(stock.quote?.sma200);

      if (
          !isNaN(currentPrice) &&
          !isNaN(previousClose) &&
          !isNaN(sma200) &&
          previousClose < sma200 &&
          currentPrice > sma200
      ) {
          triggerAlert(
            stock.symbol,
            'MA200_Crossover_Up',
            muteMaAlertsCheckbox.checked, // Using MA mute for this related alert
            `ALERT: ${stock.symbol} Price Crossover Above 200-Day MA!`,
            `<p>Stock: ${stock.symbol}</p><p>Previous Close: $${previousClose}</p><p>Current Price: $${currentPrice}</p><p>200-Day MA: $${sma200}</p><p>Action: Price moved from below to above 200-Day MA.</p>`
          );
      }

      // New logic for MA200 Crossover Down alert
      if (
          !isNaN(currentPrice) &&
          !isNaN(previousClose) &&
          !isNaN(sma200) &&
          previousClose > sma200 &&
          currentPrice < sma200
      ) {
          triggerAlert(
            stock.symbol,
            'MA200_Crossover_Down',
            muteMaAlertsCheckbox.checked, // Using MA mute for this related alert
            `ALERT: ${stock.symbol} Price Crossover Below 200-Day MA!`,
            `<p>Stock: ${stock.symbol}</p><p>Previous Close: $${previousClose}</p><p>Current Price: $${currentPrice}</p><p>200-Day MA: $${sma200}</p><p>Action: Price moved from above to below 200-Day MA.</p>`
          );
      }

      // New logic for MA200 Crossover Up Lookback alert
      if (stock.quote?.ma200CrossoverUpLookback) {
        triggerAlert(
          stock.symbol,
          'MA200_Crossover_Up_Lookback',
          muteMaAlertsCheckbox.checked, // Using MA mute for this related alert
          `ALERT: ${stock.symbol} Crossover Above 200-Day MA in last ${lookbackDays} days!`,
          `<p>Stock: ${stock.symbol}</p><p>Action: Price crossed above 200-Day MA within last ${lookbackDays} days.</p>${stock.quote.ma200CrossoverUpDate ? `<p>Date: ${stock.quote.ma200CrossoverUpDate}</p>` : ''}`
        );
      }

      // New logic for MA200 Crossover Down Lookback alert
      if (stock.quote?.ma200CrossoverDownLookback) {
        triggerAlert(
          stock.symbol,
          'MA200_Crossover_Down_Lookback',
          muteMaAlertsCheckbox.checked, // Using MA mute for this related alert
          `ALERT: ${stock.symbol} Crossover Below 200-Day MA in last ${lookbackDays} days!`,
          `<p>Stock: ${stock.symbol}</p><p>Action: Price crossed below 200-Day MA within last ${lookbackDays} days.</p>${stock.quote.ma200CrossoverDownDate ? `<p>Date: ${stock.quote.ma200CrossoverDownDate}</p>` : ''}`
        );
      }

      let volumeComparisonColorClass = '';
      const volumeComparison = parseFloat(stock.quote?.volumeComparison);
      if (!isNaN(volumeComparison) && Math.abs(volumeComparison) > volumeTolerance) {
          volumeComparisonColorClass = 'text-green-600 font-semibold';
          triggerAlert(
            stock.symbol,
            'Volume',
            muteVolumeAlertsCheckbox.checked,
            `Volume Comparison Alert: ${volumeComparison}% > ${volumeTolerance}%`,
            `<p>Stock: ${stock.symbol}</p><p>Volume Comparison to 20-Day Average: ${volumeComparison}%</p><p>Tolerance: ${volumeTolerance}%</p>`
          );
      }

      let priceChangeColorClass = '';
      const changePercent = parseFloat(stock.quote?.changePercent);
      if (!isNaN(changePercent) && Math.abs(changePercent) > priceChangeTolerance) {
          priceChangeColorClass = 'text-green-600 font-semibold';
          triggerAlert(
            stock.symbol,
            'PriceChange',
            mutePriceChangeAlertsCheckbox.checked,
            `Price Change Alert: ${changePercent}% > ${priceChangeTolerance}%`,
            `<p>Stock: ${stock.symbol}</p><p>Percent Change: ${changePercent}%</p><p>Tolerance: ${priceChangeTolerance}%</p>`
          );
      }

      stockDiv.innerHTML = `
          <h2 class="text-xl font-semibold mb-2">Results for ${stock.companyName} (${stock.symbol})</h2>
          <p class="text-sm text-gray-500 mb-4">As of 04:59 PM EDT, August 25, 2025</p>
          ${stock.companyNameError ? `<p class="text-red-500">Company Name Error: ${stock.companyNameError}</p>` : ''}
          <div id="quote-section-${stock.symbol}" class="mb-4 ${stock.quote ? '' : 'hidden'}">
              <h3 class="text-lg font-medium">Stock Quote</h3>
              ${stock.quoteError ? `<p class="text-red-500">Quote Error: ${stock.quoteError}</p>` : ''}
              <p>Current Price: $${stock.quote?.price || 'N/A'}</p>
              <p class="${priceChangeColorClass}">Change: ${stock.quote?.change || 'N/A'} (${stock.quote?.changePercent || 'N/A'}%)</p>
              <p>Open: $${stock.quote?.open || 'N/A'}</p>
              <p>High: $${stock.quote?.high || 'N/A'}</p>
              <p>Low: $${stock.quote?.low || 'N/A'}</p>
              <p>Previous Close: $${stock.quote?.previousClose || 'N/A'}</p>
              <p class="${ma50ColorClass}">Percent from 50-Day MA: ${percent50Day || 'N/A'}% ${stock.sma50Error ? `<span class="text-red-500">(${stock.sma50Error})</span>` : ''}</p>
              <p class="${ma200ColorClass}">Percent from 200-Day MA: ${percent200Day || 'N/A'}% ${stock.sma200Error ? `<span class="text-red-500">(${stock.sma200Error})</span>` : ''}</p>
              <p class="${volumeComparisonColorClass}">Volume Comparison to 20-Day Average: ${volumeComparison || 'N/A'}% ${stock.volumeError ? `<span class="text-red-500">(${stock.volumeError})</span>` : ''}</p>
              <p>Price-Based Sentiment: ${stock.quote?.priceSentiment || 'N/A'}</p>
          </div>
          ${stock.quote?.ma200CrossoverUpLookback ? `<p class="text-purple-600 font-semibold">MA200 Crossover Up Detected on ${stock.quote.ma200CrossoverUpDate}</p>` : ''}
          ${stock.quote?.ma200CrossoverDownLookback ? `<p class="text-purple-600 font-semibold">MA200 Crossover Down Detected on ${stock.quote.ma200CrossoverDownDate}</p>` : ''}
          <div class="mb-4">
              <h3 class="text-lg font-medium">Mention Counts</h3>
              ${stock.newsError ? `<p class="text-red-500">News Error: ${stock.newsError}</p>` : ''}
              <p>Today's News Mentions: ${stock.mentions.today}</p>
              <p>Average Mentions (Last 20 Trading Days): ${stock.mentions.average}</p>
              <p>Comparison to Average: ${stock.mentions.comparison}</p>
          </div>
          <div class="mb-4">
              <h3 class="text-lg font-medium">Sentiment Analysis (Today)</h3>
              <p>Overall Score: ${stock.sentimentToday.score} (${stock.sentimentToday.classification})</p>
              <p>Positive: ${stock.sentimentToday.positive}%</p>
              <p>Negative: ${stock.sentimentToday.negative}%</p>
              <p>Neutral: ${stock.sentimentToday.neutral}%</p>
          </div>
          <div class="mb-4">
              <h3 class="text-lg font-medium">Sentiment Analysis (Last 20 Trading Days)</h3>
              <p>Overall Score: ${stock.sentimentAverage.score} (${stock.sentimentAverage.classification})</p>
              <p>Positive: ${stock.sentimentAverage.positive}%</p>
              <p>Negative: ${stock.sentimentAverage.negative}%</p>
              <p>Neutral: ${stock.sentimentAverage.neutral}%</p>
          </div>
      `;
      results.appendChild(stockDiv);
  }

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

  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.removeItem('token');
        updateAuthUI(false);
        error.classList.remove('hidden');
        error.textContent = 'Logged out successfully.';
      } else {
        error.classList.remove('hidden');
        error.textContent = data.error || 'Logout failed.';
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

  showSignupBtn.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    signupUsername.value = '';
    signupPassword.value = '';
    error.classList.add('hidden');
  });

  analyzeBtn.addEventListener('click', () => {
    const input = symbolInput.value.trim();
    const symbols = input ? input.split(',').map(s => s.trim().toUpperCase()).filter(s => s) : [];
    startOrStopAnalysis(symbols);
  });

  addWatchlistBtn.addEventListener('click', () => {
    const input = symbolInput.value.trim();
    addToWatchlist(input);
  });

  analyzeWatchlistBtn.addEventListener('click', () => {
    if (watchlist.length > 0) {
      startOrStopAnalysis(watchlist);
    } else {
      error.classList.remove('hidden');
      error.textContent = 'Watchlist is empty. Add symbols first.';
    }
  });

  stopAnalysisBtn.addEventListener('click', stopAnalysis);

  function startOrStopAnalysis(symbolsToAnalyze) {
    if (analysisIntervalId) {
      stopAnalysis();
      return;
    }

    const intervalMinutes = parseFloat(intervalInput.value);
    if (isNaN(intervalMinutes) || intervalMinutes < 1) {
      error.classList.remove('hidden');
      error.textContent = 'Please enter a valid interval in minutes (minimum 1).';
      return;
    }
    const lookbackDays = parseFloat(crossoverLookbackDaysInput.value);
    if (isNaN(lookbackDays) || lookbackDays < 1 || lookbackDays > 365) {
        error.classList.remove('hidden');
        error.textContent = 'Please enter a valid number of lookback days (1-365).';
        return;
    }

    analyzeSymbols(symbolsToAnalyze, intervalMinutes * 60, lookbackDays);

    analysisIntervalId = setInterval(() => {
      analyzeSymbols(symbolsToAnalyze, intervalMinutes * 60, lookbackDays);
    }, intervalMinutes * 60 * 1000);

    stopAnalysisBtn.classList.remove('hidden');
    analyzeBtn.textContent = 'Restart Analysis';
    analyzeWatchlistBtn.textContent = 'Restart Watchlist Analysis';
    startCountdown(intervalMinutes * 60);
  }

  function stopAnalysis() {
    if (analysisIntervalId) {
      clearInterval(analysisIntervalId);
      analysisIntervalId = null;
      stopAnalysisBtn.classList.add('hidden');
      analyzeBtn.textContent = 'Analyze';
      analyzeWatchlistBtn.textContent = 'Analyze Watchlist';
      error.classList.add('hidden'); // Clear any analysis-related errors
      loading.classList.add('hidden'); // Hide loading indicator
      stopCountdown();
    }
  }

  function startCountdown(duration) {
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
    }
    timeLeft = duration;
    countdownTimer.classList.remove('hidden');
    countdownTimer.textContent = `Next analysis in ${timeLeft} seconds`;

    countdownIntervalId = setInterval(() => {
      timeLeft--;
      if (timeLeft < 0) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
      } else {
        countdownTimer.textContent = `Next analysis in ${timeLeft} seconds`;
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
      countdownTimer.classList.add('hidden');
    }
  }

  async function sendEmailAlert(symbol, subject, body) {
    const recipientEmail = alertEmailInput.value.trim();
    if (!recipientEmail) {
      console.warn('No recipient email provided for alert.');
      return;
    }

    // Basic email validation
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
      const dateTimeString = now.toLocaleString(); // e.g., "10/27/2023, 10:30:00 AM"
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

  function triggerAlert(symbol, type, muteCheckboxState, subject, body) {
    const alertKey = `${symbol}_${type}`;
    const now = new Date().getTime();
    const lastSent = lastAlertSent[alertKey] || 0;
    const alertCooldownSeconds = parseFloat(alertCooldownInput.value);
    const cooldownMillis = (isNaN(alertCooldownSeconds) || alertCooldownSeconds < 1) ? (5 * 60 * 1000) : (alertCooldownSeconds * 1000);

    // Check if this specific alert type for this symbol is currently muted
    const isCurrentlyMuted = mutedUntil[alertKey] && mutedUntil[alertKey] > now;

    if (isCurrentlyMuted) {
      // If the user has explicitly turned OFF the mute checkbox, then unmute it now
      if (!muteCheckboxState) {
        delete mutedUntil[alertKey];
        delete lastAlertSent[alertKey]; // Clear cooldown when manually unmuted
        console.log(`Alert for ${symbol} (${type}) manually unmuted.`);
      } else {
        // Still muted, and user wants it muted (checkbox checked)
        console.log(`Alert for ${symbol} (${type}) is muted until ${new Date(mutedUntil[alertKey]).toLocaleTimeString()}.`);
        return; // Do not send email
      }
    }

    // Proceed with cooldown check
    if (now - lastSent > cooldownMillis) {
      sendEmailAlert(symbol, subject, body);
      lastAlertSent[alertKey] = now;

      // If the email was sent, and user has the mute checkbox checked, then mute until tomorrow
      if (muteCheckboxState) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0); // Set to midnight tomorrow UTC
          mutedUntil[alertKey] = tomorrow.getTime();
          console.log(`Alert for ${symbol} (${type}) muted until tomorrow: ${tomorrow.toLocaleDateString()} ${tomorrow.toLocaleTimeString()}`);
      } else {
          // If the checkbox is unchecked, ensure it's not marked as muted (in case it was previously muted and then the checkbox was unchecked)
          delete mutedUntil[alertKey];
      }
    } else {
      console.log(`Alert for ${symbol} (${type}) throttled. Next alert in ${Math.ceil((cooldownMillis - (now - lastSent)) / 1000)} seconds.`);
    }
  }

  watchlistDiv.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-watchlist-btn')) {
      const symbol = e.target.dataset.symbol;
      removeFromWatchlist(symbol);
    } else if (e.target.classList.contains('analyze-single-btn')) {
      const symbol = e.target.dataset.symbol;
      analyzeSymbols([symbol]);
    }
  });

  // Initial check for logged-in status and UI update
  if (localStorage.getItem('token')) {
    fetch('/user', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(response => response.json())
      .then(data => {
        if (response.ok) {
          updateAuthUI(true, data.username);
        } else {
          localStorage.removeItem('token');
          updateAuthUI(false);
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        updateAuthUI(false);
      });
  } else {
    updateAuthUI(false);
    loginForm.classList.remove('hidden');
  }
});