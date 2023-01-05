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