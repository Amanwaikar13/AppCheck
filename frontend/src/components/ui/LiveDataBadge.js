import Badge from "./Badge";

/** Marks content loaded from the AppCheck API for the signed-in account. */
export default function LiveDataBadge() {
  return (
    <Badge tone="success" dot title="Loaded from your account through the AppCheck API">
      Live
    </Badge>
  );
}
