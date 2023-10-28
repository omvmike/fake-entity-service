import {faker} from '@faker-js/faker';
import {User} from "../sequelize-models/user.entity";

import {SequelizeFakeEntityService} from "../../src";
import {Role, RoleIds} from "../sequelize-models/role.entity";


export class FakeRoleService extends SequelizeFakeEntityService<Role> {
  constructor(
    public repository: typeof Role,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<Role> {
    const seed = String(Math.random() * 100000);
    const name = faker.name.firstName() + seed
    return  {
      name: faker.commerce.productName()
    };
  }


}