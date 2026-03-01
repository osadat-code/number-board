const fs = require("fs");

const CONFIG_FILE = "/tmp/autoConfig.json";   // Render で書き込み可能な場所

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// JST のまま次の実行時刻を作る（UTC 変換しない）
function getNextTarget(cfg) {
  const now = new Date();
  const t = new Date();

  // JST のままセット
  t.setHours(cfg.hour, cfg.min, cfg.sec, cfg.ms);

  // もし現在時刻を過ぎていたら翌日にする
  if (t <= now) {
    t.setDate(t.getDate() + 1);
  }

  return t;
}

async function precisePost(cfg, slotName) {
  try {
    // Render では localhost:3000 は存在しないので相対パスに変更
    const res = await fetch("/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: cfg.mode,
        numbers: cfg.numbers,
        user: cfg.user
      })
    });

    console.log(`[${slotName}] 投稿完了:`, new Date().toLocaleString(), cfg);
  } catch (e) {
    console.error(`[${slotName}] 投稿失敗:`, e.message);
  }
}

async function loop() {
  console.log("自動投稿ループ開始...");
  while (true) {

    // 毎ループで最新設定を読み直す
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE));

    const now = Date.now();
    const t1 = getNextTarget(cfg.slot1).getTime();
    const t2 = getNextTarget(cfg.slot2).getTime();

    const next = t1 < t2
      ? { time: t1, data: cfg.slot1, name: "slot1" }
      : { time: t2, data: cfg.slot2, name: "slot2" };

    const waitMs = next.time - now;
    console.log(`次の予定: ${next.name} (${new Date(next.time).toLocaleString()}) まであと ${Math.round(waitMs/1000)}秒`);

    if (waitMs > 1000) {
      await sleep(waitMs - 500);
    }

    while (Date.now() < next.time) {
      await new Promise(setImmediate);
    }

    await precisePost(next.data, next.name);
    await sleep(2000);
  }
}

loop();
