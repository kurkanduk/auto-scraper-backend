# 📱 Раздельные пулы сообщений для Otomoto и AutoScout

## 🎯 Что изменилось

Теперь у вас есть **отдельные пулы сообщений** для каждого источника:

- **Otomoto** (Польша) - сообщения на польском языке
- **AutoScout** (Германия) - сообщения на немецком языке

## 🔧 Как использовать

### 1. Создание сообщений для Otomoto

```bash
curl -X POST http://localhost:3000/message-pool \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Dobrý deň, zaujíma ma vaše auto. Je stále k dispozícii?",
    "source": "otomoto",
    "isActive": true
  }'
```

### 2. Создание сообщений для AutoScout

```bash
curl -X POST http://localhost:3000/message-pool \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hallo, ich interessiere mich für Ihr Auto. Ist es noch verfügbar?",
    "source": "auto-scout",
    "isActive": true
  }'
```

### 3. Просмотр сообщений по источнику

```bash
# Все сообщения для Otomoto
curl http://localhost:3000/message-pool/source/otomoto

# Все сообщения для AutoScout
curl http://localhost:3000/message-pool/source/auto-scout

# Все сообщения с фильтром по источнику
curl "http://localhost:3000/message-pool?source=otomoto"
```

### 4. Тестирование пулов сообщений

```bash
# Тест раздельных пулов
curl http://localhost:3000/scraping/test-message-pools
```

## 🚀 Автоматическая работа

Теперь WhatsApp сервис **автоматически** выбирает правильные сообщения:

- **Для объявлений с Otomoto** → использует сообщения на польском языке
- **Для объявлений с AutoScout** → использует сообщения на немецком языке

## 📊 Структура базы данных

Таблица `message_pool` теперь содержит поле `source`:

```sql
CREATE TABLE message_pool (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  source VARCHAR(50) DEFAULT 'otomoto',  -- Новое поле!
  isActive BOOLEAN DEFAULT true,
  createdAt DATETIME,
  updatedAt DATETIME
);
```

## 🎨 Примеры сообщений

### Для Otomoto (Польша)

- "Dobrý deň, zaujíma ma vaše auto. Je stále k dispozícii?"
- "Ahoj, chcel by som sa opýtať na vaše auto. Môžete mi poslať viac informácií?"
- "Dobrý deň, zaujíma ma vaše vozidlo. Môžeme sa dohodnúť na stretnutí?"

### Для AutoScout (Германия)

- "Hallo, ich interessiere mich für Ihr Auto. Ist es noch verfügbar?"
- "Guten Tag, ich würde gerne mehr Informationen zu Ihrem Fahrzeug erhalten."
- "Hallo, können wir uns über Ihr Auto unterhalten?"

## 🔄 Миграция существующих данных

TypeORM автоматически добавит поле `source` со значением по умолчанию `'otomoto'` для всех существующих записей.

## ✅ Готово!

Теперь ваш бот будет отправлять **правильные сообщения на правильном языке** в зависимости от источника объявления!

