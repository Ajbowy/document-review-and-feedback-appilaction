# Document Review and Feedback Web Application

A full-stack document review application built with React + TypeScript + Tailwind on the frontend and FastAPI + SQLAlchemy on the backend.

## Features

- User registration and login with JWT authentication
- Role-based access control for regular users and reviewers
- PDF, JPG, JPEG, and PNG uploads with validation
- Document metadata storage and status tracking
- Reviewer dashboard with feedback submission and status updates
- Document download and owner feedback visibility
- Local SQLite database by default with optional PostgreSQL support

## Default Demo Credentials

Create these accounts by running the seed command below, then use them for demonstration:

- Regular user: `user@example.com` / `Password123!`
- Reviewer: `reviewer@example.com` / `Password123!`

## Project Structure

- `backend/` – FastAPI application and SQLAlchemy models
- `frontend/` – React + Vite + Tailwind frontend
- `.env.example` – environment template

## Quick Start

### 1) Configure environment

Copy the example file into the backend environment settings used by the app:

```bash
cp .env.example backend/.env
```

Then update the values as needed. The backend reads the local backend `.env` file automatically.

### 2) Install backend dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed
```

### 3) Start the backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4) Install frontend dependencies

In a second terminal:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

The frontend runs at `http://localhost:5173` by default.

## API Overview

The backend exposes endpoints for auth, document upload, document access, and reviewer actions.

## Notes

- Uploaded files are stored locally under `backend/uploads/`.
- The app uses SQLite by default for easy local development.
- Set `DATABASE_URL` to a PostgreSQL connection string for Supabase or another PostgreSQL deployment.
- The `.env` file and uploaded documents are intentionally excluded from Git.

## Known limitations

- File preview is via browser download/open behavior rather than an in-app PDF viewer.
- This is designed for local development and demonstration rather than production-scale workload handling.
