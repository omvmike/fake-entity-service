import {DeepPartial, EntityManager, FindOneOptions, Repository, In, FindOptionsWhere} from "typeorm";
import {FakeEntityCoreService, MultipleKeyRelations, SingleKeyRelation} from "./fake-entity-core.service";



export class TypeormFakeEntityService<TEntity> extends FakeEntityCoreService<TEntity>{

  public entityIds = [];
  public idFieldNames: string[] = [];

  protected nestedEntities: {
    service: TypeormFakeEntityService<any>,
    count: number,
    customFields?: any,
    relationFields: SingleKeyRelation | MultipleKeyRelations
  }[] = [];

  protected parentEntities: {
    service: TypeormFakeEntityService<any>,
    each: boolean,
    customFields?: any,
    relationFields: SingleKeyRelation | MultipleKeyRelations
  }[] = [];

  constructor(protected repository: Repository<TEntity>) {
    super();
    this.detectPrimaryKeys();
  }

  /**
   * Automatically detect primary keys from TypeORM entity metadata
   */
  private detectPrimaryKeys(): void {
    if (this.idFieldNames.length === 0) {
      const primaryColumns = this.repository.metadata.primaryColumns;
      this.idFieldNames = primaryColumns.map(column => column.propertyName);
      this.validatePrimaryKeys();
    }
  }

  /**
   * Validate that primary keys were detected properly
   */
  private validatePrimaryKeys(): void {
    if (this.idFieldNames.length === 0) {
      throw new Error(`No primary keys detected for entity ${this.repository.metadata.name}. Please ensure the entity has @PrimaryColumn or @PrimaryGeneratedColumn decorators.`);
    }
  }

  /**
   * Get primary key field names
   */
  public getIdFieldNames(): string[] {
    return this.idFieldNames;
  }

  /**
   * Check if entity has composite primary key
   */
  public hasCompositeId(): boolean {
    return this.getIdFieldNames().length > 1;
  }

  /**
   * Get TypeORM primary column metadata
   */
  public getPrimaryColumns() {
    return this.repository.metadata.primaryColumns;
  }

  /**
   * Extract primary key values from an entity object
   */
  protected pickKeysFromObject(obj: any): Record<string, any> {
    const result = {};
    for (const key of this.getIdFieldNames()) {
      const value = obj[key];
      if (value === undefined || value === null) {
        throw new Error(`Primary key field "${key}" is empty or null in entity ${this.repository.metadata.name}`);
      }
      result[key] = value;
    }
    return result;
  }

  /**
   * Build where conditions for composite primary keys
   */
  protected buildCompositeKeyWhere(keyValues: Record<string, any>): FindOptionsWhere<TEntity> {
    const where = {} as FindOptionsWhere<TEntity>;
    for (const [key, value] of Object.entries(keyValues)) {
      if (!this.getIdFieldNames().includes(key)) {
        throw new Error(`Invalid primary key field "${key}" for entity ${this.repository.metadata.name}`);
      }
      where[key] = value;
    }
    return where;
  }

  /**
   * Find entity by composite primary key
   */
  public async findByCompositeKey(keyValues: Record<string, any>, transaction?: EntityManager): Promise<TEntity | undefined> {
    return this.withTransaction(async (tx) => {
      const where = this.buildCompositeKeyWhere(keyValues);
      const repo = tx ? tx.getRepository(this.repository.target) : this.repository;
      return repo.findOne({ where });
    }, transaction);
  }

  /**
   * Helper method to handle transactions
   * This method ensures proper error handling when using transactions
   * 
   * @param callback - Function to execute with the transaction
   * @param transaction - Optional existing transaction to use
   * @returns Result of the callback function
   * 
   * @example
   * // Using with an existing transaction
   * const result = await this.withTransaction(
   *   async (tx) => {
   *     const entity = await tx.getRepository(this.repository.target).findOne({ where: { id: 1 } });
   *     return entity;
   *   },
   *   existingTransaction
   * );
   */
  protected async withTransaction<T>(
    callback: (transaction?: EntityManager) => Promise<T>,
    transaction?: EntityManager
  ): Promise<T> {
    // If we have a transaction, use it
    if (transaction) {
      try {
        return await callback(transaction);
      } catch (error) {
        await transaction.queryRunner.rollbackTransaction();
        throw error;
      }
    }
    
    // If we don't have a transaction, skip transaction
    return callback();
  }

  protected getFakeFields(
    customFields?: Partial<TEntity>,
  ): Partial<TEntity> {
    return super.getFakeFields(customFields);
  }
  
  /* You can override this method
     to set default values for Entity fields
  */
  protected setFakeFields(): Partial<TEntity> {
    return super.setFakeFields();
  }

  /* Add fields to be used when creating entities
     Main purpose is to set fields as a side effect of service methods
     For example, when you are adding nested entity, you can mutate the parent entity
     Can be called multiple times to add multiple states
  */
  public addStates(
    states: Partial<TEntity> | Partial<TEntity>[] | (() => Partial<TEntity>) | (() => Partial<TEntity>)[] | (() => Partial<TEntity>[]),
  ): this {
    return super.addStates(states);
  }

  protected clearStates(): void {
    super.clearStates();
  }

  protected async processParents(nestedCount = 1, transaction?: EntityManager): Promise<void> {
    for (const parentEntityConfig of this.parentEntities) {
      const newParents = await parentEntityConfig.service.createMany(
        parentEntityConfig.each ? nestedCount : 1, 
        {
          ...(parentEntityConfig.customFields ?? {})
        },
        transaction
      );
      const relatedFieldsArray = newParents.map(newParent => {
        const parentRelationFields = Array.isArray(parentEntityConfig.relationFields)
          ? parentEntityConfig.relationFields
          : [parentEntityConfig.relationFields];
        const relatedFields = parentRelationFields.reduce((acc, f) => {
          if ('parent' in f && 'nested' in f) {
            acc[f.nested] = newParent[f.parent];
          }
          return acc;
        }, {});
        return relatedFields;
      });
      this.addStatesGenerator(relatedFieldsArray);
    }
    this.parentEntities = [];
  }

  protected async processNested(newParents: TEntity[], transaction?: EntityManager): Promise<void> {
    for (const nested of this.nestedEntities) {
      const nestedRelationFields = Array.isArray(nested.relationFields)
        ? nested.relationFields
        : [ nested.relationFields ];
      const relatedFieldsArray = newParents
        .map(newParent => {
          const relatedFields = nestedRelationFields.reduce((acc, f) => {
            if ('parent' in f && 'nested' in f) {
              acc[f.nested] = newParent[f.parent];
            }
            return acc;
          }, {});
          return relatedFields;
        })
        .reduce((acc: any[], fields) => {
          // this leads to sequential adding of nested entities for each parent
          return acc.concat(Array(nested.count).fill(fields));
        }, [])
      await nested.service
        .addStates(relatedFieldsArray)
        .createMany(
          nested.count * newParents.length,
          {
            ...(nested.customFields ?? {}),
          },
          transaction
        );
    }
    this.nestedEntities = [];
  }

  /**
   * Creates a single entity with the given custom fields
   * 
   * @param customFields - Optional custom fields to override default values
   * @param transaction - Optional EntityManager for transaction support
   * @returns The created entity
   * 
   * @example
   * // Create entity without transaction
   * const user = await fakeUserService.create({ firstName: 'John' });
   * 
   * @example
   * // Create entity with transaction
   * await dataSource.transaction(async (transactionEntityManager) => {
   *   const user = await fakeUserService.create(
   *     { firstName: 'John' },
   *     transactionEntityManager
   *   );
   * });
   */
  async create(
    customFields?: Partial<TEntity>,
    transaction?: EntityManager,
  ): Promise<TEntity> {
    return this.withTransaction(async (tx) => {
      await this.processParents(1, tx);
      const fields = this.getFakeFields(customFields);
      const preprocessedFields = this.entityPreprocessor
        ? await this.entityPreprocessor(fields, 0)
        : fields;
      const created = this.repository.create(preprocessedFields as DeepPartial<TEntity>);
      // Use tx if available, otherwise use this.repository
      const repo = tx ? tx.getRepository(this.repository.target) : this.repository;
      const entity = await repo.save(created);
      this.entityIds.push(this.getId(entity));
      if (this.nestedEntities.length) {
        await this.processNested([entity], tx);
      }
      const postprocessed = await this.postprocessEntities([entity]);
      
      // cleanup
      this.clearStates();
      return postprocessed.pop();
    }, transaction);
  }

  /**
   * Creates multiple entities with the given custom fields
   * 
   * @param count - Number of entities to create
   * @param customFields - Optional custom fields to override default values
   * @param transaction - Optional EntityManager for transaction support
   * @returns Array of created entities
   * 
   * @example
   * // Create entities without transaction
   * const users = await fakeUserService.createMany(3, { roleId: RoleIds.CUSTOMER });
   * 
   * @example
   * // Create entities with transaction
   * await dataSource.transaction(async (transactionEntityManager) => {
   *   const users = await fakeUserService.createMany(
   *     3,
   *     { roleId: RoleIds.CUSTOMER },
   *     transactionEntityManager
   *   );
   * });
   */
  async createMany(
    count: number,
    customFields?: Partial<TEntity>,
    transaction?: EntityManager,
  ): Promise<TEntity[]> {
    return this.withTransaction(async (tx) => {
      await this.processParents(count, tx);
      const preprocessed = await this.preprocessEntities(count, customFields);
      // @ts-ignore
      const bulkInsertData = preprocessed.map(f => this.repository.create(f))
      // Use tx if available, otherwise use this.repository
      const repo = tx ? tx.getRepository(this.repository.target) : this.repository;
      const entities = await repo.save(bulkInsertData as DeepPartial<TEntity>[]);
      const ids = entities.map(e => this.getId(e));
      this.entityIds.push(...ids);
      if (this.nestedEntities.length) {
        await this.processNested(entities, tx);
      }
      const processedEntities = await this.postprocessEntities(entities);
      
      // cleanup
      this.clearStates();
      return processedEntities;
    }, transaction);
  }

  getId(e: TEntity): any {
    if (this.hasCompositeId()) {
      return this.pickKeysFromObject(e);
    }
    const idFieldName = this.getIdFieldNames()[0];
    const idValue = e[idFieldName];
    if (idValue === undefined || idValue === null) {
      throw new Error(`Primary key field "${idFieldName}" is empty or null in entity ${this.repository.metadata.name}`)
    }
    return idValue;
  }

  /**
   * Deletes entities by their IDs
   * 
   * @param ids - Array of entity IDs to delete
   * @param transaction - Optional EntityManager for transaction support
   * @returns Number of affected rows
   * 
   * @example
   * // Delete entities without transaction
   * const affectedCount = await fakeUserService.delete([1, 2, 3]);
   * 
   * @example
   * // Delete entities with transaction
   * await dataSource.transaction(async (transactionEntityManager) => {
   *   const affectedCount = await fakeUserService.delete([1, 2, 3], transactionEntityManager);
   * });
   */
  async delete(ids: any[], transaction?: EntityManager): Promise<number> {
    return this.withTransaction(async (tx) => {
      const repo = tx ? tx.getRepository(this.repository.target) : this.repository;
      
      if (this.hasCompositeId()) {
        // For composite keys, ids should be an array of key objects
        const whereConditions = ids.map(id => this.buildCompositeKeyWhere(id));
        let totalAffected = 0;
        for (const where of whereConditions) {
          const res = await repo.delete(where);
          totalAffected += res.affected || 0;
        }
        return totalAffected;
      } else {
        // For single keys, use In operator for bulk delete
        const idField = this.getIdFieldNames()[0];
        const where = { [idField]: In(ids) } as any;
        const res = await repo.delete(where);
        return res.affected || 0;
      }
    }, transaction).then((deletionResult) => {
      // Remove deleted entity IDs from the entityIds array
      this.entityIds = [];
      return deletionResult;
    });
  }

  public withParent(fakeParentService: TypeormFakeEntityService<any>, relationFields: SingleKeyRelation | MultipleKeyRelations, each = false, customFields?: any): TypeormFakeEntityService<TEntity> {
    this.parentEntities.push({
      service: fakeParentService,
      each,
      customFields,
      relationFields
    });
    return this;
  }

  public withNested(fakeNestedService: TypeormFakeEntityService<any>, relationFields: SingleKeyRelation | MultipleKeyRelations, count = 1, customFields?: any): TypeormFakeEntityService<TEntity> {
    this.nestedEntities.push({
      service: fakeNestedService,
      count,
      customFields,
      relationFields
    });
    return this;
  }

}