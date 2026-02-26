# GitHub Actions 自动构建

## 🚀 自动触发条件

- **Push 到 main/develop 分支** → 自动构建 Debug APK
- **打 Tag (v*)** → 自动构建 Release APK 并发布
- **手动触发** → 可选择构建类型

## 📦 获取 APK

### 方式1：GitHub Actions Artifacts
1. 打开 [Actions 页面](../../actions)
2. 选择最新的 workflow 运行
3. 下载 `app-debug` 或 `app-release` artifact

### 方式2：Releases 页面
1. 打开 [Releases 页面](../../releases)
2. 下载对应版本的 APK

## 🔧 手动触发构建

1. 进入 [Actions](../../actions/workflows/build-android.yml)
2. 点击 **Run workflow**
3. 选择构建类型：`debug` 或 `release`
4. 点击 **Run workflow**

## 🔐 Release 签名配置（可选）

如需签名 Release APK，在仓库 Settings → Secrets 添加：

| Secret Name | 说明 |
|-------------|------|
| `KEYSTORE_PASSWORD` | 密钥库密码 |
| `KEY_ALIAS` | 密钥别名 |
| `KEY_PASSWORD` | 密钥密码 |

上传密钥文件：
```bash
# 生成密钥
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# 转换为 base64 上传到 secrets（可选）
base64 my-release-key.keystore | pbcopy
```

## 📱 安装 APK

```bash
# 通过 adb 安装
adb install app-debug.apk

# 或传输到手机安装
```
