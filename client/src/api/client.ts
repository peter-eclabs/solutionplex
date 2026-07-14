import { TOKEN_KEY } from '../auth/jwt';
import type { UserRole } from '../auth/jwt';

export interface ProblemShort {
  id: string;
  code?: string | null;
  title: string;
}

export interface SolutionShort {
  id: string;
  code?: string | null;
  title: string;
}

export interface ArchitectureShort {
  id: string;
  code?: string | null;
  title: string;
}

export interface InfrastructureShort {
  id: string;
  code?: string | null;
  title: string;
}

export interface AppShort {
  id: string;
  code?: string | null;
  title: string;
  hidden?: boolean | null;
  created_at?: string;
}

export interface Problem {
  id: string;
  code?: string | null;
  title: string;
  description: string;
  hidden?: boolean;
  solutions: SolutionShort[];
  created_at: string;
  updated_at: string;
}

export interface Architecture {
  id: string;
  code?: string | null;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Infrastructure {
  id: string;
  code?: string | null;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Solution {
  id: string;
  code?: string | null;
  title: string;
  description: string;
  problem: ProblemShort | null;
  /** Solution-owned labels (edit forms). */
  architectures: ArchitectureShort[];
  infrastructures: InfrastructureShort[];
  /** Card preview: solution-owned ∪ linked apps' labels (display only). */
  effective_architectures?: ArchitectureShort[];
  effective_infrastructures?: InfrastructureShort[];
  apps: AppShort[];
  created_at: string;
  updated_at: string;
  hidden?: boolean;
}

export interface AppPrototype {
  id: string;
  code?: string | null;
  title: string;
  description: string;
  github_url: string;
  live_url?: string;
  problem: ProblemShort | null;
  solutions: SolutionShort[];
  solution: SolutionShort | null;
  architectures: ArchitectureShort[];
  infrastructures: InfrastructureShort[];
  created_at: string;
  updated_at: string;
  hidden?: boolean;
}

const API_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorMsg = await response.text();
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.reload();
      throw new ApiError(401, 'Session expired');
    }
    throw new ApiError(
      response.status,
      errorMsg || `API request failed with status ${response.status}`,
    );
  }
  try {
    const data: T = await response.json();
    return data;
  } catch {
    throw new Error('Server returned a non-JSON response. Is the API server running?');
  }
}

export const api = {
  // Problem endpoints
  getProblems: (q?: string) => request<Problem[]>(`/api/problems/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getProblem: (id: string) => request<Problem>(`/api/problems/${id}`),
  createProblem: (data: { title: string; description: string; hidden?: boolean }) =>
    request<Problem>('/api/problems/', { method: 'POST', body: JSON.stringify(data) }),
  updateProblem: (id: string, data: { title?: string; description?: string; hidden?: boolean }) =>
    request<Problem>(`/api/problems/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProblem: (id: string) =>
    request<{ detail: string }>(`/api/problems/${id}`, { method: 'DELETE' }),

  // Architecture endpoints
  getArchitectures: (q?: string) => request<Architecture[]>(`/api/architectures/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getArchitecture: (id: string) => request<Architecture>(`/api/architectures/${id}`),
  createArchitecture: (data: { title: string; description: string }) =>
    request<Architecture>('/api/architectures/', { method: 'POST', body: JSON.stringify(data) }),
  updateArchitecture: (id: string, data: { title?: string; description?: string }) =>
    request<Architecture>(`/api/architectures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArchitecture: (id: string) =>
    request<{ detail: string }>(`/api/architectures/${id}`, { method: 'DELETE' }),

  // Infrastructure endpoints
  getInfrastructures: (q?: string) => request<Infrastructure[]>(`/api/infrastructures/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getInfrastructure: (id: string) => request<Infrastructure>(`/api/infrastructures/${id}`),
  createInfrastructure: (data: { title: string; description: string }) =>
    request<Infrastructure>('/api/infrastructures/', { method: 'POST', body: JSON.stringify(data) }),
  updateInfrastructure: (id: string, data: { title?: string; description?: string }) =>
    request<Infrastructure>(`/api/infrastructures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInfrastructure: (id: string) =>
    request<{ detail: string }>(`/api/infrastructures/${id}`, { method: 'DELETE' }),

  // Solution endpoints
  getSolutions: (q?: string) => request<Solution[]>(`/api/solutions/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getSolution: (id: string) => request<Solution>(`/api/solutions/${id}`),
  createSolution: (data: { title: string; description: string; problem_id: string; architecture_ids: string[]; infrastructure_ids: string[] }) =>
    request<Solution>('/api/solutions/', { method: 'POST', body: JSON.stringify(data) }),
  updateSolution: (id: string, data: { title?: string; description?: string; problem_id?: string; architecture_ids?: string[]; infrastructure_ids?: string[] }) =>
    request<Solution>(`/api/solutions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSolution: (id: string) =>
    request<{ detail: string }>(`/api/solutions/${id}`, { method: 'DELETE' }),

  // App endpoints
  getApps: (q?: string) => request<AppPrototype[]>(`/api/apps/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getApp: (id: string) => request<AppPrototype>(`/api/apps/${id}`),
  createApp: (data: { title: string; description: string; github_url: string; live_url?: string; solution_id?: string; architecture_ids?: string[]; infrastructure_ids?: string[] }) =>
    request<AppPrototype>('/api/apps/', { method: 'POST', body: JSON.stringify(data) }),
  updateApp: (id: string, data: { title?: string; description?: string; github_url?: string; live_url?: string; solution_id?: string; architecture_ids?: string[]; infrastructure_ids?: string[] }) =>
    request<AppPrototype>(`/api/apps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteApp: (id: string) =>
    request<{ detail: string }>(`/api/apps/${id}`, { method: 'DELETE' }),
  getReadme: (githubUrl: string) => request<{ readme_content: string }>(`/api/apps/readme?github_url=${encodeURIComponent(githubUrl)}`),
};

/**
 * Auth endpoints. Login uses form-urlencoded (OAuth2PasswordRequestForm);
 * register uses JSON via the shared request helper.
 */
export const authApi = {
  /**
   * Obtain a JWT via OAuth2 password grant.
   * Form field `username` is the user's email.
   */
  login: (email: string, password: string): Promise<TokenResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    return fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.text();
        let detail = body;
        try {
          const parsed = JSON.parse(body) as { detail?: unknown };
          if (typeof parsed.detail === 'string') {
            detail = parsed.detail;
          }
        } catch {
          // keep raw body
        }
        throw new Error(detail || 'Login failed');
      }
      return res.json() as Promise<TokenResponse>;
    });
  },

  /**
   * Register a new user. Default role is reader when omitted.
   */
  register: (email: string, password: string, role?: UserRole) =>
    request<UserResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(
        role !== undefined ? { email, password, role } : { email, password }
      ),
    }),

  /** Current authenticated user from the Bearer token. */
  me: () => request<UserResponse>('/api/auth/me'),
};

/**
 * Superadmin-only user administration endpoints.
 */
export const adminApi = {
  /** List all users (id, email, role). */
  listUsers: () => request<UserResponse[]>('/api/admin/users'),

  /** Set a user's role (e.g. grant admin). */
  setRole: (userId: string, role: UserRole) =>
    request<UserResponse>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
};
