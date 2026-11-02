import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import api from './api';
import type { DocumentItem, User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hydrateUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading your workspace...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            user.role === 'reviewer' ? (
              <ReviewerDashboard user={user} onLogout={handleLogout} />
            ) : (
              <UserDashboard user={user} onLogout={handleLogout} />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : <AuthPage mode="login" onAuthenticated={hydrateUser} />
        }
      />
      <Route
        path="/register"
        element={
          user ? <Navigate to="/" replace /> : <AuthPage mode="register" onAuthenticated={hydrateUser} />
        }
      />
    </Routes>
  );
}

function AuthPage({
  mode,
  onAuthenticated,
}: {
  mode: 'login' | 'register';
  onAuthenticated: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'register') {
        await api.post('/auth/register', {
          email,
          password,
          role: 'user',
        });
        setMessage({ type: 'success', text: 'Registration successful. Please log in.' });
        setTimeout(() => navigate('/login'), 600);
      } else {
        const response = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', response.data.access_token);
        await onAuthenticated();
        navigate('/');
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.detail || 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Document Review</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-0 transition focus:border-sky-400 focus:bg-white"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none ring-0 transition focus:border-sky-400 focus:bg-white"
              placeholder="At least 8 characters"
              required
            />
          </div>

          {message && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                message.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="font-semibold text-sky-600 underline-offset-4 hover:underline"
            onClick={() => navigate(mode === 'login' ? '/register' : '/login')}
          >
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/documents/my');
      setDocuments(response.data);
    } catch (error: any) {
      setNotice({
        type: 'error',
        text: error?.response?.data?.detail || 'Could not load your documents.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setNotice({ type: 'error', text: 'Select a PDF, PNG, or JPG file first.' });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setUploading(true);
    setNotice(null);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNotice({ type: 'success', text: 'Document uploaded successfully.' });
      setSelectedFile(null);
      const fileInput = document.getElementById('document-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      await fetchDocuments();
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'Upload failed.';
      setNotice({ type: 'error', text: detail });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const response = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const contentType =
        typeof response.headers['content-type'] === 'string'
          ? response.headers['content-type']
          : 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setNotice({ type: 'error', text: error?.response?.data?.detail || 'Unable to download document' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">User Portal</p>
            <h1 className="text-xl font-bold text-slate-900">Document Review Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              {user.email}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Upload a document</h2>
              <p className="text-sm text-slate-600">Accepted types: PDF, PNG, JPG, and JPEG.</p>
            </div>
          </div>

          <form onSubmit={onUpload} className="mt-5 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-slate-700">Choose document</label>
              <input
                id="document-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedFile(event.target.files?.[0] || null)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
              />
            </div>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="rounded-xl bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>

          {notice && (
            <div
              className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {notice.text}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">My uploads</h2>
          </div>

          {loading ? (
            <div className="text-sm text-slate-600">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              No documents yet. Upload your first file above.
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((document) => (
                <div key={document.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{document.filename}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Uploaded {new Date(document.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`status-badge ${
                          document.status === 'Reviewed' ? 'status-reviewed' : 'status-pending'
                        }`}
                      >
                        {document.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownload(document)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Download
                      </button>
                    </div>
                  </div>

                  {document.feedback ? (
                    <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-800">
                      <p className="font-medium">Reviewer feedback</p>
                      <p className="mt-1 whitespace-pre-wrap">{document.feedback}</p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      No feedback submitted yet.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ReviewerDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/reviewer/documents');
      setDocuments(response.data);
    } catch (error: any) {
      setNotice({
        type: 'error',
        text: error?.response?.data?.detail || 'Could not load review queue.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const response = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const contentType =
        typeof response.headers['content-type'] === 'string'
          ? response.headers['content-type']
          : 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setNotice({ type: 'error', text: error?.response?.data?.detail || 'Unable to download file.' });
    }
  };

  const submitFeedback = async (documentId: number) => {
    const text = (feedbackDrafts[documentId] || '').trim();
    if (!text) {
      setNotice({ type: 'error', text: 'Feedback cannot be empty.' });
      return;
    }

    try {
      await api.post(`/reviewer/documents/${documentId}/feedback`, { feedback_text: text });
      setFeedbackDrafts((current) => ({ ...current, [documentId]: '' }));
      setNotice({ type: 'success', text: 'Feedback submitted successfully.' });
      await fetchDocuments();
    } catch (error: any) {
      setNotice({
        type: 'error',
        text: error?.response?.data?.detail || 'Unable to submit feedback.',
      });
    }
  };

  const updateStatus = async (documentId: number, status: 'Pending Review' | 'Reviewed') => {
    try {
      await api.patch(`/reviewer/documents/${documentId}/status`, { status });
      setNotice({ type: 'success', text: 'Document status updated.' });
      await fetchDocuments();
    } catch (error: any) {
      setNotice({
        type: 'error',
        text: error?.response?.data?.detail || 'Unable to update document status.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Reviewer Portal</p>
            <h1 className="text-xl font-bold text-slate-900">Review Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              {user.email}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {notice && (
          <div
            className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
              notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {notice.text}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Loading documents for review...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600 shadow-sm">
            No submitted documents yet.
          </div>
        ) : (
          <div className="space-y-5">
            {documents.map((document) => (
              <div key={document.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{document.filename}</h2>
                    <p className="text-sm text-slate-500">
                      Submitted by {document.uploader_email || 'Unknown'} on{' '}
                      {new Date(document.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`status-badge ${
                        document.status === 'Reviewed' ? 'status-reviewed' : 'status-pending'
                      }`}
                    >
                      {document.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(document)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Download
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Reviewer feedback</label>
                    <textarea
                      value={feedbackDrafts[document.id] || ''}
                      onChange={(event) =>
                        setFeedbackDrafts((current) => ({
                          ...current,
                          [document.id]: event.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-sky-400 focus:bg-white"
                      placeholder="Provide clear evaluation notes..."
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => submitFeedback(document.id)}
                        className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
                      >
                        Submit feedback
                      </button>
                      {document.status === 'Reviewed' ? (
                        <button
                          type="button"
                          onClick={() => updateStatus(document.id, 'Pending Review')}
                          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateStatus(document.id, 'Reviewed')}
                          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Mark reviewed
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">Latest feedback</p>
                    {document.feedback ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{document.feedback}</p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No feedback yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
