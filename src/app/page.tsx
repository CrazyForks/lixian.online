import { redirect } from "next/navigation";
import { defaultTab } from "@/features/registry";

export default function Home() {
  redirect(`/${defaultTab}`);
}
