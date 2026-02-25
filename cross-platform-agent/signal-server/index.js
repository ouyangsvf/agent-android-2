const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Redis = require('ioredis');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Redis连接
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
});

// 在线设备存储（内存 + Redis）
const onlineDevices = new Map();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 中间件
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 设备注册/登录
app.post('/auth/register', async (req, res) => {
  const { deviceId, publicKey } = req.body;
  
  try {
    // 存储设备信息
    await pool.query(
      'INSERT INTO devices (id, public_key, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET public_key = $2, last_seen = NOW()',
      [deviceId, publicKey]
    );
    
    // 生成JWT
    const token = jwt.sign({ deviceId }, JWT_SECRET, { expiresIn: '365d' });
    
    res.json({ token, deviceId });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 获取设备公钥（用于X3DH握手）
app.get('/devices/:deviceId/public-key', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT public_key FROM devices WHERE id = $1',
      [req.params.deviceId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '设备不存在' });
    }
    
    res.json({ publicKey: result.rows[0].public_key });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

// WebSocket连接处理
wss.on('connection', async (ws, req) => {
  // 从URL获取token
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    ws.close(1008, 'Missing token');
    return;
  }
  
  try {
    // 验证JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    const deviceId = decoded.deviceId;
    
    console.log(`📱 设备连接: ${deviceId}`);
    
    // 存储连接
    onlineDevices.set(deviceId, {
      ws,
      deviceId,
      connectedAt: new Date(),
    });
    
    // 更新最后在线时间
    await pool.query(
      'UPDATE devices SET last_seen = NOW() WHERE id = $1',
      [deviceId]
    );
    
    // 广播设备上线
    broadcastDeviceList();
    
    // 处理消息
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        await handleWebSocketMessage(deviceId, message, ws);
      } catch (error) {
        console.error('消息处理错误:', error);
      }
    });
    
    // 处理断开
    ws.on('close', () => {
      console.log(`❌ 设备断开: ${deviceId}`);
      onlineDevices.delete(deviceId);
      broadcastDeviceList();
    });
    
    // 发送确认
    ws.send(JSON.stringify({
      type: 'connected',
      deviceId,
      timestamp: Date.now(),
    }));
    
  } catch (error) {
    console.error('认证失败:', error);
    ws.close(1008, 'Invalid token');
  }
});

// 处理WebSocket消息
async function handleWebSocketMessage(fromDeviceId, message, ws) {
  switch (message.type) {
    case 'signal':
      // 转发信令消息（SDP/ICE候选）
      await forwardSignal(fromDeviceId, message);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
      
    case 'get_devices':
      // 发送设备列表
      const devices = await getOnlineDevices();
      ws.send(JSON.stringify({
        type: 'device_list',
        devices,
      }));
      break;
      
    default:
      console.log('未知消息类型:', message.type);
  }
}

// 转发信令消息
async function forwardSignal(fromDeviceId, message) {
  const { to, signal } = message;
  
  const targetDevice = onlineDevices.get(to);
  
  if (targetDevice && targetDevice.ws.readyState === WebSocket.OPEN) {
    targetDevice.ws.send(JSON.stringify({
      type: 'signal',
      from: fromDeviceId,
      signal,
    }));
  } else {
    // 目标设备离线，存储待发送
    await redis.lpush(
      `pending_signals:${to}`,
      JSON.stringify({ from: fromDeviceId, signal, timestamp: Date.now() })
    );
    // 设置过期时间
    await redis.expire(`pending_signals:${to}`, 86400); // 24小时
  }
}

// 获取在线设备列表
async function getOnlineDevices() {
  const devices = [];
  
  for (const [deviceId, info] of onlineDevices) {
    // 查询数据库获取更多信息
    const result = await pool.query(
      'SELECT name, platform FROM devices WHERE id = $1',
      [deviceId]
    );
    
    devices.push({
      id: deviceId,
      name: result.rows[0]?.name || deviceId,
      platform: result.rows[0]?.platform || 'unknown',
      online: true,
      connectedAt: info.connectedAt,
    });
  }
  
  return devices;
}

// 广播设备列表给所有连接
async function broadcastDeviceList() {
  const devices = await getOnlineDevices();
  
  const message = JSON.stringify({
    type: 'device_list',
    devices,
  });
  
  for (const [deviceId, info] of onlineDevices) {
    if (info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(message);
    }
  }
}

// 初始化数据库
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        public_key TEXT,
        platform VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ 数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// 启动服务器
const PORT = process.env.PORT || 8080;

server.listen(PORT, async () => {
  console.log(`🚀 Signal Server 运行在端口 ${PORT}`);
  await initDatabase();
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('正在关闭服务器...');
  
  // 关闭所有WebSocket连接
  for (const [deviceId, info] of onlineDevices) {
    info.ws.close();
  }
  
  await pool.end();
  await redis.quit();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
