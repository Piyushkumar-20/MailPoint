"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (error) {
      console.error(error);
      return;
    }

    window.location.href = "/";
  };

  return (
    <main>
      <h1>Create account</h1>

      <form onSubmit={handleRegister}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Create account</button>
      </form>

      <p>
        Already have an account? <a href="/login">Login</a>
      </p>
    </main>
  );
}