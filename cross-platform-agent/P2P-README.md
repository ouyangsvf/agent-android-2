# Cross-Platform Agent - P2P + E2E Encryption Edition

端到端加密、P2P直连、无需信任服务器的跨平台Agent系统。

---

## 🌟 核心特性

| 特性 | 技术 | 说明 |
|------|------|------|
| **P2P直连** | WebRTC | 设备间直接通信，不经过服务器 |
| **端到端加密** | Signal Protocol | 消息仅收发双方可见 |
| **去中心化** | DHT/ mDNS | 本地网络自动发现 |
| **隐私保护** | 零知识架构 | 服务器无法解密任何内容 |

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     信令服务器 (仅用于握手)                    │
│                 不中转数据，只做连接撮合                        │
│                    (可自托管/可公共)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1. 交换SDP/ICE (加密)
                              │
        ┌─────────────────────┴─────────────────────┐
        ↓                                           ↓
┌─────────────────┐                      ┌─────────────────┐
│   手机 A         │◄──── WebRTC P2P ────►│   手机 B         │
│ (Android/iOS)   │   (DTLS+SRTP加密)    │ (Android/iOS)   │
└─────────────────┘                      └─────────────────┘
        │                                           │
        │ 2. Signal Protocol E2E                    │
        │    (Double Ratchet算法)                   │
        │                                           │
   ┌────▼────┐                                 ┌────▼────┐
   │ 加密消息  │                                 │ 解密消息  │
   └─────────┘                                 └─────────┘
```

---

## 📦 包含组件

```
.
├── docker-compose.yml          # 一键部署
├── signal-server/              # WebRTC信令 + 配对服务
├── mobile/                     # React Native App
├── desktop/                    # Tauri Desktop
├── shared/
│   ├── webrtc/                 # P2P连接管理
│   ├── signal/                 # Signal Protocol实现
│   └── crypto/                 # 加密工具
└── docs/
    └── deployment.md           # 部署指南
```

---

## 🚀 快速开始

```bash
# 1. 克隆并启动
git clone https://github.com/your/cross-platform-agent.git
cd cross-platform-agent
docker-compose up -d

# 2. 下载移动端App (GitHub Releases)
# Android: app-release.apk
# iOS: 通过TestFlight安装

# 3. 配对设备
# 扫描QR码或输入配对码
```

---

## 🔐 安全说明

- **信令服务器**：只转发加密后的SDP，无法解密内容
- **P2P连接**：WebRTC使用DTLS 1.2+加密
- **应用层**：Signal Protocol Double Ratchet算法
- **前向安全**：即使密钥泄露，历史消息安全

---

_版本: v2.0-P2P_
