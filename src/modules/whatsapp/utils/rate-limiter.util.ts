import { Logger } from '@nestjs/common';

export interface RateLimiterConfig {
  maxMessagesPerHour: number;
  maxMessagesPerDay: number;
}

/**
 * Utility class for managing message rate limiting
 * Tracks hourly and daily message counts to prevent spam detection
 */
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private messageSentCount = 0;
  private lastHourReset = new Date();
  private dailyMessageCount = 0;
  private lastDayReset = new Date();

  constructor(private readonly config: RateLimiterConfig) {}

  /**
   * Checks if a message can be sent based on rate limits
   *
   * @returns True if message can be sent, false if limit reached
   */
  canSendMessage(): boolean {
    this.resetCountersIfNeeded();

    const hourlyOk =
      this.messageSentCount < this.config.maxMessagesPerHour;
    const dailyOk =
      this.dailyMessageCount < this.config.maxMessagesPerDay;

    if (!hourlyOk) {
      this.logger.warn(
        `⚠️ Hourly limit reached: ${this.messageSentCount}/${this.config.maxMessagesPerHour}`,
      );
    }
    if (!dailyOk) {
      this.logger.warn(
        `⚠️ Daily limit reached: ${this.dailyMessageCount}/${this.config.maxMessagesPerDay}`,
      );
    }

    return hourlyOk && dailyOk;
  }

  /**
   * Increments the message counters after a successful send
   */
  incrementCount(): void {
    this.messageSentCount++;
    this.dailyMessageCount++;
  }

  /**
   * Resets hourly and daily counters if the time period has elapsed
   */
  private resetCountersIfNeeded(): void {
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
  }

  /**
   * Gets current message count statistics
   *
   * @returns Object containing hourly and daily counts
   */
  getStats(): {
    messagesSentThisHour: number;
    messagesSentToday: number;
    hourlyLimit: number;
    dailyLimit: number;
  } {
    this.resetCountersIfNeeded();
    return {
      messagesSentThisHour: this.messageSentCount,
      messagesSentToday: this.dailyMessageCount,
      hourlyLimit: this.config.maxMessagesPerHour,
      dailyLimit: this.config.maxMessagesPerDay,
    };
  }

  /**
   * Manually resets all counters (useful for testing)
   */
  reset(): void {
    this.messageSentCount = 0;
    this.dailyMessageCount = 0;
    this.lastHourReset = new Date();
    this.lastDayReset = new Date();
    this.logger.log('🔄 Rate limiter manually reset');
  }
}
