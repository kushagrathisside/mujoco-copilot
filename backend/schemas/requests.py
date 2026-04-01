from pydantic import BaseModel
from typing import Optional, List


class HistoryMsg(BaseModel):
    role: str
    content: str


class EditRequest(BaseModel):
    xml: str
    prompt: str
    provider: str = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None
    history: Optional[List[HistoryMsg]] = []


class QueryRequest(BaseModel):
    prompt: str
    provider: str = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None