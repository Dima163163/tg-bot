import { webhookAccess } from '../adapters/webhook-access.ts';

export const authorizeWebhookUseCase = {
  execute(secret: string) { return webhookAccess.authorize(secret); },
};
