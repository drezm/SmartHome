import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { NotificationRow } from "@/entities/notification/NotificationRow";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Tabs } from "@/shared/ui/Tabs";

type NotificationTab = "all" | "unread" | "system";

export function NotificationsPage() {
  const [tab, setTab] = useState<NotificationTab>("all");
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: queryKeys.notifications, queryFn: api.notifications });
  const mutation = useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      ]);
    }
  });

  const items = useMemo(() => {
    const source = notifications.data?.notifications ?? [];
    if (tab === "unread") return source.filter((item) => item.unread);
    if (tab === "system") return source.filter((item) => item.type === "system");
    return source;
  }, [notifications.data?.notifications, tab]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Уведомления</CardTitle>
          <CardDescription>Все события и предупреждения умного дома</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "all", label: "Все" },
              { value: "unread", label: "Непрочитанные" },
              { value: "system", label: "Системные" }
            ]}
          >
            <div className="space-y-4">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} onClick={() => item.unread && mutation.mutate(item.id)} />
              ))}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
