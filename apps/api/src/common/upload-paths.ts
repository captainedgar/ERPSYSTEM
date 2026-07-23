import { isAbsolute, join, resolve, sep } from 'node:path';

export function getApiRoot() {
  return process.cwd().endsWith(`${sep}apps${sep}api`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'api');
}

export function getCompanyLogoUploadRoot() {
  return join(getUploadsRoot(), 'company-logos');
}

export function getCompanyProductUploadRoot() {
  return join(getUploadsRoot(), 'companies');
}

export function getUploadsRoot() {
  const configured = process.env.UPLOADS_DIR?.trim() || 'uploads';
  return isAbsolute(configured)
    ? resolve(configured)
    : resolve(getApiRoot(), configured);
}
