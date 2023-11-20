import {Model} from "sequelize-typescript";
import {Op} from "sequelize";
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

  // protected states?: Partial<TEntity>;
  //
  // protected statesGenerators: Generator<Partial<TEntity>>[] = [];
  //
  // /* Preprocessor is a function that can be used to mutate entity fields right before entity creation
  //   It allows you to get access to entity fields values
  //   after all states and statesGenerators and customFields are applied
  //   and mutate them.
  // */
  // protected entityPreprocessor: (fields: Partial<TEntity>, index: number) => (Partial<TEntity> | Promise<Partial<TEntity>>);
  //
  // /* Postprocessor is a function that can be used to mutate entity right after entity creation
  //     It allows you to get access to entity fields values
  //     Also you can perform side effects related to entity creation.
  //     For example if you need to perform some additional actions for each created entity
  //  */
  // protected entityPostprocessor: (entity: TEntity, index: number) => (TEntity | Promise<TEntity>);


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


  // protected getFakeFields(
  //   customFields?: Partial<TEntity>,
  // ): Partial<TEntity> {
  //   const fields: Partial<TEntity> = this.setFakeFields();
  //   return Object.assign(fields, this.nextStates(), customFields || {});
  // }
  //
  // /* You can override this method
  //    to set default values for Entity fields
  // */
  // protected setFakeFields(): Partial<TEntity> {
  //   return {} as Partial<TEntity>;
  // }
  //
  // /* The same purpose as the states, but you can pass array of states
  //     and its elements will be used as a state for every new entity in round-robin manner.
  //  */
  // protected addStatesGenerator(states: Partial<TEntity>[]): void {
  //   this.statesGenerators.push(this.circularArrayGenerator(states));
  // }
  //
  // protected nextStates(): Partial<TEntity> {
  //   const states = this.states || {};
  //   if(this.statesGenerators.length) {
  //     this.statesGenerators.reduce((acc, gen) => {
  //       acc = Object.assign(acc, gen.next().value);
  //       return acc;
  //     }, states);
  //   }
  //   return states;
  // }
  //
  // protected clearStates(): void {
  //   this.states = undefined;
  //   this.statesGenerators = [];
  //   this.entityPreprocessor = undefined;
  //   this.entityPostprocessor = undefined;
  // }

  protected async processSequelizeRelation(newParent: TEntity, nested: any): Promise<void> {
    const nestedEntities = await nested.service.createMany(nested.count,{
      ...(nested.customFields ?? {})
    });
    await newParent.$add(nested.relationFields.propertyKey, nestedEntities);
  }
  protected async processNested(newParent: TEntity): Promise<void> {
    for (const nested of this.nestedEntities) {
      if ('propertyKey' in nested.relationFields && nested.relationFields.propertyKey) {
        await this.processSequelizeRelation(newParent, nested);
      } else {
        const nestedRelationFields = Array.isArray(nested.relationFields)
          ? nested.relationFields
          : [nested.relationFields];
        const relatedFields = nestedRelationFields.reduce((acc, f) => {
          if ('parent' in f && 'nested' in f) {
            acc[f.nested] = newParent[f.parent];
          }
          return acc;
        }, {});
        await nested.service.createMany(nested.count, {
          ...(nested.customFields ?? {}),
          ...relatedFields
        });
      }
    }
    this.nestedEntities = [];
  }


  protected async processParents(nestedCount = 1): Promise<void> {
    for (const parentEntityConfig of this.parentEntities) {
      const newParents = await parentEntityConfig.service.createMany(parentEntityConfig.each ? nestedCount : 1, {
        ...(parentEntityConfig.customFields ?? {})
      });
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

  // protected async preprocessEntities(
  //   count: number,
  //   customFields?: Partial<TEntity>,
  // ): Promise<Partial<TEntity>[]> {
  //   const bulkInsertDataPromises = Array(count)
  //     .fill(1)
  //     .map((_, i) => {
  //       const fields: any = this.getFakeFields(customFields);
  //       return typeof this.entityPreprocessor === 'function'
  //         ? this.entityPreprocessor(fields, i)
  //         : fields;
  //     });
  //   return this.sequentialResolver(bulkInsertDataPromises);
  // }
  //
  // protected async postprocessEntities(entities: TEntity[]): Promise<TEntity[]> {
  //   if(typeof this.entityPostprocessor === 'function') {
  //     const postprocessingEntitiesPromises = entities
  //       .map((entity, i) => this.entityPostprocessor(entity, i));
  //       return this.sequentialResolver(postprocessingEntitiesPromises);
  //   }
  //   return entities;
  // }

  // protected async sequentialResolver(promises: Promise<any>[] | any[]): Promise<any[]> {
  //   const results = [];
  //   for (const promise of promises) {
  //     if (promise instanceof Promise) {
  //       results.push(await promise);
  //       continue;
  //     }
  //     if (typeof promise === 'function') {
  //       results.push(await promise());
  //       continue;
  //     }
  //     results.push(promise);
  //   }
  //   return results;
  // }
  //
  // protected *circularArrayGenerator(arr) {
  //   let index = 0;
  //   while (true) {
  //     yield arr[index];
  //     index = (index + 1) % arr.length;
  //   }
  // }

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

  public async create(
    customFields?: Partial<TEntity>,
  ): Promise<TEntity> {
    await this.processParents();
    const fields = this.getFakeFields(customFields);
    const preprocessedFields = this.entityPreprocessor
      ? await this.entityPreprocessor(fields, 0)
      : fields;
    const entity = await this.repository.create(preprocessedFields, {returning: true});
    this.entityIds.push(this.getId(entity));
    await this.processNested(entity);
    const postprocessed = await this.postprocessEntities([entity]);
    this.clearStates();
    return postprocessed.pop();
  }

  public async createMany(
    count: number,
    customFields?: Partial<TEntity>,
  ): Promise<TEntity[]> {
    await this.processParents(count);
    const bulkInsertData = await this.preprocessEntities(count, customFields);
    const entities = await this.repository.bulkCreate(bulkInsertData, {returning: true});
    const ids = entities.map(e => this.getId(e));
    this.entityIds.push(...ids);
    if (this.nestedEntities.length) {
      await this.sequentialResolver(entities.map(e => this.processNested(e)));
    }
    const processedEntities =  this.postprocessEntities(entities);
    this.clearStates();
    return processedEntities;
  }

  // /* Add fields to be used when creating entities
  //    Main purpose is to set fields as a side effect of service methods
  //    For example, when you are adding nested entity, you can mutate the parent entity
  //    Can be called multiple times to add multiple states
  // */
  // public addStates(
  //   states: Partial<TEntity> | Partial<TEntity>[] | (() => Partial<TEntity>) | (() => Partial<TEntity>)[],
  // ): this
  // {
  //   if (Array.isArray(states)) {
  //     const statesArray: Partial<TEntity>[] = states.map(state => (typeof state === 'function') ? state() : state);
  //     if (statesArray.length > 0) {
  //       this.statesGenerators.push(this.circularArrayGenerator(statesArray));
  //     }
  //     return this;
  //   }
  //   this.states = Object.assign(this.states || {}, (typeof states === 'function') ? states() : states);
  //   return this;
  // }
  //
  // public afterMakingCallback(preprocessor: (fields: Partial<TEntity>, index: number) => (Partial<TEntity> | Promise<Partial<TEntity>>)): this {
  //   this.entityPreprocessor = preprocessor;
  //   return this;
  // }
  //
  // public afterCreatingCallback(postprocessor: (entity: TEntity, index: number) => (TEntity | Promise<TEntity>)): this {
  //   this.entityPostprocessor = postprocessor;
  //   return this;
  // }
  //
  // public addFieldSequence<K extends keyof TEntity>(field: K, values: TEntity[K][]): this {
  //   this.addStatesGenerator(values.map(value => {
  //     const state = {} as Partial<TEntity>;
  //     state[field] = value;
  //     return state;
  //   }));
  //   return this;
  // }

  // //* Delete all entities created by this service
  // public async cleanup(): Promise<number> {
  //   if(!this.entityIds.length) {
  //     return 0;
  //   }
  //   return this.delete(this.entityIds);
  // }

  public async delete(entityIds): Promise<number> {
    const where = {};
    if (this.hasCompositeId()) {
      where[Op.or] = entityIds;
    } else {
      where[this.getIdFieldNames()[0]] = entityIds;
    }
    return this.repository.destroy({where});
  }

  async getEntityAt(index: number): Promise<TEntity> {
    const entityId = await this.entityIds.at(index);
    return this.repository.findByPk(entityId);
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
