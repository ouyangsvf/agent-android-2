#!/bin/bash
# Mobile Agent v2.0 依赖安装脚本

echo "📱 Mobile Agent v2.0 - 安装脚本"
echo "================================"

cd "$(dirname "$0")"

echo ""
echo "📦 安装 npm 依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install 失败"
    exit 1
fi

echo ""
echo "🍎 安装 iOS Pods..."
if [ -d "ios" ]; then
    cd ios && pod install && cd ..
fi

echo ""
echo "🤖 配置 Android 权限..."
# 权限已在 AndroidManifest.xml 中配置

echo ""
echo "✅ 安装完成！"
echo ""
echo "运行方式:"
echo "  Android: npm run android"
echo "  iOS:     npm run ios"
