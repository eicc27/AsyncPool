/**
 * An async pool that limits the number of concurrent tasks.
 * Compared to `Promise.all`, this class does not keep track of the results of promises, but
 * offers fine-grained control over a large number of concurrent tasks.
 */
export default class AsyncPool {
  private pool: Promise<number>[] = [];
  private errors: any[] = [];
  private counter = 0;
  private start?: [number, number];
  private count = false;
  private closed = false;

  /**
   * @param maxWorkers The maximum number of concurrent tasks.
   * @param errorStrategy The strategy to deal with errors. "eager" means that the pool would
   * report errors immediately, while "lazy" means that the pool would wait for all tasks to
   * complete before reporting errors.
   */
  constructor(
    private maxWorkers: number,
    private errorStrategy: "eager" | "lazy" = "lazy"
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

  /**
   * Checks whether the pool still has working promise in it.
   * @returns Promsie<boolean> value, indicating the vacancy of the pool.
   */
  public async isWorking(): Promise<boolean> {
    for (const task of this.pool) {
      const state = await AsyncPool.GetState(task);
      if (state == "pending") return true;
    }
    return false;
  }

  /**
   * Starts the timer in the pool.
   * The timer is used to calculate the flow of tasks in a given time period.
   * It is useful for recording the performance.
   * 
   * Normally a `startTimer` works with a `stopTimer`, which reports the performance
   * and stops the operations initiated in `startTimer`.
   * If consecutive `startTimer`s are called before a `stopTimer`, the time-start
   * is refreshed.
   */
  public startTimer() {
    if (this.count)
      console.warn("startTimer is called again before a stopTimer.", "The time of start would refresh.")
    this.count = true;
    this.start = process.hrtime();
  }

  /**
   * Stops the inner timer in the pool. It reports:
   * 1. the time elapsed.
   * 2. the total tasks completed.
   * 3. the rate in tasks per second.
   * @param precision Determines how many digits should be kept in floating points.
   */
  public endTimer(precision = 3) {
    if (!this.count)
      throw new Error("Cannot call endTimer before the timer is started");
    const timeElapsed = process.hrtime(this.start);
    const t = timeElapsed[0] + timeElapsed[1] * 1e-9;
    const r = this.counter / t;
    console.log(
      `time ${t.toFixed(precision)}; flow ${this.counter}; rate ${r.toFixed(
        precision
      )}`
    );
    this.start = undefined;
    this.count = false;
    this.counter = 0;
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
        if (this.count) this.counter++;
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
   * "eager", this method would return an empty array.
   * @returns An array of errors.
   */
  public getErrors() {
    if (this.errorStrategy == "eager") {
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
