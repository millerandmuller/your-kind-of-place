import Link from "next/link";

// "How this works" auf Deutsch. Übersetzung von content.en.tsx:
// gleiche Struktur, gleiche Zahlen, gleiche Code-Beispiele.
export default function HowDE() {
  return (
    <>
      <p>
        <Link href="/">← Zurück zur Liste</Link>
      </p>
      <h1 className="brand">So funktioniert es</h1>
      <p className="lede">
        Jede Änderung an der Liste stammt aus Qloos Geschmacksdaten. Das Modell formuliert nur; es wählt nie einen Ort oder eine Begründung aus.
      </p>

      <h2>1. Die Standardliste</h2>
      <p>
        Ein Platzhalter für die hoteleigene Liste: Qloo Insights für Orte in der Stadt, ohne Geschmackssignal.
      </p>
      <p>
        <code>GET /v2/insights?filter.type=urn:entity:place&amp;filter.location.query=London&amp;filter.tags=urn:tag:genre:place:restaurant&amp;take=50</code>
      </p>
      <p>
        Dieser Tag liefert auch Hotels, Kaufhäuser, Arenen und Fast-Food-Ketten. So etwas empfiehlt ein Concierge nicht, deshalb
        behalten beide Listen nach Qloos <code>primary_genre</code> nur Gastronomie mit Sitzplätzen (Restaurants, Bars, Pubs, Cafés;
        keine Fast-Food-, Burger-, Eis- oder Donutläden, keine Lieferdienste oder Food Courts) und verwerfen alles an einem Flughafen oder mehr als 25 km vom Stadtzentrum entfernt (für New York wird Qloo nach
        „New York City“ gefragt). Bekannte Ketten (Hard Rock Cafe, PizzaExpress, Starbucks und ähnliche, eine feste Liste
        im Code) werden ebenfalls entfernt. Die 10 obersten verbleibenden Einträge bilden die Standardliste.
      </p>

      <h2>1b. Oder die hoteleigene Liste</h2>
      <p>
        Unter „Your guest (and list)“ kann ein Concierge die hoteleigene Liste einfügen, bis zu 10 Zeilen. Jede Zeile wird mit{" "}
        <code>GET /search?types=urn:entity:place</code> nachgeschlagen und einem Restaurant oder einer Bar im Umkreis von 25 km zugeordnet, nur über ganze Wörter und nie bei Zeilen wie „Our rooftop bar“ (gleicher Gastronomie-Filter wie
        oben, außer dass Ketten, die das Hotel selbst aufführt, erhalten bleiben): zuerst ein exakter Name, dann ein Ort, dessen Name die
        Zeile enthält („Dishoom“ → „Dishoom King&apos;s Cross“), dann ein Ort, dessen Name in der Zeile enthalten ist (wenn Qloos Suche diesen kürzeren Namen liefert). Zeilen, die
        mit „our“, „my“, „hotel&apos;s“ oder „in-house“ beginnen, bezeichnen hauseigene Lokale und werden nicht nachgeschlagen. Auf dem
        Bildschirm steht „listed as ‘Dishoom’“. Zeilen ohne Treffer bleiben so auf der Liste, wie sie eingegeben wurden, markiert als „not matched“, und werden
        nie gestrichen; eine Zeile, die einen bereits gelisteten Ort nennt, wird übersprungen und als Wiederholung angezeigt.
      </p>

      <h2>2. Der Gast</h2>
      <p>
        Bis zu drei Favoriten (eine Band, eine Serie, ein Film, eine Marke oder ein Spiel), gefunden mit <code>GET /search</code>. Passt ein Name auf
        mehr als eines, wird nachgefragt. Die einzige Ausnahme: Wenn ein einzelner exakter Treffer eine Qloo-Popularität von mindestens 0,9 hat und
        jeder andere exakte Treffer mindestens 0,15 darunter liegt („Succession“ die Serie, nicht der Film), wird er übernommen und sein
        Typ auf der Liste angezeigt, damit sichtbar ist, was verwendet wurde.
      </p>

      <h2>3. Die Geschmackstreffer des Gastes</h2>
      <p>Dieselbe Abfrage mit den Favoriten des Gastes als Signal und eingeschalteter Explainability:</p>
      <p>
        <code>…&amp;signal.interests.entities=&lt;ids&gt;&amp;feature.explainability=true&amp;take=50</code>
      </p>

      <h2>4. Die Bearbeitung (deterministisch)</h2>
      <ul>
        <li>
          <strong>Gestrichen:</strong> Listeneinträge, die nicht unter den Top 50 des Gastes sind, zuerst diejenigen, die der Geschmack dieses Gastes
          am wenigsten mag (Qloos Affinität für genau die Orte auf der Liste, über{" "}
          <code>filter.results.entities</code>; Orte ohne Qloo-Score kommen nach allen bewerteten, die auf der Liste am weitesten unten stehenden
          zuerst), höchstens so viele wie „Lines that may change“
          (3, 5 oder 10).
        </li>
        <li>
          <strong>Eingefügt:</strong> die besten Treffer des Gastes, die noch nicht auf der Liste stehen, einer pro gestrichenem Eintrag, in
          Qloos Reihenfolge.
        </li>
        <li>
          <strong>Gleiches Niveau wie die Liste (Restaurants &amp; Bars):</strong> Das Niveau der Liste ist der Median von Qloos
          Preisniveau (1 bis 4) ihrer Einträge, sofern mindestens drei eines haben. Die Treffer des Gastes werden dann auf
          diesem Niveau oder darüber abgefragt (<code>filter.price_level.min</code>), und auf einer Liste ab Niveau 3 wird kein Pub, kein Irish Pub und
          keine Sportsbar eingefügt. Themenlokale (Qloo-Dekor-Tag „Themed“) und eine feste Liste von Ketten werden nie eingefügt.
        </li>
        <li>
          <strong>Behalten:</strong> alles andere, ohne Markierung. Hat der Gast weniger neue Treffer als das Budget, ändert sich
          weniger. Die Liste wird nie aufgefüllt.
        </li>
        <li>
          <strong>Notizen:</strong> bei einer Einfügung der Favorit mit dem höchsten Explainability-Score für diesen Ort (beide
          Namen, wenn sie höchstens 0,1 auseinanderliegen), dann bis zu drei von Qloos eigenen Tags des Ortes (sein erster Interessen-Tag, sein
          erster Ambiente-Tag, der kein allgemeiner wie „casual“ ist, und „late night“, wenn Qloo ihn führt) und das
          Viertel. Bei einer Streichung: sein Rang nach der Geschmacksaffinität dieses Gastes unter den Orten der Liste („Lowest taste
          affinity on this list for this guest“) oder „Not among this guest&apos;s top 50 taste matches“, wenn Qloo keinen
          Score vergeben hat. Der kleine Balken unter jeder Notiz ist Qloos Geschmacksaffinität dieses Gastes für diesen Ort (0 bis 1).
        </li>
      </ul>
      <p>Gleicher Gast, gleiche Stadt, gleiches Budget: gleiche Liste.</p>

      <h2>5. Der Agent</h2>
      <p>
        „Ask the agent“ startet einen Agenten mit Google ADK (Claude über LiteLLM) mit fünf Tools: <code>resolve_interest</code>,{" "}
        <code>default_list</code>, <code>taste_places</code>, <code>edit_list</code>, <code>explain_place</code>. Er liest die
        Favoriten aus freiem Text, fragt nach, wenn ein Name unklar ist, und liefert dieselbe bearbeitete Liste wie das Formular, auf der
        hoteleigenen Liste, falls eine eingefügt wurde. Seine Tool-Aufrufe werden
        unter dem Ergebnis angezeigt; sein Satz wird auf dem Server geprüft und durch eine schlichte Zusammenfassung ersetzt, wenn er eine Zahl nennt, die die Tools
        nicht geliefert haben, oder die Liste mit irgendetwas vergleicht. Dieselbe Fähigkeit gibt es als MCP-Tool unter{" "}
        <code>https://your-kind-of-place-api-588508999301.us-east1.run.app/mcp/</code>: <code>edit_hotel_list(city, interests[], budget, hotel_list[])</code>.
      </p>

      <h2>6. Die Anreisen von morgen</h2>
      <p>
        Unter „Arrivals → morning report“ fügt ein Concierge bis zu sechs Anreisenotizen ein, so wie Rezeption oder CRM sie geschrieben haben. Ein
        zweiter ADK-Agent liest sie und ruft <code>record_guest</code> einmal pro Notiz mit bis zu drei Favoriten auf. Der Server
        behält einen Favoriten nur, wenn er wörtlich in dieser Notiz steht und nicht im selben Satzteil verneint wird („hates
        Coldplay“), und löst dann jeden in Qloo auf. Ohne den Agenten („Skip the agent“ oder wenn er scheitert) tippt der Concierge
        die Favoriten pro Gast ein. Der Concierge bestätigt oder
        entfernt jeden Favoriten (und wählt aus, wenn ein Name mehrdeutig ist); erst dann wird die Liste jedes Gastes nach denselben
        Regeln wie oben bearbeitet, auf der hoteleigenen Liste, falls eine eingefügt wurde. Der Morgenbericht zeigt die vollständige Liste jedes Gastes und
        kann kopiert oder gedruckt werden.
      </p>

      <h2>Was wir gemessen haben</h2>
      <p>
        Ein Blindtest mit 12 Paaren gegensätzlicher Gäste in San Francisco, Austin und London, zuerst am 25. Oktober 2026 und
        erneut am 30. Oktober mit der Preisniveau-Regel, die das Produkt verwendet:
      </p>
      <table>
        <tbody>
          <tr>
            <th>Blinde Zuordnung</th>
            <td>
              Ein separates Modell sah zwei Listen und zwei Gästeprofile, ohne Hinweis auf Qloo, und ordnete sie in{" "}
              <strong>10 von 12</strong> Fällen richtig zu (11 von 12 ohne die Preisniveau-Regel).
            </td>
          </tr>
          <tr>
            <th>Stabilität</th>
            <td>
              Dieselben Abfragen 14 Minuten später hatten im Schnitt eine Überlappung von <strong>0,99</strong>.
            </td>
          </tr>
          <tr>
            <th>Standard vs. Geschmack</th>
            <td>
              Die Liste eines Gastes und die Liste ohne Geschmackssignal hatten im Schnitt eine Überlappung von <strong>0,12</strong>: Die Standardliste
              wird stark umgeschrieben.
            </td>
          </tr>
        </tbody>
      </table>
      <p className="label">
        Der Lauf mit 10 von 12 verwendete den Gastronomie-Filter und die Preisniveau-Regel des Produkts; der erste Lauf (11 von 12)
        die Restaurant-Tag-Abfrage ohne beides. Stabilität und Überlappung stammen aus dem ersten Lauf. Bewertet hat ein Sprachmodell, kein Mensch;
        12 Fälle sind eine kleine Stichprobe, und die Profile waren bewusst gegensätzlich.
      </p>

      <h2>Welche Arten von Orten wir anbieten und warum nur diese</h2>
      <p>
        Bevor wir eine Kategorie aufgenommen haben, haben wir denselben Blindtest damit durchgeführt (vor dem Lauf schriftlich festgelegt: 12 Paare gegensätzlicher Gäste
        in San Francisco, Austin und London, ein separates Modell, das zwei Listen zwei Gästen zuordnet, ohne von Qloo zu wissen,
        bestanden ab 10 von 12; eine Liste mit weniger als 8 Orten zählt als Fehlschlag). Ins Produkt kommt nur, was besteht;
        jedes Ergebnis, bestanden oder nicht, steht hier.
      </p>
      <table>
        <tbody>
          <tr>
            <th>Restaurants &amp; Bars</th>
            <td>
              <strong>10 von 12</strong> mit der Preisniveau-Regel (11 von 12 ohne die Preisniveau-Regel) — angeboten, und der
              Demo-Pfad
            </td>
          </tr>
          <tr>
            <th>Livemusik &amp; Nachtleben</th>
            <td>
              <strong>10 von 12</strong> — angeboten unter „Your guest (and list)“ und „Morning report“. Genau auf der Grenze.
            </td>
          </tr>
          <tr>
            <th>Tagsüber: Museen &amp; Galerien</th>
            <td>
              10 von 12 — bestanden, aber nicht angeboten: genau auf der Grenze, mit geringer Sicherheit des Bewerters (2,4 von 5),
              und zwei gegensätzliche Gäste teilten sich die meisten Museen (Überlappung 0,78), die Bearbeitung änderte also wenig.
            </td>
          </tr>
          <tr>
            <th>Tagsüber: Parks &amp; Gärten</th>
            <td>8 von 12 — nicht angeboten: Zwei gegensätzliche Gäste bekamen weitgehend dieselben Parks.</td>
          </tr>
          <tr>
            <th>Tagsüber: Cafés</th>
            <td>5 von 12 — nicht angeboten: in 3 Fällen zu wenige Cafés, und der Rest schwer zu unterscheiden.</td>
          </tr>
          <tr>
            <th>Tagsüber: Spa &amp; Wellness</th>
            <td>4 von 12 — nicht angeboten: Unter dem Spa-Tag liefert Qloo überwiegend Hotels, daher waren 8 von 12 Listen zu kurz.</td>
          </tr>
          <tr>
            <th>Geschäfte</th>
            <td>9 von 12 — nicht angeboten: Zwei gegensätzliche Gäste bekamen weitgehend dieselben Geschäfte.</td>
          </tr>
          <tr>
            <th>Sehenswürdigkeiten &amp; Attraktionen</th>
            <td>
              3 von 12 — nicht angeboten: Mit dem Geschmack eines Gastes driftet Qloos Attraktions-Tag zu Hotels und Spielhallen, und in 6
              von 12 Fällen blieben zu wenige echte Sehenswürdigkeiten übrig.
            </td>
          </tr>
        </tbody>
      </table>
      <p className="label">
        Der Nachtleben-Test behielt alles, was Qloo unter Livemusik und Nachtclubs führt, außer Hotels. Das Produkt ist
        strenger: Es behält nur Veranstaltungsorte, Clubs, Bars und Pubs und entfernt in jeder Kategorie Erwachsenenlokale (nach Qloo-Genre, Tag
        oder Ortsbeschreibung).
      </p>

      <h2>Was wir nicht behaupten</h2>
      <p className="limit">
        Passt zu diesem Gast, nicht ‚besser‘. Selbst ähnliche Geschmäcker bekommen unterschiedliche Listen, deshalb behaupten wir nichts über
        ähnliche Gäste.
      </p>
      <p>Die Beispiele in der App sind gegensätzliche Gäste, nacheinander oder nebeneinander unter „Compare“.</p>
      <p>
        Annehmen und Ablehnen werden nur auf dem eigenen Bildschirm gespeichert. Demo-Gäste können aus gespeicherten Qloo-Ergebnissen beantwortet werden und sind als
        „cached result“ markiert. {""}
        Notizen sind aggregierte Geschmacksaffinität von Qloo, keine Rezensionen.
      </p>

      <h2>Als Nächstes</h2>
      <p>Die richtige Filiale wählen, wenn ein Name auf mehrere passt (derzeit wird die erste in der Stadt genommen und angezeigt).</p>
    </>
  );
}
