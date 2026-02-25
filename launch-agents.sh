#!/bin/bash
# Auto-pairing Sub-Agent Launcher
# 自动尝试多种方式启动 Sub-Agent

export OPENCLAW_GATEWAY_URL="ws://127.0.0.1:18789"

echo "🔧 Sub-Agent 自启动程序"
echo "========================"

# 1. 检查 Gateway 状态
echo "→ 检查 Gateway..."
if ! curl -s http://127.0.0.1:18789/health > /dev/null 2>&1; then
    echo "⚠️ Gateway 未响应，尝试启动..."
    openclaw gateway restart
    sleep 3
fi

# 2. 尝试配对
echo "→ 尝试配对 Gateway..."
openclaw pair --gateway 127.0.0.1:18789 --auto-accept 2>/dev/null || true

# 3. 启动 Spec Agent
echo "→ 启动 Spec Agent..."
openclaw session spawn \
    --task "你是 Spec Agent（架构师）。你的职责：1) 分析需求并设计技术方案 2) 输出 implementation_plan.md 3) 只做设计，不编码。等待任务分配。收到此消息立即回复：'Spec Agent 已就绪'" \
    --label spec \
    --timeout 3600 &

SPEC_PID=$!

# 4. 启动 Vibe Agent  
echo "→ 启动 Vibe Agent..."
openclaw session spawn \
    --task "你是 Vibe Agent（执行者）。你的职责：1) 根据 Spec 的设计实现代码 2) 输出 walkthrough.md 3) 只编码，不设计。等待 Spec 的设计方案。收到此消息立即回复：'Vibe Agent 已就绪'" \
    --label vibe \
    --timeout 3600 &

VIBE_PID=$!

echo ""
echo "✅ Sub-Agent 启动中..."
echo "   Spec PID: $SPEC_PID"
echo "   Vibe PID: $VIBE_PID"
echo ""
echo "检查状态: openclaw sessions list"
