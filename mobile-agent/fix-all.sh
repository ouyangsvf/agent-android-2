#!/bin/bash
# Mobile Agent 全面修复脚本

set -e

echo "🔧 Mobile Agent 全面修复"
echo "=========================="

# 1. 清理缓存
echo ""
echo "【1/7】清理缓存..."
npm cache clean --force 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
echo "✅ 缓存已清理"

# 2. 重新安装依赖
echo ""
echo "【2/7】重新安装依赖..."
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
echo "✅ 依赖已重装"

# 3. 检查并创建缺失文件
echo ""
echo "【3/7】检查配置文件..."

# gradle.properties
if [ ! -f "android/gradle.properties" ]; then
cat > android/gradle.properties << 'EOF'
# Project-wide Gradle settings
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m
org.gradle.configureondemand=true
org.gradle.daemon=true

# React Native
newArchEnabled=false
hermesEnabled=true

# Android
android.useAndroidX=true
android.enableJetifier=true
EOF
echo "✅ 创建 gradle.properties"
fi

# local.properties (示例)
if [ ! -f "android/local.properties" ]; then
cat > android/local.properties.example << 'EOF'
# 复制为 local.properties 并修改路径
sdk.dir=/Users/$(whoami)/Library/Android/sdk
ndk.dir=/Users/$(whoami)/Library/Android/sdk/ndk/23.1.7779620
EOF
echo "✅ 创建 local.properties.example"
fi

# proguard-rules.pro
if [ ! -f "android/app/proguard-rules.pro" ]; then
cat > android/app/proguard-rules.pro << 'EOF'
# ProGuard rules for React Native
-keep public class com.horcrux.svg.** {*;}
-keep class com.facebook.react.bridge.** { *; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
EOF
echo "✅ 创建 proguard-rules.pro"
fi

# 4. 修复 CI 缓存配置
echo ""
echo "【4/7】优化 CI 配置..."
cat > .github/workflows/build-android.yml << 'EOF'
name: Build Android APK

on:
  push:
    branches: [ main, develop ]
    tags:
      - 'v*'
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build-android:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'
        
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Clean npm cache
      run: npm cache clean --force
      
    - name: Install dependencies
      run: npm ci --legacy-peer-deps
      
    - name: Setup Gradle
      uses: gradle/gradle-build-action@v2
      with:
        gradle-version: '8.0.1'
        cache-read-only: false
        
    - name: Clean Gradle
      run: |
        cd android
        ./gradlew clean --no-daemon || true
      
    - name: Build Debug APK
      run: |
        cd android
        chmod +x gradlew
        ./gradlew assembleDebug --no-daemon --stacktrace
      
    - name: Upload Debug APK
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: app-debug
        path: android/app/build/outputs/apk/debug/*.apk
        if-no-files-found: warn
        retention-days: 30
EOF
echo "✅ CI 配置已优化"

# 5. Android 配置优化
echo ""
echo "【5/7】优化 Android 配置..."

# 更新 build.gradle 添加缺失配置
if ! grep -q "packagingOptions" android/app/build.gradle; then
cat >> android/app/build.gradle << 'EOF'

android {
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsc.so'
    }
}
EOF
echo "✅ 添加 packagingOptions"
fi

# 6. 创建 .npmrc 优化安装
echo ""
echo "【6/7】创建 npm 配置..."
cat > .npmrc << 'EOF'
legacy-peer-deps=true
engine-strict=false
EOF
echo "✅ 创建 .npmrc"

# 7. 最终检查
echo ""
echo "【7/7】最终检查..."
npm ls --depth=0 2>&1 | head -20
echo ""
echo "✅ 全部修复完成！"
echo ""
echo "📝 提交更改:"
echo "  git add -A"
echo "  git commit -m '全面修复: 缓存、配置、CI优化'"
echo "  git push origin main"
echo ""
echo "🚀 然后访问 Actions 查看构建状态:"
echo "  https://github.com/ouyangsvf/agent-android-2/actions"
