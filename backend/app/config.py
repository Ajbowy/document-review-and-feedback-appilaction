import os
from pathlib import Path

from dotenv import dotenv_values
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

if ENV_PATH.exists():
    for key, value in dotenv_values(str(ENV_PATH)).items():
        if value is not None:
            os.environ[key] = value


class Settings(BaseSettings):
    app_name: str = "Document Review App"
    database_url: str = "sqlite:///./app.db"
    secret_key: str = "dev-secret-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    upload_dir: str = "./uploads"
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def upload_dir_path(self) -> Path:
        return Path(self.upload_dir)


settings = Settings()
