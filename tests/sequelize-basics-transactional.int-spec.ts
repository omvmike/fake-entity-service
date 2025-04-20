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
import {Transaction} from 'sequelize';

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

describe('Test SequelizeFakeEntityService with transactions', () => {
  let transaction: Transaction;

  beforeEach(async () => {
    transaction = await sequelize.transaction();
  });

  afterEach(async () => {
    if ((transaction as any).finished === 'rollback') {
      console.log('Transaction is already rolled back. skipping final rollback.');
    } else if ((transaction as any).finished === 'commit') {
      console.log('Transaction is already committed. skipping final rollback.');
    } else {
      await transaction.rollback();
    }
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

  it('should create and delete entities with composite key within transaction', async () => {
    const customer = await fakeUserService.asRole(RoleIds.CUSTOMER).create({}, transaction);
    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.roleId).toBe(RoleIds.CUSTOMER);
    const manager = await fakeUserService.asRole(RoleIds.MANAGER).create({}, transaction);
    expect(fakeLeaderFollowerService.getIdFieldNames()).toEqual(['leaderId', 'followerId']);

    const customerFollower = await fakeLeaderFollowerService.create({
      leaderId: customer.id, 
      followerId: manager.id
    }, transaction);
    
    const managerFollower = await fakeLeaderFollowerService.create({
      leaderId: manager.id, 
      followerId: customer.id
    }, transaction);

    expect(customerFollower).toBeDefined();
    expect(customerFollower.followerId).toBe(manager.id);
    expect(customerFollower.leaderId).toBe(customer.id);
    expect(fakeLeaderFollowerService.getId(customerFollower)).toHaveProperty('followerId');
    expect(fakeLeaderFollowerService.getId(customerFollower)).toHaveProperty('leaderId');

    expect(managerFollower).toBeDefined();
    expect(managerFollower.followerId).toBe(customer.id);
    expect(managerFollower.leaderId).toBe(manager.id);

    await fakeLeaderFollowerService.delete([
      { leaderId: customer.id, followerId: manager.id },
      { leaderId: manager.id, followerId: customer.id }
    ], transaction);
  });

  it('should create parent and nested entities within transaction', async () => {
    const users = await fakeUserService
      .addFieldSequence('roleId', [RoleIds.ADMIN, RoleIds.CUSTOMER, RoleIds.MANAGER])
      .createMany(5, {}, transaction);
    
    expect(users).toBeDefined();
    expect(users.length).toBe(5);
    expect(users[0].roleId).toBe(RoleIds.ADMIN);
    expect(users[1].roleId).toBe(RoleIds.CUSTOMER);
    expect(users[2].roleId).toBe(RoleIds.MANAGER);
    expect(users[3].roleId).toBe(RoleIds.ADMIN);
    expect(users[4].roleId).toBe(RoleIds.CUSTOMER);
  });

  it('should create user and posts within transaction', async () => {
    const user = await fakeUserService.asRole(RoleIds.CUSTOMER).create({}, transaction);
    const posts = await fakePostService.createMany(5, {userId: user.id}, transaction);
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    
    // Verify posts exist in the transaction
    const foundPosts = await Post.findAll({
      where: { userId: user.id },
      transaction
    });
    expect(foundPosts.length).toBe(5);
  });

  it('should create parent and nested entities within transaction', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .createMany(5, {}, transaction);
      
    expect(posts).toBeDefined();
    expect(posts.length).toBe(5);
    // all posts should have the same user with CUSTOMER role
    posts.forEach(post => {
      expect(post.userId).toBe(posts[0].userId);
    });
    
    // Verify the user exists in the transaction
    const user = await User.findByPk(posts[0].userId, { transaction });
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
    const users = await User.findAll({
      where: { id: userIds },
      transaction
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

  it('should create array sequence with function within transaction', async () => {
    const posts = await fakePostService
      .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
      .addStates(() => ([{message: 'one'}, {message: 'two'}, {message: 'three'}]))
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
        return post.reload({
          include: [{model: Comment}, {model: User}],
          transaction,
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
    const comments = await Comment.findAll({
      where: { postId: postIds },
      transaction
    });
    expect(comments.length).toBe(6); // 2 posts * 3 comments each
  });

  // Test that demonstrates transaction isolation
  it('should not see entities outside of transaction', async () => {
    // Create a user within the transaction
    const user = await fakeUserService.create({}, transaction);
    
    // Verify the user exists within the transaction
    const userInTransaction = await User.findByPk(user.id, { transaction });
    expect(userInTransaction).toBeDefined();
    
    // Verify the user does not exist outside the transaction
    const userOutsideTransaction = await User.findByPk(user.id);
    expect(userOutsideTransaction).toBeNull();
  });

  // Test that demonstrates transaction rollback
  it('should rollback all changes when transaction is rolled back', async () => {
    // Create a user within the transaction
    const user = await fakeUserService.create({}, transaction);
    
    // Create posts for the user within the transaction
    await fakePostService.createMany(3, { userId: user.id }, transaction);
    
    // Verify posts exist within the transaction
    const postsInTransaction = await Post.findAll({
      where: { userId: user.id },
      transaction
    });
    expect(postsInTransaction.length).toBe(3);
    
    // Manually rollback the transaction
    await transaction.rollback();
    
    // Start a new transaction for verification
    const newTransaction = await sequelize.transaction();
    
    try {
      // Verify the user does not exist after rollback
      const userAfterRollback = await User.findByPk(user.id, { transaction: newTransaction });
      expect(userAfterRollback).toBeNull();
      
      // Verify posts do not exist after rollback
      const postsAfterRollback = await Post.findAll({
        where: { userId: user.id },
        transaction: newTransaction
      });
      expect(postsAfterRollback.length).toBe(0);
    } finally {
      await newTransaction.rollback();
    }
  });

  it('should automatically rollback transaction when create() throws an error', async () => {

    const user = await fakeUserService.create({}, transaction);

    // Verify the user exists within the transaction
    const userBeforeError = await fakeUserService.repository.findOne({
      where: { id: user.id },
      transaction
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

      expect((transaction as any).finished).toBe('rollback');

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