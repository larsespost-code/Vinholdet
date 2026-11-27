# Min kælder

Et privat dashboard over vinsamlingen, bygget på dine data fra CellarTracker. Du registrerer fortsat alt i CellarTracker. Dashboardet læser kun.

**Der ligger ingen kælderdata i dette repository.** Repositoriet er offentligt. Dataene ligger enten i din egen Google Drive (automatisk synkronisering) eller kun i din browser (manuel import).

## Indhold

| Side | Hvad den gør |
|---|---|
| Overblik | Nøgletal, farve, vintype, regioner, druer, producenter, årgange og beregnede observationer |
| Min samling | Søgbar beholdning (accenter er ligegyldige), gruppering, sortering, CSV-eksport |
| Geografi | Lande, regioner, appellationer, marker, geografisk fingeraftryk og sammenligning side om side |
| Druer & vintyper | Druer (MasterVarietal eller detaljeret), heatmap drue × geografi med række- og kolonneprocent |
| Producenter | Fuld rangliste: flasker, vine, cuvéer, årgange, værdi, gennemsnitspris |
| Profiler | Klik på et land, en region, en producent, en drue osv. for et fuldt dashboard over netop den |
| Trends & historik | Købspræferencer over tid, forskydninger, køb mod drukket (kræver køb/forbrug fra CT) og observeret beholdning |
| Værdi & priser | Registreret indkøbsværdi, prisfordeling, dyreste vine, prisniveau pr. region |
| Cellar Lab | Fri analysebygger, bredde/dybde, vertikaler, horisontaler, årgangsunivers, diversitet, sjældne kombinationer |
| Vinkort | Klassisk restaurantvinkort (vintype › land › område › vin) med antal; udskriv eller gem som PDF |
| Mad og vin | Madmatch med Claude, kun blandt dine egne vine (valgfrit, kræver API-nøgle) |
| Data & synk | Status, import, importlog, producentgrupper, weekendlokation, valuta, sikkerhedskopi, kontroltal |

Globale filtre (lokation, land, region, producent, drue, farve, vintype, årgang, pris, størrelse, forhandler m.fl.) gælder på alle sider. Flere valg inden for samme filter er »eller«, på tværs er »og«, og hvert filter kan vendes til »udelad valgte«.

Producentgruppen *Ganevat* samler »Jean-François Ganevat« og »Anne et Jean-François Ganevat«. Flere grupper kan oprettes under Data & synk.

## Sådan åbner du det

Dashboardet ligger i mappen `kaelder/` og kører direkte i browseren uden server. Med GitHub Pages slået til for repositoriet er adressen:

```
https://larsespost-code.github.io/Vinholdet/kaelder/
```

Siden er sat til ikke at blive indekseret af søgemaskiner. Den indeholder ingen data, før du selv forbinder den.

## Automatisk opdatering fra CellarTracker (anbefalet)

CellarTracker har en officiel eksportadresse (`xlquery.asp`). Et lille Google Apps Script i din egen Google-konto henter dine tabeller derfra hver nat og ved »Opdater nu«, gemmer dem i en privat Drive-mappe og udleverer dem kun til dashboardet, når det sender din hemmelige nøgle. Ingen computer skal stå tændt.

1. Gå til <https://script.google.com>, vælg **Nyt projekt**, og kald det »Min kælder«.
2. Slet indholdet i `Code.gs`, og indsæt hele [`apps-script/Kaelder.gs`](apps-script/Kaelder.gs). Gem.
3. Klik på tandhjulet **Projektindstillinger** › **Scriptegenskaber** › **Tilføj scriptegenskab**:
   - `CT_USER`: dit CellarTracker-brugernavn
   - `CT_PASS`: din CellarTracker-adgangskode
4. Vælg funktionen `setup` i menuen foroven, og tryk **▶ Kør**. Godkend adgangen (Drive, eksterne forespørgsler, tidsudløser). Loggen viser din **dashboard-nøgle** og hvilke tabeller der blev hentet.
5. **Implementer** › **Ny implementering** › type **Webapp**. *Kør som:* Mig. *Hvem har adgang:* Alle. Kopiér webapp-URL'en, der slutter på `/exec`.
6. Åbn dashboardet › **Data & synk** › indsæt URL og nøgle › **Gem og hent**. Gør det samme på mobilen.

Herefter opdateres dashboardet hver nat ca. kl. 6 dansk tid. Det er ikke realtid.

Scriptet henter tabellerne `List` (beholdning, med lokation), `Inventory` (individuelle flasker), `Purchase` (køb), `Consumed` (afgang), `Notes` (smagninger) og `Pending`. Hvad din konto faktisk giver adgang til, og om dato, forhandler og lokation er udfyldt, ses under **Data & synk › Datakilder**. De funktioner, der mangler data, viser det i stedet for at gætte.

**Sikkerhed:** Adgangskoden ligger kun i Scriptegenskaber i din egen Google-konto og sendes kun til cellartracker.com over HTTPS. CellarTrackers eksport tager brugernavn og adgangskode i adressen; Google logger ikke adressen i scriptets log, men CellarTracker kan have den i sine egne serverlogs. Webappen svarer ikke uden nøglen. Vil du have en ny nøgle, så kør `nyNoegle` og indsæt den nye i dashboardet.

**Hvis noget går galt:**

- *Login udløbet eller adgangskode ændret:* ret `CT_PASS` i Scriptegenskaber. Næste synk virker igen.
- *Synkroniseringen fejler:* dashboardet viser »ikke opdateret« og bruger seneste gode data. Se årsagen i importloggen under Data & synk.
- *Stort fald i beholdningen:* hvis en eksport pludselig har under halvdelen af flaskerne, lægges den til godkendelse i stedet for at erstatte beholdningen. Godkend den under Data & synk, hvis den er rigtig.
- *Nye versioner af scriptet:* indsæt den nye kode, gem, og vælg **Implementer › Administrer implementeringer › Rediger › Ny version**. URL'en forbliver den samme.

## Manuel import (virker altid)

I CellarTracker: **My Cellar › Wines › Export › CSV** (desktop-browser). Vælg filen under **Data & synk › Importér filer**. Du kan vælge flere filer på én gang (Individual Bottles, Purchased, Consumed); filtypen genkendes automatisk. Dashboardet viser kontroltal og observeret ændring, og du godkender, før den erstatter beholdningen. Filerne gemmes kun i den browser, du importerer i. Brug **Sikkerhedskopi** for at flytte dem til en anden enhed.

## Historik

Ved hver import eller synkronisering, hvor beholdningen har ændret sig, gemmes en dateret observation. Dermed bygges udviklingen op fra første import. Forskellen mellem to observationer er en nettoændring (køber du tre og drikker to, ses +1), så den præsenteres aldrig som køb eller forbrug. Rigtige købs- og forbrugstrends kommer fra CellarTrackers `Purchase`- og `Consumed`-tabeller.

## Mad og vin (valgfrit)

Kræver en API-nøgle fra Anthropic (<https://console.anthropic.com>). Et ChatGPT- eller Claude-abonnement er ikke det samme som API-adgang.

1. Tilføj scriptegenskaben `ANTHROPIC_API_KEY` i dit Apps Script-projekt.
2. Genindlæs dashboardet. Siden **Mad og vin** bliver aktiv.

Dashboardet sender retten og ID'erne på vinene i det aktuelle filterudsnit til dit script. Scriptet slår vinene op i den seneste beholdning, sender kun navn, årgang, type, drue, oprindelse, antal og størrelse til modellen, og afviser ethvert forslag, der ikke er en vin med flasker tilbage i udsnittet. Modellen er `claude-opus-5-5`. Med ca. 270 vinposter er en forespørgsel omkring 12.000 input-tokens og et par tusind output-tokens, dvs. i størrelsesordenen 0,10–0,15 USD (under 1 kr.) pr. forespørgsel ved listeprisen 4 USD / 20 USD pr. million tokens. Der er ingen faste udgifter. Forbruget pr. svar vises under forslagene.

## Teknik

- `index.html`: layout og stil
- `js/core.js`: indlæsning af CSV (Windows-1252 eller UTF-8, decimalkomma), normalisering, filtre, målinger
- `js/ui.js`: diagrammer og tabeller (ren SVG/HTML, ingen biblioteker)
- `js/pages.js`: siderne
- `js/app.js`: datakilder, navigation, filterlinje, import
- `apps-script/Kaelder.gs`: synkronisering og madmatch

Ingen afhængigheder ud over skrifttyper fra Google Fonts.
