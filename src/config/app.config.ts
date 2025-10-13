export interface AppConfig {
  scraping: {
    intervalMinutes: number;
    maxRetries: number;
    delayBetweenRequests: number;
  };
  filtering: {
    maxPrice: number;
    minYear: number;
    maxMileage: number;
    allowedFuelTypes: string[];
    excludeKeywords: string[];
    requiredKeywords: string[];
  };
  whatsapp: {
    messageTemplate: string;
    maxMessagesPerHour: number;
    maxMessagesPerDay: number;
    minDelaySeconds: number;
    maxDelaySeconds: number;
  };
}

export const defaultConfig: AppConfig = {
  scraping: {
    intervalMinutes: 15,
    maxRetries: 3,
    delayBetweenRequests: 2000,
  },
  filtering: {
    maxPrice: 50000,
    minYear: 2015,
    maxMileage: 150000,
    allowedFuelTypes: ['petrol', 'diesel', 'hybrid', 'electric'],
    excludeKeywords: ['accident', 'damage', 'salvage', 'export'],
    requiredKeywords: [],
  },
  whatsapp: {
    messageTemplate: `Здравствуйте! Меня интересует ваше объявление о продаже автомобиля {make} {model} {year} года. Можете ли вы предоставить дополнительную информацию?

Ссылка на объявление: {url}

Спасибо!`,
    maxMessagesPerHour: 5, // Reduced from 10 for safety
    maxMessagesPerDay: 50, // Daily limit to prevent bans
    minDelaySeconds: 15, // Minimum 15 seconds between messages
    maxDelaySeconds: 45, // Maximum 45 seconds (random)
  },
};
