export interface IncomingTelegramMessage {
  updateId: number;
  userId: string;
  firstName: string;
  lastName: string | null;
  author: string;
  body: string | null;
  sentAt: string;
}
