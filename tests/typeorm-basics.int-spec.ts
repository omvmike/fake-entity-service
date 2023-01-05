import {DataSource, Repository} from "typeorm"
import {FakeUserService} from "./typeorm-factories/fake-user.service";
import {User} from "./typeorm-models/user.entity";
import {Role, RoleIds} from "./typeorm-models/role.entity";
const PostgresDataSource = new DataSource({
  type: 'postgres',
  database: 'test-db',
  username: 'tester',
  password: 'test-pwd',
  synchronize: false,
  entities: [User, Role],
});

let fakeUserService: FakeUserService;

describe('Test TypeormFakeEntityService can create and cleanup DB entities', () => {

  beforeAll(async () => {
    await PostgresDataSource.initialize();
    const userRepo = PostgresDataSource.getRepository(User);
    fakeUserService = new FakeUserService(userRepo);
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
});
