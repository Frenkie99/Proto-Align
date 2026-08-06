# 真实案例验证报告

> 执行日期：2026-08-06（本地时区）。本报告只描述实际运行；模型建议、原始证据和产品经理决定仍分别保存在 SQLite 工作区内。公开案例和来源见 [cases.md](./cases.md)。

## 结论

ProtoAlign 在三种公开桌面 AI 产品上完成了 6 次独立真实初评。每次均使用 `deepseek-v4-pro`，模型实际调用了资料检索和原型检查工具，并保存了带公开资料引文和 DOM 选择器的 Issue。重复结果的主题一致，但 Issue 数量、严重程度与文案会随模型采样变化，不能把单次严重程度当成确定事实。

## 六次计入结果

| 案例 / 次数 | 项目 ID / Run ID | 耗时 | 真实工具与结果 |
| --- | --- | ---: | --- |
| Customer Service #1 | `prj_f3afc535…` / `run_57662d47…` | 69.1s | `search_sources`、`list_prototype_pages`、2×`inspect_prototype`、4×`save_claim_draft`、3×`save_issue_draft`；阻塞项指向空态 Runner Output，另有取消确认信息与护栏状态问题。 |
| Customer Service #2（录制实例） | `prj_1122f46e…` / `run_872d3671…` | 真实 UI 同步运行 | `search_sources`、`list_prototype_pages`、3×`inspect_prototype`、`save_issue_draft`；生成 Guardrails 空态不可验证问题。该项目随后完成 V1→V2 复检与人工关闭。 |
| OpenAgent #1 | `prj_ab9ab044…` / `run_f67b1afc…` | 83.4s | 检索、2×原型检查、3×草稿 Issue；主题为工具/MCP 边界、知识库隔离、审计日志。 |
| OpenAgent #2 | `prj_a4256e22…` / `run_3857af5f…` | 76.3s | 检索、6×原型检查、3×草稿 Issue；主题仍为主内容 Loading、工具权限/MCP、知识库隔离。 |
| HuggingChat #1 | `prj_0e476246…` / `run_c42100b4…` | 64.0s | 检索、原型检查、3×草稿 Issue；主题为 MCP 状态、Omni 路由透明度、数据共享入口。 |
| HuggingChat #2 | `prj_3e452704…` / `run_b7e1ca05…` | 35.8s | 检索、2×原型检查、草稿 Issue；再次发现未登录数据共享知情机制不可见。 |

所有上述 Run 均为 `completed`，模型字段均为 `deepseek-v4-pro`。完整事件、参数摘要和证据保存于对应项目的 Agent 活动记录中；各次原始 API 摘要存放在未提交的 `.artifacts/overnight/real-case-runs-*.json`。

### 重复稳定性

- 客服案例两次都把“取消前确认信息 / 运行时可验证性”作为核心风险，并引用 README Demo flow #2 与 `Agent View` DOM。
- OpenAgent 两次都落在可观察性与行动边界；第二次更明确识别出主内容 `Loading` 的阻塞性。
- HuggingChat 两次都关联了公开 README 的 `PUBLIC_APP_DATA_SHARING` 约束和未登录首页；第一次额外发现 MCP 与路由说明不足。

因此，输入变化导致 Issue 主题明显变化；同输入重复运行则保留核心风险，但并非逐字或逐项固定输出。

## 代表闭环录制

- 视频：`/Users/frenkie99/project/原型评审智能体/.artifacts/overnight/page@a69215a42e5bf98792ad218b32dda114.webm`
- 可播放性：Playwright Chromium 以本地 HTTP 实际播放，`readyState=4`，分辨率 `1440×900`，时长 `54.08s`，播放进度已推进至 `0.50s`。
- 关键时点（经连续播放抽样）：约 `00:21` 首次真实 Agent 运行中；约 `00:48` 已导入 V2、V2 DOM 已采集且 Issue 为处理中；约 `00:52.8` 展示真实复检活动 `get_issue_context → compare_versions → save_verification → agent_complete`。
- 对应项目：`prj_1122f46e-5d9a-4b36-a40e-a7d02c8c1d7e`；V1 `ver_bd04a4b9…`，V2 `ver_c338f23b…`；初评 `run_872d3671…`，复检 `run_df5fdbbd…`。
- 复检：问题 `iss_2c162b9d…` 的结果为“疑似已解决”；随后由 UI 中的产品经理填写依据并将状态更新为“已解决”。Agent 没有自动关闭 Issue。
- 录制中的 V2：`/Users/frenkie99/project/原型评审智能体/.artifacts/overnight/customer-service-v2.html`，是基于公开 Customer Service Agents Demo 的桌面 UI 修改稿，补入确认号、航班号、护栏状态和“等待客户确认”的运行记录。
- 辅助截图：`recording-01-review-issue.png`、`recording-02-verification.png`、`recording-03-final-audit.png`；视频抽样：`recording-video-continuous-20s.png`、`recording-video-continuous-48s.png`、`recording-video-continuous-52s.png`。

`真实案例｜OpenAI Customer Service Agents Demo｜第 2 次` 的 API-only Run（`run_d6d82b1e…`）也成功，但作为额外的重复样本留存，未计入上表的 6 次，以保证录制实例本身属于计数范围。

## 失败路径与反向验证

| 条件 | 实际结果 | 虚拟 Issue |
| --- | --- | --- |
| 空资料 | API 400：“请填写原文或上传非空文本文件” | 无 |
| ZIP 路径穿越 | API 400：“ZIP 包含不安全的文件路径” | 无 |
| 不可访问 URL | API 400，已记录版本且 DOM 采集失败 | 无 |
| 缺少 `DEEPSEEK_API_KEY` | API 502，保存 failed Run 与 `model_connection` failed 事件 | 无 |
| 无效模型地址 | 隔离服务使用测试令牌及 `http://127.0.0.1:9`，API 502 “Connection error.”，保存 failed Run，Issue 数为 0 | 无 |
| 刷新持久化 | 故障后导入有效资料与 HTML V1，capture 为 `captured`；刷新并切换项目后资料和 DOM 状态仍可见 | 不适用 |

反向验证已完成：先提交空资料 / 坏 ZIP / 坏 URL，确认错误；随后在同一项目导入有效资料和 HTML，确认 DOM 采集成功并在刷新后仍存在。该路径已加入端到端回归测试。

## 淘汰候选与限制

- Open Canvas 的公开网页明确显示 Demo 已下线，初评只发现“无法验证功能”的真实阻塞项，因此不计入六次。
- DocsGPT 云端页面在受控浏览器中只显示 Spinner，未出现可评审主流程，因此不计入六次。
- OpenAgent 为公开只读体验，HuggingChat 新会话需要登录；本次只观察公开且无需认证的桌面 DOM，没有绕过访问控制或提交用户数据。
- 当前 URL 输入仍是单页 DOM 采集；本报告不能证明复杂跨页、登录态、视觉语义或真实第三方后端行为。

## 已修复缺陷与下一阶段建议

> 后续状态（2026-08-06）：P0 页面质量识别、P1 项目内 Run 比较和稳定性提示已在下一轮实现；P2 仅完成安全设计，登录态与多页采集仍未实现。

后续真实复核使用 HuggingChat #1 项目：原 Run `run_c42100b4…` 与新增完成 Run `run_3ef625bf…` 在 1440×900 比较视图中得到“共同主题 1、仅 A 2、仅 B 0、证据变化 1”，结论为“有波动·待人工确认”。此前一次 `run_f1d26331…` 因超过 8 轮工具上限真实失败，草稿已回滚且失败记录保留；没有回退为固定比较结果。

本轮没有发现可归因于应用实现且需要修改业务代码的 P0/P1 缺陷。新增的端到端回归覆盖导入、模型失败与恢复；两次测试断言失败均为测试定位范围错误，已修正后通过。

1. **P0：为 URL 导入增加“加载完成 / 登录页 / 空壳页面”识别。** Open Canvas 与 DocsGPT 表明，单纯 DOM 捕获能诚实发现不可评审状态，但应在导入结果中把“产品不可用”与“产品问题”进一步区分。
2. **P1：将重复评审结果做成项目内比较视图。** 当前可追溯但需人工比对 Run；应并列展示共同主题、仅一次出现的问题和证据差异。
3. **P1：为评审质量加入可审计的稳定性标准。** 特别是 Issue 数量和严重程度随采样变化时，应提示“待人工确认”，而非暗示确定性。
4. **P2：支持可控的多页 / 登录态采集。** 这需要显式授权、隔离与安全设计，不应通过当前 URL 导入隐式扩张权限。
