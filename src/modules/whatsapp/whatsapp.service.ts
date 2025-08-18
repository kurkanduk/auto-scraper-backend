import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { Listing } from '../../entities/listing.entity';
import { ContactLog, ContactStatus } from '../../entities/contact-log.entity';
import { defaultConfig } from '../../config/app.config';
import chromium from 'chrome-aws-lambda';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private client: Client;
  private isReady = false;
  private isDevelopmentMode =
    process.env.NODE_ENV === 'development' ||
    process.env.WHATSAPP_DISABLED === 'true';
  private messageQueue: Array<{
    listing: Listing;
    resolve: Function;
    reject: Function;
  }> = [];
  private messageSentCount = 0;
  private lastHourReset = new Date();

  constructor(
    @InjectRepository(ContactLog)
    private contactLogRepository: Repository<ContactLog>,
  ) {
    this.initializeClient();
  }

  async onModuleInit() {
    if (this.isDevelopmentMode) {
      this.logger.warn(
        'WhatsApp is disabled in development mode. Set NODE_ENV=production to enable.',
      );
      return;
    }

    // Delay WhatsApp initialization to avoid conflicts with other services
    setTimeout(() => {
      this.startClient();
    }, 2000);
  }

  private initializeClient() {
    const executablePath = process.env.CHROME_BIN || undefined;
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'car-scraper-bot',
      }),
      puppeteer: {
        headless: true,
        executablePath: executablePath,
        timeout: 60000, // Increase timeout
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-default-browser-check',
          '--disable-extensions',
        ],
      },
    });

    this.setupEventHandlers();
  }

  async sendTestMessage(): Promise<boolean> {
    const testNumber = '+421950242008';
    const chatId = this.formatPhoneNumber(testNumber) + '@c.us';
    const message = '✅ This is a test message from WhatsappService';

    if (this.isDevelopmentMode) {
      this.logger.log(`[DEV MODE] Would send test message to ${testNumber}`);
      return true;
    }

    try {
      await this.client.sendMessage(chatId, message);
      this.logger.log(`Test message sent to ${testNumber}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send test message to ${testNumber}: ${error.message}`,
      );
      return false;
    }
  }

  private getChromePath(): string | undefined {
    // Try to use system Chrome first, then fall back to Puppeteer's Chrome
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/Applications/Chromium.app/Contents/MacOS/Chromium', // macOS Chromium
      '/usr/bin/google-chrome', // Linux
      '/usr/bin/chromium-browser', // Linux Chromium
      process.env.CHROME_PATH, // Custom path from environment
    ];

    const fs = require('fs');
    for (const path of possiblePaths) {
      if (path && fs.existsSync(path)) {
        this.logger.log(`Using Chrome at: ${path}`);
        return path;
      }
    }

    this.logger.log('Using Puppeteer bundled Chrome');
    return undefined; // Let Puppeteer use its bundled Chrome
  }

  private setupEventHandlers() {
    this.client.on('qr', (qr) => {
      this.logger.log('QR Code received, scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      this.logger.log('WhatsApp client is ready!');
      this.isReady = true;
      this.processMessageQueue();
    });

    this.client.on('authenticated', () => {
      this.logger.log('WhatsApp client authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      this.logger.error('WhatsApp authentication failed:', msg);
    });

    this.client.on('disconnected', (reason) => {
      this.logger.warn('WhatsApp client disconnected:', reason);
      this.isReady = false;
    });

    this.client.on('message_create', (message) => {
      // Log received messages for debugging
      if (!message.fromMe) {
        this.logger.debug(
          `Received message from ${message.from}: ${message.body}`,
        );
      }
    });
  }

  private async startClient() {
    try {
      this.logger.log('Initializing WhatsApp client...');
      await this.client.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize WhatsApp client:', error.message);
      this.logger.warn(
        'WhatsApp will continue to retry connection in the background',
      );

      // Retry after delay
      setTimeout(() => {
        this.logger.log('Retrying WhatsApp initialization...');
        this.startClient();
      }, 30000); // Retry after 30 seconds
    }
  }

  async sendMessage(listing: Listing): Promise<boolean> {
    if (this.isDevelopmentMode) {
      this.logger.log(
        `[DEV MODE] Would send WhatsApp message to ${listing.sellerPhone} for: ${listing.title}`,
      );

      // Log the contact in development mode
      await this.logContact(
        listing,
        listing.sellerPhone || 'unknown',
        this.generateMessage(listing),
        ContactStatus.SENT,
      );

      return true;
    }

    return new Promise((resolve, reject) => {
      this.messageQueue.push({ listing, resolve, reject });

      if (this.isReady) {
        this.processMessageQueue();
      }
    });
  }

  private async processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isReady) {
      const { listing, resolve, reject } = this.messageQueue.shift()!;

      try {
        // Check rate limiting
        if (!this.canSendMessage()) {
          this.logger.warn('Rate limit reached, queuing message for later');
          this.messageQueue.unshift({ listing, resolve, reject });
          setTimeout(() => this.processMessageQueue(), 60000); // Try again in 1 minute
          break;
        }

        const success = await this.sendWhatsAppMessage(listing);
        resolve(success);

        if (success) {
          this.messageSentCount++;
        }

        // Add delay between messages to avoid spam detection
        await this.delay(5000);
      } catch (error) {
        this.logger.error(
          `Error sending message for listing ${listing.id}:`,
          error,
        );
        reject(error);
      }
    }
  }

  private testMessages: string[] = [
    'Hello, are you still selling this car?',
    'Good day! Is the car still available?',
    'Hi! I’d like to ask about your car',
    'Hello! Is this listing still active?',
    'I’m interested in this car, can I get more details?',
    'Are you still selling the car?',
    'Is the car still for sale?',
    'Can you clarify the price for this car?',
    'Good day! Is this listing still valid?',
    'Hello! I’d like to ask about the car',
    'Is this car still with you?',
    'Can I schedule a viewing?',
    'Good evening! Is the car still available?',
    'Hello! I’m interested in this car',
    'Is the listing still active?',
    'Are you selling this car? I’d like to discuss',
    'I’m interested in the car, is it still for sale?',
    'Hello, is the car available for viewing?',
    'Is this a new listing? Has the car been sold?',
    'Good day! Is the car still on sale?',
  ];

  private async sendWhatsAppMessage(listing: Listing): Promise<boolean> {
    try {
      const testNumber = '+421950242008'; // твой тестовый номер
      const number =
        listing.source === 'otomoto'
          ? `+48${listing.sellerPhone}`
          : listing.sellerPhone;
      const chatId = `${this.formatPhoneNumber(testNumber)}@c.us`;

      // Берём случайное сообщение из массива
      const message =
        this.testMessages[Math.floor(Math.random() * this.testMessages.length)];

      // Отправляем
      await this.client.sendMessage(chatId, message);

      // Логируем
      await this.logContact(listing, testNumber, message, ContactStatus.SENT);

      this.logger.log(
        `(TEST MODE) Message sent to ${testNumber}: "${message}"`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp test message: ${error.message}`,
      );
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let formatted = phone.replace(/\D/g, '');

    // Add country codes if missing
    if (formatted.startsWith('0')) {
      // German numbers starting with 0
      formatted = '49' + formatted.substring(1);
    } else if (formatted.length === 9 && !formatted.startsWith('48')) {
      // Polish numbers (9 digits without country code)
      formatted = '48' + formatted;
    } else if (formatted.length === 9 && !formatted.startsWith('420')) {
      // Czech numbers (9 digits without country code)
      formatted = '420' + formatted;
    }

    return formatted;
  }

  private generateMessage(listing: Listing): string {
    let message = defaultConfig.whatsapp.messageTemplate;

    // Replace placeholders
    message = message.replace('{make}', listing.make || 'автомобиль');
    message = message.replace('{model}', listing.model || '');
    message = message.replace('{year}', listing.year?.toString() || '');
    message = message.replace('{url}', listing.url);

    return message;
  }

  private async logContact(
    listing: Listing,
    phoneNumber: string,
    message: string,
    status: ContactStatus,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const contactLog = this.contactLogRepository.create({
        listingId: listing.id,
        phoneNumber,
        message,
        status,
        errorMessage,
      });

      await this.contactLogRepository.save(contactLog);
    } catch (error) {
      this.logger.error('Failed to log contact:', error);
    }
  }

  private canSendMessage(): boolean {
    const now = new Date();
    const hoursSinceReset =
      (now.getTime() - this.lastHourReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 1) {
      this.messageSentCount = 0;
      this.lastHourReset = now;
    }

    return this.messageSentCount < defaultConfig.whatsapp.maxMessagesPerHour;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getClientInfo(): Promise<any> {
    if (this.isDevelopmentMode) {
      return {
        ready: true,
        developmentMode: true,
        info: { pushname: 'Development Mode', platform: 'dev' },
        queueSize: this.messageQueue.length,
        messagesSentThisHour: this.messageSentCount,
      };
    }

    if (!this.isReady) {
      return { ready: false, info: null };
    }

    try {
      const info = await this.client.info;
      return {
        ready: true,
        info: {
          wid: info.wid,
          pushname: info.pushname,
          platform: info.platform,
        },
        queueSize: this.messageQueue.length,
        messagesSentThisHour: this.messageSentCount,
      };
    } catch (error) {
      return { ready: false, error: error.message };
    }
  }

  async getContactLogs(limit: number = 10): Promise<ContactLog[]> {
    return this.contactLogRepository.find({
      relations: ['listing'],
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  async getContactStatistics(): Promise<any> {
    const total = await this.contactLogRepository.count();
    const sent = await this.contactLogRepository.count({
      where: { status: ContactStatus.SENT },
    });
    const delivered = await this.contactLogRepository.count({
      where: { status: ContactStatus.DELIVERED },
    });
    const failed = await this.contactLogRepository.count({
      where: { status: ContactStatus.FAILED },
    });

    return {
      total,
      sent,
      delivered,
      failed,
      successRate:
        total > 0 ? (((sent + delivered) / total) * 100).toFixed(2) : 0,
    };
  }

  async logout(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.isReady = false;
      this.logger.log('WhatsApp client logged out');
    }
  }

  async onModuleDestroy() {
    await this.logout();
  }
}
