import Link from "next/link";

// "How this works" en français. Traduction de content.en.tsx :
// même structure, mêmes chiffres, mêmes exemples de code.
export default function HowFR() {
  return (
    <>
      <p>
        <Link href="/">← Retour à la liste</Link>
      </p>
      <h1 className="brand">Comment ça marche</h1>
      <p className="lede">
        Chaque modification de la liste provient des données de goût de Qloo. Le modèle ne fait que rédiger ; il ne choisit jamais un lieu ni une raison.
      </p>

      <h2>1. La liste par défaut</h2>
      <p>
        Elle tient lieu de liste propre à l&apos;hôtel : Qloo Insights pour les lieux de la ville, sans signal de goût.
      </p>
      <p>
        <code>GET /v2/insights?filter.type=urn:entity:place&amp;filter.location.query=London&amp;filter.tags=urn:tag:genre:place:restaurant&amp;take=50</code>
      </p>
      <p>
        Ce tag renvoie aussi des hôtels, des grands magasins, des arénas et des chaînes de restauration rapide. Un concierge ne les recommande pas ; les
        deux listes ne gardent donc, selon le <code>primary_genre</code> de Qloo, que des lieux où l&apos;on s&apos;assoit pour manger et boire (restaurants, bars, pubs, cafés ;
        pas de fast-food, de burgers, de glaciers ni de donuts, pas de livraison ni d&apos;aires de restauration) et écartent tout ce qui se trouve dans un aéroport ou à plus de 25 km du centre-ville (pour New York, on demande
        « New York City » à Qloo). Les chaînes connues (Hard Rock Cafe, PizzaExpress, Starbucks et similaires, une liste fixe
        dans le code) sont également écartées. Les 10 premiers lieux restants forment la liste par défaut.
      </p>

      <h2>1b. Ou la liste de l&apos;hôtel</h2>
      <p>
        Sous « Your guest (and list) », un concierge peut coller la liste de l&apos;hôtel, jusqu&apos;à 10 lignes. Chaque ligne est recherchée avec{" "}
        <code>GET /search?types=urn:entity:place</code> et associée à un restaurant ou un bar dans un rayon de 25 km, sur des mots entiers, jamais pour des lignes comme « Our rooftop bar » (même filtre de restauration que
        ci-dessus, sauf que les chaînes que l&apos;hôtel inscrit lui-même sont conservées) : d&apos;abord un nom exact, puis un lieu dont le nom contient la
        ligne (« Dishoom » → « Dishoom King&apos;s Cross »), puis un lieu dont le nom est contenu dans la ligne (quand la recherche de Qloo renvoie ce nom plus court). Les lignes qui commencent
        par « our », « my », « hotel&apos;s » ou « in-house » désignent les lieux propres à l&apos;hôtel et ne sont pas recherchées. L&apos;écran
        affiche « listed as ‘Dishoom’ ». Les lignes sans correspondance restent sur la liste telles que saisies, marquées « not matched », et ne sont
        jamais barrées ; une ligne qui nomme un lieu déjà sur la liste est ignorée et affichée comme doublon.
      </p>

      <h2>2. Le client</h2>
      <p>
        Jusqu&apos;à trois favoris (un groupe, une série, un film, une marque ou un jeu), trouvés avec <code>GET /search</code>. Si un nom correspond à
        plusieurs choses, l&apos;outil demande. Seule exception : lorsqu&apos;une seule correspondance exacte a une popularité Qloo d&apos;au moins 0,9 et que
        toutes les autres correspondances exactes sont inférieures d&apos;au moins 0,15 (« Succession » la série, pas le film), il la retient et affiche son
        type sur la liste, pour qu&apos;on voie ce qui a été utilisé.
      </p>

      <h2>3. Les correspondances de goût du client</h2>
      <p>La même requête avec les favoris du client comme signal et l&apos;explicabilité activée :</p>
      <p>
        <code>…&amp;signal.interests.entities=&lt;ids&gt;&amp;feature.explainability=true&amp;take=50</code>
      </p>

      <h2>4. La modification (déterministe)</h2>
      <ul>
        <li>
          <strong>Barrés :</strong> les entrées de la liste qui ne figurent pas dans le top 50 du client, en commençant par celles que le goût de ce client
          apprécie le moins (l&apos;affinité de Qloo pour exactement les lieux de la liste, via{" "}
          <code>filter.results.entities</code> ; les lieux sans score Qloo viennent après tous ceux qui en ont un, les plus bas sur la liste
          en premier), au plus autant que « Lines that may change »
          (3, 5 ou 10).
        </li>
        <li>
          <strong>Insérés :</strong> les meilleures correspondances du client qui ne sont pas encore sur la liste, une par entrée barrée, dans
          l&apos;ordre de Qloo.
        </li>
        <li>
          <strong>Même niveau que la liste (restaurants &amp; bars) :</strong> le niveau de la liste est la médiane du niveau de prix Qloo
          (1 à 4) de ses entrées, lorsqu&apos;au moins trois en ont un. Les correspondances du client sont alors demandées à
          ce niveau ou au-dessus (<code>filter.price_level.min</code>), et sur une liste de niveau 3 ou plus, aucun pub, pub irlandais ni
          bar sportif n&apos;est inséré. Les lieux à thème (tag de décor Qloo « Themed ») et une liste fixe de chaînes ne sont jamais insérés.
        </li>
        <li>
          <strong>Conservés :</strong> tout le reste, sans marque. Si le client a moins de nouvelles correspondances que le budget, moins de choses
          changent. La liste n&apos;est jamais complétée artificiellement.
        </li>
        <li>
          <strong>Notes :</strong> pour une insertion, le favori avec le score d&apos;explicabilité le plus élevé pour ce lieu (les deux
          noms quand l&apos;écart est d&apos;au plus 0,1), puis jusqu&apos;à trois tags Qloo propres au lieu (son premier tag d&apos;intérêt, son
          premier tag d&apos;ambiance qui n&apos;est pas générique comme « casual », et « late night » quand Qloo l&apos;indique) et le
          quartier. Pour un lieu barré : son rang selon l&apos;affinité de goût de ce client parmi les lieux de la liste (« Lowest taste
          affinity on this list for this guest »), ou « Not among this guest&apos;s top 50 taste matches » quand Qloo ne lui a donné aucun
          score. La petite barre sous chaque note est l&apos;affinité de goût de ce client pour ce lieu selon Qloo (0 à 1).
        </li>
      </ul>
      <p>Même client, même ville, même budget : même liste.</p>

      <h2>5. L&apos;agent</h2>
      <p>
        « Ask the agent » lance un agent Google ADK (Claude via LiteLLM) avec cinq outils : <code>resolve_interest</code>,{" "}
        <code>default_list</code>, <code>taste_places</code>, <code>edit_list</code>, <code>explain_place</code>. Il extrait les
        favoris d&apos;un texte libre, demande quand un nom n&apos;est pas clair et renvoie la même liste modifiée que le formulaire, sur la liste
        de l&apos;hôtel si elle a été collée. Ses appels d&apos;outils sont affichés
        sous le résultat ; sa phrase est vérifiée sur le serveur et remplacée par un résumé simple si elle cite un nombre que les outils
        n&apos;ont pas renvoyé ou compare la liste à quoi que ce soit. La même fonctionnalité existe comme outil MCP à l&apos;adresse{" "}
        <code>https://your-kind-of-place-api-588508999301.us-east1.run.app/mcp/</code> : <code>edit_hotel_list(city, interests[], budget, hotel_list[])</code>.
      </p>

      <h2>6. Les arrivées de demain</h2>
      <p>
        Sous « Arrivals → morning report », un concierge colle jusqu&apos;à six notes d&apos;arrivée telles que la réception ou le CRM les a rédigées. Un
        second agent ADK les lit et appelle <code>record_guest</code> une fois par note avec jusqu&apos;à trois favoris. Le serveur
        ne garde un favori que s&apos;il est écrit tel quel dans cette note et n&apos;est pas nié dans la même proposition (« hates
        Coldplay »), puis résout chacun dans Qloo. Sans l&apos;agent (« Skip the agent », ou s&apos;il échoue), le concierge saisit les
        favoris par client. Le concierge confirme ou
        retire chaque favori (et choisit quand un nom est ambigu) ; ce n&apos;est qu&apos;ensuite que la liste de chaque client est modifiée selon les mêmes
        règles que ci-dessus, sur la liste de l&apos;hôtel si elle a été collée. Le rapport du matin affiche la liste complète de chaque client et
        peut être copié ou imprimé.
      </p>

      <h2>Ce que nous avons mesuré</h2>
      <p>
        Un test à l&apos;aveugle avec 12 paires de clients opposés à San Francisco, Austin et London, d&apos;abord le 25 octobre 2026,
        puis le 30 octobre avec la règle de niveau de prix qu&apos;utilise le produit :
      </p>
      <table>
        <tbody>
          <tr>
            <th>Association à l&apos;aveugle</th>
            <td>
              Un modèle distinct a vu deux listes et deux profils de clients, sans aucune mention de Qloo, et les a associés correctement dans{" "}
              <strong>10 cas sur 12</strong> (11 sur 12 sans la règle de niveau de prix).
            </td>
          </tr>
          <tr>
            <th>Stabilité</th>
            <td>
              Les mêmes requêtes, 14 minutes plus tard, se recoupaient à <strong>0,99</strong> en moyenne.
            </td>
          </tr>
          <tr>
            <th>Défaut vs goût</th>
            <td>
              La liste d&apos;un client et la liste sans signal de goût se recoupaient à <strong>0,12</strong> en moyenne : la liste par défaut
              est fortement réécrite.
            </td>
          </tr>
        </tbody>
      </table>
      <p className="label">
        Le passage à 10 sur 12 utilisait le filtre de restauration et la règle de niveau de prix du produit ; le premier passage
        (11 sur 12), la requête par tag restaurant sans eux. Stabilité et recoupement viennent du premier passage. Le juge était un modèle de langage, pas une personne ;
        12 cas forment un petit échantillon, et les profils étaient volontairement opposés.
      </p>

      <h2>Les types de lieux que nous proposons, et pourquoi seulement ceux-là</h2>
      <p>
        Avant d&apos;ajouter une catégorie, nous lui avons appliqué le même test à l&apos;aveugle (fixé par écrit avant l&apos;exécution : 12 paires de clients opposés
        à San Francisco, Austin et London, un modèle distinct associant deux listes à deux clients sans connaître Qloo,
        réussite à partir de 10 sur 12 ; une liste de moins de 8 lieux compte comme un échec). Seul ce qui réussit entre dans le
        produit ; chaque résultat, réussi ou non, figure ici.
      </p>
      <table>
        <tbody>
          <tr>
            <th>Restaurants &amp; bars</th>
            <td>
              <strong>10 sur 12</strong> avec la règle de niveau de prix (11 sur 12 sans la règle de niveau de prix) — proposé, et le
              parcours de démo
            </td>
          </tr>
          <tr>
            <th>Musique live &amp; vie nocturne</th>
            <td>
              <strong>10 sur 12</strong> — proposé sous « Your guest (and list) » et « Morning report ». Pile sur le seuil.
            </td>
          </tr>
          <tr>
            <th>Journée : musées &amp; galeries</th>
            <td>
              10 sur 12 — réussi, mais non proposé : pile sur le seuil, avec une faible confiance du juge (2,4 sur 5), et deux clients
              opposés partageaient la plupart des musées (recoupement 0,78), la modification changeait donc peu de chose.
            </td>
          </tr>
          <tr>
            <th>Journée : parcs &amp; jardins</th>
            <td>8 sur 12 — non proposé : deux clients opposés ont obtenu en grande partie les mêmes parcs.</td>
          </tr>
          <tr>
            <th>Journée : cafés</th>
            <td>5 sur 12 — non proposé : trop peu de cafés dans 3 cas, et le reste difficile à distinguer.</td>
          </tr>
          <tr>
            <th>Journée : spa &amp; bien-être</th>
            <td>4 sur 12 — non proposé : sous le tag spa, Qloo renvoie surtout des hôtels, donc 8 listes sur 12 étaient trop courtes.</td>
          </tr>
          <tr>
            <th>Boutiques</th>
            <td>9 sur 12 — non proposé : deux clients opposés ont obtenu en grande partie les mêmes boutiques.</td>
          </tr>
          <tr>
            <th>Sites &amp; attractions</th>
            <td>
              3 sur 12 — non proposé : avec le goût d&apos;un client, le tag attraction de Qloo dérive vers des hôtels et des salles d&apos;arcade, et dans 6
              cas sur 12 il restait trop peu de vrais sites.
            </td>
          </tr>
        </tbody>
      </table>
      <p className="label">
        Le test vie nocturne gardait tout ce que Qloo classe sous musique live et boîtes de nuit, sauf les hôtels. Le produit est
        plus strict : il ne garde que les salles de concert, clubs, bars et pubs, et écarte dans chaque catégorie les lieux pour adultes (selon le genre Qloo, un tag
        ou la description du lieu).
      </p>

      <h2>Toronto et Montréal (la démo client)</h2>
      <p>
        La démo client montre un hôtel fictif, Montreonto, avec une maison à Toronto et une à Montréal. Avant de les utiliser,
        les deux villes ont passé un test de base (10 lieux chacune, tous avec un quartier ; le niveau de prix de la liste
        maison est 2) et le même test à l&apos;aveugle, fixé avant le passage : 12 paires de clients opposés aux favoris
        canadiens, 6 par ville, restaurants et bars au niveau de prix de la liste maison. Le modèle séparé a vu juste dans{" "}
        <strong>12 cas sur 12</strong>. Les deux clients d&apos;exemple par ville sont la paire du test dont les clients
        partagent le moins d&apos;ajouts (aucun), choisie selon une règle fixée avant le passage. Les mêmes limites
        s&apos;appliquent : clients opposés, un modèle de langage comme juge, 12 cas. Le test portait sur les restaurants et
        bars ; l&apos;onglet « Le soir » (musique live et vie nocturne) n&apos;a pas été testé dans ces deux villes, et à Montréal il
        change peu (0 et 1 sur 10 pour les deux clients d&apos;exemple).
      </p>

      <h2>Ce que nous n&apos;affirmons pas</h2>
      <p className="limit">
        Convient à ce client, pas « meilleur ». Même des goûts similaires obtiennent des listes différentes, c&apos;est pourquoi nous n&apos;affirmons rien sur
        des clients similaires.
      </p>
      <p>Les exemples dans l&apos;application sont des clients opposés, l&apos;un après l&apos;autre ou côte à côte sous « Compare ».</p>
      <p>
        Accepter et refuser ne sont conservés que sur votre écran. Les clients de démo peuvent recevoir une réponse tirée de résultats Qloo enregistrés et sont marqués
        « cached result ». {""}
        Les notes sont une affinité de goût agrégée de Qloo, pas des avis.
      </p>

      <h2>À venir</h2>
      <p>Choisir le bon établissement quand un nom en désigne plusieurs (aujourd&apos;hui, le premier en ville est retenu et affiché).</p>
    </>
  );
}
