/* Fonctions communes aux pages élève et professeur. */
window.P = (() => {
  const URL_SERVEUR = (window.CONFIG && CONFIG.url) || "";
  const DEMO = !URL_SERVEUR;
  const local = {
    lire(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    suppr(k) { try { localStorage.removeItem(k); } catch {} }
  };
  async function get(params) {
    const r = await fetch(URL_SERVEUR + "?" + new URLSearchParams(params), { cache: "no-store" });
    return r.json();
  }
  async function post(obj) {
    const r = await fetch(URL_SERVEUR, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(obj) });
    return r.json();
  }
  const session = () => local.lire("philo:session", null);
  const ouvrir = s => local.ecrire("philo:session", s);
  const quitter = () => { local.suppr("philo:session"); location.href = "index.html"; };

  /* Hasard reproductible (même tirage pour un élève donné sur un quiz noté). */
  function graine(t) { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function generateur(g) {
    return () => { g = (g + 0x6D2B79F5) >>> 0; let t = g; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function melanger(liste, alea) {
    const a = [...liste];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /* Formulations variées : chaque question peut être posée sous 3 formes, tirées au hasard à chaque essai.
     1. directe (telle qu'écrite) ; 2. inverse (définition/thèse/œuvre → concept/auteur) ;
     3. association (concept/auteur → bonne définition/thèse parmi d'autres, vraies mais d'autres concepts/auteurs). */
  const MODELES = {
    concept: { inv: ["Quel concept correspond à cette définition : « {e} » ?", "De quel concept s'agit-il : « {e} » ?", "Comment appelle-t-on : « {e} » ?"],
               asso: ["Quelle est la définition de : {n} ?", "Laquelle de ces propositions définit : {n} ?"] },
    auteur:  { inv: ["Quel auteur défend cette thèse : « {e} » ?", "Qui soutient l'idée suivante : « {e} » ?", "À quel philosophe doit-on cette idée : « {e} » ?"],
               asso: ["Laquelle de ces thèses est défendue par {n} ?", "Quelle idée {n} soutient-il dans le cours ?"] },
    oeuvre:  { inv: ["Qui est l'auteur de {e} ?", "Quel philosophe a écrit {e} ?"],
               asso: ["Laquelle de ces œuvres a été écrite par {n} ?", "Quelle œuvre de {n} est étudiée dans le cours ?"] },
    partie:  { inv: ["À quel moment de la leçon correspond l'idée : « {e} » ?", "Où se trouve cette idée dans le plan de la leçon : « {e} » ?"], asso: [] }
  };
  const maj = t => t.charAt(0).toUpperCase() + t.slice(1);
  const minu = t => /^(Le|La|Les|Une|Un|L')[ ']?/.test(t) && !/^L'[A-Z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  function formuler(q, pool, alea) {
    const base = { id: q.id, q: q.q, x: q.x, bonne: q.c[0], choix: melanger(q.c, alea) };
    const f = q.f; if (!f || !MODELES[f.t]) return base;
    const m = MODELES[f.t], formes = ["directe", "inverse"].concat(m.asso.length ? ["asso"] : []);
    const forme = formes[Math.floor(alea() * formes.length)];
    if (forme === "directe") return base;
    const memeType = t => f.t === "oeuvre" || f.t === "auteur" ? (t === "auteur" || t === "oeuvre") : t === f.t;
    const choisir = l => l[Math.floor(alea() * l.length)];
    const expl = `${maj(f.n)} : « ${f.e} ». ${q.x || ""}`;
    if (forme === "inverse") {
      const noms = [...new Set(pool.filter(p => memeType(p.t) && p.n !== f.n).map(p => p.n))];
      if (noms.length < 3) return base;
      const bonne = maj(f.n), autres = melanger(noms, alea).slice(0, 3).map(maj);
      return { id: q.id, q: choisir(m.inv).replace("{e}", f.e).replace("{n}", f.n), x: expl, bonne, choix: melanger([bonne, ...autres], alea) };
    }
    const enonces = [...new Set(pool.filter(p => p.t === f.t && p.n !== f.n).map(p => p.e))].filter(e => e !== f.e);
    if (enonces.length < 3) return base;
    return { id: q.id, q: choisir(m.asso).replace("{n}", minu(f.n)).replace("{e}", f.e), x: expl, bonne: f.e, choix: melanger([f.e, ...melanger(enonces, alea).slice(0, 3)], alea) };
  }
  /** 20 questions tirées dans les banques (selon « tirage ») + 1 question bonus, chacune sous une forme tirée au hasard. */
  function tirer(tirage, banques, alea) {
    const pool = Object.values(banques).flat().filter(q => q.f).map(q => q.f);
    let qs = [];
    Object.entries(tirage).forEach(([nom, n]) => { qs = qs.concat(melanger(banques[nom], alea).slice(0, n)); });
    qs = melanger(qs, alea);
    const bonus = melanger(banques.BONUS, alea)[0];
    return [...qs.map(q => ({ ...formuler(q, pool, alea), bonus: false })), { id: bonus.id, q: bonus.q, x: bonus.x, bonus: true, bonne: bonus.c[0], choix: melanger(bonus.c, alea) }];
  }
  /** Note : 1 point par bonne réponse sur les 20 questions, + 1 point si le bonus est juste, plafonnée à 20. */
  function corriger(questions, reponses) {
    let bonnes = 0, bonus = false; const faux = [];
    questions.forEach(q => {
      const ok = reponses[q.id] === q.bonne;
      if (q.bonus) bonus = ok; else if (ok) bonnes++; else faux.push(q.id);
    });
    return { bonnes, bonus, note20: Math.min(20, bonnes + (bonus ? 1 : 0)), faux };
  }
  async function dechiffrer(meta, cle) {
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const k = await crypto.subtle.importKey("raw", b64(cle), "AES-GCM", false, ["decrypt"]);
    const clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(meta.iv) }, k, b64(meta.donnees));
    return JSON.parse(new TextDecoder().decode(clair));
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const virgule = n => String(n).replace(".", ",");
  return { URL_SERVEUR, DEMO, local, get, post, session, ouvrir, quitter, graine, generateur, melanger, tirer, corriger, dechiffrer, esc, virgule };
})();
