import { redirect } from "next/navigation";

/**
 * Rooms / lobby CTAs are removed from the user path.
 * The leftover skeleton still compiles under components/layout/lobby-view.tsx.
 */
export default function DashboardPage() {
  redirect("/");
}
