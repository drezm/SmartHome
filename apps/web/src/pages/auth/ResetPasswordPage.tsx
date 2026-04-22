import { KeyRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";

export function ResetPasswordPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B] p-4 text-white">
      <div className="w-full max-w-md">
        <Card className="rounded-3xl border-white/10 bg-white/5 shadow-2xl shadow-black/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
              <KeyRound className="h-6 w-6 text-violet-300" />
            </div>
            <CardTitle>Восстановление по коду</CardTitle>
            <CardDescription>Теперь пароль меняется через 6-значный код из письма. Начните восстановление с email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate("/forgot-password")} className="h-12 w-full">Получить код</Button>
            <div className="text-center text-sm text-zinc-400">
              <Link to="/login" className="font-medium text-violet-300 hover:text-violet-200">
                Вернуться ко входу
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
