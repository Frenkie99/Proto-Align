# Stitch Generation Prompt — 直接生成版

**OVERALL PURPOSE**
Design a polished project-level Agent workspace for junior AI product managers reviewing a B2B AI prototype before engineering handoff. The core object is an Issue, not the prototype itself. The screen must help the user connect customer feedback, engineering constraints, AI-discovered risks, exact prototype locations, human decisions, and cross-version verification.

**PLATFORM:** Web application, desktop-first, optimized for a 1440×1024 viewport.

**PAGE STRUCTURE:**

1. **Compact Global Header**
   - Product/project switcher labeled “AI 客服回复助手”.
   - Prototype version select menu supporting V1, V2, V3, V4.
   - Engineering-handoff gate labeled “暂不可交付”.
   - Last updated label, review settings action, and primary action “启动复检”.

2. **Issue Navigation Workspace**
   - A collapsible left-side issue queue grouped by “阻塞问题”, “待确认”, and “处理中”.
   - Each issue row shows title, source badge, status, and prototype location.
   - Use these four issues exactly:
     - “知识库更新延迟没有被清楚告知” — 客户反馈 — 阻塞交付.
     - “高风险回复缺少人工确认” — 研发反馈 — 待处理.
     - “无法回答时没有失败兜底” — AI 推断·待确认.
     - “转人工入口在长对话中不可见” — 客户反馈 — 待处理.
   - Include a compact recent-activity section for “已检索客户纪要” and “已检查 V1 原型页面”; do not invent progress percentages or activity counts.

3. **Dominant Issue Context Canvas**
   - This is the widest and visually dominant work area.
   - Provide a contextual toolbar showing current version, page path “客服工作台 / 回复生成区”, viewport controls, and zoom.
   - Render a credible embedded prototype of an AI customer-service reply assistant. The user asks “我的订单什么时候发货？”. The AI candidate reply says shipment is expected before 08-06. Highlight the exact warning “知识库最近更新，相关信息可能存在延迟，请以实际发货通知为准。” with a numbered annotation linked to the selected issue.
   - Below the prototype, show two source-backed evidence containers:
     - “7 月 28 日客户会议纪要”: knowledge-base updates caused replies to conflict with actual policy, creating misunderstandings and complaints.
     - “7 月 30 日研发评审记录”: knowledge synchronization is asynchronous; the interface must show synchronization status and most recent update time.
   - Include a compact verification strip explaining what must be visible in V2 before the issue can be marked verified.

4. **Task-Oriented Agent Inspector**
   - A persistent right-side inspector, not a chat-first interface.
   - Sections: 问题解读、为什么重要、建议确认问题、验证标准、下一步建议.
   - Explain that the problem is not only weak wording: the product manager must confirm whether support agents may send a reply while source material is outdated.
   - Show checklist-style verification conditions:
     - 知识库状态与最近更新时间可见.
     - 同步中或资料过期时有明确提示.
     - 高风险回复发送前需要人工确认.
     - 相关改动在 V2 中可复检.
   - Include a small assistant input for questions and decision rationale.
   - Place structured actions in a persistent action area: 开始处理, 发起澄清, 延后, 接受风险, 标记待验证, 关闭问题.

5. **Workspace Separation and Behavior**
   - Use a clear split-view grid with a dominant center canvas and narrower supporting sidebars.
   - The three areas may visually blend into one cohesive light workspace; do not require different background levels. Distinguish them through continuous dividers, independent sticky headers, stable padding, scroll behavior, and content density.
   - Selecting an issue updates the annotation, evidence, and Agent explanation.
   - Switching versions updates the prototype and verification state without automatically closing an issue.
   - AI-discovered issues must always display “AI 推断·待确认”.
   - Accepting risk or closing an issue requires a visible human confirmation step.

**CONTENT AND QUALITY CONSTRAINTS**
- Use the supplied Chinese product copy exactly where provided.
- Do not use Lorem Ipsum, fictional scores, completion rates, user counts, cost savings, decorative analytics, or generic chart widgets.
- Do not turn the page into a project-management dashboard or a full-screen chat application.
- Optimize for rapid scanning, evidence traceability, and clear human decision authority.
