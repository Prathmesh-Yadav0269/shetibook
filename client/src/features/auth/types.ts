export interface User {
  id: string;
  phoneNumber: string;
  status: string;
  createdAt?: string;
}

export interface UserGroupInfo {
  id: string;
  name: string;
  role: 'owner' | 'member';
  joinedAt: string;
  memberCount?: number;
}

export interface RegisterResponse {
  userId: string;
  phoneNumber: string;
  recoveryCode: string;
  message: string;
}

export interface LoginResponse {
  user: User;
  groups: UserGroupInfo[];
}

export interface MeResponse {
  user: User;
  groups: UserGroupInfo[];
}
