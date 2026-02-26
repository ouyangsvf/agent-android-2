const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 内存存储（无数据库依赖）
const onlineDevices = new Map();
const JWT_SECRET = process.env.JWT_SECRET || 'mobile-agent-local-secret';
const PORT = process.env.PORT || 8080;

app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: 'local-lite',
    devices: onlineDevices.size,
    timestamp: new Date().toISOString() 
  });
});

// 设备注册
app.post('/auth/register', (req, res) => {
  const { deviceId } = req.body;
  
  const token = jwt.sign({ deviceId }, JWT_SECRET, { expiresIn: '365d' });
  
  res.json({
    success: true,
    deviceId,
    token,
    message: 'Device registered (lite mode)'
  });
});

// WebSocket 连接
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const deviceId = url.searchParams.get('deviceId');
  const token = url.searchParams.get('token');
  
  // 验证 token
  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    ws.close(1008, 'Invalid token');
    return;
  }
  
  console.log(`📱 Device connected: ${deviceId}`);
  onlineDevices.set(deviceId, { ws, connectedAt: Date.now() });
  
  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'DEVICE_REGISTERED',
    deviceId,
    timestamp: Date.now()
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(deviceId, ws, message);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });
  
  ws.on('close', () => {
    console.log(`❌ Device disconnected: ${deviceId}`);
    onlineDevices.delete(deviceId);
  });
  
  ws.on('error', (err) => {
    console.error(`WebSocket error (${deviceId}):`, err);
  });
});

// 消息处理
function handleMessage(fromDeviceId, ws, message) {
  console.log(`📨 [${fromDeviceId}] ${message.type}`);
  
  switch (message.type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      break;
      
    case 'COMMAND':
      // 转发指令给目标设备
      const targetDevice = onlineDevices.get(message.targetDeviceId);
      if (targetDevice && targetDevice.ws.readyState === WebSocket.OPEN) {
        targetDevice.ws.send(JSON.stringify({
          type: 'COMMAND',
          fromDeviceId,
          payload: message.payload
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Target device offline'
        }));
      }
      break;
      
    case 'RESPONSE':
      // 转发响应给源设备
      const sourceDevice = onlineDevices.get(message.toDeviceId);
      if (sourceDevice && sourceDevice.ws.readyState === WebSocket.OPEN) {
        sourceDevice.ws.send(JSON.stringify(message));
      }
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

server.listen(PORT, () => {
  console.log(`🚀 Signal Server (Lite) running on port ${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
});
