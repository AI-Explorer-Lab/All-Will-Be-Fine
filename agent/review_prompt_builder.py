from __future__ import annotations


def build_review_prompt(review_type: str, raw_input: str, scene: str | None) -> str:
    mode = "事件复盘" if review_type == "event" else "焦虑复盘"
    scene_text = scene or "未选择场景"
    return (
        f"请以理性教练和温和咨询师的口吻完成{mode}。"
        f"场景：{scene_text}。"
        f"原始输入：{raw_input}。"
        "输出必须拆成事实、行为或证据、方法缺口和下次可执行动作。"
    )
