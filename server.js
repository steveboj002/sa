const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { analyzeStock } = require('./stock-analysis');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

require('dotenv').config();

app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('database.db');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address
    pass: process.env.GMAIL_PASS  // Your Gmail app password
  }
});

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, symbol TEXT, FOREIGN KEY (userId) REFERENCES users(id))');
});

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    next();
  });
}

app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Error hashing password.' });
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
      if (err) return res.status(400).json({ error: 'Username already exists.' });
      const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
      res.json({ token });
    });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Invalid username or password.' });
    bcrypt.compare(password, row.password, (err, match) => {
      if (err || !match) return res.status(400).json({ error: 'Invalid username or password.' });
      const token = jwt.sign({ id: row.id, username }, JWT_SECRET);
      res.json({ token });
    });
  });
});

app.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

app.get('/user', authenticateToken, (req, res) => {
  res.json({ username: req.user.username });
});

app.get('/watchlist', authenticateToken, (req, res) => {
  db.all('SELECT symbol FROM watchlist WHERE userId = ?', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch watchlist.' });
    res.json({ watchlist: rows.map(row => row.symbol) });
  });
});

app.post('/watchlist/add', authenticateToken, (req, res) => {
  const { symbols } = req.body;
  db.all('SELECT symbol FROM watchlist WHERE userId = ?', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch watchlist.' });
    const existing = rows.map(row => row.symbol);
    const newSymbols = symbols.filter(s => !existing.includes(s));
    if (newSymbols.length === 0) return res.json({ watchlist: existing, existing });
    const placeholders = newSymbols.map(() => '(?, ?)').join(',');
    const params = newSymbols.flatMap(s => [req.user.id, s]);
    db.run(`INSERT INTO watchlist (userId, symbol) VALUES ${placeholders}`, params, function(err) {
      if (err) return res.status(500).json({ error: 'Failed to add to watchlist.' });
      db.all('SELECT symbol FROM watchlist WHERE userId = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch updated watchlist.' });
        res.json({ watchlist: rows.map(row => row.symbol), existing });
      });
    });
  });
});

app.post('/watchlist/remove', authenticateToken, (req, res) => {
  const { symbol } = req.body;
  db.run('DELETE FROM watchlist WHERE userId = ? AND symbol = ?', [req.user.id, symbol], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to remove from watchlist.' });
    db.all('SELECT symbol FROM watchlist WHERE userId = ?', [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch updated watchlist.' });
      res.json({ watchlist: rows.map(row => row.symbol) });
    });
  });
});

app.post('/analyze', authenticateToken, async (req, res) => {
  const symbolsParam = req.query.symbols;
  const provider = req.query.provider || 'alpha_vantage';
  const lookbackDays = parseInt(req.query.lookbackDays || '1', 10); // Default to 1 day

  console.log(`[Server] Received symbolsParam: ${symbolsParam}`);
  console.log(`[Server] Received provider: ${provider}`);
  console.log(`[Server] Received lookbackDays: ${lookbackDays}`);

  if (!symbolsParam) {
    return res.status(400).json({ error: 'Symbols parameter is required' });
  }
  const symbolArray = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{1,5}$/.test(s));
  if (symbolArray.length === 0) {
    return res.status(400).json({ error: 'No valid symbols provided' });
  }

  // Determine which API key to use based on provider
  const apiKey = provider === 'polygon' ? POLYGON_API_KEY : ALPHA_VANTAGE_API_KEY;

  try {
    const results = await Promise.all(symbolArray.map(async symbol => {
      try {
        const result = await analyzeStock(symbol, apiKey, provider, lookbackDays);
        return { symbol, data: result };
      } catch (error) {
        return { symbol, error: error.message };
      }
    }));
    console.log(`[Server] Sending analysis results: ${JSON.stringify(results.map(r => r.symbol), null, 2)}`);
    res.json(results);
  } catch (error) {
    console.error('[Server] Error in /analyze route:', error);
    res.status(500).json({ error: 'Error processing analysis' });
  }
});

app.post('/send-alert-email', authenticateToken, async (req, res) => {
  const { recipientEmail, subject, body } = req.body;

  if (!recipientEmail || !subject || !body) {
    return res.status(400).json({ error: 'Recipient email, subject, and body are required.' });
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER, // Sender address
      to: recipientEmail,          // List of receivers
      subject: subject,             // Subject line
      html: body                    // HTML body content
    });
    res.json({ message: 'Email alert sent successfully.' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email alert.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});