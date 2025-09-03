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

  let watchlist = [];
  let analysisIntervalId = null;
  let countdownIntervalId = null;
  let timeLeft = 0;

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

    try {
      const response = await fetch(`/analyze?symbols=${symbols.join(',')}&provider=${providerSelect.value}`, {
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
            displayStockData(stock);
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

  function displayStockData(stock) {
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
      }

      let ma200ColorClass = '';
      if (!isNaN(percent200Day) && percent200Day >= -tolerance && percent200Day <= tolerance) {
          ma200ColorClass = 'text-green-600 font-semibold';
      }

      let volumeComparisonColorClass = '';
      const volumeComparison = parseFloat(stock.quote?.volumeComparison);
      if (!isNaN(volumeComparison) && Math.abs(volumeComparison) > volumeTolerance) {
          volumeComparisonColorClass = 'text-green-600 font-semibold';
      }

      let priceChangeColorClass = '';
      const changePercent = parseFloat(stock.quote?.changePercent);
      if (!isNaN(changePercent) && Math.abs(changePercent) > priceChangeTolerance) {
          priceChangeColorClass = 'text-green-600 font-semibold';
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

    analyzeSymbols(symbolsToAnalyze, intervalMinutes * 60);

    analysisIntervalId = setInterval(() => {
      analyzeSymbols(symbolsToAnalyze, intervalMinutes * 60);
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