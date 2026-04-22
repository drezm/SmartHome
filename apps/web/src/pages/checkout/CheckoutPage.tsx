import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";

type CheckoutField = "cardholderName" | "paymentEmail" | "cardNumber" | "expires" | "cvc";
type CheckoutErrors = Partial<Record<CheckoutField, string>>;
type CheckoutPayload = {
  cardholderName: string;
  paymentEmail: string;
  cardNumber: string;
  expires: string;
  cvc: string;
};

const cardholderPattern = /^[A-Za-zА-Яа-яЁё\s'-]{2,120}$/u;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string) {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isLuhnValid(value: string) {
  let sum = 0;
  let shouldDouble = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return value.length > 0 && sum % 10 === 0;
}

function parseExpiry(value: string) {
  const match = value.trim().match(/^(\d{2})\/?(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const rawYear = match[2];
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);

  if (month < 1 || month > 12) {
    return null;
  }

  return { month, year };
}

function isExpiryValid(value: string) {
  const expiry = parseExpiry(value);
  if (!expiry) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const maxYear = currentYear + 20;

  if (expiry.year > maxYear) {
    return false;
  }

  return expiry.year > currentYear || (expiry.year === currentYear && expiry.month >= currentMonth);
}

function normalizeExpiry(value: string) {
  const expiry = parseExpiry(value);
  if (!expiry) {
    return value;
  }
  return `${String(expiry.month).padStart(2, "0")}/${String(expiry.year).slice(-2)}`;
}

function validateCheckout(input: CheckoutPayload): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const name = input.cardholderName.trim().replace(/\s+/g, " ");
  const cardNumber = digitsOnly(input.cardNumber);

  if (!cardholderPattern.test(name) || !/[A-Za-zА-Яа-яЁё]/u.test(name)) {
    errors.cardholderName = "Введите имя держателя карты буквами, без цифр и спецсимволов.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.paymentEmail.trim())) {
    errors.paymentEmail = "Введите корректный email для чека.";
  }

  if (cardNumber.length < 13 || cardNumber.length > 19 || !isLuhnValid(cardNumber)) {
    errors.cardNumber = "Введите корректный номер карты. Проверяется длина и контрольная сумма.";
  }

  if (!isExpiryValid(input.expires)) {
    errors.expires = "Введите актуальный срок действия в формате MM/YY.";
  }

  if (!/^\d{3,4}$/.test(input.cvc)) {
    errors.cvc = "CVC должен содержать 3 или 4 цифры.";
  }

  return errors;
}

export function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cardholderName, setCardholderName] = useState(user?.name ?? "");
  const [paymentEmail, setPaymentEmail] = useState(user?.email ?? "");
  const [cardNumber, setCardNumber] = useState("");
  const [expires, setExpires] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: CheckoutPayload) => api.checkoutSubscription(input),
    onSuccess: async () => {
      setSuccess(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.subscription }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.news })
      ]);
      window.setTimeout(() => navigate("/profile"), 1200);
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      cardholderName: cardholderName.trim().replace(/\s+/g, " "),
      paymentEmail: paymentEmail.trim(),
      cardNumber: digitsOnly(cardNumber),
      expires: normalizeExpiry(expires),
      cvc: digitsOnly(cvc)
    };
    const nextErrors = validateCheckout(payload);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    mutation.mutate(payload);
  }

  function clearFieldError(field: CheckoutField) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
      <Card className="rounded-3xl">
        <CardHeader>
          <div className="mb-2 w-fit rounded-2xl bg-violet-500/15 p-3">
            <CreditCard className="h-5 w-5 text-violet-300" />
          </div>
          <CardTitle>Оплата подписки</CardTitle>
          <CardDescription>Mock-оплата SmartHome Premium за 150 ₽/месяц. Интеграции с банком нет, данные карты полностью не сохраняются.</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/15 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
              <p className="mt-3 font-medium text-white">Оплата прошла успешно</p>
              <p className="mt-1 text-sm text-zinc-400">Подписка активирована на 30 дней. Возвращаем в личный кабинет...</p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Input
                  value={cardholderName}
                  onChange={(event) => {
                    setCardholderName(event.target.value);
                    clearFieldError("cardholderName");
                  }}
                  placeholder="Имя держателя карты"
                  autoComplete="cc-name"
                  aria-invalid={Boolean(errors.cardholderName)}
                  className={errors.cardholderName ? "border-red-400/60 focus:border-red-300 focus:ring-red-400/20" : undefined}
                  required
                />
                {errors.cardholderName ? <p className="text-xs text-red-300">{errors.cardholderName}</p> : null}
              </div>

              <div className="grid gap-1.5">
                <Input
                  value={paymentEmail}
                  onChange={(event) => {
                    setPaymentEmail(event.target.value);
                    clearFieldError("paymentEmail");
                  }}
                  placeholder="Email для чека"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.paymentEmail)}
                  className={errors.paymentEmail ? "border-red-400/60 focus:border-red-300 focus:ring-red-400/20" : undefined}
                  required
                />
                {errors.paymentEmail ? <p className="text-xs text-red-300">{errors.paymentEmail}</p> : null}
              </div>

              <div className="grid gap-1.5">
                <Input
                  value={cardNumber}
                  onChange={(event) => {
                    setCardNumber(formatCardNumber(event.target.value));
                    clearFieldError("cardNumber");
                  }}
                  placeholder="Номер карты"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={23}
                  aria-invalid={Boolean(errors.cardNumber)}
                  className={errors.cardNumber ? "border-red-400/60 focus:border-red-300 focus:ring-red-400/20" : undefined}
                  required
                />
                {errors.cardNumber ? <p className="text-xs text-red-300">{errors.cardNumber}</p> : <p className="text-xs text-zinc-500">Для проверки можно использовать тестовый номер 4111 1111 1111 1111.</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Input
                    value={expires}
                    onChange={(event) => {
                      setExpires(formatExpiry(event.target.value));
                      clearFieldError("expires");
                    }}
                    placeholder="MM/YY"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    maxLength={5}
                    aria-invalid={Boolean(errors.expires)}
                    className={errors.expires ? "border-red-400/60 focus:border-red-300 focus:ring-red-400/20" : undefined}
                    required
                  />
                  {errors.expires ? <p className="text-xs text-red-300">{errors.expires}</p> : null}
                </div>

                <div className="grid gap-1.5">
                  <Input
                    value={cvc}
                    onChange={(event) => {
                      setCvc(digitsOnly(event.target.value).slice(0, 4));
                      clearFieldError("cvc");
                    }}
                    placeholder="CVC"
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    aria-invalid={Boolean(errors.cvc)}
                    className={errors.cvc ? "border-red-400/60 focus:border-red-300 focus:ring-red-400/20" : undefined}
                    required
                  />
                  {errors.cvc ? <p className="text-xs text-red-300">{errors.cvc}</p> : null}
                </div>
              </div>
              {mutation.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{mutation.error.message}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="soft" onClick={() => navigate("/profile")}>
                  Назад
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  Оплатить 150 ₽
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
