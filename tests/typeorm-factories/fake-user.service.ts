import {faker} from '@faker-js/faker';
import {User} from "../typeorm-models/user.entity";
import {RoleIds} from "../sequelize-models/role.entity";
import {TypeormFakeEntityService} from "../../src";
import {Repository} from "typeorm";


export class FakeUserService extends TypeormFakeEntityService<User> {
  constructor(
    public repository: Repository<User>,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<User> {
    const seed = String(Math.random() * 100000);
    const name = faker.name.firstName() + seed
    return  {
      email: faker.internet.email(name),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      password: 'password',
      roleId: 1,
    };
  }

  asRole(roleId: RoleIds): FakeUserService {
    return this.addStates({roleId});
  }
  asAdmin(): FakeUserService {
    this.addStates({roleId: RoleIds.ADMIN});
    return this;
  }

  asCustomer(): FakeUserService {
    this.addStates({roleId: RoleIds.CUSTOMER});
    return this;
  }

  asManager(): FakeUserService {
    this.addStates({roleId: RoleIds.MANAGER});
    return this;
  }
}