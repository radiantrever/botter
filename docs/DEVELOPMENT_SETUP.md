# Development Environment Setup

This document provides instructions for setting up a development environment for
the Telegram Paywall Platform.

## 🛠️ Prerequisites

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+
  recommended)
- **RAM**: 8 GB minimum, 16 GB recommended
- **Disk Space**: 10 GB available space
- **Processor**: Multi-core processor (Intel i5 or equivalent)

### Required Software

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **npm** (v8 or higher)
   - Usually bundled with Node.js
   - Verify installation: `npm --version`

3. **Git**
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify installation: `git --version`

4. **Docker Desktop** (for database and Redis)
   - Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Verify installation: `docker --version`

5. **Visual Studio Code** (recommended IDE)
   - Download from [code.visualstudio.com](https://code.visualstudio.com/)
   - Recommended extensions:
     - TypeScript
     - ESLint
     - Prettier
     - Prisma
     - GraphQL (if working with GraphQL)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/botter.git
cd botter

# Checkout the development branch
git checkout develop
```

### 2. Install Dependencies

```bash
# Install project dependencies
npm install

# Install development tools globally (optional)
npm install -g nodemon ts-node typescript
```

### 3. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your configuration
code .env  # Opens in VS Code
```

**Required Environment Variables:**

```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
LOG_CHANNEL_ID=your_log_channel_id_here

# Database (these are defaults for development)
DATABASE_URL="postgresql://postgres:password@localhost:5433/botter_db"

# Redis (default for development)
REDIS_URL="redis://localhost:6379"

# Payment Integration (use test tokens for development)
TSPAY_SHOP_TOKEN=your_tspay_test_token_here

# Application Settings
NODE_ENV=development
PORT=3000
```

### 4. Database Setup

```bash
# Start Docker services
docker-compose up -d

# Wait for services to be ready
sleep 10

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Verify database connection
npx prisma studio
```

### 5. Initial Build

```bash
# Build the project
npm run build

# Or run in development mode directly
npm run dev
```

## 🧰 Development Tools

### Code Formatting and Linting

```bash
# Format all code
npm run format

# Check formatting
npm run format:check

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test path/to/test/file.spec.ts
```

### Development Server

```bash
# Start development server with auto-reload
npm run dev

# The server will restart automatically when you save changes
```

## 🔧 Development Workflow

### Setting up Git Hooks (Optional but Recommended)

```bash
# Install Husky for Git hooks
npm install --save-dev husky

# Prepare Husky
npx husky install

# Add pre-commit hook for code quality
npx husky add .husky/pre-commit "npm run lint && npm run format:check"
```

### Code Quality Checks

Before committing your code, ensure:

1. **Code Formatting**: Run `npm run format` to auto-format code
2. **Linting**: Run `npm run lint:fix` to fix common issues
3. **Tests**: Run `npm test` to ensure all tests pass
4. **Type Checking**: Run `npx tsc --noEmit` to check for TypeScript errors

### Running Different Environments

```bash
# Development (with hot reload)
npm run dev

# Production build and start
npm run build
npm start

# Production build only
npm run build
```

## 🐛 Debugging

### VS Code Debugging Setup

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Bot",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "auto",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--no-cache",
        "--testPathPattern=${fileBasename}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "NODE_ENV": "test"
      },
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Debugging Tips

1. **Use TypeScript types**: Leverage strong typing for better debugging
2. **Console logging**: Use structured logging with Winston
3. **Prisma Studio**: Visual database inspection
   ```bash
   npx prisma studio
   ```
4. **Environment isolation**: Use separate databases for development and testing

## 🧪 Testing Setup

### Unit Tests

Create test files with `.spec.ts` or `.test.ts` extension:

```typescript
// Example: src/core/user.service.spec.ts
import { UserService } from "./user.service";

describe("UserService", () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  describe("getUserById", () => {
    it("should return user when found", async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

Place integration tests in `tests/integration/`:

```typescript
// Example: tests/integration/bot.handler.integration.test.ts
import { Bot } from "grammy";
import { creatorHandler } from "../../src/bot/handlers/creator";

describe("Bot Integration Tests", () => {
  let bot: Bot;

  beforeEach(() => {
    bot = new Bot("test-token");
    bot.use(creatorHandler);
  });

  // Integration test implementation
});
```

## 📦 Building for Production

```bash
# Clean previous builds
rm -rf dist/

# Build TypeScript
npm run build

# Verify build
node dist/index.js
```

## 🐳 Docker Development

### Development with Docker

```bash
# Build and start all services
docker-compose -f docker-compose.dev.yml up --build

# Run specific service
docker-compose exec app bash

# View logs
docker-compose logs -f app
```

Create `docker-compose.dev.yml` for development:

```yaml
version: "3.8"
services:
  app:
    build: .
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/botter_db
    ports:
      - "3000:3000"
    command: npm run dev
    depends_on:
      - db
      - redis

  db:
    image: postgres:18.1-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=botter_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7.2.8-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## 🔒 Security Considerations

### Environment Variables

- Never commit `.env` files to version control
- Use different tokens for development and production
- Rotate tokens regularly

### Code Security

- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization

## 📚 Additional Resources

- [Project Architecture](../docs/ARCHITECTURE.md)
- [API Documentation](../docs/api-spec.yaml)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)

## ❓ Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Ensure Docker services are running
   docker-compose ps

   # Restart services
   docker-compose restart
   ```

2. **Permission Errors**
   ```bash
   # On Unix systems, fix npm permissions
   sudo chown -R $(whoami) ~/.npm
   ```

3. **Port Already in Use**
   ```bash
   # Check what's using port 3000
   lsof -i :3000

   # Kill process if needed
   kill -9 $(lsof -t -i:3000)
   ```

4. **TypeScript Compilation Errors**
   ```bash
   # Check for TypeScript errors
   npx tsc --noEmit

   # Clear TypeScript cache
   rm -rf node_modules/.cache
   ```

---

_Last updated: January 2026_ _For additional help, refer to the
[Troubleshooting Guide](../docs/TROUBLESHOOTING.md)_
