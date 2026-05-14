import { userRepo, userNotificationRepo } from "@/lib/repository/server";
import NotificationsClient from "./NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await userRepo.getCurrent();
  const userId = me?.id;
  if (!userId) {
    return <NotificationsClient notifications={[]} unreadCount={0} />;
  }
  const [notifications, unreadCount] = await Promise.all([
    userNotificationRepo
      .list({ userId, limit: 200 })
      .catch(() => []),
    userNotificationRepo.countUnread(userId).catch(() => 0)
  ]);
  return (
    <NotificationsClient
      notifications={notifications}
      unreadCount={unreadCount}
    />
  );
}
