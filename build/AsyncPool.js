export default class AsyncPool {
    maxWorkers;
    errorStrategy;
    pool = [];
    errors = [];
    closed = false;
    constructor(maxWorkers, errorStrategy = "lazy") {
        this.maxWorkers = maxWorkers;
        this.errorStrategy = errorStrategy;
    }
    /**
     * Checks the state of a promise.
     * @param p The promise to be checked.
     * @returns A promise that resolves to the state of the promise.
     */
    static GetState(p) {
        const t = {};
        return Promise.race([p, t]).then((v) => (v === t ? "pending" : "fulfilled"), () => "rejected");
    }
    /**
     * Behaves like `Promsie.all` but tries to listen to all changes in array of promises.
     * It would not resolve until the promises array remains unchanged. The major difference
     * between this method and `Promise.all` is that this method does not keep track of resolve results of
     * promises.
     * @param promises An immutable array of promises.
     */
    static async ConcreteAll(promises) {
        const hasPending = async () => {
            for (const promise of promises) {
                const state = await AsyncPool.GetState(promise);
                if (state == "pending")
                    return true;
            }
            return false;
        };
        while (await hasPending()) {
            await Promise.all(promises);
        }
    }
    getVacantIndex() {
        if (this.pool.length < this.maxWorkers)
            return this.pool.length;
        else
            return null;
    }
    wrapTaskWithIndex(index, fn, ...args) {
        const task = fn(...args).then(() => {
            return index;
        }, (reason) => {
            if (this.errorStrategy == "lazy")
                this.errors.push(reason);
            else
                throw reason;
            return index;
        });
        return task;
    }
    async submit(fn, ...args) {
        const index = this.getVacantIndex();
        if (index != null) {
            // pool is still vacant (only when initializing)
            this.pool.push(this.wrapTaskWithIndex(index, fn, ...args));
        }
        else {
            // pool is full (substitution strategy)
            const returnIndex = await Promise.any(this.pool); // wait for a task to complete
            this.pool[returnIndex] = this.wrapTaskWithIndex(returnIndex, fn, ...args);
        }
    }
    async close() {
        await AsyncPool.ConcreteAll(this.pool);
        this.closed = true;
    }
    getErrors() {
        if (this.errorStrategy == "eagar") {
            console.warn("Pool strategy is set to report error immediately, getErrors would return an empty array");
            return [];
        }
        if (this.closed)
            return this.errors;
        else
            throw new EvalError("Cannot sum up errors in unclosed pools. Call close() first.");
    }
}
