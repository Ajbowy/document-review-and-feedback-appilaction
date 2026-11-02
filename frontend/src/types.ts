export type UserRole = 'user' | 'reviewer';
export type DocumentStatus = 'Pending Review' | 'Reviewed';

export type User = {
  id: number;
  email: string;
  role: UserRole | string;
  created_at: string;
};

export type Feedback = {
  id: number;
  document_id: number;
  reviewer_id: number;
  reviewer_email?: string;
  feedback_text: string;
  created_at: string;
};

export type DocumentItem = {
  id: number;
  filename: string;
  file_path: string;
  uploaded_at: string;
  user_id: number;
  status: DocumentStatus;
  uploader_email?: string;
  feedback?: string;
  feedbacks?: Feedback[];
};
