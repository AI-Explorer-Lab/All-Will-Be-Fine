from __future__ import annotations

import os
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = ROOT / "config" / "app.yaml"


def get_environment() -> str:
    return os.getenv("APP_ENV", "local")


def load_config(path: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    config_path = Path(path) if path else DEFAULT_CONFIG_PATH
    if yaml is None:
        return {"environment": get_environment(), "db": {"type": "memory"}, "agent": {}}
    with config_path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file) or {}
    data["environment"] = os.getenv("APP_ENV", data.get("environment", get_environment()))
    return data
