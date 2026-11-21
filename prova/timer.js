/* Timer dell'allenamento: Tempo (tenute, plank), Tabata, EMOM.
   Se l'esercizio prevede il video, il timer può accendere la fotocamera e registrare da solo
   SOLO l'ultimo giro di lavoro (regola dell'allenatore: «filma l'ultima serie»).
   Usa funzioni del programma principale: h, stato, salvaSess, toast, schermoAcceso,
   datiEsercizio, settSess, tipoSupportato, salvaVideo. */
(function () {
  'use strict';

  const PREP = 5;          // secondi per prepararsi
  const MARGINE_REC = 1;   // secondi di registrazione prima e dopo l'ultimo giro
  const LIMITE_VIDEO = 150; // oltre ~2'30" il video rischia di superare i 50 MB di Telegram

  /* ---------- aspetto ---------- */
  const css = `
  .tm { position: fixed; inset: 0; z-index: 60; background: var(--sfondo); display: flex; flex-direction: column; color: #fff; }
  .tm .tm-pag { flex: 1; overflow-y: auto; padding: calc(var(--alto) + 16px) 18px calc(var(--basso) + 24px); display: flex; flex-direction: column; gap: 14px; }
  .tm h2 { font-size: 24px; }
  .tm .modi { display: flex; gap: 8px; }
  .tm .modi .btn { flex: 1; padding: 13px 0; }
  .tm .riga { display: flex; flex-direction: column; gap: 6px; }
  .tm .riga label { font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--testo-2); font-weight: 700; }
  .tm .totale { color: var(--testo-2); font-size: 16px; text-align: center; }
  .tm .spunta { display: flex; gap: 12px; align-items: flex-start; background: var(--carta); border-radius: 16px; padding: 14px; }
  .tm .spunta input { width: 26px; height: 26px; margin-top: 2px; flex: none; accent-color: var(--accento); }
  .tm-corsa { position: fixed; inset: 0; z-index: 61; display: flex; flex-direction: column; background: #000; color: #fff; transition: background .25s; }
  .tm-corsa.f-prep { background: #2b3340; }
  .tm-corsa.f-lavoro { background: #13803c; }
  .tm-corsa.f-pausa { background: #b8611a; }
  .tm-corsa.f-giro { background: #13803c; }
  .tm-corsa.f-fine { background: #1a2128; }
  .tm-corsa video.cam { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
  .tm-corsa .sopra { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: calc(var(--alto) + 12px) 16px 12px; text-align: center; }
  .tm-corsa.con-cam .sopra { justify-content: flex-start; }
  .tm-corsa.con-cam .pannello { background: #000a; border-radius: 22px; padding: 10px 22px 14px; border: 4px solid transparent; }
  .tm-corsa.con-cam.f-lavoro .pannello, .tm-corsa.con-cam.f-giro .pannello { border-color: #34c759; }
  .tm-corsa.con-cam.f-pausa .pannello { border-color: #f0a050; }
  .tm-corsa .fase { font-size: 26px; font-weight: 800; letter-spacing: 2px; }
  .tm-corsa .cifre { font-size: 120px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
  .tm-corsa.con-cam .cifre { font-size: 84px; }
  .tm-corsa .giro { font-size: 22px; font-weight: 700; opacity: .92; }
  .tm-corsa .rec { display: inline-block; margin-top: 6px; background: #e5484d; border-radius: 999px; padding: 4px 12px; font-weight: 800; font-size: 16px; }
  .tm-corsa .nome { font-size: 15px; opacity: .85; max-width: 90%; }
  .tm-corsa .comandi { position: relative; z-index: 1; display: flex; gap: 10px; padding: 12px 16px calc(var(--basso) + 18px); }
  .tm-corsa .comandi .btn { flex: 1; background: #ffffff26; color: #fff; }
  .tm-corsa .fine { position: relative; z-index: 1; flex: 1; overflow-y: auto; padding: calc(var(--alto) + 18px) 18px calc(var(--basso) + 24px); display: flex; flex-direction: column; gap: 12px; }
  .tm-corsa .fine video { width: 100%; max-height: 42dvh; border-radius: 14px; background: #000; }
  `;
  document.head.append(h('style', { text: css }));

  /* ---------- letture dalla scheda ---------- */
  // primo tempo scritto nel testo, in secondi: 1:30, 1'30", 30", 2'
  function secondiDa(testo) {
    if (!testo) return 0;
    const t = String(testo).replace(/[’′‘]/g, "'").replace(/[”″“]|''/g, '"');
    let m;
    if ((m = t.match(/(\d+)\s*:\s*(\d{1,2})/))) return +m[1] * 60 + +m[2];
    if ((m = t.match(/(\d+)\s*'\s*(\d{1,2})/))) return +m[1] * 60 + +m[2];
    if ((m = t.match(/(\d+)\s*"/))) return +m[1];
    if ((m = t.match(/(\d+)\s*'/))) return +m[1] * 60;
    return 0;
  }
  const serieDa = (testo) => { const m = String(testo || '').match(/^\s*(\d+)\s*[×xX]/); return m ? +m[1] : 0; };

  function proposta(i) {
    const base = { modo: 'tabata', durata: 30, serie: 3, recupero: 60, lavoro: 20, pausa: 10, giri: 8, minuti: 10, ogni: 60 };
    if (i == null || !stato.sess) return base;
    const d = stato.sess.es[i];
    if (d && d.timer) return { ...base, ...d.timer };
    const es = stato.scheda.giorni[stato.sess.giorno].esercizi[i];
    const ds = datiEsercizio(es, settSess());
    const sr = String(ds.serie_rep || '');
    if (/emom/i.test(sr)) {
      const tot = secondiDa(sr);
      return { ...base, modo: 'emom', minuti: tot >= 60 ? Math.round(tot / 60) : base.minuti };
    }
    const dur = secondiDa(sr);
    if (dur > 0) {
      const rec = secondiDa(ds.rest);
      return { ...base, modo: 'tempo', durata: dur, serie: serieDa(sr) || 1, recupero: rec || base.recupero };
    }
    return base;
  }

  /* ---------- fasi ---------- */
  function fasi(c) {
    const out = [{ tipo: 'prep', d: PREP, giro: 0 }];
    if (c.modo === 'emom') {
      for (let k = 1; k <= c.minuti; k++) out.push({ tipo: 'giro', d: c.ogni, giro: k });
    } else {
      const n = c.modo === 'tempo' ? c.serie : c.giri;
      const lav = c.modo === 'tempo' ? c.durata : c.lavoro;
      const pau = c.modo === 'tempo' ? c.recupero : c.pausa;
      for (let k = 1; k <= n; k++) {
        out.push({ tipo: 'lavoro', d: lav, giro: k });
        if (k < n && pau > 0) out.push({ tipo: 'pausa', d: pau, giro: k });
      }
    }
    let t = 0;
    for (const f of out) { f.da = t; t += f.d; f.a = t; }
    return out;
  }
  const nGiri = (c) => (c.modo === 'emom' ? c.minuti : c.modo === 'tempo' ? c.serie : c.giri);
  const fmt = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); const r = s % 60; return m ? `${m}'${r ? String(r).padStart(2, '0') + '"' : ''}` : `${r}"`; };
  const cifre = (s) => { s = Math.max(0, Math.ceil(s - 1e-6)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s); };
  function descrizione(c) {
    if (c.modo === 'tempo') return `Tempo ${c.serie} × ${fmt(c.durata)}` + (c.serie > 1 && c.recupero ? ` (recupero ${fmt(c.recupero)})` : '');
    if (c.modo === 'tabata') return `Tabata ${fmt(c.lavoro)}/${fmt(c.pausa)} × ${c.giri}`;
    return `EMOM ${c.minuti} giri ogni ${fmt(c.ogni)}`;
  }

  /* ---------- suoni ---------- */
  let ac = null;
  function audioPronto(conCamera) {
    try { if (navigator.audioSession) navigator.audioSession.type = conCamera ? 'play-and-record' : 'playback'; } catch (e) { /* ignora */ }
    sottofondoMuto(!conCamera);   // con la fotocamera non serve: l'iPhone fa già passare i suoni
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) { ac = null; }
    if (typeof caricaClip === 'function') caricaClip();
  }
  function audioFine() {
    sottofondoMuto(false);
    try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) { /* ignora */ }
  }
  // Su iPhone, senza fotocamera accesa, i suoni della pagina seguono il tasto silenzioso.
  // Un audio muto in ripetizione fa trattare la pagina come «musica»: così voce e bip passano anche in silenzioso.
  let muto = null;
  function sottofondoMuto(acceso) {
    try {
      if (!acceso) { if (muto) { muto.pause(); } return; }
      if (!muto) {
        const n = 8000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);   // 1 secondo di silenzio, 8 kHz, 8 bit
        const scrivi = (o, s) => { for (let k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
        scrivi(0, 'RIFF'); v.setUint32(4, 36 + n, true); scrivi(8, 'WAVE'); scrivi(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
        v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); scrivi(36, 'data'); v.setUint32(40, n, true);
        for (let k = 0; k < n; k++) v.setUint8(44 + k, 128);
        muto = document.createElement('audio');
        muto.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
        muto.loop = true; muto.setAttribute('playsinline', ''); muto.setAttribute('x-webkit-airplay', 'deny');
      }
      const p = muto.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignora */ }
  }
  function bip(freq, dur, vol) {
    if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.6, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur + 0.02);
    } catch (e) { /* ignora */ }
  }

  /* ---------- voce ---------- */
  // Usa la voce del telefono (sintesi vocale del sistema): nessun file audio, nessun costo, funziona anche senza rete.
  const haVoce = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  function voce(lang) {
    try {
      const vs = speechSynthesis.getVoices() || [];
      const norm = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
      return vs.find((v) => norm(v) === lang.toLowerCase() && v.localService) || vs.find((v) => norm(v) === lang.toLowerCase())
        || vs.find((v) => norm(v).startsWith(lang.slice(0, 2).toLowerCase())) || null;
    } catch (e) { return null; }
  }
  // Su iPhone: la voce va «sbloccata» con un tocco (una parola vera a volume zero, non uno spazio vuoto,
  // che può bloccare la coda); e se si interrompe una frase e se ne avvia subito un'altra, la nuova
  // viene persa. Quindi si interrompe solo se serve e si riparte dopo un attimo.
  // Se la voce non parte entro 1,2 secondi suona il bip: mai silenzio.
  let vocePartita = null;   // null = non ancora provato, true/false = esito dell'ultima prova
  function sbloccaVoce() {
    if (!haVoce()) return;
    try { speechSynthesis.resume(); const u = new SpeechSynthesisUtterance('ok'); u.volume = 0; u.rate = 2; speechSynthesis.speak(u); } catch (e) { /* ignora */ }
  }
  function parla(testo, lang, subito, seNonParte, esitoGrezzo) {
    if (!haVoce()) return false;
    let detto = false;
    const esito = esitoGrezzo ? (ok) => { if (!detto) { detto = true; esitoGrezzo(ok); } } : null;
    try {
      const occupata = speechSynthesis.speaking || speechSynthesis.pending;
      if (subito && occupata) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(testo);
      u.lang = lang; const v = voce(lang); if (v) u.voice = v;
      u.rate = 1.05; u.volume = 1;
      let partita = false;
      u.onstart = () => { partita = true; vocePartita = true; if (esito) esito(true); };
      u.onerror = () => { if (!partita) { vocePartita = false; if (esito) esito(false); } };
      const via = () => { try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { /* ignora */ } };
      if (subito && occupata) setTimeout(via, 80); else via();
      setTimeout(() => {
        if (!partita) { vocePartita = false; if (seNonParte) seNonParte(); if (esito) esito(false); }
      }, 1200);
      return true;
    } catch (e) { return false; }
  }
  /* ---------- voce registrata (file audio nella cartella voce/) ---------- */
  // Le parole registrate si suonano come i bip: precise al centesimo e, su iPhone, anche in silenzioso.
  const CLIP = ['start', 'stop', 'rest', 'completato'];
  const PAUSA_STOP_REST = 0.5;   // silenzio tra «Stop» e «Rest» (con 0,08" erano troppo attaccati)
  const clip = {};          // nome → suono pronto
  let caricoClip = null;
  function caricaClip() {
    if (caricoClip || !ac) return caricoClip;
    caricoClip = Promise.all(CLIP.map(async (n) => {
      const r = await fetch('voce/' + n + '.mp3');
      if (!r.ok) throw new Error(n);
      const dati = await r.arrayBuffer();
      clip[n] = await new Promise((ok, no) => { const p = ac.decodeAudioData(dati, ok, no); if (p && p.catch) p.catch(no); });
    })).then(() => true).catch(() => { caricoClip = null; return false; });
    return caricoClip;
  }
  const clipPronte = () => CLIP.every((n) => clip[n]);
  const inCoda = [];         // suoni programmati, da fermare con Stop
  function suonaClip(nome, tra = 0) {   // restituisce la durata, per mettere in fila la parola dopo
    const b = clip[nome];
    if (!ac || !b) return 0;
    try {
      const s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = b; g.gain.value = 1;
      s.connect(g); g.connect(ac.destination);
      s.start(ac.currentTime + Math.max(0, tra));
      inCoda.push(s); s.onended = () => { const k = inCoda.indexOf(s); if (k >= 0) inCoda.splice(k, 1); };
      return b.duration;
    } catch (e) { return 0; }
  }
  const zittisci = () => {
    try { if (haVoce()) speechSynthesis.cancel(); } catch (e) { /* ignora */ }
    inCoda.splice(0).forEach((s) => { try { s.stop(); } catch (e) { /* ignora */ } });
  };
  // scelta ricordata sul telefono (chiave nuova: con la voce registrata si riparte da quella)
  const AVVISI = 'ac_timer_avvisi2';
  const avvisiSalvati = () => { try { const v = localStorage.getItem(AVVISI); return ['registrata', 'voce', 'bip'].includes(v) ? v : 'registrata'; } catch (e) { return 'registrata'; } };

  /* ---------- schermata di scelta ---------- */
  window.apriTimer = function apriTimer({ i = null, alVideo = () => {}, alResoconto = () => {} } = {}) {
    const es = i != null && stato.sess ? stato.scheda.giorni[stato.sess.giorno].esercizi[i] : null;
    const c = proposta(i);
    c.avvisi = avvisiSalvati();   // scelta unica per tutti gli esercizi
    if (c.avvisi === 'voce' && !haVoce()) c.avvisi = 'bip';
    const puoFilmare = !!(es && es.video && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    let filma = puoFilmare && !(stato.video && stato.video.has(i));
    let facing = 'environment';

    const box = h('div', { class: 'tm' });
    const pag = h('div', { class: 'tm-pag' });
    box.append(pag);
    document.body.append(box);
    const chiudi = () => { box.remove(); audioFine(); };

    const stepper = (etichetta, chiave, passo, min, max, comeTempo) => {
      const v = h('div', { class: 'stepper-v' });
      const mostra = () => { v.textContent = comeTempo ? fmt(c[chiave]) : String(c[chiave]); totale(); };
      const cambia = (dx) => { c[chiave] = Math.min(max, Math.max(min, c[chiave] + dx)); mostra(); };
      const r = h('div', { class: 'riga' }, h('label', { text: etichetta }),
        h('div', { class: 'stepper' },
          h('button', { class: 'btn', type: 'button', text: '−', onclick: () => cambia(-passo) }), v,
          h('button', { class: 'btn', type: 'button', text: '+', onclick: () => cambia(passo) })));
      setTimeout(mostra, 0);
      return r;
    };
    const tot = h('p', { class: 'totale' });
    const avvisoLungo = h('div', { class: 'avviso nascosto' });
    function totale() {
      const f = fasi(c);
      const ultimo = f[f.length - 1];
      tot.textContent = 'Durata totale: ' + fmt(ultimo.a - PREP) + ' (più 5" per prepararti)';
      const lungo = filma && ultimo.d + 2 * MARGINE_REC > LIMITE_VIDEO;
      avvisoLungo.classList.toggle('nascosto', !lungo);
      avvisoLungo.textContent = 'L\'ultimo giro dura ' + fmt(ultimo.d) + ': il video potrebbe essere troppo pesante per Telegram (massimo circa 2\'30").';
    }

    // prova della voce al tocco su «Voce»: dice «Start» e scrive se il telefono l'ha pronunciata davvero
    const esitoVoce = h('div', { class: 'sotto', style: 'font-weight:700' });
    function provaVoce() {
      esitoVoce.textContent = 'Provo la voce…';
      audioPronto(false); sbloccaVoce();
      const ok = parla('Start', 'en-US', false, null, (si) => {
        esitoVoce.textContent = si
          ? '✓ Il telefono sta parlando. Se non senti nulla, alza il volume e controlla che il telefono non sia in silenzioso.'
          : '✗ Il telefono non ha fatto partire la voce: durante il timer userò i bip.';
      });
      if (!ok) esitoVoce.textContent = '✗ Questo telefono non ha la voce: userò i bip.';
    }
    async function provaRegistrata() {
      esitoVoce.textContent = 'Carico la voce registrata…';
      audioPronto(false);
      const ok = await caricaClip();
      if (ok && clipPronte()) { suonaClip('start'); esitoVoce.textContent = '✓ Voce registrata pronta.'; }
      else esitoVoce.textContent = '✗ Non riesco a caricare la voce registrata: userò la voce del telefono o i bip.';
    }

    function disegna() {
      pag.replaceChildren();
      pag.append(
        h('div', { class: 'fila', style: 'align-items:center' },
          h('h2', { text: es ? es.nome : 'Timer libero', style: 'flex:3' }),
          h('button', { class: 'btn piccolo', type: 'button', text: 'Chiudi', style: 'flex:1', onclick: chiudi })),
        h('div', { class: 'modi' }, [['tempo', 'Tempo'], ['tabata', 'Tabata'], ['emom', 'EMOM']].map(([m, t]) =>
          h('button', { class: 'btn piccolo' + (c.modo === m ? ' primario' : ''), type: 'button', text: t, onclick: () => { c.modo = m; disegna(); } })))
      );
      if (c.modo === 'tempo') {
        pag.append(h('p', { class: 'sotto', text: 'Per tenute, plank, isometrie: lavori per il tempo indicato, poi recuperi.' }),
          stepper('Durata di ogni serie', 'durata', 5, 5, 600, true),
          stepper('Serie', 'serie', 1, 1, 20, false),
          stepper('Recupero tra le serie', 'recupero', 5, 0, 600, true));
      } else if (c.modo === 'tabata') {
        pag.append(h('p', { class: 'sotto', text: 'Lavoro e pausa alternati, per il numero di giri scelto.' }),
          stepper('Lavoro', 'lavoro', 5, 5, 300, true),
          stepper('Pausa', 'pausa', 5, 0, 300, true),
          stepper('Giri', 'giri', 1, 1, 50, false));
      } else {
        pag.append(h('p', { class: 'sotto', text: 'Un giro all\'inizio di ogni intervallo: fai le ripetizioni e recuperi fino al giro dopo.' }),
          stepper('Giri (minuti)', 'minuti', 1, 1, 60, false),
          stepper('Un giro ogni', 'ogni', 15, 15, 300, true));
      }
      pag.append(tot);
      {
        const scelte = [['registrata', '🎙 Voce registrata']].concat(haVoce() ? [['voce', '🗣 Voce telefono']] : [], [['bip', '🔔 Bip']]);
        const spiega = {
          registrata: 'Parole registrate: «Start» quando si lavora, «Stop, rest» quando si recupera, «Stop, completato» alla fine. Al secondo giusto. Negli ultimi 3 secondi restano i bip.',
          voce: 'La voce del telefono dice le stesse parole, ma può arrivare in ritardo e in silenzioso non si sente.',
          bip: 'Un bip lungo a ogni cambio e tre bip corti negli ultimi 3 secondi.',
        };
        pag.append(h('div', { class: 'riga' }, h('label', { text: 'Avvisi' }),
          h('div', { class: 'modi' }, scelte.map(([m, t]) =>
            h('button', { class: 'btn piccolo' + (c.avvisi === m ? ' primario' : ''), type: 'button', text: t, onclick: () => {
              c.avvisi = m; try { localStorage.setItem(AVVISI, m); } catch (e) { /* ignora */ }
              esitoVoce.textContent = '';
              disegna();
              if (m === 'voce') provaVoce();
              if (m === 'registrata') provaRegistrata();
            } }))),
          h('div', { class: 'sotto', text: spiega[c.avvisi] }),
          esitoVoce));
      }
      if (puoFilmare) {
        const cb = h('input', { type: 'checkbox', onchange: (e) => { filma = e.target.checked; totale(); camRiga.classList.toggle('nascosto', !filma); } });
        cb.checked = filma;
        const camRiga = h('div', { class: 'fila' + (filma ? '' : ' nascosto') },
          h('button', { class: 'btn piccolo', type: 'button', text: facing === 'environment' ? 'Fotocamera: dietro' : 'Fotocamera: davanti', onclick: (e) => { facing = facing === 'environment' ? 'user' : 'environment'; e.target.textContent = facing === 'environment' ? 'Fotocamera: dietro' : 'Fotocamera: davanti'; } }));
        pag.append(h('label', { class: 'spunta' }, cb,
          h('div', {}, h('div', { text: '🎥 Filma l\'ultimo giro', style: 'font-weight:700' }),
            h('div', { class: 'sotto', text: (stato.video && stato.video.has(i) ? 'Questo esercizio ha già un video: spunta qui se vuoi rifarlo. ' : '')
              + 'Appoggia il telefono: la registrazione parte e si ferma da sola, solo sull\'ultimo giro di lavoro.' }))),
          camRiga, avvisoLungo);
      } else {
        // si dice perché non c'è l'opzione video, così non si resta senza video senza saperlo
        pag.append(h('p', { class: 'sotto', text: !es
          ? '🎥 Il video non c\'è nel timer libero: per filmare apri il timer dal pulsante «⏱ Timer» dell\'esercizio.'
          : !es.video ? '🎥 Per questo esercizio la scheda non chiede il video.'
          : '🎥 Questo telefono non permette di filmare dal timer: usa «Filma l\'ultima serie» nell\'esercizio.' }));
      }
      pag.append(h('div', { class: 'spazio' }),
        h('button', { class: 'btn primario', type: 'button', text: '▶ Parti tra 5 secondi', onclick: () => avvia() }));
      totale();
    }

    async function avvia() {
      if (i != null && stato.sess) { stato.sess.es[i].timer = { ...c }; salvaSess(); }
      audioPronto(filma);
      if (c.avvisi !== 'bip') sbloccaVoce();   // anche con la registrata: la voce del telefono fa da riserva
      let stream = null;
      if (filma) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
        } catch (e) {
          toast('Non riesco ad aprire la fotocamera: parto con il solo timer.', 5000);
          stream = null;
        }
      }
      corsa({ c: { ...c }, es, i, stream, facing, alVideo, alResoconto, alChiudi: chiudi });
    }

    disegna();
  };

  /* ---------- timer in corso ---------- */
  function corsa({ c, es, i, stream, facing, alVideo, alResoconto, alChiudi }) {
    const F = fasi(c);
    const totaleS = F[F.length - 1].a;
    // finestra di registrazione: l'ultimo giro di lavoro, con un secondo di margine
    const ultimoLav = [...F].reverse().find((f) => f.tipo === 'lavoro' || f.tipo === 'giro');
    const recDa = Math.max(0, ultimoLav.da - MARGINE_REC), recA = ultimoLav.a + MARGINE_REC;

    const box = h('div', { class: 'tm-corsa f-prep' + (stream ? ' con-cam' : '') });
    const elFase = h('div', { class: 'fase' }), elCifre = h('div', { class: 'cifre' }), elGiro = h('div', { class: 'giro' });
    const elRec = h('div', { class: 'rec nascosto', text: '● REC' });
    const pannello = h('div', { class: 'pannello' }, elFase, elCifre, elGiro, elRec);
    const sopra = h('div', { class: 'sopra' }, h('div', { class: 'nome', text: es ? es.nome : 'Timer libero' }), pannello);
    const bPausa = h('button', { class: 'btn', type: 'button', text: 'Pausa' });
    const bStop = h('button', { class: 'btn', type: 'button', text: 'Stop' });
    const comandi = h('div', { class: 'comandi' }, bPausa, bStop);
    if (stream) {
      const cam = h('video', { class: 'cam', muted: true, playsinline: true, autoplay: true });
      cam.srcObject = stream; cam.muted = true;
      if (facing === 'user') cam.style.transform = 'scaleX(-1)';
      box.append(cam);
    }
    box.append(sopra, comandi);
    document.body.append(box);
    schermoAcceso(true);

    let t0 = Date.now(), fermoDa = null, fermoTot = 0, ultimaFase = -1, ultimoBip = -1, finito = false, annunciata = null;
    const ANTICIPO_VOCE = 0.5;
    let rec = null, pezzi = [], recFine = null, recStato = 'no';   // no | in corso | fatto
    const note = [];   // cosa è successo alla registrazione, per capire un video vuoto
    const diagnosi = () => {
      const tr = stream ? stream.getTracks().map((t) => t.kind + ':' + t.readyState).join(',') : 'nessuna';
      return ['stato ' + recStato, 'pezzi ' + pezzi.length, 'formato ' + ((rec && rec.mimeType) || tipoSupportato() || '?'), 'tracce ' + tr].concat(note).join(' · ');
    };
    const trascorso = () => ((fermoDa ?? Date.now()) - t0 - fermoTot) / 1000;
    const nomeFase = { prep: 'PREPARATI', lavoro: c.modo === 'tempo' ? 'LAVORO' : 'LAVORO', pausa: c.modo === 'tempo' ? 'RECUPERO' : 'PAUSA', giro: 'VIA' };

    function avviaRec() {
      if (!stream || recStato !== 'no') return;
      const tipo = tipoSupportato();
      pezzi = [];
      try { rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 2500000 }); }
      catch (e) { note.push('avvio1 ' + (e.name || e)); try { rec = new MediaRecorder(stream); } catch (x) { note.push('avvio2 ' + (x.name || x)); rec = null; recStato = 'fallito'; return; } }
      recFine = new Promise((ok) => {
        rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) pezzi.push(ev.data); };
        rec.onerror = (ev) => note.push('errore ' + ((ev.error && ev.error.name) || 'sconosciuto'));
        rec.onstop = () => ok(new Blob(pezzi, { type: rec.mimeType || tipo || 'video/mp4' }));
      });
      try { rec.start(1000); } catch (e) { note.push('start ' + (e.name || e)); rec = null; recFine = null; recStato = 'fallito'; return; }
      recStato = 'in corso';
      elRec.classList.remove('nascosto');
    }
    function fermaRec() {
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* ignora */ } }
      if (recStato === 'in corso') recStato = 'fatto';
      elRec.classList.add('nascosto');
    }

    function tick() {
      if (finito) return;
      const e = trascorso();
      if (stream && fermoDa == null) {
        if (recStato === 'no' && e >= recDa) avviaRec();
        if (recStato === 'in corso' && e >= recA) fermaRec();
      }
      if (e >= totaleS) {
        if (ultimaFase !== -2) { ultimaFase = -2; if (annunciata !== -2) annuncia('fine'); }
        // con la fotocamera aspetta il secondo di margine prima di chiudere
        if (!stream || recStato !== 'in corso') return termina(true);
        elFase.textContent = 'FINITO'; elCifre.textContent = '0'; return;
      }
      const k = F.findIndex((f) => e < f.a);
      const f = F[k];
      const resto = f.a - e;
      // voce registrata: si programma al centesimo un attimo prima del cambio di fase;
      // voce del telefono: parte con un po' di ritardo, quindi l'avviso si dà mezzo secondo prima
      const prossima = F[k + 1];
      const anticipo = c.avvisi === 'registrata' && clipPronte() ? 0.3
        : (c.avvisi === 'voce' || c.avvisi === 'registrata') && haVoce() && vocePartita !== false ? ANTICIPO_VOCE : -1;
      if (prossima && resto <= anticipo && annunciata !== k + 1) {
        annunciata = k + 1;
        if (prossima.tipo === 'lavoro' || prossima.tipo === 'giro') annuncia('lavoro', resto);
        else if (prossima.tipo === 'pausa') annuncia('pausa', resto);
      }
      if (!prossima && resto <= anticipo && annunciata !== -2) {
        annunciata = -2; annuncia('fine', resto);
      }
      if (k !== ultimaFase) {
        const giaDetta = annunciata === k;
        ultimaFase = k; ultimoBip = -1;
        box.className = 'tm-corsa f-' + f.tipo + (stream ? ' con-cam' : '');
        elFase.textContent = nomeFase[f.tipo];
        elGiro.textContent = f.tipo === 'prep' ? descrizione(c)
          : (c.modo === 'emom' ? 'Giro ' : c.modo === 'tempo' ? 'Serie ' : 'Giro ') + f.giro + ' di ' + nGiri(c);
        if (!giaDetta) {
          if (f.tipo === 'lavoro' || f.tipo === 'giro') annuncia('lavoro');
          else if (f.tipo === 'pausa') annuncia('pausa');
        }
      }
      elCifre.textContent = cifre(resto);
      const sec = Math.ceil(resto);
      if (sec <= 3 && sec >= 1 && sec !== ultimoBip) { ultimoBip = sec; bip(880, 0.12, 0.5); }
    }
    function annuncia(tipo, tra = 0) {
      // 1) voce registrata, al secondo esatto
      if (c.avvisi === 'registrata' && clipPronte()) {
        if (tipo === 'lavoro') suonaClip('start', tra);
        else if (tipo === 'pausa') suonaClip('rest', tra + suonaClip('stop', tra) + PAUSA_STOP_REST);
        else if (tipo === 'fine') suonaClip('completato', tra + suonaClip('stop', tra) + 0.3);
        return;
      }
      // 2) voce del telefono (anche come riserva se la registrata non è caricata);
      // se la voce non è partita l'ultima volta si va subito di bip, per non suonare in ritardo
      const conVoce = (c.avvisi === 'voce' || c.avvisi === 'registrata') && haVoce() && vocePartita !== false;
      const bL = () => bip(1320, 0.45, 0.7), bP = () => bip(660, 0.45, 0.6), bF = () => bip(1320, 0.9, 0.7);
      if (tipo === 'lavoro') { if (!(conVoce && parla('Start', 'en-US', true, bL))) bL(); }
      else if (tipo === 'pausa') { if (!(conVoce && parla('Stop. Rest.', 'en-US', true, bP))) bP(); }
      else if (tipo === 'fine') {
        if (conVoce && parla('Stop.', 'en-US', true, bF)) parla('Completato!', 'it-IT');
        else bF();
      }
    }
    const intervallo = setInterval(tick, 100);
    tick();

    bPausa.addEventListener('click', () => {
      if (finito) return;
      if (fermoDa == null) {
        fermoDa = Date.now(); bPausa.textContent = 'Riprendi'; elFase.textContent = 'IN PAUSA';
        if (rec && rec.state === 'recording' && rec.pause) { try { rec.pause(); } catch (e) { /* ignora */ } }
      } else {
        fermoTot += Date.now() - fermoDa; fermoDa = null; bPausa.textContent = 'Pausa'; ultimaFase = -1;
        if (rec && rec.state === 'paused' && rec.resume) { try { rec.resume(); } catch (e) { /* ignora */ } }
        audioPronto(!!stream);
      }
    });
    bStop.addEventListener('click', () => { zittisci(); termina(false); });

    async function termina(completo) {
      if (finito) return;
      finito = true;
      clearInterval(intervallo);
      const e = Math.min(trascorso(), totaleS);
      const fAtt = F.find((f) => e < f.a) || F[F.length - 1];
      const fatti = completo ? nGiri(c) : Math.max(0, fAtt.tipo === 'pausa' ? fAtt.giro : fAtt.giro - 1);
      fermaRec();
      let video = null;
      if (recFine) { try { video = await recFine; } catch (x) { video = null; } }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      audioFine();
      const testo = descrizione(c) + (completo ? ' completato' : ` interrotto (${fatti} di ${nGiri(c)})`);
      schermataFine({ testo, completo, video });
    }

    function schermataFine({ testo, completo, video }) {
      box.className = 'tm-corsa f-fine';
      box.replaceChildren();
      const fine = h('div', { class: 'fine' });
      box.append(fine);
      fine.append(h('h2', { text: completo ? 'Finito! 💪' : 'Timer fermato' }), h('p', { class: 'sotto', text: testo }));
      const chiudiTutto = () => {
        zittisci(); box.remove(); alChiudi();
        if (stato.vista !== 'allenamento') schermoAcceso(false);
      };
      if (i != null && stato.sess) {
        const d = stato.sess.es[i];
        const bRes = h('button', { class: 'btn', type: 'button', text: 'Segna nel resoconto', onclick: () => {
          d.note = d.note ? d.note + '; ' + testo : testo; salvaSess(); alResoconto();
          bRes.disabled = true; bRes.textContent = '✓ Segnato nelle note dell\'esercizio';
        } });
        fine.append(bRes);
      }
      if (video && video.size && i != null && stato.sess) {
        // il video si salva subito sull'esercizio (prima serviva toccare «Tieni questo video» e si perdeva chiudendo)
        const url = URL.createObjectURL(video);
        const esitoSalva = h('p', { class: 'sotto', style: 'font-weight:700', text: 'Salvo il video…' });
        fine.append(esitoSalva, h('video', { src: url, controls: true, playsinline: true }));
        salvaVideo(i, video, video.type).then(() => {
          alVideo();
          esitoSalva.textContent = '✓ Video dell\'ultimo giro salvato sull\'esercizio: dopo «Chiudi» lo trovi lì, pronto da inviare.';
          const bScarta = h('button', { class: 'btn', type: 'button', text: 'Non va bene, scartalo', onclick: async () => {
            stato.video.delete(i);
            try { await DB.del('video', stato.sess.id + ':' + i); } catch (e) { /* ignora */ }
            alVideo(); URL.revokeObjectURL(url);
            bScarta.disabled = true; bScarta.textContent = 'Video scartato: puoi rifarlo dall\'esercizio';
            esitoSalva.textContent = '';
          } });
          esitoSalva.after(bScarta);
        }).catch(() => { esitoSalva.textContent = '✗ Non sono riuscito a salvare il video sul telefono.'; });
      } else if (stream && !completo && recStato === 'no') {
        fine.append(h('p', { class: 'sotto', text: 'Il video non è stato registrato: il timer si è fermato prima dell\'ultimo giro.' }));
      } else if (stream) {
        // la fotocamera era aperta ma il video è vuoto: lo si dice, con i dettagli per capire il perché
        fine.append(h('p', { class: 'sotto', style: 'font-weight:700', text: '✗ Il video non è venuto: il telefono non ha registrato nulla. Puoi filmarlo dall\'esercizio come al solito.' }),
          h('p', { class: 'sotto', text: 'Dettagli per Claude: ' + diagnosi() }));
      }
      fine.append(h('div', { class: 'spazio' }), h('button', { class: 'btn ok', type: 'button', text: 'Chiudi', onclick: chiudiTutto }));
    }
  }

  // per le prove
  window.__timer = { secondiDa, serieDa, fasi, descrizione, proposta, voce };
})();
