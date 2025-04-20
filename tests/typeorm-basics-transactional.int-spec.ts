import {DataSource, EntityManager, In, QueryRunner} from "typeorm"
import {FakeUserService} from "./typeorm-factories/fake-user.service";
import {User} from "./typeorm-models/user.entity";
import {Role, RoleIds} from "./typeorm-models/role.entity";
import {FakePostService} from "./typeorm-factories/fake-post.service";
import {Post} from "./typeorm-models/post.entity";
import {Comment} from "./typeorm-models/comment.entity";
import {FakeCommentService} from "./typeorm-factories/fake-comment.service";
import {FakeRoleService} from "./typeorm-factories/fake-role.service";

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
let fakeRoleService: FakeRoleService;

describe('Test TypeormFakeEntityService with transactions', () => {
  let transaction: EntityManager;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    await PostgresDataSource.initialize();
    const userRepo = PostgresDataSource.getRepository(User);
    fakeUserService = new FakeUserService(userRepo);
    fakePostService = new FakePostService(PostgresDataSource.getRepository(Post));
    fakeCommentService = new FakeCommentService(PostgresDataSource.getRepository(Comment));
    fakeRoleService = new FakeRoleService(PostgresDataSource.getRepository(Role));
  });

  beforeEach(async () => {
    // Start a new transaction before each test
    queryRunner = PostgresDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    transaction = queryRunner.manager;
  });

  afterEach(async () => {
    // Rollback the transaction after each test
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    await queryRunner.release();
  });

  afterAll(async () => {
    await PostgresDataSource.destroy();
  });

  it('should create user within transaction', async () => {
    const user = await fakeUserService.create({}, transaction);
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
  });

  it('should create N users within transaction', async () => {
    const users = await fakeUserService.createMany(3, {}, transaction);
    expect(users).toBeDefined();
    expect(users.length).toBe(3);
    expect(users[0].id).toBeDefined();
    expect(users[0].email).toBeDefined();
    expect(users[0].firstName).toBeDefined();
    expect(users[0].lastName).toBeDefined();
  });

  it('should create user with specific role within transaction', async () => {
    const customer = await fakeUserService.asRole(RoleIds.CUSTOMER).create({}, transaction);
    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.roleId).toBe(RoleIds.CUSTOMER);
    const manager = await fakeUserService.create({roleId: RoleIds.MANAGER}, transaction);
    expect(manager).toBeDefined();
    expect(manager.id).toBeDefined();
    expect(manager.roleId).toBe(RoleIds.MANAGER);
  });

  it('should create parent and nested entities within transaction', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .afterMakingCallback((post) => {
        return post;
      })
      .createMany(5, {}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    // all posts should have the same user with CUSTOMER role
    posts.forEach(post => {
      expect(post.userId).toBe(posts[0].userId);
    });
    
    // Verify the user exists in the transaction
    const user = await transaction.findOne(User, {
      where: { id: posts[0].userId }
    });
    expect(user).toBeDefined();
    expect(user.roleId).toBe(RoleIds.CUSTOMER);
  });

  it('should create unique parent for each nested entity within transaction', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER), true)
      .createMany(5, {}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    // all posts should have different user
    posts.forEach((post, i) => {
      posts.forEach((post2, j) => {
        if (i !== j) {
          expect(post.userId).not.toBe(post2.userId);
        }
      });
    });
    
    // Verify all users exist in the transaction
    const userIds = posts.map(post => post.userId);
    const users = await transaction.find(User, {
      where: { id: In(userIds) }
    });
    expect(users.length).toBe(5);
  });

  it('should create field sequence within transaction', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addFieldSequence('message', ['one', 'two', 'three'])
      .createMany(5, {}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['one', 'two', 'three', 'one', 'two']);
  });

  it('should create array sequence within transaction', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addStates([{message: 'one'}, {message: 'two'}, {message: 'three'}])
      .afterMakingCallback((post, index) => {
        return post;
      })
      .createMany(5, {}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['one', 'two', 'three', 'one', 'two']);
  });

  it('should create functional sequence within transaction', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addStates([
        () => ({message: 'one'}),
        () => ({message: 'two'}),
        () => ({message: 'three'}),
      ])
      .afterMakingCallback((post, index) => {
        return post;
      })
      .createMany(5, {}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['one', 'two', 'three', 'one', 'two']);
  });

  it('should create array sequence and afterMakingCallback within transaction', async () => {
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
      .createMany(5, {}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    const messages = posts.map(post => post.message);
    expect(messages).toEqual(['1. one', '2. two', '3. three', '4. one', '5. two']);
  });

  it('should create post with comments sequence within transaction', async () => {
    const commenters = await fakeUserService.asRole(RoleIds.CUSTOMER).createMany(3, {}, transaction);
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
        return transaction.findOne(Post, {
          where: { id: post.id },
          relations: ['comments', 'user']
        });
      })
      .createMany(2, {}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(2);
    posts.map(post => {
      expect(post.user.id).toBe(post.userId);
      expect(post.comments.length).toBe(3);
      expect(post.comments[0].message).toBe('1. first comment');
      expect(post.comments[1].message).toBe('2. second comment');
      expect(post.comments[2].message).toBe('3. third comment');
    });
    
    // Verify that comments exist in the transaction
    const postIds = posts.map(post => post.id);
    const comments = await transaction.find(Comment, {
      where: { postId: In(postIds) }
    });
    expect(comments.length).toBe(6); // 2 posts * 3 comments each
  });

  // Test that demonstrates transaction isolation
  it('should not see entities outside of transaction', async () => {
    // Create a user within the transaction
    const user = await fakeUserService.create({}, transaction);
    
    // Verify the user exists within the transaction
    const userInTransaction = await transaction.findOne(User, {
      where: { id: user.id }
    });
    expect(userInTransaction).toBeDefined();
    
    // Verify the user does not exist outside the transaction
    const userOutsideTransaction = await PostgresDataSource.getRepository(User).findOne({
      where: { id: user.id }
    });
    expect(userOutsideTransaction).toBeNull();
  });

  // Test that demonstrates transaction rollback
  it('should rollback all changes when transaction is rolled back', async () => {
    // Create a user within the transaction
    const user = await fakeUserService.create({}, transaction);
    
    // Create posts for the user within the transaction
    await fakePostService.createMany(3, { userId: user.id }, transaction);
    
    // Verify posts exist within the transaction
    const postsInTransaction = await transaction.find(Post, {
      where: { userId: user.id }
    });
    expect(postsInTransaction.length).toBe(3);
    
    // Manually rollback the transaction
    await queryRunner.rollbackTransaction();
    
    // Start a new transaction for verification
    const newQueryRunner = PostgresDataSource.createQueryRunner();
    await newQueryRunner.connect();
    await newQueryRunner.startTransaction();
    const newTransaction = newQueryRunner.manager;
    
    try {
      // Verify the user does not exist after rollback
      const userAfterRollback = await newTransaction.findOne(User, {
        where: { id: user.id }
      });
      expect(userAfterRollback).toBeNull();
      
      // Verify posts do not exist after rollback
      const postsAfterRollback = await newTransaction.find(Post, {
        where: { userId: user.id }
      });
      expect(postsAfterRollback.length).toBe(0);
    } finally {
      await newQueryRunner.rollbackTransaction();
      await newQueryRunner.release();
    }
  });

  // Test that demonstrates transaction commit
  it('should persist changes when transaction is committed', async () => {
    // Create a user within the transaction
    const user = await fakeUserService.create({}, transaction);
    
    // Commit the transaction
    await queryRunner.commitTransaction();
    
    // Start a new transaction for verification
    const newQueryRunner = PostgresDataSource.createQueryRunner();
    await newQueryRunner.connect();
    await newQueryRunner.startTransaction();
    const newTransaction = newQueryRunner.manager;
    
    try {
      // Verify the user exists after commit
      const userAfterCommit = await newTransaction.findOne(User, {
        where: { id: user.id }
      });
      expect(userAfterCommit).toBeDefined();
      expect(userAfterCommit.id).toBe(user.id);
      
      // Clean up the committed data
      await newTransaction.delete(User, { id: user.id });
      await newQueryRunner.commitTransaction();
    } finally {
      if (newQueryRunner.isTransactionActive) {
        await newQueryRunner.rollbackTransaction();
      }
      await newQueryRunner.release();
    }
  });

  it('should automatically rollback transaction when create() throws an error', async () => {

    const user = await fakeUserService.create({}, transaction);
    
    // Verify the user exists within the transaction
    const userBeforeError = await transaction.findOne(User, {
      where: { id: user.id }
    });
    expect(userBeforeError).toBeDefined();
    
    // Attempt to create a post with invalid data that should cause an error
    // We'll use a non-existent user ID to trigger a foreign key constraint error
    const nonExistentUserId = 0;
    
    let errorThrown = false;
    try {
      // This should fail due to foreign key constraint
      await fakePostService.create({ userId: nonExistentUserId }, transaction);
    } catch (error) {
      errorThrown = true;

      expect(queryRunner.isTransactionActive).toBe(false);

        // Verify the user no longer exists after rollback
        const userAfterRollback = await fakeUserService.repository.findOne({
          where: { id: user.id }
        });
        expect(userAfterRollback).toBeNull();
    }
    
    // Verify that an error was thrown
    expect(errorThrown).toBe(true);
  });
});