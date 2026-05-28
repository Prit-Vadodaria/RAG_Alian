from __future__ import annotations

from pydantic import BaseModel, Field


class AskRequestSchema(BaseModel):
    query: str = Field(..., min_length=1, example="What is RAG?")
