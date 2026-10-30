import ListEditor, { type StartState } from "./ListEditor";

type Search = Promise<Record<string, string | string[] | undefined>>;

const TABS = ["default", "g1", "g2", "both", "own", "arrivals"] as const;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function many(v: string | string[] | undefined): string[] {
  return (Array.isArray(v) ? v : v ? [v] : []).slice(0, 3);
}

// The view lives in the URL (?tab=g1&ex=0&lines=5, and for "Your guest" city, kind, fav and id),
// so a link can open straight on a guest's edited list.
export default async function Home({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const tab = TABS.find((t) => t === one(q.tab));
  const lines = Number(one(q.lines));
  const start: StartState = {
    tab,
    ex: Math.max(0, Number(one(q.ex)) || 0),
    lines: [3, 5, 10].includes(lines) ? lines : 5,
    own: {
      city: one(q.city),
      category: one(q.kind) === "nightlife" ? "nightlife" : "dining",
      favs: many(q.fav),
      ids: many(q.id),
    },
  };
  return <ListEditor start={start} />;
}
