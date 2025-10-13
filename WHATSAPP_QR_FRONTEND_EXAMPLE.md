# WhatsApp QR Code Frontend Integration Example

This guide shows how to integrate the WhatsApp QR code authentication into your frontend application.

## Overview

The backend now generates QR codes as base64 data URLs that can be displayed directly in your frontend. The QR code is automatically cleared after successful authentication.

## API Endpoints

- **GET** `/scraping/whatsapp/qr-code` - Get the current QR code
- **GET** `/scraping/whatsapp/status` - Get WhatsApp connection status

## React Example

```jsx
import React, { useState, useEffect } from 'react';

function WhatsAppAuth() {
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);

  // Poll for QR code and status
  useEffect(() => {
    const fetchQrCode = async () => {
      try {
        const response = await fetch('http://localhost:3000/scraping/whatsapp/qr-code');
        const data = await response.json();

        if (data.ready) {
          setQrCode(null);
          setStatus({ ready: true, info: data.info });
        } else if (data.qrCode) {
          setQrCode(data.qrCode);
          setStatus({ ready: false, isAuthenticating: data.isAuthenticating });
        } else {
          setQrCode(null);
          setStatus({ ready: false, message: data.message });
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching QR code:', error);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchQrCode();

    // Poll every 3 seconds
    const interval = setInterval(fetchQrCode, 3000);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div>Loading WhatsApp status...</div>;
  }

  if (status.ready) {
    return (
      <div className="whatsapp-authenticated">
        <h2>WhatsApp Connected</h2>
        <p>Authenticated as: {status.info?.pushname}</p>
        <p>Platform: {status.info?.platform}</p>
      </div>
    );
  }

  return (
    <div className="whatsapp-auth">
      <h2>Scan QR Code with WhatsApp</h2>
      {qrCode ? (
        <div>
          <img
            src={qrCode}
            alt="WhatsApp QR Code"
            style={{ width: '400px', height: '400px' }}
          />
          <p>Open WhatsApp on your phone and scan this code</p>
          <p className="hint">
            Go to Settings → Linked Devices → Link a Device
          </p>
        </div>
      ) : (
        <div>
          <p>{status.message || 'Initializing WhatsApp...'}</p>
          <div className="spinner">Loading...</div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppAuth;
```

## Vue 3 Example

```vue
<template>
  <div class="whatsapp-auth">
    <div v-if="loading">Loading WhatsApp status...</div>

    <div v-else-if="status.ready" class="authenticated">
      <h2>WhatsApp Connected</h2>
      <p>Authenticated as: {{ status.info?.pushname }}</p>
      <p>Platform: {{ status.info?.platform }}</p>
    </div>

    <div v-else>
      <h2>Scan QR Code with WhatsApp</h2>
      <div v-if="qrCode">
        <img
          :src="qrCode"
          alt="WhatsApp QR Code"
          style="width: 400px; height: 400px;"
        />
        <p>Open WhatsApp on your phone and scan this code</p>
        <p class="hint">
          Go to Settings → Linked Devices → Link a Device
        </p>
      </div>
      <div v-else>
        <p>{{ status.message || 'Initializing WhatsApp...' }}</p>
        <div class="spinner">Loading...</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const qrCode = ref(null);
const status = ref({});
const loading = ref(true);
let interval = null;

const fetchQrCode = async () => {
  try {
    const response = await fetch('http://localhost:3000/scraping/whatsapp/qr-code');
    const data = await response.json();

    if (data.ready) {
      qrCode.value = null;
      status.value = { ready: true, info: data.info };
    } else if (data.qrCode) {
      qrCode.value = data.qrCode;
      status.value = { ready: false, isAuthenticating: data.isAuthenticating };
    } else {
      qrCode.value = null;
      status.value = { ready: false, message: data.message };
    }
    loading.value = false;
  } catch (error) {
    console.error('Error fetching QR code:', error);
    loading.value = false;
  }
};

onMounted(() => {
  fetchQrCode();
  interval = setInterval(fetchQrCode, 3000);
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<style scoped>
.whatsapp-auth {
  text-align: center;
  padding: 20px;
}

.hint {
  color: #666;
  font-size: 14px;
  margin-top: 10px;
}

.spinner {
  margin-top: 20px;
  color: #25D366;
}
</style>
```

## Vanilla JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>WhatsApp QR Code Authentication</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      text-align: center;
    }
    #qrCode {
      width: 400px;
      height: 400px;
      margin: 20px auto;
    }
    .hint {
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="app">
    <h1>WhatsApp Authentication</h1>
    <div id="content">Loading...</div>
  </div>

  <script>
    const API_URL = 'http://localhost:3000';

    async function fetchQrCode() {
      try {
        const response = await fetch(`${API_URL}/scraping/whatsapp/qr-code`);
        const data = await response.json();

        const contentDiv = document.getElementById('content');

        if (data.ready) {
          contentDiv.innerHTML = `
            <h2>WhatsApp Connected ✓</h2>
            <p>Authenticated as: ${data.info?.pushname}</p>
            <p>Platform: ${data.info?.platform}</p>
          `;
        } else if (data.qrCode) {
          contentDiv.innerHTML = `
            <h2>Scan QR Code with WhatsApp</h2>
            <img id="qrCode" src="${data.qrCode}" alt="WhatsApp QR Code" />
            <p>Open WhatsApp on your phone and scan this code</p>
            <p class="hint">Go to Settings → Linked Devices → Link a Device</p>
          `;
        } else {
          contentDiv.innerHTML = `
            <p>${data.message || 'Initializing WhatsApp...'}</p>
          `;
        }
      } catch (error) {
        console.error('Error fetching QR code:', error);
        document.getElementById('content').innerHTML = `
          <p style="color: red;">Error: ${error.message}</p>
        `;
      }
    }

    // Initial fetch
    fetchQrCode();

    // Poll every 3 seconds
    setInterval(fetchQrCode, 3000);
  </script>
</body>
</html>
```

## Angular Example

```typescript
// whatsapp-auth.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface QrCodeResponse {
  message: string;
  qrCode?: string;
  ready: boolean;
  isAuthenticating?: boolean;
  info?: {
    wid: string;
    pushname: string;
    platform: string;
  };
}

@Component({
  selector: 'app-whatsapp-auth',
  template: `
    <div class="whatsapp-auth">
      <div *ngIf="loading">Loading WhatsApp status...</div>

      <div *ngIf="!loading && status?.ready" class="authenticated">
        <h2>WhatsApp Connected</h2>
        <p>Authenticated as: {{ status.info?.pushname }}</p>
        <p>Platform: {{ status.info?.platform }}</p>
      </div>

      <div *ngIf="!loading && !status?.ready">
        <h2>Scan QR Code with WhatsApp</h2>
        <div *ngIf="qrCode">
          <img
            [src]="qrCode"
            alt="WhatsApp QR Code"
            style="width: 400px; height: 400px;"
          />
          <p>Open WhatsApp on your phone and scan this code</p>
          <p class="hint">
            Go to Settings → Linked Devices → Link a Device
          </p>
        </div>
        <div *ngIf="!qrCode">
          <p>{{ status?.message || 'Initializing WhatsApp...' }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .whatsapp-auth {
      text-align: center;
      padding: 20px;
    }
    .hint {
      color: #666;
      font-size: 14px;
      margin-top: 10px;
    }
  `]
})
export class WhatsappAuthComponent implements OnInit, OnDestroy {
  qrCode: string | null = null;
  status: any = {};
  loading = true;
  private subscription?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Poll every 3 seconds
    this.subscription = interval(3000)
      .pipe(
        switchMap(() =>
          this.http.get<QrCodeResponse>('http://localhost:3000/scraping/whatsapp/qr-code')
        )
      )
      .subscribe({
        next: (data) => {
          if (data.ready) {
            this.qrCode = null;
            this.status = { ready: true, info: data.info };
          } else if (data.qrCode) {
            this.qrCode = data.qrCode;
            this.status = { ready: false, isAuthenticating: data.isAuthenticating };
          } else {
            this.qrCode = null;
            this.status = { ready: false, message: data.message };
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error fetching QR code:', error);
          this.loading = false;
        }
      });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
```

## Key Points

1. **Polling Interval**: Poll the QR code endpoint every 2-3 seconds to get updates
2. **QR Code Format**: The QR code is returned as a base64 data URL (e.g., `data:image/png;base64,...`)
3. **Direct Display**: You can use the data URL directly in an `<img>` tag's `src` attribute
4. **Auto-Clear**: The QR code is automatically cleared after successful authentication
5. **Status Monitoring**: Use the `/scraping/whatsapp/status` endpoint for more detailed status information

## Production Considerations

- Add proper error handling for network failures
- Implement exponential backoff if the backend is unavailable
- Show loading states and error messages appropriately
- Stop polling when the component is unmounted
- Consider using WebSockets for real-time updates instead of polling
