# Transaction Support in Fake Entity Service

This document explains how to use transactions with the Fake Entity Service library.

## Overview

Transactions are essential for maintaining data consistency in your tests. The Fake Entity Service library provides transaction support for both TypeORM and Sequelize.

## TypeORM Transaction Support

### Basic Usage

You can use transactions with TypeORM in two ways:

1. **Without a transaction** - The simplest approach, but doesn't provide transaction isolation:

```typescript
const user = await fakeUserService.create({ firstName: 'John' });
```

2. **With an external transaction** - Use TypeORM's transaction API and pass the transaction manager:

```typescript
await dataSource.transaction(async (transactionEntityManager) => {
  const user = await fakeUserService.create(
    { firstName: 'John' },
    transactionEntityManager
  );
  
  const posts = await fakePostService.createMany(
    3,
    { userId: user.id },
    transactionEntityManager
  );
});
```

### Error Handling

Transactions are automatically rolled back by TypeORM if an error occurs:

```typescript
try {
  await dataSource.transaction(async (transactionEntityManager) => {
    await fakeUserService.create(
      { firstName: 'John' },
      transactionEntityManager
    );
    
    // If this throws an error, the transaction will be rolled back
    throw new Error('Something went wrong');
  });
} catch (error) {
  // The transaction has been automatically rolled back
  console.error('Failed to create user:', error);
}
```

### Cleanup with Transactions

You can use transactions with the `cleanup` method to ensure all entities are deleted within a transaction:

```typescript
// Cleanup with an external transaction
await dataSource.transaction(async (transactionEntityManager) => {
  await fakeUserService.cleanup(transactionEntityManager);
});
```

## Sequelize Transaction Support

### Basic Usage

You can use transactions with Sequelize in similar ways:

1. **Without a transaction**:

```typescript
const user = await fakeUserService.create();
```

2. **With an external transaction**:

```typescript
const transaction = await sequelize.transaction();
try {
  const user = await fakeUserService.create({}, transaction);
  const posts = await fakePostService.createMany(3, { userId: user.id }, transaction);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

It also allows yo to follow transactional flow into tests
```typescript
describe('Test SequelizeFakeEntityService with transactions', () => {
  let transaction: Transaction;

  beforeEach(async () => {
    transaction = await sequelize.transaction();
  });

  afterEach(async () => {
    await transaction.rollback();
  });

  it('should create user within transaction', async () => {
    const user = await fakeUserService.create({}, transaction);
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
  });
...  
```
See more examples in [sequelize-basics-transactional.int-spec.ts](../tests/sequelize-basics-transactional.int-spec.ts)folder of the repository.

### Automatic Error Handling

The Sequelize implementation includes built-in error handling through a `withTransaction` helper method

This method ensures that:

1. If a transaction is provided, it's used for all operations
2. If an error occurs during any operation, the transaction is automatically rolled back (if not already committed)
3. If no transaction is provided, operations proceed without transaction management

All public methods (`create`, `createMany`, `delete`, `getEntityAt`) use this helper internally, making your tests more robust and less prone to data inconsistencies.

## Testing with Transactions

For integration tests, it's recommended to use transactions to ensure test isolation:

```typescript
describe('Test with transactions', () => {
  let transaction;
  let queryRunner;

  beforeEach(async () => {
    // Start a new transaction before each test
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    transaction = queryRunner.manager;
  });

  afterEach(async () => {
    // Rollback the transaction after each test
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    await queryRunner.release();
  });

  it('should create entities within a transaction', async () => {
    const user = await fakeUserService.create({}, transaction);
    expect(user).toBeDefined();
    
    // Verify the entity exists within the transaction
    const userInTransaction = await transaction.findOne(User, {
      where: { id: user.id }
    });
    expect(userInTransaction).toBeDefined();
    
    // Verify the entity does not exist outside the transaction
    const userOutsideTransaction = await dataSource.getRepository(User).findOne({
      where: { id: user.id }
    });
    expect(userOutsideTransaction).toBeNull();
  });
});
```

## Best Practices

1. **Always use transactions in tests** - This ensures test isolation and prevents test data from persisting between test runs.

2. **Use the same transaction for related operations** - When creating parent and child entities, use the same transaction to ensure data consistency.

3. **Explicitly rollback transactions in afterEach hooks** - This ensures that even if a test fails, the transaction is rolled back.

4. **Be aware of transaction isolation levels** - Different databases have different default isolation levels, which can affect test behavior.

## Troubleshooting

### Common Issues

1. **Entity not found after creation**:
   - Check if you're querying outside the transaction
   - Ensure the transaction hasn't been committed or rolled back prematurely

2. **Transaction already finished**:
   - Ensure you're not trying to use a transaction after it's been committed or rolled back
   - Check for premature commits or rollbacks in your code

### Debugging Transactions

To debug transaction issues, you can enable SQL logging:

```typescript
// For TypeORM
dataSource.setOptions({
  logging: true
});

// For Sequelize
sequelize.options.logging = console.log;
```

This will log all SQL queries, including transaction statements, which can help identify issues.