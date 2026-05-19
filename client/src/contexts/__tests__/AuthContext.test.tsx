// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../AuthContext";
import { apiRequest, ApiError } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>(
    "@/lib/queryClient",
  );
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const apiRequestMock = vi.mocked(apiRequest);

function AuthProbe() {
  const { status, isAuthenticated } = useAuth();

  return (
    <div data-testid="auth-state">
      {status}:{String(isAuthenticated)}
    </div>
  );
}

function renderAuthProbe() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retryDelay: 0,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps auth status loading when the subscription check times out", async () => {
    vi.useFakeTimers();
    apiRequestMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const queryClient = renderAuthProbe();

    await vi.advanceTimersByTimeAsync(20_000);

    expect(screen.getByTestId("auth-state").textContent).toBe("loading:false");
    expect(queryClient.getQueryData(["/api/subscription-status"])).toBeUndefined();
  });

  it("treats a real auth error as unauthenticated", async () => {
    apiRequestMock.mockRejectedValue(new ApiError(401, "Please log in"));

    renderAuthProbe();

    await waitFor(() => {
      expect(screen.getByTestId("auth-state").textContent).toBe(
        "unauthenticated:false",
      );
    });
  });
});
