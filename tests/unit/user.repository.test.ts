import { UserRepository } from '../../src/core/user.repo';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
} as unknown as PrismaClient;

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    userRepository = new UserRepository();
    // Override the prisma instance with mock
    Object.defineProperty(userRepository, 'prisma', {
      value: mockPrisma,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByTelegramId', () => {
    it('should find user by telegram ID', async () => {
      const mockUser = {
        id: 1,
        telegramId: 123456789n,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'en',
        createdAt: new Date(),
        creator: null,
        subscriptions: [],
      };

      (mockPrisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue(mockUser);

      const result = await userRepository.findByTelegramId(123456789n);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 123456789n },
        include: { creator: true, subscriptions: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('upsertUser', () => {
    it('should upsert user with provided details', async () => {
      const mockUpsertedUser = {
        id: 1,
        telegramId: 123456789n,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'en',
        createdAt: new Date(),
      };

      (mockPrisma.user.upsert as jest.MockedFunction<any>).mockResolvedValue(mockUpsertedUser);

      const result = await userRepository.upsertUser(
        123456789n,
        'testuser',
        'Test',
        'User',
        'en'
      );

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { telegramId: 123456789n },
        update: {
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          language: 'en',
        },
        create: {
          telegramId: 123456789n,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          language: 'en',
        },
      });
      expect(result).toEqual(mockUpsertedUser);
    });
  });
});