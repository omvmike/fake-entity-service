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
});
