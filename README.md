# 私人复盘 MVP

一个网页端优先的私人复盘 Web MVP，包含事件复盘与焦虑复盘两条流程，并拆成 `frontend`、`backend`、`agent` 三端。

## 运行前端

从项目根目录启动一个静态文件服务：

```powershell
python -m http.server 5173 -d frontend
```

然后打开 `http://127.0.0.1:5173`。

前端会优先连接 `http://127.0.0.1:8000/api`。如果后端没有启动，会自动使用本地 fallback 数据，页面仍可演示完整流程。

## 运行后端

首次启动前先安装依赖：

```powershell
python -m pip install -r backend/requirements.txt
```

从项目根目录启动后端：

```powershell
python -m uvicorn backend.main:app --reload
```

当前 `backend/config/app.yaml` 默认连接本机 Postgres。只想本地快速演示、暂时不用数据库时，可以先设置：

```powershell
$env:DB_TYPE = "memory"
```

如果要使用配置里的大模型参数，请先在当前终端设置环境变量：

```powershell
$env:OPENAI_API_KEY = "你的 OpenAI API Key"
```

核心接口：

- `POST /api/reviews/analyze`
- `GET /api/reviews`
- `GET /api/methods`
- `GET /api/calibrations`

## 后端结构

后端在 `backend/` 下，按需求拆分为 `config`、`domain`、`controller`、`service`、`mapper`、`database`、`middlewares`、`exceptions`、`utils` 等目录。当前默认使用内存数据，后续可在 `backend/service/review_service.py` 中替换真实大模型调用，在 `backend/mapper/review_mapper.py` 中接入数据库。

## Agent

Agent 端在 `agent/` 下，当前包含复盘 prompt 构建逻辑。后续模型 provider、输出 schema、评估脚本都放这里，API key 只通过环境变量注入。

## 测试

```powershell
python -m unittest discover -s backend/tests
```
