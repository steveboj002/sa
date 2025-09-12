import { updateAuthUI, fetchWatchlist, addToWatchlist, removeFromWatchlist, startCountdown, stopCountdown, countdownIntervalId, watchlist, lastAlertSent, mutedUntil, triggerAlert } from './utils.js';
// import { Chart, TimeScale, registerables } from 'chart.js';
// import { MomentAdapter } from 'chartjs-adapter-moment';
// import moment from 'moment';

// Chart.register(...registerables, TimeScale, MomentAdapter);

document.addEventListener('DOMContentLoaded', () => {
  const symbolInput = document.getElementById('symbol');
  const analyzeBtn = document.getElementById('analyze-btn');
  const addWatchlistBtn = document.getElementById('add-watchlist-btn');
  const analyzeWatchlistBtn = document.getElementById('analyze-watchlist-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userGreeting = document.getElementById('user-greeting');
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

  let analysisIntervalId = null;

  // Moved analyzeSymbols function here for correct scoping and to fix previous accidental removal
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

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Frontend] Server responded with an error status:', response.status, errorText);
        error.classList.remove('hidden');
        error.textContent = `Server error (${response.status}): ${errorText || 'Unknown error'}`; // Display server error message
        loading.classList.add('hidden');
        return; // Exit function if response is not ok
      }

      const responseText = await response.text(); // Read raw response text

      let data;
      try {
        data = JSON.parse(responseText); // Manually parse JSON
      } catch (jsonError) {
        console.error('[Frontend] Error parsing JSON response:', jsonError, responseText);
        error.classList.remove('hidden');
        error.textContent = `Error: Invalid JSON response from server. Details: ${jsonError.message}`;
        loading.classList.add('hidden');
        return;
      }

      if (response.ok) {
        if (!Array.isArray(data)) {
          console.error('[Frontend] Expected an array of stock results, but received:', data);
          error.classList.remove('hidden');
          error.textContent = 'Error: Unexpected data format from server. Expected an array.';
          loading.classList.add('hidden');
          return;
        }
        data.forEach(result => {
          const resultDiv = document.createElement('div');
          resultDiv.className = 'mb-6';
          if (result.error) {
            console.warn(`[Frontend] Error in stock result for ${result.symbol}: ${result.error}`);
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
        console.error('[Frontend] Response not OK, handling error:', data);
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

  // Function to render the stock chart
  function renderStockChart(symbol, historicalPrices, historicalSMA50, historicalSMA200) {
    const ctx = document.getElementById(`stockChart-${symbol}`);
    if (!ctx) {
      console.warn(`Chart canvas not found for ${symbol}. Skipping chart render.`);
      return;
    }
    const chartContext = ctx.getContext('2d');

    const labels = historicalPrices.map(data => data.date);
    const prices = historicalPrices.map(data => data.close);
    const sma50 = historicalSMA50.map(data => data.sma);
    const sma200 = historicalSMA200.map(data => data.sma);

    new Chart(chartContext, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Close Price',
            data: prices,
            borderColor: 'blue',
            backgroundColor: 'transparent',
            borderWidth: 1,
            pointRadius: 0,
          },
          {
            label: '50-Day SMA',
            data: sma50,
            borderColor: 'green',
            backgroundColor: 'transparent',
            borderWidth: 1,
            pointRadius: 0,
          },
          {
            label: '200-Day SMA',
            data: sma200,
            borderColor: 'red',
            backgroundColor: 'transparent',
            borderWidth: 1,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${symbol} Stock Price with SMAs`,
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'month',
              tooltipFormat: 'MMM DD, YYYY',
            },
            title: {
              display: true,
              text: 'Date',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Price ($)',
            },
          },
        },
      },
    });
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
          <h2 class="text-2xl font-bold text-gray-800 mb-2">${stock.companyName}</h2>
          ${stock.timestamp ? `<p class="text-sm text-gray-600 mb-4">As of ${stock.timestamp}</p>` : ''}
          ${stock.companyNameError && stock.companyNameError !== 'No overview data available for this symbol' ? `<p class="text-red-500 mb-4">Company Name Error: ${stock.companyNameError}</p>` : ''}
          
          <div id="quote-section-${stock.symbol}" class="bg-gray-50 p-4 rounded-lg mb-4 ${stock.quote ? '' : 'hidden'}">
              <h3 class="text-lg font-semibold text-gray-700 mb-2">Stock Quote</h3>
              ${stock.quoteError ? `<p class="text-red-500 mb-2">Quote Error: ${stock.quoteError}</p>` : ''}
              <div class="grid grid-cols-2 gap-2 text-sm">
                <p>Current Price: <span class="font-medium">$${stock.quote?.price || 'N/A'}</span></p>
                <p class="${priceChangeColorClass}">Change: <span class="font-medium">${stock.quote?.change || 'N/A'} (${stock.quote?.changePercent || 'N/A'}%)</span></p>
                <p>Open: <span class="font-medium">$${stock.quote?.open || 'N/A'}</span></p>
                <p>High: <span class="font-medium">$${stock.quote?.high || 'N/A'}</span></p>
                <p>Low: <span class="font-medium">$${stock.quote?.low || 'N/A'}</span></p>
                <p>Previous Close: <span class="font-medium">$${stock.quote?.previousClose || 'N/A'}</span></p>
                <p class="${ma50ColorClass}">Price % From 50-Day MA: <span class="font-medium">${percent50Day !== undefined ? `${percent50Day}%` : 'N/A'}</span> ${stock.sma50Error ? `<span class="text-red-500 text-xs">(${stock.sma50Error})</span>` : ''}</p>
                <p class="${ma200ColorClass}">Price % From 200-Day MA: <span class="font-medium">${percent200Day !== undefined ? `${percent200Day}%` : 'N/A'}</span> ${stock.sma200Error ? `<span class="text-red-500 text-xs">(${stock.sma200Error})</span>` : ''}</p>
                <p class="${volumeComparisonColorClass}">Volume vs 20-Day Avg: <span class="font-medium">${volumeComparison !== undefined ? `${volumeComparison}%` : 'N/A'}</span> ${stock.volumeError ? `<span class="text-red-500 text-xs">(${stock.volumeError})</span>` : ''}</p>
                <p>Price-Based Sentiment: <span class="font-medium">${stock.quote?.priceSentiment || 'N/A'}</span></p>
              </div>
          </div>

          ${(stock.upcomingEvents && stock.upcomingEvents.length > 0) || (stock.recentPastEvents && stock.recentPastEvents.length > 0) ? `
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
              <h3 class="text-lg font-semibold text-gray-700 mb-2">Key Dates</h3>
              ${stock.upcomingEvents && stock.upcomingEvents.length > 0 ? `
                <h4 class="text-md font-medium text-gray-600 mb-1 mt-2">Upcoming Events:</h4>
                <ul class="list-disc list-inside ml-4">
                  ${stock.upcomingEvents.map(event => `<li>${event.type}: <span class="font-medium">${event.date}</span></li>`).join('')}
                </ul>
              ` : ''}
              ${stock.recentPastEvents && stock.recentPastEvents.length > 0 ? `
                <h4 class="text-md font-medium text-gray-600 mb-1 mt-2">Recent Past Events:</h4>
                <ul class="list-disc list-inside ml-4">
                  ${stock.recentPastEvents.map(event => `<li>${event.type}: <span class="font-medium">${event.date}</span></li>`).join('')}
                </ul>
              ` : ''}
            </div>
          ` : ''}

          ${(stock.quote?.ma200CrossoverUpLookback || stock.quote?.ma200CrossoverDownLookback) ? `
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
              <h3 class="text-lg font-semibold text-gray-700 mb-2">MA200 Crossovers</h3>
          ${stock.quote?.ma200CrossoverUpLookback ? `<p class="text-purple-600 font-semibold">MA200 Crossover Up Detected on ${stock.quote.ma200CrossoverUpDate}</p>` : ''}
          ${stock.quote?.ma200CrossoverDownLookback ? `<p class="text-purple-600 font-semibold">MA200 Crossover Down Detected on ${stock.quote.ma200CrossoverDownDate}</p>` : ''}
            </div>
          ` : ''}

          ${stock.newsError !== 'News sentiment not supported by yahoo-finance2' && stock.mentions && (stock.mentions.today > 0 || stock.mentions.average > 0 || stock.mentions.comparison !== 'N/A' || (stock.newsError && stock.newsError !== 'News sentiment not supported by yahoo-finance2')) ? `
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Mention Counts</h3>
                ${stock.newsError ? `<p class="text-red-500 mb-2">News Error: ${stock.newsError}</p>` : ''}
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <p>Today's News Mentions: <span class="font-medium">${stock.mentions.today}</span></p>
                  <p>Average Mentions (Last 20 Trading Days): <span class="font-medium">${stock.mentions.average}</span></p>
                  <p>Comparison to Average: <span class="font-medium">${stock.mentions.comparison}</span></p>
                </div>
            </div>
          ` : ''}

          ${stock.sentimentToday && stock.sentimentToday.score !== 'N/A' && stock.sentimentToday.score !== 0 ? `
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Sentiment Analysis (Today)</h3>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <p>Overall Score: <span class="font-medium">${stock.sentimentToday.score} (${stock.sentimentToday.classification})</span></p>
                  <p>Positive: <span class="font-medium">${stock.sentimentToday.positive}%</span></p>
                  <p>Negative: <span class="font-medium">${stock.sentimentToday.negative}%</span></p>
                  <p>Neutral: <span class="font-medium">${stock.sentimentToday.neutral}%</span></p>
                </div>
            </div>
          ` : ''}

          ${stock.sentimentAverage && stock.sentimentAverage.score !== 'N/A' && stock.sentimentAverage.score !== 0 ? `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Sentiment Analysis (Last 20 Trading Days)</h3>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <p>Overall Score: <span class="font-medium">${stock.sentimentAverage.score} (${stock.sentimentAverage.classification})</span></p>
                  <p>Positive: <span class="font-medium">${stock.sentimentAverage.positive}%</span></p>
                  <p>Negative: <span class="font-medium">${stock.sentimentAverage.negative}%</span></p>
                  <p>Neutral: <span class="font-medium">${stock.sentimentAverage.neutral}%</span></p>
                </div>
          </div>
          ` : ''}

          ${stock.quote?.historicalPrices && stock.quote?.historicalPrices.length > 0 &&
              stock.quote?.historicalSMA50 && stock.quote?.historicalSMA50.length > 0 &&
              stock.quote?.historicalSMA200 && stock.quote?.historicalSMA200.length > 0 ? `
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Stock Price Chart</h3>
                <div style="height: 400px;">
                    <canvas id="stockChart-${stock.symbol}"></canvas>
          </div>
          </div>
          ` : ''}
      `;
      results.appendChild(stockDiv);

      // Render the chart if historical data is available
      if (stock.quote.historicalPrices && stock.quote.historicalPrices.length > 0 &&
          stock.quote.historicalSMA50 && stock.quote.historicalSMA50.length > 0 &&
          stock.quote.historicalSMA200 && stock.quote.historicalSMA200.length > 0) {
        renderStockChart(stock.symbol, stock.quote.historicalPrices, stock.quote.historicalSMA50, stock.quote.historicalSMA200);
      }
  }

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

  watchlistDiv.addEventListener('click', (e) => {
    const analyzeButton = e.target.closest('.analyze-single-btn');
    const removeButton = e.target.closest('.remove-watchlist-btn');

    if (removeButton) {
      const symbol = removeButton.dataset.symbol;
      removeFromWatchlist(symbol);
    } else if (analyzeButton) {
      const symbol = analyzeButton.dataset.symbol;
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
  }
});
