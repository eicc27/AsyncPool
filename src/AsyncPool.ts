/**
 * An async pool that limits the number of concurrent tasks.
 * Compared to `Promise.all`, this class does not keep track of the results of promises, but
 * offers fine-grained control over a large number of concurrent tasks.
 */
export default class AsyncPool {
  private pool: Promise<number>[] = [];
  private errors: any[] = [];
  private closed = false;

  /**
   * @param maxWorkers The maximum number of concurrent tasks.
   * @param errorStrategy The strategy to deal with errors. "eagar" means that the pool would
   * report errors immediately, while "lazy" means that the pool would wait for all tasks to
   * complete before reporting errors.
   */
  constructor(
    private maxWorkers: number,
    private errorStrategy: "eagar" | "lazy" = "lazy"
  ) {}

  /**
   * Checks the state of a promise.
   * @param p The promise to be checked.
   * @returns A promise that resolves to the state of the promise.
   */
  public static GetState(
    p: Promise<unknown>
  ): Promise<"pending" | "fulfilled" | "rejected"> {
    const t = {};
    return Promise.race([p, t]).then(
      (v) => (v === t ? "pending" : "fulfilled"),
      () => "rejected"
    );
  }

  /**
   * Behaves like `Promsie.all` but tries to listen to all changes in array of promises.
   * It would not resolve until the promises array remains unchanged. The major difference
   * between this method and `Promise.all` is that this method does not keep track of resolve results of
   * promises.
   * @param promises An immutable array of promises.
   */
  public static async ConcreteAll(promises: Promise<unknown>[]) {
    const hasPending = async () => {
      for (const promise of promises) {
        const state = await AsyncPool.GetState(promise);
        if (state == "pending") return true;
      }
      return false;
    };
    while (await hasPending()) {
      await Promise.all(promises);
    }
  }

  private getVacantIndex() {
    if (this.pool.length < this.maxWorkers) return this.pool.length;
    else return null;
  }

  private wrapTaskWithIndex(
    index: number,
    fn: (...args: any[]) => Promise<unknown>,
    ...args: unknown[]
  ) {
    const task = fn(...args).then(
      () => {
        return index;
      },
      (reason) => {
        if (this.errorStrategy == "lazy") this.errors.push(reason);
        else throw reason;
        return index;
      }
    );
    return task;
  }

  /**
   * Submits a task to the pool. This would block the main thread until a vacant slot is available.
   * @param fn The task to be submitted.
   * @param args The arguments of the task.
   */
  public async submit(
    fn: (...args: any[]) => Promise<unknown>,
    ...args: unknown[]
  ) {
    const index = this.getVacantIndex();
    if (index != null) {
      // pool is still vacant (only when initializing)
      this.pool.push(this.wrapTaskWithIndex(index, fn, ...args));
    } else {
      // pool is full (substitution strategy)
      const returnIndex = await Promise.any(this.pool); // wait for a task to complete
      this.pool[returnIndex] = this.wrapTaskWithIndex(returnIndex, fn, ...args);
    }
  }

  /**
   * Closes the pool. This would block the main thread until all tasks are completed.
   * It would also actively waits for the pool to ramain unchanged.
   */
  public async close() {
    await AsyncPool.ConcreteAll(this.pool);
    this.closed = true;
  }

  /**
   * Get all errors that occured during the execution of tasks. If the error strategy is set to
   * "eagar", this method would return an empty array.
   * @returns An array of errors.
   */
  public getErrors() {
    if (this.errorStrategy == "eagar") {
      console.warn(
        "Pool strategy is set to report error immediately, getErrors would return an empty array"
      );
      return [];
    }
    if (this.closed) return this.errors;
    else
      throw new EvalError(
        "Cannot sum up errors in unclosed pools. Call close() first."
      );
  }
}
