import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import * as QRCode from 'qrcode';
import { Listing, ListingSource } from '../../entities/listing.entity';
import { ContactLog, ContactStatus } from '../../entities/contact-log.entity';

import { defaultConfig } from '../../config/app.config';
import { MessagePool } from 'src/entities/message-pull.entity';
import { MessagePoolService } from '../message-pull/message-pull.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private client: Client;
  private isReady = false;
  private qrCodeDataUrl: string | null = null;
  private isAuthenticating = false;
  private isDevelopmentMode =
    process.env.NODE_ENV === 'development' ||
    process.env.WHATSAPP_DISABLED === 'true';
  private messageQueue: Array<{
    listing: Listing;
    resolve: (value: boolean) => void;
    reject: (reason?: any) => void;
  }> = [];
  private messageSentCount = 0;
  private lastHourReset = new Date();
  private dailyMessageCount = 0;
  private lastDayReset = new Date();
  private isProcessingQueue = false;

  constructor(
    @InjectRepository(ContactLog)
    private contactLogRepository: Repository<ContactLog>,
    @InjectRepository(MessagePool)
    private MessagesPool: Repository<MessagePool>,
    private messagePoolService: MessagePoolService,
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
    setTimeout(() => {
      this.startClient();
    }, 2000);
  }

  private async initializeClient() {
    const chromePath = this.getChromePath();

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'car-scraper-bot',
      }),
      puppeteer: {
        executablePath: chromePath,
        headless: true,
        timeout: 60000,
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
  private getChromePath(): string | undefined {
    // Try to use system Chrome first, then fall back to Puppeteer's Chrome
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/Applications/Chromium.app/Contents/MacOS/Chromium', // macOS Chromium
      '/usr/bin/google-chrome', // Linux
      '/usr/bin/chromium-browser', // Linux Chromium
      process.env.CHROME_PATH, // Custom path from environment
    ];

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    for (const path of possiblePaths) {
      if (path && fs.existsSync(path)) {
        this.logger.log(`WhatsApp using Chrome at: ${path}`);
        return path;
      }
    }

    this.logger.log('WhatsApp using Puppeteer bundled Chrome');
    return undefined; // Let Puppeteer use its bundled Chrome
  }

  async sendTestMessage(): Promise<boolean> {
    const testNumber = '+421950242008';
    const message = '✅ This is a test message from WhatsappService';

    if (this.isDevelopmentMode) {
      this.logger.log(`[DEV MODE] Would send test message to ${testNumber}`);
      return true;
    }

    try {
      await this.sendMessageWithRetry(testNumber, message);
      this.logger.log(`Test message sent to ${testNumber}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send test message to ${testNumber}: ${error.message}`,
      );
      return false;
    }
  }

  private async sendMessageWithRetry(
    number: string,
    message: string,
    maxRetries: number = 3,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.logger.log(`Send attempt ${attempt}/${maxRetries}`);

      try {
        // Method 1: Standard chatId format
        const chatId = this.formatPhoneNumber(number) + '@c.us';
        await this.client.sendMessage(chatId, message);
        this.logger.log(`Method 1 successful: ${chatId}`);
        return true;
      } catch (error1) {
        this.logger.warn(`Method 1 failed: ${error1.message}`);

        try {
          // Method 2: Get number ID first
          const numberId = await this.client.getNumberId(number);
          if (numberId && numberId.user) {
            const chatId2 = `${numberId.user}@c.us`;
            await this.client.sendMessage(chatId2, message);
            this.logger.log(`Method 2 successful: ${chatId2}`);
            return true;
          }
        } catch (error2) {
          this.logger.warn(`Method 2 failed: ${error2.message}`);
        }

        try {
          // Method 3: Direct number without country code manipulation
          await this.client.sendMessage(`${number}@c.us`, message);
          this.logger.log(`Method 3 successful`);
          return true;
        } catch (error3) {
          this.logger.warn(`Method 3 failed: ${error3.message}`);
        }

        if (attempt < maxRetries) {
          this.logger.log(`Waiting before retry...`);
          await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));

          // Check if we're still connected
          const state = await this.client.getState();
          if (state !== 'CONNECTED') {
            this.logger.error(`Client disconnected. State: ${state}`);
            break;
          }
        }
      }
    }

    return false;
  }

  private setupEventHandlers() {
    this.client.on('qr', async (qr) => {
      this.logger.log('QR Code received, scan with WhatsApp:');
      qrcode.generate(qr);

      // Generate QR code as base64 data URL for frontend
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
          width: 400,
          margin: 2,
        });
        this.isAuthenticating = true;
        this.logger.log('QR Code image generated and ready for frontend');
      } catch (error) {
        this.logger.error('Failed to generate QR code image:', error.message);
      }
    });

    this.client.on('ready', () => {
      this.logger.log('WhatsApp client is ready!');
      this.isReady = true;
      this.isAuthenticating = false;
      this.qrCodeDataUrl = null; // Clear QR code after authentication
      this.processMessageQueue();
    });

    this.client.on('authenticated', () => {
      this.logger.log('WhatsApp client authenticated');
      this.isAuthenticating = false;
      this.qrCodeDataUrl = null; // Clear QR code after authentication
    });

    this.client.on('auth_failure', (msg) => {
      this.logger.error('WhatsApp authentication failed:', msg);
      this.isAuthenticating = false;
      this.qrCodeDataUrl = null;
    });

    this.client.on('disconnected', (reason) => {
      this.logger.warn('WhatsApp client disconnected:', reason);
      this.isReady = false;
      this.isAuthenticating = false;
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
    }

    return new Promise((resolve, reject) => {
      this.messageQueue.push({ listing, resolve, reject });

      if (this.isReady) {
        this.processMessageQueue();
      }
    });
  }

  private async processMessageQueue() {
    // Prevent concurrent queue processing
    if (this.isProcessingQueue) {
      this.logger.debug('Queue is already being processed, skipping...');
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.messageQueue.length > 0 && this.isReady) {
        const { listing, resolve, reject } = this.messageQueue.shift()!;

        try {
          // Check rate limiting before sending
          if (!this.canSendMessage()) {
            this.logger.warn('⚠️ Rate limit reached, message queued for later');
            this.messageQueue.unshift({ listing, resolve, reject });
            break;
          }

          const success = await this.sendWhatsAppMessage(listing);
          resolve(success);

          if (success) {
            this.messageSentCount++;
            this.dailyMessageCount++;
          }

          // Random delay between messages (15-45 seconds) to avoid spam detection
          // Only delay if there are more messages in queue
          if (this.messageQueue.length > 0) {
            const minDelay = defaultConfig.whatsapp.minDelaySeconds * 1000;
            const maxDelay = defaultConfig.whatsapp.maxDelaySeconds * 1000;
            const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

            this.logger.log(`⏱️ Waiting ${(randomDelay / 1000).toFixed(1)}s before next message`);
            await this.delay(randomDelay);
          }
        } catch (error) {
          this.logger.error(
            `Error sending message for listing ${listing.id}:`,
            error,
          );
          reject(error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
  private testMessages = [
    'Dobrý deň, chcel by som sa opýtať, či je auto stále k dispozícii?',
  ];

  private async sendWhatsAppMessage(listing: Listing): Promise<boolean> {
    try {
      const number =
        listing.source === 'otomoto'
          ? `+48${listing.sellerPhone}`
          : listing.sellerPhone;
      const chatId = `${this.formatPhoneNumber(number)}@c.us`;

      let messages: string[] = [];
      try {
        messages = await this.getMessagesFromDB(listing.source);
      } catch (dbError) {
        this.logger.warn(
          `Failed to fetch messages from DB for source ${listing.source}: ${dbError.message}`,
        );
      }

      if (!messages || messages.length === 0) {
        messages = this.testMessages;
        this.logger.log(`Using fallback messages for source ${listing.source}`);
      }

      const message = messages[Math.floor(Math.random() * messages.length)];

      await this.client.sendMessage(chatId, message);

      await this.logContact(listing, number, message, ContactStatus.SENT);

      this.logger.log(`Message sent to ${number}: "${message}"`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message: ${error.message}`);
      return false;
    }
  }

  private async getMessagesFromDB(source: ListingSource): Promise<string[]> {
    try {
      const messages =
        await this.messagePoolService.getMessagesForSource(source);
      return messages;
    } catch (error) {
      this.logger.error(
        `Failed to fetch messages from DB for source ${source}: ${error.message}`,
      );
      return [];
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

    // Reset hourly counter
    const hoursSinceReset =
      (now.getTime() - this.lastHourReset.getTime()) / (1000 * 60 * 60);
    if (hoursSinceReset >= 1) {
      this.messageSentCount = 0;
      this.lastHourReset = now;
      this.logger.log('🔄 Hourly message counter reset');
    }

    // Reset daily counter
    const daysSinceReset =
      (now.getTime() - this.lastDayReset.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceReset >= 1) {
      this.dailyMessageCount = 0;
      this.lastDayReset = now;
      this.logger.log('🔄 Daily message counter reset');
    }

    // Check both hourly and daily limits
    const hourlyOk = this.messageSentCount < defaultConfig.whatsapp.maxMessagesPerHour;
    const dailyOk = this.dailyMessageCount < defaultConfig.whatsapp.maxMessagesPerDay;

    if (!hourlyOk) {
      this.logger.warn(`⚠️ Hourly limit reached: ${this.messageSentCount}/${defaultConfig.whatsapp.maxMessagesPerHour}`);
    }
    if (!dailyOk) {
      this.logger.warn(`⚠️ Daily limit reached: ${this.dailyMessageCount}/${defaultConfig.whatsapp.maxMessagesPerDay}`);
    }

    return hourlyOk && dailyOk;
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
        messagesSentToday: this.dailyMessageCount,
      };
    }

    if (!this.isReady) {
      return {
        ready: false,
        info: null,
        isAuthenticating: this.isAuthenticating,
        hasQrCode: !!this.qrCodeDataUrl,
      };
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
        messagesSentToday: this.dailyMessageCount,
        isAuthenticating: false,
        hasQrCode: false,
      };
    } catch (error) {
      return {
        ready: false,
        error: error.message,
        isAuthenticating: this.isAuthenticating,
        hasQrCode: !!this.qrCodeDataUrl,
      };
    }
  }

  getQrCode(): string | null {
    return this.qrCodeDataUrl;
  }

  isWaitingForAuth(): boolean {
    return this.isAuthenticating;
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
