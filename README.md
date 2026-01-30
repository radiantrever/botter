# 🤖 Telegram Paywall Platform

A comprehensive Telegram bot platform for channel monetization with subscription management, automated access control, and secure payment processing.

## 🌟 Features

- **Multi-language Support**: Uzbek, English, and Russian interfaces
- **Subscription Management**: Create and manage multiple subscription plans
- **Automated Access Control**: Automatic user enrollment and expiration handling
- **Deep Link Integration**: Direct channel access via shareable links
- **Payment Processing**: Secure integration with TsPay payment system
- **Creator Dashboard**: Complete wallet management and analytics
- **Background Workers**: Automated subscription expiration enforcement
- **Admin Monitoring**: Real-time logging and notification system

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL
- Redis
- Telegram Bot Token (from @BotFather)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/botter.git
cd botter
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start database services**
```bash
docker-compose up -d
```

5. **Set up database**
```bash
npx prisma migrate dev --name init
npx prisma generate
```

6. **Run the application**
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

## 📖 Usage Guide

### For Creators

1. **Register as Creator**: `/register` or `/dashboard`
2. **Add Channel**: Forward any message from your channel to the bot
3. **Create Plans**: Add subscription plans with custom pricing
4. **Share Links**: Generate and share deep links with your audience
5. **Manage Wallet**: View balance and request payouts

### For Subscribers

1. **Access via Link**: Click creator's deep link or use `/start`
2. **Select Plan**: Choose from available subscription options
3. **Make Payment**: Complete payment via TsPay
4. **Get Access**: Receive instant channel invite link

### Commands

**Creator Commands:**
- `/dashboard` - Creator management interface
- `/register` - Register as creator
- `/balance` - Check wallet balance
- `/withdraw` - Request payout
- `/payouts` - View payout history

**Subscriber Commands:**
- `/start` - Main menu and subscription interface
- `/help` - Help and support information

## 🛠️ Technical Architecture

### System Components

```mermaid
graph TD
    A[Telegram Bot] --> B[Bot Handler Layer]
    B --> C[Service Layer]
    C --> D[Repository Layer]
    D --> E[(PostgreSQL Database)]
    C --> F[Payment Service]
    C --> G[Background Workers]
    G --> H[Redis Queue]
    I[Admin Channel] --> J[Logging Service]
```

### Core Services

- **Bot Layer**: Handles Telegram interactions and user sessions
- **Service Layer**: Business logic for subscriptions, payments, and creators
- **Repository Layer**: Database operations with Prisma ORM
- **Background Workers**: Cron jobs for subscription expiration
- **Payment Integration**: TsPay API for secure transactions

## 🔧 Configuration

### Environment Variables

```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token
LOG_CHANNEL_ID=-1001234567890

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5433/botter_db

# Redis
REDIS_URL=redis://localhost:6379

# Payment (TsPay)
TSPAY_SHOP_TOKEN=your_tspay_shop_token
```

### Database Schema

The platform uses PostgreSQL with the following main entities:
- `User` - Telegram user information
- `Creator` - Content creator profiles
- `Channel` - Monetized Telegram channels
- `SubscriptionPlan` - Pricing and duration options
- `Subscription` - User subscription records
- `Transaction` - Payment and financial records
- `Payout` - Creator withdrawal requests

## 📊 Monitoring & Logging

### Log Files
- `payout_requests.log` - Payout transaction logs
- Console logs for application events
- Admin channel notifications for critical events

### Health Checks
```bash
# Database connection
npx prisma studio

# Application health
# TODO: Add health check endpoint
```

## 🛡️ Security Features

- **Payment Verification**: Secure transaction validation
- **Session Management**: User state persistence
- **Access Control**: Role-based permissions
- **Input Validation**: Sanitized user inputs
- **Audit Logging**: Comprehensive activity tracking

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:
- Code standards and conventions
- Pull request process
- Issue reporting
- Development workflow

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check our [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- Review the [Deployment Guide](docs/DEPLOYMENT.md)
- Open an issue on GitHub

## 🚀 Deployment

See our detailed [Deployment Guide](docs/DEPLOYMENT.md) for:
- Production deployment strategies
- Docker and Kubernetes configurations
- Backup and recovery procedures
- Scaling recommendations

---

*Built with ❤️ using TypeScript, Prisma, and Grammy Framework*