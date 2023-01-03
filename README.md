# fake-entity-service

This is a fake entity service that can be used for testing purposes.
The aim is simplify database data generation for integration and end-to-end tests.


### Installation

```shell
npm i --save-dev fake-entity-service
```

## Usage

Target ORM is Sequelize.

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
