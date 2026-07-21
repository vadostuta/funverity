import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppRole, AuthStore } from '@org/auth/data-access';

interface RoleOption {
  id: AppRole;
  label: string;
  description: string;
  permissions: string[];
}

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  protected readonly authStore = inject(AuthStore);

  protected readonly roles: RoleOption[] = [
    {
      id: 'default',
      label: 'Default User',
      description: 'Can view invoices but cannot request financing.',
      permissions: ['supplier:view'],
    },
    {
      id: 'supplier-financing',
      label: 'Supplier (Financing)',
      description: 'Can view invoices and request financing on eligible invoices.',
      permissions: ['supplier:view', 'supplier:financing'],
    },
  ];

  protected selectRole(role: AppRole): void {
    this.authStore.setRole(role);
  }
}
