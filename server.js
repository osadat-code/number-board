const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'state.json');
const BOARD_SIZE = 55;
const MAX_SLOTS = 4;

app.use(express.json());
app.use(express.static('public'));

// ------------------------------
// 状態ロード / 保存
// ------------------------------
function loadState() {
  if (!fs.existsSync(DB_FILE)) {
    const init = {
      remaining: Array(BOARD_SIZE + 1).fill(MAX_SLOTS),
      owners: Object.fromEntries([...Array(BOARD_SIZE + 1).keys()].map(n => [n, []])),
      logs: [],
      lastUpdate: Date.now(),
      status: "投稿待ち",
      maintUsed: []
    };
    init.remaining[0] = -1;
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }

  const st = JSON.parse(fs.readFileSync(DB_FILE));
  if (!st.maintUsed) st.maintUsed = [];
  return st;
}

function saveState(st) {
  fs.writeFileSync(DB_FILE, JSON.stringify(st, null, 2));
}

// ------------------------------
// API: 現在の状態
// ------------------------------
app.get('/state', (req, res) => {
  res.json(loadState());
});

// ------------------------------
// API: 投稿
// ------------------------------
app.post('/post', (req, res) => {
  const { mode, numbers, user } = req.body;
  let state = loadState();

  const newRemaining = state.remaining.slice();
  const owners = JSON.parse(JSON.stringify(state.owners));
  const results = [];
  const uname = user || '匿名';

  if (mode === 'inc') {
    numbers.forEach(n => {
      if (newRemaining[n] < MAX_SLOTS) {
        newRemaining[n]++;
        owners[n].push(uname);
        results.push({ type: 'inc', number: n, ok: true });
      } else {
        results.push({ type: 'inc', number: n, ok: false });
      }
    });
  }

  else if (mode === 'take') {
    numbers.forEach(n => {
      if (owners[n].includes(uname)) {
        results.push({ number: n, ok: false, reason: 'dup' });
      } else if (newRemaining[n] > 0) {
        newRemaining[n]--;
        owners[n].push(uname);
        results.push({ number: n, ok: true });
      } else {
        results.push({ number: n, ok: false });
      }
    });
  }

  else if (mode === 'set0') {
    numbers.forEach(n => {
      newRemaining[n] = 0;
      owners[n] = [];
      results.push({ type: 'set0', number: n, ok: true });
    });
  }

  const now = Date.now();
  state = {
    ...state,
    remaining: newRemaining,
    owners,
    logs: [
      { id: now, at: now, user: uname, results },
      ...state.logs
    ].slice(0, 300),
    lastUpdate: now
  };

  saveState(state);
  res.json(state);
});

// ------------------------------
// API: ステータス変更
// ------------------------------
app.post('/setStatus', (req, res) => {
  const { status } = req.body;
  const state = loadState();

  state.status = status;
  state.lastUpdate = Date.now();

  saveState(state);
  res.json(state);
});

// ------------------------------
// API: お休み管理 実行済み記録
// ------------------------------
app.post('/maintMark', (req, res) => {
  const { name } = req.body;
  const state = loadState();

  if (!state.maintUsed.includes(name)) {
    state.maintUsed.push(name);
  }

  state.lastUpdate = Date.now();
  saveState(state);
  res.json(state);
});

// ------------------------------
// API: 投稿取り消し（ログから）
// ------------------------------
app.post('/undo', (req, res) => {
  const { id, user } = req.body;
  let state = loadState();

  const log = state.logs.find(l => l.id === id);
  if (!log) return res.status(404).json({ error: "ログが見つかりません" });

  if (log.user !== user) {
    return res.status(403).json({ error: "投稿者本人のみ取り消せます" });
  }

  const remaining = state.remaining.slice();
  const owners = JSON.parse(JSON.stringify(state.owners));

  for (const r of log.results) {
    const n = r.number;

    if (r.type === 'inc') {
      if (remaining[n] > 0) remaining[n]--;
      owners[n] = owners[n].filter(u => u !== user);
    }

    else if (r.ok && r.reason !== 'dup') {
      if (remaining[n] < MAX_SLOTS) remaining[n]++;
      owners[n] = owners[n].filter(u => u !== user);
    }
  }

  state.logs = state.logs.filter(l => l.id !== id);

  state.remaining = remaining;
  state.owners = owners;
  state.lastUpdate = Date.now();

  saveState(state);
  res.json(state);
});

// ------------------------------
// API: 全リセット
// ------------------------------
app.post('/reset', (req, res) => {
  const rem = Array(BOARD_SIZE + 1).fill(0);
  rem[0] = -1;

  const owners = Object.fromEntries([...Array(BOARD_SIZE + 1).keys()].map(n => [n, []]));
  const now = Date.now();

  const state = {
    remaining: rem,
    owners,
    logs: [
      {
        id: now,
        at: now,
        user: 'SYSTEM',
        results: [{ type: 'reset', ok: true }]
      }
    ],
    lastUpdate: now,
    status: "準備中",
    maintUsed: []
  };

  saveState(state);
  res.json(state);
});

// ------------------------------
// マッピング対応
// ------------------------------
app.get('/mapping', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mapping.html'));
});

// =====================================================
// ★ 追加：自動投稿設定 API
// =====================================================
const CONFIG_FILE = path.join(__dirname, "autoConfig.json");

app.get("/autoConfig", (req, res) => {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE));
  res.json(cfg);
});

app.post("/autoConfig", (req, res) => {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// =====================================================
// ★ 追加：高精度スケジューラ起動
// =====================================================
require("./autoPoster");

// ------------------------------
// サーバ起動
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});