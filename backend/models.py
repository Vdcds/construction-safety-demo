"""Small, shared request and detection types."""

from dataclasses import dataclass
from pydantic import BaseModel, Field, model_validator


@dataclass
class Detection:
    label: str
    confidence: float
    box: tuple[float, float, float, float]
    track_id: int | None = None


class Zone(BaseModel):
    # Relative coordinates make the same zone work at every resolution.
    x1: float = Field(ge=0, le=1)
    y1: float = Field(ge=0, le=1)
    x2: float = Field(ge=0, le=1)
    y2: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def valid_rectangle(self):
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError("Draw a rectangle with a positive width and height.")
        return self


class ProcessOptions(BaseModel):
    confidence: float = Field(default=0.35, ge=0.1, le=0.9)
    proximity: int = Field(default=120, ge=20, le=500)
    zone: Zone | None = None
