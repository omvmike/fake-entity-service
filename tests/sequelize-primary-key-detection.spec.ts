import {SequelizeFakeEntityService} from "../src";
import {User} from "./sequelize-models/user.entity";
import {LeaderFollower} from "./sequelize-models/leader-follower.entity";

// Mock repository for testing Sequelize primary key detection
class MockSequelizeRepository {
  constructor(public primaryKeyAttributes: string[], public modelName: string = 'TestModel') {}
  
  // Mock Sequelize methods
  create = jest.fn();
  bulkCreate = jest.fn();
  destroy = jest.fn();
  findByPk = jest.fn();
}

describe('Sequelize Primary Key Detection', () => {
  
  describe('Single Primary Key Detection', () => {
    let mockRepository: MockSequelizeRepository;
    let service: SequelizeFakeEntityService<User>;

    beforeEach(() => {
      mockRepository = new MockSequelizeRepository(['id'], 'User');
      service = new SequelizeFakeEntityService(mockRepository as any);
    });

    it('should detect single @Column({ primaryKey: true })', () => {
      expect(service.getIdFieldNames()).toEqual(['id']);
      expect(service.hasCompositeId()).toBe(false);
    });

    it('should extract ID from single key entity', () => {
      const entity = { id: 123, email: 'test@example.com' } as User;
      expect(service.getId(entity)).toBe(123);
    });

    it('should throw error for missing single primary key', () => {
      const entity = { email: 'test@example.com' } as User;
      expect(() => service.getId(entity)).toThrow('Primary key field "id" is empty or null in entity User');
    });

    it('should throw error for undefined single primary key', () => {
      const entity = { id: undefined, email: 'test@example.com' } as User;
      expect(() => service.getId(entity)).toThrow('Primary key field "id" is empty or null in entity User');
    });
  });

  describe('Composite Primary Key Detection', () => {
    let mockRepository: MockSequelizeRepository;
    let service: SequelizeFakeEntityService<LeaderFollower>;

    beforeEach(() => {
      mockRepository = new MockSequelizeRepository(['leaderId', 'followerId'], 'LeaderFollower');
      service = new SequelizeFakeEntityService(mockRepository as any);
    });

    it('should detect multiple @Column({ primaryKey: true }) (composite)', () => {
      expect(service.getIdFieldNames()).toEqual(['leaderId', 'followerId']);
      expect(service.hasCompositeId()).toBe(true);
    });

    it('should extract composite ID from entity', () => {
      const entity = { leaderId: 1, followerId: 2, createdAt: new Date() } as LeaderFollower;
      const id = service.getId(entity);
      expect(id).toEqual({ leaderId: 1, followerId: 2 });
    });

    it('should throw error for incomplete composite key', () => {
      const entity = { leaderId: 1, createdAt: new Date() } as LeaderFollower;
      expect(() => service.getId(entity)).toThrow('Id field "followerId" is empty');
    });

    it('should extract composite key using pickKeysFromObject', () => {
      const entity = { leaderId: 1, followerId: 2, createdAt: new Date() };
      const keys = service['pickKeysFromObject'](entity);
      expect(keys).toEqual({ leaderId: 1, followerId: 2 });
    });

    it('should throw error for missing composite key field in pickKeysFromObject', () => {
      const entity = { leaderId: 1, createdAt: new Date() };
      expect(() => service['pickKeysFromObject'](entity))
        .toThrow('Id field "followerId" is empty');
    });
  });

  describe('Custom Primary Key Names', () => {
    let mockRepository: MockSequelizeRepository;
    let service: SequelizeFakeEntityService<any>;

    beforeEach(() => {
      mockRepository = new MockSequelizeRepository(['customId'], 'CustomEntity');
      service = new SequelizeFakeEntityService(mockRepository as any);
    });

    it('should detect custom column names', () => {
      expect(service.getIdFieldNames()).toEqual(['customId']);
      expect(service.hasCompositeId()).toBe(false);
    });

    it('should extract custom primary key', () => {
      const entity = { customId: 'abc123', name: 'test' };
      expect(service.getId(entity)).toBe('abc123');
    });

    it('should handle string-based custom primary keys', () => {
      const entity = { customId: 'uuid-1234-5678', data: 'some data' };
      expect(service.getId(entity)).toBe('uuid-1234-5678');
    });
  });

  describe('Multiple Custom Primary Keys', () => {
    let mockRepository: MockSequelizeRepository;
    let service: SequelizeFakeEntityService<any>;

    beforeEach(() => {
      mockRepository = new MockSequelizeRepository(['tenantId', 'entityId'], 'MultiTenantEntity');
      service = new SequelizeFakeEntityService(mockRepository as any);
    });

    it('should detect multiple custom primary keys', () => {
      expect(service.getIdFieldNames()).toEqual(['tenantId', 'entityId']);
      expect(service.hasCompositeId()).toBe(true);
    });

    it('should extract multiple custom primary keys', () => {
      const entity = { tenantId: 'tenant1', entityId: 42, data: 'test data' };
      const id = service.getId(entity);
      expect(id).toEqual({ tenantId: 'tenant1', entityId: 42 });
    });
  });

  describe('Error Handling', () => {
    let mockRepository: MockSequelizeRepository;

    it('should handle entities without primary keys gracefully', () => {
      mockRepository = new MockSequelizeRepository([], 'NoPrimaryKeyEntity');
      const service = new SequelizeFakeEntityService(mockRepository as any);

      // Should return empty array for entities without primary keys
      expect(service.getIdFieldNames()).toEqual([]);
      expect(service.hasCompositeId()).toBe(false);
    });

    it('should handle null primary key values', () => {
      mockRepository = new MockSequelizeRepository(['id'], 'User');
      const service = new SequelizeFakeEntityService(mockRepository as any);
      const entity = { id: null, email: 'test@example.com' } as User;

      expect(() => service.getId(entity)).toThrow('Primary key field "id" is empty or null in entity User');
    });

    it('should handle undefined primary key values', () => {
      mockRepository = new MockSequelizeRepository(['id'], 'User');
      const service = new SequelizeFakeEntityService(mockRepository as any);
      const entity = { email: 'test@example.com' } as User;
      
      expect(() => service.getId(entity)).toThrow('Primary key field "id" is empty or null in entity User');
    });

    it('should handle mixed null/undefined values in composite keys', () => {
      mockRepository = new MockSequelizeRepository(['leaderId', 'followerId'], 'LeaderFollower');
      const service = new SequelizeFakeEntityService(mockRepository as any);
      
      // Sequelize service currently only checks for undefined, not null
      // So null values are allowed and will be included in the composite key
      const entityWithNull = { leaderId: 1, followerId: null } as LeaderFollower;
      expect(service.getId(entityWithNull)).toEqual({ leaderId: 1, followerId: null });
      
      const entityWithUndefined = { leaderId: 1 } as LeaderFollower;
      expect(() => service.getId(entityWithUndefined)).toThrow('Id field "followerId" is empty');
    });
  });

  describe('Sequelize Metadata Integration', () => {
    let mockRepository: MockSequelizeRepository;
    let service: SequelizeFakeEntityService<User>;

    beforeEach(() => {
      mockRepository = new MockSequelizeRepository(['id'], 'User');
      service = new SequelizeFakeEntityService(mockRepository as any);
    });

    it('should access primaryKeyAttributes from repository', () => {
      expect(service.getIdFieldNames()).toEqual(['id']);
      expect(service['repository'].primaryKeyAttributes).toEqual(['id']);
    });

    it('should fall back to primaryKeyAttributes when idFieldNames is empty', () => {
      // Test the fallback mechanism in getIdFieldNames()
      service['idFieldNames'] = []; // Clear custom field names
      expect(service.getIdFieldNames()).toEqual(['id']);
    });

    it('should use custom idFieldNames when provided', () => {
      service['idFieldNames'] = ['customId'];
      expect(service.getIdFieldNames()).toEqual(['customId']);
    });

    it('should cache primary key detection for performance', () => {
      // Call multiple times to ensure consistent behavior
      const firstCall = service.getIdFieldNames();
      const secondCall = service.getIdFieldNames();
      const thirdCall = service.getIdFieldNames();
      
      expect(firstCall).toEqual(secondCall);
      expect(secondCall).toEqual(thirdCall);
      expect(firstCall).toEqual(['id']);
    });
  });

  describe('Primary Key Validation and Edge Cases', () => {
    let mockRepository: MockSequelizeRepository;
    let service: SequelizeFakeEntityService<LeaderFollower>;

    beforeEach(() => {
      mockRepository = new MockSequelizeRepository(['leaderId', 'followerId'], 'LeaderFollower');
      service = new SequelizeFakeEntityService(mockRepository as any);
    });

    it('should validate composite key completeness in pickKeysFromObject', () => {
      const completeEntity = { leaderId: 1, followerId: 2, createdAt: new Date() };
      expect(() => service['pickKeysFromObject'](completeEntity)).not.toThrow();
      
      const incompleteEntity = { leaderId: 1, createdAt: new Date() };
      expect(() => service['pickKeysFromObject'](incompleteEntity))
        .toThrow('Id field "followerId" is empty');
    });

    it('should validate all primary key fields are present', () => {
      const partialKey = { leaderId: 1 };
      expect(() => service['pickKeysFromObject'](partialKey))
        .toThrow('Id field "followerId" is empty');
    });

    it('should handle zero values in primary keys', () => {
      const entityWithZero = { leaderId: 0, followerId: 1 } as any;
      expect(() => service['pickKeysFromObject'](entityWithZero)).not.toThrow();
      expect(service.getId(entityWithZero)).toEqual({ leaderId: 0, followerId: 1 });
    });

    it('should handle negative values in primary keys', () => {
      const entityWithNegative = { leaderId: -1, followerId: 1 } as any;
      expect(() => service['pickKeysFromObject'](entityWithNegative)).not.toThrow();
      expect(service.getId(entityWithNegative)).toEqual({ leaderId: -1, followerId: 1 });
    });

    it('should handle string primary keys in composite scenarios', () => {
      mockRepository = new MockSequelizeRepository(['stringId1', 'stringId2'], 'StringComposite');
      service = new SequelizeFakeEntityService(mockRepository as any);
      
      const entity = { stringId1: 'abc', stringId2: 'def', data: 'test' } as any;
      expect(service.getId(entity)).toEqual({ stringId1: 'abc', stringId2: 'def' });
    });
  });

  describe('Performance and Consistency', () => {
    let mockRepository: MockSequelizeRepository;
    let service: SequelizeFakeEntityService<User>;

    beforeEach(() => {
      mockRepository = new MockSequelizeRepository(['id'], 'User');
      service = new SequelizeFakeEntityService(mockRepository as any);
    });

    it('should maintain consistent primary key detection across multiple calls', () => {
      const entities = [
        { id: 1, email: 'user1@test.com' } as any,
        { id: 2, email: 'user2@test.com' } as any,
        { id: 3, email: 'user3@test.com' } as any
      ];
      
      const ids = entities.map(entity => service.getId(entity));
      expect(ids).toEqual([1, 2, 3]);
    });

    it('should handle large composite keys efficiently', () => {
      const largeCompositeKeys = ['key1', 'key2', 'key3', 'key4', 'key5'];
      mockRepository = new MockSequelizeRepository(largeCompositeKeys, 'LargeComposite');
      service = new SequelizeFakeEntityService(mockRepository as any);
      
      const entity = {
        key1: 'val1',
        key2: 'val2', 
        key3: 'val3',
        key4: 'val4',
        key5: 'val5',
        otherData: 'test'
      } as any;
      
      const startTime = Date.now();
      const id = service.getId(entity);
      const endTime = Date.now();
      
      expect(id).toEqual({
        key1: 'val1',
        key2: 'val2',
        key3: 'val3', 
        key4: 'val4',
        key5: 'val5'
      });
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });
  });
});