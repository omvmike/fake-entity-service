import {TypeormFakeEntityService} from "../src";
import {User} from "./typeorm-models/user.entity";
import {Follower} from "./typeorm-models/follower.entity";
import {Role} from "./typeorm-models/role.entity";
import {Repository} from "typeorm";

// Mock repository for testing
class MockRepository {
  constructor(public metadata: any, public target: any) {}
  
  create = jest.fn();
  save = jest.fn();
  delete = jest.fn();
  findOne = jest.fn();
}

describe('TypeORM Primary Key Detection', () => {
  
  describe('Single Primary Key Detection', () => {
    let mockRepository: MockRepository;
    let service: TypeormFakeEntityService<User>;

    beforeEach(() => {
      mockRepository = new MockRepository({
        name: 'User',
        primaryColumns: [
          { propertyName: 'id' }
        ]
      }, User);
      
      service = new TypeormFakeEntityService(mockRepository as any);
    });

    it('should detect single @PrimaryGeneratedColumn', () => {
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
  });

  describe('Composite Primary Key Detection', () => {
    let mockRepository: MockRepository;
    let service: TypeormFakeEntityService<Follower>;

    beforeEach(() => {
      mockRepository = new MockRepository({
        name: 'Follower',
        primaryColumns: [
          { propertyName: 'leaderId' },
          { propertyName: 'followerId' }
        ]
      }, Follower);
      
      service = new TypeormFakeEntityService(mockRepository as any);
    });

    it('should detect multiple @PrimaryColumn (composite)', () => {
      expect(service.getIdFieldNames()).toEqual(['leaderId', 'followerId']);
      expect(service.hasCompositeId()).toBe(true);
    });

    it('should extract composite ID from entity', () => {
      const entity = { leaderId: 1, followerId: 2, createdAt: new Date() } as Follower;
      const id = service.getId(entity);
      expect(id).toEqual({ leaderId: 1, followerId: 2 });
    });

    it('should throw error for incomplete composite key', () => {
      const entity = { leaderId: 1, createdAt: new Date() } as Follower;
      expect(() => service.getId(entity)).toThrow('Primary key field "followerId" is empty or null in entity Follower');
    });

    it('should build composite key where conditions', () => {
      const keyValues = { leaderId: 1, followerId: 2 };
      const where = service['buildCompositeKeyWhere'](keyValues);
      expect(where).toEqual({ leaderId: 1, followerId: 2 });
    });

    it('should throw error for invalid composite key field', () => {
      const keyValues = { leaderId: 1, invalidField: 2 };
      expect(() => service['buildCompositeKeyWhere'](keyValues)).toThrow('Invalid primary key field "invalidField" for entity Follower');
    });
  });

  describe('Custom Primary Key Names', () => {
    let mockRepository: MockRepository;
    let service: TypeormFakeEntityService<any>;

    beforeEach(() => {
      mockRepository = new MockRepository({
        name: 'CustomEntity',
        primaryColumns: [
          { propertyName: 'customId' }
        ]
      }, Object);
      
      service = new TypeormFakeEntityService(mockRepository as any);
    });

    it('should detect custom column names', () => {
      expect(service.getIdFieldNames()).toEqual(['customId']);
    });

    it('should extract custom primary key', () => {
      const entity = { customId: 'abc123', name: 'test' };
      expect(service.getId(entity)).toBe('abc123');
    });
  });

  describe('Error Handling', () => {
    let mockRepository: MockRepository;

    it('should throw error for entities without primary keys', () => {
      mockRepository = new MockRepository({
        name: 'NoPrimaryKeyEntity',
        primaryColumns: []
      }, Object);

      expect(() => new TypeormFakeEntityService(mockRepository as any))
        .toThrow('No primary keys detected for entity NoPrimaryKeyEntity. Please ensure the entity has @PrimaryColumn or @PrimaryGeneratedColumn decorators.');
    });

    it('should handle null primary key values', () => {
      mockRepository = new MockRepository({
        name: 'User',
        primaryColumns: [{ propertyName: 'id' }]
      }, User);
      
      const service = new TypeormFakeEntityService(mockRepository as any);
      const entity = { id: null, email: 'test@example.com' } as User;
      
      expect(() => service.getId(entity)).toThrow('Primary key field "id" is empty or null in entity User');
    });

    it('should handle undefined primary key values', () => {
      mockRepository = new MockRepository({
        name: 'User',
        primaryColumns: [{ propertyName: 'id' }]
      }, User);
      
      const service = new TypeormFakeEntityService(mockRepository as any);
      const entity = { email: 'test@example.com' } as User;
      
      expect(() => service.getId(entity)).toThrow('Primary key field "id" is empty or null in entity User');
    });
  });

  describe('Metadata Integration', () => {
    let mockRepository: MockRepository;
    let service: TypeormFakeEntityService<User>;

    beforeEach(() => {
      mockRepository = new MockRepository({
        name: 'User',
        primaryColumns: [
          { 
            propertyName: 'id',
            type: 'int',
            isGenerated: true,
            generationStrategy: 'increment'
          }
        ]
      }, User);
      
      service = new TypeormFakeEntityService(mockRepository as any);
    });

    it('should access primary column metadata', () => {
      const primaryColumns = service.getPrimaryColumns();
      expect(primaryColumns).toHaveLength(1);
      expect(primaryColumns[0].propertyName).toBe('id');
      expect(primaryColumns[0].isGenerated).toBe(true);
    });

    it('should cache metadata for performance', () => {
      // Call multiple times to ensure metadata is cached
      const firstCall = service.getIdFieldNames();
      const secondCall = service.getIdFieldNames();
      const thirdCall = service.getIdFieldNames();
      
      expect(firstCall).toEqual(secondCall);
      expect(secondCall).toEqual(thirdCall);
      expect(firstCall).toEqual(['id']);
    });
  });

  describe('Primary Key Validation', () => {
    let mockRepository: MockRepository;
    let service: TypeormFakeEntityService<Follower>;

    beforeEach(() => {
      mockRepository = new MockRepository({
        name: 'Follower',
        primaryColumns: [
          { propertyName: 'leaderId' },
          { propertyName: 'followerId' }
        ]
      }, Follower);
      
      service = new TypeormFakeEntityService(mockRepository as any);
    });

    it('should validate composite key completeness in pickKeysFromObject', () => {
      const completeEntity = { leaderId: 1, followerId: 2, createdAt: new Date() };
      expect(() => service['pickKeysFromObject'](completeEntity)).not.toThrow();
      
      const incompleteEntity = { leaderId: 1, createdAt: new Date() };
      expect(() => service['pickKeysFromObject'](incompleteEntity))
        .toThrow('Primary key field "followerId" is empty or null in entity Follower');
    });

    it('should validate all primary key fields are present', () => {
      const partialKey = { leaderId: 1 };
      expect(() => service['pickKeysFromObject'](partialKey))
        .toThrow('Primary key field "followerId" is empty or null in entity Follower');
    });
  });
});