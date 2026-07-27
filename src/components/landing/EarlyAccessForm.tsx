import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SimiSpot } from "./SimiSpot";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Please enter your email")
  .email("That doesn't look like an email")
  .max(254, "That email is too long");

type Status = "idle" | "loading" | "success" | "already" | "error";

export function EarlyAccessForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus("error");
      setMessage(parsed.error.issues[0]?.message ?? "Please check your email");
      return;
    }
    setStatus("loading");
    const { error } = await supabase
      .from("early_access_signups")
      .insert({ email: parsed.data, source: "landing_final_cta" });

    if (!error) {
      setStatus("success");
      setEmail("");
      return;
    }
    // Postgres unique violation
    if ((error as { code?: string }).code === "23505") {
      setStatus("already");
      return;
    }
    console.error("early access signup failed", error);
    setStatus("error");
    setMessage("Something went wrong on our end. Try again in a moment?");
  }

  if (status === "success" || status === "already") {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl border border-border/70 bg-background/80 p-8 text-center shadow-[var(--shadow-soft)]">
        <SimiSpot pose={status === "success" ? "success" : "proud"} size={110} />
        <div>
          <p className="font-display text-2xl text-coffee">
            {status === "success"
              ? "You're on the list."
              : "You're already on the list."}
          </p>
          <p className="mt-1 text-base text-cocoa/85">
            {status === "success"
              ? "Simi will send a note when it's time to start cooking."
              : "Simi remembers you — we'll be in touch soon."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-3xl border border-border/70 bg-background/80 p-3 shadow-[var(--shadow-cozy)] sm:flex-row sm:items-center sm:p-2"
      noValidate
    >
      <label htmlFor="ea-email" className="sr-only">
        Email address
      </label>
      <input
        id="ea-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@yourkitchen.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        disabled={status === "loading"}
        maxLength={254}
        className="flex-1 rounded-2xl bg-transparent px-4 py-3 text-base text-coffee placeholder:text-cocoa/50 focus:outline-none disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-olive-deep px-5 py-3 text-base font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-olive disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "loading" ? "Saving…" : "Join the early access"}
        <span aria-hidden>→</span>
      </button>
      {status === "error" && message && (
        <p role="alert" className="basis-full pl-2 text-sm text-terracotta">
          {message}
        </p>
      )}
    </form>
  );
}
