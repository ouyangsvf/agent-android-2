# 多 Agent 协调工作流

## 快速指令

| 指令 | 作用 |
|------|------|
| `/spec 任务` | 交给 Spec 做设计 |
| `/vibe 任务` | 交给 Vibe 执行 |
| `/coordinate 任务` | 完整流程：Spec → Vibe |

## 手动启动方式

由于 Gateway 配对限制，Sub-agent 需手动启动：

### 方法1：新终端启动 Spec
```bash
openclaw session --label spec
# 然后粘贴任务描述
```

### 方法2：使用 agents 配置
我在当前会话中读取 agents/spec.md 或 agents/vibe.md 扮演对应角色。

## 当前状态
- ✅ Spec 配置就绪
- ✅ Vibe 配置就绪
- ⏳ 等待任务分配
