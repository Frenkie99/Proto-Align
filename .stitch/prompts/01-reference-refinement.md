# Stitch Edit Prompt — 参考图精修版

Recreate and refine the uploaded desktop web-app mockup as a polished high-fidelity product workspace. Preserve the successful information architecture and recognizable composition of the reference image rather than redesigning it from scratch.

**PRIMARY INTENT**
The screen helps a junior AI product manager review a B2B AI prototype before engineering handoff. The core object is an Issue. The user selects an issue, inspects its exact prototype location and supporting evidence, reads the Agent's explanation, and makes a human-controlled decision.

**PRESERVE FROM THE REFERENCE**
1. Keep the compact global header with project name “AI 客服回复助手”, version dropdown supporting V1–V4, handoff gate “暂不可交付”, last-updated label, review settings, and primary action “启动复检”.
2. Keep the desktop three-column split view: grouped issue queue on the left, dominant issue context canvas in the center, task-oriented Agent inspector on the right.
3. The three work areas may share the same light background. Do not force three different background levels. Create clear separation through continuous column dividers, distinct sticky section headers, stable gutters, independent scroll regions, and different content density.
4. Keep the center prototype view as the visual focal point. Preserve the red dashed annotation around the knowledge-delay warning and map it to issue number 1.
5. Keep semantic jump-color differentiation in the issue queue: blocking, pending confirmation, in progress, customer feedback, engineering feedback, and “AI 推断·待确认” must be visually distinguishable without turning the screen into a rainbow.

**CONTENT CORRECTIONS**
- Selected issue: “知识库更新延迟没有被清楚告知”. Source: “客户反馈”. Status: “处理中”. Severity: “阻塞交付”. Location: “V1 / 客服工作台 / 回复生成区”.
- Other issues: “高风险回复缺少人工确认” / 研发反馈; “无法回答时没有失败兜底” / AI 推断·待确认; “转人工入口在长对话中不可见” / 客户反馈.
- Prototype conversation: user asks “我的订单什么时候发货？”. AI candidate reply states that shipment is expected before 08-06. The highlighted warning says “知识库最近更新，相关信息可能存在延迟，请以实际发货通知为准。”
- Evidence cards: “7 月 28 日客户会议纪要” and “7 月 30 日研发评审记录”.
- Agent inspector sections: 问题解读、为什么重要、建议确认问题、验证标准、下一步建议、与助手对话、问题操作.
- Structured actions: 开始处理、发起澄清、延后、接受风险、标记待验证、关闭问题.

**REFINEMENT GOALS**
- Improve visual hierarchy, spacing rhythm, alignment, icon consistency, component finish, and scanability.
- Make the active issue and the prototype annotation unmistakably connected.
- Keep the right inspector readable and task-oriented; do not turn it into a long chat window.
- Use color accents for status and source labels while preserving a professional enterprise-product tone.
- Avoid generic equal-size dashboard cards, excessive gradients, glassmorphism, giant rounded containers, decorative charts, invented scores, and fictional statistics.
- Keep all critical content visible in a 1440×1024 desktop viewport.

**INTERACTIONS TO REPRESENT**
- Version dropdown switches between V1–V4.
- Clicking an issue updates prototype annotation, evidence, and Agent explanation.
- Evidence cards expand to source excerpts.
- “启动复检” shows a running state and then creates a new AI-discovered issue marked “AI 推断·待确认”.
- Human-only actions require a short confirmation or rationale before accepting risk or closing an issue.
