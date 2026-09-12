import { BoxDetailView } from "@/components/box-detail-view";

export default async function BoxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BoxDetailView id={id} />;
}
