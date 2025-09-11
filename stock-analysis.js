const axios = require('axios');
const moment = require('moment');
const yahooFinance = require('yahoo-finance2').default;

// Dynamically import Polygon.io client for ESM compatibility (kept for future use)
let polygonClient;
async function initializePolygonClient() {
  if (!polygonClient) {
    const { restClient } = await import('@polygon.io/client-js');
    polygonClient = restClient(process.env.POLYGON_API_KEY, "https://api.polygon.io");
  }
  return polygonClient;
}

// Validate environment
if (!process.env.ALPHA_VANTAGE_API_KEY) {
  throw new Error('ALPHA_VANTAGE_API_KEY environment variable not set. Run: export ALPHA_VANTAGE_API_KEY=your_av_key');
}
if (!process.env.POLYGON_API_KEY) {
  throw new Error('POLYGON_API_KEY environment variable not set. Run: export POLYGON_API_KEY=your_polygon_key');
}
// Debug: Verify API key
if (process.env.POLYGON_API_KEY !== 'pSy_bKGg9lOgjghpt7ynjP5pRPhYygzp') {
  console.warn('POLYGON_API_KEY does not match expected value. Ensure .env matches the working curl key.');
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function getApiErrorMessage(response, defaultMessage) {
  if (response?.data?.Information) {
    return response.data.Information;
  } else if (response?.data?.['Error Message']) {
    return response.data['Error Message'];
  } else if (response?.data?.status === 'ERROR') {
    return response.data.error || defaultMessage;
  }
  return defaultMessage;
}

async function getCompanyOverview(symbol, apiKey, provider) {
  if (!symbol || !apiKey) return { error: 'Invalid symbol or API key for getCompanyOverview' };
  if (provider === 'alpha_vantage') {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`;
    try {
      console.log(`Fetching overview for ${symbol} with Alpha Vantage`);
      const response = await axios.get(url);
      await delay(12000);
      if (!response.data.Name) {
        console.warn(`No overview data for ${symbol}`);
        return { error: getApiErrorMessage(response, `No overview data returned for ${symbol}`) };
      }
      return { data: response.data.Name };
    } catch (error) {
      const errorMessage = error.response
        ? getApiErrorMessage(error.response, `Error fetching overview for ${symbol}: ${error.response.status || error.message}`)
        : `Error fetching overview for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  } else if (provider === 'yfinance') {
    try {
      console.log(`Fetching overview for ${symbol} with yahoo-finance2`);
      const info = await yahooFinance.quoteSummary(symbol, { modules: ['assetProfile'] });
      if (info && info.assetProfile && info.assetProfile.companyName) {
        await delay(1000); // Minimal delay for yahoo-finance2
        return { data: info.assetProfile.companyName };
      }
      return { error: 'No overview data available for this symbol' };
    } catch (error) {
      console.error(`Error fetching overview for ${symbol} with yahoo-finance2: ${error.message}`);
      return { error: `Error fetching overview: ${error.message}` };
    }
  } else if (provider === 'polygon') {
    try {
      console.log(`Fetching overview for ${symbol} with Polygon.io`);
      const response = await axios.get(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${apiKey}`);
      console.log(`Polygon.io overview response for ${symbol}:`, JSON.stringify(response.data, null, 2));
      await delay(1000);
      if (!response.data.results || !response.data.results.name) {
        console.warn(`No overview data for ${symbol}`);
        return { error: `No overview data returned for ${symbol}` };
      }
      return { data: response.data.results.name };
    } catch (error) {
      const errorMessage = error.response
        ? `Error fetching overview for ${symbol}: ${error.response.status || error.message}`
        : `Error fetching overview for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  }
}

async function getStockQuote(symbol, apiKey, provider) {
  if (!symbol || !apiKey) return { error: 'Invalid symbol or API key for getStockQuote' };
  if (provider === 'alpha_vantage') {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    try {
      console.log(`Fetching quote for ${symbol} with Alpha Vantage`);
      const response = await axios.get(url);
      const quote = response.data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        const errorMessage = getApiErrorMessage(response, `No quote data for ${symbol}`);
        console.warn(errorMessage);
        return { error: errorMessage };
      }
      await delay(12000);
      return { data: quote };
    } catch (error) {
      const errorMessage = error.response
        ? getApiErrorMessage(error.response, `Error fetching quote for ${symbol}: ${error.response.status || error.message}`)
        : `Error fetching quote for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  } else if (provider === 'yfinance') {
    try {
      console.log(`Fetching quote for ${symbol} with yahoo-finance2`);
      const quote = await yahooFinance.quote(symbol);
      if (quote && quote.regularMarketPrice) {
        await delay(1000);
        return {
          data: {
            '05. price': quote.regularMarketPrice.toFixed(2),
            '09. change': (quote.regularMarketPrice - (quote.regularMarketPreviousClose || 0)).toFixed(2),
            '10. change percent': ((quote.regularMarketPrice - (quote.regularMarketPreviousClose || 0)) / (quote.regularMarketPreviousClose || 1) * 100).toFixed(2),
            '02. open': quote.regularMarketOpen?.toFixed(2) || 'N/A',
            '03. high': quote.regularMarketDayHigh?.toFixed(2) || 'N/A',
            '04. low': quote.regularMarketDayLow?.toFixed(2) || 'N/A',
            '08. previous close': quote.regularMarketPreviousClose?.toFixed(2) || 'N/A'
          }
        };
      }
      return { error: 'No quote data available for this symbol' };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol} with yahoo-finance2: ${error.message}`);
      return { error: `Error fetching quote: ${error.message}` };
    }
  } else if (provider === 'polygon') {
    try {
      console.log(`Fetching quote for ${symbol} with Polygon.io`);
      const url = `https://api.polygon.io/v3/quotes/${symbol}?limit=1&apiKey=${apiKey}`;
      const response = await axios.get(url);
      console.log(`Polygon.io quote response for ${symbol}:`, JSON.stringify(response.data, null, 2));
      await delay(1000);
      if (!response.data.results || response.data.results.length === 0) {
        console.warn(`No quote data for ${symbol}`);
        return { error: `No quote data returned for ${symbol}` };
      }
      const quote = response.data.results[0];
      return {
        data: {
          '05. price': quote.ask_price?.toFixed(2) || 'N/A',
          '09. change': (quote.ask_price - (quote.previous_close || quote.bid_price || 0)).toFixed(2),
          '10. change percent': ((quote.ask_price - (quote.previous_close || quote.bid_price || 1)) / (quote.previous_close || quote.bid_price || 1) * 100).toFixed(2),
          '02. open': quote.open?.toFixed(2) || 'N/A',
          '03. high': quote.high?.toFixed(2) || 'N/A',
          '04. low': quote.low?.toFixed(2) || 'N/A',
          '08. previous close': quote.previous_close?.toFixed(2) || 'N/A'
        }
      };
    } catch (error) {
      const errorMessage = error.response
        ? `Error fetching quote for ${symbol}: ${error.response.status || error.message}`
        : `Error fetching quote for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  }
}


async function getSMA(symbol, apiKey, timePeriod, provider) {
  if (!symbol || !apiKey || !timePeriod) return { error: `Invalid symbol, API key, or time period for getSMA (period: ${timePeriod})` };
  if (provider === 'alpha_vantage') {
    const url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=${timePeriod}&series_type=close&apikey=${apiKey}`;
    try {
      console.log(`Fetching ${timePeriod}-day SMA for ${symbol} with Alpha Vantage`);
      const response = await axios.get(url);
      const smaData = response.data['Technical Analysis: SMA'];
      if (!smaData || Object.keys(smaData).length === 0) {
        const errorMessage = getApiErrorMessage(response, `No SMA data for ${symbol} (period: ${timePeriod})`);
        console.warn(errorMessage);
        return { error: errorMessage };
      }
      const latestDate = Object.keys(smaData)[0];
      await delay(12000);
      return { data: parseFloat(smaData[latestDate]['SMA']) };
    } catch (error) {
      const errorMessage = error.response
        ? getApiErrorMessage(error.response, `Error fetching ${timePeriod}-day SMA for ${symbol}: ${error.response.status || error.message}`)
        : `Error fetching ${timePeriod}-day SMA for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  } else if (provider === 'yfinance') {
    try {
      console.log(`Fetching ${timePeriod}-day SMA for ${symbol} with yahoo-finance2`);
      const history = await yahooFinance.historical(symbol, {
        period1: moment().subtract(timePeriod, 'days').format('YYYY-MM-DD'),
        period2: moment().format('YYYY-MM-DD'),
        interval: '1d'
      });
      if (history && history.length > 0) {
        const closes = history.map(d => d.close).slice(0, timePeriod);
        const sma = closes.reduce((sum, val) => sum + val, 0) / closes.length;
        await delay(1000);
        return { data: sma };
      }
      const summary = await yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics'] });
      const sma = summary.defaultKeyStatistics[`${timePeriod}DayAverage`]?.raw || 'N/A';
      await delay(1000);
      return { data: sma !== 'N/A' ? parseFloat(sma) : 'N/A' };
    } catch (error) {
      console.error(`Error fetching ${timePeriod}-day SMA for ${symbol} with yahoo-finance2: ${error.message}`);
      return { error: `Error fetching SMA: ${error.message}` };
    }
  } else if (provider === 'polygon') {
    try {
      console.log(`Fetching ${timePeriod}-day SMA for ${symbol} with Polygon.io`);
      const response = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${moment().subtract(timePeriod, 'days').format('YYYY-MM-DD')}/${moment().format('YYYY-MM-DD')}?adjusted=true&limit=${timePeriod}&apiKey=${apiKey}`);
      console.log(`Polygon.io SMA response for ${symbol} (${timePeriod}-day):`, JSON.stringify(response.data, null, 2));
      await delay(1000);
      if (!response.data.results || response.data.results.length === 0) {
        console.warn(`No SMA data for ${symbol} (period: ${timePeriod})`);
        return { error: `No SMA data returned for ${symbol}` };
      }
      const closes = response.data.results.map(result => result.c).slice(0, timePeriod);
      const sma = closes.reduce((sum, val) => sum + val, 0) / closes.length;
      return { data: parseFloat(sma.toFixed(2)) };
    } catch (error) {
      const errorMessage = error.response
        ? `Error fetching ${timePeriod}-day SMA for ${symbol}: ${error.response.status || error.message}`
        : `Error fetching ${timePeriod}-day SMA for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  }
}

async function getAverageVolume(symbol, apiKey, provider) {
  if (!symbol || !apiKey) return { error: 'Invalid symbol or API key for getAverageVolume' };
  if (provider === 'alpha_vantage') {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
    try {
      console.log(`Fetching daily time series for ${symbol} with Alpha Vantage`);
      const response = await axios.get(url);
      const dailyData = response.data['Time Series (Daily)'];
      if (!dailyData || Object.keys(dailyData).length === 0) {
        const errorMessage = getApiErrorMessage(response, `No daily data for ${symbol}`);
        console.warn(errorMessage);
        return { error: errorMessage };
      }
      const tradingDays = Object.keys(dailyData)
        .sort((a, b) => new Date(b) - new Date(a))
        .slice(0, 20);
      const volumes = tradingDays.map(date => parseFloat(dailyData[date]['5. volume']));
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      await delay(12000);
      return { data: avgVolume };
    } catch (error) {
      const errorMessage = error.response
        ? getApiErrorMessage(error.response, `Error fetching daily time series for ${symbol}: ${error.response.status || error.message}`)
        : `Error fetching daily time series for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  } else if (provider === 'yfinance') {
    try {
      console.log(`Fetching average volume for ${symbol} with yahoo-finance2`);
      const history = await yahooFinance.historical(symbol, {
        period1: moment().subtract(20, 'days').format('YYYY-MM-DD'),
        period2: moment().format('YYYY-MM-DD'),
        interval: '1d'
      });
      if (history && history.length > 0) {
        const avgVolume = history.reduce((sum, d) => sum + d.volume, 0) / history.length;
        await delay(1000);
        return { data: avgVolume };
      }
      const summary = await yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics'] });
      const avgVolume = summary.defaultKeyStatistics.averageDailyVolume3Month?.raw || 'N/A';
      await delay(1000);
      return { data: avgVolume !== 'N/A' ? parseFloat(avgVolume) : 'N/A' };
    } catch (error) {
      console.error(`Error fetching average volume for ${symbol} with yahoo-finance2: ${error.message}`);
      return { error: `Error fetching volume: ${error.message}` };
    }
  } else if (provider === 'polygon') {
    try {
      console.log(`Fetching average volume for ${symbol} with Polygon.io`);
      const response = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${moment().subtract(20, 'days').format('YYYY-MM-DD')}/${moment().format('YYYY-MM-DD')}?adjusted=true&limit=20&apiKey=${apiKey}`);
      console.log(`Polygon.io volume response for ${symbol}:`, JSON.stringify(response.data, null, 2));
      await delay(1000);
      if (!response.data.results || response.data.results.length === 0) {
        console.warn(`No volume data for ${symbol}`);
        return { error: `No volume data returned for ${symbol}` };
      }
      const volumes = response.data.results.map(result => result.v);
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const latestVolume = volumes[volumes.length - 1]; // Most recent volume
      return { 
        data: parseFloat(avgVolume.toFixed(0)),
        latestVolume: latestVolume 
      };
    } catch (error) {
      const errorMessage = error.response
        ? `Error fetching average volume for ${symbol}: ${error.response.status || error.message}`
        : `Error fetching average volume for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  }
}

async function getNewsSentiment(symbol, from, to, apiKey, provider) {
  if (!symbol || !apiKey) return { error: 'Invalid symbol or API key for getNewsSentiment' };
  if (provider === 'alpha_vantage') {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&time_from=${from}T0000&time_to=${to}T2359&limit=1000&apikey=${apiKey}`;
    for (let i = 0; i <= 2; i++) {
      try {
        console.log(`Fetching news sentiment for ${symbol} with Alpha Vantage, attempt ${i + 1}`);
        const response = await axios.get(url);
        if (!response.data.feed || response.data.feed.length === 0) {
          const errorMessage = getApiErrorMessage(response, `No news sentiment data for ${symbol} from ${from} to ${to}`);
          console.warn(errorMessage);
          await delay(12000);
          return { error: errorMessage };
        }
        await delay(12000);
        return { data: response.data.feed };
      } catch (error) {
        const errorMessage = error.response
          ? getApiErrorMessage(error.response, `Error fetching news sentiment for ${symbol}: ${error.response.status || error.message}`)
          : `Error fetching news sentiment for ${symbol}: ${error.message}`;
        console.error(errorMessage);
        if (error.response?.status === 403 || error.response?.status === 401) {
          return { error: `Access denied for ${symbol}. Check ALPHA_VANTAGE_API_KEY or free tier limits at https://www.alphavantage.co` };
        } else if (i < 2) {
          console.warn(`Retry ${i + 1}/2 for ${symbol}: ${error.message}`);
          await delay(12000);
        } else {
          return { error: errorMessage };
        }
      }
    }
  } else if (provider === 'yfinance') {
    return { error: 'News sentiment not supported by yahoo-finance2' };
  } else if (provider === 'polygon') {
    try {
      console.log(`Fetching news sentiment for ${symbol} with Polygon.io`);
      const response = await axios.get(`https://api.polygon.io/v2/reference/news?ticker=${symbol}&published_utc.gte=${from}T00:00:00Z&published_utc.lte=${to}T23:59:59Z&limit=1000&apiKey=${apiKey}`);
      console.log(`Polygon.io news response for ${symbol}:`, JSON.stringify(response.data, null, 2));
      await delay(1000);
      if (!response.data.results || response.data.results.length === 0) {
        console.warn(`No news sentiment data for ${symbol} from ${from} to ${to}`);
        return { error: `No news sentiment data returned for ${symbol}` };
      }
      const feed = response.data.results.map(article => ({
        title: article.title,
        url: article.article_url,
        time_published: moment(article.published_utc).format('YYYYMMDDTHHmmss'),
        summary: article.description || '',
        source: article.publisher.name,
        ticker_sentiment: article.tickers.map(ticker => ({
          ticker,
          relevance_score: 0.5,
          ticker_sentiment_score: 0,
          ticker_sentiment_label: 'Neutral'
        }))
      }));
      return { data: feed };
    } catch (error) {
      const errorMessage = error.response
        ? `Error fetching news sentiment for ${symbol}: ${error.response.status || error.message}`
        : `Error fetching news sentiment for ${symbol}: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
    }
  }
}

function getLastTradingDays(n) {
  const days = [];
  let date = moment().subtract(1, 'days');
  while (days.length < n) {
    if (date.isoWeekday() <= 5) {
      days.push(date.format('YYYYMMDD'));
    }
    date = date.subtract(1, 'days');
  }
  return days.reverse();
}

function classifySentiment(score) {
  if (score >= 0.35) return 'Bullish';
  if (score >= 0.15) return 'Somewhat Bullish';
  if (score > -0.15) return 'Neutral';
  if (score > -0.35) return 'Somewhat Bearish';
  return 'Bearish';
}

function classifyPriceSentiment(dp) {
  if (dp > 2) return 'Bullish';
  if (dp > 0) return 'Somewhat Bullish';
  if (dp > -2) return 'Neutral';
  if (dp > -5) return 'Somewhat Bearish';
  return 'Bearish';
}

async function analyzeStock(symbol, apiKey, provider, lookbackDays = 1) {
  if (!symbol || !/^[A-Z]{1,5}$/.test(symbol)) {
    throw new Error('Invalid stock symbol. Use 1-5 uppercase letters (e.g., NVDA, ASTS)');
  }
  if (!apiKey) {
    throw new Error('API key not provided');
  }

  const today = moment().format('YYYYMMDD');
  const fromDateForNews = getLastTradingDays(20)[0]; // For news sentiment
  const toDateForNews = today;
  // Need enough data for 200-day MA + lookbackDays, plus a large buffer for non-trading days
  // For charting, we need a longer history, e.g., 2 years (730 days) + buffer for SMA calculation
  const startDateForHistory = moment().subtract(Math.max(lookbackDays + 200 + 365, 730 + 200), 'days').format('YYYY-MM-DD'); 
  const endDateForHistory = moment().format('YYYY-MM-DD');

  console.log(`[${symbol}] lookbackDays: ${lookbackDays}`);
  console.log(`[${symbol}] startDateForHistory: ${startDateForHistory}, endDateForHistory: ${endDateForHistory}`);

  let historicalPrices = [];
  let historicalSma50 = [];
  let historicalSma200 = [];
  let ma200CrossoverUpLookback = false;
  let ma200CrossoverDownLookback = false;
  let ma200CrossoverUpDate = null;
  let ma200CrossoverDownDate = null;

  // --- Fetch historical data for crossover detection ---
  if (provider === 'alpha_vantage') {
    // Fetch historical daily prices
    const dailyPricesUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`;
    try {
      console.log(`Fetching historical daily prices for ${symbol} with Alpha Vantage`);
      const response = await axios.get(dailyPricesUrl);
      const timeSeries = response.data['Time Series (Daily)'];
      if (timeSeries) {
        historicalPrices = Object.keys(timeSeries)
          .filter(date => moment(date).isBetween(moment(startDateForHistory), moment(endDateForHistory), 'day', '[]'))
          .sort((a, b) => moment(a).diff(moment(b)))
          .map(date => ({ date, close: parseFloat(timeSeries[date]['4. close']) }));
      }
      await delay(12000);
    } catch (error) {
      console.error(`Error fetching historical prices for ${symbol} (AV): ${error.message}`);
    }

    // Fetch historical 200-day SMA
    const sma200Url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=200&series_type=close&apikey=${apiKey}`;
    try {
      console.log(`Fetching historical 200-day SMA for ${symbol} with Alpha Vantage`);
      const response = await axios.get(sma200Url);
      const smaData = response.data['Technical Analysis: SMA'];
      if (smaData) {
        historicalSma200 = Object.keys(smaData)
          .filter(date => moment(date).isBetween(moment(startDateForHistory), moment(endDateForHistory), 'day', '[]'))
          .sort((a, b) => moment(a).diff(moment(b)))
          .map(date => ({ date, sma: parseFloat(smaData[date]['SMA']) }));
      }
      await delay(12000);
    } catch (error) {
      console.error(`Error fetching historical SMA200 for ${symbol} (AV): ${error.message}`);
    }
  } else if (provider === 'yfinance') {
    try {
      console.log(`Fetching historical data for ${symbol} with yahoo-finance2.chart for crossover detection`);
      const chart = await yahooFinance.chart(symbol, {
        period1: startDateForHistory,
        period2: endDateForHistory,
        interval: '1d'
      });

      // Yahoo Finance chart data is nested, extract relevant parts
      const historicalData = chart.quotes;

      console.log(`[${symbol}] yahooFinance.chart fetched ${historicalData ? historicalData.length : 0} data points.`);

      if (historicalData && historicalData.length > 0) {
        // Filter out any entries where close is null or undefined
        const validHistoricalData = historicalData.filter(d => d.close !== null && d.close !== undefined);

        const closes = validHistoricalData.map(d => d.close);
        const dates = validHistoricalData.map(d => moment(d.date).format('YYYY-MM-DD'));

        const calculateSMA = (data, period) => {
          const smaValues = [];
          for (let i = 0; i < data.length; i++) {
            if (i >= period - 1) {
              const slice = data.slice(i - period + 1, i + 1);
              const sma = slice.reduce((sum, val) => sum + val, 0) / period;
              smaValues.push({ date: dates[i], sma });
            } else {
              smaValues.push({ date: dates[i], sma: NaN });
            }
          }
          return smaValues;
        };

        if (closes.length >= 50) {
          historicalSma50 = calculateSMA(closes, 50);
          console.log(`[${symbol}] Calculated ${historicalSma50.filter(s => !isNaN(s.sma)).length} valid 50-day SMAs.`);
        } else {
          console.warn(`[${symbol}] Not enough historical data (${closes.length} days) to calculate 50-day SMA. Required: 50`);
        }

        if (closes.length >= 200) {
          historicalSma200 = calculateSMA(closes, 200);
          console.log(`[${symbol}] Calculated ${historicalSma200.filter(s => !isNaN(s.sma)).length} valid 200-day SMAs.`);
        } else {
          console.warn(`[${symbol}] Not enough historical data (${closes.length} days) to calculate 200-day SMA. Required: 200`);
        }

        historicalPrices = validHistoricalData.map(d => ({ date: moment(d.date).format('YYYY-MM-DD'), close: d.close }));
      }
      await delay(1000);
      console.log(`[${symbol}] historicalSma200 (yfinance) after calculation:`, historicalSma200.filter(s => !isNaN(s.sma)).slice(-5)); // Log last 5 valid SMA values
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol} (yfinance): ${error.message}`);
    }
  }

  console.log(`[${symbol}] Full historicalSma200 length: ${historicalSma200.length}`);
  console.log(`[${symbol}] Full historicalSma50 length: ${historicalSma50.length}`);
  console.log(`[${symbol}] Sample historicalSma200:`, historicalSma200.filter(s => !isNaN(s.sma)).slice(0, 5)); // Log first 5 valid entries
  console.log(`[${symbol}] Sample historicalSma50:`, historicalSma50.filter(s => !isNaN(s.sma)).slice(0, 5)); // Log first 5 valid entries
  console.log(`[${symbol}] Sample historicalPrices:`, historicalPrices.slice(0, 5)); // Log first 5 entries

  // --- Crossover Detection Logic ---
  if (historicalPrices.length > 0 && historicalSma200.length > 0) {
    // Filter data to only include the lookbackDays period for crossover detection
    // Ensure we have aligned dates for price and SMA. Also ensure SMA is not NaN.
    const relevantHistoricalData = historicalPrices.map(priceEntry => {
      const smaEntry = historicalSma200.find(sma => sma.date === priceEntry.date);
      return {
        date: priceEntry.date,
        close: priceEntry.close,
        sma200: smaEntry ? smaEntry.sma : NaN
      };
    }).filter(entry => !isNaN(entry.sma200) && moment(entry.date).isAfter(moment().subtract(lookbackDays + 1, 'days')));

    console.log(`[${symbol}] Relevant historical data for lookback (filtered, valid SMA):`, relevantHistoricalData.length);

    // Ensure we have enough data points to detect a crossover within the lookback period
    if (relevantHistoricalData.length >= 2) {
      for (let i = 1; i < relevantHistoricalData.length; i++) {
        const previousDayPrice = relevantHistoricalData[i - 1].close;
        const currentDayPrice = relevantHistoricalData[i].close;
        const previousDaySma200 = relevantHistoricalData[i - 1].sma200;
        const currentDaySma200 = relevantHistoricalData[i].sma200;

        console.log(`[${symbol}] Day ${i}: PrevPrice: ${previousDayPrice}, CurrPrice: ${currentDayPrice}, PrevSMA: ${previousDaySma200}, CurrSMA: ${currentDaySma200}`);

        // Detect Crossover Up (price goes from below to above MA200)
        if (previousDayPrice < previousDaySma200 && currentDayPrice > currentDaySma200) {
          ma200CrossoverUpLookback = true;
          ma200CrossoverUpDate = relevantHistoricalData[i].date;
          console.log(`[${symbol}] MA200 Crossover Up detected on ${relevantHistoricalData[i].date}`);
        }
        // Detect Crossover Down (price goes from above to below MA200)
        if (previousDayPrice > previousDaySma200 && currentDayPrice < currentDaySma200) {
          ma200CrossoverDownLookback = true;
          ma200CrossoverDownDate = relevantHistoricalData[i].date;
          console.log(`[${symbol}] MA200 Crossover Down detected on ${relevantHistoricalData[i].date}`);
        }
      }
    }
  }

  console.log(`[${symbol}] Final Crossover Flags: Up=${ma200CrossoverUpLookback}, Down=${ma200CrossoverDownLookback}`);
  console.log(`[${symbol}] Crossover Up Date: ${ma200CrossoverUpDate}, Crossover Down Date: ${ma200CrossoverDownDate}`);

  const companyNameResult = await getCompanyOverview(symbol, apiKey, provider);
  const newsDataResult = await getNewsSentiment(symbol, fromDateForNews, toDateForNews, apiKey, provider);
  const quoteDataResult = await getStockQuote(symbol, apiKey, provider);
  const sma50Result = await getSMA(symbol, apiKey, 50, provider);
  const sma200Result = await getSMA(symbol, apiKey, 200, provider);
  const avgVolumeResult = await getAverageVolume(symbol, apiKey, provider);

  let upcomingEarningsDate = null;
  let exDividendDate = null;
  let recentEarningsDates = [];
  let recentExDividendDate = null;
  let upcomingEvents = [];
  let recentPastEvents = [];

  if (provider === 'yfinance') {
    try {
      console.log(`Fetching calendar events for ${symbol} with yahoo-finance2`);
      const calendarEvents = await yahooFinance.quoteSummary(symbol, { modules: ['calendarEvents'] });
      if (calendarEvents && calendarEvents.calendarEvents) {
        const todayMoment = moment();
        const ninetyDaysAgo = moment().subtract(90, 'days'); // Changed from 30 days
        const ninetyDaysFromNow = moment().add(90, 'days');

        if (calendarEvents.calendarEvents.earnings && calendarEvents.calendarEvents.earnings.earningsDate && calendarEvents.calendarEvents.earnings.earningsDate.length > 0) {
          calendarEvents.calendarEvents.earnings.earningsDate.forEach(eDate => {
            const eventMoment = moment(eDate);
            const formattedDate = eventMoment.format('YYYY-MM-DD');
            if (eventMoment.isSameOrAfter(todayMoment, 'day') && eventMoment.isSameOrBefore(ninetyDaysFromNow, 'day')) {
              upcomingEvents.push({ type: 'Earnings', date: formattedDate });
            } else if (eventMoment.isBetween(ninetyDaysAgo, todayMoment, 'day', '(]')) { // Updated to ninetyDaysAgo
              recentPastEvents.push({ type: 'Earnings', date: formattedDate });
            }
          });
        }

        if (calendarEvents.calendarEvents.exDividendDate) {
          const eventMoment = moment(calendarEvents.calendarEvents.exDividendDate);
          const formattedDate = eventMoment.format('YYYY-MM-DD');
          if (eventMoment.isSameOrAfter(todayMoment, 'day') && eventMoment.isSameOrBefore(ninetyDaysFromNow, 'day')) {
            upcomingEvents.push({ type: 'Ex-Dividend', date: formattedDate });
          } else if (eventMoment.isBetween(ninetyDaysAgo, todayMoment, 'day', '(]')) { // Updated to ninetyDaysAgo
            recentPastEvents.push({ type: 'Ex-Dividend', date: formattedDate });
          }
        }

        // Sort events by date
        upcomingEvents.sort((a, b) => moment(a.date).diff(moment(b.date)));
        recentPastEvents.sort((a, b) => moment(b.date).diff(moment(a.date))); // Sort descending for recent past

      }
      await delay(1000);
    } catch (error) {
      console.error(`Error fetching calendar events for ${symbol} (yfinance): ${error.message}`);
    }
  }

  const result = {
    symbol: symbol.toUpperCase(),
    companyName: companyNameResult.error ? symbol.toUpperCase() : companyNameResult.data,
    companyNameError: companyNameResult.error || null,
    date: moment().format('YYYY-MM-DD'),
    timestamp: moment().format('hh:mm A [EDT], MMMM DD, YYYY'),
    quote: null,
    quoteError: quoteDataResult.error || null,
    sma50Error: sma50Result.error || null,
    sma200Error: sma200Result.error || null,
    volumeError: avgVolumeResult.error || null,
    newsError: newsDataResult.error || null,
    mentions: {
      today: 0,
      average: 0,
      comparison: 'N/A'
    },
    sentimentToday: {
      score: 0,
      classification: 'N/A',
      positive: 0,
      negative: 0,
      neutral: 0
    },
    sentimentAverage: {
      score: 0,
      classification: 'N/A',
      positive: 0,
      negative: 0,
      neutral: 0
    },
    upcomingEvents: upcomingEvents,
    recentPastEvents: recentPastEvents
  };

  if (quoteDataResult.data) {
    const currentPrice = parseFloat(quoteDataResult.data['05. price']);
    
    // Use latest volume from volume result if available, otherwise fallback to yahooFinance
    let latestVolume = avgVolumeResult.latestVolume || 0;
    if (!latestVolume) {
      try {
        const yahooQuote = await yahooFinance.quote(symbol);
        latestVolume = yahooQuote.regularMarketVolume || 0;
      } catch (error) {
        console.warn(`Failed to get latest volume for ${symbol}: ${error.message}`);
        latestVolume = 0;
      }
    }
    
    result.quote = {
      price: currentPrice.toFixed(2),
      change: parseFloat(quoteDataResult.data['09. change']).toFixed(2),
      changePercent: parseFloat(quoteDataResult.data['10. change percent'].replace('%', '')).toFixed(2),
      open: parseFloat(quoteDataResult.data['02. open']).toFixed(2),
      high: parseFloat(quoteDataResult.data['03. high']).toFixed(2),
      low: parseFloat(quoteDataResult.data['04. low']).toFixed(2),
      previousClose: parseFloat(quoteDataResult.data['08. previous close']).toFixed(2),
      priceSentiment: classifyPriceSentiment(parseFloat(quoteDataResult.data['10. change percent'] || 0)),
      percentFrom50DayMA: sma50Result.data ? (((currentPrice - sma50Result.data) / sma50Result.data) * 100).toFixed(2) : 'N/A',
      percentFrom200DayMA: sma200Result.data ? (((currentPrice - sma200Result.data) / sma200Result.data) * 100).toFixed(2) : 'N/A',
      volumeComparison: avgVolumeResult.data && latestVolume ? (((latestVolume - avgVolumeResult.data) / avgVolumeResult.data) * 100).toFixed(2) : 'N/A',
      ma200CrossoverUpLookback: ma200CrossoverUpLookback,
      ma200CrossoverDownLookback: ma200CrossoverDownLookback,
      ma200CrossoverUpDate: ma200CrossoverUpDate,
      ma200CrossoverDownDate: ma200CrossoverDownDate,
      // upcomingEarningsDate: upcomingEarningsDate, // Remove direct assignment
      // exDividendDate: exDividendDate, // Remove direct assignment
      historicalPrices: historicalPrices,
      historicalSMA50: historicalSma50,
      historicalSMA200: historicalSma200
    };
  }

  if (newsDataResult.data && newsDataResult.data.length > 0) {
    const dataMap = new Map();
    newsDataResult.data.forEach(article => {
      const date = moment(article.time_published, 'YYYYMMDDTHHmmss').format('YYYYMMDD');
      const tickerData = article.ticker_sentiment.find(t => t.ticker === symbol.toUpperCase());
      if (tickerData && tickerData.relevance_score > 0.1) {
        if (!dataMap.has(date)) {
          dataMap.set(date, { mentions: 0, scores: [], positive: 0, negative: 0, neutral: 0 });
        }
        const entry = dataMap.get(date);
        entry.mentions++;
        const score = parseFloat(tickerData.ticker_sentiment_score);
        entry.scores.push(score);
        if (score >= 0.15) entry.positive++;
        else if (score <= -0.15) entry.negative++;
        else entry.neutral++;
      }
    });

    const todayData = dataMap.get(today) || { mentions: 0, scores: [], positive: 0, negative: 0, neutral: 0 };
    result.mentions.today = todayData.mentions;
    result.sentimentToday.score = todayData.scores.length > 0 ? (todayData.scores.reduce((sum, s) => sum + s, 0) / todayData.scores.length).toFixed(2) : 0;
    result.sentimentToday.positive = todayData.mentions > 0 ? (todayData.positive / todayData.mentions * 100).toFixed(2) : 0;
    result.sentimentToday.negative = todayData.mentions > 0 ? (todayData.negative / todayData.mentions * 100).toFixed(2) : 0;
    result.sentimentToday.neutral = (100 - result.sentimentToday.positive - result.sentimentToday.negative).toFixed(2);
    result.sentimentToday.classification = classifySentiment(parseFloat(result.sentimentToday.score));

    let sumMentions = 0, sumScores = 0, sumPositive = 0, sumNegative = 0, validDays = 0;
    for (const day of last20TradingDays) {
      const dayData = dataMap.get(day);
      if (dayData) {
        sumMentions += dayData.mentions;
        sumScores += dayData.scores.reduce((sum, s) => sum + s, 0) / (dayData.scores.length || 1);
        sumPositive += dayData.positive;
        sumNegative += dayData.negative;
        validDays++;
      }
    }

    result.mentions.average = validDays > 0 ? (sumMentions / validDays).toFixed(2) : 0;
    result.sentimentAverage.score = validDays > 0 ? (sumScores / validDays).toFixed(2) : 0;
    result.sentimentAverage.positive = result.mentions.average > 0 ? (sumPositive / validDays / result.mentions.average * 100).toFixed(2) : 0;
    result.sentimentAverage.negative = result.mentions.average > 0 ? (sumNegative / validDays / result.mentions.average * 100).toFixed(2) : 0;
    result.sentimentAverage.neutral = (100 - result.sentimentAverage.positive - result.sentimentAverage.negative).toFixed(2);
    result.sentimentAverage.classification = classifySentiment(parseFloat(result.sentimentAverage.score));
    result.mentions.comparison = result.mentions.today > 0 && result.mentions.average > 0 ? ((result.mentions.today - result.mentions.average) / result.mentions.average * 100).toFixed(2) + '%' : 'N/A';
  } else if (newsDataResult.error && provider === 'yfinance') {
    result.newsError = 'News sentiment not supported by yahoo-finance2';
  } else if (provider === 'polygon') {
    result.newsError = newsDataResult.error || 'No news sentiment data available';
  }

  console.log(`[${symbol}] Final analyzeStock result:`, JSON.stringify(result, null, 2));

  return result;
}

module.exports = { analyzeStock };