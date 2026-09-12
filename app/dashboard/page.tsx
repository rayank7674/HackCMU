import { redirect } from "next/navigation";

/**
 * Old rooms / lobby URL. StormReady lives at `/`.
 */
export default function DashboardPage() {
  redirect("/");
}
