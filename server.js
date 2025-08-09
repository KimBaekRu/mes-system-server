const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketio(server, { cors: { origin: '*' } });

const DATA_FILE = path.join(__dirname, 'equipments.json');
let equipments = [];

function loadEquipments() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      equipments = JSON.parse(data);
    }
  } catch (e) {
    equipments = [];
  }
}

function saveEquipments() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(equipments, null, 2), 'utf-8');
}

loadEquipments();

app.get('/api/equipments', (req, res) => {
  res.json(equipments);
});

app.post('/api/equipments', (req, res) => {
  const { name, iconUrl, x, y } = req.body;
  const newEq = { id: Date.now(), name, iconUrl, x, y, status: 'idle' };
  equipments.push(newEq);
  saveEquipments();
  io.emit('equipmentAdded', newEq);
  res.status(201).json(newEq);
});

app.put('/api/equipments/:id', (req, res) => {
  const id = +req.params.id;
  const idx = equipments.findIndex(eq => eq.id === id);
  if (idx === -1) return res.sendStatus(404);

  const updated = { ...equipments[idx], ...req.body };
  if (typeof req.body.x !== 'number') updated.x = equipments[idx].x;
  if (typeof req.body.y !== 'number') updated.y = equipments[idx].y;
  if (Array.isArray(req.body.maintenanceHistory)) {
    updated.maintenanceHistory = req.body.maintenanceHistory;
  }

  if (!Array.isArray(updated.history)) updated.history = [];
  updated.history.push({
    user: req.body.user || 'unknown',
    time: new Date().toISOString(),
    value: req.body.status !== undefined ? req.body.status : updated.status
  });

  equipments[idx] = updated;
  saveEquipments();
  io.emit('equipmentUpdated', equipments[idx]);
  res.json(equipments[idx]);
});

app.delete('/api/equipments/:id', (req, res) => {
  const id = +req.params.id;
  equipments = equipments.filter(eq => eq.id !== id);
  saveEquipments();
  io.emit('equipmentDeleted', id);
  res.sendStatus(204);
});

// === 공정명(processTitles) 데이터 및 파일 관리 ===
const PROCESS_FILE = path.join(__dirname, 'processTitles.json');
let processTitles = [];

function loadProcessTitles() {
  try {
    if (!fs.existsSync(PROCESS_FILE)) {
      fs.writeFileSync(PROCESS_FILE, '[]', 'utf-8');
    }
    const data = fs.readFileSync(PROCESS_FILE, 'utf-8');
    processTitles = JSON.parse(data);
  } catch (e) {
    console.error('processTitles 파일 로드 오류:', e);
    processTitles = [];
  }
}

function saveProcessTitles() {
  try {
    fs.writeFileSync(PROCESS_FILE, JSON.stringify(processTitles, null, 2), 'utf-8');
  } catch (e) {
    console.error('processTitles 파일 저장 오류:', e);
  }
}

loadProcessTitles();

app.get('/api/processTitles', (req, res) => {
  res.json(processTitles);
});

app.post('/api/processTitles', (req, res) => {
  const { title, x, y } = req.body;
  const newTitle = { id: Date.now(), title, x, y, history: [] };
  processTitles.push(newTitle);
  saveProcessTitles();
  res.status(201).json(newTitle);
});

app.put('/api/processTitles/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = processTitles.findIndex(t => Number(t.id) === id);
  if (idx === -1) return res.sendStatus(404);

  const updated = { ...processTitles[idx] };

  // ✅ 수정 포인트: 필요한 필드만 갱신
  if (typeof req.body.title === 'string') updated.title = req.body.title;
  if (typeof req.body.x === 'number') updated.x = req.body.x;
  if (typeof req.body.y === 'number') updated.y = req.body.y;
  if (req.body.yield !== undefined) updated.yield = req.body.yield;
  if (req.body.secondField !== undefined) updated.secondField = req.body.secondField; // ✅ 이 줄 추가됨
  if (Array.isArray(req.body.maintenanceHistory)) updated.maintenanceHistory = req.body.maintenanceHistory;
  if (Array.isArray(req.body.materialNames)) updated.materialNames = req.body.materialNames;
  if (req.body.lastSaved) updated.lastSaved = req.body.lastSaved;

  if (!Array.isArray(updated.history)) updated.history = [];
  if (req.body.yield !== undefined) {
    updated.history.push({
      user: req.body.user || 'unknown',
      time: new Date().toISOString(),
      value: req.body.yield
    });
  }

  processTitles[idx] = updated;
  saveProcessTitles();
  res.json(processTitles[idx]);
});

app.delete('/api/processTitles/:id', (req, res) => {
  const id = +req.params.id;
  processTitles = processTitles.filter(t => t.id !== id);
  saveProcessTitles();
  res.sendStatus(204);
});

// === 라인명(lineNames) 데이터 및 파일 관리 ===
const LINE_FILE = path.join(__dirname, 'lineNames.json');
let lineNames = [];

function loadLineNames() {
  try {
    if (!fs.existsSync(LINE_FILE)) {
      fs.writeFileSync(LINE_FILE, '[]', 'utf-8');
    }
    const data = fs.readFileSync(LINE_FILE, 'utf-8');
    lineNames = JSON.parse(data);
  } catch (e) {
    console.error('lineNames 파일 로드 오류:', e);
    lineNames = [];
  }
}

function saveLineNames() {
  try {
    fs.writeFileSync(LINE_FILE, JSON.stringify(lineNames, null, 2), 'utf-8');
  } catch (e) {
    console.error('lineNames 파일 저장 오류:', e);
  }
}

loadLineNames();

app.get('/api/lineNames', (req, res) => {
  res.json(lineNames);
});

app.post('/api/lineNames', (req, res) => {
  const { name, x, y } = req.body;
  const newLine = { id: Date.now(), name, x, y };
  lineNames.push(newLine);
  saveLineNames();
  res.status(201).json(newLine);
});

app.put('/api/lineNames/:id', (req, res) => {
  const id = +req.params.id;
  const idx = lineNames.findIndex(l => l.id === id);
  if (idx === -1) return res.sendStatus(404);
  const updated = { ...lineNames[idx] };
  if (typeof req.body.name === 'string') updated.name = req.body.name;
  if (typeof req.body.x === 'number') updated.x = req.body.x;
  if (typeof req.body.y === 'number') updated.y = req.body.y;
  lineNames[idx] = updated;
  saveLineNames();
  res.json(lineNames[idx]);
});

app.delete('/api/lineNames/:id', (req, res) => {
  const id = +req.params.id;
  lineNames = lineNames.filter(l => l.id !== id);
  saveLineNames();
  res.sendStatus(204);
});

// === 사용자(users) 파일 ===
const USERS_FILE = path.join(__dirname, 'users.json');
let users = [];

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      users = JSON.parse(data);
    }
  } catch (e) {
    users = [];
  }
}

loadUsers();

app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;
  const user = users.find(u => u.username === username && u.password === password && u.role === role);
  if (!user) return res.status(401).json({ error: '로그인 실패: 아이디, 비밀번호 또는 역할이 일치하지 않습니다.' });
  res.json({ username: user.username, role: user.role });
});

io.on('connection', socket => {
  console.log('클라이언트 연결:', socket.id);
  socket.emit('initialEquipments', equipments);
  socket.on('updateStatus', ({ id, status }) => {
    const eq = equipments.find(e => e.id === id);
    if (!eq) return;
    eq.status = status;
    io.emit('statusUpdate', { id, status });
  });
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`MES 백엔드 실행 중: http://localhost:${PORT}`);
});
