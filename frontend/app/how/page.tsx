import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "How Your Kind of Place works" };

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
        no fast food, burger, ice-cream or donut shops, delivery or food courts) and drop anything at an airport or more than 25 km from the city centre (for New York, Qloo is asked for
        “New York City”). Well-known chains (Hard Rock Cafe, PizzaExpress, Starbucks and similar, a fixed list
        in the code) are dropped too. The top 10 that remain are the default list.
      </p>

      <h2>1b. Or the hotel&apos;s own list</h2>
      <p>
        Under “Your guest (and list)” a concierge can paste the hotel&apos;s own list, up to 10 lines. Each line is looked up with{" "}
        <code>GET /search?types=urn:entity:place</code> and matched to a restaurant or bar within 25 km, on whole words, never for lines like “Our rooftop bar” (same dining filter as
        above, except that chains the hotel lists itself are kept): an exact name first, then a place whose name contains the
        line (“Dishoom” → “Dishoom King&apos;s Cross”), then a place whose name the line contains (when Qloo&apos;s search returns that shorter name). Lines that start
        with “our”, “my”, “hotel&apos;s” or “in-house” name the hotel&apos;s own places and are not looked up. The
        screen says “listed as ‘Dishoom’”. Lines that don&apos;t match stay on the list as typed, marked “not matched”, and are
        never struck; a line naming a place already on the list is skipped and shown as a repeat.
      </p>

      <h2>2. The guest</h2>
      <p>
        Up to three favourites (a band, show, film, brand or game), found with <code>GET /search</code>. If a name matches more
        than one thing, it asks. The one exception: when a single exact match has Qloo popularity of at least 0.9 and
        every other exact match is at least 0.15 lower (“Succession” the show, not the film), it takes it and shows its
        type on the list, so you can see what it used.
      </p>

      <h2>3. The guest&apos;s taste matches</h2>
      <p>The same query with the guest&apos;s favourites as the signal and explainability switched on:</p>
      <p>
        <code>…&amp;signal.interests.entities=&lt;ids&gt;&amp;feature.explainability=true&amp;take=50</code>
      </p>

      <h2>4. The edit (deterministic)</h2>
      <ul>
        <li>
          <strong>Struck:</strong> list entries that are not in the guest&apos;s top 50, the ones this guest&apos;s taste
          likes least first (Qloo&apos;s affinity for exactly the places on the list, via{" "}
          <code>filter.results.entities</code>; places Qloo gives no score come after all scored ones, lowest on the list
          first), at most as many as the swap budget
          (3, 5 or 10).
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
          names when they are within 0.1), plus Qloo&apos;s neighbourhood and place type. For a strike: its rank by this
          guest&apos;s taste affinity among the list&apos;s places (“Lowest taste affinity on this list for this guest”), or
          “Not among this guest&apos;s top 50 taste matches” when Qloo gave it no score.
        </li>
      </ul>
      <p>Same guest, same city, same budget: same list.</p>

      <h2>5. The agent</h2>
      <p>
        “Ask the agent” runs a Google ADK agent (Claude via LiteLLM) with five tools: <code>resolve_interest</code>,{" "}
        <code>default_list</code>, <code>taste_places</code>, <code>edit_list</code>, <code>explain_place</code>. It reads the
        favourites out of free text, asks when a name is unclear and returns the same edited list as the form, on the hotel&apos;s
        own list if one is pasted. Its tool calls are shown
        under the result; its sentence is checked on the server and replaced by a plain summary if it names a number the tools
        didn&apos;t return or compares the list to anything. The same capability is an MCP tool at{" "}
        <code>https://your-kind-of-place-api-588508999301.us-east1.run.app/mcp/</code>: <code>edit_hotel_list(city, interests[], budget, hotel_list[])</code>.
      </p>

      <h2>6. Tomorrow&apos;s arrivals</h2>
      <p>
        Under “Arrivals → morning report” a concierge pastes up to six arrival notes as the front desk or CRM wrote them. A
        second ADK agent reads them and calls <code>record_guest</code> once per note with up to three favourites. The server
        keeps a favourite only if it is literally written in that note and not negated in the same clause (“hates
        Coldplay”), then resolves each in Qloo. Without the agent (“Skip the agent”, or if it fails) the concierge types
        favourites per guest. The concierge confirms or
        removes every favourite (and picks when a name is ambiguous); only then is each guest&apos;s list edited with the same
        rules as above, on the hotel&apos;s own list if one was pasted. The morning report shows each guest&apos;s full list and
        can be copied or printed.
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

      <h2>Which kinds of place we offer, and why only these</h2>
      <p>
        Before adding a category we ran the same blind test on it (written down before the run: 12 pairs of opposite guests
        in San Francisco, Austin and London, a separate model matching two lists to two guests without knowing about Qloo,
        pass at 10 of 12 or better; a list with fewer than 8 places counts as a miss).
      </p>
      <table>
        <tbody>
          <tr>
            <th>Restaurants &amp; bars</th>
            <td>11 of 12 (the first test, above) — offered, and the demo path</td>
          </tr>
          <tr>
            <th>Live music &amp; nightlife</th>
            <td>
              <strong>10 of 12</strong> — offered under “Your guest (and list)” and “Arrivals”. Right on the line, so treat it as
              the weaker of the two.
            </td>
          </tr>
          <tr>
            <th>Shops</th>
            <td>9 of 12 — not offered: two opposite guests got largely the same shops.</td>
          </tr>
          <tr>
            <th>Sights &amp; attractions</th>
            <td>
              3 of 12 — not offered: with a guest&apos;s taste, Qloo&apos;s attraction tag drifts to hotels and arcades, and in 6
              of 12 cases too few real sights were left.
            </td>
          </tr>
        </tbody>
      </table>
      <p className="label">
        The nightlife test kept everything Qloo files under live music and night clubs except hotels. The product is
        stricter: it keeps venues, clubs, bars and pubs only, and in every category drops adult venues (by Qloo genre, tag
        or place description).
      </p>

      <h2>What we don&apos;t claim</h2>
      <p className="limit">
        Fits this guest, not &apos;better&apos;. Even similar tastes get different lists, so we don&apos;t claim anything about
        similar guests.
      </p>
      <p>The examples in the app are opposite guests, one after the other or side by side under “Compare”.</p>
      <p>
        Accept and reject are only kept on your screen. Demo guests may be answered from saved Qloo results and are marked
        “cached result”. {""}
        Notes are aggregate taste affinity from Qloo, not reviews.
      </p>

      <h2>Coming next</h2>
      <p>Pick the right branch when a name matches several (today the first one in town is taken and shown).</p>
    </main>
  );
}
