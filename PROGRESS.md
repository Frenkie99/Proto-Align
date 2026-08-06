# 隔夜真实案例验证进度

- 目标：用三个公开真实 AI 产品完成六次独立初评，并验证一个可录制的 V1→V2 人工闭环。
- 顺序：基线 → 案例调研 → 六次初评 → 录制与复检 → 失败路径 → 修复与报告。
- 最大风险：公开产品可能要求登录、无法稳定本地运行，或 DeepSeek 在复杂真实输入上无法保存结构化结果。
- 2026-08-06 任务 0：已完整阅读 README、AGENTS 和既有开发进度。
- 基线：typecheck、4 个单测、原型验证、依赖审计、生产构建、1 个 E2E 均通过。
- 环境事件：初次 E2E 被既有 `next dev` 开发锁阻止，停止该服务后重跑通过；本地产品已恢复至 http://localhost:3000。
- 案例：Customer Service Agents Demo（MIT，本地临时 UI）、OpenAgent（Apache-2.0，公开只读 Demo）、HuggingChat / Chat UI（Apache-2.0，公开首页）；来源和边界已记入 `docs/evaluation/cases.md`。
- 六次成功初评：客服、OpenAgent、HuggingChat 各两次；每次均保存 `deepseek-v4-pro` Run、资料检索、DOM 检查、Issue 与证据。Open Canvas（已下线）和 DocsGPT（仅 Spinner）作为淘汰候选保留真实失败证据，不计入六次。
- 代表闭环：已录制 Customer Service V1→人工处理中→基于真实项目的 V2→真实复检“疑似已解决”→产品经理关闭；视频与截图在 `.artifacts/overnight/`，时长 54.08 秒、1440×900、已实际播放验证。
- 失败路径：空资料、路径穿越 ZIP、不可访问 URL、缺少密钥、无效模型地址和刷新持久化已真实验证；新增 E2E 回归覆盖前五项和故障后恢复。
- 最终回归：typecheck、4 个单测、2 个端到端测试、生产构建、冻结原型验证和高等级依赖审计均通过；视频已实际连续播放抽样确认。
- 提交状态：已提交本轮“Validate real AI product review loops”成果；`.artifacts/`、SQLite 数据库和第三方源码均被 Git 忽略，密钥扫描通过。
- 发布：已确认 GitHub SSH 身份为 `Frenkie99`，将以 SSH 推送到 `origin/main`。
