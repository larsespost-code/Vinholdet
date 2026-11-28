# Min kælder

Et privat dashboard over vinsamlingen, bygget på dine data fra CellarTracker. Du registrerer fortsat alt i CellarTracker. Dashboardet læser kun.

**Der ligger ingen kælderdata i dette repository.** Repositoriet er offentligt. Dataene ligger enten i din egen Google Drive (automatisk synkronisering) eller kun i din browser (manuel import).

## Indhold

| Fane | Hvad den gør |
|---|---|
| Overblik | Nøgletal, vintype, regioner, druer, producenter, årgange og beregnede observationer |
| Samling | Søgbar beholdning grupperet pr. producent (fold ud for detaljer) |
| Udforsk | Geografi, druer (inkl. drue › regioner og region › druer) og producenter; klik på alt for en profil |
| Udvikling & værdi | Andele og antal over årene (farve, vintype, druer m.m.), lagkage for et valgt år, gennemsnitspris pr. købt flaske, priser og værdi i € eller kr. |
| Cellar Lab | Fri analysebygger, bredde/dybde, vertikaler, horisontaler, årgangsunivers, diversitet, sjældne kombinationer |
| Vinkort | Overskueligt vinkort (land › region › producent › vin) med antal; udskriv eller gem som PDF |
| Sommelier | AI-funktioner: Spørg kælderen, Mad og vin, Analyse og Dit vinår (valgfrit, kræver API-nøgle) |
| Data & synk (tandhjulet) | Status, import, importlog, producentgrupper, weekendlokationer, valuta, sikkerhedskopi, kontroltal |

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

## Sommelier: AI-funktioner (valgfrit)

Fire funktioner under fanen Sommelier. I alle fire beregner dashboardet tallene på dine egne data; sprogmodellen fortolker eller formulerer kun.

- **Spørg kælderen**: skriv et spørgsmål med dine egne ord, fx »Hvor mange Jura-hvide under 40 € har jeg i Køleskabet?«. Modellen oversætter spørgsmålet til filtre (land, region, producent, drue, lokation, årgang, pris, købsår m.m.), og dashboardet regner svaret ud. »Brug som filter« overfører udsnittet til resten af dashboardet.
- **Mad og vin**: forslag til vine fra dine valgte lokationer til en ret.
- **Analyse**: dashboardet beregner tendenser år for år (andele af farver, druer, regioner og lande, gennemsnitspris, producentkoncentration, nye producenter, alder ved køb og drik, forhandlere, sæson). Modellen finder både åbenlyse og mere skjulte mønstre og angiver de tal, de bygger på. Analysen følger de globale filtre.
- **Dit vinår**: en opsummering af et valgt år: køb, opdagelser, forskydninger og hvad du drak.

Der sendes kun aggregerede tal og vinnavne, aldrig adgangskoder eller personoplysninger.

Funktionerne kan køre på **Gemini (gratis)** eller **Claude (betalt)**. Dashboardet sender retten og ID'erne på vinene i det aktuelle filterudsnit til dit script. Scriptet slår vinene op i den seneste beholdning og sender kun navn, årgang, type, drue, oprindelse, antal og størrelse til modellen. Det afviser ethvert forslag, der ikke er en vin med flasker tilbage i udsnittet.

**Gratis med Gemini**

1. Gå til <https://aistudio.google.com>, log ind med din Google-konto og vælg **Get API key** › **Create API key**. Der skal ikke tilknyttes betalingskort.
2. Tilføj scriptegenskaben `GEMINI_API_KEY` i dit Apps Script-projekt.
3. Genindlæs dashboardet.

Standardmodellen er `gemini-flash-latest`, som Google løbende peger på den nyeste Flash-model. Den kan ændres med scriptegenskaben `GEMINI_MODEL`.

Vær opmærksom på:

- Gratisudgaven har en daglig kvote, og Google har flere gange ændret den uden varsel. Er kvoten brugt, viser siden en besked, og den nulstilles dagligt. Til få forespørgsler om ugen er det rigeligt.
- Tilknytter du et betalingskort til Google-projektet, bliver forbruget betalt.
- Tjek Googles vilkår for gratisudgaven: data sendt til gratis-API'et kan bruges af Google til at forbedre deres produkter. Det, der sendes, er din ret og vinlisten (ingen navne, adresser eller adgangskoder).

**Claude (betalt)**

Tilføj i stedet `ANTHROPIC_API_KEY` fra <https://console.anthropic.com>. Modellen er `claude-opus-5-5`, ca. 0,10–0,15 USD (under 1 kr.) pr. forespørgsel med ~270 vinposter. Er begge nøgler sat, bruges Claude; scriptegenskaben `AI_PROVIDER` = `gemini` eller `claude` tvinger et valg.

## Teknik

- `index.html`: layout og stil
- `js/core.js`: indlæsning af CSV (Windows-1252 eller UTF-8, decimalkomma), normalisering, filtre, målinger
- `js/ui.js`: diagrammer og tabeller (ren SVG/HTML, ingen biblioteker)
- `js/pages.js`: siderne
- `js/app.js`: datakilder, navigation, filterlinje, import
- `apps-script/Kaelder.gs`: synkronisering og madmatch

Ingen afhængigheder ud over skrifttyper fra Google Fonts.
