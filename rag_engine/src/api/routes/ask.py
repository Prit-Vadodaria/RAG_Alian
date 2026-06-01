from fastapi import APIRouter

from src.api.schemas.ask_schema import AskRequestSchema
from src.api.schemas.response_schema import AskResponseSchema
from src.api.services.ask_service import ask_query

router = APIRouter()


@router.post("/ask", response_model=AskResponseSchema)
async def ask_route(request: AskRequestSchema) -> AskResponseSchema:
    return ask_query(
        request.query,
        context_id=request.context_id,
        prompt_settings=request.prompt_settings.model_dump() if request.prompt_settings else None,
    )
