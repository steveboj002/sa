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

  let watchlist = [];

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
      loginUsername.value = '';
      loginPassword.value = '';
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

  async function analyzeSymbols(symbols) {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    results.classList.add('hidden');
    results.innerHTML = '';
    error.textContent = '';

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
            resultDiv.innerHTML = `
              <h2 class="text-xl font-semibold mb-2">Results for ${stock.companyName} (${stock.symbol})</h2>
              <p class="text-sm text-gray-500 mb-4">As of 04:59 PM EDT, August 25, 2025</p>
              ${stock.companyNameError ? `<p class="text-red-500">Company Name Error: ${stock.companyNameError}</p>` : ''}
              <div id="quote-section-${stock.symbol}" class="mb-4 ${stock.quote ? '' : 'hidden'}">
                <h3 class="text-lg font-medium">Stock Quote</h3>
                ${stock.quoteError ? `<p class="text-red-500">Quote Error: ${stock.quoteError}</p>` : ''}
                <p>Current Price: $${stock.quote?.price || 'N/A'}</p>
                <p>Change: ${stock.quote?.change || 'N/A'} (${stock.quote?.changePercent || 'N/A'}%)</p>
                <p>Open: $${stock.quote?.open || 'N/A'}</p>
                <p>High: $${stock.quote?.high || 'N/A'}</p>
                <p>Low: $${stock.quote?.low || 'N/A'}</p>
                <p>Previous Close: $${stock.quote?.previousClose || 'N/A'}</p>
                <p>Percent from 50-Day MA: ${stock.quote?.percentFrom50DayMA || 'N/A'}% ${stock.sma50Error ? `<span class="text-red-500">(${stock.sma50Error})</span>` : ''}</p>
                <p>Percent from 200-Day MA: ${stock.quote?.percentFrom200DayMA || 'N/A'}% ${stock.sma200Error ? `<span class="text-red-500">(${stock.sma200Error})</span>` : ''}</p>
                <p>Volume Comparison to 20-Day Average: ${stock.quote?.volumeComparison || 'N/A'}% ${stock.volumeError ? `<span class="text-red-500">(${stock.volumeError})</span>` : ''}</p>
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
    }
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
    analyzeSymbols(symbols);
  });

  addWatchlistBtn.addEventListener('click', () => {
    const input = symbolInput.value.trim();
    addToWatchlist(input);
  });

  analyzeWatchlistBtn.addEventListener('click', () => {
    if (watchlist.length > 0) {
      analyzeSymbols(watchlist);
    } else {
      error.classList.remove('hidden');
      error.textContent = 'Watchlist is empty. Add symbols first.';
    }
  });

  watchlistDiv.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-watchlist-btn')) {
      const symbol = e.target.dataset.symbol;
      removeFromWatchlist(symbol);
    } else if (e.target.classList.contains('analyze-single-btn')) {
      const symbol = e.target.dataset.symbol;
      analyzeSymbols([symbol]);
    }
  });

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