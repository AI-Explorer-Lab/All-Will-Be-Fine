from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import urlparse

from backend.config.config import load_config
from backend.constant.review_constants import (
    ANXIETY_SCENES,
    ANXIETY_TYPE,
    EVENT_SCENES,
    EVENT_TYPE,
)
from backend.domain.req import CreateReviewRequest
from backend.service.monitor_service import record_ai_metric


class SlotCompletionService:
    def complete(self, request: CreateReviewRequest, prompt: str) -> tuple[dict[str, Any], list[str]]:
        started = time.perf_counter()
        fallback = build_fallback_slots(request, apply_user_fields=False)
        config = load_config().get("agent", {})
        api_key = resolve_api_key(config.get("api_key_env") or "OPENAI_API_KEY") or config.get("api_key")
        if not api_key:
            warning = "当前未设置大模型 API Key，已使用本地槽位补全"
            record_ai_metric("slot_completion", False, True, int((time.perf_counter() - started) * 1000), warning)
            return apply_provided_fields(fallback, request.type, request.provided_fields), [warning]

        try:
            ai_slots = self._complete_with_responses_api(request, prompt, config, api_key)
            record_ai_metric("slot_completion", True, False, int((time.perf_counter() - started) * 1000))
            merged = merge_slots(fallback, ai_slots)
            return apply_provided_fields(merged, request.type, request.provided_fields), []
        except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError) as error:
            warning = f"大模型槽位补全失败，已使用本地兜底：{format_completion_error(error)}"
            record_ai_metric("slot_completion", False, True, int((time.perf_counter() - started) * 1000), warning)
            return apply_provided_fields(fallback, request.type, request.provided_fields), [warning]

    def _complete_with_responses_api(
        self,
        request: CreateReviewRequest,
        prompt: str,
        config: dict[str, Any],
        api_key: str,
    ) -> dict[str, Any]:
        base_url = str(config.get("base_url") or "https://api.openai.com/v1").rstrip("/")
        payload = {
            "model": config.get("model") or "gpt-5.4-mini",
            "instructions": (
                "你是一个私人复盘助手。请把用户输入补全成结构化复盘槽位。"
                "用户已经填写的字段不得覆盖或改写，只能在 ai_suggestions 中给出独立补充。"
                "只有空字段可以由你直接补全。不要虚构事实、动机、情绪或责任归属。"
                "建议必须短、具体、可执行，尽量包含触发时机、动作和完成标准。"
                "无法判断时明确写出需要用户确认。"
                "只返回符合 schema 的 JSON。"
            ),
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                f"{prompt}\n\n"
                                f"复盘类型：{request.type}\n"
                                f"场景：{request.scene or '未选择'}\n"
                                f"用户原始输入：{request.raw_input}\n"
                                f"需要补全的槽位：{json.dumps(slot_schema_hint(request.type), ensure_ascii=False)}"
                            ),
                        }
                    ],
                }
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "review_slots",
                    "schema": response_schema(request.type),
                    "strict": False,
                },
                "verbosity": "medium",
            },
            "max_output_tokens": 1800,
            "store": False,
            "stream": bool(config.get("stream")),
        }
        data = post_responses(base_url, payload, api_key, config)
        text = extract_response_text(data)
        if not text:
            raise ValueError("empty_response_text")
        return json.loads(text)

    def follow_up(self, record: Any, question: str = "", stage: str = "result") -> tuple[dict[str, Any], list[str]]:
        started = time.perf_counter()
        fallback = build_fallback_follow_up(record, question)
        config = load_config().get("agent", {})
        api_key = resolve_api_key(config.get("api_key_env") or "OPENAI_API_KEY") or config.get("api_key")
        if not api_key:
            warning = "当前未设置大模型 API Key，已使用本地追问建议"
            record_ai_metric("follow_up", False, True, int((time.perf_counter() - started) * 1000), warning)
            return fallback, [warning]

        try:
            ai_result = self._follow_up_with_responses_api(record, question, stage, config, api_key)
            record_ai_metric("follow_up", True, False, int((time.perf_counter() - started) * 1000))
            return merge_mapping(fallback, ai_result), []
        except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError) as error:
            warning = f"大模型继续追问失败，已使用本地兜底：{format_completion_error(error)}"
            record_ai_metric("follow_up", False, True, int((time.perf_counter() - started) * 1000), warning)
            return fallback, [warning]

    def _follow_up_with_responses_api(
        self,
        record: Any,
        question: str,
        stage: str,
        config: dict[str, Any],
        api_key: str,
    ) -> dict[str, Any]:
        base_url = str(config.get("base_url") or "https://api.openai.com/v1").rstrip("/")
        payload = {
            "model": config.get("model") or "gpt-5.4-mini",
            "instructions": (
                "你是私人复盘助手。请基于既有复盘结果继续追问，目标是补出更具体、可行动的信息。"
                "输出要短、具体、温和，不要重复已有内容。只返回符合 schema 的 JSON。"
            ),
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": json.dumps(
                                {
                                    "stage": stage,
                                    "question": question or "请继续追问我一个最值得补充的问题，并给出为什么问。",
                                    "record": {
                                        "type": record.type,
                                        "scene": record.scene,
                                        "title": record.title,
                                        "raw_input": record.raw_input,
                                        "summary": record.summary,
                                        "result_card": record.result_card,
                                    },
                                },
                                ensure_ascii=False,
                            ),
                        }
                    ],
                }
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "review_follow_up",
                    "schema": follow_up_schema(),
                    "strict": False,
                },
                "verbosity": "medium",
            },
            "max_output_tokens": 900,
            "store": False,
            "stream": bool(config.get("stream")),
        }
        data = post_responses(base_url, payload, api_key, config)
        text = extract_response_text(data)
        if not text:
            raise ValueError("empty_response_text")
        return json.loads(text)


def post_responses(base_url: str, payload: dict[str, Any], api_key: str, config: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    timeout_seconds = positive_number(config.get("timeout_seconds"), default=15)
    req = urllib.request.Request(
        f"{base_url}/responses",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream" if payload.get("stream") else "application/json",
            "User-Agent": "curl/8.0",
        },
        method="POST",
    )
    opener = build_opener(config, base_url)
    with opener.open(req, timeout=timeout_seconds) as response:
        raw = response.read().decode("utf-8", errors="replace")
    if payload.get("stream"):
        return parse_sse_response(raw)
    return json.loads(raw)


def positive_number(value: Any, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if number > 0 else default


def build_opener(config: dict[str, Any], base_url: str) -> urllib.request.OpenerDirector:
    hostname = urlparse(base_url).hostname or ""
    no_proxy = [item.strip() for item in str(config.get("no_proxy") or "").split(",") if item.strip()]
    if any(hostname == item or hostname.endswith(f".{item}") for item in no_proxy):
        return urllib.request.build_opener(urllib.request.ProxyHandler({}))
    proxies = {
        "http": config.get("http_proxy"),
        "https": config.get("https_proxy"),
    }
    proxies = {key: value for key, value in proxies.items() if value}
    return urllib.request.build_opener(urllib.request.ProxyHandler(proxies))


def resolve_api_key(env_name: str) -> str | None:
    api_key = os.getenv(env_name)
    if api_key:
        return api_key
    if os.name != "nt":
        return None
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value, _ = winreg.QueryValueEx(key, env_name)
            return value or None
    except OSError:
        return None


def format_completion_error(error: Exception) -> str:
    if isinstance(error, urllib.error.HTTPError):
        try:
            body = error.read().decode("utf-8", errors="replace")
        except OSError:
            body = ""
        body = re.sub(r"\s+", " ", body).strip()
        return f"HTTP {error.code} {body[:240]}"
    return error.__class__.__name__


def extract_response_text(data: dict[str, Any]) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    chunks: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                chunks.append(content["text"])
    return "".join(chunks).strip()


def parse_sse_response(raw: str) -> dict[str, Any]:
    output_text: list[str] = []
    completed_response: dict[str, Any] | None = None
    for line in raw.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        data_line = line.removeprefix("data:").strip()
        if not data_line or data_line == "[DONE]":
            continue
        event = json.loads(data_line)
        event_type = event.get("type")
        if event_type == "response.output_text.delta" and isinstance(event.get("delta"), str):
            output_text.append(event["delta"])
        elif event_type == "response.completed" and isinstance(event.get("response"), dict):
            completed_response = event["response"]
    if output_text:
        return {"output_text": "".join(output_text)}
    if completed_response:
        return completed_response
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError("empty_stream_response") from error


def response_schema(review_type: str = EVENT_TYPE) -> dict[str, Any]:
    scene_options = ANXIETY_SCENES if review_type == ANXIETY_TYPE else EVENT_SCENES
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "title": {"type": "string"},
            "scene": {"type": "string", "enum": scene_options},
            "summary": {"type": "object", "additionalProperties": True},
            "result_card": {"type": "object", "additionalProperties": True},
            "ai_suggestions": {"type": "object", "additionalProperties": True},
            "method_card": {"type": "object", "additionalProperties": True},
            "calibration_card": {"type": "object", "additionalProperties": True},
        },
        "required": [
            "title",
            "scene",
            "summary",
            "result_card",
            "ai_suggestions",
            "method_card",
            "calibration_card",
        ],
    }


def follow_up_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "question": {"type": "string"},
            "why": {"type": "string"},
            "suggested_answer_shape": {"type": "string"},
            "next_action": {"type": "string"},
        },
        "required": ["question", "why", "suggested_answer_shape", "next_action"],
    }


def slot_schema_hint(review_type: str) -> dict[str, list[str]]:
    if review_type == ANXIETY_TYPE:
        return {
            "summary": ["我在担心什么", "现实检查", "我能做什么", "提醒自己"],
            "result_card": ["我能做什么", "提醒自己"],
            "ai_suggestions": ["仅为用户已填写字段提供独立补充，不重复原文"],
            "calibration_card": ["worry", "scene", "estimated_probability", "verification_date"],
        }
    return {
        "summary": ["发生了什么", "需要改进的地方", "下次怎么做", "提醒自己"],
        "result_card": ["需要改进的地方", "下次怎么做", "提醒自己"],
        "ai_suggestions": ["仅为用户已填写字段提供独立补充，不重复原文"],
        "method_card": ["title", "scenes", "trigger", "steps", "reminder"],
    }


def build_fallback_slots(
    request: CreateReviewRequest,
    apply_user_fields: bool = True,
) -> dict[str, Any]:
    raw_input = normalize_text(request.raw_input)
    title = title_from_input(raw_input, request.type)
    scene = request.scene or ("面试" if request.type == ANXIETY_TYPE else "工作")
    if request.type == ANXIETY_TYPE:
        slots = anxiety_slots(raw_input, title, scene)
    else:
        slots = event_slots(raw_input, title, scene)
    slots["ai_suggestions"] = fallback_ai_suggestions(request.type, request.provided_fields)
    return apply_provided_fields(slots, request.type, request.provided_fields) if apply_user_fields else slots


def fallback_ai_suggestions(review_type: str, provided_fields: dict[str, Any] | None) -> dict[str, Any]:
    fields = provided_fields if isinstance(provided_fields, dict) else {}
    templates = (
        {
            "我在担心什么": "可以再区分：哪些是已经发生的事实，哪些是对未来结果的担心。",
            "现实检查": "可以补充支持和反驳这个担心的具体证据；暂时无法确认的部分标记为需要验证。",
            "我能做什么": "可以为行动补充执行时间和完成标准，先选择一个 30 分钟内能完成的最小步骤。",
            "提醒自己": "保留这句话即可；需要时可以再加一个立刻能做的动作，让提醒更容易落地。",
        }
        if review_type == ANXIETY_TYPE
        else {
            "发生了什么": "可以再补充这件事造成的具体结果或影响，避免只记录过程。",
            "需要改进的地方": "可以进一步明确：是目标、边界、信息、沟通方式，还是验收标准没有确认。",
            "下次怎么做": "可以为每个动作补充触发时机和完成标准，确保下次能够直接执行。",
            "提醒自己": "保留这句话即可；如果希望更有行动性，可以加上开始前要做的第一个动作。",
        }
    )
    return {
        key: suggestion
        for key, suggestion in templates.items()
        if fields.get(key) not in (None, "", [])
    }


def apply_provided_fields(
    slots: dict[str, Any],
    review_type: str,
    provided_fields: dict[str, Any] | None,
) -> dict[str, Any]:
    fields = provided_fields if isinstance(provided_fields, dict) else {}
    if not fields:
        return slots

    summary = slots.get("summary") or {}
    result_card = slots.get("result_card") or {}
    ai_suggestions = slots.get("ai_suggestions") if isinstance(slots.get("ai_suggestions"), dict) else {}
    mapping = (
        {
            "我在担心什么": ("我在担心什么", False),
            "现实检查": ("现实检查", False),
            "我能做什么": ("我能做什么", True),
            "提醒自己": ("提醒自己", False),
        }
        if review_type == ANXIETY_TYPE
        else {
            "发生了什么": ("发生了什么", False),
            "需要改进的地方": ("需要改进的地方", False),
            "下次怎么做": ("下次怎么做", True),
            "提醒自己": ("提醒自己", False),
        }
    )
    primary_key = "我在担心什么" if review_type == ANXIETY_TYPE else "发生了什么"
    for source_key, (target_key, list_hint) in mapping.items():
        value = fields.get(source_key)
        if value in (None, "", []):
            continue
        normalized = _provided_list(value) if list_hint else _provided_text(value)
        assisted_value = {
            "user_content": normalized,
            "ai_suggestion": normalize_slot_value(ai_suggestions.get(source_key, "")),
        }
        summary[target_key] = assisted_value
        if target_key != primary_key:
            result_card[target_key] = assisted_value

    slots["summary"] = summary
    slots["result_card"] = result_card
    if review_type == EVENT_TYPE and isinstance(slots.get("method_card"), dict):
        method_card = slots["method_card"]
        if fields.get("下次怎么做"):
            method_card["steps"] = _provided_list(fields["下次怎么做"])
        if fields.get("提醒自己"):
            method_card["reminder"] = str(fields["提醒自己"]).strip()
    return slots


def _provided_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [_strip_list_marker(str(item)) for item in value if str(item).strip()]
    return [_strip_list_marker(item) for item in str(value).splitlines() if item.strip()]


def _provided_text(value: Any) -> str:
    if isinstance(value, list):
        return "\n".join(str(item).strip() for item in value if str(item).strip())
    return str(value).strip()


def _strip_list_marker(value: str) -> str:
    return re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", value).strip()


def event_slots(raw_input: str, title: str, scene: str) -> dict[str, Any]:
    improvement = infer_event_gap(raw_input)
    next_steps = ["复述我对事情的理解", "确认目标和边界", "列出关键不确定点", "要一个可参考样例", "明确完成标准"]
    reminder = "开始做之前，先确认清楚，返工和内耗的成本更高。"
    return {
        "title": title,
        "scene": scene,
        "summary": {
            "发生了什么": raw_input,
            "需要改进的地方": improvement,
            "下次怎么做": next_steps,
            "提醒自己": reminder,
        },
        "result_card": {
            "需要改进的地方": improvement,
            "下次怎么做": next_steps,
            "提醒自己": reminder,
        },
        "method_card": {
            "title": f"{scene}开始前确认卡",
            "scenes": [scene, "复盘"],
            "trigger": "准备开始处理类似事情前",
            "steps": next_steps,
            "reminder": reminder,
        },
        "calibration_card": None,
    }


def anxiety_slots(raw_input: str, title: str, scene: str) -> dict[str, Any]:
    worry = after_keywords(raw_input, ["担心", "害怕", "怕"]) or raw_input
    return {
        "title": title,
        "scene": scene,
        "summary": {
            "我在担心什么": worry,
            "现实检查": "这个担心有一定现实依据，但目前证据不足以证明最坏情况一定会发生。",
            "我能做什么": "把担心拆成 1 到 3 个今天可以准备、确认或验证的小动作。",
            "提醒自己": "焦虑不是预测结果，它只是提醒我有事情需要准备。",
        },
        "result_card": {
            "我能做什么": "准备一个最小行动清单，并在今天完成第一步。",
            "提醒自己": "焦虑不是预测结果，它只是提醒我有事情需要准备。",
        },
        "method_card": None,
        "calibration_card": {
            "worry": title,
            "scene": scene,
            "estimated_probability": "80%",
            "verification_date": "",
        },
    }


def build_fallback_follow_up(record: Any, question: str = "") -> dict[str, Any]:
    if question:
        return {
            "question": question,
            "why": "这个问题可以帮助把复盘从结论推进到更具体的事实和行动。",
            "suggested_answer_shape": "用 2 到 3 句话回答：当时发生了什么、你做了什么、现在还缺哪一步。",
            "next_action": "把回答补进原始输入后，再重新生成一次复盘。",
        }
    if getattr(record, "type", "") == ANXIETY_TYPE:
        return {
            "question": "这件事里，你现在能控制的最小一步是什么？",
            "why": "焦虑复盘最容易停在最坏剧本，补出最小可控动作后，校准卡才会真正有用。",
            "suggested_answer_shape": "写一个 30 分钟内能完成的动作，最好包含时间、地点和完成标准。",
            "next_action": "先完成这个最小动作，再回来更新校准卡的验证日期。",
        }
    return {
        "question": "如果回到事情开始前，你最应该提前确认哪一个信息？",
        "why": "事件复盘的关键是找到下次能复用的前置动作，而不是只解释这次为什么不顺。",
        "suggested_answer_shape": "写出一个具体问题、应该问谁、用什么标准判断已经确认清楚。",
        "next_action": "把这个确认动作加入方法卡，作为下次开始前的第一步。",
    }


def merge_slots(fallback: dict[str, Any], ai_slots: dict[str, Any]) -> dict[str, Any]:
    merged = dict(fallback)
    for key in ["title", "scene"]:
        if valid_text(ai_slots.get(key)):
            merged[key] = ai_slots[key].strip()
    for key in ["summary", "result_card"]:
        merged[key] = normalize_slot_mapping(merge_mapping(fallback.get(key, {}), ai_slots.get(key, {})))
    merged["ai_suggestions"] = normalize_slot_mapping(
        merge_mapping(fallback.get("ai_suggestions", {}), ai_slots.get("ai_suggestions", {}))
    )
    for key in ["method_card", "calibration_card"]:
        if isinstance(fallback.get(key), dict) or isinstance(ai_slots.get(key), dict):
            merged[key] = merge_mapping(fallback.get(key) or {}, ai_slots.get(key) or {})
        else:
            merged[key] = None
    return merged


def normalize_slot_mapping(mapping: dict[str, Any]) -> dict[str, Any]:
    return {key: normalize_slot_value(value) for key, value in mapping.items()}


def normalize_slot_value(value: Any) -> Any:
    if isinstance(value, list):
        if all(not isinstance(item, (dict, list)) for item in value):
            return [str(item).strip() for item in value if str(item).strip()]
        return "\n".join(normalize_slot_value(item) for item in value if item not in (None, "", []))
    if isinstance(value, dict):
        lines = []
        for key, item in value.items():
            normalized = normalize_slot_value(item)
            if normalized not in (None, "", []):
                lines.append(f"{key}：{normalized}")
        return "\n".join(lines)
    return str(value).strip()


def merge_mapping(fallback: dict[str, Any], candidate: Any) -> dict[str, Any]:
    if not isinstance(candidate, dict):
        return dict(fallback)
    merged = dict(fallback)
    for key, value in candidate.items():
        if value not in (None, "", []):
            merged[key] = value
    return merged


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def valid_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def title_from_input(raw_input: str, review_type: str) -> str:
    if not raw_input:
        return "新的焦虑复盘" if review_type == ANXIETY_TYPE else "新的事件复盘"
    return raw_input[:22] + ("..." if len(raw_input) > 22 else "")


def after_keywords(text: str, keywords: list[str]) -> str:
    for keyword in keywords:
        if keyword in text:
            tail = text.split(keyword, 1)[1].strip("，。,. ")
            if tail:
                return tail
    return ""


def infer_goal(scene: str) -> str:
    goals = {
        "工作": "希望把工作顺利推进，减少返工和沟通成本。",
        "学习": "希望学习计划能够持续执行，并获得清晰反馈。",
        "情感": "希望更清楚地理解自己的感受，也更稳地处理关系里的期待与边界。",
        "面试": "希望稳定表达准备内容，尽量呈现真实能力。",
        "人际": "希望沟通更清楚，也尽量减少误会和消耗。",
        "决策": "希望做出更稳妥的判断，并降低事后反复纠结。",
    }
    return goals.get(scene, "希望事情能按更清晰、更稳定的方式推进。")


def infer_impact(scene: str) -> str:
    impacts = {
        "工作": "可能影响进度、协作效率和后续信任感。",
        "学习": "可能影响执行连续性和自我反馈。",
        "情感": "可能影响情绪稳定、关系判断和对自己需求的理解。",
        "面试": "可能影响表达稳定度和准备节奏。",
        "人际": "可能影响关系里的安全感和沟通质量。",
        "决策": "可能影响判断质量，并增加后续反复修改成本。",
    }
    return impacts.get(scene, "可能影响事情推进、情绪稳定和后续行动信心。")


def infer_event_behavior(raw_input: str) -> str:
    if any(word in raw_input for word in ["沟通", "确认", "接口", "需求"]):
        return "开始前没有把关键理解、边界和验收标准确认到足够清楚。"
    if any(word in raw_input for word in ["拖延", "没做", "没有执行"]):
        return "执行前没有把任务拆到足够小，也缺少即时反馈。"
    return "过程中少做了一个提前确认、拆解或校验的关键动作。"


def infer_event_gap(raw_input: str) -> str:
    if "粗心" in raw_input:
        return "问题不只是粗心，而是缺少防止粗心的检查机制。"
    if any(word in raw_input for word in ["沟通", "确认", "接口", "需求"]):
        return "问题不只是沟通不顺，而是开始前缺少共同确认的槽位。"
    return "问题不只是结果不好，而是过程中缺少一个可复用的检查动作。"


def infer_worst_case(worry: str) -> str:
    if any(word in worry for word in ["面试", "答不上", "能力"]):
        return "表现不如预期，并被对方理解为能力不足。"
    if any(word in worry for word in ["健康", "身体"]):
        return "身体状况变得更严重，影响接下来的生活安排。"
    return "事情没有按预期发展，并被自己理解为失败或失控。"
