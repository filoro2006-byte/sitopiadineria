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
- **Oltre 150 blocchi** con texture pixel-art generate proceduralmente: legni di 5 essenze, minerali, 16 lane, 16 cementi, terracotte, vetri colorati, fiori, piante, torce e altro.
- **Grafica**: luce del cielo e dei blocchi propagata per flood-fill, luce morbida e ambient occlusion, colori dell'erba e delle foglie che cambiano con il bioma, foglie e piante mosse dal vento, acqua animata e trasparente, ciclo giorno/notte con sole, luna e stelle, tramonti, nuvole 3D, nebbia, pioggia e neve, particelle.
- **Simulazione**: acqua e lava che scorrono (ossidiana e pietrisco quando si incontrano), sabbia e ghiaia che cadono, erba che si espande, canne e cactus che crescono, TNT con esplosioni a catena.
- **Modalità Creativa** (volo, blocchi infiniti, inventario con ricerca) e **Sopravvivenza** (vita, danni da caduta, annegamento, lava, zombie di notte, drop degli oggetti e oltre 70 ricette di creazione con banco da lavoro e fornace).
- **Creature**: maiali, mucche, pecore, galline e zombie (che bruciano al sole).
- **Salvataggio automatico** in IndexedDB, con più mondi.
- **Comandi**: `/time`, `/gamemode`, `/tp`, `/give`, `/spawn`, `/weather`, `/seed`, `/kill`.
- **Controlli touch** per iPhone e iPad.

## Comandi
WASD per muoversi · Spazio per saltare (doppio tocco = volo in creativa) · Maiusc per accovacciarsi · doppio W, Ctrl o R per correre ·
clic sinistro per rompere · clic destro per piazzare/usare · clic centrale per prendere il blocco · 1-9 o rotella per la barra rapida ·
E per l'inventario · Q per gettare · T o / per i comandi · F3 per il debug · F1 per nascondere l'HUD · ESC per la pausa.
