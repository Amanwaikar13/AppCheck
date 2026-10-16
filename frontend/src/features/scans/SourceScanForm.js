"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import Button from "@/components/ui/Button";
import { ErrorState, Spinner } from "@/components/ui/Feedback";
import FormField from "@/components/ui/FormField";
import { applyServerErrors } from "@/features/auth/validation";
import ScanCreatedNotice from "./ScanCreatedNotice";
import { createSourceScan } from "./scansSlice";
import { projectNameRules } from "./validation";

const DEFAULTS = { projectName: "" };

export default function SourceScanForm() {
  const dispatch = useDispatch();
  const [created, setCreated] = useState(null);

  const {
    register: field,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ mode: "onTouched", defaultValues: DEFAULTS });

  const onSubmit = async ({ projectName }) => {
    const result = await dispatch(createSourceScan({ projectName: projectName.trim() }));
    // Cancelled because an identical request is already in flight: nothing to show.
    if (result.meta?.condition) return;
    if (createSourceScan.fulfilled.match(result)) {
      setCreated(result.payload);
      reset(DEFAULTS);
      return;
    }
    const message = applyServerErrors(result.payload, setError, ["projectName"]);
    if (message) setError("root.server", { message });
  };

  if (created) {
    return (
      <ScanCreatedNotice
        scan={created.scan}
        notice={created.notice}
        anotherLabel="Record another project"
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
        id="scan-project"
        label="Project name or identifier"
        autoComplete="off"
        spellCheck={false}
        placeholder="acme/payments-api"
        hint="Up to 100 characters: letters, numbers, spaces, and . _ - /"
        error={errors.projectName?.message}
        inputProps={field("projectName", projectNameRules)}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Spinner label="Recording…" /> : "Record scan request"}
      </Button>
    </form>
  );
}
