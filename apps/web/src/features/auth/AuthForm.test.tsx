import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
});
