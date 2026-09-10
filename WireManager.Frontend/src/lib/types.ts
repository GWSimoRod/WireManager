// ─── Auth ────────────────────────────────────────────────────────────
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  date: string;
}

// ─── Server ──────────────────────────────────────────────────────────
export interface ConfServer {
  id: number;
  publicKey: string;
  rangeIP: string;
  listenPort: number;
  endPoint: string;
  peers?: ConfPeer[] | null;
}

export interface ServerRequestDTO {
  rangeIP: string;
  listenPort: number;
  endPoint: string;
}

// ─── Peer ────────────────────────────────────────────────────────────
export interface PeerTag {
  peerId: number;
  peer?: ConfPeer | null;
  tagId: number;
  tag?: Tag | null;
}

export interface ConfPeer {
  id: number;
  clientName: string;
  publicKey: string;
  address: string;
  dnsAddress: string;
  allowedIPs: string;
  isActive: boolean;
  confServerId: number;
  expireAt?: string | null;
  persistentKeepAlive?: number | null;
  peerTags?: PeerTag[];
}

export interface PeerRequestDTO {
  clientName: string;
  address?: string | null;
  dnsAddress: string;
  allowedIPs: string;
  confServerId: number;
  expireAt?: string | null;
  persistentKeepAlive?: number | null;
}

export interface TagService {
  tagId: number;
  tag?: Tag | null;
  serviceId: number;
  service: Service;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  services?: Service[];
  tagServices?: TagService[];
}

export interface CreateTagPayload {
  name: string;
  color: string;
  servicesId?: number[];
}

// ─── Services ────────────────────────────────────────────────────────
export interface Service {
  id: number;
  name: string;
  port: number;
  protocol: string;
  targetIp: string;
  domain?: string | null;
  isGlobal: boolean;
  tags?: Tag[];
}

export interface CreateServicePayload {
  name: string;
  port: number;
  protocol: string;
  targetIp: string;
  domain?: string;
  isGlobal?: boolean;
  tagsId?: number[];
}

// ─── Policy ─────────────────────────────────────────────────────────
export interface CreatePolicyPayload {
  tagID: number;
  serviceId: number[];
}

export interface PeerPolicy {
  id: number;
  tag: Tag;
  services: Service[];
}

// ─── Setup ──────────────────────────────────────────────────────────
export interface SetupRequest {
  AdminUsername: string;
  AdminPassword: string;
  ExecutionMode: boolean;
  ContainerWireguardName: string;
}

export interface SetupStatus {
  isSetupCompleted: boolean;
}

// ─── Peer Stats ─────────────────────────────────────────────────────
export interface PeerUsageHistory {
  id: number;
  publicKey: string;
  rxBytesRaw: number;
  txBytesRaw: number;
  deltaTxBytes: number;
  deltaRxBytes: number;
  timestamp: string;
  peer: unknown | null;
}

export interface PeerLiveStats {
  publicKey: string;
  latestHandshake: string | null;
  rxBytes: number;
  txBytes: number;
}

// ─── Users ──────────────────────────────────────────────────────────
export interface CreateUserRequest {
  Username: string;
  Password: string;
  Role: string;
}

export interface UserInfo {
  uuid: string;
  username: string;
  role: string;
}

// ─── Audit ──────────────────────────────────────────────────────────
export interface AuditLog {
  id: number;
  timestamp: string;
  actorId: string;
  actorType: string;
  action: string;
  entity: string;
  entityId: string | null;
  isSuccess: boolean;
  details: string | null;
}

// ─── API Response Helpers ────────────────────────────────────────────
export interface ApiError {
  message: string;
  status: number;
}
