import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { AuthForm } from "./AuthForm";

describe("AuthForm", () => {
  it("renders login form", () => {
    const client = new QueryClient();

    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <AuthForm mode="login" />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Авторизация")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
  });

  it("shows password rules and unlocks registration for a strong password", () => {
    const client = new QueryClient();

    const view = render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <AuthForm mode="register" />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    const submit = view.getByRole("button", { name: "Создать аккаунт" });
    expect(view.getByText(/Минимум 8 символов/)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    fireEvent.change(view.getByPlaceholderText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(view.getByPlaceholderText("Пароль"), { target: { value: "Secret123!" } });
    expect(submit).toBeEnabled();
  });

  it("shows an email validation error", () => {
    const client = new QueryClient();

    const view = render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <AuthForm mode="register" />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    fireEvent.change(view.getByPlaceholderText("Email"), { target: { value: "invalid-address" } });
    expect(view.getByText("Введите корректный email")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Создать аккаунт" })).toBeDisabled();
  });
});
