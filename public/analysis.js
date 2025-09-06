import { updateAuthUI, fetchWatchlist, addToWatchlist, removeFromWatchlist, startCountdown, stopCountdown, countdownIntervalId, watchlist, lastAlertSent, mutedUntil, triggerAlert } from './utils.js';
// import { initLogin } from './login.js'; // Re-add import for initLogin
// import { initSignup } from './signup.js'; // Re-add import for initSignup

document.addEventListener('DOMContentLoaded', () => {
  const symbolInput = document.getElementById('symbol');
  const analyzeBtn = document.getElementById('analyze-btn');
  const addWatchlistBtn = document.getElementById('add-watchlist-btn');
  const analyzeWatchlistBtn = document.getElementById('analyze-watchlist-btn');
  const userSection = document.getElementById('user-section');
  const logoutBtn = document.getElementById('logout-btn');
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
  const muteMa200CrossoverUpAlertsCheckbox = document.getElementById('muteMa200CrossoverUpAlerts');
  const muteMa200CrossoverDownAlertsCheckbox = document.getElementById('muteMa200CrossoverDownAlerts');

  // let watchlist = []; // This should be managed in utils.js if shared, otherwise local
  let analysisIntervalId = null;
  // let countdownIntervalId = null; // Moved to utils.js
  // let timeLeft = 0; // Moved to utils.js
  // const alertCooldownMinutes = 5; // Now configured via UI
  // const lastAlertSent = {}; // Stores timestamps of last sent alerts: { symbol_type: timestamp } - Moved to utils.js
  // const mutedUntil = {}; // Stores timestamps until an alert type for a symbol is muted: { symbol_alertType: unmuteTimestamp } - Moved to utils.js

  // function updateAuthUI(isLoggedIn, username) { ... } // Moved to utils.js
  // function renderWatchlist() { ... } // Moved to utils.js
  // async function fetchWatchlist() { ... } // Moved to utils.js
  // async function addToWatchlist(input) { ... } // Moved to utils.js
  // async function removeFromWatchlist(symbol) { ... } // Moved to utils.js

  async function analyzeSymbols(symbols, duration = 0, lookbackDays = 1) {
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
    lookbackDays = parseFloat(crossoverLookbackDaysInput.value);
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

      console.log('[Frontend] Raw response object:', response);
      console.log('[Frontend] Response status:', response.status, response.statusText);
      console.log('[Frontend] Is response.ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Frontend] Server responded with an error status:', response.status, errorText);
        error.classList.remove('hidden');
        error.textContent = `Server error (${response.status}): ${errorText || 'Unknown error'}`; // Display server error message
        loading.classList.add('hidden');
        return; // Exit function if response is not ok
      }

      const responseText = await response.text(); // Read raw response text
      console.log('[Frontend] Raw response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText); // Manually parse JSON
        console.log('[Frontend] Parsed JSON data:', data);
      } catch (jsonError) {
        console.error('[Frontend] Error parsing JSON response:', jsonError, responseText);
        error.classList.remove('hidden');
        error.textContent = `Error: Invalid JSON response from server. Details: ${jsonError.message}`;
        loading.classList.add('hidden');
        return;
      }

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
      console.error('[Frontend] Error connecting to server or processing response:', err);
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
            muteMa200CrossoverUpAlertsCheckbox.checked, // Using specific mute for this related alert
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
            muteMa200CrossoverDownAlertsCheckbox.checked, // Using specific mute for this related alert
            `ALERT: ${stock.symbol} Price Crossover Below 200-Day MA!`,
            `<p>Stock: ${stock.symbol}</p><p>Previous Close: $${previousClose}</p><p>Current Price: $${currentPrice}</p><p>200-Day MA: $${sma200}</p><p>Action: Price moved from above to below 200-Day MA.</p>`
          );
      }

      // New logic for MA200 Crossover Up Lookback alert
      if (stock.quote?.ma200CrossoverUpLookback) {
        triggerAlert(
          stock.symbol,
          'MA200_Crossover_Up_Lookback',
          muteMa200CrossoverUpAlertsCheckbox.checked, // Using specific mute for this related alert
          `ALERT: ${stock.symbol} Crossover Above 200-Day MA in last ${lookbackDays} days!`,
          `<p>Stock: ${stock.symbol}</p><p>Action: Price crossed above 200-Day MA within last ${lookbackDays} days.</p>${stock.quote.ma200CrossoverUpDate ? `<p>Date: ${stock.quote.ma200CrossoverUpDate}</p>` : ''}`
        );
      }

      // New logic for MA200 Crossover Down Lookback alert
      if (stock.quote?.ma200CrossoverDownLookback) {
        triggerAlert(
          stock.symbol,
          'MA200_Crossover_Down_Lookback',
          muteMa200CrossoverDownAlertsCheckbox.checked, // Using specific mute for this related alert
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

  // loginBtn.addEventListener('click', async () => { ... }) // Moved to login.js
  // signupBtn.addEventListener('click', async () => { ... }) // Moved to signup.js

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

  // showLoginBtn.addEventListener('click', () => { ... }) // Moved to login.js
  // showSignupBtn.addEventListener('click', () => { ... }) // Moved to signup.js

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

  // function startCountdown(duration) { ... } // Moved to utils.js
  // function stopCountdown() { ... } // Moved to utils.js
  // async function sendEmailAlert(symbol, subject, body) { ... } // Moved to utils.js
  // function triggerAlert(symbol, type, muteCheckboxState, subject, body) { ... } // Moved to utils.js

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
  }
  
  // Initialize login and signup functionality
  // initLogin(); 
  // initSignup();
});