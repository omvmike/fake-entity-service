import {DeepPartial, FindOneOptions, Repository} from "typeorm";
import {DeleteResult} from "typeorm/query-builder/result/DeleteResult";
import {Model} from "sequelize-typescript";
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
  }

  protected async processNested(newParent: TEntity): Promise<void> {
    for (const nested of this.nestedEntities) {
      const nestedRelationFields = Array.isArray(nested.relationFields)
        ? nested.relationFields
        : [ nested.relationFields ];
      const relatedFields = nestedRelationFields.reduce((acc, f) => {
        acc[f.nested] = newParent[f.parent];
        return acc;
      }, {});
      await nested.service.createMany(nested.count, {
        ...(nested.customFields ?? {}),
        ...relatedFields
      })
    }
  }

  async create(
    customFields?: Partial<TEntity>,
  ): Promise<TEntity> {
    await this.processParents();
    const fields = this.getFakeFields(customFields);
    const preprocessedFields = this.entityPreprocessor
      ? await this.entityPreprocessor(fields, 0)
      : fields;
    const created = this.repository.create(preprocessedFields as DeepPartial<TEntity>);
    const entity = await this.repository.save(created);
    this.entityIds.push(this.getId(entity));
    await this.processNested(entity);
    const postprocessed = await this.postprocessEntities([entity]);
    // cleanup
    this.nestedEntities = [];
    this.parentEntities = [];
    this.clearStates();
    return postprocessed.pop();
  }

  async createMany(
    count: number,
    customFields?: Partial<TEntity>,
  ): Promise<TEntity[]> {
    await this.processParents(count);
    const preprocessed = await this.preprocessEntities(count, customFields);
    // @ts-ignore
    const bulkInsertData = preprocessed.map(f => this.repository.create(f))
    const entities = await this.repository.save(bulkInsertData as DeepPartial<TEntity>[]);
    const ids = entities.map(e => this.getId(e));
    this.entityIds.push(...ids);
    if (this.nestedEntities.length) {
      await Promise.all(entities.map(e => this.processNested(e)));
    }
    const processedEntities =  await this.postprocessEntities(entities);
    // cleanup
    this.nestedEntities = [];
    this.parentEntities = [];
    this.clearStates();
    return processedEntities;
  }

  getId(e: TEntity): any {
    if (e[this.idFieldName]) {
      return e[this.idFieldName];
    }
    throw new Error(`Id field "${this.idFieldName}" is empty`)
  }

  // async cleanup(): Promise<DeleteResult> {
  //   if(!this.entityIds.length) {
  //     return { affected: 0, raw: undefined }
  //   }
  //   return this.repository.delete(this.entityIds)
  // }

  async delete(ids: any[]): Promise<number>  {
    const res = await this.repository.delete(ids)
    return res.affected;
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