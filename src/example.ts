import AsyncPool from "./AsyncPool.js";
import WorkList from "./WorkList.js";

async function timer(ms: number) {
  await new Promise<void>((resolve) =>
    setTimeout(() => {
      console.log("timer", ms);
      resolve();
    }, ms)
  );
  return;
}

function errorTimer(ms: number) {
  return new Promise((_, reject) =>
    setTimeout(() => {
      console.log("error timer", ms);
      reject("error: " + ms);
    }, ms)
  );
}
async function testPool() {
  const pool = new AsyncPool(5, "lazy");
  console.time("timer");
  pool.startTimer();
  await pool.submit(timer, 2000);
  console.log(await pool.isWorking());
  await pool.submit(timer, 1000);
  await pool.close();
  pool.endTimer();
  console.log(await pool.isWorking());
  console.timeEnd("timer");
  console.log(pool.getErrors());
}

async function testWorklist() {
  const workList = new WorkList(5, 2000, 1000);
  let i = 0;
  console.time("test");
  await workList.work(async (item, list) => {
    await timer(item);
    if (++i < 10) list.push(1000, 2000);
  });
  console.timeEnd("test");
}

await testWorklist();
