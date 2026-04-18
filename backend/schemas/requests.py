from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List


class HistoryMsg(BaseModel):
    role: str
    content: str


class EditRequest(BaseModel):
    xml: str
    prompt: str
    provider: str = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None
    ollama_timeout_seconds: Optional[float] = None
    ollama_num_predict: Optional[int] = None
    history: Optional[List[HistoryMsg]] = []


class QueryRequest(BaseModel):
    prompt: str
    provider: str = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None
    ollama_timeout_seconds: Optional[float] = None
    ollama_num_predict: Optional[int] = None


class ActionEventRequest(BaseModel):
    event_type: str
    source: str = "frontend"
    details: Dict[str, Any] = Field(default_factory=dict)
