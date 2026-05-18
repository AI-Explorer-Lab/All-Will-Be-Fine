from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.controller.APIs.review_controller import router as review_router
from backend.exceptions.exception_handler import register_exception_handlers


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
    app.include_router(review_router, prefix="/api")
    return app


app = create_app()
