import type { OperatorRepository } from '../application/contracts.ts';
import { requestDatabase } from './database.ts';

export const operatorRepository = {
  async isOperator(userId: string): Promise<boolean> {
    return (await requestDatabase('panel_operators', 'GET', {
      select: 'id', user_id: `eq.${userId}`, limit: '1',
    })).length > 0;
  },
} satisfies OperatorRepository;
