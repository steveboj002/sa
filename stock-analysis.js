const axios = require('axios');
const moment = require('moment');
const yahooFinance = require('yahoo-finance2').default;

// Validate environment
if (!process.env.ALPHA_VANTAGE_API_KEY) {
  throw new Error('ALPHA_VANTAGE_API_KEY environment variable not set. Run: export ALPHA_VANTAGE_API_KEY=your_av_key');
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function getApiErrorMessage(response, defaultMessage) {
  if (response?.data?.Information) {
    return response.data.Information;
  } else if (response?.data?.['Error Message']) {
    return response.data['Error Message'];
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
  } else if(provider === 'polygon') {
    // POLYGON PLACEHOLDER
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
  } else if(provider === 'polygon') {
    // POLYGON PLACEHOLDER
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
    // POLYGON PLACEHOLDER
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
    // POLYGON PLACEHOLDER
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
    // POLYGON PLACEHOLDER
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

async function analyzeStock(symbol, apiKey, provider) {
  if (!symbol || !/^[A-Z]{1,5}$/.test(symbol)) {
    throw new Error('Invalid stock symbol. Use 1-5 uppercase letters (e.g., NVDA, ASTS)');
  }
  if (!apiKey) {
    throw new Error('API key not provided');
  }

  const today = moment().format('YYYYMMDD');
  const last20TradingDays = getLastTradingDays(20);
  const fromDate = last20TradingDays[0];
  const toDate = today;

  const companyNameResult = await getCompanyOverview(symbol, apiKey, provider);
  const newsDataResult = await getNewsSentiment(symbol, fromDate, toDate, apiKey, provider);
  const quoteDataResult = await getStockQuote(symbol, apiKey, provider);
  const sma50Result = await getSMA(symbol, apiKey, 50, provider);
  const sma200Result = await getSMA(symbol, apiKey, 200, provider);
  const avgVolumeResult = await getAverageVolume(symbol, apiKey, provider);

  const result = {
    symbol: symbol.toUpperCase(),
    companyName: companyNameResult.error ? symbol.toUpperCase() : companyNameResult.data,
    companyNameError: companyNameResult.error || null,
    date: moment().format('YYYY-MM-DD'),
    timestamp: '05:53 PM EDT, August 25, 2025',
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
    }
  };

  if (quoteDataResult.data) {
    const currentPrice = parseFloat(quoteDataResult.data['05. price']);
    const latestVolume = (await yahooFinance.quote(symbol)).regularMarketVolume || 0;
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
      volumeComparison: avgVolumeResult.data && latestVolume ? (((latestVolume - avgVolumeResult.data) / avgVolumeResult.data) * 100).toFixed(2) : 'N/A'
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
    // POLYGON PLACEHOLDER
  }

  return result;
}

module.exports = { analyzeStock };