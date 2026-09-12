import { redirect } from "next/navigation";

/**
 * Old rooms / lobby URL. FaultLine lives at `/`.
 */
export default function DashboardPage() {
  redirect("/");
}
