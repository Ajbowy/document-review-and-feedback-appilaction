from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import create_db_and_tables, get_db
from app.dependencies import get_current_reviewer, get_current_user
from app.models import Document, Feedback, User
from app.schemas import (
    DocumentDetail,
    DocumentStatusUpdate,
    DocumentSummary,
    FeedbackCreate,
    FeedbackResponse,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.security import create_access_token, get_password_hash, verify_password
from app.storage import ensure_upload_dir, save_uploaded_document

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    create_db_and_tables()
    ensure_upload_dir()


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Document Review app is running"}


@app.post("/auth/register", response_model=UserResponse)
def register_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    normalized_email = payload.email.lower()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.role not in {"user", "reviewer"}:
        raise HTTPException(status_code=400, detail="Role must be either user or reviewer")

    user = User(
        email=normalized_email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> dict[str, str]:
    normalized_email = payload.email.lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user.email})
    return {"access_token": token}


@app.get("/auth/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@app.post("/documents/upload")
def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if current_user.role != "user":
        raise HTTPException(status_code=403, detail="Only regular users can upload documents")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    saved_path, _ = save_uploaded_document(file)
    doc = Document(
        filename=file.filename,
        file_path=saved_path,
        user_id=current_user.id,
        status="Pending Review",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {
        "message": "Document uploaded successfully",
        "document_id": doc.id,
        "status": doc.status,
    }


@app.get("/documents/my", response_model=list[DocumentSummary])
def list_my_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentSummary]:
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    result: list[DocumentSummary] = []
    for doc in docs:
        latest_feedback = (
            db.query(Feedback)
            .filter(Feedback.document_id == doc.id)
            .order_by(Feedback.created_at.desc())
            .first()
        )
        result.append(
            DocumentSummary(
                id=doc.id,
                filename=doc.filename,
                file_path=doc.file_path,
                uploaded_at=doc.uploaded_at,
                user_id=doc.user_id,
                status=doc.status,
                uploader_email=current_user.email,
                feedback=latest_feedback.feedback_text if latest_feedback else None,
            )
        )
    return result


@app.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document_details(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentDetail:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role != "reviewer" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this document")

    feedbacks = (
        db.query(Feedback)
        .filter(Feedback.document_id == document_id)
        .order_by(Feedback.created_at.desc())
        .all()
    )

    return DocumentDetail(
        id=doc.id,
        filename=doc.filename,
        file_path=doc.file_path,
        uploaded_at=doc.uploaded_at,
        user_id=doc.user_id,
        status=doc.status,
        uploader_email=doc.user.email if doc.user else None,
        feedbacks=[
            FeedbackResponse(
                id=f.id,
                document_id=f.document_id,
                reviewer_id=f.reviewer_id,
                reviewer_email=f.reviewer.email if f.reviewer else None,
                feedback_text=f.feedback_text,
                created_at=f.created_at,
            )
            for f in feedbacks
        ],
    )


@app.get("/documents/{document_id}/download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if current_user.role != "reviewer" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this document")

    if not doc.file_path:
        raise HTTPException(status_code=404, detail="Document file is missing")

    return FileResponse(
        path=doc.file_path,
        filename=doc.filename,
        media_type="application/octet-stream",
    )


@app.get("/reviewer/documents", response_model=list[DocumentSummary])
def reviewer_documents(
    current_user: User = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
) -> list[DocumentSummary]:
    docs = db.query(Document).order_by(Document.uploaded_at.desc()).all()
    result: list[DocumentSummary] = []
    for doc in docs:
        latest_feedback = (
            db.query(Feedback)
            .filter(Feedback.document_id == doc.id)
            .order_by(Feedback.created_at.desc())
            .first()
        )
        result.append(
            DocumentSummary(
                id=doc.id,
                filename=doc.filename,
                file_path=doc.file_path,
                uploaded_at=doc.uploaded_at,
                user_id=doc.user_id,
                status=doc.status,
                uploader_email=doc.user.email if doc.user else None,
                feedback=latest_feedback.feedback_text if latest_feedback else None,
            )
        )
    return result


@app.post("/reviewer/documents/{document_id}/feedback", response_model=FeedbackResponse)
def submit_feedback(
    document_id: int,
    payload: FeedbackCreate,
    current_user: User = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
) -> Feedback:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    feedback = Feedback(
        document_id=document_id,
        reviewer_id=current_user.id,
        feedback_text=payload.feedback_text.strip(),
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@app.patch("/reviewer/documents/{document_id}/status")
def update_document_status(
    document_id: int,
    payload: DocumentStatusUpdate,
    current_user: User = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = payload.status
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"document_id": doc.id, "status": doc.status, "message": "Status updated"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
