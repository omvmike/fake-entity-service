import {Sequelize} from "sequelize-typescript";
import {User} from "./sequelize-models/user.entity";
import {Role, RoleIds} from "./sequelize-models/role.entity";
import {FakeUserService} from "./sequelize-factories/fake-user.service";
import {FakeLeaderFollowerService} from "./sequelize-factories/fake-leader-follower.service";
import {LeaderFollower} from "./sequelize-models/leader-follower.entity";
import {FakeRoleService} from "./sequelize-factories/fake-role.service";
import {FakePostService} from "./sequelize-factories/fake-post.service";
import {Post} from "./sequelize-models/post.entity";
import {Comment} from "./sequelize-models/comment.entity";
import {FakeCommentService} from "./sequelize-factories/fake-comment.service";
import {col} from "sequelize";

const sequelize = new Sequelize({
  host: 'localhost',
  port: 54323,
  database: 'test-db',
  dialect: 'postgres',
  username: 'tester',
  password: 'test-pwd',

  models: [User, Role, LeaderFollower, Post, Comment],
});

const fakeUserService = new FakeUserService(sequelize.models.User as typeof User);
const fakeRoleService = new FakeRoleService(sequelize.models.Role as typeof Role);
const fakeLeaderFollowerService = new FakeLeaderFollowerService(sequelize.models.LeaderFollower as typeof LeaderFollower);
const fakePostService = new FakePostService(sequelize.models.Post as typeof Post);
const fakeCommentService = new FakeCommentService(sequelize.models.Comment as typeof Comment);

describe('Test SequelizeFakeEntityService can create and cleanup DB entities', () => {

  beforeAll(async () => {
    //
  });

  afterEach(async () => {
    await fakeUserService.cleanup();
  });

  it('should create user', async () => {
    const user = await fakeUserService.create();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
  });

  it('should create N users', async () => {
    const users = await fakeUserService.createMany(3);
    expect(users).toBeDefined();
    expect(users.length).toBe(3);
    expect(users[0].id).toBeDefined();
    expect(users[0].email).toBeDefined();
    expect(users[0].firstName).toBeDefined();
    expect(users[0].lastName).toBeDefined();
  });

  it('should create user with specific role', async () => {
    const customer = await fakeUserService.asRole(RoleIds.CUSTOMER).create();
    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.roleId).toBe(RoleIds.CUSTOMER);
    const manager = await fakeUserService.create({roleId: RoleIds.MANAGER});
    expect(manager).toBeDefined();
    expect(manager.id).toBeDefined();
    expect(manager.roleId).toBe(RoleIds.MANAGER);
  });

  it('should create and delete entities with composite key', async () => {
    const customer = await fakeUserService.asRole(RoleIds.CUSTOMER).create();
    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.roleId).toBe(RoleIds.CUSTOMER);
    const manager = await fakeUserService.asRole(RoleIds.MANAGER).create();
    expect(fakeLeaderFollowerService.getIdFieldNames()).toEqual(['leaderId', 'followerId']);


    const customerFollower = await fakeLeaderFollowerService.create({leaderId: customer.id, followerId: manager.id});
    const managerFollower = await fakeLeaderFollowerService.create({leaderId: manager.id, followerId: customer.id});

    expect(customerFollower).toBeDefined();
    expect(customerFollower.followerId).toBe(manager.id);
    expect(customerFollower.leaderId).toBe(customer.id);
    expect(fakeLeaderFollowerService.getId(customerFollower)).toHaveProperty('followerId');
    expect(fakeLeaderFollowerService.getId(customerFollower)).toHaveProperty('leaderId');

    expect(managerFollower).toBeDefined();
    expect(managerFollower.followerId).toBe(customer.id);
    expect(managerFollower.leaderId).toBe(manager.id);

    await fakeLeaderFollowerService.cleanup();
  });


  it('should create parent and nested entities', async () => {
    //const users = await fakeUserService.withCustomRole(fakeRoleService.addSequence('name', ['first', 'second', 'third'])).createMany(3);
    //console.log(JSON.stringify(user), user.roleId);
    const users = await fakeUserService.addFieldSequence('roleId',[RoleIds.ADMIN, RoleIds.CUSTOMER, RoleIds.MANAGER]).createMany(5);
    users.forEach(user =>  console.log(JSON.stringify(user), user.roleId));

  });

  it('should create user and posts', async () => {
    const user = await fakeUserService.asRole(RoleIds.CUSTOMER).create();
    const posts = await fakePostService.createMany(5, {userId: user.id});
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);

    await fakePostService.cleanup();
  });

  it('should create parent and nested entities', async () => {
    const posts = await fakePostService.withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER)).createMany(5);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    // all posts should have the same user with CUSTOMER role
    posts.forEach(post => {
      expect(post.userId).toBe(posts[0].userId)
      //expect(post.user.roleId).toBe(RoleIds.CUSTOMER
    });
    await fakePostService.cleanup();
  });

  it('should create unique parent for each nested entities', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER),true)
      .createMany(5);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    // all posts should have different user
    posts.forEach((post, i) => {
      posts.forEach((post2, j) => {
        if (i !== j) {
          expect(post.userId).not.toBe(post2.userId)
        }
      });
    });
    await fakePostService.cleanup();
  });

  it('should create field sequence', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addFieldSequence('message', ['one', 'two', 'three'])
      .createMany(5);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['one', 'two', 'three', 'one', 'two']);
    await fakePostService.cleanup();
  });

  it('should create array sequence', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addStates([{message: 'one'}, {message: 'two'}, {message: 'three'}])
      .afterMakingCallback((post, index) => {
        console.log('afterMakingCallback', post, index);
        return post;
      })
      .createMany(5);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['one', 'two', 'three', 'one', 'two']);
    await fakePostService.cleanup();
  });

  it('should create functional sequence', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addStates([
        () => ({message: 'one'}),
        () => ({message: 'two'}),
        () => ({message: 'three'}),
      ])
      .afterMakingCallback((post, index) => {
        console.log('afterMakingCallback', post, index);
        return post;
      })
      .createMany(5);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['one', 'two', 'three', 'one', 'two']);
    await fakePostService.cleanup();
  });

  it('should create array sequence with function', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addStates(() => ([{message: 'one'}, {message: 'two'}, {message: 'three'}]))
      .afterMakingCallback((post, index) => {
        console.log('afterMakingCallback', post, index);
        return post;
      })
      .createMany(5);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['one', 'two', 'three', 'one', 'two']);
    await fakePostService.cleanup();
  });

  it('should create array sequence and afterMakingCallback', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addStates([
        {message: 'one'},
        {message: 'two'},
        {message: 'three'},
      ])
      .afterMakingCallback((post, index) => {
        return {
          ...post,
          message: `${index + 1}. ${post.message}`,
        };
      })
      .createMany(5);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['1. one', '2. two', '3. three', '4. one', '5. two']);
    await fakePostService.cleanup();
  });

  it ('should create post with comments sequence', async () => {
    const commenters = await fakeUserService.asRole(RoleIds.CUSTOMER).createMany(3);
    const commentMessages = ['first comment', 'second comment', 'third comment'];
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .withComments(
        fakeCommentService
          .addStates(commenters.map((c, i) => ({
            userId: c.id,
            message: `${i + 1}. ${commentMessages[i % commentMessages.length]}`,
          }))), 3)
      .afterCreatingCallback(async (post, index) => {
        return post.reload({
          include: [{model: Comment}, {model: User}],
        });
      })
      .createMany(2);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(2);
    posts.map(post => {
      expect(post.user.id).toBe(post.userId)
      expect(post.comments.length).toBe(3);
      expect(post.comments[0].message).toBe('1. first comment');
      expect(post.comments[1].message).toBe('2. second comment');
      expect(post.comments[2].message).toBe('3. third comment');
    });
    await fakeCommentService.cleanup();
    await fakePostService.cleanup();
  });

  it('should fail to create user with missing required fields', async () => {
    // Missing user
    await expect(fakePostService.create({ message: 'Missing user' })).rejects.toThrow();
  });

  it('should fail to create user with duplicate email', async () => {
    const email = `duplicate${Date.now()}@example.com`;
    const user1 = await fakeUserService.create({ email, firstName: 'Dupe', lastName: 'User', password: 'pwd', roleId: RoleIds.CUSTOMER });
    await expect(fakeUserService.create({ email, firstName: 'Dupe2', lastName: 'User2', password: 'pwd', roleId: RoleIds.CUSTOMER })).rejects.toThrow();
  });

  it('should fail to create post with non-existent userId', async () => {
    // Assuming 999999 does not exist
    await expect(fakePostService.create({ userId: 999999, message: 'Invalid user' })).rejects.toThrow();
  });

  it('should return empty array when createMany(0) is called', async () => {
    const users = await fakeUserService.createMany(0);
    expect(users).toEqual([]);
  });

  it('should handle createMany with large N', async () => {
    // Use a reasonable large number to avoid test slowness
    const N = 100;
    const users = await fakeUserService.createMany(N);
    expect(users.length).toBe(N);
    users.forEach(user => {
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
    });
    await fakeUserService.cleanup();
  });


  it('should handle createMany with duplicate states', async () => {
    const email = 'duplicatestates@example.com';
    await expect(
      fakeUserService.addStates([
        { email, firstName: 'A', lastName: 'B', password: 'pwd', roleId: RoleIds.CUSTOMER },
        { email, firstName: 'C', lastName: 'D', password: 'pwd', roleId: RoleIds.CUSTOMER },
      ]).createMany(2)
    ).rejects.toThrow();
  });

  it('should create user with boundary and special values', async () => {
    // Max length strings (assuming 255 reasonable for test)
    const maxStr = 'a'.repeat(255);
    const user = await fakeUserService.create({
      email: `maxlen${Date.now()}@example.com`,
      firstName: maxStr,
      lastName: maxStr,
      password: maxStr,
      roleId: RoleIds.CUSTOMER,
    });
    expect(user).toBeDefined();
    expect(user.firstName.length).toBe(255);
    expect(user.lastName.length).toBe(255);
    // Empty strings
    const user2 = await fakeUserService.create({
      email: `empty${Date.now()}@example.com`,
      firstName: '',
      lastName: '',
      password: 'x',
      roleId: RoleIds.CUSTOMER,
    });
    expect(user2).toBeDefined();
    expect(user2.firstName).toBe('');
    expect(user2.lastName).toBe('');
    // Special characters
    const special = '!@#$%^&*()_+-=~`[]{}|;:\",.<>/?';
    const user3 = await fakeUserService.create({
      email: `special${Date.now()}@example.com`,
      firstName: special,
      lastName: special,
      password: 'x',
      roleId: RoleIds.CUSTOMER,
    });
    expect(user3).toBeDefined();
    expect(user3.firstName).toBe(special);
    expect(user3.lastName).toBe(special);
  });

  it('should create user with SQL-like input safely', async () => {
    const sql = "test'; DROP TABLE users; --";
    const user = await fakeUserService.create({
      email: `sql${Date.now()}@example.com`,
      firstName: sql,
      lastName: sql,
      password: 'x',
      roleId: RoleIds.CUSTOMER,
    });
    expect(user).toBeDefined();
    expect(user.firstName).toBe(sql);
    expect(user.lastName).toBe(sql);
  });

  it('should mutate properties in afterMakingCallback and persist changes', async () => {
    const newName = 'MutatedName';
    const users = await fakeUserService
      .addStates([{ firstName: 'WillChange', lastName: 'Before', email: `cb${Date.now()}@example.com`, password: 'x', roleId: RoleIds.CUSTOMER }])
      .afterMakingCallback((user, index) => {
        user.firstName = newName;
        return user;
      })
      .createMany(1);
    expect(users[0].firstName).toBe(newName);
  });

  it('should provide correct index/order in afterMakingCallback', async () => {
    const emails = [
      `cbidx1${Date.now()}@example.com`,
      `cbidx2${Date.now()}@example.com`,
      `cbidx3${Date.now()}@example.com`
    ];
    const users = await fakeUserService
      .addStates([
        { email: emails[0], firstName: 'A', lastName: 'A', password: 'x', roleId: RoleIds.CUSTOMER },
        { email: emails[1], firstName: 'B', lastName: 'B', password: 'x', roleId: RoleIds.CUSTOMER },
        { email: emails[2], firstName: 'C', lastName: 'C', password: 'x', roleId: RoleIds.CUSTOMER },
      ])
      .afterMakingCallback((user, index) => {
        user.lastName = `Order${index}`;
        return user;
      })
      .createMany(3);
    expect(users[0].lastName).toBe('Order0');
    expect(users[1].lastName).toBe('Order1');
    expect(users[2].lastName).toBe('Order2');
  });

  it('should clone service and produce empty state', async () => {
    // Arrange: create a user in the original service
    const user = await fakeUserService.create();
    expect(user).toBeDefined();
    expect(fakeUserService.entityIds.length).toBe(1);

    // Act: clone the service
    const clonedService = fakeUserService.clone();

    // Assert: cloned service should have same repository, but empty state
    expect(clonedService).not.toBe(fakeUserService);
    expect(clonedService.repository).toBe(fakeUserService.repository);
    expect(clonedService.entityIds.length).toBe(0);

    // Creating in the clone should not affect the original
    const user2 = await clonedService.createMany(3);
    expect(user2).toBeDefined();
    expect(clonedService.entityIds.length).toBe(3);
    expect(fakeUserService.entityIds.length).toBe(1);
  });

  it('should create two users, first with post and 1 comment, second with post and 2 comments', async () => {
    const commenters = await fakeUserService.asRole(RoleIds.CUSTOMER).createMany(3);

    const clonedFakeCommentService = fakeCommentService
      .clone()
      .addStates(commenters.map((c) => ({userId: c.id})));

    const clonedFakePostService = fakePostService.clone();
    // Create two users
    const users = await fakeUserService
      .withNested(
        fakePostService
          .withComments(fakeCommentService, 1, {message: 'First comment', userId: commenters[0].id}),
        {
          parent: 'id',
          nested: 'userId',
        }, 1)
      .withNested(
        clonedFakePostService
          .withComments(clonedFakeCommentService, 2, {message: 'Double comment'}),
        {
          parent: 'id',
          nested: 'userId',
        }, 1)
      .createMany(2);
    expect(users.length).toBe(2);

    const usersWithPosts = await fakeUserService.repository.findAll({
      where: { id: users.map(user => user.id) },
      include: [
        {
          model: Post,
          include: [
            {
              model: Comment,
            },
          ],
        },
      ],
    })

    // check that user has two posts
    // one of them has 1 comment and the other has 2 comments
    expect(usersWithPosts.length).toBe(2);
    expect(usersWithPosts[0].posts.length).toBe(2);
    expect(usersWithPosts[0].posts[0].comments.length).toBe(1);
    expect(usersWithPosts[0].posts[0].comments[0].message).toBe('First comment');
    expect(usersWithPosts[0].posts[1].comments.length).toBe(2);

    expect(usersWithPosts[1].posts.length).toBe(2);
    expect(usersWithPosts[1].posts[0].comments.length).toBe(1);
    expect(usersWithPosts[1].posts[1].comments.length).toBe(2);


    await fakeCommentService.cleanup();
    await clonedFakeCommentService.cleanup();
    await fakePostService.cleanup();
    await clonedFakePostService.cleanup();
  });

  describe('EntityIds Management', () => {
    
    describe('Single Primary Key Entity (User)', () => {
      beforeEach(async () => {
        // Ensure clean state before each test
        await fakeUserService.cleanup();
      });

      it('should track entityIds when creating single entities', async () => {
        expect(fakeUserService.entityIds.length).toBe(0);
        
        const user1 = await fakeUserService.create();
        expect(fakeUserService.entityIds.length).toBe(1);
        expect(fakeUserService.entityIds[0]).toBe(user1.id);
        
        const user2 = await fakeUserService.create();
        expect(fakeUserService.entityIds.length).toBe(2);
        expect(fakeUserService.entityIds).toContain(user1.id);
        expect(fakeUserService.entityIds).toContain(user2.id);
      });

      it('should track entityIds when creating multiple entities', async () => {
        expect(fakeUserService.entityIds.length).toBe(0);
        
        const users = await fakeUserService.createMany(3);
        expect(fakeUserService.entityIds.length).toBe(3);
        
        users.forEach(user => {
          expect(fakeUserService.entityIds).toContain(user.id);
        });
      });

      it('should remove specific IDs from entityIds when using delete()', async () => {
        const users = await fakeUserService.createMany(5);
        expect(fakeUserService.entityIds.length).toBe(5);
        
        const idsToDelete = [users[1].id, users[3].id];
        const deletedCount = await fakeUserService.delete(idsToDelete);
        
        expect(deletedCount).toBe(2);
        expect(fakeUserService.entityIds.length).toBe(3);
        expect(fakeUserService.entityIds).not.toContain(users[1].id);
        expect(fakeUserService.entityIds).not.toContain(users[3].id);
        expect(fakeUserService.entityIds).toContain(users[0].id);
        expect(fakeUserService.entityIds).toContain(users[2].id);
        expect(fakeUserService.entityIds).toContain(users[4].id);
      });

      it('should clear all entityIds when using cleanup()', async () => {
        const users = await fakeUserService.createMany(4);
        expect(fakeUserService.entityIds.length).toBe(4);
        
        const deletedCount = await fakeUserService.cleanup();
        
        expect(deletedCount).toBe(4);
        expect(fakeUserService.entityIds.length).toBe(0);
      });

      it('should handle partial deletions correctly', async () => {
        const users = await fakeUserService.createMany(3);
        expect(fakeUserService.entityIds.length).toBe(3);
        
        // Delete only the first user
        const deletedCount = await fakeUserService.delete([users[0].id]);
        
        expect(deletedCount).toBe(1);
        expect(fakeUserService.entityIds.length).toBe(2);
        expect(fakeUserService.entityIds).not.toContain(users[0].id);
        expect(fakeUserService.entityIds).toContain(users[1].id);
        expect(fakeUserService.entityIds).toContain(users[2].id);
      });
    });

    describe('Composite Primary Key Entity (LeaderFollower)', () => {
      beforeEach(async () => {
        // Ensure clean state before each test
        await fakeLeaderFollowerService.cleanup();
        await fakeUserService.cleanup();
      });

      it('should track composite entityIds when creating entities', async () => {
        expect(fakeLeaderFollowerService.entityIds.length).toBe(0);
        
        // Create users for the relationship
        const users = await fakeUserService.createMany(3);
        
        const follower1 = await fakeLeaderFollowerService.create({
          leaderId: users[0].id,
          followerId: users[1].id
        });
        
        expect(fakeLeaderFollowerService.entityIds.length).toBe(1);
        const expectedId1 = { leaderId: users[0].id, followerId: users[1].id };
        expect(fakeLeaderFollowerService.entityIds[0]).toEqual(expectedId1);
        
        const follower2 = await fakeLeaderFollowerService.create({
          leaderId: users[1].id,
          followerId: users[2].id
        });
        
        expect(fakeLeaderFollowerService.entityIds.length).toBe(2);
        const expectedId2 = { leaderId: users[1].id, followerId: users[2].id };
        expect(fakeLeaderFollowerService.entityIds).toContainEqual(expectedId1);
        expect(fakeLeaderFollowerService.entityIds).toContainEqual(expectedId2);
      });

      it('should remove specific composite IDs from entityIds when using delete()', async () => {
        // Create users for the relationships
        const users = await fakeUserService.createMany(4);
        
        // Create follower relationships
        const follower1 = await fakeLeaderFollowerService.create({
          leaderId: users[0].id,
          followerId: users[1].id
        });
        const follower2 = await fakeLeaderFollowerService.create({
          leaderId: users[1].id,
          followerId: users[2].id
        });
        const follower3 = await fakeLeaderFollowerService.create({
          leaderId: users[2].id,
          followerId: users[3].id
        });
        
        expect(fakeLeaderFollowerService.entityIds.length).toBe(3);
        
        // Delete specific composite entities
        const idsToDelete = [
          { leaderId: users[0].id, followerId: users[1].id },
          { leaderId: users[2].id, followerId: users[3].id }
        ];
        
        const deletedCount = await fakeLeaderFollowerService.delete(idsToDelete);
        
        expect(deletedCount).toBe(2);
        expect(fakeLeaderFollowerService.entityIds.length).toBe(1);
        expect(fakeLeaderFollowerService.entityIds).toContainEqual({
          leaderId: users[1].id,
          followerId: users[2].id
        });
        expect(fakeLeaderFollowerService.entityIds).not.toContainEqual({
          leaderId: users[0].id,
          followerId: users[1].id
        });
        expect(fakeLeaderFollowerService.entityIds).not.toContainEqual({
          leaderId: users[2].id,
          followerId: users[3].id
        });
      });

      it('should clear all composite entityIds when using cleanup()', async () => {
        // Create users for the relationships
        const users = await fakeUserService.createMany(4);
        
        // Create multiple follower relationships
        await fakeLeaderFollowerService.create({
          leaderId: users[0].id,
          followerId: users[1].id
        });
        await fakeLeaderFollowerService.create({
          leaderId: users[1].id,
          followerId: users[2].id
        });
        await fakeLeaderFollowerService.create({
          leaderId: users[2].id,
          followerId: users[3].id
        });
        
        expect(fakeLeaderFollowerService.entityIds.length).toBe(3);
        
        const deletedCount = await fakeLeaderFollowerService.cleanup();
        
        expect(deletedCount).toBe(3);
        expect(fakeLeaderFollowerService.entityIds.length).toBe(0);
      });

      it('should handle composite key ID matching correctly', async () => {
        // Create users for the relationships
        const users = await fakeUserService.createMany(3);
        
        const follower1 = await fakeLeaderFollowerService.create({
          leaderId: users[0].id,
          followerId: users[1].id
        });
        const follower2 = await fakeLeaderFollowerService.create({
          leaderId: users[1].id,
          followerId: users[0].id  // Reversed relationship
        });
        
        expect(fakeLeaderFollowerService.entityIds.length).toBe(2);
        
        // Delete only the first relationship
        const deletedCount = await fakeLeaderFollowerService.delete([{
          leaderId: users[0].id,
          followerId: users[1].id
        }]);
        
        expect(deletedCount).toBe(1);
        expect(fakeLeaderFollowerService.entityIds.length).toBe(1);
        expect(fakeLeaderFollowerService.entityIds).toContainEqual({
          leaderId: users[1].id,
          followerId: users[0].id
        });
        expect(fakeLeaderFollowerService.entityIds).not.toContainEqual({
          leaderId: users[0].id,
          followerId: users[1].id
        });
      });
    });

    describe('Mixed Scenarios and Edge Cases', () => {
      beforeEach(async () => {
        await fakeUserService.cleanup();
        await fakeLeaderFollowerService.cleanup();
      });

      it('should handle create/delete cycles correctly', async () => {
        // First cycle
        const users1 = await fakeUserService.createMany(2);
        expect(fakeUserService.entityIds.length).toBe(2);
        await fakeUserService.cleanup();
        expect(fakeUserService.entityIds.length).toBe(0);
        
        // Second cycle
        const users2 = await fakeUserService.createMany(3);
        expect(fakeUserService.entityIds.length).toBe(3);
        
        // Partial deletion
        await fakeUserService.delete([users2[0].id]);
        expect(fakeUserService.entityIds.length).toBe(2);
        
        // Final cleanup
        await fakeUserService.cleanup();
        expect(fakeUserService.entityIds.length).toBe(0);
      });

      it('should not affect entityIds when deletion fails', async () => {
        const users = await fakeUserService.createMany(2);
        expect(fakeUserService.entityIds.length).toBe(2);
        
        // Try to delete non-existent ID (should not crash)
        try {
          await fakeUserService.delete([99999]);
        } catch (error) {
          // Expected behavior may vary - some ORMs silently ignore, others throw
        }
        
        // EntityIds should remain intact
        expect(fakeUserService.entityIds.length).toBe(2);
        expect(fakeUserService.entityIds).toContain(users[0].id);
        expect(fakeUserService.entityIds).toContain(users[1].id);
      });

      it('should maintain separate entityIds between different services', async () => {
        const users = await fakeUserService.createMany(2);
        expect(fakeUserService.entityIds.length).toBe(2);
        expect(fakeLeaderFollowerService.entityIds.length).toBe(0);
        
        const follower = await fakeLeaderFollowerService.create({
          leaderId: users[0].id,
          followerId: users[1].id
        });
        
        expect(fakeUserService.entityIds.length).toBe(2);
        expect(fakeLeaderFollowerService.entityIds.length).toBe(1);
        
        // Clean up one service
        await fakeUserService.cleanup();
        expect(fakeUserService.entityIds.length).toBe(0);
        expect(fakeLeaderFollowerService.entityIds.length).toBe(1);
        
        // Clean up the other service
        await fakeLeaderFollowerService.cleanup();
        expect(fakeLeaderFollowerService.entityIds.length).toBe(0);
      });
    });
  });
});
