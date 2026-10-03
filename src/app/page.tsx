import { redirect } from "next/navigation";
import { getPreferredLocale } from "@/lib/preferred-locale";

export default async function RootPage() {
  redirect(`/${await getPreferredLocale()}/month`);
}
