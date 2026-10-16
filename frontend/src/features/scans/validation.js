// Client-side rules mirroring backend/src/validators/scan.validators.js.
// The API remains the source of truth (it also blocks private and local
// network targets); these give instant feedback on obvious mistakes.

const URL_MAX_LENGTH = 2048;
const PROJECT_NAME_MAX_LENGTH = 100;

function checkUrl(value) {
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return "URL must not contain spaces";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "Enter a valid URL, e.g. https://example.com";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }
  if (url.username || url.password) return "URL must not contain a username or password";
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    return "URL must not point to a local or internal host";
  }
  return true;
}

export const scanUrlRules = {
  required: "URL is required",
  maxLength: { value: URL_MAX_LENGTH, message: `URL must be at most ${URL_MAX_LENGTH} characters` },
  validate: checkUrl,
};

export const projectNameRules = {
  required: "Project name is required",
  validate: (value) => {
    const name = value.trim().replace(/\s+/g, " ");
    if (!name) return "Project name is required";
    if (name.length > PROJECT_NAME_MAX_LENGTH) {
      return `Project name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`;
    }
    if (!/^[A-Za-z0-9 ._/-]+$/.test(name)) {
      return "Project name may contain only letters, numbers, spaces, and . _ - /";
    }
    if (!/^[A-Za-z0-9]/.test(name)) return "Project name must start with a letter or number";
    if (name.includes("..")) return 'Project name must not contain ".."';
    if (/\/\/|\/$| \/|\/ /.test(name)) return 'Project name has a misplaced "/"';
    return true;
  },
};
