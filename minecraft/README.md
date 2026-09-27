# BlockCraft

Un gioco sandbox a blocchi in stile Minecraft, scritto da zero in JavaScript + WebGL2.
Non ha dipendenze e non richiede una fase di build. Funziona su Safari (macOS, iPhone e iPad) e su Brave, Chrome, Edge e Firefox.

## Avvio
Pubblica la cartella con un qualunque server statico, per esempio:

```
npx http-server minecraft -p 8080
```

poi apri `http://localhost:8080`. Su GitHub Pages l'indirizzo è `.../minecraft/`.

## Caratteristiche
- **Mondo infinito procedurale** (seed testuale o numerico): 19 biomi (pianure, foreste, betulle, foresta fitta, taiga, taiga innevata, giungla, savana, deserto, calanchi a terrazze, paludi, montagne, picchi innevati, oceani, fiumi, spiagge...), grotte a spaghetti e caverne, fiumi, laghi di lava, ardesia profonda, minerali in vene.
- **Oltre 230 blocchi** con texture pixel-art generate proceduralmente: legni di 5 essenze, minerali, 16 lane, 16 cementi, terracotte, vetri colorati, fiori, piante, torce e altro.
- **Pacchetto shader** (attivabile): ombre del sole e della luna, acqua con riflessi del cielo e riflesso del sole, bloom, raggi di luce, curva cinematografica e distorsione sott'acqua.
- **Grafica**: luce del cielo e dei blocchi propagata per flood-fill, luce morbida e ambient occlusion, colori dell'erba e delle foglie che cambiano con il bioma, foglie e piante mosse dal vento, acqua animata e trasparente, ciclo giorno/notte con sole, luna e stelle, tramonti, nuvole 3D, nebbia, pioggia e neve, particelle.
- **Simulazione**: acqua e lava che scorrono (ossidiana e pietrisco quando si incontrano), sabbia e ghiaia che cadono, erba che si espande, canne e cactus che crescono, TNT con esplosioni a catena.
- **Modalità Creativa** (volo, blocchi infiniti, inventario con ricerca) e **Sopravvivenza** (vita, fame, danni da caduta, annegamento, lava, oltre 150 ricette con banco da lavoro e fornace).
- **Oggetti**: picconi, asce, pale, spade e zappe in 5 materiali con usura, arco e frecce, acciarino, lingotti e gemme, 13 cibi, uova generatrici per ogni creatura.
- **Blocchi speciali**: lastre, scale, staccionate, muretti, vetri sottili, porte, scale a pioli, bauli, letti (saltano la notte), lanterne, terreno arato, grano e arbusti che crescono in alberi.
- **Creature** con modelli e animazioni come nell'originale: maiali, mucche, pecore colorate, galline, zombie, scheletri arcieri, creeper che esplodono, ragni che si arrampicano, golem di ferro.
- **Villaggi** con pozzo, strade, case, fattorie e fabbro con bottino nei bauli; villici di 5 mestieri con cui scambiare smeraldi (`/locate` trova il villaggio più vicino).
- **Nether**: si entra con un portale di ossidiana (cornice 4×5 accesa con l'acciarino); ogni blocco nel Nether vale 8 blocchi nel mondo normale e all'arrivo viene cercato o costruito un portale. Ci sono 5 biomi (distese del Nether, foresta cremisi, foresta distorta, valle delle anime, delta di basalto), un mare di lava, funghi giganti, pietraluce, quarzo, oro del Nether, magma e fortezze con ponti, giardini di verruche e bauli. I letti esplodono.
- **Armature** di pelle, oro, maglia, ferro e diamante: riducono i danni con la formula originale, si consumano, si indossano col clic destro o dagli slot dell'inventario e si vedono sul personaggio.
- **Esperienza e incantesimi**: sfere di esperienza da mostri e minerali, barra dei livelli, tavolo per incantesimi con librerie e lapislazzuli, 15 incantesimi (Affilatezza, Efficienza, Fortuna, Tocco di velluto, Protezione, Indistruttibilità, Potenza, Fiamma, Infinità...), bagliore viola sugli oggetti incantati e libro fluttuante sul tavolo.
- **Nuove creature**: lupi e gatti da addomesticare (osso e merluzzo, clic destro per farli sedere), Enderman che si teletrasportano e si arrabbiano se li guardi, merluzzi, piglin zombificati, ghast con palle di fuoco (colpiscile per rimandarle indietro), blaze e cubi di magma che si dividono. Zombie e scheletri possono avere l'armatura. Perle di ender, farina d'ossa e ampolle di esperienza.
- **Visuale in terza persona** (F5 o V).
- **Salvataggio automatico** in IndexedDB, con più mondi (Nether e animali domestici compresi).
- **Comandi**: `/time`, `/gamemode`, `/tp`, `/give`, `/spawn`, `/weather`, `/seed`, `/locate`, `/dim nether|overworld`, `/xp`, `/enchant`, `/kill`.
- **Controlli touch** per iPhone e iPad.

## Comandi
WASD per muoversi · Spazio per saltare (doppio tocco = volo in creativa) · Maiusc per accovacciarsi · doppio W, Ctrl o R per correre ·
clic sinistro per rompere · clic destro per piazzare/usare · clic centrale per prendere il blocco · 1-9 o rotella per la barra rapida ·
E per l'inventario · Q per gettare · T o / per i comandi · F5 o V per la terza persona · F3 per il debug · F1 per nascondere l'HUD · ESC per la pausa.
