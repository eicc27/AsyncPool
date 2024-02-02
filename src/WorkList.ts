import AsyncPool from "./AsyncPool.js";

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A minimal worklist implementation coupled with AsyncPool and spinlock.
 *
 * A worklist allows adding work items initially and while working. In a single
 * work loop, it would take one job from the worklist and tries to process it
 * with the given worker function, thrown into a given-sized pool for controlled concurrency.
 *
 * The loop ends only if the work list is empty and the pool has no working coroutines.
 */
export default class WorkList<T> {
  private workList = [] as T[];
  private pool: AsyncPool;
  /**
   * Constructs a worklist with a given number of workers and initial work items.
   * @param maxWorkers the AsyncPool size, i.e. the maximum number of concurrent tasks.
   * @param items the initial work items. Normally it cannot be empty.
   */
  public constructor(maxWorkers: number, ...items: T[]) {
    this.workList.push(...items);
    this.pool = new AsyncPool(maxWorkers);
  }
  
  /**
   * Works until the work list is empty and the pool has no working coroutines.
   * In some situations that the work list is empty
   * but the pool is still working, it acquires a spinlock and
   * waits for the pool *to do something so that the work list changes*.
   * @param fn the worker function that takes a worklist and a work item, and returns a promise.
   */
  public async work(fn: (item: T, workList: T[], pool: AsyncPool) => Promise<unknown>) {
    while (this.workList.length > 0 || (await this.pool.isWorking())) {
      const item = this.workList.pop();
      if (!item) {
        await sleep(10); // wait for the workList to be filled
        continue;
      }
      await this.pool.submit(fn, item, this.workList, this.pool);
    }
    await this.pool.close();
  }
}
