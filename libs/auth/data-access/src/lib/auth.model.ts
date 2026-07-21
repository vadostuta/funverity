export type Permission = 'supplier:financing' | 'supplier:view' | 'buyer:view';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  permissions: Permission[];
}

export function hasPermission(user: CurrentUser | null, permission: Permission): boolean {
  return user?.permissions.includes(permission) ?? false;
}
