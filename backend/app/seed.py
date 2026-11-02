from app.database import SessionLocal, create_db_and_tables
from app.models import User
from app.security import get_password_hash


def seed_demo_accounts() -> None:
    create_db_and_tables()
    db = SessionLocal()

    demo_users = [
        ("user@example.com", "user"),
        ("reviewer@example.com", "reviewer"),
    ]

    for email, role in demo_users:
        existing_user = db.query(User).filter(User.email == email).first()
        if not existing_user:
            db.add(
                User(
                    email=email,
                    hashed_password=get_password_hash("Password123!"),
                    role=role,
                )
            )

    db.commit()
    db.close()
    print("Demo accounts seeded successfully.")


if __name__ == "__main__":
    seed_demo_accounts()
