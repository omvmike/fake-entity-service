import {faker} from '@faker-js/faker';
import {SequelizeFakeEntityService, TypeormFakeEntityService} from "../../src";
import {Repository} from "typeorm";
import {Role} from "../typeorm-models/role.entity";


export class FakeRoleService extends TypeormFakeEntityService<Role> {
  constructor(
    public repository: Repository<Role>,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<Role> {
    const seed = String(Math.random() * 100000);
    const name = faker.person.firstName() + seed
    return  {
      name: faker.commerce.productName()
    };
  }


}