import {DataSource, Repository} from "typeorm"
import {FakeUserService} from "./typeorm-factories/fake-user.service";
import {User} from "./typeorm-models/user.entity";
import {Role, RoleIds} from "./typeorm-models/role.entity";
import {FakePostService} from "./typeorm-factories/fake-post.service";
import {Post} from "./typeorm-models/post.entity";
import {Comment} from "./typeorm-models/comment.entity";
import {FakeCommentService} from "./typeorm-factories/fake-comment.service";
const PostgresDataSource = new DataSource({
  host: 'localhost',
  port: 54323,
  type: 'postgres',
  database: 'test-db',
  username: 'tester',
  password: 'test-pwd',
  synchronize: false,
  entities: [User, Role, Post, Comment],
});

let fakeUserService: FakeUserService;
let fakePostService: FakePostService;
let fakeCommentService: FakeCommentService;

describe('Test TypeormFakeEntityService can create and cleanup DB entities', () => {

  beforeAll(async () => {
    await PostgresDataSource.initialize();
    const userRepo = PostgresDataSource.getRepository(User);
    fakeUserService = new FakeUserService(userRepo);
    fakePostService = new FakePostService(PostgresDataSource.getRepository(Post));
    fakeCommentService = new FakeCommentService(PostgresDataSource.getRepository(Comment));
  });

  afterEach(async () => {
    await fakeUserService.cleanup();
  });

  afterAll(async () => {
    await PostgresDataSource.destroy();
  });

  it('should create user', async () => {
    const user = await fakeUserService.create();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
  });

  it('should automatically detect primary key for User entity', () => {
    expect(fakeUserService.getIdFieldNames()).toEqual(['id']);
    expect(fakeUserService.hasCompositeId()).toBe(false);
    
    const primaryColumns = fakeUserService.getPrimaryColumns();
    expect(primaryColumns).toHaveLength(1);
    expect(primaryColumns[0].propertyName).toBe('id');
  });

  it('should extract single primary key ID correctly', async () => {
    const user = await fakeUserService.create();
    const extractedId = fakeUserService.getId(user);
    
    expect(extractedId).toBe(user.id);
    expect(typeof extractedId).toBe('number');
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
    const customer = await fakeUserService.asCustomer().create();
    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.roleId).toBe(RoleIds.CUSTOMER);
    const manager = await fakeUserService.create({roleId: RoleIds.MANAGER});
    expect(manager).toBeDefined();
    expect(manager.id).toBeDefined();
    expect(manager.roleId).toBe(RoleIds.MANAGER);
  });

  it('should create parent and nested entities', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .afterMakingCallback( (post) => {
        console.log('post', post)
        return post;
      })
      .createMany(5);
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
        return fakePostService.repository.findOne({
          where: {id: post.id},
          relations: ['comments', 'user'],
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

  it('should delete entities using automatic primary key detection', async () => {
    const users = await fakeUserService.createMany(3);
    expect(users).toHaveLength(3);
    
    // Extract IDs using automatic detection
    const userIds = users.map(user => fakeUserService.getId(user));
    expect(userIds).toHaveLength(3);
    userIds.forEach(id => {
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });
    
    // Delete using detected IDs
    const deletedCount = await fakeUserService.delete(userIds);
    expect(deletedCount).toBe(3);
    
    // Verify entities are deleted
    for (const id of userIds) {
      const found = await fakeUserService.repository.findOne({ where: { id } });
      expect(found).toBeNull();
    }
  });

  it('should handle mixed primary key scenarios across different entities', async () => {
    // Test User entity (single primary key)
    const user = await fakeUserService.create();
    expect(fakeUserService.getIdFieldNames()).toEqual(['id']);
    expect(fakeUserService.hasCompositeId()).toBe(false);
    expect(fakeUserService.getId(user)).toBe(user.id);
    
    // Test Post entity (single primary key)
    const post = await fakePostService.create({ userId: user.id, message: 'Test post' });
    expect(fakePostService.getIdFieldNames()).toEqual(['id']);
    expect(fakePostService.hasCompositeId()).toBe(false);
    expect(fakePostService.getId(post)).toBe(post.id);
    
    // Test Comment entity (single primary key)
    const comment = await fakeCommentService.create({ 
      userId: user.id, 
      postId: post.id, 
      message: 'Test comment' 
    });
    expect(fakeCommentService.getIdFieldNames()).toEqual(['id']);
    expect(fakeCommentService.hasCompositeId()).toBe(false);
    expect(fakeCommentService.getId(comment)).toBe(comment.id);
    
    // Cleanup
    await fakeCommentService.cleanup();
    await fakePostService.cleanup();
  });

  it('should validate primary key detection consistency', async () => {
    // Create multiple users and verify consistent ID extraction
    const users = await fakeUserService.createMany(5);
    
    for (const user of users) {
      const extractedId = fakeUserService.getId(user);
      expect(extractedId).toBe(user.id);
      expect(typeof extractedId).toBe('number');
      expect(extractedId).toBeGreaterThan(0);
    }
    
    // Verify all IDs are unique
    const allIds = users.map(user => fakeUserService.getId(user));
    const uniqueIds = [...new Set(allIds)];
    expect(uniqueIds).toHaveLength(allIds.length);
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
    
    // Assert: cloned service should have same primary key detection
    expect(clonedService.getIdFieldNames()).toEqual(fakeUserService.getIdFieldNames());
    expect(clonedService.hasCompositeId()).toBe(fakeUserService.hasCompositeId());

    // Creating in the clone should not affect the original
    const user2 = await clonedService.createMany(3);
    expect(user2).toBeDefined();
    expect(clonedService.entityIds.length).toBe(3);
    expect(fakeUserService.entityIds.length).toBe(1);
  });
});
