# 🤝 Contributing Guidelines

Welcome! We're excited that you're interested in contributing to the Telegram Paywall Platform. This document provides guidelines and standards for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community](#community)

## 🤝 Code of Conduct

### Our Pledge
We pledge to create a welcoming and inclusive environment for everyone, regardless of:
- Experience level
- Gender identity and expression
- Sexual orientation
- Disability
- Personal appearance
- Race, ethnicity, or religion
- Age
- Nationality

### Our Standards
**Positive Behavior:**
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

**Unacceptable Behavior:**
- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing private information
- Other conduct unbecoming of an open-source community

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Docker and Docker Compose
- Git
- Code editor (VS Code recommended)
- Telegram account for testing

### Environment Setup

1. **Fork and Clone**
```bash
# Fork the repository on GitHub
git clone https://github.com/yourusername/botter.git
cd botter
```

2. **Install Dependencies**
```bash
npm install
```

3. **Set Up Development Environment**
```bash
# Copy environment file
cp .env.example .env

# Edit with your development values
# Use test bot token and credentials
```

4. **Start Development Services**
```bash
# Start database and Redis
docker-compose up -d

# Run database migrations
npx prisma migrate dev --name init-dev
npx prisma generate

# Start development server
npm run dev
```

### Development Commands
```bash
# Development with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build

# Database operations
npx prisma studio     # Database GUI
npx prisma migrate dev # Create migrations
npx prisma generate    # Generate client
```

## 🔧 Development Workflow

### Branch Strategy
We follow the GitFlow branching model:

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `hotfix/*` - Critical bug fixes
- `release/*` - Release preparation

### Feature Development Process

1. **Create Feature Branch**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

2. **Development**
- Write clean, well-documented code
- Follow coding standards
- Add tests for new functionality
- Update documentation as needed

3. **Code Quality Checks**
```bash
npm run lint
npm run format
npm test
```

4. **Commit Changes**
```bash
git add .
git commit -m "feat: add new subscription feature"
```

5. **Push and Create Pull Request**
```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

**Examples:**
```
feat(subscriptions): add auto-renewal functionality

- Implement automatic subscription renewal
- Add renewal notification system
- Update database schema for renewal tracking

Closes #123
```

```
fix(payment): resolve TsPay verification timeout

- Increase timeout from 5s to 15s
- Add retry logic for failed verifications
- Improve error handling and logging

Fixes #456
```

## 💻 Coding Standards

### TypeScript Guidelines

**General Rules:**
- Use TypeScript strict mode
- Enable `noImplicitAny`
- Use explicit return types
- Avoid `any` type when possible

**Naming Conventions:**
```typescript
// Classes: PascalCase
class UserService { }

// Interfaces: PascalCase with I prefix
interface IUser { }

// Functions: camelCase
function getUserById() { }

// Variables: camelCase
const userCount = 0;

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Private members: camelCase with underscore
private _internalState = '';
```

**Code Structure:**
```typescript
// Good: Clear function signatures
async function processPayment(
  userId: number,
  amount: number,
  paymentMethod: string
): Promise<PaymentResult> {
  // Implementation
}

// Good: Proper error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed:', error);
  throw new Error(`Payment processing failed: ${error.message}`);
}
```

### File Organization

```
src/
├── bot/                 # Bot layer
│   ├── handlers/        # Command handlers
│   ├── context.ts       # Extended context types
│   ├── i18n.ts          # Internationalization
│   └── bot.ts           # Main bot instance
├── core/                # Business logic
│   ├── services/        # Service classes
│   ├── repositories/    # Data access
│   └── models/          # Domain models
├── db/                  # Database configuration
├── workers/             # Background jobs
└── utils/               # Utility functions
```

### Error Handling

```typescript
// Good: Specific error types
class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Good: Structured error responses
interface ErrorResponse {
  error: string;
  code: string;
  timestamp: string;
  details?: Record<string, any>;
}

// Good: Centralized error logging
export function handleError(error: Error, context: string): never {
  logger.error(`Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  throw error;
}
```

## 🧪 Testing Guidelines

### Test Structure

```
tests/
├── unit/                # Unit tests
│   ├── services/        # Service tests
│   ├── repositories/    # Repository tests
│   └── utils/           # Utility tests
├── integration/         # Integration tests
│   ├── bot-flows/       # Bot interaction tests
│   └── api/             # API endpoint tests
└── e2e/                 # End-to-end tests
    └── user-journeys/   # Complete user scenarios
```

### Writing Tests

```typescript
// Unit test example
describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = {
      findByTelegramId: jest.fn(),
      create: jest.fn()
    } as any;
    
    userService = new UserService(mockRepository);
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: 1, telegramId: 123456n };
      mockRepository.findByTelegramId.mockResolvedValue(mockUser);

      const result = await userService.getUserById(123456n);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findByTelegramId).toHaveBeenCalledWith(123456n);
    });

    it('should throw error when user not found', async () => {
      mockRepository.findByTelegramId.mockResolvedValue(null);

      await expect(userService.getUserById(123456n))
        .rejects.toThrow('User not found');
    });
  });
});
```

### Test Coverage Requirements
- **Unit Tests**: Minimum 80% coverage for new code
- **Integration Tests**: Cover critical user flows
- **E2E Tests**: Key business scenarios
- **Edge Cases**: Boundary conditions and error states

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/services/user.service.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## 📚 Documentation

### Code Documentation

**JSDoc Comments:**
```typescript
/**
 * Processes a payment transaction for a user subscription
 * @param userId - Telegram user ID
 * @param planId - Subscription plan ID
 * @param paymentId - TsPay transaction ID
 * @returns Promise resolving to created subscription
 * @throws {ValidationError} When payment data is invalid
 * @throws {PaymentError} When payment processing fails
 */
async function processSubscriptionPayment(
  userId: bigint,
  planId: number,
  paymentId: string
): Promise<Subscription> {
  // Implementation
}
```

**Inline Comments:**
```typescript
// Good: Explain why, not what
const retryDelay = 2000; // Exponential backoff starting at 2 seconds

// Good: Complex logic explanation
// This algorithm handles the edge case where users
// attempt to rejoin immediately after being kicked
if (user.wasRecentlyKicked() && user.attemptedRejoin()) {
  await this.enforcePermanentBan(user);
}
```

### API Documentation
- Update OpenAPI specification in `docs/api-spec.yaml`
- Document new endpoints and parameters
- Include example requests and responses

### User Documentation
- Update README.md for user-facing changes
- Add to troubleshooting guide for common issues
- Update deployment documentation for infrastructure changes

## 📥 Pull Request Process

### PR Requirements

1. **Title Format**: Follow conventional commits
2. **Description**: Include:
   - Summary of changes
   - Related issues (Fixes #123, Closes #456)
   - Testing instructions
   - Screenshots (if UI changes)
3. **Code Quality**: Pass all checks
4. **Tests**: Include appropriate test coverage
5. **Documentation**: Update relevant documentation

### Review Process

**Self-Review Checklist:**
- [ ] Code follows style guidelines
- [ ] Tests pass and provide adequate coverage
- [ ] Documentation updated
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Security considerations addressed

**Review Criteria:**
- Code quality and maintainability
- Test coverage and quality
- Performance impact
- Security implications
- Documentation completeness

### Merge Process
1. All required checks pass
2. At least one approved review
3. No unresolved comments
4. Branch is up to date with target branch
5. Squash and merge with conventional commit message

## 🐛 Issue Reporting

### Bug Reports

**Required Information:**
- **Description**: Clear, concise description
- **Steps to Reproduce**: Detailed reproduction steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: 
  - Node.js version
  - Database version
  - Operating system
  - Bot version
- **Logs**: Relevant error messages and logs
- **Screenshots**: If applicable

**Template:**
```markdown
## Bug Report

**Description:**
Brief description of the issue

**Steps to Reproduce:**
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior:**
What you expected to happen

**Actual Behavior:**
What actually happened

**Environment:**
- Node.js: v18.17.0
- Database: PostgreSQL 15
- OS: Ubuntu 20.04
- Version: v1.2.3

**Logs:**
```
Error logs here
```

**Additional Context:**
Any other relevant information
```

### Feature Requests

**Template:**
```markdown
## Feature Request

**Problem Statement:**
What problem does this solve?

**Proposed Solution:**
How should this be implemented?

**Alternative Solutions:**
Other approaches considered

**Use Cases:**
Who would benefit and how?

**Implementation Considerations:**
Technical challenges or dependencies
```

## 👥 Community

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General discussion and Q&A
- **Email**: support@botter.example.com (for sensitive matters)

### Recognition
We appreciate all contributions! Contributors will be:
- Mentioned in release notes
- Added to contributors list
- Recognized in documentation

### Getting Help
- Check existing documentation
- Search issues and discussions
- Ask in GitHub Discussions
- Contact maintainers directly

## 📜 License

By contributing to this project, you agree that your contributions will be licensed under the project's ISC License.

---

*Thank you for contributing to the Telegram Paywall Platform!*
*Last updated: January 2026*