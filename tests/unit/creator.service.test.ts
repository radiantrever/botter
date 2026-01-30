import { CreatorService } from '../../src/core/creator.service';
import { UserRepository } from '../../src/core/user.repo';
import { CreatorRepository } from '../../src/core/creator.repo';

// Mock repositories
const mockUserRepository = {
  upsertUser: jest.fn(),
  findByTelegramId: jest.fn(),
} as unknown as UserRepository;

const mockCreatorRepository = {
  createCreator: jest.fn(),
  findByUserId: jest.fn(),
  findByTelegramId: jest.fn(),
} as unknown as CreatorRepository;

describe('CreatorService', () => {
  let creatorService: CreatorService;

  beforeEach(() => {
    creatorService = new CreatorService();
    
    // Replace repositories with mocks
    Object.defineProperty(creatorService, 'userRepo', {
      value: mockUserRepository,
      writable: true,
    });
    
    Object.defineProperty(creatorService, 'creatorRepo', {
      value: mockCreatorRepository,
      writable: true,
    });
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

      (mockUserRepository.upsertUser as jest.MockedFunction<any>).mockResolvedValue(mockUser);
      (mockCreatorRepository.findByUserId as jest.MockedFunction<any>).mockResolvedValue(null);
      (mockCreatorRepository.createCreator as jest.MockedFunction<any>).mockResolvedValue(mockCreator);

      const result = await creatorService.registerCreator(
        123456789n,
        'testuser',
        'Test',
        'User'
      );

      expect(mockUserRepository.upsertUser).toHaveBeenCalledWith(
        123456789n,
        'testuser',
        'Test',
        'User'
      );
      expect(mockCreatorRepository.findByUserId).toHaveBeenCalledWith(1);
      expect(mockCreatorRepository.createCreator).toHaveBeenCalledWith(1);
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

      (mockUserRepository.upsertUser as jest.MockedFunction<any>).mockResolvedValue(mockUser);
      (mockCreatorRepository.findByUserId as jest.MockedFunction<any>).mockResolvedValue(mockExistingCreator);

      const result = await creatorService.registerCreator(
        123456789n,
        'testuser',
        'Test',
        'User'
      );

      expect(mockUserRepository.upsertUser).toHaveBeenCalledWith(
        123456789n,
        'testuser',
        'Test',
        'User'
      );
      expect(mockCreatorRepository.findByUserId).toHaveBeenCalledWith(1);
      expect(mockCreatorRepository.createCreator).not.toHaveBeenCalled();
      expect(result).toEqual(mockExistingCreator);
    });
  });
});