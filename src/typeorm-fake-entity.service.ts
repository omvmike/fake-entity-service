import {DeepPartial, FindOneOptions, Repository} from "typeorm";
import {DeleteResult} from "typeorm/query-builder/result/DeleteResult";



export class TypeormFakeEntityService<TEntity> {

  public entityIds = [];
  public idFieldName = 'id';

  protected states?: Partial<TEntity>;

  protected nestedEntities: {
    service: TypeormFakeEntityService<any>,
    count: number,
    customFields?: any,
    relationFields: {
      parent: string,
      nested: string
    } | {
      parent: string,
      nested: string
    }[]
  }[] = [];

  constructor(protected repository: Repository<TEntity>) {}

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
    const entity = await this.repository.save(fields as DeepPartial<TEntity>);
    this.entityIds.push(this.getId(entity));
    await this.processNested(entity);
    this.clearStates();
    return entity as TEntity;
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
    this.nestedEntities = [];
  }

  async createMany(
    count: number,
    customFields?: Partial<TEntity>,
  ): Promise<TEntity[]> {
    const bulkInsertData = Array(count)
      .fill(1)
      .map(() => {
        const fields: any = this.getFakeFields(customFields);
        return this.repository.create(fields)
      });
    const entities = await this.repository.save(bulkInsertData as DeepPartial<TEntity>[]);
    const ids = entities.map(e => this.getId(e));
    this.entityIds.push(...ids);
    if (this.nestedEntities.length) {
      await Promise.all(entities.map(e => this.processNested(e)));
    }
    this.clearStates();
    return entities;
  }

  getId(e: TEntity): any {
    if (e[this.idFieldName]) {
      return e[this.idFieldName];
    }
    throw new Error(`Id field "${this.idFieldName}" is empty`)
  }

  async cleanup(): Promise<DeleteResult> {
    if(!this.entityIds.length) {
      return { affected: 0, raw: undefined }
    }
    return this.repository.delete(this.entityIds)
  }

  async delete(entityIds) {
    return this.repository.delete(entityIds)
  }

}