# ProtoAlign · 原型对齐助手

面向初阶 AI 产品经理的 Issue 闭环 Agent——帮助产品经理在原型交付研发前，将散落在客户反馈、研发约束和多个版本中的关键问题，转化为有证据、有位置、有决定、可验证的处理闭环。

## 它是如何工作的

ProtoAlign 不是一个通用点评工具。它是一个驻留在项目中的 Agent，持续维护"资料原文 → 原型 DOM 位置 → Issue → 人的决定 → 新版本复检"的证据链。

- **不是一次性点评**：Agent 根据当前项目自主检索资料、检查原型、比较版本，把每次工具行动保存为可审计记录
- **不是黑箱输出**：每条 Issue 必须引用资料原文或渲染后 DOM，带版本、页面、区域、选择器和验证条件
- **不替代人的判断**：AI 只生成草稿和复检建议，需求确认、风险接受、Issue 关闭始终由产品经理完成

### Agent 架构：双层循环

```text
                        ┌──────────────────────────┐
                        │  输入：项目资料 + 原型版本  │
                        │  sources  ·  prototype   │
                        │  feedback  ·  project goal│
                        └────────────┬─────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                    外层 Harness（确定性闭环）                        │
│                                                                    │
│  导入资料 ──→ 建立上下文 ──→ 评审当前版本 ──→ 生成 Issue 草稿        │
│                                      │                            │
│                                      ▼                            │
│  形成研发就绪建议 ←── 按验证条件复检 ←── 导入新版本 ←── 记录人的决定  │
└────────────────────────────────────────────────────────────────────┘
                                     │
              ┌──────────────────────┘
              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    内层 Agent Loop（受约束 ReAct）                   │
│                                                                    │
│      ┌─→ Think（模型自主判断下一步）──→ Act（调用真实工具）           │
│      │                                     │                      │
│      └────────── Observe（读取工具结果）←───┘                      │
│                                                                    │
│      最多 8 轮  ·  parallelToolCalls: false  ·  thinking: disabled │
│      模型：deepseek-v4-pro  ·  SDK：OpenAI Agents                   │
└────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Agent 工具集合（MVP）                        │
│                                                                    │
│  search_sources    inspect_prototype    list_prototype_pages       │
│  按关键词检索       读取 DOM、控件、      列出已采集页面              │
│  项目文本资料       可见文字与选择器       供 Agent 决定检查范围       │
│                                                                    │
│  save_issue_draft  save_claim_draft     request_clarification      │
│  保存带证据的       保存待确认主张        证据不足时                  │
│  Issue 草稿        （引用原文位置）       精准提问产品经理            │
│                                                                    │
│  compare_versions  save_verification    get_issue_context          │
│  对照新旧版本       保存复检结论          读取历史问题、证据、决定     │
│  DOM 文本与控件     （仅复检模式可用）      （仅复检模式可用）         │
└────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                     四个人工确认节点（Agent 不可越过）                 │
│                                                                    │
│  ① 需求与约束基线确认    ② 冲突与重要取舍确认                        │
│  ③ 外部角色结论记录      ④ 问题关闭及最终交付确认                     │
└────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────┐
                        │  输出：Issue 闭环 + 证据链  │
                        │  研发就绪建议 + 审计记录    │
                        └──────────────────────────┘
```

## 数据模型

```text
Project 项目
├── Prototype Version 原型版本（被评审和比较的对象）
├── Source 项目资料（需求 / 反馈 / 会议纪要 / 决策记录）
├── Claim 结构化主张（目标 / 事实 / 约束 / 待确认项）
└── Issue 问题
    ├── Evidence Link 关联证据（资料原文或原型 DOM）
    ├── Prototype Location 版本 / 页面 / 区域 / 选择器
    ├── Decision 人的决定与理由
    ├── Verification Criteria 验证条件
    └── Status Event 状态与审计历史
```

## 技术栈

| 层级 | 方案 |
|------|------|
| 前后端框架 | Next.js 16 (App Router) + TypeScript |
| Agent Harness | OpenAI Agents SDK (`@openai/agents`) |
| 核心模型 | DeepSeek V4 Pro（OpenAI 兼容 Chat Completions 接入） |
| 本地数据库 | SQLite (WAL + FTS5 全文检索) |
| 原型采集 | Playwright (Chromium headless · 渲染后 DOM + 全页截图) |
| 结构化校验 | Zod |
| 测试 | Vitest + Playwright |

## 已实现

- 空白项目创建、项目切换与上下文隔离
- 文本资料录入（手工 / TXT / Markdown / HTML）、角色反馈录入
- 原型导入（可访问 URL / 单文件 HTML / 静态构建 ZIP）
- Playwright DOM 采集 + 采集质量诊断（可评审 / 疑似登录 / 加载空壳 / 失败）
- DeepSeek Agent 真实工具调用循环（search_sources → inspect_prototype → save_issue_draft）
- Issue 与证据、版本、页面位置的关联 + 跨版本复检
- 产品经理基线确认、Issue 状态管理（四人工确认节点）
- 项目内重复初评 Run 比较（共同主题 / 独有问题 / 证据波动 / 稳定性标签）
- Agent 活动记录（真实工具调用、参数、结果、耗时，不含思维链）
- 公网演示模式（Basic Auth + 每日 Agent 额度 + Cloudflare Quick Tunnel）

## 暂未实现

PDF 解析 / OCR / 音频转写、Figma API、多页面自动爬取与登录态采集、视觉模型理解、正式用户认证、云数据库与生产部署。

## 本地运行

```bash
npm install
npx playwright install chromium
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY
npm run dev                   # http://localhost:3000
```

## 公网临时演示

```bash
brew install cloudflared
cp .env.demo.local.example .env.demo.local  # 设置访问密码和每日额度
npm run share:demo
```

脚本会生成一个 `*.trycloudflare.com` 临时 HTTPS 链接，用户名 `protoalign`，密码来自 `.env.demo.local`。电脑和终端需保持在线。

## 验证

```bash
npm run typecheck
npm test
npm run test:e2e
npm run verify:prototype
```

## 许可

MIT
