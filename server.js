const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://tonminer.onrender.com';
const PORT = process.env.PORT || 3000;

// Simple users storage (JSON DB)
const DB_PATH = path.join(__dirname, 'db', 'users.json');
if (!fs.existsSync(path.join(__dirname, 'db'))) fs.mkdirSync(path.join(__dirname, 'db'));
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2));

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint: save user data
app.post('/api/save-user', (req, res) => {
  try {
    const { telegram_id, ton_address } = req.body || {};
    if (!telegram_id || !ton_address)
      return res.status(400).json({ ok: false, error: 'telegram_id and ton_address required' });

    const db = JSON.parse(fs.readFileSync(DB_PATH));
    const existing = db.users.find(u => u.telegram_id === telegram_id);
    if (!existing) {
      db.users.push({ telegram_id, ton_address, balance: 0, farms: 0, created_at: new Date().toISOString() });
    } else {
      existing.ton_address = ton_address;
      existing.updated_at = new Date().toISOString();
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: 'server error' });
  }
});

// health
app.get('/health', (req, res) => res.send('TONMiner OK'));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Telegram bot
if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN not found in .env — bot will not run.');
} else {
  const bot = new Telegraf(BOT_TOKEN);
  bot.start((ctx) => {
    ctx.reply('👋 Добро пожаловать в TONMiner!', {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Запустить TONMiner", web_app: { url: WEB_APP_URL } }]
        ]
      }
    });
  });

  const BOT_WEBHOOK_URL = `${WEB_APP_URL}/bot${BOT_TOKEN}`;
  (async () => {
    try {
      await bot.telegram.setWebhook(BOT_WEBHOOK_URL);
      app.use(bot.webhookCallback(`/bot${BOT_TOKEN}`));
      console.log(`✅ Telegram webhook set to ${BOT_WEBHOOK_URL}`);
    } catch (err) {
      console.error('❌ Failed to set webhook:', err);
    }
  })();
}

app.listen(PORT, () => console.log(`🚀 TONMiner running on port ${PORT}`));
