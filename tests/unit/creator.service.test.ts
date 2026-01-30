import { CreatorService } from '../../src/core/creator.service';

// Mock the prisma module
jest.mock('../../src/db/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  creator: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
}));

// Import after mocking
import prisma from '../../src/db/prisma';

describe('CreatorService', () => {
  let creatorService: CreatorService;

  beforeEach(() => {
    creatorService = new CreatorService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerCreator', () => {
    it('should register a new creator if one does not exist', async () => {
      const mockUser = {
        id: 1,
        telegramId: 123456789n,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'en',
        createdAt: new Date(),
      };

      const mockCreator = {
        id: 1,
        userId: 1,
        channels: [],
      };

      // Mock prisma calls
      (prisma.user.findUnique as jest.MockedFunction<any>)
        .mockResolvedValueOnce(null) // First call in upsertUser - check if user exists
        .mockResolvedValueOnce(mockUser); // Second call in createCreator - check if user exists by ID
      (prisma.user.create as jest.MockedFunction<any>).mockResolvedValue(mockUser);
      (prisma.creator.findUnique as jest.MockedFunction<any>).mockResolvedValue(null);
      (prisma.creator.create as jest.MockedFunction<any>).mockResolvedValue(mockCreator);

      const result = await creatorService.registerCreator(
        123456789n,
        'testuser',
        'Test',
        'User'
      );

      // Check that the user was created
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 123456789n }
      });
      expect(prisma.user.create).toHaveBeenCalled();
      
      // Check that the creator was created
      expect(prisma.creator.findUnique).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { channels: true }
      });
      expect(prisma.creator.create).toHaveBeenCalledWith({
        data: { userId: 1 }
      });
      
      expect(result).toEqual(mockCreator);
    });

    it('should return existing creator if one exists', async () => {
      const mockUser = {
        id: 1,
        telegramId: 123456789n,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        language: 'en',
        createdAt: new Date(),
      };

      const mockExistingCreator = {
        id: 1,
        userId: 1,
        channels: [],
      };

      // Mock prisma calls
      (prisma.user.findUnique as jest.MockedFunction<any>)
        .mockResolvedValueOnce(null) // First call in upsertUser - check if user exists
        .mockResolvedValueOnce(mockUser); // Second call in createCreator - check if user exists by ID
      (prisma.user.create as jest.MockedFunction<any>).mockResolvedValue(mockUser);
      (prisma.creator.findUnique as jest.MockedFunction<any>).mockResolvedValue(mockExistingCreator);

      const result = await creatorService.registerCreator(
        123456789n,
        'testuser',
        'Test',
        'User'
      );

      // Check that the user was created
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 123456789n }
      });
      expect(prisma.user.create).toHaveBeenCalled();
      
      // Check that we looked for existing creator
      expect(prisma.creator.findUnique).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { channels: true }
      });
      
      // Check that creator.create was NOT called
      expect(prisma.creator.create).not.toHaveBeenCalled();
      
      expect(result).toEqual(mockExistingCreator);
    });
  });
});