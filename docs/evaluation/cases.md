# 真实案例选择与输入台账

> 访问日期：2026-08-06。所有产品资料均来自公开仓库或公开演示；第三方源码只保存在 `/tmp`，不进入本仓库。

## 案例 A｜OpenAI Customer Service Agents Demo

- 产品类型：AI 客服 / 多 Agent 编排。
- V1 入口：`http://127.0.0.1:3101`（由公开仓库的 UI 在本机临时运行；仅供 DOM 采集）。
- 产品与资料：<https://github.com/openai/openai-cs-agents-demo>；[README](https://raw.githubusercontent.com/openai/openai-cs-agents-demo/main/README.md)。
- 许可证：MIT，见仓库 `LICENSE`。
- 产品目标：让客服请求路由到航班、改签、座位、FAQ 与补偿等专业 Agent，并展示编排和护栏状态。
- 评审范围：高风险取消操作的确认信息是否在界面及可追溯的 Agent 工作流中明确；护栏与 Agent 输出的可理解性。
- 可引用需求 / 反馈：README 的 Demo flow #2 要求取消前确认确认号和航班号；同一文档说明 UI 应展示 Agent orchestration 与 chat interface。
- 选择原因：有真实可运行的桌面 UI、明确的高风险人工确认要求和可定位的 Agent / Guardrails 区域，适合检验“资料 + DOM → Issue 证据”。
- 边界：仓库本身是官方 demo，回复后端需要独立 OpenAI 凭证；本评审不调用其后端，也不宣称验证了其回复质量。

## 案例 B｜OpenAgent

- 产品类型：个人 AI 助手 / 知识库与工具型 Agent。
- V1 入口：<https://demo.openagentai.org>（公开只读演示，无需账户）。
- 产品与资料：<https://github.com/the-open-agent/openagent>；[README](https://raw.githubusercontent.com/the-open-agent/openagent/master/README.md)。
- 许可证：Apache-2.0，见仓库 `LICENSE`。
- 产品目标：把 LLM、用户知识库和 Agent loop 放进可自托管工作台，支持浏览器、代码及 MCP 工具。
- 评审范围：知识库 / 工具权限与运行记录是否在桌面 UI 中足够可见，能否让用户理解 Agent 行动边界。
- 可引用需求 / 反馈：README 声明产品支持 knowledge base、browser、code、MCP 与详细日志；公开演示明确是 read-only tour。
- 选择原因：与 ProtoAlign 同属工具型 Agent 产品，适合验证资料检索与 DOM 检查是否能发现“可见性 / 可追溯性”问题。
- 边界：公开 Demo 为只读体验；不登录、不绕过访问控制，也不执行远程工具。

## 淘汰候选｜Open Canvas

- 产品类型：AI 协作内容生成 / 写作与代码 Canvas。
- V1 入口：<https://opencanvas.langchain.com>（公开网页版）。
- 产品与资料：<https://github.com/langchain-ai/open-canvas>；[README](https://raw.githubusercontent.com/langchain-ai/open-canvas/main/README.md)。
- 许可证：MIT，见仓库 `LICENSE`。
- 产品目标：提供带记忆、反思与可编辑 Canvas 的 AI 协作写作和编码体验。
- 评审范围：用户在生成、编辑、保存及恢复内容时是否获得足够的状态和控制信息；资料中承诺的协作 / 可编辑能力是否能在当前桌面 DOM 中定位。
- 可引用需求 / 反馈：README 描述 collaborative AI canvas、writing and coding，以及 memory / reflection；仓库公开列出可运行所需的外部服务。
- 淘汰原因：2026-08-06 的真实 DOM 采集显示“Demo is no longer live or maintained”，仅剩 GitHub 链接，无法观察任何生成、编辑、保存或恢复流程。已保留这一次真实 Run 作为外部原型不可用的证据，但不计入六次成功初评。

## 淘汰候选｜DocsGPT

- 产品类型：AI 文档问答 / 企业检索与 Agent Builder。
- V1 入口：<https://app.docsgpt.cloud>（公开云端桌面网页；不登录、不提交资料）。
- 产品与资料：<https://github.com/arc53/DocsGPT>；[README](https://raw.githubusercontent.com/arc53/DocsGPT/main/README.md)。
- 许可证：MIT，见仓库 `LICENSE`。
- 产品目标：让团队从文档、网页和内部工具中获得带来源的 AI 回答，并构建可行动的 Agent。
- 评审范围：来源引用、工具连接、权限与运行可观察性在桌面网页中的可见性。
- 可引用需求 / 反馈：README 声明回答应有可在 UI 查看的 source citations，支持可行动工具连接，Roadmap 列出 agent workflow builder、research mode、observability 与 RBAC。
- 淘汰原因：2026-08-06 的公开云端页面在受控浏览器中持续只显示一个 `role=status` 加载指示器，未出现可观察的文档问答或 Agent Builder UI。已保留真实 Run 作为“外部页面加载失败”的证据，但不计入六次成功初评。

## 案例 C｜HuggingChat / Chat UI

- 产品类型：AI 对话 / 内容生成与 MCP 工具型 Chat UI。
- V1 入口：<https://huggingface.co/chat/>（公开桌面入口；不登录、不发送消息）。
- 产品与资料：<https://github.com/huggingface/chat-ui>；[README](https://raw.githubusercontent.com/huggingface/chat-ui/main/README.md)。
- 许可证：Apache-2.0，见仓库 `LICENSE`。
- 产品目标：让用户通过网页与可选择的大语言模型对话，并理解模型、工具和数据处理边界。
- 评审范围：模型选择、聊天创建、MCP 工具使用与数据共享控制在未登录桌面体验中的可见性。
- 可引用需求 / 反馈：README 说明 UI 支持 OpenAI-compatible model、可选 MCP tools，以及 `PUBLIC_APP_DATA_SHARING` 控制；公开入口标题为 “HuggingChat - Chat with AI models”。
- 选择原因：作为真实的公开 AI 对话产品，与客服编排和个人 Agent 工作台不同，可验证 ProtoAlign 对聊天与模型/工具边界的审查能力。
- 边界：新会话需要登录；本次只阅读公开首页 DOM 与公开仓库资料，不尝试认证或发送内容。

## 统一执行方式

每个案例建立两个独立 ProtoAlign 项目，导入同一份公开 README（作为真实资料）与同一 V1 入口（由采集器读取渲染后 DOM），再分别启动 `deepseek-v4-pro` 初评。记录 Run ID、真实工具事件、Issue、证据与原型位置；不将两次运行互相复用或在同一项目内重跑。
