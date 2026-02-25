# OpenClaw 改造实施计划

## 概述

基于对 30+ AI 工具系统提示的深度分析，本计划分5个阶段改造 OpenClaw，提升其 Agent 能力、工具系统、记忆管理和任务执行效率。

---

## Phase 1: 工具定义升级

### 目标
优化所有工具的 JSON Schema 定义，添加解释参数和摘要字段。

### 具体任务

#### 1.1 添加 `explanation` 参数到所有工具
```json
{
  "description": "一句话说明为什么调用此工具，如何贡献目标",
  "type": "string"
}
```

**受影响工具**:
- `read`
- `edit`
- `write`
- `exec`
- `web_search`
- `web_fetch`
- `browser`
- `canvas`
- `message`
- `voice_call`
- `tts`
- `image`
- `feishu_*` 系列

#### 1.2 优化工具描述格式
**当前格式**:
```json
{
  "description": "Read file contents"
}
```

**优化后格式**:
```json
{
  "description": "读取文件内容。支持文本文件和图片。\n使用场景：需要查看文件内容时\n注意事项：大文件会被截断，使用 offset/limit 分块读取"
}
```

#### 1.3 添加 `toolSummary` 字段
```json
{
  "toolSummary": {
    "description": "2-5词概括，如 'reading config', 'searching web'",
    "priority": "first"
  }
}
```

#### 1.4 参数分组和约束
- 添加 `enum` 约束（如 `browser.action`）
- 明确 `default` 值
- 添加参数间的依赖关系说明

### 实施步骤
1. **调研阶段**: 列出所有工具及其参数
2. **设计阶段**: 编写新的 Schema 定义
3. **实现阶段**: 更新 OpenClaw 核心代码
4. **测试阶段**: 验证工具调用正常

### 预期成果
- 工具定义符合行业标准
- LLM 调用工具时自动提供 explanation
- 更好的工具选择准确性

---

## Phase 2: Agent Loop 实现

### 目标
实现迭代式 Agent 执行模型，单次迭代单工具调用。

### 当前问题
OpenClaw 目前是多工具并行调用模式，缺乏中间反馈和迭代能力。

### 具体任务

#### 2.1 设计 Agent Loop 架构
```
Event Stream → Analyze → Select Tool → Execute → Observe → Iterate
                                    ↓
                              Complete → Submit Result
```

#### 2.2 实现事件流系统
```typescript
interface AgentEvent {
  id: string;
  type: 'user_message' | 'tool_result' | 'system_event';
  content: any;
  timestamp: number;
}

interface AgentState {
  events: AgentEvent[];
  currentTask: Task | null;
  iterationCount: number;
  maxIterations: number;
}
```

#### 2.3 实现单工具调用模式
- 禁用并行工具调用
- 每次只执行一个工具
- 等待结果后再决定下一步

#### 2.4 添加待机状态管理
```typescript
enum AgentStatus {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  EXECUTING = 'executing',
  WAITING = 'waiting',
  COMPLETED = 'completed'
}
```

#### 2.5 迭代控制机制
- 最大迭代次数限制（默认 50）
- 防止无限循环检测
- 用户可中断执行

### 配置选项
```json
{
  "agent": {
    "mode": "iterative",
    "maxIterations": 50,
    "allowParallel": false,
    "autoStandby": true
  }
}
```

### 预期成果
- 更可靠的复杂任务执行
- 可观察的中间步骤
- 更好的错误恢复能力

---

## Phase 3: 多 Agent 支持

### 目标
实现多 Agent 架构，支持任务委派和子 Agent。

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Session Agent                      │
│                      (用户对话入口)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
┌──────────────┐ ┌──────────┐ ┌────────────┐
│ Execution    │ │ Planning │ │ Specialized│
│ Agent        │ │ Agent    │ │ Agents     │
│ (工具执行)    │ │ (方案设计)│ │ (专项任务)  │
└──────────────┘ └──────────┘ └────────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
    ┌────────┐   ┌────────┐   ┌────────┐
    │ Trigger│   │ Memory │   │ Sub-   │
    │ Agent  │   │ Agent  │   │ agents │
    │(定时任务)│   │(记忆管理)│   │(子任务) │
    └────────┘   └────────┘   └────────┘
```

### 具体任务

#### 3.1 扩展 `sessions_spawn`
```typescript
interface SpawnOptions {
  agentId?: string;          // 指定 Agent 类型
  task?: string;             // 任务描述
  parentSession?: string;    // 父会话 ID
  inheritContext?: boolean;  // 是否继承上下文
  timeout?: number;          // 超时时间
}
```

#### 3.2 Agent 类型定义
```typescript
const AGENT_TYPES = {
  EXECUTOR: 'executor',      // 工具执行
  PLANNER: 'planner',        // 规划设计
  RESEARCHER: 'researcher',  // 信息收集
  CODER: 'coder',            // 代码编写
  DEBUGGER: 'debugger',      // 调试诊断
  TRIGGER: 'trigger'         // 定时任务
};
```

#### 3.3 Agent 间通信机制
```typescript
interface AgentMessage {
  from: string;      // 发送者 Agent ID
  to: string;        // 接收者 Agent ID
  type: 'request' | 'response' | 'event';
  content: any;
  correlationId: string;
}
```

#### 3.4 任务委派协议
```typescript
interface DelegationRequest {
  task: string;
  context: any;
  constraints: {
    maxIterations?: number;
    allowedTools?: string[];
    timeout?: number;
  };
}

interface DelegationResponse {
  success: boolean;
  result?: any;
  error?: string;
  logs: string[];
}
```

#### 3.5 Trigger Agent（定时任务）
```typescript
interface Trigger {
  id: string;
  type: 'cron' | 'event';
  condition: string;
  action: string;
  agentType: string;
  enabled: boolean;
}
```

### 使用示例
```javascript
// 主 Agent 委派任务给执行 Agent
const result = await sessions_spawn({
  agentId: 'executor',
  task: '搜索并总结今天的新闻',
  inheritContext: true,
  timeout: 120000
});

// 并行委派多个任务
const results = await Promise.all([
  sessions_spawn({ agentId: 'researcher', task: 'A' }),
  sessions_spawn({ agentId: 'researcher', task: 'B' })
]);
```

### 预期成果
- 复杂任务可分解为子任务
- 并行处理能力
- 专门的 Agent 处理特定任务类型

---

## Phase 4: 记忆系统重构

### 目标
实现结构化记忆系统，自动分类和智能检索。

### 当前问题
- MEMORY.md 是文本文件，难以结构化查询
- 缺乏记忆冲突检测
- 没有记忆优先级和过期机制

### 具体任务

#### 4.1 结构化记忆存储
```typescript
interface Memory {
  id: string;
  type: 'user_preference' | 'tech_stack' | 'project_structure' 
       | 'code_snippet' | 'architecture_decision' | 'milestone';
  title: string;
  content: string;
  tags: string[];
  corpusNames: string[];     // 关联的工作空间
  createdAt: number;
  updatedAt: number;
  accessCount: number;       // 访问次数（用于优先级）
  expiresAt?: number;        // 过期时间（可选）
  userTriggered: boolean;    // 是否用户主动创建
}
```

#### 4.2 记忆管理工具
```typescript
// create_memory 工具
interface CreateMemoryParams {
  action: 'create' | 'update' | 'delete';
  id?: string;              // update/delete 时需要
  type: MemoryType;
  title: string;
  content: string;
  tags?: string[];
  corpusNames?: string[];
  userTriggered?: boolean;
}

// search_memory 工具
interface SearchMemoryParams {
  query: string;
  type?: MemoryType;
  tags?: string[];
  limit?: number;
}
```

#### 4.3 自动分类机制
```typescript
function autoClassifyMemory(content: string): MemoryType {
  // 根据内容自动判断记忆类型
  if (content.includes('preference') || content.includes('prefer')) {
    return 'user_preference';
  }
  if (content.includes('package.json') || content.includes('依赖')) {
    return 'tech_stack';
  }
  // ... 更多规则
}
```

#### 4.4 记忆冲突检测
```typescript
interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts?: Array<{
    existingMemory: Memory;
    conflictType: 'contradiction' | 'redundancy' | 'overlap';
    suggestion: string;
  }>;
}
```

#### 4.5 记忆整合策略
```typescript
interface MemoryMergeStrategy {
  // 当发现相似记忆时，自动合并或更新
  shouldMerge: (existing: Memory, newMemory: Memory) => boolean;
  merge: (existing: Memory, newMemory: Memory) => Memory;
}
```

#### 4.6 记忆清理机制
- 定期清理过期记忆
- 归档低频访问记忆
- 删除重复/冗余记忆

### 数据迁移
```typescript
// 从旧的 MEMORY.md 迁移到新的结构化存储
async function migrateLegacyMemory(): Promise<void> {
  const legacyContent = await readFile('MEMORY.md');
  const memories = parseLegacyMemory(legacyContent);
  for (const memory of memories) {
    await createMemory({
      action: 'create',
      ...memory
    });
  }
}
```

### 预期成果
- 结构化记忆存储
- 智能检索和推荐
- 自动冲突检测与合并
- 记忆生命周期管理

---

## Phase 5: 任务管理增强

### 目标
添加 `task_boundary` 工具，实现三种工作模式，支持 Artifact 输出。

### 具体任务

#### 5.1 `task_boundary` 工具
```typescript
interface TaskBoundaryParams {
  taskName: string;          // 任务名称，如 "Planning Authentication"
  taskSummary: string;       // 任务摘要，描述目标
  taskStatus: string;        // 当前状态，描述下一步
  mode: 'PLANNING' | 'EXECUTION' | 'VERIFICATION';
}
```

**使用时机**:
- 任务开始时
- 模式切换时
- 任务完成时
- 每3-5个工具调用后

#### 5.2 三种工作模式

**PLANNING 模式**:
```typescript
{
  mode: 'PLANNING',
  tasks: [
    '研究代码库结构',
    '理解需求约束',
    '设计技术方案',
    '编写 implementation_plan.md'
  ],
  output: ['implementation_plan.md'],
  exitCriteria: '用户确认方案'
}
```

**EXECUTION 模式**:
```typescript
{
  mode: 'EXECUTION',
  tasks: [
    '按设计实现',
    '运行测试',
    '修复问题（最多3轮）'
  ],
  output: ['代码变更'],
  exitCriteria: '所有检查通过'
}
```

**VERIFICATION 模式**:
```typescript
{
  mode: 'VERIFICATION',
  tasks: [
    '运行 lint/type-check',
    '运行测试',
    '验证功能正确性',
    '编写 walkthrough.md'
  ],
  output: ['walkthrough.md', '验证报告'],
  exitCriteria: '所有质量门通过'
}
```

#### 5.3 Artifact 输出系统

**implementation_plan.md 格式**:
```markdown
# [Goal Description]

## User Review Required
> [!IMPORTANT]
> 需要用户确认的关键点

> [!WARNING]
> 潜在的破坏性变更

## Proposed Changes

### [Component Name]
#### [MODIFY] [file.tsx](file:///path/to/file.tsx)
#### [NEW] [new-file.ts](file:///path/to/new-file.ts)
#### [DELETE] [old-file.js](file:///path/to/old-file.js)

## Verification Plan
### Automated Tests
- 命令: `npm test`

### Manual Verification
- 用户需要验证的要点
```

**walkthrough.md 格式**:
```markdown
# Walkthrough: [Task Name]

## Changes Made
- 修改了哪些文件
- 实现了什么功能

## Testing
- 运行的测试
- 测试结果

## Validation Results
- 构建状态
- Lint 结果
- 测试覆盖率

## Screenshots/Videos
![描述](/path/to/screenshot.png)
```

#### 5.4 模式切换规则
```typescript
interface ModeTransition {
  from: Mode;
  to: Mode;
  condition: string;
}

const ALLOWED_TRANSITIONS: ModeTransition[] = [
  { from: 'PLANNING', to: 'EXECUTION', condition: '用户确认方案' },
  { from: 'PLANNING', to: 'PLANNING', condition: '需要重新设计' },
  { from: 'EXECUTION', to: 'VERIFICATION', condition: '实现完成' },
  { from: 'EXECUTION', to: 'PLANNING', condition: '发现设计问题' },
  { from: 'VERIFICATION', to: 'EXECUTION', condition: '小问题修复' },
  { from: 'VERIFICATION', to: 'PLANNING', condition: '需要重新设计' }
];
```

#### 5.5 进度检查点机制
```typescript
interface ProgressCheckpoint {
  toolCallCount: number;
  filesEdited: number;
  triggerCondition: string;
  action: string;
}

const CHECKPOINTS: ProgressCheckpoint[] = [
  { toolCallCount: 5, filesEdited: 0, triggerCondition: '5个工具调用后', action: '发送进度更新' },
  { toolCallCount: 0, filesEdited: 3, triggerCondition: '编辑3个文件后', action: '发送进度更新' }
];
```

### UI 集成
```typescript
// 在 Web Control UI 中显示任务边界
interface TaskBoundaryUI {
  currentTask: string;
  mode: Mode;
  progress: number;
  artifacts: string[];
}
```

### 预期成果
- 清晰的任务边界和进度可见性
- 用户可参与关键决策点
- 可追踪的实现过程
- 完整的交付物文档

---

## 实施优先级与依赖关系

```
Phase 1: 工具定义升级
    ↓
Phase 2: Agent Loop 实现 (依赖 Phase 1)
    ↓
Phase 3: 多 Agent 支持 (依赖 Phase 2)
    ↓
Phase 4: 记忆系统重构 (可并行)
    ↓
Phase 5: 任务管理增强 (依赖 Phase 2,3)
```

### 建议实施顺序
1. **Phase 1** → 立即可实施，风险低
2. **Phase 2** → 核心架构改动，需要充分测试
3. **Phase 4** → 可与 Phase 2/3 并行
4. **Phase 3** → 依赖 Agent Loop
5. **Phase 5** → 最后实施，依赖前面所有阶段

---

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 向后兼容性破坏 | 中 | 高 | 保留旧 API，提供迁移指南 |
| 性能下降 | 低 | 中 | 异步处理，缓存优化 |
| 用户学习成本 | 中 | 低 | 提供详细文档和示例 |
| 开发时间超预期 | 高 | 中 | 分阶段交付，MVP 优先 |

---

## 成功指标

- **工具调用准确率**: 提升 20%
- **复杂任务完成率**: 提升 30%
- **用户满意度**: > 4.5/5
- **平均任务时间**: 减少 15%
- **错误恢复成功率**: > 90%
