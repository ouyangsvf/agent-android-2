# Cross-Platform Agent - P2P版部署指南

## 🚀 一键部署

### 1. 环境准备

```bash
# 安装Docker和Docker Compose
curl -fsSL https://get.docker.com | sh

# 克隆项目
git clone https://github.com/your/cross-platform-agent.git
cd cross-platform-agent
```

### 2. 配置环境变量

```bash
cp .env.example .env

# 编辑 .env 文件
nano .env
```

**.env 内容示例**：
```env
# 安全密钥（必须修改！）
JWT_SECRET=your-super-secret-jwt-key-change-this
TURN_SECRET=your-turn-server-secret
DB_PASSWORD=your-database-password
REDIS_PASSWORD=your-redis-password

# 域名配置
DOMAIN=your-domain.com

# 可选：使用Let's Encrypt自动SSL
ENABLE_SSL=true
EMAIL=your-email@example.com
```

### 3. 启动服务

```bash
# 一键启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 检查状态
docker-compose ps
```

### 4. 验证部署

```bash
# 测试信令服务器
curl https://your-domain.com/health

# 预期输出
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

---

## 📱 客户端配置

### Android/iOS

1. 下载App（GitHub Releases）
2. 打开App，扫描服务器QR码或手动输入域名
3. 完成设备配对

### 桌面端

```bash
# macOS
docker-compose exec desktop pnpm build:mac

# Windows
docker-compose exec desktop pnpm build:win

# Linux
docker-compose exec desktop pnpm build:linux
```

---

## 🔧 高级配置

### 使用自己的域名和SSL

```bash
# 安装Certbot
apt-get install certbot

# 获取证书
certbot certonly --standalone -d your-domain.com

# 复制证书
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# 重启Nginx
docker-compose restart nginx
```

### 更新服务

```bash
# 拉取最新代码
git pull

# 重新构建
docker-compose build --no-cache

# 重启
docker-compose up -d
```

### 备份数据

```bash
# 备份数据库
docker-compose exec postgres pg_dump -U agent agent > backup.sql

# 备份配置
cp -r .env docker-compose.yml nginx/ backup/
```

---

## 🛠️ 故障排除

### 无法连接WebSocket

```bash
# 检查防火墙
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp

# 检查Nginx配置
docker-compose exec nginx nginx -t
```

### 数据库连接失败

```bash
# 检查PostgreSQL状态
docker-compose logs postgres

# 重置数据库（会丢失数据！）
docker-compose down -v
docker-compose up -d
```

### P2P连接失败（中继模式）

```bash
# 检查TURN服务器
docker-compose logs coturn

# 测试TURN
# 使用 https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
```

---

## 📊 监控

```bash
# 查看资源使用
docker stats

# 查看日志
docker-compose logs -f --tail=100

# 特定服务日志
docker-compose logs -f signal-server
```

---

## 🌐 多设备部署

可以部署多个实例形成集群：

```yaml
# docker-compose.override.yml
version: '3.8'

services:
  signal-server:
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis-cluster:6379
```

---

_部署完成！开始连接您的设备吧 🔗_
