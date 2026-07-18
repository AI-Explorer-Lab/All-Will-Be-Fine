EVENT_TYPE = "event"
ANXIETY_TYPE = "anxiety"

REVIEW_TYPES = {EVENT_TYPE, ANXIETY_TYPE}

EVENT_SCENES = ["工作", "学习", "情感", "面试", "人际", "决策", "生活", "其他"]
ANXIETY_SCENES = ["工作", "学习", "情感", "面试", "人际", "健康", "未来", "生活", "其他"]
REVIEW_TAGS = ["沟通问题", "目标偏差", "执行卡点", "情绪波动", "认知盲区", "关系边界", "习惯调整", "经验沉淀"]


def allowed_scenes(review_type: str) -> list[str]:
    return ANXIETY_SCENES if review_type == ANXIETY_TYPE else EVENT_SCENES


def normalize_scene(scene: object, review_type: str) -> str:
    value = str(scene or "").strip()
    return value if value in allowed_scenes(review_type) else "其他"


def normalize_scenes(values: object, review_type: str) -> list[str]:
    source = values if isinstance(values, list) else [values]
    normalized = []
    for value in source:
        scene = str(value or "").strip()
        if scene in allowed_scenes(review_type) and scene not in normalized:
            normalized.append(scene)
    return normalized or ["其他"]


def normalize_tags(values: object) -> list[str]:
    source = values if isinstance(values, list) else [values]
    normalized = []
    for value in source:
        tag = str(value or "").strip()
        if tag in REVIEW_TAGS and tag not in normalized:
            normalized.append(tag)
    return normalized
