import {faker} from '@faker-js/faker';
import {User} from "../sequelize-models/user.entity";

import {SequelizeFakeEntityService} from "../../sequelize-fake-entity.service";
import {RoleIds} from "../sequelize-models/role.entity";


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

  // withCustomer(fakeCustomerService: FakeCustomerService, customFields?: Partial<Customer>): FakeUserService {
  //   this.nestedEntities.push({
  //     service: fakeCustomerService,
  //     count: 1,
  //     customFields,
  //     relationFields: {
  //       parent: 'id',
  //       nested: 'userId'
  //     }
  //   });
  //   this.addStates({roleId: 3});
  //   return this;
  // }
  //
  // withConsultant(fakeConsultantService: FakeConsultantService, customFields?: Partial<Customer>): FakeUserService {
  //   this.nestedEntities.push({
  //     service: fakeConsultantService,
  //     count: 1,
  //     customFields,
  //     relationFields: {
  //       parent: 'id',
  //       nested: 'userId'
  //     }
  //   });
  //   this.addStates({roleId: 2});
  //   return this;
  // }
}