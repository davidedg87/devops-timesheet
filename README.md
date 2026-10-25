# DevOps Timesheet

Diario ore personale che si compila da **Azure DevOps**. Scegli organizzazione e progetti, e l'app ricostruisce giorno per giorno le ore dei tuoi task dal *Completed Work*. Ferie, malattie, permessi e congedi li aggiungi a mano.

**Apri l'app:** https://davidedg87.github.io/riepilogo-attivita/

## Cosa fa
- **Import da Azure DevOps**: le ore che hai registrato sui task (assegnati a te o modificati da te), in uno o più progetti della stessa organizzazione.
- **Caricamento su Azure DevOps**: le ore scritte nel diario aggiornano Completed e Remaining Work dei task, con conferma e senza sovrascrivere modifiche altrui.
- **Assenze a mano**: ferie, permessi, malattia, congedi, L. 104 e altre causali, con codice.
- **Viste**: diario giornaliero, griglia del mese, grafici, sprint presi dalle iterazioni dei progetti.
- **Export CSV** per settimana, mese o sprint, pronto per Excel.

## Dove stanno i dati
Nessun server: la pagina è statica e i dati stanno in un file `attivita.json` che scegli tu, sul PC (es. in OneDrive) o in un tuo repo GitHub **privato**. Il PAT di Azure DevOps non finisce mai in `attivita.json`: resta nel browser e, con l'archivio GitHub, in `segreti.json` nello stesso repo privato.

## Per iniziare
1. Apri la pagina e scegli dove tenere i dati.
2. Al primo avvio indica l'organizzazione Azure DevOps, un Personal Access Token con **Work Items: Read & write** (più **Project and Team: Read** per scegliere i progetti da un elenco) e i progetti da seguire.
3. Per cambiare progetti o PAT più avanti: Maiusc+clic su **Sync Azure DevOps**.

## Sviluppo
Un solo file, `index.html`, senza build. I controlli sulla logica (import, unione dei file, sprint, configurazione) girano con `node checks.mjs`.
