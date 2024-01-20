# fake-entity-service

<a href="https://www.npmjs.com/package/fake-entity-service" target="_blank"><img src="https://img.shields.io/npm/v/fake-entity-service" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/package/fake-entity-service" target="_blank"><img src="https://img.shields.io/npm/l/fake-entity-service" alt="Package License" /></a>

This is a fake entity service that allows you to prepare fake data for your tests.
The aim is simplify database data generation for integration and end-to-end tests.

And the main goal is to make it ORM agnostic.
At the moment the library supports Sequelize ORM and TypeORM.

Target framework is [NestJs](https://nestjs.com/) but the code is framework agnostic 
so you can use it with any other framework or even without any framework.
You can find examples of usage with and without NestJS below.

The library was tested with [Jest](https://jestjs.io/) but it should work with any other test runner.

This library is inspired by Laravel's [factory](https://laravel.com/docs/8.x/database-testing#introduction) so you can find some similarities.
But since it's a TypeScript library, it has quite different syntax.

It allows you to describe database entities and their relations in explicit way:
```typescript
const posts = await fakePostService
    .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
    .addStates([
        {message: 'one'},
        {message: 'two'},
        {message: 'three'},
    ])
    .createMany(5);
```
This code creates 5 posts with messages: one, two, three and attaches them to the user with customer role.

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


### How to create a new fake entity service

Target framework is NestJS but the code is framework agnostic.

To implement a new entity service, extend the `SequelizeFakeEntityService` class for your entity model.
If you use TypeORM, just replace `SequelizeFakeEntityService` with `TypeOrmFakeEntityService` for your entity model
and, of course, your `User` model should be a TypeORM model.

Let's assume that you have a `User` Sequelize model and you want to create a fake user service for it.
The aim is to create a new users easily in your tests.

At first you need to describe a new service class.
Create a new file `fake-user.service.ts` with the content below.

To make it with NestJS, you need to inject the model repository into the constructor:
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
        const seed = String(Math.random() * 100000);
        const name = faker.name.firstName() + seed
        return {
            email: faker.internet.email(name),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
            password: 'password',
            roleId: 1,
        };
    }
}
```

While without NestJS, you need to pass the model repository to the constructor:

```typescript
export class FakeUserService extends SequelizeFakeEntityService<User> {
    constructor(
        public repository: typeof User,
    ) {
        super(repository)
    }

    setFakeFields(): Partial<User> {
        const seed = String(Math.random() * 100000);
        const name = faker.name.firstName() + seed
        return {
            email: faker.internet.email(name),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
            password: 'password',
            roleId: 1,
        };
    }
}  
```

Additionally to constructor you usually need to describe `setFakeFields` method to generate fake data.
It's a basic option to generate fake data. 
This method is describes default values for the entity fields.
You can override these values in the `create` and `createMany` methods later to generate specific data for your tests.
It's convenient to use some data generation library like `faker-js` to generate fake data for your tests but you can 
use any other library or even write your own data generation code.
It's also possible to describe nested entities and parent entities. See below.

### How to use a fake entity service with NestJS and Sequelize

Okay, now you have a `FakeUserService. How to use it in your tests?

For NestJS you need to add your service to the module.
But you can't add it to the main module because you typically don't need it in production.

So you need to create a new file `fake-entity.module.ts` with the content below:
```typescript
@Module({
    imports: [
        SequelizeModule.forFeature([
            User,
        ]),
    ],
    providers: [
        FakeUserService,
    ],
})
export class FakeEntitityModule {}
```
Then you can use `FakeEntitiesModule` in your tests by importing it into your test module:

Create a new file `fake-user.service.spec.ts` with the content below:
```typescript
let fakeUserService: FakeUserService;

beforeAll(async () => {
    const appModule = Test.createTestingModule({
        imports: [AppModule, FakeEntitiesModule],
    });
    app = await appModule.createNestApplication();
    await app.init();

    fakeUserService = module.get<FakeUserService>(FakeUserService);
});

it('should create a new user', async () => {
    const user = await fakeUserService.create();
    expect(user).toBeDefined();
});

it('should create a new user with specific fields', async () => {
    const user = await fakeUserService.create({firstName: 'John'});
    expect(user.firstName).toEqual('John');
});

it('should create three users with the role customer', async () => {
    const users = await fakeUserService.createMany(3, {roleId: Role.CUSTOMER});
    expect(users.length).toEqual(3);
    expect(users[0].roleId).toEqual(Role.CUSTOMER);
});
```

### How to use a fake entity service for Sequelize without NestJS
We assume that we already have User model and FakeUserService class.

Create a new file `fake-user.service.spec.ts` with the content below:
```typescript
let fakeUserService: FakeUserService;

beforeAll(async () => {
    const sequelize = new Sequelize({
        database: 'test-db',
        dialect: 'postgres',
        username: 'tester',
        password: 'test',
        models: [User],
    });

    fakeUserService = new FakeUserService(sequelize.models.User as typeof User);
});

it('should create a new user', async () => {
    const user = await fakeUserService.create();
    expect(user).toBeDefined();
});

it('should create a new user with specific fields', async () => {
    const user = await fakeUserService.create({firstName: 'John'});
    expect(user.firstName).toEqual('John');
});

it('should create three users with the role customer', async () => {
    const users = await fakeUserService.createMany(3, {roleId: Role.CUSTOMER});
    expect(users.length).toEqual(3);
    expect(users[0].roleId).toEqual(Role.CUSTOMER);
});
```

You can find more examples in the `tests` folder of the repository.



### How to use a fake entity service with NestJS and TypeORM

We assume that we already have User model and FakeUserService class.

For NestJS you need to add your service to the module.

So you need to create a new file `fake-entity.module.ts` with the content below:
```typescript
@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
        ]),
    ],
    providers: [
        FakeUserService,
    ],
})
export class FakeEntitityModule {}
```
Then you can use `FakeEntitiesModule` in your tests by importing it into your test module:

Create a new file `fake-user.service.spec.ts` with the content below:
```typescript
let fakeUserService: FakeUserService;

beforeAll(async () => {
    const appModule = Test.createTestingModule({
        imports: [AppModule, FakeEntitiesModule],
    });
    app = await appModule.createNestApplication();
    await app.init();

    fakeUserService = module.get<FakeUserService>(FakeUserService);
});

it('should create a new user', async () => {
    const user = await fakeUserService.create();
    expect(user).toBeDefined();
});

it('should create a new user with specific fields', async () => {
    const user = await fakeUserService.create({firstName: 'John'});
    expect(user.firstName).toEqual('John');
});

it('should create three users with the role customer', async () => {
    const users = await fakeUserService.createMany(3, {roleId: Role.CUSTOMER});
    expect(users.length).toEqual(3);
    expect(users[0].roleId).toEqual(Role.CUSTOMER);
});
```

### How to use a fake entity service for TypeORM without NestJS

We assume that we already have User model and FakeUserService class.

Create a new file `fake-user.service.spec.ts` with the content below:
```typescript
const PostgresDataSource = new DataSource({
    type: 'postgres',
    database: 'test-db',
    username: 'tester',
    password: 'test',
    synchronize: false,
    entities: [User],
});
let fakeUserService: FakeUserService;

beforeAll(async () => {
    await PostgresDataSource.initialize();
    const userRepo = PostgresDataSource.getRepository(User);
    fakeUserService = new FakeUserService(userRepo);
});

it('should create a new user', async () => {
    const user = await fakeUserService.create();
    expect(user).toBeDefined();
});

it('should create a new user with specific fields', async () => {
    const user = await fakeUserService.create({firstName: 'John'});
    expect(user.firstName).toEqual('John');
});

it('should create three users with the role customer', async () => {
    const users = await fakeUserService.createMany(3, {roleId: Role.CUSTOMER});
    expect(users.length).toEqual(3);
    expect(users[0].roleId).toEqual(Role.CUSTOMER);
});
```

You can find more examples in the `tests` folder of the repository.


## Features

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