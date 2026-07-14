import { apiRequest } from './api';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface CompanyUser {
  id: string;
  companyId: string;
  branchId: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string } | null;
}

export interface CompanyRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface CreateCompanyUserPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  roleId: string;
  branchId?: string;
}

export interface UpdateCompanyUserPayload {
  name?: string;
  phone?: string;
  roleId?: string;
  branchId?: string;
}

export function listCompanyUsers() {
  return apiRequest<CompanyUser[]>('/users');
}

export function getCompanyUser(id: string) {
  return apiRequest<CompanyUser>(`/users/${id}`);
}

export function createCompanyUser(payload: CreateCompanyUserPayload) {
  return apiRequest<CompanyUser>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCompanyUser(
  id: string,
  payload: UpdateCompanyUserPayload,
) {
  return apiRequest<CompanyUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateCompanyUserStatus(id: string, status: UserStatus) {
  return apiRequest<CompanyUser>(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function listCompanyRoles() {
  return apiRequest<CompanyRole[]>('/roles');
}
