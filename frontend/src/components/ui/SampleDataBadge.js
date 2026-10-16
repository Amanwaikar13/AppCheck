import Badge from "./Badge";

/** Marks content backed by illustrative sample data rather than real results. */
export default function SampleDataBadge() {
  return (
    <Badge variant="dashed" title="Illustrative sample data. No scanner has produced these values.">
      Sample data
    </Badge>
  );
}
