"""Response models for the Face-AI microservice."""

from pydantic import BaseModel, Field


class EmbedResponse(BaseModel):
    embedding: list[float] = Field(..., description="L2-normalised face template")
    dim: int = Field(..., description="Embedding dimensionality")
    engine: str
    model: str


class VerifyResponse(BaseModel):
    embedding: list[float] = Field(..., description="Probe face template")
    dim: int
    liveness: bool = Field(..., description="True if the capture passed the silent liveness check")
    engine: str
    model: str


class HealthResponse(BaseModel):
    status: str
    engine: str
    model: str
    ready: bool


class VersionResponse(BaseModel):
    service: str
    version: str
    engine: str
    model: str
    detector: str
    embedding_dim: int


class ErrorResponse(BaseModel):
    detail: str
