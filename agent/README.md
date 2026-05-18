# Agent

这里放复盘工具的 AI agent 端能力：提示词、输出 schema、模型调用适配器和后续评估脚本。

当前 MVP 只提供 prompt 构建函数，后端仍使用 mock 输出。接入真实模型时，优先在这里新增 provider client，不要把 API key 写进代码。
