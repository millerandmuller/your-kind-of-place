// Interface language. English is the default; strings are keyed by their English text, so a
// missing translation shows English instead of a key. Place names and Qloo's tags are never translated.
export type Lang = "en" | "de" | "fr";

export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "de", label: "DE", name: "Deutsch" },
  { id: "fr", label: "FR", name: "Français" },
];

export const LOCALE: Record<Lang, string> = { en: "en-GB", de: "de-DE", fr: "fr-FR" };

export function pickLang(v?: string | null): Lang {
  return v === "de" || v === "fr" ? v : "en";
}

export type Vars = Record<string, string | number>;

// English text → German and French. Placeholders in braces: {n}, {city} …
export const DICT: Record<string, { de: string; fr: string }> = {
  // Questions and messages the server sends in English, rebuilt here
  "{n} matches for ‘{q}’. Which one do you mean?": {
    de: "{n} Treffer für ‘{q}’. Welchen meinen Sie?",
    fr: "{n} résultats pour ‘{q}’. Lequel voulez-vous dire ?",
  },
  "We couldn't find this in Qloo's graph. Try a band, show, film or brand.": {
    de: "Das haben wir in Qloo nicht gefunden. Versuchen Sie eine Band, Serie, einen Film oder eine Marke.",
    fr: "Introuvable dans Qloo. Essayez un groupe, une série, un film ou une marque.",
  },

  "Additions shared with other rooms: {list}": {
    de: "Ergänzungen, die auch andere Zimmer bekommen: {list}",
    fr: "Ajouts communs avec d'autres chambres : {list}",
  },
  "{n} of {m} with {room}": { de: "{n} von {m} mit {room}", fr: "{n} sur {m} avec {room}" },

  "Sample arrivals, chosen to show contrast. Try your own notes above.": {
    de: "Beispiel-Anreisen, ausgewählt, um Unterschiede zu zeigen. Probieren Sie oben eigene Notizen aus.",
    fr: "Arrivées d'exemple, choisies pour montrer le contraste. Essayez vos propres notes ci-dessus.",
  },
  "Sample arrivals, chosen to show contrast. Try your own notes here.": {
    de: "Beispiel-Anreisen, ausgewählt, um Unterschiede zu zeigen. Probieren Sie hier eigene Notizen aus.",
    fr: "Arrivées d'exemple, choisies pour montrer le contraste. Essayez vos propres notes ici.",
  },

  Map: { de: "Karte", fr: "Carte" },

  // Client demo: Montreonto Hotels (fictional)
  "Client demo": { de: "Kunden-Demo", fr: "Démo client" },
  "A fictional hotel · created for this demo": {
    de: "Ein fiktives Hotel · für diese Demo erfunden",
    fr: "Un hôtel fictif · créé pour cette démo",
  },
  "Montreonto {city}, Room {room}: what a guest gets on their phone after check-in. The hotel's list, edited for this guest. Tap a place to open it in Maps.": {
    de: "Montreonto {city}, Zimmer {room}: was ein Gast nach dem Check-in auf dem Handy bekommt. Die Liste des Hotels, für diesen Gast bearbeitet. Tippen Sie auf einen Ort, um ihn in Maps zu öffnen.",
    fr: "Montreonto {city}, chambre {room} : ce qu'un client reçoit sur son téléphone après l'arrivée. La liste de l'hôtel, modifiée pour ce client. Touchez un lieu pour l'ouvrir dans Maps.",
  },
  "Places, notes and tags are live Qloo results. Montreonto is fictional.": {
    de: "Orte, Notizen und Tags sind echte Qloo-Ergebnisse. Montreonto ist erfunden.",
    fr: "Les lieux, notes et tags sont des résultats Qloo en direct. Montreonto est fictif.",
  },
  "A guest's phone": { de: "Das Handy eines Gastes", fr: "Le téléphone d'un client" },
  Language: { de: "Sprache", fr: "Langue" },
  Lists: { de: "Listen", fr: "Listes" },
  "Sample guests, chosen to show contrast.": {
    de: "Beispiel-Gäste, ausgewählt, um Unterschiede zu zeigen.",
    fr: "Clients d'exemple, choisis pour montrer le contraste.",
  },
  "Welcome to Montreonto {city}, {name}": { de: "Willkommen im Montreonto {city}, {name}", fr: "Bienvenue au Montreonto {city}, {name}" },
  "Room {room}": { de: "Zimmer {room}", fr: "Chambre {room}" },
  "Loves {list}": { de: "Mag {list}", fr: "Aime {list}" },
  "Montreonto's house list (stands in: the city's top places with no taste signal)": {
    de: "Hausliste des Montreonto (Platzhalter: die Top-Orte der Stadt ohne Geschmackssignal)",
    fr: "Liste maison du Montreonto (à la place : les meilleurs lieux de la ville, sans signal de goût)",
  },
  "Couldn't load the list. Try again in a moment.": {
    de: "Die Liste ließ sich nicht laden. Bitte gleich noch einmal versuchen.",
    fr: "Impossible de charger la liste. Réessayez dans un instant.",
  },
  "Loading the list…": { de: "Liste wird geladen …", fr: "Chargement de la liste…" },
  "After dark": { de: "Am Abend", fr: "Le soir" },
  "Switch to day": { de: "Zur Tagansicht wechseln", fr: "Passer en mode jour" },
  "Switch to night": { de: "Zur Nachtansicht wechseln", fr: "Passer en mode nuit" },

  // Nav and message for the guest
  "How this works": { de: "So funktioniert es", fr: "Comment ça marche" },
  "Switch between day and night look": { de: "Zwischen Tag- und Nachtansicht wechseln", fr: "Basculer entre l'affichage jour et nuit" },
  Night: { de: "Nacht", fr: "Nuit" },
  Day: { de: "Tag", fr: "Jour" },
  "Message for the guest": { de: "Nachricht für den Gast", fr: "Message pour le client" },
  Copied: { de: "Kopiert", fr: "Copié" },
  "Copy for WhatsApp": { de: "Für WhatsApp kopieren", fr: "Copier pour WhatsApp" },
  "Copy for email": { de: "Für E-Mail kopieren", fr: "Copier pour l'e-mail" },
  Print: { de: "Drucken", fr: "Imprimer" },
  Guest: { de: "Gast", fr: "Client" },
  Hotel: { de: "Hotel", fr: "Hôtel" },
  Arrival: { de: "Anreise", fr: "Arrivée" },
  "Guest's language": { de: "Sprache des Gastes", fr: "Langue du client" },
  Subject: { de: "Betreff", fr: "Objet" },
  "Nothing is sent from here: copy the text into WhatsApp or your email, or print it.": {
    de: "Von hier wird nichts versendet: Kopieren Sie den Text in WhatsApp oder Ihre E-Mail, oder drucken Sie ihn.",
    fr: "Rien n'est envoyé depuis cette page : copiez le texte dans WhatsApp ou dans votre e-mail, ou imprimez-le.",
  },

  // Labels from lib/api.ts
  "Restaurants & bars": { de: "Restaurants & Bars", fr: "Restaurants et bars" },
  "Live music & nightlife": { de: "Livemusik & Nachtleben", fr: "Musique live et vie nocturne" },
  "Aggregate taste affinity from Qloo, not a review.": {
    de: "Aggregierte Geschmacksaffinität aus Qloo, keine Rezension.",
    fr: "Affinité de goût agrégée issue de Qloo, pas un avis.",
  },
  "Your hotel's list: each line matched to a restaurant or bar in Qloo; lines it can't match are kept as is": {
    de: "Ihre Hotelliste: Jede Zeile wird einem Restaurant oder einer Bar in Qloo zugeordnet; Zeilen ohne Treffer bleiben unverändert",
    fr: "La liste de votre hôtel : chaque ligne est associée à un restaurant ou un bar dans Qloo ; les lignes sans correspondance restent telles quelles",
  },
  "Default list: the city's top places with no taste signal (stands in for the hotel's list)": {
    de: "Standardliste: die beliebtesten Orte der Stadt ohne Geschmackssignal (steht für die Hotelliste)",
    fr: "Liste par défaut : les adresses phares de la ville, sans signal de goût (remplace la liste de l'hôtel)",
  },

  // List editor
  "Hotel's own · kept as is": { de: "Hauseigen · unverändert übernommen", fr: "Propre à l'hôtel · conservé tel quel" },
  "Not matched to a restaurant or bar in Qloo · kept as is": {
    de: "Keinem Restaurant und keiner Bar in Qloo zugeordnet · unverändert übernommen",
    fr: "Aucun restaurant ni bar correspondant dans Qloo · conservé tel quel",
  },
  "{base} · listed as “{typed}”": { de: "{base} · eingetragen als „{typed}“", fr: "{base} · indiqué comme « {typed} »" },
  "{name} on Google Maps": { de: "{name} auf Google Maps", fr: "{name} sur Google Maps" },
  "Open in Google Maps": { de: "In Google Maps öffnen", fr: "Ouvrir dans Google Maps" },
  "Qloo taste affinity of this guest for the place (0 to 1)": {
    de: "Geschmacksaffinität dieses Gastes zu diesem Ort laut Qloo (0 bis 1)",
    fr: "Affinité de goût de ce client pour ce lieu selon Qloo (de 0 à 1)",
  },
  "affinity {v}": { de: "Affinität {v}", fr: "affinité {v}" },
  "{city}: {a} vs. {b}": { de: "{city}: {a} vs. {b}", fr: "{city} : {a} vs {b}" },
  "This example needs a pick first. Try another example.": {
    de: "Für dieses Beispiel muss zuerst eine Auswahl getroffen werden. Versuchen Sie ein anderes Beispiel.",
    fr: "Cet exemple nécessite d'abord un choix. Essayez un autre exemple.",
  },
  "Every guest gets the *same list*. We edit it into **their kind of place**.": {
    de: "Jeder Gast bekommt die *gleiche Liste*. Wir machen daraus **genau seine Liste**.",
    fr: "Chaque client reçoit la *même liste*. Nous en faisons **la sienne**.",
  },
  "The hotel's list of restaurants and bars, edited per guest in track changes, with a reason from Qloo's taste data on every change.": {
    de: "Die Restaurant- und Barliste des Hotels, für jeden Gast im Änderungsmodus bearbeitet, mit einer Begründung aus den Geschmacksdaten von Qloo für jede Änderung.",
    fr: "La liste des restaurants et bars de l'hôtel, modifiée pour chaque client en mode suivi des modifications, avec une justification tirée des données de goût de Qloo pour chaque changement.",
  },
  Example: { de: "Beispiel", fr: "Exemple" },
  "Lines that may change": { de: "Zeilen, die sich ändern dürfen", fr: "Lignes modifiables" },
  "Whose list": { de: "Wessen Liste", fr: "Liste de qui" },
  "Hotel in {city}": { de: "Hotel in {city}", fr: "Hôtel à {city}" },
  "Default list": { de: "Standardliste", fr: "Liste par défaut" },
  "Guest 1 checks in": { de: "Gast 1 checkt ein", fr: "Le client 1 arrive" },
  "Guest 2, same hotel": { de: "Gast 2, gleiches Hotel", fr: "Client 2, même hôtel" },
  Compare: { de: "Vergleichen", fr: "Comparer" },
  "Guest 1": { de: "Gast 1", fr: "Client 1" },
  "Guest 2": { de: "Gast 2", fr: "Client 2" },
  "Try your own": { de: "Selbst ausprobieren", fr: "Essayez vous-même" },
  "Your guest (and list)": { de: "Ihr Gast (und Ihre Liste)", fr: "Votre client (et votre liste)" },
  "Tomorrow's arrivals": { de: "Anreisen von morgen", fr: "Arrivées de demain" },
  "Morning report": { de: "Morgenbericht", fr: "Rapport du matin" },
  "Try again": { de: "Erneut versuchen", fr: "Réessayer" },
  "{what} in {city}": { de: "{what} in {city}", fr: "{what} à {city}" },
  "For every guest": { de: "Für jeden Gast", fr: "Pour chaque client" },
  "Left: the list every guest gets. Right: the same list for Guest 1.": {
    de: "Links: die Liste, die jeder Gast bekommt. Rechts: dieselbe Liste für Gast 1.",
    fr: "À gauche : la liste que reçoit chaque client. À droite : la même liste pour le client 1.",
  },
  "For a guest who loves {names}": { de: "Für einen Gast, der {names} liebt", fr: "Pour un client qui aime {names}" },
  "Answered from saved Qloo results": {
    de: "Aus gespeicherten Qloo-Ergebnissen beantwortet",
    fr: "Réponse tirée de résultats Qloo enregistrés",
  },
  "cached result": { de: "gespeichertes Ergebnis", fr: "résultat enregistré" },
  "up to {n} lines change": { de: "bis zu {n} Zeilen ändern sich", fr: "jusqu'à {n} lignes modifiées" },
  "{n} of {m} changed": { de: "{n} von {m} geändert", fr: "{n} sur {m} modifiées" },
  "Skipped as repeats: {list}": { de: "Als Wiederholung übersprungen: {list}", fr: "Ignorés car en double : {list}" },
  "1 line ignored: only the first 10 are used": {
    de: "1 Zeile ignoriert: Nur die ersten 10 werden verwendet",
    fr: "1 ligne ignorée : seules les 10 premières sont utilisées",
  },
  "{n} lines ignored: only the first 10 are used": {
    de: "{n} Zeilen ignoriert: Nur die ersten 10 werden verwendet",
    fr: "{n} lignes ignorées : seules les 10 premières sont utilisées",
  },
  "Red: struck for this guest. Green: added for this guest.": {
    de: "Rot: für diesen Gast gestrichen. Grün: für diesen Gast ergänzt.",
    fr: "Rouge : barré pour ce client. Vert : ajouté pour ce client.",
  },
  Loading: { de: "Wird geladen", fr: "Chargement" },
  "Nothing changed for this guest: no entry on this list is outside the guest's top 50 taste matches, or there is no new match to put in its place.": {
    de: "Für diesen Gast hat sich nichts geändert: Kein Eintrag dieser Liste liegt außerhalb der 50 besten Geschmackstreffer des Gastes, oder es gibt keinen neuen Treffer, der an seine Stelle treten könnte.",
    fr: "Rien n'a changé pour ce client : aucune entrée de cette liste n'est en dehors de ses 50 meilleures correspondances de goût, ou il n'y a pas de nouvelle correspondance pour la remplacer.",
  },
  "Guest 1 and Guest 2 share {n} of {m}": { de: "Gast 1 und Gast 2 teilen {n} von {m}", fr: "Les clients 1 et 2 ont {n} adresses sur {m} en commun" },
  "Use your hotel's own list": { de: "Eigene Hotelliste verwenden", fr: "Utiliser la liste de votre hôtel" },
  "Every reason for Guest 1 →": { de: "Alle Begründungen für Gast 1 →", fr: "Toutes les justifications pour le client 1 →" },
  "Accept / reject stays on this screen only.": {
    de: "Annehmen / Ablehnen gilt nur auf diesem Bildschirm.",
    fr: "Accepter / refuser ne s'applique qu'à cet écran.",
  },
  "Notes name the guest's favourite that Qloo's explainability says drove the place, then the place's own Qloo tags; the bar is the guest's Qloo taste affinity for it.": {
    de: "Die Notizen nennen den Favoriten des Gastes, der laut Qloos Erklärbarkeit den Ort ausgelöst hat, danach die eigenen Qloo-Tags des Ortes; der Balken zeigt die Qloo-Geschmacksaffinität des Gastes zu diesem Ort.",
    fr: "Les notes indiquent le favori du client qui, selon l'explicabilité de Qloo, a fait ressortir le lieu, puis les tags Qloo propres au lieu ; la barre montre l'affinité de goût Qloo du client pour ce lieu.",
  },
  "The hotel's list": { de: "Die Hotelliste", fr: "La liste de l'hôtel" },
  "every guest": { de: "jeder Gast", fr: "chaque client" },
  "For Guest 1": { de: "Für Gast 1", fr: "Pour le client 1" },
  "loves {names}": { de: "liebt {names}", fr: "aime {names}" },
  "on both lists": { de: "auf beiden Listen", fr: "sur les deux listes" },
  "Guest 1 and Guest 2 side by side": { de: "Gast 1 und Gast 2 nebeneinander", fr: "Clients 1 et 2 côte à côte" },
  "Same hotel in {city}, two guests": { de: "Gleiches Hotel in {city}, zwei Gäste", fr: "Même hôtel à {city}, deux clients" },
  "Green: added for that guest. Each list as the guest would get it (rejected changes undone).": {
    de: "Grün: für diesen Gast ergänzt. Jede Liste so, wie der Gast sie bekäme (abgelehnte Änderungen rückgängig gemacht).",
    fr: "Vert : ajouté pour ce client. Chaque liste telle que le client la recevrait (modifications refusées annulées).",
  },
  Accept: { de: "Annehmen", fr: "Accepter" },
  Reject: { de: "Ablehnen", fr: "Refuser" },
  "Qloo ranked {n} places in {city} for a guest who loves {names}. {place} is not among them, so it made room for a closer match.": {
    de: "Qloo hat {n} Orte in {city} für einen Gast eingestuft, der {names} liebt. {place} ist nicht darunter und hat deshalb Platz für einen passenderen Treffer gemacht.",
    fr: "Qloo a classé {n} lieux à {city} pour un client qui aime {names}. {place} n'en fait pas partie et a donc laissé la place à une correspondance plus proche.",
  },
  "Of the {of} places on this list, it has the lowest taste affinity for this guest in Qloo.": {
    de: "Von den {of} Orten auf dieser Liste hat dieser Ort in Qloo die niedrigste Geschmacksaffinität für diesen Gast.",
    fr: "Parmi les {of} lieux de cette liste, c'est celui qui a la plus faible affinité de goût avec ce client dans Qloo.",
  },
  "Of the {of} places on this list, it has the {nth} lowest taste affinity for this guest in Qloo.": {
    de: "Von den {of} Orten auf dieser Liste hat dieser Ort in Qloo die {nth} niedrigste Geschmacksaffinität für diesen Gast.",
    fr: "Parmi les {of} lieux de cette liste, il a la {nth} plus faible affinité de goût avec ce client dans Qloo.",
  },
  "It stays on the default list for other guests. Reject the change to keep it here.": {
    de: "Für andere Gäste bleibt er auf der Standardliste. Lehnen Sie die Änderung ab, um ihn hier zu behalten.",
    fr: "Il reste sur la liste par défaut pour les autres clients. Refusez la modification pour le conserver ici.",
  },
  "Driven most by {name}": { de: "Vor allem ausgelöst durch {name}", fr: "Surtout grâce à {name}" },
  ", then {names}": { de: ", danach {names}", fr: ", puis {names}" },
  "(Qloo place description)": { de: "(Ortsbeschreibung von Qloo)", fr: "(description du lieu par Qloo)" },
  "Source: Qloo Insights with explainability for this guest's favourites.": {
    de: "Quelle: Qloo Insights mit Erklärbarkeit für die Favoriten dieses Gastes.",
    fr: "Source : Qloo Insights avec explicabilité pour les favoris de ce client.",
  },

  // Your guest
  "Type at least one favourite: a band, show, film, brand or game.": {
    de: "Geben Sie mindestens einen Favoriten ein: eine Band, Serie, einen Film, eine Marke oder ein Spiel.",
    fr: "Saisissez au moins un favori : un groupe, une série, un film, une marque ou un jeu.",
  },
  "Describe the guest first, e.g. “loves Amy Winehouse and Dr. Martens”.": {
    de: "Beschreiben Sie zuerst den Gast, z. B. „loves Amy Winehouse and Dr. Martens“.",
    fr: "Décrivez d'abord le client, p. ex. « loves Amy Winehouse and Dr. Martens ».",
  },
  "The agent couldn't finish. Use the fields above instead.": {
    de: "Der Agent konnte nicht abschließen. Verwenden Sie stattdessen die Felder oben.",
    fr: "L'agent n'a pas pu terminer. Utilisez plutôt les champs ci-dessus.",
  },
  "Qloo's search has no other match for ‘{query}’. Try the full name as the brand or artist writes it (e.g. “Dr. Martens”).": {
    de: "Die Qloo-Suche hat keinen weiteren Treffer für „{query}“. Versuchen Sie den vollständigen Namen so, wie die Marke oder der Künstler ihn schreibt (z. B. „Dr. Martens“).",
    fr: "La recherche Qloo n'a pas d'autre résultat pour « {query} ». Essayez le nom complet tel que la marque ou l'artiste l'écrit (p. ex. « Dr. Martens »).",
  },
  "Your guest": { de: "Ihr Gast", fr: "Votre client" },
  "Use your hotel's own list (optional)": { de: "Eigene Hotelliste verwenden (optional)", fr: "Utiliser la liste de votre hôtel (facultatif)" },
  "Your hotel's list, one place per line": { de: "Ihre Hotelliste, ein Ort pro Zeile", fr: "La liste de votre hôtel, un lieu par ligne" },
  "One restaurant or bar per line, up to 10.\nLeave empty to use the city's default list.": {
    de: "Ein Restaurant oder eine Bar pro Zeile, bis zu 10.\nLeer lassen, um die Standardliste der Stadt zu verwenden.",
    fr: "Un restaurant ou un bar par ligne, jusqu'à 10.\nLaissez vide pour utiliser la liste par défaut de la ville.",
  },
  "Sample {city} list": { de: "Beispielliste {city}", fr: "Liste d'exemple {city}" },
  "Each line is matched to a restaurant or bar in Qloo within 25 km of {city}. Lines it can't match stay on the list, marked “not matched”.": {
    de: "Jede Zeile wird einem Restaurant oder einer Bar in Qloo im Umkreis von 25 km um {city} zugeordnet. Zeilen ohne Treffer bleiben auf der Liste und werden als „nicht zugeordnet“ markiert.",
    fr: "Chaque ligne est associée à un restaurant ou un bar dans Qloo dans un rayon de 25 km autour de {city}. Les lignes sans correspondance restent sur la liste, marquées « non associé ».",
  },
  "Only the first 10 lines are used.": { de: "Nur die ersten 10 Zeilen werden verwendet.", fr: "Seules les 10 premières lignes sont utilisées." },
  "What to edit": { de: "Was bearbeitet wird", fr: "Ce qu'il faut modifier" },
  "The agent below always edits restaurants & bars.": {
    de: "Der Agent unten bearbeitet immer Restaurants & Bars.",
    fr: "L'agent ci-dessous modifie toujours les restaurants et bars.",
  },
  "Hotel city": { de: "Stadt des Hotels", fr: "Ville de l'hôtel" },
  "Favourite {n}": { de: "Favorit {n}", fr: "Favori {n}" },
  "e.g. {x}": { de: "z. B. {x}", fr: "p. ex. {x}" },
  "Editing…": { de: "Wird bearbeitet…", fr: "Modification en cours…" },
  "Edit the list": { de: "Liste bearbeiten", fr: "Modifier la liste" },
  "or describe the guest to the agent": { de: "oder beschreiben Sie den Gast dem Agenten", fr: "ou décrivez le client à l'agent" },
  "Describe the guest": { de: "Gast beschreiben", fr: "Décrire le client" },
  "Agent is working…": { de: "Agent arbeitet…", fr: "L'agent travaille…" },
  "Ask the agent": { de: "Agent fragen", fr: "Demander à l'agent" },
  "None of these": { de: "Keiner davon", fr: "Aucun de ceux-ci" },
  "The agent is working. Each tool call appears as it happens:": {
    de: "Der Agent arbeitet. Jeder Tool-Aufruf erscheint, sobald er erfolgt:",
    fr: "L'agent travaille. Chaque appel d'outil s'affiche au moment où il a lieu :",
  },
  "Reading the description…": { de: "Beschreibung wird gelesen…", fr: "Lecture de la description…" },
  "This is taking longer than usual (30 s). The agent stops after about 50 s; the fields above give the same list without the model.": {
    de: "Das dauert länger als üblich (30 s). Der Agent bricht nach etwa 50 s ab; die Felder oben liefern dieselbe Liste ohne das Modell.",
    fr: "Cela prend plus de temps que d'habitude (30 s). L'agent s'arrête après environ 50 s ; les champs ci-dessus donnent la même liste sans le modèle.",
  },
  "Agent: {text}": { de: "Agent: {text}", fr: "Agent : {text}" },
  "Not considered by the edit: {list}": {
    de: "Von der Bearbeitung nicht berücksichtigt: {list}",
    fr: "Non pris en compte par la modification : {list}",
  },
  "What the agent did ({n} tool calls)": { de: "Was der Agent getan hat ({n} Tool-Aufrufe)", fr: "Ce qu'a fait l'agent ({n} appels d'outils)" },

  // Tomorrow's arrivals
  "Guest {n}": { de: "Gast {n}", fr: "Client {n}" },
  "Not considered: {list}": { de: "Nicht berücksichtigt: {list}", fr: "Non pris en compte : {list}" },
  "(no list: no favourites confirmed)": { de: "(keine Liste: keine Favoriten bestätigt)", fr: "(pas de liste : aucun favori confirmé)" },
  "(no list: needs a pick)": { de: "(keine Liste: Auswahl nötig)", fr: "(pas de liste : un choix est nécessaire)" },
  "Morning report: tomorrow's arrivals, {city}": { de: "Morgenbericht: Anreisen von morgen, {city}", fr: "Rapport du matin : arrivées de demain, {city}" },
  "Paste at least one arrival note, one guest per line.": {
    de: "Fügen Sie mindestens eine Anreisenotiz ein, ein Gast pro Zeile.",
    fr: "Collez au moins une note d'arrivée, un client par ligne.",
  },
  "Add each guest's favourites by hand below.": {
    de: "Tragen Sie die Favoriten jedes Gastes unten von Hand ein.",
    fr: "Ajoutez ci-dessous les favoris de chaque client à la main.",
  },
  "The agent couldn't read the notes ({error}) Add each guest's favourites by hand below.": {
    de: "Der Agent konnte die Notizen nicht lesen ({error}). Tragen Sie die Favoriten jedes Gastes unten von Hand ein.",
    fr: "L'agent n'a pas pu lire les notes ({error}). Ajoutez ci-dessous les favoris de chaque client à la main.",
  },
  "One guest per line, as the front desk or CRM wrote it. Up to 6.": {
    de: "Ein Gast pro Zeile, so wie die Rezeption oder das CRM es notiert hat. Bis zu 6.",
    fr: "Un client par ligne, tel que la réception ou le CRM l'a noté. Jusqu'à 6.",
  },
  "Using your hotel's list ({n} lines, from “Your guest”)": {
    de: "Mit Ihrer Hotelliste ({n} Zeilen, aus „Ihr Gast“)",
    fr: "Avec la liste de votre hôtel ({n} lignes, depuis « Votre client »)",
  },
  "Using the city's default list": { de: "Mit der Standardliste der Stadt", fr: "Avec la liste par défaut de la ville" },
  "Arrival notes, one guest per line": { de: "Anreisenotizen, ein Gast pro Zeile", fr: "Notes d'arrivée, un client par ligne" },
  "Sample arrivals": { de: "Beispiel-Anreisen", fr: "Arrivées d'exemple" },
  "1 note will be ignored: up to 6 guests per report.": {
    de: "1 Notiz wird ignoriert: bis zu 6 Gäste pro Bericht.",
    fr: "1 note sera ignorée : jusqu'à 6 clients par rapport.",
  },
  "{n} notes will be ignored: up to 6 guests per report.": {
    de: "{n} Notizen werden ignoriert: bis zu 6 Gäste pro Bericht.",
    fr: "{n} notes seront ignorées : jusqu'à 6 clients par rapport.",
  },
  "Agent is reading the notes…": { de: "Agent liest die Notizen…", fr: "L'agent lit les notes…" },
  "1. Read the notes": { de: "1. Notizen lesen", fr: "1. Lire les notes" },
  "Skip the agent": { de: "Ohne Agent weiter", fr: "Continuer sans l'agent" },
  "The agent only keeps favourites that are written in the note; you confirm them before anything is edited.": {
    de: "Der Agent übernimmt nur Favoriten, die in der Notiz stehen; Sie bestätigen sie, bevor etwas bearbeitet wird.",
    fr: "L'agent ne retient que les favoris écrits dans la note ; vous les confirmez avant toute modification.",
  },
  "No band, show, film, brand or game in this note.": {
    de: "Keine Band, Serie, kein Film, keine Marke und kein Spiel in dieser Notiz.",
    fr: "Aucun groupe, série, film, marque ou jeu dans cette note.",
  },
  "‘{query}’ not found in Qloo": { de: "„{query}“ nicht in Qloo gefunden", fr: "« {query} » introuvable dans Qloo" },
  "Add a favourite for {label}": { de: "Favorit für {label} hinzufügen", fr: "Ajouter un favori pour {label}" },
  "Add a favourite": { de: "Favorit hinzufügen", fr: "Ajouter un favori" },
  Add: { de: "Hinzufügen", fr: "Ajouter" },
  "Editing every list…": { de: "Alle Listen werden bearbeitet…", fr: "Modification de toutes les listes…" },
  "2. Build the morning report": { de: "2. Morgenbericht erstellen", fr: "2. Créer le rapport du matin" },
  Copy: { de: "Kopieren", fr: "Copier" },
  "No favourites confirmed, so the list stays as it is.": {
    de: "Keine Favoriten bestätigt, daher bleibt die Liste unverändert.",
    fr: "Aucun favori confirmé, la liste reste donc inchangée.",
  },
  "A favourite needs a pick first.": {
    de: "Für einen Favoriten muss zuerst eine Auswahl getroffen werden.",
    fr: "Un favori nécessite d'abord un choix.",
  },
  "Open “Your guest (and list)” to accept or reject single changes.": {
    de: "Öffnen Sie „Ihr Gast (und Ihre Liste)“, um einzelne Änderungen anzunehmen oder abzulehnen.",
    fr: "Ouvrez « Votre client (et votre liste) » pour accepter ou refuser des modifications une par une.",
  },
};

export function translate(lang: Lang, en: string, vars?: Vars): string {
  const s = lang === "en" ? en : (DICT[en]?.[lang] ?? en);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}
