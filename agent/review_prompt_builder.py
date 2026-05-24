from __future__ import annotations


def build_review_prompt(review_type: str, raw_input: str, scene: str | None) -> str:
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
        f"只围绕这些字段输出：{fields}。"
        "文字要短，避免心理分析式长篇结论，重点给出下一次可执行动作。"
    )
