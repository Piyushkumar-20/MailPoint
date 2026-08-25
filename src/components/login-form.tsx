"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthAction = "email" | "google" | null;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<AuthAction>(null);

  const validateForm = () => {
    if (!email.trim() || !password) {
      return "Please enter your email and password.";
    }

    if (!emailPattern.test(email)) {
      return "Please enter a valid email address.";
    }

    return "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading("email");

    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    setLoading(null);

    if (signInError) {
      setError(signInError.message ?? "Invalid email or password.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    if (loading) {
      return;
    }

    setError("");
    setLoading("google");

    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });

    if (googleError) {
      setLoading(null);
      setError(googleError.message ?? "Unable to continue with Google.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error ? (
                <Field>
                  <FieldError>{error}</FieldError>
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!!loading}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={!!loading}
                  required
                />
              </Field>
              <Field>
                <Button type="submit" disabled={!!loading}>
                  {loading === "email" ? (
                    <Loader2Icon className="animate-spin" />
                  ) : null}
                  Login
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={!!loading}
                >
                  {loading === "google" ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <GoogleIcon className="size-4" />
                  )}
                  Continue with Google
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <Link href="/register">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
