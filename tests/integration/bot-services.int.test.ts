import { CreatorService } from '../../src/core/creator.service';
import { SubscriberService } from '../../src/core/subscriber.service';
import { TsPayClient } from '../../src/core/tspay';

describe('Bot Integration Tests', () => {
  describe('Creator Service Integration', () => {
    let creatorService: CreatorService;

    beforeEach(() => {
      creatorService = new CreatorService();
    });

    it('should register a creator successfully', async () => {
      const telegramId = BigInt(123456789);
      const result = await creatorService.registerCreator(
        telegramId,
        'testuser',
        'Test',
        'User'
      );

      expect(result).toBeDefined();
      expect(result.userId).toBeDefined();
    });

    it('should handle creator registration idempotency', async () => {
      const telegramId = BigInt(987654321);
      
      // Register first time
      const firstResult = await creatorService.registerCreator(
        telegramId,
        'testuser2',
        'Test2',
        'User2'
      );
      
      // Register second time with same ID
      const secondResult = await creatorService.registerCreator(
        telegramId,
        'updateduser',
        'Updated',
        'Name'
      );

      // Should return the same creator
      expect(firstResult.id).toEqual(secondResult.id);
    });
  });

  describe('Subscriber Service Integration', () => {
    let subscriberService: SubscriberService;

    beforeEach(() => {
      subscriberService = new SubscriberService();
    });

    it('should register a user successfully', async () => {
      const telegramId = BigInt(111222333);
      const result = await subscriberService.registerUser(
        telegramId,
        'subuser',
        'Subscriber',
        'Test'
      );

      expect(result).toBeDefined();
      expect(result.telegramId).toEqual(telegramId);
    });
  });

  describe('TsPay Integration', () => {
    let tspayClient: TsPayClient;

    beforeEach(() => {
      tspayClient = new TsPayClient();
    });

    it('should initialize TsPay client', () => {
      expect(tspayClient).toBeDefined();
    });

    // Note: Actual payment tests would require valid credentials
    // These are skipped in test environments
    it.skip('should create a transaction', async () => {
      if (!process.env.TSPAY_SHOP_TOKEN) {
        // Skip if no credentials available
        return;
      }

      const result = await tspayClient.createTransaction(
        1000, // 1000 UZS
        'https://example.com/callback',
        'Test transaction'
      );

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.transaction).toBeDefined();
    });
  });
});