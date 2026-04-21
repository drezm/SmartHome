import { motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Avatar, AvatarFallback } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import { Tabs } from "@/shared/ui/Tabs";

type ProfileTab = "profile" | "security" | "integrations";

export function ProfilePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ProfileTab>("profile");
  const [firstName = "M", secondName = "S"] = (user?.name ?? "Матвей Саблуков").split(" ");
  const initials = `${firstName[0] ?? "M"}${secondName[0] ?? "S"}`.toUpperCase();

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
              </div>
            ) : null}
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
