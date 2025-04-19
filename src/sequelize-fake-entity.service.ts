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

  protected async processSequelizeRelation(newParents: TEntity[], nested: any, transaction?: any): Promise<void> {
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

  protected async processNested(newParents: TEntity[], transaction?: any): Promise<void> {
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


  protected async processParents(nestedCount = 1, transaction?: any): Promise<void> {
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

  public async create(
    customFields?: Partial<TEntity>,
    transaction?: any,
  ): Promise<TEntity> {
    await this.processParents(1, transaction);
    const fields = this.getFakeFields(customFields);
    const preprocessedFields = this.entityPreprocessor
      ? await this.entityPreprocessor(fields, 0)
      : fields;
    const entity = await this.repository.create(preprocessedFields, {
      returning: true,
      transaction,
    });
    this.entityIds.push(this.getId(entity));
    await this.processNested([entity], transaction);
    const postprocessed = await this.postprocessEntities([entity]);
    this.clearStates();
    return postprocessed.pop();
  }

  public async createMany(
    count: number,
    customFields?: Partial<TEntity>,
    transaction?: any,
  ): Promise<TEntity[]> {
    await this.processParents(count, transaction);
    const bulkInsertData = await this.preprocessEntities(count, customFields);
    const entities = await this.repository.bulkCreate(bulkInsertData, {
      returning: true,
      transaction,
    });
    const ids = entities.map(e => this.getId(e));
    this.entityIds.push(...ids);
    if (this.nestedEntities.length) {
      await this.processNested(entities, transaction);
    }
    const processedEntities =  await this.postprocessEntities(entities);
    this.clearStates();
    return processedEntities;
  }

  public async delete(entityIds, transaction?: any): Promise<number> {
    const where = {};
    if (this.hasCompositeId()) {
      where[Op.or] = entityIds;
    } else {
      where[this.getIdFieldNames()[0]] = entityIds;
    }
    return this.repository.destroy({
      where,
      transaction,
    });
  }

  async getEntityAt(index: number, transaction?: any): Promise<TEntity> {
    const entityId = await this.entityIds.at(index);
    return this.repository.findByPk(entityId, { transaction });
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
