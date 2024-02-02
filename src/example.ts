import AsyncPool from "./AsyncPool.js";

async function timer(ms: number) {
  await new Promise<void>((resolve) =>
    setTimeout(() => {
      console.log("timer", ms);
      resolve();
    }, ms)
  );
  return await pool.submit(errorTimer, 500);
}

function errorTimer(ms: number) {
  return new Promise((_, reject) =>
    setTimeout(() => {
      console.log("error timer", ms);
      reject("error: " + ms);
    }, ms)
  );
}

const pool = new AsyncPool(5, "lazy");
console.time("timer");
pool.startTimer();
await pool.submit(timer, 2000);
console.log(await pool.isWorking());
await pool.submit(errorTimer, 1000);
await pool.close();
pool.endTimer();
console.log(await pool.isWorking());
console.timeEnd("timer");
console.log(pool.getErrors());
