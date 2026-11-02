from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: Literal["user", "reviewer"] = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DocumentSummary(BaseModel):
    id: int
    filename: str
    file_path: str
    uploaded_at: datetime
    user_id: int
    status: str
    uploader_email: str | None = None
    feedback: str | None = None

    model_config = ConfigDict(from_attributes=True)


class FeedbackCreate(BaseModel):
    feedback_text: str = Field(..., min_length=1, max_length=5000)


class FeedbackResponse(BaseModel):
    id: int
    document_id: int
    reviewer_id: int
    reviewer_email: str | None = None
    feedback_text: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentStatusUpdate(BaseModel):
    status: Literal["Pending Review", "Reviewed"]


class DocumentDetail(BaseModel):
    id: int
    filename: str
    file_path: str
    uploaded_at: datetime
    user_id: int
    status: str
    uploader_email: str | None = None
    feedbacks: list[FeedbackResponse] = []

    model_config = ConfigDict(from_attributes=True)
