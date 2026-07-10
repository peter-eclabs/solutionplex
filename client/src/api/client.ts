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
  created_at: string;
  updated_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
  const data: T = await response.json();
  return data;
}

export const api = {
  // Problem endpoints
  getProblems: (q?: string) => request<Problem[]>(`/api/problems/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createProblem: (data: { title: string; description: string }) => 
    request<Problem>('/api/problems/', { method: 'POST', body: JSON.stringify(data) }),

  // Architecture endpoints
  getArchitectures: (q?: string) => request<Architecture[]>(`/api/architectures/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createArchitecture: (data: { title: string; description: string }) => 
    request<Architecture>('/api/architectures/', { method: 'POST', body: JSON.stringify(data) }),

  // Infrastructure endpoints
  getInfrastructures: (q?: string) => request<Infrastructure[]>(`/api/infrastructures/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createInfrastructure: (data: { title: string; description: string }) => 
    request<Infrastructure>('/api/infrastructures/', { method: 'POST', body: JSON.stringify(data) }),

  // Solution endpoints
  getSolutions: (q?: string) => request<Solution[]>(`/api/solutions/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createSolution: (data: { title: string; description: string; problem_id: string; architecture_ids: string[]; infrastructure_ids: string[] }) => 
    request<Solution>('/api/solutions/', { method: 'POST', body: JSON.stringify(data) }),

  // App endpoints
  getApps: (q?: string) => request<AppPrototype[]>(`/api/apps/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createApp: (data: { title: string; description: string; github_url: string; live_url?: string; problem_id: string }) => 
    request<AppPrototype>('/api/apps/', { method: 'POST', body: JSON.stringify(data) }),
  getReadme: (githubUrl: string) => request<{ readme_content: string }>(`/api/apps/readme?github_url=${encodeURIComponent(githubUrl)}`),
};
