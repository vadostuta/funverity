export interface OneshotE2ESchema {
  story: string;
  featureLib?: string;
  referenceSpec?: string;
  model?: string;
  timeoutMinutes?: number;
  skipPermissions?: boolean;
  maxRetries?: number;
}
