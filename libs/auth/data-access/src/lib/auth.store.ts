import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { CurrentUser, hasPermission, Permission } from './auth.model';

export type AppRole = 'default' | 'supplier-financing';

const ROLE_USERS: Record<AppRole, CurrentUser> = {
  'default': {
    id: 'user-default',
    name: 'Default User',
    email: 'default@demo.com',
    permissions: ['supplier:view'],
  },
  'supplier-financing': {
    id: 'user-supplier',
    name: 'Demo Supplier',
    email: 'supplier@demo.com',
    permissions: ['supplier:view', 'supplier:financing'],
  },
};

interface AuthState {
  currentUser: CurrentUser | null;
  activeRole: AppRole;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({
    currentUser: ROLE_USERS['default'],
    activeRole: 'default',
  }),
  withComputed(({ currentUser }) => ({
    isAuthenticated: computed(() => currentUser() !== null),
    hasFinancingPermission: computed(() =>
      hasPermission(currentUser(), 'supplier:financing'),
    ),
  })),
  withMethods((store) => ({
    can(permission: Permission): boolean {
      return hasPermission(store.currentUser(), permission);
    },
    setRole(role: AppRole): void {
      patchState(store, { currentUser: ROLE_USERS[role], activeRole: role });
    },
  })),
);
