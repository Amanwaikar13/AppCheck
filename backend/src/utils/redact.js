const MONGO_CREDENTIALS = /(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/gi;

/** Removes credentials embedded in MongoDB connection strings. */
export function redactConnectionStrings(text) {
  return String(text).replace(MONGO_CREDENTIALS, '$1<credentials>@');
}
