import { Header } from "@/components/layout/header";
import { LobbyView } from "@/components/layout/lobby-view";
import { placeholderMembers, placeholderStandings } from "@/types";

type DashboardPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const created = params.intent === "create";

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title={created ? "New room" : "Lobby"} backHref="/" />
      <LobbyView members={placeholderMembers} standings={placeholderStandings} />
    </main>
  );
}
