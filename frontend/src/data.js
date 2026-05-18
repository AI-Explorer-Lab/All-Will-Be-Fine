(() => {
  const scenes = {
    event: ["工作", "学习", "面试", "人际", "决策", "生活", "其他"],
    anxiety: ["工作", "学习", "面试", "人际", "健康", "未来", "生活", "其他"],
  };

  const summaryTemplates = {
    event: [
      ["事件摘要", "在与后端沟通接口需求时，对字段含义和返回规则理解不一致，导致开发完成后发现问题，需要返工修改。"],
      ["我的目标", "按时完成接口开发并保证联调顺利通过。"],
      ["实际结果", "返工修改，延误了进度。"],
      ["关键行为", "沟通时没有确认关键字段含义和验收标准。"],
      ["不满意点", "没有在开始开发前把模糊点问清楚。"],
      ["可能影响", "进度延迟，协作效率下降。"],
    ],
    anxiety: [
      ["焦虑触发点", "想到即将到来的面试，担心技术问题答不上来。"],
      ["我担心的事情", "担心被问到自己不熟悉的大模型或 Agent 问题。"],
      ["最坏剧本", "面试表现很差，被面试官认为能力不足。"],
      ["现实证据", "确实存在部分知识点还不熟，但也已经准备了多个项目和常见问题。"],
      ["可控部分", "继续准备高频问题，整理项目话术，练习结构化表达。"],
      ["不可控部分", "面试官具体问什么、对方评价标准、最终结果。"],
    ],
  };

  const deepReviewTemplates = {
    event: [
      ["事实层", "接口字段理解出现偏差，开发完成后才发现双方对字段含义理解不一致。"],
      ["行为层", "开始开发前没有主动确认字段含义、边界情况和验收样例。"],
      ["认知层", "默认自己理解的字段含义就是对方真实想表达的含义。"],
      ["方法层", "缺少一个开发前需求确认清单，尤其是字段含义、异常情况和验收标准的确认流程。"],
    ],
    anxiety: [
      ["触发点", "想到即将进行的面试，开始反复推演失败场景。"],
      ["担心内容", "担心被问到完全不会的问题，导致面试失败。"],
      ["证据检查", "支持证据是仍有部分知识点不熟；反对证据是已经有项目经验，也准备过多个常见问题。"],
      ["概率校准", "焦虑时可能把失败概率估计为 80%，但实际更合理的判断可能是 40% 到 50%。"],
      ["可控行动", "继续准备技术选型、大模型基础、Agent 编排、项目链路等高频问题。"],
      ["安顿策略", "把焦虑转化为 30 分钟的具体准备任务，完成后停止反复推演最坏结果。"],
    ],
  };

  const resultCards = {
    event: {
      title: "下次行动卡",
      fields: [
        ["问题提醒", "问题不只是粗心，而是开始前缺少字段含义和验收标准的确认。"],
        ["下次遇到类似情况，我会", "在正式开发前，先用 5 分钟确认需求关键点。"],
        ["行动步骤", ["先复述我对需求的理解", "确认目标和边界", "确认关键字段含义", "要一个正常样例和异常样例", "明确验收标准"]],
        ["一句提醒自己的话", "开始做之前，先确认清楚，返工的成本更高。"],
      ],
    },
    anxiety: {
      title: "焦虑校准卡",
      fields: [
        ["核心担心", "担心面试中被问到不会的问题，从而被认为能力不足。"],
        ["现实检查", "这个担心有一定现实依据，但目前证据不足以说明最坏结果一定会发生。"],
        ["最小可控行动", "准备 5 个高频技术问题，并练习用结构化方式回答。"],
        ["需要放下的不可控部分", "面试官具体问什么、对方主观评价、最终结果。"],
        ["下次提醒自己的话", "焦虑不是预测结果，它只是提醒我有事情需要准备。"],
      ],
    },
  };

  const reviewRecords = [
    {
      id: "r1",
      type: "event",
      scene: "工作",
      title: "接口需求沟通不清导致返工",
      date: "2026-05-17",
      shortDate: "05-17",
      rawInput: "在与后端沟通接口需求时，对字段含义和返回规则理解不一致，导致开发完成后发现问题，需要返工修改。",
      summary: Object.fromEntries(summaryTemplates.event),
      deepReview: Object.fromEntries(deepReviewTemplates.event),
      resultCard: Object.fromEntries(resultCards.event.fields),
      conclusion: "问题不只是粗心，而是开发前缺少字段含义和验收标准确认。",
      status: "已生成方法卡",
      savedToMethodLibrary: true,
      savedToCalibration: false,
    },
    {
      id: "r2",
      type: "anxiety",
      scene: "面试",
      title: "担心面试技术问题答不上来",
      date: "2026-05-16",
      shortDate: "05-16",
      rawInput: "想到即将到来的面试，担心技术问题答不上来，也担心被问到自己不熟悉的大模型或 Agent 问题。",
      summary: Object.fromEntries(summaryTemplates.anxiety),
      deepReview: Object.fromEntries(deepReviewTemplates.anxiety),
      resultCard: Object.fromEntries(resultCards.anxiety.fields),
      conclusion: "焦虑主要来自最坏剧本推演，可控动作是准备高频问题和表达框架。",
      status: "已加入校准",
      savedToMethodLibrary: false,
      savedToCalibration: true,
    },
    {
      id: "r3",
      type: "event",
      scene: "学习",
      title: "学习计划执行不下去",
      date: "2026-05-15",
      shortDate: "05-15",
      rawInput: "计划太大太模糊，缺少具体执行步骤和反馈机制。",
      summary: { 事件摘要: "学习目标过大，执行动作不够具体。" },
      deepReview: { 方法层: "缺少把目标拆成 30 分钟动作的执行清单。" },
      resultCard: { 一句提醒自己的话: "先把任务缩小到今天能完成的一步。" },
      conclusion: "先把计划拆成 30 分钟动作，再设置完成反馈。",
      status: "未沉淀",
      savedToMethodLibrary: false,
      savedToCalibration: false,
    },
  ];

  const methodCards = [
    {
      id: "m1",
      title: "开发前需求确认卡",
      scenes: ["工作", "开发", "需求沟通"],
      trigger: "准备开始写接口或修改逻辑前",
      steps: ["复述我对需求的理解", "确认目标和边界", "确认关键字段含义", "要一个正常样例和异常样例", "明确验收标准"],
      source: "接口需求沟通不清导致返工",
      updatedAt: "2026-05-17",
    },
  ];

  const calibrationCards = [
    {
      id: "c1",
      worry: "担心面试技术问题答不上来",
      scene: "面试",
      estimatedProbability: "80%",
      verificationDate: "2026-05-25",
      status: "pending",
    },
    {
      id: "c2",
      worry: "担心面试一定表现很差",
      scene: "面试",
      estimatedProbability: "80%",
      verificationDate: "2026-05-12",
      status: "verified",
      finalResult: "部分发生，但没有想象中严重",
      actualImpact: "中等",
      calibrationConclusion: "当时高估了失败概率，也高估了失败后果。下次应把焦虑转化为具体准备任务，而不是反复推演最坏结果。",
    },
  ];

  window.REVIEW_DATA = {
    calibrationCards,
    deepReviewTemplates,
    methodCards,
    resultCards,
    reviewRecords,
    scenes,
    summaryTemplates,
  };
})();
