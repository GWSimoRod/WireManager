import type {
  LoginRequest,
  LoginResponse,
  ConfServer,
  ServerRequestDTO,
  ConfPeer,
  PeerRequestDTO,
  Tag,
  Service,
  CreateTagPayload,
  CreateServicePayload,
  CreatePolicyPayload,
  PeerPolicy,
  SetupRequest,
  SetupStatus,
  PeerUsageHistory,
  PeerLiveStats,
  CreateUserRequest,
  UserInfo,
} from "./types";

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number | null;
}

// ─── Generic Fetch Wrapper ──────────────────────────────────────────
class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Handle 401 → redirect to login
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    }
    throw new ApiClientError("Non autenticato", 401);
  }

  if (!res.ok) {
    let message = `Errore ${res.status}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      // ignore parse errors
    }
    throw new ApiClientError(message, res.status);
  }

  // Some endpoints return empty bodies (204-like with 200 status)
  const text = await res.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}

// ─── Auth ────────────────────────────────────────────────────────────
export async function login(data: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<void> {
  await request<void>("/api/auth/logout", { method: "POST" });
}

export async function checkAuth(): Promise<{ authenticated: boolean }> {
  return request<{ authenticated: boolean }>("/api/auth/check");
}

// ─── Servers ─────────────────────────────────────────────────────────
export async function getServers(): Promise<ConfServer[]> {
  return request<ConfServer[]>("/api/servers");
}

export async function getServer(id: number): Promise<ConfServer> {
  return request<ConfServer>(`/api/servers/${id}`);
}

export async function createServer(data: ServerRequestDTO): Promise<ConfServer> {
  return request<ConfServer>("/api/servers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateServer(
  id: number,
  data: ServerRequestDTO
): Promise<ConfServer> {
  return request<ConfServer>(`/api/servers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteServer(id: number): Promise<void> {
  return request<void>(`/api/servers/${id}`, { method: "DELETE" });
}

export async function syncServer(id: number): Promise<void> {
  return request<void>(`/api/servers/${id}/sync`, { method: "POST" });
}

// ─── Peers ───────────────────────────────────────────────────────────
export async function getPeers(start?: number, end?: number, searchTerm?: string | null): Promise<PaginatedResult<ConfPeer>> {
  const query = new URLSearchParams();
  if (start !== undefined) query.append('start', start.toString());
  if (end !== undefined) query.append('end', end.toString());
  if (searchTerm) query.append('searchTerm', searchTerm);
  
  const queryString = query.toString();
  const path = queryString ? `/api/peers?${queryString}` : '/api/peers';
  
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    }
    throw new ApiClientError("Non autenticato", 401);
  }

  if (!res.ok) {
    let message = `Errore ${res.status}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      // ignore
    }
    throw new ApiClientError(message, res.status);
  }

  // The proxy route wraps the response as { data, totalCount }
  const json = await res.json() as { data: ConfPeer[]; totalCount: number | null };
  
  return {
    data: json.data ?? [],
    totalCount: json.totalCount ?? null,
  };
}

export async function getPeer(id: number): Promise<ConfPeer> {
  return request<ConfPeer>(`/api/peers/${id}`);
}

export async function createPeer(data: PeerRequestDTO): Promise<ConfPeer> {
  return request<ConfPeer>("/api/peers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePeer(
  id: number,
  data: PeerRequestDTO
): Promise<void> {
  return request<void>(`/api/peers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function togglePeer(id: number, isActive: boolean): Promise<void> {
  return request<void>(`/api/peers/${id}/status/${isActive}`, { method: "PATCH" });
}

export async function deletePeer(id: number): Promise<void> {
  return request<void>(`/api/peers/${id}`, { method: "DELETE" });
}

export async function getPeerConf(id: number): Promise<string> {
  const res = await fetch(`/api/peers/${id}/conf`);
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    }
    throw new ApiClientError("Non autenticato", 401);
  }
  if (!res.ok) {
    throw new ApiClientError(`Errore ${res.status}`, res.status);
  }
  return res.text();
}

export async function getPeerQrCodeUrl(id: number): Promise<string> {
  const res = await fetch(`/api/peers/${id}/qrcode`);
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    }
    throw new ApiClientError("Non autenticato", 401);
  }
  if (!res.ok) {
    throw new ApiClientError(`Errore ${res.status}`, res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Tags ────────────────────────────────────────────────────────────
export async function getTags(): Promise<Tag[]> {
  return request<Tag[]>("/api/tags");
}

export async function getTag(id: number): Promise<Tag> {
  return request<Tag>(`/api/tags/${id}`);
}

export async function createTag(data: CreateTagPayload): Promise<Tag> {
  return request<Tag>("/api/tags", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTag(id: number, data: CreateTagPayload): Promise<Tag> {
  return request<Tag>(`/api/tags/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTag(id: number): Promise<boolean> {
  return request<boolean>(`/api/tags/${id}`, { method: "DELETE" });
}

export async function removeTagService(tagId: number, serviceId: number): Promise<boolean> {
  return request<boolean>(`/api/tags/${tagId}/services/${serviceId}`, { method: "DELETE" });
}

// ─── Services ────────────────────────────────────────────────────────
export async function getServices(): Promise<Service[]> {
  return request<Service[]>("/api/services");
}

export async function getService(id: number): Promise<Service> {
  return request<Service>(`/api/services/${id}`);
}

export async function createService(data: CreateServicePayload): Promise<Service> {
  return request<Service>("/api/services", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteService(id: number): Promise<boolean> {
  return request<boolean>(`/api/services/${id}`, { method: "DELETE" });
}

// ─── Policies ────────────────────────────────────────────────────────
export async function createPolicy(data: CreatePolicyPayload): Promise<boolean> {
  return request<boolean>("/api/policies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Peer ↔ Policy ──────────────────────────────────────────────────
export async function getPeerPolicies(peerId: number): Promise<PeerPolicy[]> {
  return request<PeerPolicy[]>(`/api/peers/${peerId}/policies`);
}

export async function addPeerPolicy(peerId: number, policyId: number): Promise<void> {
  return request<void>(`/api/peers/${peerId}/policies/${policyId}`, {
    method: "POST",
  });
}

export async function removePeerPolicy(peerId: number, policyId: number): Promise<void> {
  return request<void>(`/api/peers/${peerId}/policies/${policyId}`, {
    method: "DELETE",
  });
}

// ─── Peer Stats ─────────────────────────────────────────────────────
export async function getPeerStats(id: number): Promise<PeerUsageHistory[]> {
  return request<PeerUsageHistory[]>(`/api/peers/${id}/stats`);
}

export async function getPeerLiveStats(id: number): Promise<PeerLiveStats> {
  return request<PeerLiveStats>(`/api/peers/${id}/live-stats`);
}

// ─── Users ───────────────────────────────────────────────────────────
export async function createUser(data: CreateUserRequest): Promise<void> {
  return request<void>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAllUsers(start?: number, end?: number, searchTerm?: string | null): Promise<PaginatedResult<UserInfo>> {
  const query = new URLSearchParams();
  if (start !== undefined) query.append('start', start.toString());
  if (end !== undefined) query.append('end', end.toString());
  if (searchTerm) query.append('searchTerm', searchTerm);
  
  const queryString = query.toString();
  const path = queryString ? `/api/auth/users?${queryString}` : '/api/auth/users';

  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        window.location.href = "/login";
      });
    }
    throw new ApiClientError("Non autenticato", 401);
  }

  if (!res.ok) {
    let message = `Errore ${res.status}`;
    try {
      const errorData = await res.text();
      if (errorData) message = errorData;
    } catch {
      // ignore
    }
    throw new ApiClientError(message, res.status);
  }
  
  return res.json();
}

export async function deleteUser(uuid: string): Promise<void> {
  return request<void>(`/api/auth/users/${uuid}`, {
    method: "DELETE",
  });
}

export async function updateUserRole(uuid: string, role: string): Promise<void> {
  return request<void>(`/api/auth/users/${uuid}/role/${role}`, {
    method: "PATCH",
  });
}

// ─── Setup ───────────────────────────────────────────────────────────
export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await fetch("/api/setup/status");
  if (!res.ok) {
    throw new ApiClientError(`Errore ${res.status}`, res.status);
  }
  return res.json();
}

export async function submitSetup(data: SetupRequest): Promise<void> {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = `Errore ${res.status}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      // ignore
    }
    throw new ApiClientError(message, res.status);
  }
}

export { ApiClientError };
