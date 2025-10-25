# WhatsApp Service Architecture

## Overview

The WhatsApp module provides automated messaging functionality for contacting car listing sellers. It's designed with anti-spam protection, rate limiting, and retry logic to ensure reliable message delivery while avoiding detection.

## Architecture

### Module Structure

```
src/modules/whatsapp/
├── whatsapp.service.ts              # Core WhatsApp client & messaging logic
├── whatsapp-messaging-cron.service.ts  # Scheduled message sending
├── whatsapp.module.ts                # NestJS module definition
└── utils/
    ├── phone-formatter.util.ts      # Phone number formatting utilities
    └── rate-limiter.util.ts         # Message rate limiting utilities
```

## Core Components

### 1. WhatsAppService (`whatsapp.service.ts`)

Main service responsible for WhatsApp client management and message sending.

#### Key Responsibilities:
- **Client Lifecycle**: Initialize, authenticate, and maintain WhatsApp Web connection
- **Message Queue**: Queue-based message processing with anti-spam delays
- **Message Sending**: Multi-method retry logic for reliable delivery
- **Contact Logging**: Track all message attempts in database
- **QR Code Management**: Handle authentication via QR code for frontend display

#### Important Features:

**Development Mode**
- Controlled via `NODE_ENV=development` or `WHATSAPP_DISABLED=true`
- Messages are logged but not actually sent
- Useful for testing without spamming real numbers

**Message Queue Processing**
```typescript
// Messages are queued and processed sequentially
// with random delays (15-45s) between sends to avoid spam detection
private messageQueue: Array<{
  listing: Listing;
  resolve: (value: boolean) => void;
  reject: (reason?: any) => void;
}>
```

**Multi-Method Retry Logic**
When sending a message, the service tries 3 different methods:
1. Standard formatted phone number → chatId
2. Use WhatsApp's `getNumberId()` API
3. Direct number without formatting

Each method is retried up to 3 times with increasing delays (3s, 6s, 9s).

#### Public Methods:

| Method | Description | Returns |
|--------|-------------|---------|
| `sendMessage(listing)` | Queue a message for a listing | `Promise<boolean>` |
| `sendTestMessage()` | Send a test message to verify connectivity | `Promise<boolean>` |
| `getClientInfo()` | Get WhatsApp client status & stats | `Promise<object>` |
| `getQrCode()` | Get current QR code for authentication | `string \| null` |
| `isWaitingForAuth()` | Check if waiting for QR scan | `boolean` |
| `getContactLogs(limit?)` | Get recent contact logs | `Promise<ContactLog[]>` |
| `getContactStatistics()` | Get contact success/failure stats | `Promise<object>` |
| `logout()` | Disconnect WhatsApp client | `Promise<void>` |

---

### 2. MessagingCronService (`whatsapp-messaging-cron.service.ts`)

Handles scheduled automatic message sending via cron jobs.

#### Key Features:

**Working Hours Protection**
```typescript
// Only sends messages between 9:00 AM - 8:00 PM
if (hour < 9 || hour >= 20) {
  return; // Skip outside working hours
}
```

**Status Management**
- Fetches listings with status `PROCESSED`
- **Marks as `CONTACTED` BEFORE sending** (prevents duplicates)
- Reverts to `PROCESSED` on failure (allows retry)

**Cron Schedule**
- Runs every 30 minutes
- Processes up to 3 listings per run (configurable)
- Manual trigger available via `startManualSending(limit)`

#### Important Fix (2024-10)
Fixed race condition where status was updated AFTER sending, causing duplicate messages if the app crashed mid-send. Now status is marked BEFORE sending and reverted on failure.

---

### 3. PhoneFormatter Utility (`utils/phone-formatter.util.ts`)

Static utility class for phone number formatting across different countries and listing sources.

#### Methods:

**`formatPhoneNumber(phone: string): string`**
- Removes non-digit characters
- Auto-adds country codes for:
  - German numbers (0xxx → 49xxx)
  - Polish numbers (9 digits → 48xxx)
  - Czech numbers (9 digits → 420xxx)

**`toChatId(phone: string): string`**
- Formats phone to WhatsApp chat ID format
- Example: `+48123456789` → `48123456789@c.us`

**`addSourcePrefix(phone: string, source: ListingSource): string`**
- Adds source-specific prefixes
- Example: Otomoto listings get `+48` prefix

**`isValidPhone(phone: string | null | undefined): boolean`**
- Validates phone has minimum 9 digits

#### Example Usage:
```typescript
const chatId = PhoneFormatter.toChatId('+48123456789');
// Result: '48123456789@c.us'

const isValid = PhoneFormatter.isValidPhone('123456789');
// Result: true
```

---

### 4. RateLimiter Utility (`utils/rate-limiter.util.ts`)

Manages message sending limits to prevent spam detection and WhatsApp bans.

#### Configuration:
```typescript
interface RateLimiterConfig {
  maxMessagesPerHour: number;  // Default: 10
  maxMessagesPerDay: number;   // Default: 50
}
```

#### Methods:

**`canSendMessage(): boolean`**
- Checks if message can be sent within limits
- Auto-resets counters after time periods
- Logs warnings when limits reached

**`incrementCount(): void`**
- Call after successful send
- Updates both hourly and daily counters

**`getStats(): object`**
- Returns current statistics:
  - `messagesSentThisHour`
  - `messagesSentToday`
  - `hourlyLimit`
  - `dailyLimit`

**`reset(): void`**
- Manual reset (useful for testing)

#### Example Usage:
```typescript
if (!rateLimiter.canSendMessage()) {
  console.log('Rate limit reached, try later');
  return;
}

// Send message...
rateLimiter.incrementCount();
```

---

## Message Flow

### 1. Cron Job Triggers
```
MessagingCronService (every 30 min)
  ↓
Check working hours (9 AM - 8 PM)
  ↓
Fetch up to 3 PROCESSED listings
  ↓
For each listing:
  ↓
Mark as CONTACTED (prevents duplicates)
  ↓
Call whatsappService.sendMessage(listing)
  ↓
[If success] ✅ Keep CONTACTED status
[If failure] ⚠️ Revert to PROCESSED (allows retry)
```

### 2. Message Sending Process
```
whatsappService.sendMessage(listing)
  ↓
Add to message queue
  ↓
processMessageQueue()
  ↓
Check rate limits (RateLimiter)
  ↓
[If limit reached] ⚠️ Queue for later
  ↓
sendWhatsAppMessage(listing)
  ↓
Validate phone (PhoneFormatter)
  ↓
Format phone to chatId (PhoneFormatter)
  ↓
Fetch message from pool (or use fallback)
  ↓
Try sending (with 3 retry methods × 3 attempts)
  ↓
Log contact attempt to database
  ↓
[If more in queue] Wait 15-45s random delay
  ↓
Process next message
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Set to `development` to disable WhatsApp | `production` |
| `WHATSAPP_DISABLED` | Set to `true` to disable WhatsApp | `false` |
| `CHROME_PATH` | Custom Chrome/Chromium path | Auto-detect |

### App Config (`config/app.config.ts`)

```typescript
whatsapp: {
  maxMessagesPerHour: 10,     // Hourly rate limit
  maxMessagesPerDay: 50,       // Daily rate limit
  minDelaySeconds: 15,         // Min delay between messages
  maxDelaySeconds: 45,         // Max delay between messages
  messageTemplate: '...',      // Deprecated (now uses MessagePool)
}
```

---

## Database Entities

### ContactLog
Tracks every message attempt:
- `listingId`: Associated listing
- `phoneNumber`: Phone contacted
- `message`: Message content sent
- `status`: SENT | DELIVERED | FAILED
- `sentAt`: Timestamp
- `errorMessage`: Optional error details

### MessagePool
Stores message templates by source:
- `source`: mobile.de | otomoto | bazos | auto-scout
- `message`: Template text
- `isActive`: Enable/disable flag

---

## Anti-Spam Protections

### 1. Rate Limiting
- Maximum 10 messages/hour
- Maximum 50 messages/day
- Enforced by `RateLimiter` utility

### 2. Random Delays
- 15-45 second random delay between messages
- Prevents pattern detection

### 3. Working Hours
- Only sends 9 AM - 8 PM
- Prevents night-time spam complaints

### 4. Retry Limits
- Max 3 retry methods per send
- Max 3 attempts per method
- Increasing backoff delays (3s → 6s → 9s)

### 5. Development Mode
- Test without sending real messages
- Prevents accidental spam during development

---

## Error Handling

### Connection Failures
- Auto-retry initialization every 30 seconds
- Check connection state before retries
- Graceful degradation to development mode

### Send Failures
- Try 3 different sending methods
- Log all failures to database
- Revert listing status for retry

### Database Errors
- Catch and log contact log failures
- Don't block message sending
- Fall back to test messages if pool unavailable

---

## Testing

### Test Message
```bash
# Via API endpoint or service method
whatsappService.sendTestMessage();
# Sends: "✅ This is a test message from WhatsappService"
# To: +421950242008 (configured test number)
```

### Development Mode
```bash
# Set environment variable
export NODE_ENV=development

# Or in .env file
WHATSAPP_DISABLED=true
```

Messages will be logged but not sent.

---

## Common Issues & Solutions

### Issue: Duplicate Messages
**Cause**: Status updated after send (race condition)
**Fix**: Now updates status BEFORE sending (fixed Oct 2024)

### Issue: Promise Never Resolves (Dev Mode)
**Cause**: Missing `return true` in development mode
**Fix**: Added explicit return (fixed Oct 2024)

### Issue: WhatsApp Disconnects Frequently
**Cause**: Chrome/Chromium path issues
**Solution**: Set `CHROME_PATH` environment variable to valid Chrome installation

### Issue: Messages Not Sending
**Check**:
1. Is it working hours? (9 AM - 8 PM)
2. Rate limit reached? (Check `getClientInfo()`)
3. Is client ready? (Check `isReady` status)
4. Any listings with `PROCESSED` status?

---

## Future Improvements

### Potential Enhancements:
1. **Message Templates**: Add variables like {price}, {location} to messages
2. **Source-Specific Delays**: Different delays per source
3. **Webhook Integration**: Real-time delivery status from WhatsApp
4. **Message Scheduling**: Spread messages throughout the day
5. **A/B Testing**: Test different message templates
6. **Conversation Tracking**: Track replies from sellers
7. **Blacklist**: Skip previously contacted numbers

---

## Monitoring

### Key Metrics to Monitor:
- Messages sent per hour/day
- Success/failure rate
- Queue size
- Connection uptime
- Working hours compliance

### Available Statistics:
```typescript
// Get client info
const info = await whatsappService.getClientInfo();
console.log(info.messagesSentThisHour); // Current hour
console.log(info.messagesSentToday);    // Today's total

// Get contact statistics
const stats = await whatsappService.getContactStatistics();
console.log(stats.successRate); // Percentage
console.log(stats.failed);      // Failed count
```

---

## Dependencies

- `whatsapp-web.js`: WhatsApp Web client library
- `qrcode-terminal`: QR code terminal display
- `qrcode`: QR code generation for frontend
- `puppeteer`: Headless Chrome automation (via whatsapp-web.js)

---

## Security Considerations

1. **Phone Numbers**: Sanitize and validate all phone numbers
2. **Message Content**: Use approved templates from MessagePool
3. **Rate Limiting**: Strictly enforced to prevent bans
4. **Authentication**: QR code exposed via API (consider rate limiting)
5. **Logging**: All contacts logged with timestamps for audit trail

---

## Changelog

### October 2024
- ✅ Fixed duplicate message bug (status update race condition)
- ✅ Fixed development mode promise resolution
- ✅ Refactored phone formatting to utility class
- ✅ Extracted rate limiting to separate utility
- ✅ Added JSDoc comments to all public methods
- ✅ Removed deprecated `generateMessage()` method
- ✅ Improved error handling and logging

---

## References

- [whatsapp-web.js Documentation](https://wwebjs.dev/)
- [NestJS Cron Documentation](https://docs.nestjs.com/techniques/task-scheduling)
- Message Pool Service: `src/modules/message-pull/`
- Scraping Service: `src/modules/scraping/`
