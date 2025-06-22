import {DataSource, Repository} from "typeorm"
import {User} from "./typeorm-models/user.entity";
import {Role, RoleIds} from "./typeorm-models/role.entity";
import {Follower} from "./typeorm-models/follower.entity";
import {FakeUserService} from "./typeorm-factories/fake-user.service";
import {FakeFollowerService} from "./typeorm-factories/fake-follower.service";

const PostgresDataSource = new DataSource({
  host: 'localhost',
  port: 54323,
  type: 'postgres',
  database: 'test-db',
  username: 'tester',
  password: 'test-pwd',
  synchronize: false,
  entities: [User, Role, Follower],
});

let fakeUserService: FakeUserService;
let fakeFollowerService: FakeFollowerService;
let createdRoleIds: { admin: number; customer: number; manager: number };

describe('TypeORM Composite Key Operations', () => {

  beforeAll(async () => {
    await PostgresDataSource.initialize();
    
    // Create required roles for the tests using direct SQL to handle upserts
    try {
      await PostgresDataSource.query(`
        INSERT INTO roles (id, name) VALUES 
          (${RoleIds.ADMIN}, 'ADMIN'),
          (${RoleIds.CUSTOMER}, 'CUSTOMER'),
          (${RoleIds.MANAGER}, 'MANAGER')
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      `);
    } catch (error) {
      // Roles might already exist, which is fine
    }
    
    // Get the actual created role IDs
    const roleRepo = PostgresDataSource.getRepository(Role);
    const roles = await roleRepo.find();
    
    // Map the created roles to their actual IDs
    createdRoleIds = {
      admin: roles.find(r => r.name === 'ADMIN')?.id || 1,
      customer: roles.find(r => r.name === 'CUSTOMER')?.id || 2,
      manager: roles.find(r => r.name === 'MANAGER')?.id || 3
    };
    
    const userRepo = PostgresDataSource.getRepository(User);
    const followerRepo = PostgresDataSource.getRepository(Follower);
    
    fakeUserService = new FakeUserService(userRepo);
    fakeFollowerService = new FakeFollowerService(followerRepo);
  });

  afterAll(async () => {
    await PostgresDataSource.destroy();
  });

  afterEach(async () => {
    await fakeFollowerService.cleanup();
    await fakeUserService.cleanup();
  });

  describe('Primary Key Detection', () => {
    it('should detect single primary key for User entity', () => {
      expect(fakeUserService.getIdFieldNames()).toEqual(['id']);
      expect(fakeUserService.hasCompositeId()).toBe(false);
    });

    it('should detect composite primary keys for Follower entity', () => {
      expect(fakeFollowerService.getIdFieldNames()).toEqual(['leaderId', 'followerId']);
      expect(fakeFollowerService.hasCompositeId()).toBe(true);
    });

    it('should access primary column metadata', () => {
      const userPrimaryColumns = fakeUserService.getPrimaryColumns();
      expect(userPrimaryColumns).toHaveLength(1);
      expect(userPrimaryColumns[0].propertyName).toBe('id');

      const followerPrimaryColumns = fakeFollowerService.getPrimaryColumns();
      expect(followerPrimaryColumns).toHaveLength(2);
      expect(followerPrimaryColumns.map(col => col.propertyName).sort()).toEqual(['followerId', 'leaderId']);
    });
  });

  describe('Composite Key CRUD Operations', () => {
    it('should create and retrieve Follower by composite key', async () => {
      // Create users first to satisfy foreign key constraints
      const leader = await fakeUserService.create({
        email: 'leader@test.com',
        firstName: 'Leader',
        lastName: 'User',
        password: 'password',
        roleId: createdRoleIds.customer
      });
      
      const followerUser = await fakeUserService.create({
        email: 'follower@test.com',
        firstName: 'Follower',
        lastName: 'User',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const follower = await fakeFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser.id,
        createdAt: new Date()
      });

      expect(follower).toBeDefined();
      expect(follower.leaderId).toBe(leader.id);
      expect(follower.followerId).toBe(followerUser.id);
      expect(follower.createdAt).toBeInstanceOf(Date);

      // Test getId returns composite key object
      const id = fakeFollowerService.getId(follower);
      expect(id).toEqual({ leaderId: leader.id, followerId: followerUser.id });
    });

    it('should create multiple Follower entities with composite keys', async () => {
      // Create a leader user
      const leader = await fakeUserService.create({
        email: 'leader-multi@test.com',
        firstName: 'Leader',
        lastName: 'Multi',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      // Create multiple follower users
      const followerUsers = await fakeUserService.createMany(3, {
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const followers = await fakeFollowerService
        .addStates(followerUsers.map(user => ({
          followerId: user.id,
        }))).createMany(3,{
            leaderId: leader.id,
            createdAt: new Date()
          });

      expect(followers).toHaveLength(3);
      
      for (const follower of followers) {
        expect(follower.leaderId).toBe(leader.id);
        expect(follower.followerId).toBeDefined();
        expect(follower.createdAt).toBeInstanceOf(Date);
        
        // Each should have a valid composite ID
        const id = fakeFollowerService.getId(follower);
        expect(id).toHaveProperty('leaderId');
        expect(id).toHaveProperty('followerId');
      }
    });

    it('should find entity by composite key', async () => {
      // Create users first
      const leader = await fakeUserService.create({
        email: 'search-leader@test.com',
        firstName: 'Search',
        lastName: 'Leader',
        password: 'password',
        roleId: createdRoleIds.customer
      });
      
      const followerUser = await fakeUserService.create({
        email: 'search-follower@test.com',
        firstName: 'Search',
        lastName: 'Follower',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const created = await fakeFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser.id,
        createdAt: new Date()
      });

      const found = await fakeFollowerService.findByCompositeKey({
        leaderId: leader.id,
        followerId: followerUser.id
      });

      expect(found).toBeDefined();
      expect(found.leaderId).toBe(created.leaderId);
      expect(found.followerId).toBe(created.followerId);
      expect(found.createdAt).toEqual(created.createdAt);
    });

    it('should return undefined when composite key not found', async () => {
      const notFound = await fakeFollowerService.findByCompositeKey({
        leaderId: 999999,
        followerId: 999999
      });

      expect(notFound).toBeUndefined();
    });

    it('should cleanup entities by composite key', async () => {
      // Create users first
      const leader = await fakeUserService.create({
        email: 'delete-leader@test.com',
        firstName: 'Delete',
        lastName: 'Leader',
        password: 'password',
        roleId: createdRoleIds.customer
      });
      
      const followerUser1 = await fakeUserService.create({
        email: 'delete-follower1@test.com',
        firstName: 'Delete',
        lastName: 'Follower1',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const followerUser2 = await fakeUserService.create({
        email: 'delete-follower2@test.com',
        firstName: 'Delete',
        lastName: 'Follower2',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const follower1 = await fakeFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser1.id,
        createdAt: new Date()
      });

      const follower2 = await fakeFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser2.id,
        createdAt: new Date()
      });

      expect(fakeFollowerService.entityIds.length).toBe(2);

      // Delete using composite key objects
      const deletedCount = await fakeFollowerService.cleanup();

      expect(deletedCount).toBe(2);

      // Verify they're actually deleted
      const found1 = await fakeFollowerService.findByCompositeKey({ leaderId: leader.id, followerId: followerUser1.id });
      const found2 = await fakeFollowerService.findByCompositeKey({ leaderId: leader.id, followerId: followerUser2.id });
      
      expect(found1).toBeUndefined();
      expect(found2).toBeUndefined();
    });
  });

  describe('Mixed Key Type Scenarios', () => {
    it('should handle single and composite key entities in same transaction', async () => {
      await PostgresDataSource.transaction(async (transactionEntityManager) => {
        // Create leader user with single key
        const leader = await fakeUserService.create({
          email: 'transaction-leader@example.com',
          firstName: 'John',
          lastName: 'Leader',
          password: 'password',
          roleId: createdRoleIds.customer
        }, transactionEntityManager);

        // Create follower user
        const followerUser = await fakeUserService.create({
          email: 'transaction-follower@example.com',
          firstName: 'Jane',
          lastName: 'Follower',
          password: 'password',
          roleId: createdRoleIds.customer
        }, transactionEntityManager);

        expect(leader.id).toBeDefined();
        expect(fakeUserService.getId(leader)).toBe(leader.id);

        // Create follower relationship with composite key
        const follower = await fakeFollowerService.create({
          leaderId: leader.id,
          followerId: followerUser.id,
          createdAt: new Date()
        }, transactionEntityManager);

        expect(follower.leaderId).toBe(leader.id);
        expect(follower.followerId).toBe(followerUser.id);
        
        const compositeId = fakeFollowerService.getId(follower);
        expect(compositeId).toEqual({ leaderId: leader.id, followerId: followerUser.id });
      });
    });

    it('should maintain referential integrity with composite keys', async () => {
      // Create two users first
      const leader = await fakeUserService.create({
        email: 'integrity-leader@test.com',
        firstName: 'Integrity',
        lastName: 'Leader',
        password: 'password',
        roleId: createdRoleIds.admin
      });

      const followerUser = await fakeUserService.create({
        email: 'integrity-follower@test.com',
        firstName: 'Integrity',
        lastName: 'Follower',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      // Create follower relationship that references both users
      const follower = await fakeFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser.id,
        createdAt: new Date()
      });

      expect(follower.leaderId).toBe(leader.id);
      expect(follower.followerId).toBe(followerUser.id);

      // Verify both entities exist and are properly linked
      const foundLeader = await fakeUserService.findByCompositeKey({ id: leader.id });
      const foundFollower = await fakeFollowerService.findByCompositeKey({
        leaderId: leader.id,
        followerId: followerUser.id
      });

      expect(foundLeader).toBeDefined();
      expect(foundFollower).toBeDefined();
      expect(foundFollower.leaderId).toBe(foundLeader.id);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should throw error for missing composite key fields', async () => {
      expect(() => fakeFollowerService.getId({ leaderId: 1 } as Follower))
        .toThrow('Primary key field "followerId" is empty or null in entity Follower');
    });

    it('should throw error for invalid composite key field in where clause', () => {
      expect(() => fakeFollowerService['buildCompositeKeyWhere']({ leaderId: 1, invalidField: 2 }))
        .toThrow('Invalid primary key field "invalidField" for entity Follower');
    });

    it('should handle null values in composite keys gracefully', () => {
      expect(() => fakeFollowerService.getId({ leaderId: 1, followerId: null } as Follower))
        .toThrow('Primary key field "followerId" is empty or null in entity Follower');
    });

    it('should handle undefined values in composite keys gracefully', () => {
      expect(() => fakeFollowerService.getId({ leaderId: 1 } as Follower))
        .toThrow('Primary key field "followerId" is empty or null in entity Follower');
    });
  });

  describe('Performance and Bulk Operations', () => {
    it('should efficiently handle bulk composite key operations', async () => {
      // Create users for the test
      const leader = await fakeUserService.create({
        email: 'bulk-leader@test.com',
        firstName: 'Bulk',
        lastName: 'Leader',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const followerUsers = await fakeUserService.createMany(50, {
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const startTime = Date.now();
      
      // Create 50 follower relationships using addStates pattern
      const followers = await fakeFollowerService
        .addStates(followerUsers.map(user => ({
          followerId: user.id,
        })))
        .createMany(50, {
          leaderId: leader.id,
          createdAt: new Date()
        });
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      expect(followers).toHaveLength(50);
      
      // Verify all have valid composite IDs
      for (const follower of followers) {
        const id = fakeFollowerService.getId(follower);
        expect(id).toHaveProperty('leaderId');
        expect(id).toHaveProperty('followerId');
        expect(typeof id.leaderId).toBe('number');
        expect(typeof id.followerId).toBe('number');
      }
    });

    it('should efficiently delete multiple entities by composite keys', async () => {
      // Create users for the test  
      const leader = await fakeUserService.create({
        email: 'delete-bulk-leader@test.com',
        firstName: 'Delete',
        lastName: 'BulkLeader',
        password: 'password',
        roleId: createdRoleIds.customer
      });

      const followerUsers = await fakeUserService.createMany(10, {
        password: 'password',
        roleId: createdRoleIds.customer
      });

      // Create test data using addStates pattern
      const followers = await fakeFollowerService
        .addStates(followerUsers.map(user => ({
          followerId: user.id,
        })))
        .createMany(10, {
          leaderId: leader.id,
          createdAt: new Date()
        });
      
      // Extract composite IDs for deletion
      const compositeIds = followers.map(f => fakeFollowerService.getId(f));
      
      const startTime = Date.now();
      const deletedCount = await fakeFollowerService.delete(compositeIds);
      const deletionTime = Date.now() - startTime;
      
      expect(deletedCount).toBe(10);
      expect(deletionTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Verify all are deleted
      for (const id of compositeIds) {
        const found = await fakeFollowerService.findByCompositeKey(id);
        expect(found).toBeUndefined();
      }
    });
  });
});