import {Sequelize} from "sequelize-typescript";
import {User} from "./sequelize-models/user.entity";
import {Role, RoleIds} from "./sequelize-models/role.entity";
import {FakeUserService} from "./sequelize-factories/fake-user.service";
const sequelize = new Sequelize({
  database: 'test-db',
  dialect: 'postgres',
  username: 'tester',
  password: 'test-pwd',

  models: [User, Role], // or [Player, Team],
});

const fakeUserService = new FakeUserService(sequelize.models.User as typeof User);

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
});
