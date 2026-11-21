/* Link personale dell'atleta.
   La scheda (e, se c'è, il collegamento al bot dell'allenatore) viene compressa e messa nella parte del
   link dopo il simbolo #: quella parte non viene mai inviata al sito, resta sul telefono.
   Questo file è usato sia dall'app sia dalla pagina con cui l'allenatore crea il link: tienili uguali. */
(function (g) {
  'use strict';
  const PREFISSO = 'AC2.';
  // nomi dei campi abbreviati, per accorciare il link
  const CORTE = {
    atleta: 'a', allenatore: 'l', periodo: 'p', settimane: 'w', obiettivi: 'b', prima_di_iniziare: 'f', giorni: 'g',
    nome: 'n', esercizi: 'e', serie_rep: 's', carico: 'c', rest: 'r', nota: 'o', progressione: 'x', video: 'v',
    originale: 'q', info_utili: 'i', titolo: 't', testo: 'z', durata: 'u', frequenza: 'h'
  };
  const LUNGA = Object.fromEntries(Object.entries(CORTE).map(([k, v]) => [v, k]));
  const SOLO_ALLENATORE = new Set(['da_controllare']);   // non serve all'atleta: non va nel link

  /* Info utili comuni a tutte le schede dello stesso allenatore: stanno qui una volta sola e nel link
     compare solo il numero della voce (così il link è molto più corto).
     REGOLA: l'elenco si può solo ALLUNGARE in fondo. Mai cambiare, togliere o spostare una voce:
     i link già mandati agli atleti usano questi numeri. Una voce modificata va aggiunta come voce nuova. */
  const INFO_STANDARD = [
    {"titolo": "Riscaldamento", "testo": "prima di allenarti fai sempre il riscaldamento con gli elastici e la routine che ti ho mandato in video. Poi fai l'avvicinamento al carico."},
    {"titolo": "Scarico per le anche", "testo": "schiena a terra in posizione fetale, abbracci le ginocchia e le tieni al petto per 20\" respirando; poi mobilizzi le anche ruotando le ginocchia, tenendole unite."},
    {"titolo": "Avvicinamento al carico", "testo": "se leggi 50 kg, quello è il carico allenante. L'avvicinamento è fatto di 2 serie: 1 con metà del carico allenante per 5-10 ripetizioni, senza affaticarti, per prendere confidenza con il movimento; poi 1 con l'80/85% del carico allenante per 2-4 ripetizioni. Recupera 2' e sei pronto per la serie allenante col carico indicato."},
    {"titolo": "Serie × rep", "testo": "indico \"serie\" x \"rep\". Se non scrivo le rep, ti avrò spiegato cosa intendo sull'esercizio, altrimenti chiedimelo su Telegram."},
    {"titolo": "Range rep", "testo": "se leggi 2 x 7-11 cercherai ogni volta di fare almeno 7 rep. Quando chiudi tutte le serie con 11 ripetizioni si aumenta il carico (ti dico io di quanto, tu comunicami il risultato) e si riparte dal basso, finché non chiudi di nuovo 11 rep su tutte le serie col nuovo carico, e così via."},
    {"titolo": "Rest", "testo": "è il recupero. È indicativo ma ti consiglio di seguirlo: meglio recuperare di più che di meno. Dove non leggi il rest, parti quando ti senti pronto per fare una serie con la massima qualità tecnica ed energia."},
    {"titolo": "Set", "testo": "set 1, set 2… sono settimana 1, settimana 2. \"3 x 2 (set 1)\" significa che nella settimana 1 segui lo schema 3 x 2, e così via. Attenzione: i \"set\" non sono le serie."},
    {"titolo": "Superserie (SS)", "testo": "due esercizi in superserie si alternano: nei recuperi di uno fai l'altro."},
    {"titolo": "Split 4 x week", "testo": "se non completi tutti i giorni in una settimana, segui comunque l'ordine. La settimana è una convenzione: se ti alleni 2 volte, il lunedì farai l'allenamento successivo all'ultimo fatto (se era il giorno 2, farai il giorno 3)."},
    {"titolo": "Passi", "testo": "usciamo dalla sedentarietà: almeno 8.000 passi al giorno, non serve farli tutti in una volta. Metti 4-5k passi dopo l'allenamento sul tapis, alla velocità che preferisci. Non basta andare in palestra per curare la nostra persona e la nostra salute, cardiovascolare e muscolare: oltre al riscontro estetico, i passi ti danno un recupero migliore tra gli allenamenti e più performance (più risultati), la regolazione del peso corporeo e una migliore gestione delle calorie."},
    {"titolo": "Video", "testo": "filma l'ultima serie di ogni esercizio o quella con scritto \"x max\" (il massimale tecnico). Sui circuiti basta una serie, non tutto il circuito. Taglia i video prima di inviarli."},
    {"titolo": "Resoconto", "testo": "segna carichi, rep e massimali tecnici e riportali nel resoconto; appuntali anche in chat se serve."},
    {"titolo": "Domande e fastidi", "testo": "se hai fastidi di qualsiasi tipo comunicamelo. Chiedimi ogni cosa ti venga in mente, possibilmente prima di allenarti: durante l'allenamento la risposta potrebbe non essere immediata."}
  ];

  function mappa(x, tab, scarta) {
    if (Array.isArray(x)) return x.map((i) => mappa(i, tab, scarta));
    if (x && typeof x === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(x)) {
        if (scarta && SOLO_ALLENATORE.has(k)) continue;
        out[tab[k] || k] = mappa(v, tab, scarta);
      }
      return out;
    }
    return x;
  }

  function inBase64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function daBase64(t) {
    const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }
  async function passa(u8, flusso) {
    const w = flusso.writable.getWriter();
    w.write(u8).catch(() => {});
    w.close().catch(() => {});   // gli errori arrivano comunque dalla lettura qui sotto
    return new Uint8Array(await new Response(flusso.readable).arrayBuffer());
  }

  function invioValido(o) {
    if (!o || typeof o !== 'object') return null;
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(String(o.t || ''))) return null;
    if (!/^-?\d+$/.test(String(o.c))) return null;
    const th = o.th == null || o.th === '' ? null : Number(o.th);
    if (th !== null && !Number.isInteger(th)) return null;
    return { t: o.t, c: String(o.c), th };
  }

  const uguale = (a, b) => a && b && a.titolo === b.titolo && a.testo === b.testo;

  /* Crea il pezzo da mettere dopo "#l=" : "AC2.…"
     livello 0: scheda completa; 1: il testo originale resta solo agli esercizi con un dubbio; 2: nessun testo originale.
     I livelli 1 e 2 servono solo quando il link deve essere più corto (es. per stare in un messaggio Telegram). */
  async function creaPayload(scheda, invio, opzioni) {
    if (typeof CompressionStream === 'undefined') throw new Error('Questo browser non sa comprimere i dati: usa Chrome o Safari aggiornati.');
    const livello = (opzioni && opzioni.livello) || 0;
    const copia = JSON.parse(JSON.stringify(scheda));
    if (Array.isArray(copia.info_utili)) {
      copia.info_utili = copia.info_utili.map((v) => { const k = INFO_STANDARD.findIndex((x) => uguale(x, v)); return k >= 0 ? k : v; });
    }
    if (livello >= 1) {
      for (const g of copia.giorni || []) for (const e of g.esercizi || []) {
        if (livello >= 2 || !(e.da_controllare && String(e.da_controllare).trim())) delete e.originale;
      }
    }
    const o = { v: 2, s: mappa(copia, CORTE, true) };
    const inv = invioValido(invio);
    if (inv) o.i = inv;
    const testo = new TextEncoder().encode(JSON.stringify(o));
    return PREFISSO + inBase64(await passa(testo, new CompressionStream('deflate-raw')));
  }

  /* Legge un "AC2.…" e restituisce { scheda, invio } */
  async function leggiPayload(payload) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Questo browser non sa leggere il link: usa Chrome o Safari aggiornati.');
    const m = String(payload || '').match(/AC2\.([A-Za-z0-9_-]+)/);
    if (!m) throw new Error('Il link non è completo: toccalo di nuovo oppure chiedi un nuovo link.');
    let o;
    try {
      const u8 = await passa(daBase64(m[1]), new DecompressionStream('deflate-raw'));
      o = JSON.parse(new TextDecoder().decode(u8));
    } catch (e) { throw new Error('Il link sembra tagliato o danneggiato: chiedi di mandartelo di nuovo.'); }
    if (!o || o.v !== 2 || !o.s) throw new Error('Il link non è nel formato giusto: chiedi un nuovo link.');
    const scheda = mappa(o.s, LUNGA, false);
    if (Array.isArray(scheda.info_utili)) {
      scheda.info_utili = scheda.info_utili.map((v) => {
        if (typeof v !== 'number') return v;
        if (!INFO_STANDARD[v]) throw new Error('Questo link è più nuovo della tua app: chiudi del tutto l\'app, riaprila e tocca di nuovo il link.');
        return INFO_STANDARD[v];
      });
    }
    return { scheda, invio: invioValido(o.i) };
  }

  /* Identificativo breve del link, per riconoscere se è già stato caricato */
  function idPayload(payload) {
    let h = 2166136261;
    const s = String(payload);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(16) + '-' + s.length;
  }

  g.LinkScheda = { creaPayload, leggiPayload, idPayload, invioValido, PREFISSO };
})(typeof window !== 'undefined' ? window : globalThis);
