#!/bin/bash

echo "🤖 Setting up Car Scraper Bot..."

# Install dependencies
echo "📦 Installing dependencies..."
export PUPPETEER_SKIP_DOWNLOAD=true
yarn install

# Install Chromium for Puppeteer
echo "🌐 Installing Chromium for Puppeteer..."
npx puppeteer browsers install chrome

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# Database Configuration
DB_PATH=car_scraper.db

# Scraping Configuration
SCRAPING_INTERVAL_MINUTES=15
MAX_PRICE=50000
MIN_YEAR=2015
MAX_MILEAGE=150000

# WhatsApp Configuration
MAX_MESSAGES_PER_HOUR=10
# Set to 'true' to disable WhatsApp in development
WHATSAPP_DISABLED=false

# Server Configuration
PORT=3000
NODE_ENV=development
EOL
fi

# Create logs directory
mkdir -p logs

echo "✅ Setup complete!"
echo ""
echo "🚀 To start the bot:"
echo "  yarn start:dev"
echo ""
echo "📱 You'll need to scan a QR code with WhatsApp when starting for the first time."
echo ""
echo "🌐 API will be available at: http://localhost:3000"
echo "📊 Bot status: http://localhost:3000/scraping/status"