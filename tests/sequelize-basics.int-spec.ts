import {Sequelize} from "sequelize-typescript";
import {User} from "./sequelize-models/user.entity";
import {Role, RoleIds} from "./sequelize-models/role.entity";
import {FakeUserService} from "./sequelize-factories/fake-user.service";
import {FakeLeaderFollowerService} from "./sequelize-factories/fake-leader-follower.service";
import {LeaderFollower} from "./sequelize-models/leader-follower.entity";
const sequelize = new Sequelize({
  database: 'test-db',
  dialect: 'postgres',
  username: 'tester',
  password: 'test-pwd',

  models: [User, Role, LeaderFollower],
});

const fakeUserService = new FakeUserService(sequelize.models.User as typeof User);
const fakeLeaderFollowerService = new FakeLeaderFollowerService(sequelize.models.LeaderFollower as typeof LeaderFollower);

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
    const customer = await fakeUserService.asCustomer().create();
    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.roleId).toBe(RoleIds.CUSTOMER);
    const manager = await fakeUserService.create({roleId: RoleIds.MANAGER});
    expect(manager).toBeDefined();
    expect(manager.id).toBeDefined();
    expect(manager.roleId).toBe(RoleIds.MANAGER);
  });

  it('should create and delete entities with composite key', async () => {
    const customer = await fakeUserService.asCustomer().create();
    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.roleId).toBe(RoleIds.CUSTOMER);
    const manager = await fakeUserService.asManager().create();

    expect(fakeLeaderFollowerService.getIdFieldNames()).toEqual(['leaderId', 'followerId']);


    const customerFollower = await fakeLeaderFollowerService.create({leaderId: customer.id, followerId: manager.id});
    const managerFollower = await fakeLeaderFollowerService.create({leaderId: manager.id, followerId: customer.id});

    expect(customerFollower).toBeDefined();
    expect(customerFollower.followerId).toBe(manager.id);
    expect(customerFollower.leaderId).toBe(customer.id);
    expect(fakeLeaderFollowerService.pickKeysFromObject(customerFollower)).toHaveProperty('followerId');
    expect(fakeLeaderFollowerService.pickKeysFromObject(customerFollower)).toHaveProperty('leaderId');

    expect(managerFollower).toBeDefined();
    expect(managerFollower.followerId).toBe(customer.id);
    expect(managerFollower.leaderId).toBe(manager.id);

    await fakeLeaderFollowerService.cleanup();
  });
});
