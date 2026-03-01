const fs = require("fs");

const CONFIG_FILE = "/tmp/autoConfig.json";   // Render で書き込み可能な場所

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 次の実行時刻を計算
function getNextTarget(cfg) {
  const now = new Date();
  const t = new Date();

  t.setHours(cfg.hour, cfg.min, cfg.sec, cfg.ms);

  if (t <= now) {
    t.setDate(t.getDate() + 1);
  }

  return t;
}

async function precisePost(cfg, slotName) {
  try {
    // Node.js の fetch は相対パスを解決できないため、localhost とポートを明示します
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
      console.log(`[${slotName}] 投稿完了:`, new Date().toLocaleString(), cfg);
    } else {
      console.error(`[${slotName}] 投稿失敗 (Status: ${res.status})`);
    }
  } catch (e) {
    console.error(`[${slotName}] 通信エラー:`, e.message);
  }
}

async function loop() {
  console.log("自動投稿ループ開始...");
  while (true) {
    try {
      // 毎ループで最新設定を読み直す
      if (!fs.existsSync(CONFIG_FILE)) {
        console.log("設定ファイル待ち...");
        await sleep(5000);
        continue;
      }

      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE));

      const now = Date.now();
      const t1 = getNextTarget(cfg.slot1).getTime();
      const t2 = getNextTarget(cfg.slot2).getTime();

      const next = t1 < t2
        ? { time: t1, data: cfg.slot1, name: "slot1" }
        : { time: t2, data: cfg.slot2, name: "slot2" };

      const waitMs = next.time - now;
      console.log(`次の予定: ${next.name} (${new Date(next.time).toLocaleString()}) まであと ${Math.round(waitMs/1000)}秒`);

      // 待機時間が長い場合は少し手前までスリープ
      if (waitMs > 1000) {
        await sleep(waitMs - 500);
      }

      // 指定時刻までビジーウェイトで精度を確保
      while (Date.now() < next.time) {
        await new Promise(setImmediate);
      }

      await precisePost(next.data, next.name);
      await sleep(2000); // 連続投稿防止

    } catch (err) {
      console.error("ループ内でエラーが発生しました:", err.message);
      await sleep(5000);
    }
  }
}

loop();