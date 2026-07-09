import { join, sep } from 'node:path';

export function getApiRoot() {
  return process.cwd().endsWith(`${sep}apps${sep}api`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'api');
}

export function getCompanyLogoUploadRoot() {
  return join(getApiRoot(), 'uploads', 'company-logos');
}
