/** One browser's Web Push subscription (PushSubscription.toJSON()), owned by one user. */
export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
}
