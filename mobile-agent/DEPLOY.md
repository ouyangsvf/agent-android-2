# Mobile Agent - 快速部署指南

## 方案 1：使用 Expo (推荐，无需 Java)

### 步骤

```bash
# 进入 Expo 项目
cd /Users/ouyansufen/.openclaw/workspace-coder/mobile-agent-expo

# 启动开发服务器
npx expo start

# 然后：
# 1. 手机安装 "Expo Go" App (应用商店搜索)
# 2. 扫描终端显示的 QR 码
# 3. App 立即在手机上运行！
```

### 生成 APK (使用 EAS Build)

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录 Expo 账户 (免费注册)
eas login

# 构建 APK
eas build -p android --profile preview

# 构建完成后会提供下载链接
```

---

## 方案 2：使用 GitHub Actions 自动构建

创建 `.github/workflows/build.yml`:

```yaml
name: Build APK

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup JDK
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
          
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build APK
        run: cd android && ./gradlew assembleRelease
        
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-release
          path: android/app/build/outputs/apk/release/app-release.apk
```

然后 push 到 GitHub，Actions 会自动构建 APK。

---

## 方案 3：使用 Docker 构建

```bash
# 创建 Dockerfile
docker build -t mobile-agent-builder .
docker run -v $(pwd)/android/app/build/outputs:/outputs mobile-agent-builder
```

---

## 当前状态

| 组件 | 状态 |
|------|------|
| React Native 项目 | ✅ 已创建 |
| 业务代码 | ✅ 已复制 |
| 依赖安装 | ✅ 完成 |
| Java JDK | ❌ 需要安装 |
| Android SDK | ✅ 需要配置 |

---

## 快速验证 (推荐)

**最快验证方式 - Expo：**

```bash
cd /Users/ouyansufen/.openclaw/workspace-coder/mobile-agent-expo
npx expo start
```

这样可以在**5分钟内**在手机上运行 App，无需 Java 或 Android SDK。

---

## 下一步

1. **立即体验**: 使用 Expo 方式运行
2. **正式发布**: 使用 EAS Build 或 GitHub Actions 生成 APK
3. **集成 OpenClaw**: 部署 cross-platform-agent 服务端
