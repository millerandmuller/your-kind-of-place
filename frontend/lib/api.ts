export type Place = {
  id: string;
  name: string;
  kind: string;
  neighborhood: string | null;
  address: string | null;
  description: string | null;
  price_level: number | null;
  lat: number | null;
  lon: number | null;
  typed?: string | null;
  in_qloo?: boolean;
  in_house?: boolean;
};

export type Driver = { id: string; name: string; score: number };

export type Line = {
  status: "keep" | "strike" | "insert";
  place: Place;
  note: string;
  why?: Driver[];
  replaces?: string;
};

export type Interest = { id: string; name: string; kind: string };

export type Option = { id: string; name: string; kind: string; description: string };
export type Issue =
  | { kind: "clarify"; field: string; query: string; question: string; options: Option[] }
  | { kind: "not_found"; field: string; query: string; message: string };

export type TraceStep = { tool: string; input: unknown; output: unknown };

export type Redline = {
  status: "ok";
  city: string;
  guest: Interest[];
  budget: number;
  source?: "default" | "hotel";
  skipped?: string[];
  default: Place[];
  lines: Line[];
  final: Place[];
  changed: number;
  length: number;
  possible: number;
  match_count: number;
  cached: boolean;
  cache_age_seconds: number;
  agent_said?: string;
  trace?: TraceStep[];
};

export type NeedsInput = {
  status: "needs_input";
  city?: string;
  issues: Issue[];
  resolved: Interest[];
  agent_said?: string;
  trace?: TraceStep[];
};

export type AgentError = { status: "error"; city?: string; agent_said?: string; trace?: TraceStep[] };

export type DemoGuest = { id: string; name: string; kind: string };
export type DemoPair = { city: string; guest1: DemoGuest[]; guest2: DemoGuest[] };

export type InterestIn = { name: string; id?: string };

export type FoundFavourite = {
  query: string;
  status: "ok" | "clarify" | "not_found";
  entity?: Interest;
  question?: string;
  options?: Option[];
  message?: string;
};
export type ArrivalRead = {
  status: "ok";
  guests: { label: string; text: string; favourites: FoundFavourite[] }[];
  trace: TraceStep[];
};
export type MorningReport = {
  status: "ok";
  city: string;
  budget: number;
  guests: { label: string; result: Redline | NeedsInput | { status: "skipped"; message: string } }[];
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `Something went wrong (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  demo: () => call<{ pairs: DemoPair[] }>("/api/demo"),
  cities: () => call<{ cities: string[] }>("/api/cities"),
  redline: (city: string, interests: InterestIn[], budget: number, hotelList?: string[]) =>
    call<Redline | NeedsInput>("/api/redline", {
      method: "POST",
      body: JSON.stringify({ city, interests, budget, hotel_list: hotelList?.length ? hotelList : undefined }),
    }),
  resolve: (name: string) =>
    call<FoundFavourite>("/api/resolve", { method: "POST", body: JSON.stringify({ name }) }),
  arrivalsRead: (notes: { label: string; text: string }[]) =>
    call<ArrivalRead>("/api/arrivals/read", { method: "POST", body: JSON.stringify({ notes }) }),
  arrivalsReport: (city: string, budget: number, guests: { label: string; interests: InterestIn[] }[], hotelList?: string[]) =>
    call<MorningReport>("/api/arrivals/report", {
      method: "POST",
      body: JSON.stringify({ city, budget, guests, hotel_list: hotelList?.length ? hotelList : undefined }),
    }),
  agent: (text: string, city: string, budget: number, hotelList?: string[]) =>
    call<Redline | NeedsInput | AgentError>("/api/agent", {
      method: "POST",
      body: JSON.stringify({ text, city, budget, hotel_list: hotelList?.length ? hotelList : undefined }),
    }),
};

export const CITIES = ["London", "San Francisco", "New York", "Austin", "Berlin"];
export const BUDGETS = [3, 5, 10];
export const LABEL = "Aggregate taste affinity from Qloo, not a review.";
export const HOTEL_LABEL = "Your hotel's list: each line matched to a restaurant or bar in Qloo; lines it can't match are kept as is";
export const SAMPLE_LISTS: Record<string, string[]> = {
  London: ["The Wolseley", "Dishoom", "Hawksmoor", "Barrafina", "St. John", "Sketch", "Rules", "Duck & Waffle", "Our Little Corner Bistro"],
  "New York": ["Katz's Delicatessen", "Balthazar", "Carbone", "Russ & Daughters", "Le Bernardin", "Minetta Tavern", "The Dead Rabbit", "Via Carota"],
  "San Francisco": ["Zuni Cafe", "Tartine Bakery", "House of Prime Rib", "Swan Oyster Depot", "State Bird Provisions", "Foreign Cinema", "Tosca Cafe"],
  Austin: ["Franklin Barbecue", "Uchiko", "Odd Duck", "Matt's El Rancho", "Veracruz All Natural", "Jeffrey's", "The Driskill Bar"],
  Berlin: ["Borchardt", "Katz Orange", "Markthalle Neun", "Curry 36", "Lode & Stijn", "Prater Garten", "Clärchens Ballhaus"],
};
export const DEFAULT_LABEL =
  "Default list: the city's top places with no taste signal (stands in for the hotel's list)";

export function guestName(g: { name: string }[]): string {
  return g.map((x) => x.name).join(" + ");
}

/** The list as the guest would get it: accepted changes applied, rejected ones reverted. */
export function finalList(r: Redline, rejected: Set<string>): Place[] {
  const out: Place[] = [];
  for (const l of r.lines) {
    if (l.status === "keep") out.push(l.place);
    if (l.status === "strike" && rejected.has(l.place.id)) out.push(l.place);
    if (l.status === "insert" && !rejected.has(l.replaces ?? "")) out.push(l.place);
  }
  return out;
}

export function shared(a: Place[], b: Place[]): number {
  const ids = new Set(a.map((p) => p.id));
  return b.filter((p) => ids.has(p.id)).length;
}
