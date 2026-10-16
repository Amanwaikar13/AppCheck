"use client";

import { useState } from "react";
import FormField from "@/components/ui/FormField";

export default function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
    />
  );
}
