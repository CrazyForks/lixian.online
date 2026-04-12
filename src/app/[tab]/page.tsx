import { notFound } from "next/navigation";
import { tabIds } from "@/features/registry";
import TabPage from "./tab-page";

export function generateStaticParams() {
  return tabIds.map((tab) => ({ tab }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!tabIds.includes(tab)) notFound();
  return <TabPage tab={tab} />;
}
