import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(mode === "login" ? "matvey@example.com" : "");
  const [password, setPassword] = useState(mode === "login" ? "password123" : "");

  const mutation = useMutation({
    mutationFn: () => (mode === "login" ? api.login({ email, password }) : api.register({ name, email, password })),
    onSuccess: async (session) => {
      auth.setSession(session);
      queryClient.setQueryData(queryKeys.me, { user: session.user });
      await queryClient.invalidateQueries();
      navigate("/");
    }
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const Icon = mode === "login" ? LogIn : UserPlus;

  return (
    <form onSubmit={handleSubmit}>
      <Card className="rounded-3xl border-white/10 bg-white/5 shadow-2xl shadow-black/30 backdrop-blur-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 ring-1 ring-violet-400/30">
            <Icon className="h-6 w-6 text-violet-300" />
          </div>
          <CardTitle className="text-2xl">{mode === "login" ? "Авторизация" : "Регистрация"}</CardTitle>
          <CardDescription>{mode === "login" ? "Войди в систему управления умным домом" : "Создай аккаунт для доступа к дому и сценариям"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "register" ? <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя" required /> : null}
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" required />
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Пароль" required />
          {mode === "login" ? (
            <div className="text-right text-sm">
              <Link to="/forgot-password" className="font-medium text-violet-300 hover:text-violet-200">
                Забыли пароль?
              </Link>
            </div>
          ) : null}
          {mutation.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{mutation.error.message}</p> : null}
          <Button type="submit" disabled={mutation.isPending} className="h-12 w-full">
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </Button>
          <div className="text-center text-sm text-zinc-400">
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <Link to={mode === "login" ? "/register" : "/login"} className="font-medium text-violet-300 hover:text-violet-200">
              {mode === "login" ? "Регистрация" : "Войти"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
