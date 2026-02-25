# Mobile Agent 构建故障排除

## 常见错误及解决方案

### 错误 1：gradlew 权限问题

**症状**：`Permission denied` 或 `gradlew: not found`

**修复**：
```yaml
# 在 workflow 中添加
- name: Make gradlew executable
  run: chmod +x android/gradlew
```

✅ 已添加

---

### 错误 2：Android SDK 未找到

**症状**：`Android SDK not found` 或 `sdk.dir not found`

**修复**：

创建 `android/local.properties`：
```bash
# GitHub Actions 中已预装 Android SDK，通常不需要
# 但如果需要，添加：
- name: Setup Android SDK
  uses: android-actions/setup-android@v2
```

---

### 错误 3：Gradle 版本不匹配

**症状**：`Could not find gradle` 或版本错误

**修复**：

检查 `android/gradle/wrapper/gradle-wrapper.properties`：
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.0.1-all.zip
```

---

### 错误 4：缺少 react-native 配置

**症状**：`Cannot find module` 或 Metro 错误

**修复**：

确保 `metro.config.js` 存在：
```javascript
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const config = {};
module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

---

### 错误 5：签名配置问题（Release 构建）

**症状**：`Keystore file not found` 或签名错误

**修复**：
使用 Debug 构建（不需要签名）：
```bash
./gradlew assembleDebug  # 而不是 assembleRelease
```

✅ 已修改为 Debug 构建

---

## 🔍 查看详细错误日志

在 GitHub Actions 页面：
1. 点击 ❌ 失败的构建
2. 点击 **"Build Android APK"** 步骤
3. 查看红色错误信息
4. 复制错误内容给我

---

## 🚀 快速修复命令

如果需要在本地测试构建：

```bash
cd /Users/ouyansufen/.openclaw/workspace-coder/mobile-agent/MobileAgent

# 清理
rm -rf node_modules android/app/build
npm install

# 检查 gradle
cd android
./gradlew clean
./gradlew assembleDebug
```

---

## 📝 常见错误代码

| Exit Code | 含义 | 解决方案 |
|-----------|------|----------|
| 1 | 一般错误 | 查看日志 |
| 126 | 权限错误 | chmod +x gradlew |
| 127 | 命令未找到 | 检查路径 |
| 137 | 内存不足 | 减少并行任务 |

---

请复制 GitHub Actions 的完整错误日志给我！
