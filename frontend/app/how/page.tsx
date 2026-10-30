import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "How Redline works" };

export default function How() {
  return (
    <main className="wrap how">
      <p>
        <Link href="/">← Back to the list</Link>
      </p>
      <h1 className="brand">How this works</h1>
      <p className="lede">
        Every change on the list comes from Qloo&apos;s taste data. The model only talks; it never picks a place or a reason.
      </p>

      <h2>1. The default list</h2>
      <p>
        A stand-in for the hotel&apos;s own list: Qloo Insights for places in the city, with no taste signal.
      </p>
      <p>
        <code>GET /v2/insights?filter.type=urn:entity:place&amp;filter.location.query=London&amp;filter.tags=urn:tag:genre:place:restaurant&amp;take=50</code>
      </p>
      <p>
        That tag also returns hotels, department stores, arenas and fast-food chains. A concierge doesn&apos;t hand those out, so
        both lists keep only sit-down food and drink by Qloo&apos;s <code>primary_genre</code> (restaurants, bars, pubs, cafés;
        no fast food, delivery or food courts). The top 10 that remain are the default list.
      </p>

      <h2>2. The guest</h2>
      <p>
        Up to three favourites (a band, show, film, brand or game), found with <code>GET /search</code>. If a name matches more
        than one thing, Redline asks. The one exception: when a single exact match has Qloo popularity of at least 0.9 and
        every other exact match is at least 0.15 lower (“Succession” the show, not the film), Redline takes it and shows its
        type on the list, so you can see what it used.
      </p>

      <h2>3. The guest&apos;s taste matches</h2>
      <p>The same query with the guest&apos;s favourites as the signal and explainability switched on:</p>
      <p>
        <code>…&amp;signal.interests.entities=&lt;ids&gt;&amp;feature.explainability=true&amp;take=50</code>
      </p>

      <h2>4. The redline (deterministic)</h2>
      <ul>
        <li>
          <strong>Struck:</strong> default entries that are not in the guest&apos;s top 50, lowest on the list first, at most as
          many as the swap budget (3, 5 or 10).
        </li>
        <li>
          <strong>Inserted:</strong> the guest&apos;s best matches that aren&apos;t on the list yet, one per struck entry, in
          Qloo&apos;s order.
        </li>
        <li>
          <strong>Kept:</strong> everything else, unmarked. If the guest has fewer new matches than the budget, fewer things
          change. The list is never padded.
        </li>
        <li>
          <strong>Notes:</strong> for an insert, the favourite with the highest explainability score for that place (both
          names when they are within 0.1), plus Qloo&apos;s neighbourhood and place type. For a strike: “Not among this
          guest&apos;s top 50 taste matches.”
        </li>
      </ul>
      <p>Same guest, same city, same budget: same list.</p>

      <h2>5. The agent</h2>
      <p>
        “Ask the agent” runs a Google ADK agent (Claude via LiteLLM) with five tools: <code>resolve_interest</code>,{" "}
        <code>default_list</code>, <code>taste_places</code>, <code>redline</code>, <code>explain_place</code>. It reads the
        favourites out of free text, asks when a name is unclear and returns the same redline as the form. Its tool calls are shown
        under the result. The same capability is an MCP tool at <code>/mcp/</code>: <code>redline(city, interests[], budget)</code>.
      </p>

      <h2>What we measured</h2>
      <p>One test before building, on 25 October 2026, in San Francisco, Austin and London, with 12 pairs of opposite guests:</p>
      <table>
        <tbody>
          <tr>
            <th>Blind matching</th>
            <td>
              A separate model saw two lists and two guest profiles, with no hint of Qloo, and matched them correctly in{" "}
              <strong>11 of 12</strong> cases.
            </td>
          </tr>
          <tr>
            <th>Stability</th>
            <td>
              The same queries 14 minutes later overlapped <strong>0.99</strong> on average.
            </td>
          </tr>
          <tr>
            <th>Default vs. taste</th>
            <td>
              A guest&apos;s list and the list with no taste signal overlapped <strong>0.12</strong> on average: the default
              list gets rewritten a lot.
            </td>
          </tr>
        </tbody>
      </table>
      <p className="label">
        The test ran on the restaurant-tag query without the dining filter above. The judge was a language model, not a person;
        12 cases is a small sample, and the profiles were deliberately opposite.
      </p>

      <h2>What we don&apos;t claim</h2>
      <p className="limit">
        Fits this guest, not &apos;better&apos;. Even similar tastes get different lists, so we don&apos;t claim anything about
        similar guests.
      </p>
      <p>
        Two fans of nearly the same music got lists that overlapped only 0.12 in our test. Qloo moves a lot with small differences
        in taste, so Redline shows opposite guests side by side and says nothing about guests who are alike.
      </p>
      <p>
        Accept and reject are only kept on your screen. Demo guests may be answered from saved Qloo results and are marked
        “cached result”. {""}
        Notes are aggregate taste affinity from Qloo, not reviews.
      </p>

      <h2>Coming next</h2>
      <p>Paste the hotel&apos;s own list instead of the city default.</p>
    </main>
  );
}
