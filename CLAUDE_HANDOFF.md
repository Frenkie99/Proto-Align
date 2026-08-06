# CLAUDE_HANDOFF.md — ProtoAlign 项目交接文档

> 本文档用于 Claude Code ↔ Codex 之间的开发上下文交接。每次重要阶段完成后更新。

---

## 1. 项目定位

**ProtoAlign（原型对齐助手）** 是一个面向初阶 AI 产品经理的 AI 原型评审工作台。

- **核心产品对象**：Issue（问题），不是原型
- **核心闭环**：资料原文 → 原型 DOM 位置 → Issue → 人的决定 → 新版本复检
- **形态**：以 Issue 生命周期为核心的项目评审工作台 + 对话式产品教练
- **目标用户**：初阶 AI 产品经理（MVP 为单人内部工具）
- **最终关口**：原型是否达到研发可开工状态
- **人保留权力**：需求确认、风险接受、Issue 关闭与最终交付判断

---

## 2. 当前产品架构

```
Project 项目
├── Prototype Version 原型版本（被评审和比较的对象）
├── Source 项目资料（原始证据）
│   ├── 需求 / PRD / 合同 / 流程图
│   ├── 客户 / 售前 / 研发 / 产品负责人反馈
│   ├── 会议纪要
│   └── 决策记录
├── Claim 结构化主张
│   ├── 目标 / 事实 / 需求 / 约束
│   ├── 承诺 / 建议 / 假设
│   └── 待确认项 / 冲突
└── Issue 问题
    ├── Evidence Link 关联证据
    ├── Prototype Location 版本 / 页面 / 区域
    ├── Decision 人的决定与理由
    ├── Verification Criteria 验证条件
    └── Status Event 状态与审计历史
```

**Issue 生命周期**：
```
发现问题 → 关联证据 → 定位原型位置 → 确认是否成立或存在冲突
→ 明确确认对象和处理方式 → 修改原型或记录取舍 → 导入新版本
→ 按验证条件复检 → 已解决 / 已延后 / 已接受风险 / 重新打开
```

**Agent 与人的边界**：
- Agent 负责：理解资料、提取主张、定位问题、发现遗漏冲突、比较版本、提出建议
- 人负责：确认基线、判断反馈成立、处理冲突、记录外部结论、批准关闭和交付
- 四个人工确认节点：需求基线确认、冲突取舍确认、外部角色结论记录、问题关闭及交付确认

---

## 3. 技术架构

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前后端框架 | Next.js 16.3.0 | App Router，React 19.2.8 |
| 语言 | TypeScript 5.9.3 | 全栈 |
| Agent Harness | OpenAI Agents SDK 0.14.3 | `@openai/agents` |
| 核心模型 | DeepSeek V4 Pro | 通过 OpenAI 兼容 Chat Completions 接入 |
| 本地数据库 | SQLite (better-sqlite3 13.0.3) | WAL 模式，FTS5 全文检索 |
| 浏览器自动化 | Playwright 1.62.1 | 原型 DOM 采集与截图 |
| 样式 | CSS Custom Properties | `app/globals.css`，无第三方 UI 库 |
| ZIP 处理 | fflate 0.8.2 | 解压静态构建 ZIP |
| 结构化校验 | Zod 4.4.3 | 工具参数与 API 输入校验 |
| 测试 | Vitest 4.1.10 + Playwright 1.62.1 | 单元测试 + E2E |

### 目录结构

```
原型评审智能体/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 入口页面 → Workbench
│   ├── globals.css               # 全局样式（约 320 行）
│   └── api/                      # API 路由
│       ├── projects/
│       │   ├── route.ts          # GET 列表 + POST 创建
│       │   └── [projectId]/
│       │       ├── route.ts      # GET 工作区数据
│       │       ├── sources/route.ts      # POST 导入资料
│       │       ├── prototypes/route.ts   # POST 导入原型
│       │       ├── claims/confirm/route.ts  # POST 确认基线
│       │       └── agent-runs/route.ts   # POST 启动 Agent
│       ├── issues/[issueId]/route.ts  # PATCH 更新问题状态
│       └── prototypes/[versionId]/
│           ├── screenshot/route.ts     # GET 采集截图
│           └── assets/[...assetPath]/route.ts  # GET 静态原型资源
├── components/workbench/         # 前端组件
│   ├── Workbench.tsx             # 主工作台（~330 行）
│   ├── IssueList.tsx             # 左侧问题列表
│   ├── ContextCanvas.tsx         # 中间画布（4 种视图）
│   ├── AgentPanel.tsx            # 右侧 Agent 面板
│   ├── SourceDrawer.tsx          # 资料导入抽屉
│   └── Modal.tsx                 # 通用弹窗
├── lib/
│   ├── types.ts                  # 全局 TypeScript 类型定义
│   ├── client-api.ts             # 浏览器端 API 封装
│   ├── core/                     # 前后端共享纯函数
│   │   ├── text.ts               # 文本切分、HTML→文本、ZIP 路径校验
│   │   ├── issues.ts             # Issue 状态规则（canResolveIssue）
│   │   ├── prototype-quality.ts  # 采集质量诊断（reviewable/login_required/loading_shell/failed）
│   │   ├── run-comparison.ts     # 两次 Run 的比较算法（主题匹配、稳定性评估）
│   │   ├── demo-projects.ts      # 公网精选项目策展
│   │   └── demo-security.ts      # Basic Auth、每日额度、内网地址检测
│   └── server/                   # 服务端专用
│       ├── db.ts                 # SQLite 初始化、Schema 迁移
│       ├── repository.ts         # 数据库 CRUD 操作（~330 行）
│       ├── agent.ts              # Agent 执行引擎（~260 行）
│       ├── ingestion.ts          # 资料与原型导入 + Playwright 采集
│       ├── http.ts               # 统一错误响应
│       ├── public-url.ts         # 公网 URL DNS 安全检查
│       └── static-assets.ts      # 上传原型的静态资源服务
├── tests/
│   ├── e2e/workbench.spec.ts     # 3 个 E2E 测试
│   ├── *.test.ts                 # 5 个单元测试文件
│   └── fixtures/v1.html          # 测试用原型
├── scripts/
│   ├── share-demo.mjs            # 公网演示启动脚本（Cloudflare Tunnel）
│   └── verify-prototype.mjs      # 冻结原型静态验证
├── docs/                         # 设计、架构、评估等参考文档
├── prototypes/
│   ├── current/                  # 当前选定原型 + 截图
│   └── archive/                  # 历史探索方案
├── data/                         # SQLite 数据库 + 上传文件（Git 忽略）
└── .stitch/DESIGN.md            # 设计系统定义
```

### 数据流

```
浏览器 → API Routes → lib/server/repository.ts → SQLite
                            ↕
                     lib/server/agent.ts → DeepSeek API
                            ↕
                     lib/server/ingestion.ts → Playwright
```

### Agent 工具集合（MVP）

- `search_sources`：FTS5 检索项目文本资料
- `list_prototype_pages`：列出已采集的原型版本
- `inspect_prototype`：读取渲染后 DOM、可见文字、交互控件
- `save_claim_draft`：保存结构化主张（等待人工确认）
- `save_issue_draft`：保存 AI 生成的 Issue 草稿
- `request_clarification`：证据不足时提出澄清问题
- `get_issue_context`（复检模式）：读取 Issue + 历史证据
- `compare_versions`（复检模式）：对比新旧版本 DOM 差异
- `save_verification`（复检模式）：保存跨版本复检结论

### 安全边界

- `DEEPSEEK_API_KEY` 仅服务端读取，不暴露给浏览器
- 用户上传的原型在受控浏览器中运行，外网请求被阻断
- 公网模式阻止 localhost/内网/保留 IP 的原型 URL
- 公网模式使用 Basic Auth + 每日 Agent 额度
- ZIP 路径穿越防护、文件大小限制

---

## 4. 已完成模块

### 里程碑 A：真实初次评审闭环 ✅

- [x] Next.js + TypeScript 全栈工程
- [x] SQLite 持久化：项目、资料（含 FTS5）、原型版本（含采集截图）、Issue、证据、决定、状态事件、Agent Run/Event
- [x] 创建空白项目（无预置 Issue）
- [x] 手工录入/上传 TXT、Markdown、HTML 文本资料
- [x] URL、单文件 HTML、静态 ZIP 三种原型导入方式
- [x] Playwright 渲染后 DOM 采集 + 全页截图
- [x] 采集质量分类（reviewable / login_required / loading_shell / failed）及门禁
- [x] DeepSeek Agent 真实工具调用（search_sources → list_prototype_pages → inspect_prototype → save_issue_draft）
- [x] 最多三条有证据的 Issue 草稿 + 结构化主张提取
- [x] 真实 Agent Run 记录、工具事件、参数摘要、耗时
- [x] API/模型失败时如实显示，不回退到虚拟结果
- [x] 刷新后数据持久化

### 里程碑 B：人工处理与跨版本验证 ✅

- [x] 产品经理确认/修正需求与约束基线
- [x] 问题状态变更（处理中/待澄清/已延后/已接受风险/已解决/重新打开）及操作依据
- [x] "已解决"门禁：仅当最新复检为"疑似已解决"时才允许
- [x] 导入新版本 → 真实 DOM 采集
- [x] Agent 跨版本复检（get_issue_context → compare_versions → save_verification）
- [x] 四种复检结果：疑似已解决/未解决/无法判断/引入新问题
- [x] 复检结论 + 版本差异证据 → 产品经理最终确认
- [x] 研发就绪建议自动计算（暂不可交付/有条件可交付/可以交付）

### 扩展能力 ✅

- [x] 项目内两次初评 Run 比较（共同主题、仅 A、仅 B、严重程度变化、证据波动、稳定性标签）
- [x] 稳定性结论标记"待人工确认"
- [x] 公网演示模式（Basic Auth、每日 Agent 额度、URL 安全边界）
- [x] Cloudflare Quick Tunnel 免费临时公网链接
- [x] 公开项目精选列表（3 个真实案例 + 本次会话新建项目）
- [x] 五分钟导览弹窗
- [x] 响应式三栏布局（桌面 → 平板 → 手机逐级降级）
- [x] 12 个单元测试 + 3 个 E2E 测试（含失败路径、采集质量门禁、路径穿越防护）
- [x] 冻结原型静态验证脚本

---

## 5. 未完成任务

### 暂不包含（产品已明确）

- [ ] PDF 解析 / OCR / 音频转写
- [ ] Figma / Axure API 读取
- [ ] 多页面自动爬取与登录态采集（安全设计已完成，见 `docs/architecture/authenticated-multipage-capture.md`）
- [ ] 视觉模型理解（截图对比）
- [ ] 正式用户认证与组织权限
- [ ] 云数据库与长期托管部署
- [ ] 后台持续自主运行
- [ ] 完整项目排期与资源管理
- [ ] 真实研发交付包导出

### 待确认项

- 是否使用 `ProtoAlign / 原型对齐助手` 作为最终对外名称
- 部署使用的云数据库与托管平台
- GitHub 仓库公开还是私有
- 静态构建 ZIP 在最终在线部署环境中的运行方式
- 需求基线在首页中的最终显化程度
- PDF 文本、截图 OCR 的实际支持深度
- 是否增加独立多模态模型做视觉比较
- 三个精选案例是否迁移到正式托管数据库
- 是否增加一页 PDF 项目说明

---

## 6. 当前开发状态

- **版本**：0.1.0
- **分支**：main（clean）
- **最近提交**：d801ef2 "Prepare curated interview demo"
- **环境配置**：
  - `.env.local`：本地 DEEPSEEK_API_KEY
  - `.env.demo.local`：演示密码、额度、精选项目 ID（Git 忽略）
  - `.env.demo.local.example`：模板文件
  - `.env.example`：本地开发模板
- **数据库**：`data/protoalign.db`（Git 忽略），已有 3 个精选案例的真实数据
- **验证状态**（最近一次基线 `1e29860`）：
  - typecheck ✅
  - 12 个单元测试 ✅
  - 3 个 E2E 测试 ✅
  - 生产构建 ✅
  - 冻结原型校验 ✅
  - 高等级依赖审计 ✅
- **本地运行**：`npm run dev` → http://localhost:3000
- **公网演示**：`npm run share:demo` → Cloudflare Tunnel 临时链接

---

## 7. 修改记录

| 日期 | 说明 |
|------|------|
| 2026-08-06 | Claude 接管项目，创建 CLAUDE_HANDOFF.md，完成全面代码审查 |

---

## 8. 下一步建议

1. **最优先**：确认待确认的产品决策（名称、部署平台、数据库选型）
2. **部署适配**：将 SQLite 替换为云数据库（Turso/PlanetScale/Neon），增加正式鉴权
3. **演示准备**：确保三个精选案例能支撑面试演示，录屏与在线体验就绪
4. **PDF 支持**：如面试需要，增加 PDF 文本提取（pdf-parse 等）
5. **多页采集**：如演示需要展示更复杂原型，实现多页面爬取（安全设计已完成）

### 给后续开发者的启动指令

```
这是一个面试项目，所有已有实现都经过产品设计和迭代。
请先完整阅读项目根目录 README.md、AGENTS.md 和本文件。
不要擅自修改已有架构、产品逻辑或交互设计。
开发前先了解项目，改动后同步更新 CLAUDE_HANDOFF.md。
```
