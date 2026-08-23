import { authClient } from "@/lib/auth-client";
await authClient.signUp.email({
    name: "Test User",
    email: "test@example.com",
    password: "TestPassword123!",
  });