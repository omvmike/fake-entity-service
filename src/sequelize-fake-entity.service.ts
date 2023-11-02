import {Model} from "sequelize-typescript";
import {Op} from "sequelize";

type SingleKeyRelation = {
  parent: string,
  nested: string
};

type MultipleKeyRelations = {
  parent: string,
  nested: string
}[];

// This type based on Sequelize relations feature
// so you should describe relation in your model to use it
type PropertyKeyRelation = {
  // You can use internal Sequelize model relation field name
  // instead of parent and nested fields
  // it uses Sequelize $add method to add nested entities
  propertyKey: string
};

export class SequelizeFakeEntityService<TEntity extends Model> {

  // * Array of ids of entities created by this service
  public entityIds = [];

  // * Override id filed name described in model (it's optional)
  public idFieldNames = [];

  protected states?: Partial<TEntity>;

  protected statesGenerators: Generator<Partial<TEntity>>[] = [];

  /* Preprocessor is a function that can be used to mutate entity fields right before entity creation
    It allows you to get access to entity fields values
    after all states and statesGenerators and customFields are applied
    and mutate them.
  */
  protected entityPreprocessor: (fields: Partial<TEntity>, index: number) => (Partial<TEntity> | Promise<Partial<TEntity>>);

  /* Postprocessor is a function that can be used to mutate entity right after entity creation
      It allows you to get access to entity fields values
      Also you can perform side effects related to entity creation.
      For example if you need to perform some additional actions for each created entity
   */
  protected entityPostprocessor: (entity: TEntity, index: number) => (TEntity | Promise<TEntity>);


  protected nestedEntities: {
    service: SequelizeFakeEntityService<Model>,
    count: number,
    customFields?: any,
    relationFields: SingleKeyRelation | MultipleKeyRelations | PropertyKeyRelation
  }[] = [];

  protected parentEntities: {
    service: SequelizeFakeEntityService<Model>,
    // default false, means that exacly one parent will be created and attached for all nested entity declared by createMany(), otherwise parent will be created for each nested entity
    each?: boolean,
    customFields?: any,
    relationFields: SingleKeyRelation | MultipleKeyRelations
  }[] = [];


  constructor(
    protected repository: any) {}


  protected getFakeFields(
    customFields?: Partial<TEntity>,
  ): Partial<TEntity> {
    const fields: Partial<TEntity> = this.setFakeFields();
    return Object.assign(fields, this.nextStates(), customFields || {});
  }

  /* You can override this method
     to set default values for Entity fields
  */
  setFakeFields(): Partial<TEntity> {
    return {} as Partial<TEntity>;
  }

  /* Add fields to be used when creating entities
     Main purpose is to set fields as a side effect of service methods
     For example, when you are adding nested entity, you can mutate the parent entity
     Can be called multiple times to add multiple states
  */
  protected addStates(
    states: Partial<TEntity> | Partial<TEntity>[] | (() => Partial<TEntity>) | (() => Partial<TEntity>)[],
  ): void {
    if (Array.isArray(states)) {
      const statesArray: Partial<TEntity>[] = states.map(state => (typeof state === 'function') ? state() : state);
      if (statesArray.length > 0) {
        this.statesGenerators.push(this.circularArrayGenerator(statesArray));
      }
      return;
    }
    this.states = Object.assign(this.states || {}, (typeof states === 'function') ? states() : states);
  }

  setEntityPreprocessor(preprocessor: (fields: Partial<TEntity>, ) => (Partial<TEntity> | Promise<Partial<TEntity>>)): void {
    this.entityPreprocessor = preprocessor;
  }

  setEntityPostprocessor(postprocessor: (entity: TEntity, ) => (TEntity | Promise<TEntity>)): void {
    this.entityPostprocessor = postprocessor;
  }

  /* The same purpose as the states, but you can pass array of states
      and its elements will be used as a state for every new entity in round-robin manner.
   */
  protected addStatesGenerator(states: Partial<TEntity>[]): void {
    this.statesGenerators.push(this.circularArrayGenerator(states));
  }

  addFieldSequence<K extends keyof TEntity>(field: K, values: TEntity[K][]): this {
    this.addStatesGenerator(values.map(value => {
      const state = {} as Partial<TEntity>;
      state[field] = value;
      return state;
    }));
    return this;
  }

  protected nextStates(): Partial<TEntity> {
    const states = this.states || {};
    if(this.statesGenerators.length) {
      this.statesGenerators.reduce((acc, gen) => {
        acc = Object.assign(acc, gen.next().value);
        return acc;
      }, states);
    }
    return states;
  }

  protected clearStates(): void {
    this.states = undefined;
    this.statesGenerators = [];
    this.entityPreprocessor = undefined;
    this.entityPostprocessor = undefined;
  }

  async create(
    customFields?: Partial<TEntity>,
  ): Promise<TEntity> {
    await this.processParents();
    const fields = this.getFakeFields(customFields);
    const preprocessedFields = this.entityPreprocessor
      ? await this.entityPreprocessor(fields, 0)
      : fields;
    const entity = await this.repository.create(preprocessedFields, {returning: true});
    this.entityIds.push(this.hasCompositeId() ? this.pickKeysFromObject(entity) : this.getId(entity));
    await this.processNested(entity);
    this.clearStates();
    const postprocessed = await this.postprocessEntities([entity]);
    return postprocessed.pop();
  }


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

  protected async preprocessEntities(
    count: number,
    customFields?: Partial<TEntity>,
  ): Promise<Partial<TEntity>[]> {
    const bulkInsertDataPromises = Array(count)
      .fill(1)
      .map((_, i) => {
        const fields: any = this.getFakeFields(customFields);
        return this.entityPreprocessor(fields, i);
      })
    return Promise.all(bulkInsertDataPromises);
  }

  protected async postprocessEntities(entities: TEntity[]): Promise<TEntity[]> {
    if(this.entityPostprocessor) {
      const postprocessorEntitiesPromises = entities.map((entity, i) => {
        return this.entityPostprocessor(entity, i);
      });
      return Promise.all(postprocessorEntitiesPromises);
    }
    return entities;
  }


  async createMany(
    count: number,
    customFields?: Partial<TEntity>,
  ): Promise<TEntity[]> {
    await this.processParents(count);
    const bulkInsertData = await this.preprocessEntities(count, customFields);
    const entities = await this.repository.bulkCreate(bulkInsertData, {returning: true});
    const ids = this.hasCompositeId()
      ? entities.map(e => this.pickKeysFromObject(e))
      : entities.map(e => this.getId(e));
    this.entityIds.push(...ids);
    if (this.nestedEntities.length) {
      await Promise.all(entities.map(e => this.processNested(e)));
    }
    this.clearStates();
    return this.postprocessEntities(entities);
  }

  getIdFieldNames(): string[] {
    return this.idFieldNames.length > 0
      ? this.idFieldNames
      : this.repository.primaryKeyAttributes;
  }

  *circularArrayGenerator(arr) {
    let index = 0;
    while (true) {
      yield arr[index];
      index = (index + 1) % arr.length;
    }
  }

  hasCompositeId(): boolean {
    return this.getIdFieldNames().length > 1;
  }

  pickKeysFromObject(obj: any): any {
    return this.getIdFieldNames()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        if (acc[key] === undefined) {
          throw new Error(`Id field "${key}" is empty`)
        }
        return acc;
      }, {});
  }

  getId(e: TEntity): any {
    if (this.hasCompositeId()) {
      throw new Error('Composite id is not supported use pickKeysFromObject instead');
    }
    const idFieldName = this.getIdFieldNames()[0];
    const idValue = e[idFieldName];
    if (idValue === undefined) {
      throw new Error(`Id field "${idFieldName}" is empty`)
    }
    return e[this.getIdFieldNames()[0]];
  }

  //* Delete all entities created by this service
  async cleanup(): Promise<number> {
    if(!this.entityIds.length) {
      return 0;
    }
    return this.delete(this.entityIds);
  }

  async delete(entityIds): Promise<number> {
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
}
