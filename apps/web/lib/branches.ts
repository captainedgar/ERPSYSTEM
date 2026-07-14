import { apiRequest } from './api';

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  isMain: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  _count?: { users?: number; userMemberships?: number };
}

export interface AvailableBranch {
  id: string;
  code: string;
  name: string;
  isMain: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  city: string | null;
  province: string | null;
}

export interface AvailableBranchesResponse {
  items: AvailableBranch[];
  defaultBranchId: string | null;
  activeBranchId: string | null;
}

export interface BranchUserMembership {
  id: string;
  isDefault: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    status: string;
    role: { id: string; code: string; name: string };
  };
}

export interface UserBranchMembership {
  id: string;
  isDefault: boolean;
  branch: Branch;
}

export interface CreateBranchPayload {
  name: string;
  code: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  isMain?: boolean;
}

export type UpdateBranchPayload = Partial<CreateBranchPayload>;

export interface UpdateBranchStatusPayload {
  active: boolean;
}

export function listBranches() {
  return apiRequest<Branch[]>('/branches');
}

export function listAvailableBranches() {
  return apiRequest<AvailableBranchesResponse>('/branches/available');
}

export function getBranch(id: string) {
  return apiRequest<Branch>(`/branches/${id}`);
}

export function createBranch(payload: CreateBranchPayload) {
  return apiRequest<Branch>('/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateBranch(id: string, payload: UpdateBranchPayload) {
  return apiRequest<Branch>(`/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateBranchStatus(id: string, active: boolean) {
  const payload: UpdateBranchStatusPayload = { active };
  return apiRequest<Branch>(`/branches/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function setMainBranch(id: string) {
  return apiRequest<Branch>(`/branches/${id}/main`, { method: 'PATCH' });
}

export function listBranchUsers(branchId: string) {
  return apiRequest<BranchUserMembership[]>(`/branches/${branchId}/users`);
}

export function assignBranchUsers(
  branchId: string,
  payload: { userIds: string[]; defaultUserId?: string },
) {
  return apiRequest<BranchUserMembership[]>(`/branches/${branchId}/users`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removeBranchUser(branchId: string, userId: string) {
  return apiRequest<{ success: true }>(
    `/branches/${branchId}/users/${userId}`,
    {
      method: 'DELETE',
    },
  );
}

export function listUserBranches(userId: string) {
  return apiRequest<UserBranchMembership[]>(
    `/branches/users/${userId}/branches`,
  );
}

export function updateUserBranches(
  userId: string,
  payload: { branchIds: string[]; defaultBranchId?: string },
) {
  return apiRequest<UserBranchMembership[]>(
    `/branches/users/${userId}/branches`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}
