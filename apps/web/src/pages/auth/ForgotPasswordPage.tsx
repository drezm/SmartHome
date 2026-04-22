import { useMutation } from "@tanstack/react-query";
import { KeyRound, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/http";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";

type ResetStep = "email" | "code" | "password";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const forgot = useMutation({
    mutationFn: () => api.forgotPassword({ email }),
    onSuccess: () => setStep("code")
  });
  const verify = useMutation({
    mutationFn: () => api.verifyResetCode({ email, code }),
    onSuccess: () => setStep("password")
  });
  const reset = useMutation({
    mutationFn: () => api.resetPassword({ email, code, password }),
    onSuccess: () => window.setTimeout(() => navigate("/login"), 1200)
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === "email") {
      forgot.mutate();
      return;
    }
    if (step === "code") {
      if (/^\d{6}$/.test(code)) {
        verify.mutate();
      }
      return;
    }
    if (password === confirm) {
      reset.mutate();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B] p-4 text-white">
      <form onSubmit={submit} className="w-full max-w-md">
        <Card className="rounded-3xl border-white/10 bg-white/5 shadow-2xl shadow-black/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
              {step === "email" ? <Mail className="h-6 w-6 text-violet-300" /> : <KeyRound className="h-6 w-6 text-violet-300" />}
            </div>
            <CardTitle>Восстановление пароля</CardTitle>
            <CardDescription>
              {step === "email" ? "Введите email, и мы отправим 6-значный код для сброса пароля." : step === "code" ? "Введите код из письма SmartHome." : "Введите новый пароль для аккаунта."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {forgot.isSuccess ? (
              <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 p-3 text-sm text-emerald-300">
                Если аккаунт найден, код отправлен на указанную почту.
                {forgot.data?.devCode ? <span className="mt-2 block font-mono text-base">Dev-код: {forgot.data.devCode}</span> : null}
              </p>
            ) : null}

            {step === "email" ? <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" required /> : null}

            {step === "code" ? (
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Код из письма"
                inputMode="numeric"
                maxLength={6}
                required
              />
            ) : null}

            {step === "password" ? (
              <>
                <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Новый пароль" type="password" required />
                <Input value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Повторите пароль" type="password" required />
                {password && confirm && password !== confirm ? <p className="text-sm text-red-300">Пароли не совпадают</p> : null}
              </>
            ) : null}

            {reset.isSuccess ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 p-3 text-sm text-emerald-300">Пароль изменен. Сейчас откроется вход.</p> : null}
            {forgot.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{forgot.error.message}</p> : null}
            {verify.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{verify.error.message}</p> : null}
            {reset.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{reset.error.message}</p> : null}

            <Button type="submit" disabled={forgot.isPending || verify.isPending || reset.isPending || (step === "code" && code.length !== 6) || (step === "password" && password !== confirm)} className="h-12 w-full">
              {step === "email" ? "Получить код" : step === "code" ? "Проверить код" : "Сохранить пароль"}
            </Button>
            <div className="text-center text-sm text-zinc-400">
              <Link to="/login" className="font-medium text-violet-300 hover:text-violet-200">
                Вернуться ко входу
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
