export interface VerifyE2ESchema {
  file: string;
  heal?: boolean;
  maxRetries?: number;
  model?: string;
  timeoutMinutes?: number;
  skipPermissions?: boolean;
}
