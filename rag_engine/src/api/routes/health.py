
from fastapi import APIRouter

from src.api.schemas.response_schema import HealthResponseSchema

router = APIRouter()


@router.get("/health", response_model=HealthResponseSchema)
async def health() -> HealthResponseSchema:
    return HealthResponseSchema(
        status="healthy",
        service="rag-engine",
        version="1.0.0",
    )

