import {faker} from '@faker-js/faker';
import {User} from "../sequelize-models/user.entity";

import {SequelizeFakeEntityService} from "../../src";
import {Role, RoleIds} from "../sequelize-models/role.entity";
import {FakeRoleService} from "./fake-role.service";


export class FakeUserService extends SequelizeFakeEntityService<User> {
  constructor(
    public repository: typeof User,
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
    this.addStates({roleId});
    return this;
  }

  withCustomRole(fakeRoleService: FakeRoleService, each = true, roleFields?: Partial<Role>): FakeUserService {
    return this.withParent(
      fakeRoleService,
      {
        parent: 'id',
        nested: 'roleId'
      },
      each,
      roleFields) as FakeUserService;
  }


}