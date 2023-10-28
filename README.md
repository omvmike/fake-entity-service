# fake-entity-service

<a href="https://www.npmjs.com/package/fake-entity-service" target="_blank"><img src="https://img.shields.io/npm/v/fake-entity-service" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/package/fake-entity-service" target="_blank"><img src="https://img.shields.io/npm/l/fake-entity-service" alt="Package License" /></a>

This is a fake entity service that can be used for testing purposes.
The aim is simplify database data generation for integration and end-to-end tests.

This library is inspired by Laravel's [factory](https://laravel.com/docs/8.x/database-testing#introduction).

### Installation

```shell
npm i --save-dev fake-entity-service
```

## Usage

Target ORMs are Sequelize and TypeORM. So you need to import one of the libraries:

```typescript
import { SequelizeFakeEntityService } from 'fake-entity-service';
```
or 
```typescript
import { TypeOrmFakeEntityService } from 'fake-entity-service';
```

Target framework is NestJS but the code is framework agnostic.

To implement a new entity service, extend the `SequelizeFakeEntityService` generic class for your entity model
and define constructor method with the following signature. Usually you also need `setFakeFields` method to describe how to generate fake data.

```typescript
import {faker} from '@faker-js/faker';
import {SequelizeFakeEntityService} from "fake-entity-service";
import {InjectModel} from "@nestjs/sequelize";
import {User} from "../../src/entities";

@Injectable()
export class FakeUserService extends SequelizeFakeEntityService<User> {
  constructor(
    @InjectModel(User)
    public repository: typeof User,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<User> {
    return {
      email: faker.internet.email(name),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      password: 'password-hash',
      roleId: 1,
    };
  }
}
```

Then you can use it in your tests:

```typescript
const admin = await fakeUserService.create({roleId: Role.ADMIN});
const customers = await fakeUserService.createMany(5, { roleId: Role.CUSTOMER });
```

Also you can describe nested entities and create them with the parent entity.

```typescript
import {faker} from '@faker-js/faker';
import {SequelizeFakeEntityService} from "fake-entity-service";
import {InjectModel} from "@nestjs/sequelize";
import {User} from "../../src/entities";

@Injectable()
export class FakeUserService extends SequelizeFakeEntityService<User> {
  constructor(
    @InjectModel(User)
    public repository: typeof User,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<User> {
    return {
      email: faker.internet.email(name),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      password: 'password-hash',
      roleId: 1,
    };
  }

  withNotifications(fakeNotificationService: FakeNotificationService, count: number, customFields?: Partial<Notification>): FakeUserService {
    this.nestedEntities.push({
      service: fakeNotificationService,
      count,
      customFields,
      relationFields: {
        parent: 'id',
        nested: 'userId'
      }
    });
    return this;
  }
}
```
and use it like below:

```typescript
const customers = await fakeUserService
  .withNotifications(fakeNotificationService, 2)
  .createMany(5, { roleId: Role.CUSTOMER });
```

This code creates 5 users with customer role and 2 notifications for each user.

You can also delete all created entities with `cleanup` method:

```typescript
await fakeUserService.cleanup();
```

## Sequelize specific features

- The library can fork with multi-column primary keys. It uses Sequelize's model `primaryKeyAttributes` property to detect them.

- The library can work with Sequelize's relations. If you described relations in your model, the library will use them to create nested entities.
> For example, if you have `User` and `Notification` models and `User.hasMany(Notification)` relation, you can describe `withNotifications` method from previous example like below:
```typescript
  withNotifications(fakeNotificationService: FakeNotificationService, count: number, customFields?: Partial<Notification>): FakeUserService {
    this.nestedEntities.push({
      service: fakeNotificationService,
      count,
      customFields,
      relationFields: {
        propertyKey: 'notifications', // the name of the relation property in the model
      }
    });
    return this;
  }
```

- The library has addSequence() method that helps you generate of sequence of entities. 

> For example, you can create 3 users with specific roles like below:
```typescript
const users = await fakeUserService
  .addSequence('roleId',[RoleIds.ADMIN, RoleIds.CUSTOMER, RoleIds.MANAGER])
  .createMany(3);
```
> as a result you will get 3 users with roles: admin, customer, manager.
> 
> The sequences are looped, so you can create 5 users with 3 roles and get 2 users with admin role and 2 users with customer role and 1 user with manager role.
> 

> This feature is built on top of protected addStatesGenerator() method so you can get even more flexibility when build your own inherited entity services by describing not only static states but also dynamic states.
> 
> here's an example of add sequence method implementation for the `FakeUserService` class:
```typescript
  addSequence(roles: RoleIds[]): FakeUserService {
      this.addStatesGenerator(roles.map(roleId => ({
        roleId,
      })));
      return this;
  }
```

- As well as nested entities you can also describe parent entities from which you current entity depends on. For example, you can create a user with a custom role and then attach it to the user.

> Here's an example of `withCustomRole` method implementation for the `FakeUserService` class:
```typescript 
withCustomRole(fakeRoleService: FakeRoleService, roleFields?: Partial<Role>): FakeUserService {
    this.parentEntities.push({
      service: fakeRoleService,
      each: false, // if you need to create a new role for each user
      customFields: roleFields, // custom fields for the parentb entity
      relationFields: {
        parent: 'id', // the name of the relation property in the parent Role model
        nested: 'roleId' // the name of the relation property in the nested User model
      }
    });
    return this;
}
```

Then you can use it like below:

```typescript
const customers = await fakeUserService
  .withCustomRole(fakeRoleService, {name: 'super-customer'})
  .createMany(5);
```

> If you need to create a new role for each user, you can use `each: true` option.
> 
> Here's an example of `withCustomRole` method implementation for the `FakeUserService` class:
```typescript
withCustomRole(fakeRoleService: FakeRoleService, roleFields?: Partial<Role>): FakeUserService {
    this.parentEntities.push({
      service: fakeRoleService,
      each: true, // if you need to create a new role for each user
      customFields: roleFields, // custom fields for the parentb entity
      relationFields: {
        parent: 'id', // the name of the relation property in the parent Role model
        nested: 'roleId' // the name of the relation property in the nested User model
      }
    });
    return this;
}
```

Then you can use it like below:
```typescript
const users = await fakeUserService.withCustomRole(fakeRoleService.addSequence('name', ['first', 'second', 'third'])).createMany(3);
```
> as a result you will get 3 users with roles: first, second, third.

>> You can also use `addSequence` method to generate a sequence of parent entities with different names.
>> Using addSequence could be very helpful if yo want to generate a sequence of entities with specific unique field values.