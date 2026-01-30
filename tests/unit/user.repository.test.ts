import { UserRepository } from '../../src/core/user.repo';
import prisma from '../../src/db/prisma';

// Mock the prisma module
jest.mock('../../src/db/prisma');

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock the default export
(prisma as any) = mockPrisma;

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    userRepository = new UserRepository();
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
      const mockExistingUser = {
        id: 1,
        telegramId: 123456789n,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'en',
        createdAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue(mockExistingUser);
      (mockPrisma.user.update as jest.MockedFunction<any>).mockResolvedValue(mockExistingUser);

      const result = await userRepository.upsertUser(
        123456789n,
        'testuser',
        'Test',
        'User',
        'en'
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 123456789n }
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { telegramId: 123456789n },
        data: {
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          language: 'en',
        },
      });
      expect(result).toEqual(mockExistingUser);
    });

    it('should create new user when not found', async () => {
      const mockNewUser = {
        id: 1,
        telegramId: 123456789n,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'en',
        createdAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.MockedFunction<any>).mockResolvedValue(null);
      (mockPrisma.user.create as jest.MockedFunction<any>).mockResolvedValue(mockNewUser);

      const result = await userRepository.upsertUser(
        123456789n,
        'testuser',
        'Test',
        'User',
        'en'
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 123456789n }
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: 123456789n,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          language: 'en',
        },
      });
      expect(result).toEqual(mockNewUser);
    });
  });
});