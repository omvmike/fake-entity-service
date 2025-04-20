import {DeepPartial, EntityManager, FindOneOptions, Repository} from "typeorm";
import {FakeEntityCoreService, MultipleKeyRelations, SingleKeyRelation} from "./fake-entity-core.service";



export class TypeormFakeEntityService<TEntity> extends FakeEntityCoreService<TEntity>{

  public entityIds = [];
  public idFieldName = 'id';

  // protected states?: Partial<TEntity>;

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

  // protected getFakeFields(
  //   customFields?: Partial<TEntity>,
  // ): Partial<TEntity> {
  //   const fields: Partial<TEntity> = this.setFakeFields();
  //   return Object.assign(fields, this.states || {}, customFields || {});
  // }
  //
  // /* You can override this method
  //    to set default values for Entity fields
  // */
  // setFakeFields(): Partial<TEntity> {
  //   return {} as Partial<TEntity>;
  // }

  /* Add fields to be used when creating entities
     Main purpose is to set fields as a side effect of service methods
     For example, when you are adding nested entity, you can mutate the parent entity
     Can be called multiple times to add multiple states
  */
  // protected addStates(state: Partial<TEntity>): void {
  //   this.states = Object.assign(this.states || {}, state);
  // }

  // protected clearStates(): void {
  //   this.states = undefined;
  // }

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
      const repo = tx.getRepository(this.repository.target);
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
      const repo = tx.getRepository(this.repository.target);
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
    if (e[this.idFieldName]) {
      return e[this.idFieldName];
    }
    throw new Error(`Id field "${this.idFieldName}" is empty`)
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
      const repo = tx.getRepository(this.repository.target);
      const res = await repo.delete(ids);
      return res.affected || 0;
    }, transaction);
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