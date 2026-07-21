import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  let store: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(AuthStore);
  });

  describe('initial state', () => {
    it('starts on the default role with the default user', () => {
      expect(store.activeRole()).toBe('default');
      expect(store.currentUser()).toEqual({
        id: 'user-default',
        name: 'Default User',
        email: 'default@demo.com',
        permissions: ['supplier:view'],
      });
    });

    it('is authenticated when a user is present', () => {
      expect(store.isAuthenticated()).toBe(true);
    });

    it('has no financing permission on the default role', () => {
      expect(store.hasFinancingPermission()).toBe(false);
    });
  });

  describe('can', () => {
    it('returns true for permissions held by the current user', () => {
      expect(store.can('supplier:view')).toBe(true);
    });

    it('returns false for permissions not held by the current user', () => {
      expect(store.can('supplier:financing')).toBe(false);
      expect(store.can('buyer:view')).toBe(false);
    });
  });

  describe('setRole', () => {
    it('swaps to the supplier-financing role and user', () => {
      store.setRole('supplier-financing');

      expect(store.activeRole()).toBe('supplier-financing');
      expect(store.currentUser()).toEqual({
        id: 'user-supplier',
        name: 'Demo Supplier',
        email: 'supplier@demo.com',
        permissions: ['supplier:view', 'supplier:financing'],
      });
    });

    it('grants financing permission after switching to supplier-financing', () => {
      store.setRole('supplier-financing');

      expect(store.hasFinancingPermission()).toBe(true);
      expect(store.can('supplier:financing')).toBe(true);
      expect(store.can('supplier:view')).toBe(true);
    });

    it('reverts to the default user when switching back', () => {
      store.setRole('supplier-financing');
      store.setRole('default');

      expect(store.activeRole()).toBe('default');
      expect(store.currentUser()?.id).toBe('user-default');
      expect(store.hasFinancingPermission()).toBe(false);
    });
  });
});
