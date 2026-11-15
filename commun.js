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
  /** 20 questions tirées dans les banques (selon « tirage ») + 1 question bonus. Les réponses sont mélangées. */
  function tirer(tirage, banques, alea) {
    let qs = [];
    Object.entries(tirage).forEach(([nom, n]) => { qs = qs.concat(melanger(banques[nom], alea).slice(0, n)); });
    qs = melanger(qs, alea);
    const bonus = melanger(banques.BONUS, alea)[0];
    return [...qs, { ...bonus, bonus: true }].map(q => ({ id: q.id, q: q.q, x: q.x, bonus: !!q.bonus, bonne: q.c[0], choix: melanger(q.c, alea) }));
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
