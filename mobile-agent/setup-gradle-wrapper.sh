#!/bin/bash
# 创建完整的 Gradle Wrapper

mkdir -p /Users/ouyansufen/.openclaw/workspace-coder/mobile-agent/android/gradle/wrapper

# 创建 gradle-wrapper.properties
cat > /Users/ouyansufen/.openclaw/workspace-coder/mobile-agent/android/gradle/wrapper/gradle-wrapper.properties << 'EOF'
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.0.1-bin.zip
networkTimeout=10000
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF

# 下载 gradle-wrapper.jar
echo "下载 gradle-wrapper.jar..."
curl -L -o /Users/ouyansufen/.openclaw/workspace-coder/mobile-agent/android/gradle/wrapper/gradle-wrapper.jar \
  https://raw.githubusercontent.com/gradle/gradle/v8.0.1/gradle/wrapper/gradle-wrapper.jar

echo "✅ Gradle Wrapper 创建完成"
