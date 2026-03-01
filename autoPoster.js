const fs = require("fs");
const http = require("http");
const agent = new http.Agent({ keepAlive: true });

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function nextTime(cfg) {
  const t = new Date();
  t.setHours(cfg.hour, cfg.min, cfg.sec, cfg.ms);
  if (t < new Date()) t.setDate(t.getDate() + 1);
  return t;
}

async function waitUntil(target) {
  const diff = target - Date.now();
  if (diff > 100) await sleep(diff - 100);
  while (Date.now() < target) await sleep(1);
}

async function precisePost(cfg) {
  await fetch("http://localhost:3000/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    agent,
    body: JSON.stringify({
      mode: cfg.mode,
      numbers: cfg.numbers,
      user: cfg.user
    })
  });

  console.log("投稿完了:", new Date().toISOString(), cfg);
}

async function loop() {
  while (true) {
    const cfg = JSON.parse(fs.readFileSync("./autoConfig.json"));

    const t1 = nextTime(cfg.slot1);
    const t2 = nextTime(cfg.slot2);

    console.log("次の投稿予定:", t1, t2);

    await waitUntil(t1);
    await precisePost(cfg.slot1);

    await waitUntil(t2);
    await precisePost(cfg.slot2);
  }
}

loop();