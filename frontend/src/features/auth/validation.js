// Client-side rules mirroring backend/src/validators/auth.validators.js.
// The API remains the source of truth; these give instant feedback.

export const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_BYTES = 72;

export const emailRules = {
  required: "Email is required",
  maxLength: { value: 254, message: "Email must be at most 254 characters" },
  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
};

export const newPasswordRules = {
  required: "Password is required",
  minLength: {
    value: PASSWORD_MIN_LENGTH,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  },
  validate: (value) =>
    new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES ||
    `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
};

export const nameRules = {
  required: "Name is required",
  validate: (value) => value.trim().length > 0 || "Name is required",
  maxLength: { value: 100, message: "Name must be at most 100 characters" },
};

// API error codes that belong to a single form field rather than the whole form.
const FIELD_ERROR_CODES = {
  EMAIL_TAKEN: ["email", "An account with this email already exists. Sign in instead."],
};

/**
 * Copies API field errors onto the form. Returns the message to show above the
 * form, or null when every problem is already shown on a field.
 */
export function applyServerErrors(apiError, setError, knownFields) {
  let fieldsSet = 0;
  for (const [field, message] of Object.entries(apiError?.fieldErrors ?? {})) {
    if (knownFields.includes(field)) {
      setError(field, { type: "server", message });
      fieldsSet += 1;
    }
  }

  const mapped = FIELD_ERROR_CODES[apiError?.code];
  if (mapped && knownFields.includes(mapped[0])) {
    setError(mapped[0], { type: "server", message: mapped[1] });
    return null;
  }

  if (apiError?.code === "VALIDATION_ERROR" && fieldsSet > 0) return null;
  return apiError?.message ?? "Something went wrong. Please try again.";
}
