const fs = require("fs");

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 次の実行予定時刻を計算
function getNextTarget(cfg) {
  const now = new Date();
  const t = new Date();
  t.setHours(cfg.hour, cfg.min, cfg.sec, cfg.ms);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t;
}

async function precisePost(cfg, slotName) {
  try {
    const res = await fetch("http://localhost:3000/post", {
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
    // 毎回最新の設定を読み込む
    const cfg = JSON.parse(fs.readFileSync("./autoConfig.json"));
    
    const now = Date.now();
    const t1 = getNextTarget(cfg.slot1).getTime();
    const t2 = getNextTarget(cfg.slot2).getTime();

    // 次に一番近い時刻を選択
    const next = t1 < t2 ? { time: t1, data: cfg.slot1, name: "slot1" } : { time: t2, data: cfg.slot2, name: "slot2" };
    
    const waitMs = next.time - now;
    console.log(`次の予定: ${next.name} (${new Date(next.time).toLocaleString()}) まであと ${Math.round(waitMs/1000)}秒`);

    // 1分以上ある場合は長く待機、近くなったら細かくチェック
    if (waitMs > 1000) {
      await sleep(waitMs - 500); // 0.5秒前まで待機
    }
    
    while (Date.now() < next.time) {
      // ミリ秒単位の精度を出すための空ループ（CPU負荷を抑えるため0ms待機）
      await new Promise(setImmediate);
    }

    await precisePost(next.data, next.name);
    await sleep(2000); // 連続投稿防止のため少し待つ
  }
}

loop();