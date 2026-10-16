"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { ErrorState, Spinner } from "@/components/ui/Feedback";
import FormField from "@/components/ui/FormField";
import { applyServerErrors } from "@/features/auth/validation";
import ScanCreatedNotice from "./ScanCreatedNotice";
import { createUrlScan } from "./scansSlice";
import { scanUrlRules } from "./validation";

const DEFAULTS = { url: "", authorized: false };

export default function UrlScanForm() {
  const dispatch = useDispatch();
  const [created, setCreated] = useState(null);

  const {
    register: field,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onTouched", defaultValues: DEFAULTS });

  const onSubmit = async ({ url }) => {
    const result = await dispatch(createUrlScan({ url: url.trim() }));
    // Cancelled because an identical request is already in flight: nothing to show.
    if (result.meta?.condition) return;
    if (createUrlScan.fulfilled.match(result)) {
      setCreated(result.payload);
      reset(DEFAULTS);
      return;
    }
    const message = applyServerErrors(result.payload, setError, ["url"]);
    if (message) setError("root.server", { message });
  };

  if (created) {
    return (
      <ScanCreatedNotice
        scan={created.scan}
        notice={created.notice}
        anotherLabel="Record another URL"
        onCreateAnother={() => setCreated(null)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root?.server && (
        <ErrorState title="Could not record the scan request">{errors.root.server.message}</ErrorState>
      )}

      <FormField
        id="scan-url"
        label="Target URL"
        type="url"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        placeholder="https://app.example.com"
        hint="http:// or https:// only. Local, private-network, and credential-bearing URLs are rejected."
        error={errors.url?.message}
        inputProps={field("url", scanUrlRules)}
      />

      <Checkbox
        id="scan-authorized"
        label="I own this target or have explicit written permission to test it."
        error={errors.authorized?.message}
        inputProps={field("authorized", {
          required: "Confirm that you are authorized to test this target",
        })}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Spinner label="Recording…" /> : "Record scan request"}
      </Button>
    </form>
  );
}
