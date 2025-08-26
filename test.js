const { analyzeStock } = require('./stock-analysis');

async function test() {
  const result = await analyzeStock('NVDA', process.env.ALPHA_VANTAGE_API_KEY);
  console.log(JSON.stringify(result, null, 2));
}

test().catch(err => console.error(err));

