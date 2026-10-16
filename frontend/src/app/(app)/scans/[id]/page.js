import ScanDetail from "@/features/scans/ScanDetail";

export const metadata = { title: "Scan details" };

export default async function ScanDetailPage({ params }) {
  const { id } = await params;
  return <ScanDetail id={id} />;
}
