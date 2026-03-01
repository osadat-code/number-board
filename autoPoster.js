const fs = require("fs");

const CONFIG_FILE = "/tmp/autoConfig.json";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getNextTarget(cfg) {
  const now = new Date();
  const t = new Date();

  t.setHours(cfg.hour, cfg.min, cfg.sec, cfg.ms);

  if (t <= now) {
    t.setDate(t.getDate() + 1);
  }

  return t;
}

async function precisePost(cfg) {
  try {
    const PORT = process.env.PORT || 10000; 
    const res = await fetch(`http://localhost:${PORT}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: cfg.mode,
        numbers: cfg.numbers,
        user: cfg.user
      })
    });

    if (res.ok) {
      console.log(`[自動投稿] 投稿完了:`, new Date().toLocaleString(), cfg);
    } else {
      console.error(`[自動投稿] 投稿失敗 (Status: ${res.status})`);
    }
  } catch (e) {
    console.error(`[自動投稿] 通信エラー:`, e.message);
  }
}

async function loop() {
  console.log("自動投稿ループ開始...");
  while (true) {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        console.log("設定ファイル待ち...");
        await sleep(5000);
        continue;
      }

      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE));

      const now = Date.now();
      const nextTime = getNextTarget(cfg).getTime();
      const waitMs = nextTime - now;

      console.log(`次の予定: (${new Date(nextTime).toLocaleString()}) まであと ${Math.round(waitMs/1000)}秒`);

      if (waitMs > 1000) {
        await sleep(waitMs - 500);
      }

      while (Date.now() < nextTime) {
        await new Promise(setImmediate);
      }

      await precisePost(cfg);
      await sleep(2000);

    } catch (err) {
      console.error("ループ内でエラーが発生しました:", err.message);
      await sleep(5000);
    }
  }
}

loop();