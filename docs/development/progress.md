# ProtoAlign MVP 开发进度

> 本文件只记录实现进度与验证证据；产品定义仍以根目录 `README.md` 为唯一权威版本。

## 2026-08-06

- [x] 完整核对 README、架构资料与已确认 HTML / 截图基线。
- [x] 将三栏工作台工程化为 Next.js + TypeScript 应用，补齐空项目、项目切换、资料抽屉、基线、版本、Issue、Agent 和移动端面板交互。
- [x] 实现 SQLite 持久化：Project、Source / Chunk、PrototypeVersion、Claim、Issue / Evidence、Decision / StatusEvent、Verification、AgentRun / Event。
- [x] 实现手工文本、TXT / Markdown / HTML、URL、单文件 HTML 和静态 ZIP 导入。
- [x] 使用 Playwright 在受控环境中采集渲染后 DOM、可见文字、控件、选择器和截图。
- [x] 通过 OpenAI Agents SDK 接入服务端 `deepseek-v4-pro`，实现资料检索、原型检查、主张 / Issue 草稿保存、问题上下文读取、版本比较和复检保存工具。
- [x] 实现模型 / 工具失败审计与草稿回滚；缺少密钥时不生成 Issue。
- [x] 实现人工确认基线、问题状态与理由、风险接受、延后、重新打开和关闭权限边界。
- [x] 用真实 DeepSeek 完成 V1 初评：模型连续调用资料检索、版本列举和 DOM 检查工具后，动态生成带双来源证据与选择器的阻塞 Issue。
- [x] 用真实 DeepSeek 完成 V1 → V2 复检：模型读取问题、比较版本并输出“未解决”及差异证据，未自动关闭问题。
- [x] 验证缺少 API Key 的失败路径、HTML / ZIP DOM 导入、刷新后的持久化和真实活动记录。
- [x] 将上传原型采集隔离到只映射该版本目录的虚拟站点，并验证 ZIP 内相对 CSS / JavaScript 可运行、外部网络仍被阻断。
- [x] 通过类型检查、单元测试、浏览器端到端测试、生产构建、原型静态验证和高等级依赖审计。
- [x] 使用 Customer Service Agents Demo、OpenAgent 和 HuggingChat / Chat UI 完成 6 次独立真实 DeepSeek 初评；完成 Customer Service V1→V2 桌面端录制、人工处理与真实复检，详见 `docs/evaluation/overnight-report.md`。
- [x] 将空资料、ZIP 路径穿越、不可访问 URL、缺少密钥、无效模型地址和持久化恢复纳入真实失败路径验证；新增端到端回归覆盖故障后有效导入与刷新。

发布检查已完成；本轮交付目标为提交并推送 `main`。
