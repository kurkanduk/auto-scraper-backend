# API Documentation - Car Scraper Bot

## Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Root Routes](#root-routes)
- [Message Pool Routes](#message-pool-routes)
- [Scraping Routes](#scraping-routes)
- [Data Models](#data-models)
- [Error Handling](#error-handling)

---

## Overview

This is a NestJS-based backend application that scrapes car listings from multiple sources (mobile.de, otomoto.pl, bazos.sk, autoscout24) and manages WhatsApp messaging to sellers. The application provides REST APIs for managing message templates, monitoring scraping status, and testing various scraping functionalities.

**Technology Stack:**
- NestJS (Node.js framework)
- TypeORM (Database ORM)
- WhatsApp Web.js (WhatsApp integration)
- Puppeteer (Web scraping)
- SQLite (Database)

---

## Base URL

**Development:** `http://localhost:3000`

**Production:** Depends on deployment (default port: 3000)

**CORS Enabled Origins:**
- `https://auto-bot-frontend.vercel.app`
- `http://localhost:5173`
- `http://194.163.167.191:3003`
- `http://194.163.167.191:5173`

---

## Authentication

Currently, this API does not implement authentication. All endpoints are publicly accessible.

---

## Root Routes

### 1. Get Hello Message
**Endpoint:** `GET /`

**Description:** Simple welcome endpoint.

**Response:**
```json
"Hello World!"
```

**Example:**
```bash
curl http://localhost:3000/
```

---

### 2. Health Check
**Endpoint:** `GET /health`

**Description:** Returns the health status of the application.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-13T10:30:00.000Z",
  "service": "Car Scraper Bot"
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

---

## Message Pool Routes

Base path: `/message-pool`

The message pool stores templates for WhatsApp messages that are sent to sellers. Each message is associated with a specific listing source (mobile.de, otomoto, etc.).

### 1. Get All Messages
**Endpoint:** `GET /message-pool`

**Description:** Retrieves all message templates, optionally filtered by source.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source | string | No | Filter by listing source: `mobile.de`, `otomoto`, `bazos`, `auto-scout` |

**Response:**
```json
[
  {
    "id": 1,
    "content": "Hello, I'm interested in your car...",
    "source": "otomoto",
    "isActive": true,
    "createdAt": "2025-10-13T10:00:00.000Z",
    "updatedAt": "2025-10-13T10:00:00.000Z"
  }
]
```

**Examples:**
```bash
# Get all messages
curl http://localhost:3000/message-pool

# Get messages for specific source
curl http://localhost:3000/message-pool?source=otomoto
```

---

### 2. Get Messages by Source
**Endpoint:** `GET /message-pool/source/:source`

**Description:** Retrieves all message templates for a specific source.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source | string | Yes | One of: `mobile.de`, `otomoto`, `bazos`, `auto-scout` |

**Response:**
```json
[
  {
    "id": 1,
    "content": "Hello, I'm interested in your car...",
    "source": "otomoto",
    "isActive": true,
    "createdAt": "2025-10-13T10:00:00.000Z",
    "updatedAt": "2025-10-13T10:00:00.000Z"
  }
]
```

**Example:**
```bash
curl http://localhost:3000/message-pool/source/otomoto
```

---

### 3. Get Message by ID
**Endpoint:** `GET /message-pool/:id`

**Description:** Retrieves a single message template by its ID.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Message ID |

**Response:**
```json
{
  "id": 1,
  "content": "Hello, I'm interested in your car...",
  "source": "otomoto",
  "isActive": true,
  "createdAt": "2025-10-13T10:00:00.000Z",
  "updatedAt": "2025-10-13T10:00:00.000Z"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "message": "Message not found"
}
```

**Example:**
```bash
curl http://localhost:3000/message-pool/1
```

---

### 4. Create Message
**Endpoint:** `POST /message-pool`

**Description:** Creates a new message template.

**Request Body:**
```json
{
  "content": "Hello, I'm interested in your car...",
  "source": "otomoto",
  "isActive": true
}
```

**Body Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| content | string | Yes | The message template content |
| source | string | Yes | One of: `mobile.de`, `otomoto`, `bazos`, `auto-scout` |
| isActive | boolean | No | Whether the message is active (default: true) |

**Response:**
```json
{
  "id": 1,
  "content": "Hello, I'm interested in your car...",
  "source": "otomoto",
  "isActive": true,
  "createdAt": "2025-10-13T10:00:00.000Z",
  "updatedAt": "2025-10-13T10:00:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/message-pool \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, I am interested in your car listing.",
    "source": "otomoto",
    "isActive": true
  }'
```

---

### 5. Update Message
**Endpoint:** `PUT /message-pool/:id`

**Description:** Updates an existing message template.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Message ID |

**Request Body:**
```json
{
  "content": "Updated message content",
  "source": "otomoto",
  "isActive": false
}
```

**Body Parameters (all optional):**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| content | string | No | The message template content |
| source | string | No | One of: `mobile.de`, `otomoto`, `bazos`, `auto-scout` |
| isActive | boolean | No | Whether the message is active |

**Response:**
```json
{
  "id": 1,
  "content": "Updated message content",
  "source": "otomoto",
  "isActive": false,
  "createdAt": "2025-10-13T10:00:00.000Z",
  "updatedAt": "2025-10-13T11:00:00.000Z"
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "message": "Message not found"
}
```

**Example:**
```bash
curl -X PUT http://localhost:3000/message-pool/1 \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated message",
    "isActive": false
  }'
```

---

### 6. Delete Message
**Endpoint:** `DELETE /message-pool/:id`

**Description:** Deletes a message template.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Message ID |

**Response:**
```json
{
  "success": true
}
```

**Error Response (404):**
```json
{
  "statusCode": 404,
  "message": "Message not found"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/message-pool/1
```

---

## Scraping Routes

Base path: `/scraping`

These routes manage the scraping process, cron jobs, and provide testing capabilities for various scrapers.

### 1. Get Scraping Status
**Endpoint:** `GET /scraping/status`

**Description:** Returns comprehensive statistics about scraping operations, filtering, and system status.

**Response:**
```json
{
  "scraping": {
    "totalListings": 150,
    "newListings": 25,
    "processedListings": 100,
    "rejectedListings": 25,
    "bySource": {
      "mobile.de": 50,
      "otomoto": 60,
      "bazos": 20,
      "auto-scout": 20
    }
  },
  "filtering": {
    "rules": {
      "minPrice": 5000,
      "maxPrice": 50000,
      "minYear": 2015,
      "maxMileage": 150000
    }
  },
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/status
```

---

### 2. Manual Send Messages
**Endpoint:** `POST /scraping/send`

**Description:** Manually trigger message sending (not yet implemented).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Number of listings to send (default: 1) |

**Response:**
```json
{
  "success": true,
  "message": "Manual sending not implemented yet for 1 listings"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/scraping/send?limit=5
```

---

### 3. Get Recent Listings
**Endpoint:** `GET /scraping/listings`

**Description:** Retrieves recently scraped car listings.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number/string | No | Number of listings to return (default: 10, use "all" for all listings) |

**Response:**
```json
{
  "listings": [
    {
      "id": 1,
      "externalId": "123456",
      "source": "otomoto",
      "url": "https://otomoto.pl/...",
      "title": "BMW 320d 2018",
      "price": 25000,
      "currency": "PLN",
      "year": 2018,
      "mileage": 85000,
      "make": "BMW",
      "model": "320d",
      "fuelType": "Diesel",
      "transmission": "Automatic",
      "location": "Warsaw",
      "sellerPhone": "+48123456789",
      "sellerType": "private",
      "status": "new",
      "createdAt": "2025-10-13T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

**Examples:**
```bash
# Get 10 most recent listings
curl http://localhost:3000/scraping/listings

# Get 50 most recent listings
curl http://localhost:3000/scraping/listings?limit=50

# Get all listings
curl http://localhost:3000/scraping/listings?limit=all
```

---

### 4. Get Contact Logs
**Endpoint:** `GET /scraping/contacts`

**Description:** Retrieves WhatsApp contact logs showing messages sent to sellers.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Number of logs to return (default: 10) |

**Response:**
```json
{
  "contacts": [
    {
      "id": 1,
      "listingId": 1,
      "phoneNumber": "+48123456789",
      "message": "Hello, I'm interested in your BMW...",
      "status": "sent",
      "sentAt": "2025-10-13T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/contacts?limit=20
```

---

### 5. Stop Cron Job
**Endpoint:** `POST /scraping/stop/:name`

**Description:** Stops a running cron job by name.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | The name of the cron job to stop |

**Response:**
```json
{
  "message": "Cron scraping-job stopped"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/scraping/stop/scraping-job
```

---

### 6. Start Cron Job
**Endpoint:** `POST /scraping/start/:name`

**Description:** Starts a stopped cron job by name.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | The name of the cron job to start |

**Response:**
```json
{
  "message": "Cron scraping-job started"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/scraping/start/scraping-job
```

---

### 7. Get Cron Job Status
**Endpoint:** `POST /scraping/status/:name`

**Description:** Gets the running status of a cron job.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | The name of the cron job |

**Response:**
```json
{
  "name": "scraping-job",
  "running": true
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/scraping/status/scraping-job
```

---

### 8. Send Test Message
**Endpoint:** `GET /scraping/test-message`

**Description:** Sends a test WhatsApp message.

**Response:**
```json
{
  "success": true,
  "message": "Test message sent"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/test-message
```

---

### 9. Get WhatsApp QR Code
**Endpoint:** `GET /scraping/whatsapp/qr-code`

**Description:** Retrieves the WhatsApp QR code for authentication. The QR code is returned as a base64 data URL that can be displayed directly in an `<img>` tag in the frontend.

**Response (When QR Code is Available):**
```json
{
  "message": "Scan this QR code with WhatsApp",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "isAuthenticating": true,
  "ready": false
}
```

**Response (When Already Authenticated):**
```json
{
  "message": "WhatsApp is already authenticated",
  "ready": true,
  "info": {
    "wid": "1234567890@c.us",
    "pushname": "John Doe",
    "platform": "android"
  }
}
```

**Response (When QR Code Not Ready):**
```json
{
  "message": "WhatsApp is not ready. QR code not available yet.",
  "isAuthenticating": false,
  "ready": false
}
```

**Usage in Frontend:**
```html
<!-- React/Vue/HTML example -->
<img src={qrCode} alt="WhatsApp QR Code" />
```

**Example:**
```bash
curl http://localhost:3000/scraping/whatsapp/qr-code
```

**Notes:**
- The QR code is automatically cleared after successful authentication
- Frontend should poll this endpoint every 2-3 seconds to get updated QR codes
- QR codes typically expire after 30-60 seconds and a new one is generated

---

### 10. Get WhatsApp Status
**Endpoint:** `GET /scraping/whatsapp/status`

**Description:** Gets the current status of the WhatsApp client, including authentication state and connection info.

**Response (When Ready):**
```json
{
  "ready": true,
  "info": {
    "wid": "1234567890@c.us",
    "pushname": "John Doe",
    "platform": "android"
  },
  "queueSize": 0,
  "messagesSentThisHour": 5,
  "isAuthenticating": false,
  "hasQrCode": false
}
```

**Response (When Not Ready):**
```json
{
  "ready": false,
  "info": null,
  "isAuthenticating": true,
  "hasQrCode": true
}
```

**Response (Development Mode):**
```json
{
  "ready": true,
  "developmentMode": true,
  "info": {
    "pushname": "Development Mode",
    "platform": "dev"
  },
  "queueSize": 0,
  "messagesSentThisHour": 0
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/whatsapp/status
```

---

### 11. Test Listing Filter
**Endpoint:** `GET /scraping/test-filter`

**Description:** Tests the filtering rules against a mock listing to see if it would pass or be rejected.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Listing title |
| price | number | No | Price |
| year | number | No | Vehicle year |
| mileage | number | No | Mileage in km |
| sellerType | string | No | One of: `private`, `dealer`, `unknown` |

**Response:**
```json
{
  "input": {
    "title": "BMW 320d 2018",
    "price": 25000,
    "year": 2018,
    "mileage": 85000,
    "sellerType": "private",
    "sellerPhone": "+1234567890"
  },
  "result": {
    "passes": true,
    "rejectionReason": null
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/scraping/test-filter?title=BMW%20320d&price=25000&year=2018&mileage=85000&sellerType=private"
```

---

### 12. Test Mobile.de Scraper
**Endpoint:** `GET /scraping/test-mobile-de`

**Description:** Tests the mobile.de scraper and returns sample listings.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Number of listings to return (default: 3) |

**Response:**
```json
{
  "message": "Successfully scraped 3 listings from mobile.de",
  "totalFound": 50,
  "limitedTo": 3,
  "listings": [
    {
      "externalId": "123456",
      "source": "mobile.de",
      "url": "https://mobile.de/...",
      "title": "BMW 320d",
      "price": 25000,
      "year": 2018,
      "mileage": 85000
    }
  ],
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Failed to scrape mobile.de",
  "message": "Connection timeout",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/test-mobile-de?limit=5
```

---

### 13. Test Mobile.de Detail Scraper
**Endpoint:** `GET /scraping/test-mobile-de-detail/:url`

**Description:** Tests scraping detailed information from a specific mobile.de listing URL.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | URL-encoded mobile.de listing URL |

**Response:**
```json
{
  "message": "Successfully scraped detailed listing",
  "url": "https://mobile.de/listing/123456",
  "details": {
    "title": "BMW 320d",
    "price": 25000,
    "description": "Full description...",
    "sellerPhone": "+491234567890",
    "sellerName": "John Doe",
    "location": "Berlin"
  },
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/test-mobile-de-detail/https%3A%2F%2Fmobile.de%2Flisting%2F123456
```

---

### 14. Test Bazos.sk Scraper
**Endpoint:** `GET /scraping/test-bazos`

**Description:** Tests the bazos.sk scraper and returns sample listings.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Number of listings to return (default: 5) |

**Response:**
```json
{
  "message": "Successfully scraped 5 listings from bazos.sk",
  "totalFound": 30,
  "limitedTo": 5,
  "listings": [
    {
      "externalId": "789012",
      "source": "bazos",
      "url": "https://bazos.sk/...",
      "title": "Skoda Octavia 2017",
      "price": 12000
    }
  ],
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/test-bazos?limit=10
```

---

### 15. Test Otomoto.pl Scraper
**Endpoint:** `GET /scraping/test-otomoto`

**Description:** Tests the otomoto.pl scraper and returns sample listings.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Number of listings to return (default: 5) |

**Response:**
```json
{
  "message": "Successfully scraped 5 listings from otomoto.pl",
  "totalFound": 40,
  "limitedTo": 5,
  "listings": [
    {
      "externalId": "345678",
      "source": "otomoto",
      "url": "https://otomoto.pl/...",
      "title": "Audi A4 2019",
      "price": 30000
    }
  ],
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/test-otomoto?limit=10
```

---

### 16. Test AutoScout24 Scraper
**Endpoint:** `GET /scraping/test-autoscout`

**Description:** Tests the autoscout24 scraper and returns sample listings.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Number of listings to return (default: 1) |

**Response:**
```json
{
  "message": "Successfully scraped 1 listings from autoscout",
  "totalFound": 25,
  "limitedTo": 1,
  "listings": [
    {
      "externalId": "901234",
      "source": "auto-scout",
      "url": "https://autoscout24.pl/...",
      "title": "Mercedes E220 2020",
      "price": 45000
    }
  ],
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/test-autoscout?limit=3
```

---

### 17. Manual Scrape
**Endpoint:** `POST /scraping/manual`

**Description:** Manually triggers a scraping operation for one or all sources.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source | string | No | Specific source to scrape: `mobile.de`, `otomoto`, `bazos`, `auto-scout` (default: all) |

**Response:**
```json
{
  "success": true,
  "message": "Manual scrape completed successfully",
  "source": "otomoto",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Scraping failed",
  "source": "otomoto",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Examples:**
```bash
# Scrape all sources
curl -X POST http://localhost:3000/scraping/manual

# Scrape specific source
curl -X POST "http://localhost:3000/scraping/manual?source=otomoto"
```

---

### 18. Manual Sending
**Endpoint:** `POST /scraping/manual-sending`

**Description:** Manually triggers message sending (not yet implemented).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source | string | No | Specific source (default: all) |

**Response:**
```json
{
  "success": true,
  "message": "Manual sending not implemented yet",
  "source": "all",
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/scraping/manual-sending
```

---

### 19. Test Message Pools
**Endpoint:** `GET /scraping/test-message-pools`

**Description:** Tests retrieval of messages from the message pool for different sources.

**Response:**
```json
{
  "message": "Message pools test completed",
  "otomoto": {
    "count": 3,
    "messages": [
      {
        "id": 1,
        "content": "Hello, I'm interested...",
        "source": "otomoto",
        "isActive": true
      }
    ]
  },
  "autoScout": {
    "count": 2,
    "messages": [
      {
        "id": 4,
        "content": "Good day, is this car still available?",
        "source": "auto-scout",
        "isActive": true
      }
    ]
  },
  "timestamp": "2025-10-13T10:30:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/scraping/test-message-pools
```

---

## Data Models

### Listing Source Enum
```typescript
enum ListingSource {
  MOBILE_DE = 'mobile.de',
  OTOMOTO = 'otomoto',
  BAZOS = 'bazos',
  AUTOSCOUT = 'auto-scout'
}
```

### Listing Status Enum
```typescript
enum ListingStatus {
  NEW = 'new',
  PROCESSED = 'processed',
  CONTACTED = 'contacted',
  REJECTED = 'rejected'
}
```

### Seller Type Enum
```typescript
enum SellerType {
  PRIVATE = 'private',
  DEALER = 'dealer',
  UNKNOWN = 'unknown'
}
```

### Contact Status Enum
```typescript
enum ContactStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read'
}
```

### Listing Entity
```typescript
{
  id: number;
  externalId: string;           // Unique ID from the source website
  source: ListingSource;
  url: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  make: string | null;           // e.g., BMW, Audi
  model: string | null;          // e.g., 320d, A4
  year: number | null;
  mileage: number | null;        // in kilometers
  fuelType: string | null;       // e.g., Diesel, Petrol, Electric
  transmission: string | null;   // e.g., Manual, Automatic
  location: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerType: SellerType;
  status: ListingStatus;
  rejectionReason: string | null;
  contactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  rawData: any | null;           // Original scraped data
}
```

### Message Pool Entity
```typescript
{
  id: number;
  content: string;               // Message template text
  source: ListingSource;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Contact Log Entity
```typescript
{
  id: number;
  listingId: number;
  listing: Listing;              // Related listing object
  phoneNumber: string;
  message: string;               // Actual message sent
  status: ContactStatus;
  errorMessage: string | null;
  sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
}
```

### Create Message DTO
```typescript
{
  content: string;               // Required
  source: ListingSource;         // Required
  isActive?: boolean;            // Optional, default: true
}
```

### Update Message DTO
```typescript
{
  content?: string;              // Optional
  source?: ListingSource;        // Optional
  isActive?: boolean;            // Optional
}
```

---

## Error Handling

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "statusCode": 404,
  "message": "Message not found",
  "error": "Not Found"
}
```

### Common Errors

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Message not found"
}
```

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["content should not be empty", "source must be a valid enum value"],
  "error": "Bad Request"
}
```

**500 Internal Server Error:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Notes

1. **Scraping Sources:** The application scrapes from mobile.de (Germany), otomoto.pl (Poland), bazos.sk (Slovakia), and autoscout24.
2. **WhatsApp Integration:** Uses whatsapp-web.js for sending messages. Requires QR code authentication on first run.
3. **Cron Jobs:** The application uses scheduled jobs for automatic scraping and messaging.
4. **Database:** Uses SQLite for storage. Database file is created automatically on first run.
5. **Puppeteer:** Used for web scraping. Runs in headless mode in production.

---

## Support

For issues or questions, please contact the development team or create an issue in the project repository.

---

**Last Updated:** October 13, 2025
