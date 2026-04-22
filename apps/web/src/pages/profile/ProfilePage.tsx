import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ban, Bot, CheckCircle2, CreditCard, Send, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Subscription, TelegramIntegration } from "@/shared/api/types";
import { Avatar, AvatarFallback } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { LockedPreview } from "@/shared/ui/LockedPreview";
import { Select } from "@/shared/ui/Select";
import { Tabs } from "@/shared/ui/Tabs";

type ProfileTab = "profile" | "subscription" | "security" | "integrations";

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProfileTab>("profile");
  const subscription = useQuery({ queryKey: queryKeys.subscription, queryFn: api.subscription });
  const [firstName = "M", secondName = "S"] = (user?.name ?? "Матвей Саблуков").split(" ");
  const initials = `${firstName[0] ?? "M"}${secondName[0] ?? "S"}`.toUpperCase();
  const currentSubscription = subscription.data?.subscription;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Личный кабинет</CardTitle>
          <CardDescription>Профиль пользователя и параметры безопасности</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "profile", label: "Профиль" },
              { value: "subscription", label: "Подписка" },
              { value: "security", label: "Безопасность" },
              { value: "integrations", label: "Интеграции" }
            ]}
          >
            {tab === "profile" ? (
              <div className="grid gap-6 xl:grid-cols-[280px,1fr]">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="h-28 w-28 ring-2 ring-violet-400/20">
                      <AvatarFallback className="bg-violet-500/20 text-2xl text-violet-200">{initials}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input defaultValue={user?.name ?? ""} />
                  <Input defaultValue={user?.email ?? ""} />
                  <Input defaultValue="+7 (999) 123-45-67" />
                  <Select defaultValue="Europe/Moscow">
                    <option value="Europe/Moscow">Europe/Moscow</option>
                    <option value="Europe/Helsinki">Europe/Helsinki</option>
                  </Select>
                  <div className="md:col-span-2">
                    <Button>Сохранить изменения</Button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "subscription" ? <SubscriptionPanel subscription={currentSubscription} onCheckout={() => navigate("/checkout")} /> : null}

            {tab === "security" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Input type="password" placeholder="Новый пароль" />
                <Input type="password" placeholder="Подтверждение пароля" />
                <div className="md:col-span-2">
                  <Button>Обновить пароль</Button>
                </div>
              </div>
            ) : null}

            {tab === "integrations" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="rounded-3xl">
                  <CardContent>
                    <p className="font-medium text-white">Yandex Smart Home</p>
                    <p className="mt-1 text-sm text-zinc-400">Не подключено</p>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl">
                  <CardContent>
                    <p className="font-medium text-white">Telemetry Collector</p>
                    <p className="mt-1 text-sm text-zinc-400">gRPC bridge</p>
                  </CardContent>
                </Card>
                <div className="md:col-span-2">
                  {currentSubscription?.isPremium ? <TelegramPanel /> : <LockedPreview title="Telegram-уведомления" description="Подключение бота доступно по подписке Premium. После оплаты можно получать статусы устройств, телеметрию и события сценариев в Telegram." />}
                </div>
              </div>
            ) : null}
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SubscriptionPanel({ subscription, onCheckout }: { subscription?: Subscription; onCheckout: () => void }) {
  const queryClient = useQueryClient();
  const active = subscription?.isPremium;
  const renewalCancelled = active && subscription?.status === "cancelled";
  const expiresLabel = subscription?.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString("ru-RU") : "—";
  const cancel = useMutation({
    mutationFn: api.cancelSubscription,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.subscription }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      ]);
    }
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,0.8fr]">
      <Card className="rounded-3xl">
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-violet-500/15 p-3">
              <CreditCard className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <p className="font-medium text-white">{active ? (renewalCancelled ? "Продление Premium отключено" : "SmartHome Premium активна") : "Бесплатная версия"}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {active ? (renewalCancelled ? `Доступ открыт до ${expiresLabel}, затем включится бесплатная версия.` : `Доступ открыт до ${expiresLabel}`) : "Telegram, расширенная аналитика и PDF-отчеты доступны по подписке."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-3xl">
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-zinc-400">Стоимость</p>
            <p className="mt-1 text-3xl font-semibold text-white">150 ₽/мес</p>
          </div>
          <Button onClick={onCheckout} className="w-full">
            {active ? "Продлить подписку" : "Оплатить подписку"}
          </Button>
          {active && !renewalCancelled ? (
            <Button variant="soft" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="w-full">
              <Ban className="h-4 w-4" /> Отключить продление
            </Button>
          ) : null}
          {cancel.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{cancel.error.message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TelegramPanel() {
  const queryClient = useQueryClient();
  const telegram = useQuery({ queryKey: queryKeys.telegram, queryFn: api.telegram });
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const current: TelegramIntegration | undefined = telegram.data?.telegram;

  const save = useMutation({
    mutationFn: () => api.saveTelegram({ botToken, chatId }),
    onSuccess: async () => {
      setBotToken("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.telegram });
    }
  });
  const test = useMutation({ mutationFn: api.testTelegram });
  const remove = useMutation({
    mutationFn: api.deleteTelegram,
    onSuccess: async () => {
      setBotToken("");
      setChatId("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.telegram });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <div className="mb-2 w-fit rounded-2xl bg-violet-500/15 p-3">
          <Bot className="h-5 w-5 text-violet-300" />
        </div>
        <CardTitle>Telegram-интеграция</CardTitle>
        <CardDescription>Создайте бота через BotFather, отправьте ему любое сообщение, узнайте chat id и сохраните данные здесь.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current?.connected ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Подключено к chat id {current.chatId}
            </div>
            <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Удалить
            </Button>
          </div>
        ) : null}
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Input value={botToken} onChange={(event) => setBotToken(event.target.value)} placeholder="Bot token" required />
          <Input value={chatId} onChange={(event) => setChatId(event.target.value)} placeholder="Chat id" required />
          <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="soft" onClick={() => test.mutate()} disabled={!current?.connected || test.isPending}>
              <Send className="h-4 w-4" /> Отправить тест
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Проверить и сохранить
            </Button>
          </div>
        </form>
        {save.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{save.error.message}</p> : null}
        {test.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{test.error.message}</p> : null}
        {test.isSuccess ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 p-3 text-sm text-emerald-300">Тестовое сообщение отправлено.</p> : null}
      </CardContent>
    </Card>
  );
}
