#!/bin/bash
# Mobile Agent 推送脚本

cd /Users/ouyansufen/.openclaw/workspace-coder/mobile-agent

echo "🚀 推送到 GitHub..."

# 配置远程
git remote remove origin 2>/dev/null
git remote add origin https://github.com/ouyangsvf/agent-android-2.git
git branch -M main

# 推送
git push -u origin main

echo "✅ 完成！"
