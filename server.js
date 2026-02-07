const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const DB_FILE = './state.json';
const BOARD_SIZE = 55;
const MAX_SLOTS = 4;

app.use(express.json());
app.use(express.static('public')); // ← public/index.html を配信

// ------------------------------
// 状態ロード / 保存
// ------------------------------
function loadState() {
  if (!fs.existsSync(DB_FILE)) {
    const init = {
      remaining: Array(BOARD_SIZE + 1).fill(MAX_SLOTS),
      owners: Object.fromEntries([...Array(BOARD_SIZE + 1).keys()].map(n => [n, []])),
      logs: [],
      lastUpdate: Date.now()
    };
    init.remaining[0] = -1;
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveState(st) {
  fs.writeFileSync(DB_FILE, JSON.stringify(st, null, 2));
}

// ------------------------------
// API: 現在の状態を返す
// ------------------------------
app.get('/state', (req, res) => {
  res.json(loadState());
});

// ------------------------------
// API: 投稿（通常 / 管理）
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
        results.push({ type: 'inc', number: n, ok: true });
      } else {
        results.push({ type: 'inc', number: n, ok: false });
      }
    });
  } else if (mode === 'take') {
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

  const now = Date.now();
  state = {
    remaining: newRemaining,
    owners,
    logs: [
      { at: now, user: uname, results },
      ...state.logs
    ].slice(0, 300),
    lastUpdate: now
  };

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
    logs: [{ at: now, user: 'SYSTEM', results: [] }],
    lastUpdate: now
  };

  saveState(state);
  res.json(state);
});

// ------------------------------
// サーバ起動
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
