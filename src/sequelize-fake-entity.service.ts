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



  protected nestedEntities: {
    service: SequelizeFakeEntityService<Model>,
    count: number,
    customFields?: any,
    relationFields: SingleKeyRelation | MultipleKeyRelations | PropertyKeyRelation
  }[] = [];


  constructor(
    protected repository: any) {}


  protected getFakeFields(
    customFields?: Partial<TEntity>,
  ): Partial<TEntity> {
    const fields: Partial<TEntity> = this.setFakeFields();
    return Object.assign(fields, this.states || {}, customFields || {});
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
  protected addStates(state: Partial<TEntity>): void {
    this.states = Object.assign(this.states || {}, state);
  }

  protected clearStates(): void {
    this.states = undefined;
  }

  async create(
    customFields?: Partial<TEntity>,
  ): Promise<TEntity> {
    const fields = this.getFakeFields(customFields);
    const entity = await this.repository.create(fields, {returning: true});
    this.entityIds.push(this.hasCompositeId() ? this.pickKeysFromObject(entity) : this.getId(entity));
    await this.processNested(entity);
    this.clearStates();
    return entity;
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


  async createMany(
    count: number,
    customFields?: Partial<TEntity>,
  ): Promise<TEntity[]> {
    const bulkInsertData = Array(count)
      .fill(1)
      .map(() => (this.getFakeFields(customFields)));
    const entities = await this.repository.bulkCreate(bulkInsertData, {returning: true});
    const ids = this.hasCompositeId()
      ? entities.map(e => this.pickKeysFromObject(e))
      : entities.map(e => this.getId(e));
    this.entityIds.push(...ids);
    if (this.nestedEntities.length) {
      await Promise.all(entities.map(e => this.processNested(e)));
    }
    this.clearStates();
    return entities;
  }

  getIdFieldNames(): string[] {
    return this.idFieldNames.length > 0
      ? this.idFieldNames
      : this.repository.primaryKeyAttributes;
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
}
