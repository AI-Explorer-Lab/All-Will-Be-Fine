from __future__ import annotations

import json
from typing import Any


def build_review_prompt(
    review_type: str,
    raw_input: str,
    scene: str | None,
    provided_fields: dict[str, Any] | None = None,
) -> str:
    mode = "事件复盘" if review_type == "event" else "焦虑复盘"
    scene_text = scene or "未选择场景"
    fields = (
        "发生了什么、需要改进的地方、下次怎么做、提醒自己"
        if review_type == "event"
        else "我在担心什么、现实检查、我能做什么、提醒自己"
    )
    return (
        f"请以理性教练和温和咨询师的口吻完成{mode}。"
        f"场景：{scene_text}。"
        f"原始输入：{raw_input}。"
        f"用户已经填写的字段：{json.dumps(provided_fields or {}, ensure_ascii=False)}。"
        "用户已填写的内容是事实来源，不得覆盖、改写、曲解或虚构。"
        "summary 和 result_card 只补全用户未填写的字段。"
        "对于用户已填写的字段，如有值得补充之处，写入 ai_suggestions，不能写回原字段。"
        "AI 补充应指出信息缺口或给出更具体的行动建议，不要重复用户原文。"
        "行动建议尽量包含触发时机、执行动作和完成标准。"
        "无法确定的信息标记为需要用户确认，不进行人格评价、心理诊断或责任判断。"
        f"只围绕这些字段输出：{fields}。"
        "文字要短，避免心理分析式长篇结论，重点给出下一次可执行动作。"
    )
