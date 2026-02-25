# 手动触发构建步骤

## 方法 1：GitHub 网页界面（推荐）

1. 打开 https://github.com/ouyangsvf/agent-android/actions
2. 点击左侧 "Build Mobile Agent APK"
3. 点击右侧 "Run workflow" 下拉按钮
4. 选择分支：main
5. 点击绿色 "Run workflow" 按钮
6. 等待 5-10 分钟构建完成

## 方法 2：命令行触发（需 GitHub CLI）

```bash
gh workflow run build-apk.yml --repo ouyangsvf/agent-android
```

## 方法 3：修复自动触发（推荐长期）

编辑 `.github/workflows/build-apk.yml`，修改触发条件：

```yaml
on:
  push:
    branches: [main]
    # 移除 paths 限制，任何推送都触发
  workflow_dispatch:
```

然后推送：
```bash
git add .github/workflows/build-apk.yml
git commit -m "Fix: trigger on any push"
git push origin main
```

---

## 构建完成后

1. 在 Actions 页面下载 Artifact
2. 或等待自动创建的 Release
3. 安装 APK 到手机

## 下一步

选择一种方法启动构建，完成后告诉我！
