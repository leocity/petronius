# Petronius — recap e piano di correzioni

Stato al 29 ottobre 2026, dopo la prima versione online (https://leocity.github.io/petronius/).

## 1. Cosa funziona oggi

- 47 scene estratte e giocabili, flusso tra le scene ricostruito (71 uscite, 2 ancora ipotesi), 3 finali raggiungibili.
- Modalità casa (mappa + diario) e modalità in Bovisa (GPS, raggio di arrivo, ripieghi).
- 27 indizi del journal dentro il gioco, password e timer originali, diario con nomi, parole, oggetti, persone.
- Un bot di test arriva al finale F1 in entrambe le modalità (30 scene, 4 giorni).

## 2. Asset ritrovati nella cartella DEMO

La cartella `DEMO/` accanto a `Scenes/` contiene quasi tutto ciò che stava sull'hosting morto:

| Cartella | Contenuto | Uso nel gioco |
|---|---|---|
| `Backgrounds/` (47 foto, 23 MB) | Foto in bianco e nero di ogni luogo, una per scena (`aula.jpg`, `dergano.jpg`, `reka.jpg`, `guardiano.jpg`, `soundgame.jpeg`, `laurea.jpg`, …) | Sfondo di ogni scena. Diverse sono **parte dell'enigma** (il murale di Reka, Il Guardiano, Mutevole, il cartellone del Sound of '70, il diploma vero) |
| `Characters/` (11 PNG + PSD) | Ritratti originali scontornati, con giacche illustrate; varianti *inside* (università) e *outside* (strada) | Ritratti dei dialoghi al posto delle foto delle carte |
| `Audio/` (16 mp3, 18 MB) | Le canzoni legate ai luoghi (bausan, reka, savarino, tango, …) | Pulsante "play" nelle scene che lo avevano |
| `Endings/` (3 mp4, 5 MB) | Video dei finali New Order, Expelled, Freedom | Schermata finale |
| `Artefacts/Posters.pdf`, `LandingPage/` | Poster e sito di presentazione del 2019 | Da valutare |

Mancano solo `wss.png`, `audio.png`, `play.png` (icone dell'interfaccia, sostituibili) e `mastro_audio.mp4`.

Ogni scena aveva il suo sfondo (`#container` nel CSS originale): 1-2 camera/aula, 2-1-3 corridoio, 4 Ingresso B2, 5 Gate B3, 5-1 Gate B1, 6 mastro, 7 graffiti, 8/8-1 armenia, 9/9-1 dergano, 10 mamusca, 11 reka, 12/12-1 guardiano, 13 penny, 14 bausan, 15 schiavone, 16 Gate B3, 16-1 Gate B1, 17/17-1 matt, 18/18-1 savarino, 19 gelateria, 20/20-1 market, 21 sound, 21-1 sound + soundgame, 22 biblio + librarygame, 22-1 biblio, 23 never, 24/24-2 ribalta, 25 aula, 26 boys, 27 amilcare, 28 puzzo, 29 opella, 30 tango, 31 branca, 32 altri, 33 spirit, 34 design, 35 rifugio, 36 stagioni, 37 b8.

Ritratti originali per personaggio: Petronio `petronio_inside` (1-2, 2-1-3, 4) e `petronio_dubbioso` (resto); Sirio `sirio_inside` / `sirio_shocked`; Roberto `roberto_inside` (4) / `roberto_serio`; Yda, Su, Guido, Gabriele, Minerva un'immagine ciascuno. Due errori dell'originale da correggere: in 24-2 Petronio usa l'immagine di Gabriele, in 33 Su quella di Roberto.

## 3. Ritratti e sfondi: cosa cambia

- **Ritratti:** le foto delle carte ritagliate in un cerchio tagliano male le teste (inquadratura diversa per ogni foto). I PNG originali sono già scontornati: vanno mostrati interi, in piedi sullo sfondo come nell'app originale, ritagliati automaticamente al loro contenuto (così si centrano da soli) e ancorati in basso, col box di dialogo sopra le gambe. Le foto delle carte restano nel diario ("People").
- **Sfondi:** foto del luogo a tutto schermo dietro il dialogo, scurita quanto basta per leggere il testo. Le foto che contengono l'enigma vanno mostrate anche **dentro** l'indizio, ingrandibili.
- **Audio e video:** pulsante play dove l'originale lo aveva; i tre video nella schermata finale.

## 4. Problemi su mobile (verificati a 375 px)

1. **Fogli trasparenti:** il foglio copre tutta l'immagine e blocca lo scorrimento (`touch-action: none`): sul telefono si resta "intrappolati" sull'immagine. Serve una maniglia per trascinare e lo scorrimento libero altrove, oppure una modalità "sposta foglio" esplicita.
2. **Ingrandimento:** apre l'intera doppia pagina a 340 px; il testo piccolo (Nokia, griglie, tabelle) resta illeggibile e non si può zoomare dentro. Servono ritagli mirati per ogni indizio (solo lo schermo del Nokia, solo la griglia…) e uno zoom vero con pizzico e trascinamento.
3. **Contesto perso:** quando compare l'indizio sparisce la battuta che lo introduce e il ritratto; su telefono non si capisce chi parla e perché.
4. **Miniature:** le doppie pagine orizzontali diventano strisce minuscole; meglio una sola immagine grande per volta (carosello) con didascalia.
5. **Timer:** 60 secondi per confrontare il diploma su un telefono, con le immagini minuscole, sono troppo pochi; il conto alla rovescia dovrebbe partire dopo aver aperto l'immagine.

## 5. Perché a casa è troppo facile

1. **Gli enigmi sono facoltativi.** La destinazione successiva compare sulla mappa anche se l'enigma non è risolto: si può premere "Continue" e andare avanti. È il problema principale.
2. **Il diario regala le parole vocali.** "Things to say" elenca le parole appena le impari, e quelle venute dagli oggetti di carta compaiono già quando arrivi al varco.
3. **Gli aiuti sono gratis e infiniti**, e l'ultimo mostra la soluzione subito.
4. **Le risposte sono troppo larghe.** Basta contenere la parola: "bomb", "right", "turn" passano dentro qualsiasi frase.
5. **Spostarsi non costa niente.** Un pulsante con nome e indirizzo porta direttamente al luogo.

Proposte, in ordine di impatto:

- **Un enigma blocca la sua uscita.** Se una scena finisce con un indizio, la destinazione resta "?" finché non lo risolvi. La soluzione dell'enigma *è* la destinazione (Piazza Dergano, Via Davanzati, Via Caianello 1…).
- **A casa si viaggia trovando il posto sulla mappa.** Per andare in un luogo lo cerchi sulla mappa e tocchi il punto giusto (entro il raggio), come camminare in Bovisa ma dal divano. Il nome della via te lo dà l'enigma o il dialogo, non un pulsante.
- **Il diario registra, non suggerisce.** Annota quello che ti hanno detto ("Yda: say ARCHIVE when you enter"), non una lista pronta di parole da dire.
- **Aiuti a gettoni.** Per esempio tre "chiedi a Sirio" per giorno; la soluzione arriva solo dopo qualche tentativo sbagliato.
- **Risposte esatte**, con varianti accettate esplicite invece di "contiene".
- Facoltativo: punteggio finale (giorni, aiuti usati), da mostrare sulla busta.

### Bug del motore trovati nella revisione

- **Fogli trasparenti sempre larghi quanto l'immagine.** Il foglio viene disegnato a tutta larghezza, così si rompono il foglio di Da Amilcare (le lettere escono al 68% e non combaciano mai) e il segnalibro (6 volte più grande della cornice). Ogni foglio deve avere dimensione e posizione d'arrivo proprie, e i fogli con i segni di taglio vanno ritagliati ai segni.
- **Le password sono troppo severe.** "backto", "Strange time!" o una virgola in più contano come sbagliate, e c'è un solo tentativo. Vanno confrontate ignorando spazi e punteggiatura, come le risposte degli indizi.
- **Gli aiuti sulle password del finale saltano la scelta della storia.** In 24 e 37 aiuti e soluzione portano a F1/F3 anche chi ha sbagliato gli enigmi prima, e appiattiscono i tre finali.

## 6. Indizi uno per uno

Legenda: ✅ funziona · ⚠️ funziona ma confuso, troppo facile o con errori · ❌ non risolvibile o oggetto/risposta sbagliati.

| Indizio | Stato | Cosa non va | Correzione |
|---|---|---|---|
| **5** memo di Remedia | ❌ | Mostra la pagina 7 (la scelta B1/B3). Il memo vero sono i due biglietti a quadretti `Note B2 to the B3 #1/#2`, mai usati: "h 14.30" e il pezzo strappato "Via Baldinucci 54 — Say 'IT'S A BOMB' when you are there". | Mostrare i due biglietti da ricongiungere. Domanda: cosa devi dire? → "It's a bomb". È la parola chiave della 8-1. |
| **5-1** segnalibro | ✅ | Ok. La "scatola di legno" si vede in `Gate-B1.jpg`. | Facoltativo: trovarla nella foto prima di riceverlo. |
| **6** schizzo di Sirio | ⚠️ | Il foglio non va sul murale: ruotato è uno schizzo della strada che va dritta e poi gira a destra. La pagina 10 mostra già "Next place: Via Baldinucci 54" e rovina l'indizio 5. | Foglio in orizzontale, pagina 10 ritagliata, domanda "da che parte?" → destra. |
| **8** poster strappato | ⚠️ | Funziona ma è regalato: le descrizioni delle immagini dicono "Piazza Der…" e "…GANO". Il pezzo esiste da solo (`Poster Ex Armenia #1.png`). | Pezzo trascinabile che si incastra nel poster; via le lettere dalle descrizioni. |
| **8-1** lettere spezzate | ✅ | CANDIANI BEACH BOYZ, il foglio si aggancia. Le lettere si leggono anche senza foglio. | Aiuto migliore. Oggi ci passano tutti: senza il biglietto della 5 nessuno conosce "bomb". |
| **9** Nokia | ⚠️ | Lo schermo è minuscolo. Il messaggio completo è "VIA DAVANZATI, DUE" (manca il 2). L'aiuto regala "VIA". | Ritaglio grande dello schermo, aiuti sul multi-tap, soluzione "Via Davanzati 2". |
| **10** volantino di Su | ⚠️ | L'indirizzo è scritto in chiaro: non c'è enigma. | Va bene come "leggi il volantino". Facoltativo: trovarlo nella foto `mamusca.jpg`. |
| **11** simboli di Reka | ❌ | Mostra un solo emù. Il codice sono i 31 adesivi in sequenza. Decifrati con la chiave di pagina 13: **"EXIT THE TUNNEL AND TURN RIGHT, DRONGO"**. | Griglia dei 31 adesivi + chiave, domanda → "turn right". |
| **12-1** Il Guardiano | ❌ | Manca il muro: c'è solo il foglio. Il testo dice "2501 gave Sirio", ma è stato Guido. | Ritaglio di `guardiano.jpg` con il foglio che si aggancia → GO HOME. |
| **13** corsia degli alcolici | ❌ | **Risposta sbagliata.** Le lettere coperte formano **"LET'S GO BAUSAN"**, non "Let's go bomb". | Risposta "Bausan", prossimo luogo piazza Bausan. Togliere "bomb" da qui. |
| **14** poesia della fontana | ❌ | Manca il testo inciso sulla fontana, e senza domanda nessuno risolve. Soluzione ricostruita: **"P.ZA SCHIAVONE"**. Il lato #5 non è trascritto da nessuna parte. | Trascrizione degli 8 lati + strisce raddrizzate, domanda → Schiavone. Serve il testo del lato #5. |
| **15** griglia sui gradini | ✅ | VIA LUIGI MERCANTINI, il foglio si aggancia. Il primo aiuto è sbagliato ("V, A…" invece di "V, I"). | Correggere gli aiuti. |
| **17** cerca-parole | ✅ | LIVIGNO verificato con uno script. La griglia è piccola dentro la doppia pagina. | Ritaglio della pagina sinistra; via l'aiuto "street with a park, number 5". |
| **17-1** adesivo della frutta | ❌ | Manca l'adesivo con gli spicchi (`Sticker Rob de Matt.pdf`). Accetta "fruit" come risposta. La soluzione è **"CIAIA 8"**: il fruttivendolo è al civico 8, non al 5. | Aggiungere l'adesivo, risposta "Ciaia 8", correggere il luogo nella mappa. |
| **18** mappa del tesoro | ❌ | Il disegno del gelato (`Sticker Nicolò Savarino Park`) non si vede: la risposta si può solo indovinare. "Something cold" la regala. | Ritaglio della mappa, tocco sulla X, poi compare il gelato. |
| **18-1** campana | ⚠️ | Il testo rimanda a pagina 28 (le regole), ma l'ordine è a pagina 27. L'aiuto elenca solo le sillabe. | Correggere testo e aiuti. TANGO D'AMORE verificato. |
| **20-1** trova le differenze | ❌ | Mostra il diploma *vero* chiamandolo "falso". Il falso (`laurea.jpg`) non c'è, e basta toccare tre "?" per vincere. | Falso toccabile con le 3 aree vere (stemma, "UNIVERSITI", firma), il vero come confronto, più tempo su telefono. |
| **21-1** cartellone | ❌ | Manca il cartellone (`soundgame.jpeg`). Il manifesto mostrato prima **rivela già "Cordelia Bianchetti"**. Soluzione: due dita + freccia = sposta di 2 → STRANGE TIME. | Mostrare il cartellone; il manifesto solo dopo, come premio. |
| **22-1** poster + segnalibro | ❌ | Usa il lato sbagliato del segnalibro: va il retro ("…NING", "35"), che completa **"Via Baldinucci, 35"**. Il segnalibro è disegnato 6 volte troppo grande. | Retro del segnalibro, dimensione e posizione d'arrivo giuste, domanda "dov'è la festa?". |
| **22** codici della biblioteca | ❌ | Mostra pagine di diario. Il gioco vero è `librarygame.jpeg`: due scaffali, uno +5/−3 (mancano **8** e **21**) e uno Fibonacci (manca **34**). L'aiuto spiega solo il secondo. | Mostrare `librarygame.jpeg` durante il timer, aiuti per scaffale. |
| **23** sottobicchiere | ⚠️ | L'immagine mostra la freccia già girata nella posizione giusta: la risposta è regalata. Il murale è `never.jpg`. | Sottobicchiere da ruotare finché le righe combaciano col murale. |
| **24-2** sottobicchiere di Gabriele | ❌ | Mancano i numeri: stavano sul sottobicchiere fisico, non in archivio. Risposta: "Leave me alone". | **Ti chiedo i numeri**, oppure li ricreiamo (12-5-1-22-5 / 13-5 / 1-12-15-14-5). |
| **24** nomi | ⚠️ | Funziona, ma aiuti e soluzione cancellano il ramo dei nomi sbagliati. | Niente aiuti qui; confronto più tollerante. |
| **27** Da Amilcare | ❌ | Il foglio è in scala sbagliata, quindi le lettere non combaciano mai (bug sopra). Il testo regala "C?I?N?L?O". | Ritagliare il foglio ai segni di taglio: si aggancia e dà VIA CAIANELLO 1. |
| **29** origami | ⚠️ | Manca la pagina delle istruzioni (`Meet Su` p2, cigno + "_ _ _ _ _ _"). L'aiuto elenca tutte le lettere. Chi rifiuta l'origami non avrà mai BACK TO. | Pagina istruzioni, aiuti meno espliciti. |
| **30** decoder | ❌ | Oggetto sbagliato. È l'adesivo `Tango d'Amore` (alfabeto con 1, 2, 3, 4 al posto di T, U, R, N) → TURN. | Aggiungere l'adesivo, domanda e aiuti nuovi. |
| **35** quaderno del rifugio | ⚠️ | Parla di un foglio che non c'è e non ha domanda. Soluzione: **"ROBB DE MATT"** dalla targa (il detto della guida, e il posto dopo). | Domanda + aiuti, targa visibile in `rifugio.jpg`. |
| **36** frullato | ⚠️ | DERGANO è regalato tre volte: testo, aiuto e descrizione dell'immagine elencano gli ingredienti. | Riscrivere testo, aiuti e descrizione. |
| **37** password finali | ❌ | "SANTA" non si ottiene da nessuna parte. Viene dal biglietto da visita dello Spirit de Milan nella scena 33 (`Meet Roberto` p2: "_ _ _ T A" + logo). | Nuovo indizio nella 33 → SANTA. |
| **9** adesivi (raccolta) | ❌ | Regala "AND CHILL" appena arrivi, mostra un solo adesivo e ne elenca le lettere. Va nella 9-1: Guido parla dei cerchi, e `Meet Guido` p2 è la mappa #1–#8 dei cerchi di piazza Dergano. | Indizio nella 9-1: mappa + 8 adesivi in ordine → AND CHILL. |

### Errori di luogo da correggere nella mappa

- Roberto: il biglietto dice **via Baldinucci 54**, la mappa usa il 46.
- Fruttivendolo: **via Ciaia 8**, la mappa usa il 5.
- Mamusca / Su: il Nokia dice **via Davanzati 2**, la mappa usa via Bovisasca 57. Da verificare l'indirizzo reale.
- 22-1: la festa della biblioteca è in **via Baldinucci 35**, ma la scena manda "a un parco qui vicino" e il flusso va alla 9.

### Cose che solo tu puoi dirmi

1. I **numeri sul sottobicchiere di Gabriele** (24-2), se te li ricordi, oppure se li ricreiamo noi.
2. Il **lato #5 della fontana** di piazza Bausan (le altre 7 facce le abbiamo ricostruite).
3. Quale lato del **segnalibro** andava nel poster della biblioteca, e dove portava la festa.
4. L'indirizzo vero del **Mamusca**.

### Stato dopo la fase A

Tutti gli indizi della tabella sono stati corretti come indicato nella colonna "Correzione":
- **Oggetti e soluzioni giusti**, con i nuovi indizi 33 (SANTA) e 9-1 (AND CHILL) al posto della raccolta gratuita nella 9.
- **Pezzi e fogli posizionati verificando le immagini composte:** memo strappato, poster, segnalibro, Il Guardiano, Da Amilcare.
- **Diploma:** aree delle 3 differenze misurate sull'immagine.
- **Luoghi corretti:** Baldinucci 54, Ciaia 8, Davanzati 2.
- **Parola "It's a bomb"** imparata dal memo della 5.
- **Password** tolleranti, senza aiuti sulle scelte finali.

Il sottobicchiere della 24-2 è ricreato (numeri di "Leave me alone"). Il lato #5 della fontana è dato nel testo dell'indizio. Restano da confermare con l'autore: il sottobicchiere originale, il lato #5, l'indirizzo vero del Mamusca. Un bot completa ancora la partita fino a F1 risolvendo ogni indizio.

### Inglese (revisione completata)

314 battute corrette in `data/story/text-fixes.json` (grammatica, ortografia, calchi dall'italiano, maiuscole, nomi), mantenendo slang e parolacce dei personaggi. Restano da decidere con l'autore:
- **Battute copiate dette dal personaggio sbagliato:** 16#7, 16-1#7 e 29#7 (Yda dice una battuta di Petronio a Roberto); 29#31a (Petronio dice a Su una battuta pensata per Roberto); 17#29 (Petronio dice la battuta di Sirio sui Candiani Beach Boyz subito dopo "Via Livigno 5"); 33#30 ("Bomb" detto da Su, ma è il tormentone di Roberto).
- **"keek"/"keeek" di Guido** (9-1, 12): non è inglese. È un intercalare voluto?
- **18#18 "Yet to be 100%."**: significato poco chiaro.
- **34#4:** "Il Guardiano" viene collocato in via Imbriani 54, ma la scena del Guardiano è in via Carnevali 113.

## 7. Piano di lavoro

**Fase A — Indizi corretti e risolvibili (dati e immagini).** Correggere oggetti e risposte sbagliati (5, 13, 22, 22-1, 30, 17-1, 18, 20-1, 21-1, 11, 12-1, 14). Aggiungere gli oggetti mancanti dal Journal e da DEMO (biglietti B2→B3, 31 adesivi di Reka, `librarygame`, `soundgame`, `laurea`, adesivi frutta/gelato/tango, pagine Meet Roberto/Guido/Su). Creare i nuovi indizi 33 (SANTA) e 9-1 (AND CHILL). Sistemare luoghi e parole chiave nel flusso.

**Fase B — Motore e mobile.** Fogli con dimensione e aggancio propri, rotazione (sottobicchiere), pezzi da incastrare (poster). Visualizzatore con ritagli mirati e zoom a pizzico. Battuta e ritratto restano visibili sopra l'indizio. Il foglio si trascina da una maniglia senza bloccare lo scorrimento. Timer che parte dopo aver visto l'immagine. Password tolleranti, niente aiuti sulle scelte che decidono il finale.

**Fase C — Grafica originale.** Sfondo di ogni scena da `DEMO/Backgrounds`. Ritratti originali scontornati in piedi, centrati automaticamente, con le varianti inside/outside. Pulsante audio nelle scene che l'avevano. Video dei finali.

**Fase D — Difficoltà a casa.** La destinazione resta "?" finché non risolvi l'enigma. Ci si sposta trovando il posto sulla mappa. Il diario annota senza suggerire. Aiuti a gettoni, risposte esatte, punteggio finale.

**Stato:**
- **A ✅ fatta.**
- **C ✅ fatta:** ogni scena ha il suo sfondo originale (cambia anche dentro la scena, come nell'originale), i personaggi originali scontornati in piedi (varianti inside/outside, errori di 24-2 e 33 corretti), le 18 canzoni con un pulsante ♪ in alto, e i video dei finali. Le canzoni che stavano su SoundCloud (10, 12, 13, 22-1, 23, 24-2, 8, 8-1, 9) non esistono più.
- **D ✅ fatta (punti 1-3, senza aiuti a gettoni):** a casa le destinazioni non sono più pulsanti col nome. La schermata "Where to next" mostra cosa ti hanno detto (frase di Sirio, Yda…, o la nota dell'indizio) e il luogo si trova sulla mappa: tocchi il punto e premi Go (dopo due errori l'app dice quanto dista il luogo più vicino). Il diario ha "Where to next" e "What people told you" (le frasi vere, non l'elenco delle parole da dire). Ogni cosa che entra nel diario compare in un avviso (toast) e accende un pallino sul pulsante del diario. Le diciture da carta ("Cut the line", "Turn the page"…) non si vedono più.
- **B quasi fatta:** i personaggi non si nascondono più dietro il box (hanno una zona riservata sopra) e restano visibili con la loro battuta anche sopra gli indizi. Il visualizzatore delle immagini si può pizzicare, trascinare e ingrandire con doppio tocco. I timer di 20-1, 21-1 e 22 partono solo quando premi "Start the clock", e le immagini da memorizzare compaiono a tutta larghezza solo allora. Fatti anche i ritagli dedicati: le bottiglie di Penny in due close-up (1–4 e 5–8) e le otto strisce della fontana raddrizzate in colonna, a tutta larghezza. Resta una sola immagine grande alla volta nelle altre gallerie degli indizi (oggi miniature).

Ordine consigliato: A → B → C → D. A e B rendono il gioco giusto, C lo rende bello, D lo rende un gioco vero a casa.
