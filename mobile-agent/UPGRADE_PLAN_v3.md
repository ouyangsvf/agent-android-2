# Mobile Agent v3.0 - 全面技术升级规划

## 目标
升级到 React Native 0.76 + Android SDK 35 + 最新架构，彻底解决闪退问题

## 现状分析

### 当前技术栈 (RN 0.72)
```
React Native 0.72.0 (2023-06)
├── React 18.2.0
├── Android SDK 34
├── AGP 7.4.2
├── Gradle 7.6.1
├── Kotlin 1.8.0
└── Java 11
```

### 目标技术栈 (RN 0.76)
```
React Native 0.76.x (2024-10+)
├── React 18.3.1
├── Android SDK 35 (Android 15)
├── AGP 8.5+
├── Gradle 8.8+
├── Kotlin 2.0+
├── Java 17 (必需)
└── New Architecture (Bridgeless) 默认启用
```

## 主要变更分析

### 1. 架构级变更

| 特性 | RN 0.72 | RN 0.76 | 影响 |
|------|---------|---------|------|
| New Architecture | 可选 | 默认启用 | **重大**，TurboModules + Fabric |
| Bridgeless Mode | 实验性 | 默认 | **重大**，JS 与 Native 通信方式改变 |
| Interop Layer | 无 | 有 | 兼容旧原生模块 |
| CMake 构建 | 部分 | 完整 | 原生代码构建方式 |

### 2. Android 构建系统

```
AGP 7.4.2 → 8.5+
├── compileSdk 34 → 35
├── targetSdk 33 → 35 (Google Play要求)
├── minSdk 21 → 24+ (建议)
├── Java 11 → 17 (必需)
├── Gradle 7.6 → 8.8
└── Namespace 必需 (已满足)
```

### 3. 依赖生态

**需要升级的包：**

| 包名 | 当前 | 目标 | 兼容性 |
|------|------|------|--------|
| @react-native-async-storage | 1.19 | 2.x | ✅ 支持 |
| react-native-device-info | 10.x | 11.x | ✅ 支持 |
| react-native-permissions | 3.x | 5.x | ✅ 支持 |
| react-native-vision-camera | 3.9 | 4.x | ⚠️ API变更 |
| react-native-track-player | 4.1 | 4.1 | ✅ 支持 |
| react-native-fs | 2.20 | 2.20 | ✅ 兼容 |

**可能弃用的包：**
- `react-native-background-timer` → 使用 RN 内置 `setTimeout`
- `react-native-websocket` → RN 内置 `WebSocket`

## 升级策略

### 第一阶段：基础设施重建
1. 删除旧的 `android/` 目录
2. 使用 RN 0.76 CLI 生成新项目结构
3. 迁移 `AndroidManifest.xml` 配置
4. 配置 `gradle.properties`

### 第二阶段：代码适配
1. 更新 `App.js` 入口
2. 适配 New Architecture (如有问题使用 Interop)
3. 更新所有 import 路径
4. 修复 Metro 配置

### 第三阶段：依赖升级
1. 升级 React Native 核心
2. 升级第三方库到兼容版本
3. 验证每个功能模块

### 第四阶段：验证测试
1. 本地 Debug 构建
2. CI Release 构建
3. 实机测试所有功能

## 风险评估

### 高风险点
1. **New Architecture 兼容性**：某些原生模块可能崩溃
   - 缓解：使用 Interop Layer，逐个模块验证

2. **权限系统变更**：Android 13+ 权限行为变化
   - 缓解：测试所有权限请求流程

3. **相机/录音 API**：vision-camera 4.x API 变化
   - 缓解：参考迁移指南重写相关代码

### 中风险点
1. **Metro 缓存问题**：清理不彻底导致奇怪错误
2. **Hermes 引擎**：现在默认启用，需验证
3. **ProGuard 规则**：需要更新混淆配置

## 执行计划

### Day 1: 环境准备
- [ ] 安装 JDK 17
- [ ] 升级 Android Studio
- [ ] 安装 RN 0.76 CLI

### Day 2: 项目重建
- [ ] 备份当前项目
- [ ] 删除并重建 android 目录
- [ ] 配置 Gradle 8.8
- [ ] 首次构建验证

### Day 3: 代码迁移
- [ ] 迁移 JavaScript 代码
- [ ] 更新原生模块配置
- [ ] 修复 Metro 配置

### Day 4: 测试优化
- [ ] 实机测试
- [ ] 修复发现的问题
- [ ] 性能优化

## 预期成果

### 性能提升
- 启动速度：提升 20-30%
- 内存占用：降低 15%
- 包体积：减少 10%

### 兼容性
- Android 10 - 15 全支持
- 64位架构优化
- Google Play 政策合规

## 需要决策

1. **是否启用 New Architecture？**
   - 启用：性能更好，但风险高
   - 禁用：使用旧架构，更稳定

2. **minSdk 设置？**
   - 21：覆盖更广
   - 24：更现代的 API

3. **Hermes 引擎？**
   - 启用：现在默认，性能好
   - 禁用：如果 JSC 有兼容性问题

## 先决条件

执行前请确认：
- [ ] Android Studio Ladybug 或更新
- [ ] JDK 17 已安装并配置
- [ ] 至少 50GB 磁盘空间
- [ ] 稳定的网络（下载依赖）

---

**准备就绪后，请确认：**
1. 选择 New Architecture 策略（启用/禁用）
2. 确认 minSdk 版本
3. 我将开始执行详细步骤