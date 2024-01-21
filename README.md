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

Additionally to `constructor` method you usually want to describe `setFakeFields` method to generate fake data.
This method is describes default values for the entity fields.
You can override these values in the `create` and `createMany` methods later to generate specific data for your tests.
However you can skip this method. 
In this case you need to pass all required fields to the `create` and `createMany` methods.

It's convenient to use some data generation library like `faker-js` to generate fake data for your tests but you can 
use any other library or even write your own data generation code.
It's also possible to describe nested entities and parent entities. See below.

#### create a new fake entity service for TypeORM example

```typescript
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
Key difference that we're injecting TypeORM repository instead of Sequelize model.



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

### Provide custom fields

As you can see in the examples above, you can provide custom fields for your entity in the `create` and `createMany` methods.
```typescript
const user = await fakeUserService.create({firstName: 'John', lastName: 'Smith'});
```
This code will create a new user with firstName: John and lastName: Smith.

This values will override default values provided by `setFakeFields` method as well as values provided by `addStates` method described below.

The same way you can provide custom fields for `createMany` method:
```typescript
const users = await fakeUserService.createMany(3, {firstName: 'John'});
```
This code will create 3 users with firstName: John and other fields generated by `setFakeFields` method.


### Create related entities

Usually your entities have relations with other entities and you need to create them together.
For example, you have `User`, `Post` and `Comment` models. 
Every user has many posts and every post has many comments
as well as every post belongs to a user and every comment belongs to a post.

ORMs usually provide a way to describe these relations in the terms like `hasMany`, `belongsTo`, `hasOne` etc.

But from the database entity creation point of view, you need to create a user, then create a post and then create a comment.
And you cannot create a comment without having a post.
That's why we mostly interested in the sequence of entity creation.
The library allows you to describe this sequence explicitly using `withParent` and `withNested` methods.
- withParent - describes a parent entity that your current entity depends on. 
> This parent entity will be created before your current entity and will be attached to it.
- withNested - describes a nested entity that depends on your current entity.
> This nested entity will be created after your current entity and will be attached to it.

To attach entities you usually need to specify a foreign key.
The library uses the following convention to detect foreign keys:
```json
{
  "parent": "<parent entity property name>",
  "nested": "<nested entity property name>"
}
```
So parent field is usually a primary key of the parent entity and nested field is usually a foreign key of the nested entity.

You can describe these relations in your entity service class like below:
```typescript
export class FakePostService extends SequelizeFakeEntityService<Post> {
    constructor(
        public repository: typeof Post,
    ) {
        super(repository)
    }

    setFakeFields(): Partial<Post> {
        return {
            message: faker.lorem.sentence()
        }
    }

    withParentUser(fakeUserService: FakeUserService, each = false, userFields?: Partial<Post>): FakePostService {
        return this.withParent(fakeUserService,
            {
                parent: 'id',
                nested: 'userId'
            },
            each,
            userFields) as FakePostService;
    }

    withComments(fakeCommentService: FakeCommentService, count = 1, commentFields?: Partial<Comment>): FakePostService {
        return this.withNested(
            fakeCommentService,
            {
                parent: 'id',
                nested: 'postId'
            },
            count,
            commentFields) as FakePostService;
    }


}
```
and use it like below:

```typescript
const posts = await fakePostService
    .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
    .withComments(fakeCommentService, 2)
    .createMany(5);
```
This code should create 5 posts but since posts depend on users as parent entities 
it will create user entities first and then create posts and attach them to the users.

You can notice that withParentUser method has `each` parameter set to false.
That means that it will create only one user and attach all posts to this user.
If you need to create a new user for each post, you need to set `each` parameter to true.

Then it creates 2 comments for each of the five posts.

#### Many-to-many relations
Many-to-many relations are a bit more complicated because they require a third table to store the relation.
It's not covered by relations convention described above.
So you need to describe it with creation one of two entities separately and then attach them to each other.

But if you use Sequelize, you can use `Sequelize's relations with the library.
See [Sequelize specific features](#sequelize-specific-features) section below.


### States

You might need to describe some mutations of your entity.
For example, you need to create a user with a specific role.

You can use `addStates` method to describe these mutations.
For example you can describe `asAdmin` method for your `FakeUserService` class like below:
```typescript
export class FakeUserService extends SequelizeFakeEntityService<User> {
   // constructor and other methods
   // ... 
    
    asAdmin(): FakeUserService {
        return this.addStates({roleId: Roles.ADMIN});
    }
}
```

and then use it like below:
```typescript
const users = await fakeUserService
    .asAdmin()
    .createMany(5);
```

As a result you will get 5 users with admin role.



### Sequences

Sometimes you need to create entities with different but predefined sets of values.

For example, you need to create 5 users with different names.

You can also use `addStates` method to create a sequence of entities with different values for several fields:
```typescript
const users = await fakeUserService
    .addStates([
        {firstName: 'John', lastName: 'Smith'},
        {firstName: 'Mike', lastName: 'Brown'},
        {firstName: 'Bob', lastName: 'White'},
        {firstName: 'Alice', lastName: 'Black'},
        {firstName: 'Kate', lastName: 'Green'},
    ])
    .createMany(5);
```
This code will create 5 users with names: John Smith, Mike Brown, Bob White, Alice Black, Kate Green.

If you specify less than 5 states, the library will loop them to create 5 users you requested with createMany method.

If you specify more than 5 states, the library will create only 5 users with the first 5 states.

You can also provide a function to generate array of states dynamically:
```typescript
const users = await fakeUserService
    .addStates(() => {
        const states = [];
        for (let i = 0; i < 5; i++) {
            states.push({firstName: faker.name.firstName(), lastName: faker.name.lastName()});
        }
        return states;
    })
    .createMany(5);
```

In advance use addFieldSequence() method to create a sequence of entities with different values for one field:
```typescript
const users = await fakeUserService
    .addFieldSequence('firstName', ['John', 'Mike', 'Bob', 'Alice', 'Kate'])
    .createMany(5);
```


### Cleanup created entities

The library remembers all created entities primary keys and provides a `cleanup` method to delete them.

```typescript
await fakeUserService.cleanup();
```
this code will delete all users created by the `fakeUserService` service.

#### Primary keys

As you can see in the examples above, we need to describe primary key column name for the entity model
to track created entities and to delete them later.

Primary key description is ORM specific.

For Sequelize we support automatic detection of primary keys both for single column and multi-column primary keys.
see [Sequelize specific features](#sequelize-specific-features) section below.

Unfortunately, automatic detection of primary keys is not applied for TypeORM version of the library.
Thus, we use `id` field as a default primary key column for TypeORM.
But you can override it by passing `idFieldName` property to your service class:

```typescript
import {TypeormFakeEntityService} from "./typeorm-fake-entity.service";

export class FakeUserService extends TypeormFakeEntityService<User> {
    public idFieldName = 'uuid';

    // ...
    // constructor and other methods
}
```
Multi-column primary keys are not supported for `TypeormFakeEntityService` yet. 

### Callbacks

You can use `afterMakingCallback` and `afterCreatingCallback` methods to describe callbacks.

`afterMakingCallback` is called after the entity is prepared but before it is saved to the database.
> Thus, you can use it to modify the entity right before it is saved to the database 
> but after all other modifications (Custom fields, States, Foreign keys) already applied.

for example, you can use it to set a password for the user:
```typescript
const users = await fakeUserService
    .afterMakingCallback(async (user, index) => {
        user.password = await bcrypt.hash('password', 10);
        return user;
    })
    .createMany(5);
```


`afterCreatingCallback` is called after the entity is saved to the database.
> Thus, you can use it to modify the result value returned by the `create` and `createMany` methods
> or to do some additional actions after the entity is saved to the database.

for example, you can use it to reload the entity with all relations after all nested entities are created:
```typescript
const posts = await fakePostService
    .withParentUser(fakeUserService.asRole(RoleIds.CUSTOMER))
    .withComments(fakeCommentService, 3)
    .afterCreatingCallback(async (post, index) => {
        return post.reload({
            include: [{model: Comment}, {model: User}],
        });
    })
    .createMany(2);
```


## Sequelize specific features
- Use Sequelize's primary keys detection. The library uses Sequelize's model `primaryKeyAttributes` property to detect primary keys.
> If you need to override it, you can pass `idFieldName` property to your service class:

- The library can work with multi-column primary keys. It also Sequelize's model `primaryKeyAttributes` property to detect them.

- The library can work with Sequelize's relations. If you described relations in your model, the library will use them to create nested entities.
> For example, if you have `User` and `Notification` models and `User.hasMany(Notification)` relation, you can describe `withNotifications` method from previous example like below:
```typescript
export class FakePostService extends SequelizeFakeEntityService<Post> {
    // constructor and other methods
    // ... 


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
}
```
