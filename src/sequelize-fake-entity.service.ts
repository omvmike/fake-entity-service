import {Model} from "sequelize-typescript";
import {Op, Transaction} from "sequelize";
import {FakeEntityCoreService, MultipleKeyRelations, SingleKeyRelation} from "./fake-entity-core.service";

// This type based on Sequelize relations feature
// so you should describe relation in your model to use it
type PropertyKeyRelation = {
  // You can use internal Sequelize model relation field name
  // instead of parent and nested fields
  // it uses Sequelize $add method to add nested entities
  propertyKey: string
};

export class SequelizeFakeEntityService<TEntity extends Model> extends FakeEntityCoreService<TEntity> {

  // * Array of ids of entities created by this service
  public entityIds = [];

  // * Override id filed name described in model (it's optional)
  public idFieldNames = [];

  protected nestedEntities: {
    service: SequelizeFakeEntityService<Model>,
    count: number,
    customFields?: any,
    relationFields: SingleKeyRelation | MultipleKeyRelations | PropertyKeyRelation
  }[] = [];

  protected parentEntities: {
    service: SequelizeFakeEntityService<Model>,
    // default false, means that exactly one parent will be created and attached for all nested entity declared by createMany(), otherwise parent will be created for each nested entity
    each?: boolean,
    customFields?: any,
    relationFields: SingleKeyRelation | MultipleKeyRelations
  }[] = [];


  constructor(
    public repository: any,
  ) {
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
   *     const entity = await this.repository.findByPk(1, { transaction: tx });
   *     return entity;
   *   },
   *   existingTransaction
   * );
   */
  protected async withTransaction<T>(
    callback: (transaction?: Transaction) => Promise<T>,
    transaction?: Transaction
  ): Promise<T> {
    if (transaction) {
      try {
        return await callback(transaction);
      } catch (error) {
        if ((transaction as any).finished !== 'commit' && (transaction as any).finished !== 'rollback') {
          await transaction.rollback();
        }
        throw error;
      }
    }

    return callback();
  }

  /**
   * Process Sequelize-specific relations using the $add method
   * 
   * @param newParents - Array of parent entities
   * @param nested - Nested entity configuration
   * @param transaction - Optional Transaction for transaction support
   */
  protected async processSequelizeRelation(newParents: TEntity[], nested: any, transaction?: Transaction): Promise<void> {
    const nestedEntities = await nested.service.createMany(
      nested.count * newParents.length,
      {
        ...(nested.customFields ?? {})
      },
      transaction
    );
    // add nested entities to each parent
    for (let i = 0; i < newParents.length; i++) {
      let nestedEntitiesChunk = nestedEntities.splice(0, newParents.length);
      await newParents[i].$add(nested.relationFields.propertyKey, nestedEntitiesChunk, { transaction });
    }
  }

  /**
   * Process nested entities for all parent entities
   * 
   * @param newParents - Array of parent entities
   * @param transaction - Optional Transaction for transaction support
   */
  protected async processNested(newParents: TEntity[], transaction?: Transaction): Promise<void> {
    for (const nested of this.nestedEntities) {
      if ('propertyKey' in nested.relationFields && nested.relationFields.propertyKey) {
        await this.processSequelizeRelation(newParents, nested, transaction);
      } else {
        const nestedRelationFields = Array.isArray(nested.relationFields)
            ? nested.relationFields
            : [nested.relationFields];
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
    }
    this.nestedEntities = [];
  }

  /**
   * Process parent entities before creating the main entities
   * 
   * @param nestedCount - Number of nested entities to create
   * @param transaction - Optional Transaction for transaction support
   */
  protected async processParents(nestedCount = 1, transaction?: Transaction): Promise<void> {
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

  protected pickKeysFromObject(obj: any): any {
    return this.getIdFieldNames()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        if (acc[key] === undefined) {
          throw new Error(`Id field "${key}" is empty`)
        }
        return acc;
      }, {});
  }

  public getIdFieldNames(): string[] {
    return this.idFieldNames.length > 0
      ? this.idFieldNames
      : this.repository.primaryKeyAttributes;
  }

  public hasCompositeId(): boolean {
    return this.getIdFieldNames().length > 1;
  }

  public getId(e: TEntity): any {
    if (this.hasCompositeId()) {
      return this.pickKeysFromObject(e);
    }
    const idFieldName = this.getIdFieldNames()[0];
    const idValue = e[idFieldName];
    if (idValue === undefined) {
      throw new Error(`Id field "${idFieldName}" is empty`)
    }
    return e[this.getIdFieldNames()[0]];
  }

  /**
   * Creates a single entity with the given custom fields
   * 
   * @param customFields - Optional custom fields to override default values
   * @param transaction - Optional Transaction for transaction support
   * @returns The created entity
   * 
   * @example
   * // Create entity without transaction
   * const user = await fakeUserService.create({ firstName: 'John' });
   * 
   * @example
   * // Create entity with transaction
   * const transaction = await sequelize.transaction();
   * try {
   *   const user = await fakeUserService.create(
   *     { firstName: 'John' },
   *     transaction
   *   );
   *   await transaction.commit();
   * } catch (error) {
   *   await transaction.rollback();
   *   throw error;
   * }
   */
  public async create(
    customFields?: Partial<TEntity>,
    transaction?: Transaction,
  ): Promise<TEntity> {
    return this.withTransaction(async (tx) => {
      await this.processParents(1, tx);
      const fields = this.getFakeFields(customFields);
      const preprocessedFields = this.entityPreprocessor
        ? await this.entityPreprocessor(fields, 0)
        : fields;
      const entity = await this.repository.create(preprocessedFields, {
        returning: true,
        transaction: tx,
      });
      this.entityIds.push(this.getId(entity));
      await this.processNested([entity], tx);
      const postprocessed = await this.postprocessEntities([entity]);
      this.clearStates();
      return postprocessed.pop();
    }, transaction);
  }

  /**
   * Creates multiple entities with the given custom fields
   * 
   * @param count - Number of entities to create
   * @param customFields - Optional custom fields to override default values
   * @param transaction - Optional Transaction for transaction support
   * @returns Array of created entities
   * 
   * @example
   * // Create entities without transaction
   * const users = await fakeUserService.createMany(3, { roleId: 1 });
   * 
   * @example
   * // Create entities with transaction
   * const transaction = await sequelize.transaction();
   * try {
   *   const users = await fakeUserService.createMany(
   *     3,
   *     { roleId: 1 },
   *     transaction
   *   );
   *   await transaction.commit();
   * } catch (error) {
   *   await transaction.rollback();
   *   throw error;
   * }
   */
  public async createMany(
    count: number,
    customFields?: Partial<TEntity>,
    transaction?: Transaction,
  ): Promise<TEntity[]> {
    return this.withTransaction(async (tx) => {
      await this.processParents(count, tx);
      const bulkInsertData = await this.preprocessEntities(count, customFields);
      const entities = await this.repository.bulkCreate(bulkInsertData, {
        returning: true,
        transaction: tx,
      });
      const ids = entities.map(e => this.getId(e));
      this.entityIds.push(...ids);
      if (this.nestedEntities.length) {
        await this.processNested(entities, tx);
      }
      const processedEntities = await this.postprocessEntities(entities);
      this.clearStates();
      return processedEntities;
    }, transaction);
  }

  /**
   * Deletes entities by their IDs
   * 
   * @param entityIds - Entity ID or array of entity IDs to delete
   * @param transaction - Optional Transaction for transaction support
   * @returns Number of affected rows
   * 
   * @example
   * // Delete entities without transaction
   * const affectedCount = await fakeUserService.delete([1, 2, 3]);
   * 
   * @example
   * // Delete entities with transaction
   * const transaction = await sequelize.transaction();
   * try {
   *   const affectedCount = await fakeUserService.delete([1, 2, 3], transaction);
   *   await transaction.commit();
   * } catch (error) {
   *   await transaction.rollback();
   *   throw error;
   * }
   */
  public async delete(entityIds, transaction?: Transaction): Promise<number> {
    return this.withTransaction(async (tx) => {
      const where = {};
      if (this.hasCompositeId()) {
        where[Op.or] = entityIds;
      } else {
        where[this.getIdFieldNames()[0]] = entityIds;
      }
      return this.repository.destroy({
        where,
        transaction: tx,
      });
    }, transaction);
  }

  /**
   * Retrieves an entity at the specified index from the entityIds array
   * 
   * @param index - Index in the entityIds array
   * @param transaction - Optional Transaction for transaction support
   * @returns The entity at the specified index
   * 
   * @example
   * // Get the first created entity
   * const firstEntity = await fakeUserService.getEntityAt(0);
   */
  async getEntityAt(index: number, transaction?: Transaction): Promise<TEntity> {
    return this.withTransaction(async (tx) => {
      const entityId = await this.entityIds.at(index);
      return this.repository.findByPk(entityId, { transaction: tx });
    }, transaction);
  }

  public withParent(fakeParentService: SequelizeFakeEntityService<Model>, relationFields: SingleKeyRelation | MultipleKeyRelations, each = false, customFields?: any): SequelizeFakeEntityService<TEntity> {
    this.parentEntities.push({
      service: fakeParentService,
      each,
      customFields,
      relationFields
    });
    return this;
  }

  public withNested(fakeNestedService: SequelizeFakeEntityService<Model>, relationFields: SingleKeyRelation | MultipleKeyRelations | PropertyKeyRelation, count = 1, customFields?: any): SequelizeFakeEntityService<TEntity> {
    this.nestedEntities.push({
      service: fakeNestedService,
      count,
      customFields,
      relationFields
    });
    return this;
  }
}
