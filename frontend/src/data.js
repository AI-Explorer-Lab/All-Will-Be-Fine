(() => {
  const scenes = {
    event: ["工作", "学习", "面试", "人际", "决策", "生活", "其他"],
    anxiety: ["工作", "学习", "面试", "人际", "健康", "未来", "生活", "其他"],
  };

  const summaryTemplates = {
    event: [
      ["发生了什么", "在与后端沟通接口需求时，对字段含义和返回规则理解不一致，导致开发完成后发现问题，需要返工修改。"],
      ["需要改进的地方", "没有在开始开发前把模糊点问清楚。"],
      ["下次怎么做", ["先复述我对需求的理解", "确认目标和边界", "确认关键字段含义", "明确验收标准"]],
      ["提醒自己", "开始做之前，先确认清楚，返工的成本更高。"],
    ],
    anxiety: [
      ["我在担心什么", "担心被问到自己不熟悉的大模型或 Agent 问题。"],
      ["现实检查", "确实存在部分知识点还不熟，但也已经准备了多个项目和常见问题。"],
      ["我能做什么", ["继续准备高频问题", "整理项目话术", "练习结构化表达"]],
      ["提醒自己", "焦虑不是预测结果，它只是提醒我有事情需要准备。"],
    ],
  };

  const resultCards = {
    event: {
      title: "行动卡",
      fields: [
        ["需要改进的地方", "没有在开始开发前把模糊点问清楚。"],
        ["下次怎么做", ["先复述我对需求的理解", "确认目标和边界", "确认关键字段含义", "明确验收标准"]],
        ["提醒自己", "开始做之前，先确认清楚，返工的成本更高。"],
      ],
    },
    anxiety: {
      title: "焦虑校准卡",
      fields: [
        ["我能做什么", ["准备 5 个高频技术问题", "练习用结构化方式回答"]],
        ["提醒自己", "焦虑不是预测结果，它只是提醒我有事情需要准备。"],
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
      summary: { 发生了什么: "学习目标过大，执行动作不够具体。", 需要改进的地方: "计划需要拆成更小的动作。", 下次怎么做: ["先列一个 30 分钟任务"], 提醒自己: "小步开始更容易坚持。" },
      resultCard: { 需要改进的地方: "计划需要拆成更小的动作。", 下次怎么做: ["把任务缩小到今天能完成的一步"], 提醒自己: "先做小，再做完。" },
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
    methodCards,
    resultCards,
    reviewRecords,
    scenes,
    summaryTemplates,
  };
})();
