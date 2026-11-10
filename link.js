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

  /* Crea il pezzo da mettere dopo "#l=" : "AC2.…" */
  async function creaPayload(scheda, invio) {
    if (typeof CompressionStream === 'undefined') throw new Error('Questo browser non sa comprimere i dati: usa Chrome o Safari aggiornati.');
    const o = { v: 2, s: mappa(scheda, CORTE, true) };
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
    return { scheda: mappa(o.s, LUNGA, false), invio: invioValido(o.i) };
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
