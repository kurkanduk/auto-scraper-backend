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
import { PhoneFormatter } from './utils/phone-formatter.util';
import { RateLimiter } from './utils/rate-limiter.util';

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
  private isProcessingQueue = false;
  private rateLimiter: RateLimiter;

  constructor(
    @InjectRepository(ContactLog)
    private contactLogRepository: Repository<ContactLog>,
    @InjectRepository(MessagePool)
    private MessagesPool: Repository<MessagePool>,
    private messagePoolService: MessagePoolService,
  ) {
    this.rateLimiter = new RateLimiter({
      maxMessagesPerHour: defaultConfig.whatsapp.maxMessagesPerHour,
      maxMessagesPerDay: defaultConfig.whatsapp.maxMessagesPerDay,
    });
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
    // Prioritize Linux paths for production, then macOS for development
    const possiblePaths = [
      process.env.CHROME_PATH, // Custom path from environment (highest priority)
      '/usr/bin/chromium-browser', // Linux Chromium (production)
      '/usr/bin/google-chrome', // Linux Chrome (production)
      '/usr/bin/chromium', // Alternative Linux path
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS (dev)
      '/Applications/Chromium.app/Contents/MacOS/Chromium', // macOS Chromium (dev)
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

  /**
   * Sends a test message to verify WhatsApp connectivity
   *
   * @returns Promise<boolean> - True if test message sent successfully
   */
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

  /**
   * Sends a message with automatic retry logic using multiple methods
   *
   * @param number - Phone number to send to
   * @param message - Message text to send
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @returns Promise<boolean> - True if message sent successfully
   */
  private async sendMessageWithRetry(
    number: string,
    message: string,
    maxRetries: number = 3,
  ): Promise<boolean> {
    const retryDelay = 3000; // 3 seconds base delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.logger.log(`Send attempt ${attempt}/${maxRetries}`);

      try {
        // Method 1: Standard chatId format with formatted number
        const chatId = PhoneFormatter.toChatId(number);
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
          const waitTime = retryDelay * attempt;
          this.logger.log(`Waiting ${waitTime}ms before retry...`);
          await this.delay(waitTime);

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

    // Removed message_create event handler - no longer logging received messages
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

  /**
   * Queues a WhatsApp message for a listing
   * In production, adds to queue for processing
   * In development mode, only logs the action
   *
   * @param listing - The listing to send a message about
   * @returns Promise<boolean> - Resolves when message is sent or queued
   */
  async sendMessage(listing: Listing): Promise<boolean> {
    if (this.isDevelopmentMode) {
      this.logger.log(
        `[DEV MODE] Would send WhatsApp message to ${listing.sellerPhone} for: ${listing.title}`,
      );

      // Log the contact in development mode with fallback message
      await this.logContact(
        listing,
        listing.sellerPhone || 'unknown',
        this.testMessages[0],
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

  /**
   * Processes the message queue with rate limiting and delays
   * Prevents concurrent processing and respects rate limits
   */
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
          if (!this.rateLimiter.canSendMessage()) {
            this.logger.warn('⚠️ Rate limit reached, message queued for later');
            this.messageQueue.unshift({ listing, resolve, reject });
            break;
          }

          const success = await this.sendWhatsAppMessage(listing);
          resolve(success);

          if (success) {
            this.rateLimiter.incrementCount();
          }

          // Random delay between messages (15-45 seconds) to avoid spam detection
          // Only delay if there are more messages in queue
          if (this.messageQueue.length > 0) {
            const minDelay = defaultConfig.whatsapp.minDelaySeconds * 1000;
            const maxDelay = defaultConfig.whatsapp.maxDelaySeconds * 1000;
            const randomDelay =
              Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

            this.logger.log(
              `⏱️ Waiting ${(randomDelay / 1000).toFixed(1)}s before next message`,
            );
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

  /**
   * Sends a WhatsApp message to a listing's seller
   *
   * @param listing - The listing to contact
   * @returns Promise<boolean> - True if message sent successfully
   */
  private async sendWhatsAppMessage(listing: Listing): Promise<boolean> {
    try {
      // Validate phone number
      if (!PhoneFormatter.isValidPhone(listing.sellerPhone)) {
        this.logger.warn(
          `Invalid phone number for listing ${listing.id}: ${listing.sellerPhone}`,
        );
        return false;
      }

      // Add source-specific prefix and format
      const number = PhoneFormatter.addSourcePrefix(
        listing.sellerPhone,
        listing.source,
      );
      const chatId = PhoneFormatter.toChatId(number);

      // Fetch messages from database
      let messages: string[] = [];
      try {
        messages = await this.getMessagesFromDB(listing.source);
      } catch (dbError) {
        this.logger.warn(
          `Failed to fetch messages from DB for source ${listing.source}: ${dbError.message}`,
        );
      }

      // Fallback to test messages if none found
      if (!messages || messages.length === 0) {
        messages = this.testMessages;
        this.logger.log(`Using fallback messages for source ${listing.source}`);
      }

      // Select random message from pool
      const message = messages[Math.floor(Math.random() * messages.length)];

      // Send the message
      await this.client.sendMessage(chatId, message);

      // Log the contact
      await this.logContact(listing, number, message, ContactStatus.SENT);

      this.logger.log(`Message sent to ${number}: "${message}"`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message: ${error.message}`);
      return false;
    }
  }

  /**
   * Fetches message templates from database for a specific source
   *
   * @param source - The listing source to get messages for
   * @returns Array of message templates
   */
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

  /**
   * Logs a contact attempt to the database
   *
   * @param listing - The listing being contacted
   * @param phoneNumber - The phone number contacted
   * @param message - The message sent
   * @param status - Status of the contact attempt
   * @param errorMessage - Optional error message if failed
   */
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets WhatsApp client status and statistics
   *
   * @returns Client info including connection status and message stats
   */
  async getClientInfo(): Promise<any> {
    const stats = this.rateLimiter.getStats();

    if (this.isDevelopmentMode) {
      return {
        ready: true,
        developmentMode: true,
        info: { pushname: 'Development Mode', platform: 'dev' },
        queueSize: this.messageQueue.length,
        messagesSentThisHour: stats.messagesSentThisHour,
        messagesSentToday: stats.messagesSentToday,
        hourlyLimit: stats.hourlyLimit,
        dailyLimit: stats.dailyLimit,
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
        messagesSentThisHour: stats.messagesSentThisHour,
        messagesSentToday: stats.messagesSentToday,
        hourlyLimit: stats.hourlyLimit,
        dailyLimit: stats.dailyLimit,
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
