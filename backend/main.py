from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from time import perf_counter

from backend.controller.APIs.auth_controller import router as auth_router
from backend.controller.APIs.monitor_controller import router as monitor_router
from backend.controller.APIs.review_controller import router as review_router
from backend.exceptions.exception_handler import register_exception_handlers
from backend.service.monitor_service import record_request_metric


def create_app() -> FastAPI:
    app = FastAPI(title="Private Review MVP", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    @app.middleware("http")
    async def collect_request_metrics(request, call_next):
        started = perf_counter()
        status_code = 500
        error = ""
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            error = exc.__class__.__name__
            raise
        finally:
            duration_ms = int((perf_counter() - started) * 1000)
            record_request_metric(request.method, request.url.path, status_code, duration_ms, error)

    app.include_router(auth_router, prefix="/api")
    app.include_router(review_router, prefix="/api")
    app.include_router(monitor_router, prefix="/api")

    @app.get("/health")
    @app.head("/health")
    def health_check():
        return {"status": "ok"}

    return app


app = create_app()
