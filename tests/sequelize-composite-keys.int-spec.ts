import { Sequelize } from 'sequelize-typescript';
import { User } from './sequelize-models/user.entity';
import { Role, RoleIds } from './sequelize-models/role.entity';
import { LeaderFollower } from './sequelize-models/leader-follower.entity';
import { FakeUserService } from './sequelize-factories/fake-user.service';
import { FakeLeaderFollowerService } from './sequelize-factories/fake-leader-follower.service';
import {Post} from "./sequelize-models/post.entity";
import {Comment} from "./sequelize-models/comment.entity";

const sequelize = new Sequelize({
  host: 'localhost',
  port: 54323,
  dialect: 'postgres',
  database: 'test-db',
  username: 'tester',
  password: 'test-pwd',
  logging: false,
  models: [User, Role, LeaderFollower, Post, Comment],
});

let fakeUserService: FakeUserService;
let fakeLeaderFollowerService: FakeLeaderFollowerService;
let createdRoleIds: { admin: number; customer: number; manager: number };

describe('Sequelize Composite Key Operations', () => {

  beforeAll(async () => {
    await sequelize.authenticate();
    
    // Create required roles for the tests using direct SQL to handle upserts
    try {
      await sequelize.query(`
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
    const roles = await Role.findAll();
    
    // Map the created roles to their actual IDs
    createdRoleIds = {
      admin: roles.find(r => r.name === 'ADMIN')?.id || 1,
      customer: roles.find(r => r.name === 'CUSTOMER')?.id || 2,
      manager: roles.find(r => r.name === 'MANAGER')?.id || 3
    };
    
    fakeUserService = new FakeUserService(User);
    fakeLeaderFollowerService = new FakeLeaderFollowerService(LeaderFollower);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  afterEach(async () => {
    await fakeLeaderFollowerService.cleanup();
    await fakeUserService.cleanup();
  });

  describe('Primary Key Detection', () => {
    it('should detect single primary key for User entity', () => {
      expect(fakeUserService.getIdFieldNames()).toEqual(['id']);
      expect(fakeUserService.hasCompositeId()).toBe(false);
    });

    it('should detect composite primary keys for LeaderFollower entity', () => {
      expect(fakeLeaderFollowerService.getIdFieldNames()).toEqual(['leaderId', 'followerId']);
      expect(fakeLeaderFollowerService.hasCompositeId()).toBe(true);
    });

    it('should access primary key metadata from repository', () => {
      const userPrimaryKeys = fakeUserService.getIdFieldNames();
      expect(userPrimaryKeys).toHaveLength(1);
      expect(userPrimaryKeys[0]).toBe('id');

      const leaderFollowerPrimaryKeys = fakeLeaderFollowerService.getIdFieldNames();
      expect(leaderFollowerPrimaryKeys).toHaveLength(2);
      expect(leaderFollowerPrimaryKeys.sort()).toEqual(['followerId', 'leaderId']);
    });
  });

  describe('Composite Key CRUD Operations', () => {
    it('should create and retrieve LeaderFollower by composite key', async () => {
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

      const leaderFollower = await fakeLeaderFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser.id,
        createdAt: new Date()
      });

      expect(leaderFollower).toBeDefined();
      expect(leaderFollower.leaderId).toBe(leader.id);
      expect(leaderFollower.followerId).toBe(followerUser.id);
      expect(leaderFollower.createdAt).toBeInstanceOf(Date);

      // Test getId returns composite key object
      const id = fakeLeaderFollowerService.getId(leaderFollower);
      expect(id).toEqual({ leaderId: leader.id, followerId: followerUser.id });
    });

    it('should create multiple LeaderFollower entities with composite keys', async () => {
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

      const leaderFollowers = await fakeLeaderFollowerService
        .addStates(followerUsers.map(user => ({
          followerId: user.id,
        }))).createMany(3,{
            leaderId: leader.id,
            createdAt: new Date()
          });

      expect(leaderFollowers).toHaveLength(3);
      
      for (const leaderFollower of leaderFollowers) {
        expect(leaderFollower.leaderId).toBe(leader.id);
        expect(leaderFollower.followerId).toBeDefined();
        expect(leaderFollower.createdAt).toBeInstanceOf(Date);
        
        // Each should have a valid composite ID
        const id = fakeLeaderFollowerService.getId(leaderFollower);
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

      const created = await fakeLeaderFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser.id,
        createdAt: new Date()
      });

      const found = await fakeLeaderFollowerService.findByCompositeKey({
        leaderId: leader.id,
        followerId: followerUser.id
      });

      expect(found).toBeDefined();
      expect(found.leaderId).toBe(created.leaderId);
      expect(found.followerId).toBe(created.followerId);
      expect(found.createdAt).toEqual(created.createdAt);
    });

    it('should return undefined when composite key not found', async () => {
      const notFound = await fakeLeaderFollowerService.findByCompositeKey({
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

      const leaderFollower1 = await fakeLeaderFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser1.id,
        createdAt: new Date()
      });

      const leaderFollower2 = await fakeLeaderFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser2.id,
        createdAt: new Date()
      });

      expect(fakeLeaderFollowerService.entityIds.length).toBe(2);

      // Delete using composite key objects
      const deletedCount = await fakeLeaderFollowerService.cleanup();

      expect(deletedCount).toBe(2);

      // Verify they're actually deleted
      const found1 = await fakeLeaderFollowerService.findByCompositeKey({ leaderId: leader.id, followerId: followerUser1.id });
      const found2 = await fakeLeaderFollowerService.findByCompositeKey({ leaderId: leader.id, followerId: followerUser2.id });
      
      expect(found1).toBeUndefined();
      expect(found2).toBeUndefined();
    });
  });

  describe('Mixed Key Type Scenarios', () => {
    it('should handle single and composite key entities in same transaction', async () => {
      await sequelize.transaction(async (transaction) => {
        // Create leader user with single key
        const leader = await fakeUserService.create({
          email: 'transaction-leader@example.com',
          firstName: 'John',
          lastName: 'Leader',
          password: 'password',
          roleId: createdRoleIds.customer
        }, transaction);

        // Create follower user
        const followerUser = await fakeUserService.create({
          email: 'transaction-follower@example.com',
          firstName: 'Jane',
          lastName: 'Follower',
          password: 'password',
          roleId: createdRoleIds.customer
        }, transaction);

        expect(leader.id).toBeDefined();
        expect(fakeUserService.getId(leader)).toBe(leader.id);

        // Create leader-follower relationship with composite key
        const leaderFollower = await fakeLeaderFollowerService.create({
          leaderId: leader.id,
          followerId: followerUser.id,
          createdAt: new Date()
        }, transaction);

        expect(leaderFollower.leaderId).toBe(leader.id);
        expect(leaderFollower.followerId).toBe(followerUser.id);
        
        const compositeId = fakeLeaderFollowerService.getId(leaderFollower);
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

      // Create leader-follower relationship that references both users
      const leaderFollower = await fakeLeaderFollowerService.create({
        leaderId: leader.id,
        followerId: followerUser.id,
        createdAt: new Date()
      });

      expect(leaderFollower.leaderId).toBe(leader.id);
      expect(leaderFollower.followerId).toBe(followerUser.id);

      // Verify both entities exist and are properly linked
      const foundLeader = await fakeUserService.findByCompositeKey({ id: leader.id });
      const foundLeaderFollower = await fakeLeaderFollowerService.findByCompositeKey({
        leaderId: leader.id,
        followerId: followerUser.id
      });

      expect(foundLeader).toBeDefined();
      expect(foundLeaderFollower).toBeDefined();
      expect(foundLeaderFollower.leaderId).toBe(foundLeader.id);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should throw error for missing composite key fields', () => {
      expect(() => fakeLeaderFollowerService.getId({ leaderId: 1 } as LeaderFollower))
        .toThrow('Id field "followerId" is empty');
    });

    it('should throw error for invalid composite key field in where clause', () => {
      expect(() => fakeLeaderFollowerService['buildCompositeKeyWhere']({ leaderId: 1, invalidField: 2 }))
        .toThrow('Invalid primary key field "invalidField" for entity LeaderFollower');
    });

    it('should handle null values in composite keys gracefully', () => {
      expect(fakeLeaderFollowerService.getId({ leaderId: 1, followerId: null } as LeaderFollower))
        .toEqual({ leaderId: 1, followerId: null });
    });

    it('should handle undefined values in composite keys gracefully', () => {
      expect(() => fakeLeaderFollowerService.getId({ leaderId: 1 } as LeaderFollower))
        .toThrow('Id field "followerId" is empty');
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
      
      // Create 50 leader-follower relationships using addStates pattern
      const leaderFollowers = await fakeLeaderFollowerService
        .addStates(followerUsers.map(user => ({
          followerId: user.id,
        })))
        .createMany(50, {
          leaderId: leader.id,
          createdAt: new Date()
        });
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      expect(leaderFollowers).toHaveLength(50);
      
      // Verify all have valid composite IDs
      for (const leaderFollower of leaderFollowers) {
        const id = fakeLeaderFollowerService.getId(leaderFollower);
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
      const leaderFollowers = await fakeLeaderFollowerService
        .addStates(followerUsers.map(user => ({
          followerId: user.id,
        })))
        .createMany(10, {
          leaderId: leader.id,
          createdAt: new Date()
        });
      
      // Extract composite IDs for deletion
      const compositeIds = leaderFollowers.map(f => fakeLeaderFollowerService.getId(f));
      
      const startTime = Date.now();
      const deletedCount = await fakeLeaderFollowerService.delete(compositeIds);
      const deletionTime = Date.now() - startTime;
      
      expect(deletedCount).toBe(10);
      expect(deletionTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Verify all are deleted
      for (const id of compositeIds) {
        const found = await fakeLeaderFollowerService.findByCompositeKey(id);
        expect(found).toBeUndefined();
      }
    });
  });
});