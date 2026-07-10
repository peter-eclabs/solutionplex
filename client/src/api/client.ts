export interface ProblemShort {
  id: string;
  title: string;
}

export interface SolutionShort {
  id: string;
  title: string;
}

export interface ArchitectureShort {
  id: string;
  title: string;
}

export interface InfrastructureShort {
  id: string;
  title: string;
}

export interface AppShort {
  id: string;
  title: string;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  solutions: SolutionShort[];
  created_at: string;
  updated_at: string;
}

export interface Architecture {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Infrastructure {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Solution {
  id: string;
  title: string;
  description: string;
  problem: ProblemShort | null;
  architectures: ArchitectureShort[];
  infrastructures: InfrastructureShort[];
  apps: AppShort[];
  created_at: string;
  updated_at: string;
}

export interface AppPrototype {
  id: string;
  title: string;
  description: string;
  github_url: string;
  live_url?: string;
  problem: ProblemShort | null;
  solutions: SolutionShort[];
  created_at: string;
  updated_at: string;
}

const API_URL = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const errorMsg = await response.text();
    throw new Error(errorMsg || `API request failed with status ${response.status}`);
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
  createProblem: (data: { title: string; description: string }) =>
    request<Problem>('/api/problems/', { method: 'POST', body: JSON.stringify(data) }),
  updateProblem: (id: string, data: { title?: string; description?: string }) =>
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
  createApp: (data: { title: string; description: string; github_url: string; live_url?: string; problem_id: string }) =>
    request<AppPrototype>('/api/apps/', { method: 'POST', body: JSON.stringify(data) }),
  updateApp: (id: string, data: { title?: string; description?: string; github_url?: string; live_url?: string; problem_id?: string }) =>
    request<AppPrototype>(`/api/apps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteApp: (id: string) =>
    request<{ detail: string }>(`/api/apps/${id}`, { method: 'DELETE' }),
  getReadme: (githubUrl: string) => request<{ readme_content: string }>(`/api/apps/readme?github_url=${encodeURIComponent(githubUrl)}`),
};
