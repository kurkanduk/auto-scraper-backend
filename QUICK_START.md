# 🚀 Quick Start Guide

## Chrome Issue Fixed! ✅

The Chrome/Puppeteer issue has been resolved. The bot now:

- ✅ Automatically detects your system Chrome installation
- ✅ Falls back to Puppeteer's bundled Chrome if needed
- ✅ Handles all browser initialization correctly
- ✅ Development mode with WhatsApp simulation (no real messages sent)

## Start the Bot

1. **Run setup (first time only):**

   ```bash
   ./setup.sh
   ```

2. **Start the application:**

   ```bash
   yarn start:dev
   ```

3. **For production**: Set `WHATSAPP_DISABLED=false` in `.env` and scan QR code

4. **Monitor the bot:** Open `http://localhost:3000/scraping/status`

## What Happens Next

The bot will automatically:

- 🕐 Scrape listings every 15 minutes
- 🔍 Filter for private sellers only
- ✅ Check against your criteria (price, year, mileage)
- 📱 Send WhatsApp messages to qualifying sellers
- 💾 Save everything to database to prevent duplicates

## API Endpoints

- `GET /` - Welcome message with all endpoints
- `GET /health` - Health check
- `GET /scraping/status` - Full bot status and statistics
- `POST /scraping/start` - Trigger manual scraping
- `GET /scraping/listings` - View recent listings
- `GET /scraping/contacts` - View contact history

## Configuration

Edit `src/config/app.config.ts` to customize:

- Price filters
- Year/mileage limits
- WhatsApp message template
- Scraping intervals
- Excluded keywords

## Troubleshooting

If WhatsApp fails to connect:

```bash
# Remove session data and restart
rm -rf .wwebjs_auth/
yarn start:dev
```

If port 3000 is in use:

```bash
# Kill processes on port 3000
lsof -ti:3000 | xargs kill -9
```

The bot is now ready to find and contact car sellers automatically! 🎉
