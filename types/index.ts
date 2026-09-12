export type Member = {
  id: string;
  name: string;
  role: "host" | "player";
  online: boolean;
};

export type Standing = {
  id: string;
  name: string;
  rank: number;
  score: number;
};

export const placeholderMembers: Member[] = [
  { id: "1", name: "You", role: "host", online: true },
  { id: "2", name: "Alex", role: "player", online: true },
  { id: "3", name: "Jordan", role: "player", online: false },
];

export const placeholderStandings: Standing[] = [
  { id: "1", name: "Alex", rank: 1, score: 420 },
  { id: "2", name: "You", rank: 2, score: 385 },
  { id: "3", name: "Jordan", rank: 3, score: 210 },
];
