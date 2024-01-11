import AsyncPool from "./AsyncPool.js";
async function timer(ms) {
    await new Promise((resolve) => setTimeout(() => {
        console.log("timer", ms);
        resolve();
    }, ms));
    return await pool.submit(errorTimer, 500);
}
function errorTimer(ms) {
    return new Promise((_, reject) => setTimeout(() => {
        console.log("error timer", ms);
        reject("error: " + ms);
    }, ms));
}
const pool = new AsyncPool(5, "lazy");
console.time("timer");
await pool.submit(timer, 2000);
await pool.submit(errorTimer, 1000);
await pool.close();
console.timeEnd("timer");
console.log(pool.getErrors());
