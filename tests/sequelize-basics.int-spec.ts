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

});
