export type SingleKeyRelation = {
  parent: string,
  nested: string
};

export type MultipleKeyRelations = {
  parent: string,
  nested: string
}[];

export abstract class FakeEntityCoreService<TEntity> {

  public entityIds = [];

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


  protected getFakeFields(
    customFields?: Partial<TEntity>,
  ): Partial<TEntity> {
    const fields: Partial<TEntity> = this.setFakeFields();
    return Object.assign(fields, this.nextStates(), customFields || {});
  }

  /* You can override this method
     to set default values for Entity fields
  */
  protected setFakeFields(): Partial<TEntity> {
    return {} as Partial<TEntity>;
  }

  protected async sequentialResolver(promises: Promise<any>[] | any[]): Promise<any[]> {
    const results = [];
    for (const promise of promises) {
      if (promise instanceof Promise) {
        results.push(await promise);
        continue;
      }
      if (typeof promise === 'function') {
        results.push(await promise());
        continue;
      }
      results.push(promise);
    }
    return results;
  }

  protected *circularArrayGenerator(arr) {
    let index = 0;
    while (true) {
      yield arr[index];
      index = (index + 1) % arr.length;
    }
  }

  /* The same purpose as the states, but you can pass array of states
      and its elements will be used as a state for every new entity in round-robin manner.
   */
  protected addStatesGenerator(states: Partial<TEntity>[]): void {
    this.statesGenerators.push(this.circularArrayGenerator(states));
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

  protected async preprocessEntities(
    count: number,
    customFields?: Partial<TEntity>,
  ): Promise<Partial<TEntity>[]> {
    const bulkInsertDataPromises = Array(count)
      .fill(1)
      .map((_, i) => {
        const fields: any = this.getFakeFields(customFields);
        return typeof this.entityPreprocessor === 'function'
          ? this.entityPreprocessor(fields, i)
          : fields;
      });
    return this.sequentialResolver(bulkInsertDataPromises);
  }

  protected async postprocessEntities(entities: TEntity[]): Promise<TEntity[]> {
    if(typeof this.entityPostprocessor === 'function') {
      const postprocessingEntitiesPromises = entities
        .map((entity, i) => this.entityPostprocessor(entity, i));
      return this.sequentialResolver(postprocessingEntitiesPromises);
    }
    return entities;
  }

  /* Add fields to be used when creating entities
     Main purpose is to set fields as a side effect of service methods
     For example, when you are adding nested entity, you can mutate the parent entity
     Can be called multiple times to add multiple states
  */
  public addStates(
    states: Partial<TEntity> | Partial<TEntity>[] | (() => Partial<TEntity>) | (() => Partial<TEntity>)[] | (() => Partial<TEntity>[]),
  ): this
  {
    if (typeof states === 'function') {
      states = states();
    }
    if (Array.isArray(states)) {
      const statesArray: Partial<TEntity>[] = states.map(state => (typeof state === 'function') ? state() : state);
      if (statesArray.length > 0) {
        this.statesGenerators.push(this.circularArrayGenerator(statesArray));
      }
      return this;
    }
    this.states = Object.assign(this.states || {}, states);
    return this;
  }

  public afterMakingCallback(preprocessor: (fields: Partial<TEntity>, index: number) => (Partial<TEntity> | Promise<Partial<TEntity>>)): this {
    this.entityPreprocessor = preprocessor;
    return this;
  }

  public afterCreatingCallback(postprocessor: (entity: TEntity, index: number) => (TEntity | Promise<TEntity>)): this {
    this.entityPostprocessor = postprocessor;
    return this;
  }

  public addFieldSequence<K extends keyof TEntity>(field: K, values: TEntity[K][]): this {
    this.addStatesGenerator(values.map(value => {
      const state = {} as Partial<TEntity>;
      state[field] = value;
      return state;
    }));
    return this;
  }

  /**
   * Delete all entities created by this service
   * 
   * @param transaction - Optional transaction to use
   * @returns Number of deleted entities
   * 
   * @example
   * // Cleanup without transaction
   * await fakeUserService.cleanup();
   * 
   * @example
   * // Cleanup with transaction
   * await dataSource.transaction(async (transactionEntityManager) => {
   *   await fakeUserService.cleanup(transactionEntityManager);
   * });
   */
  public async cleanup(transaction?: any): Promise<number> {
    if(!this.entityIds.length) {
      return 0;
    }
    return this.delete(this.entityIds, transaction);
  }

  public abstract delete(ids: any[], transaction?: any): Promise<number>;

  public abstract create(
    customFields?: Partial<TEntity>,
    transaction?: any,
  ): Promise<TEntity>;

  public abstract createMany(
    count: number,
    customFields?: Partial<TEntity>,
    transaction?: any,
  ): Promise<TEntity[]>;

  /**
   * Creates a new instance of this service with the same repository and empty state.
   *
   * WARNING: This implementation assumes the subclass has a constructor(repository: any)
   * and a `repository` property. If your subclass does not follow this convention,
   * you must override this method.
   *
   * @returns {this} a new instance with the same repository and empty state
   */
  public clone(): this {
    // @ts-ignore: dynamic constructor call
    const Cls = this.constructor as { new (...args: any[]): this };
    // @ts-ignore: repository must be defined on subclasses
    return new Cls(this.repository);
  }
}