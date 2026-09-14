const crypto = require('crypto');
const { getPlan, CURRENCY } = require('./plans');

/**
 * Prestataire CMI — Centre Monétique Interbancaire (Maroc).
 *
 * CMI ne propose pas d'API pour créer une session : on envoie l'utilisateur
 * vers sa page de paiement au moyen d'un FORMULAIRE signé. Le serveur fabrique
 * ce formulaire, CMI affiche le champ carte sur SA page, puis renvoie le
 * résultat en POST sur notre adresse de retour.
 *
 * Deux différences importantes avec Stripe, qui remontent jusqu'à l'interface :
 *   • pas de prélèvement récurrent : l'accès est vendu par période, et
 *     l'utilisateur doit repayer à l'échéance ;
 *   • pas d'essai gratuit avec carte enregistrée : le paiement est immédiat.
 * L'application lit ces limites dans /api/checkout/config et adapte ses textes,
 * pour ne jamais promettre un renouvellement automatique qui n'existe pas.
 *
 * Signature : algorithme « ver3 » de la plateforme Payten/Asseco utilisée par
 * CMI. Elle protège les deux sens — notre demande de paiement, et la réponse
 * de CMI, qui doit être vérifiée avant de débloquer quoi que ce soit.
 */

const GATEWAY_URL = process.env.CMI_GATEWAY_URL || 'https://payment.cmi.co.ma/fim/est3Dgate';

/** Codes ISO 4217 numériques attendus par CMI. */
const CURRENCY_CODES = { mad: '504', eur: '978', usd: '840' };

const isConfigured = () =>
  Boolean(process.env.CMI_CLIENT_ID && process.env.CMI_STORE_KEY);

/** CMI encaisse en une fois : ni essai, ni renouvellement automatique. */
const capabilities = { trial: false, recurring: false };

/**
 * Échappement imposé par ver3 : les valeurs sont jointes par « | », donc tout
 * « | » ou « \ » présent dans une valeur doit être protégé, sinon deux jeux de
 * paramètres différents produiraient la même signature.
 */
const escapeValue = (value) =>
  String(value === undefined || value === null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');

/**
 * Calcule la signature ver3 : paramètres triés par nom (insensible à la
 * casse), valeurs échappées et jointes par « | », clé secrète ajoutée à la
 * fin, le tout en SHA-512 encodé en base64.
 */
function computeHash(params, storeKey) {
  const names = Object.keys(params)
    // "hash" et "encoding" sont exclus du calcul par la spécification.
    .filter((k) => !['hash', 'encoding'].includes(k.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'en'));

  const joined = names.map((n) => escapeValue(params[n])).join('|');
  const payload = `${joined}|${escapeValue(storeKey)}`;

  return crypto.createHash('sha512').update(payload, 'utf8').digest('base64');
}

/** Montant au format attendu : deux décimales, point comme séparateur. */
const formatAmount = (cents) => (cents / 100).toFixed(2);

/** Identifiant de commande : unique, court, alphanumérique. */
function newOrderId() {
  return `BAI${Date.now().toString(36).toUpperCase()}${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

/**
 * Construit les paramètres signés du formulaire de paiement.
 * Exporté pour être testable sans réseau.
 */
function buildFormParams({ planId, orderId, returnUrl, customerEmail }) {
  const plan = getPlan(planId);
  const currencyCode = CURRENCY_CODES[CURRENCY];
  if (!currencyCode) {
    throw new Error(
      `Devise "${CURRENCY}" non gérée par CMI. Utilise PAYMENT_CURRENCY=mad (ou eur, usd).`,
    );
  }

  const params = {
    clientid: process.env.CMI_CLIENT_ID,
    storetype: '3d_pay_hosting',
    trantype: 'Auth',
    amount: formatAmount(plan.amount),
    currency: currencyCode,
    oid: orderId,
    okUrl: `${returnUrl}/cmi/return`,
    failUrl: `${returnUrl}/cmi/return`,
    callbackUrl: `${returnUrl}/cmi/return`,
    shopurl: returnUrl,
    lang: 'fr',
    // Valeur aléatoire : elle rend chaque signature unique.
    rnd: crypto.randomBytes(12).toString('hex'),
    hashAlgorithm: 'ver3',
    encoding: 'UTF-8',
    refreshtime: '3',
  };

  if (customerEmail) params.email = customerEmail;

  params.hash = computeHash(params, process.env.CMI_STORE_KEY);
  return params;
}

/**
 * Vérifie la réponse renvoyée par CMI.
 *
 * Deux contrôles, tous deux indispensables : la signature (la réponse vient
 * bien de CMI et n'a pas été modifiée) et le code retour (le paiement a
 * réellement été accepté).
 */
function verifyReturn(body) {
  const received = body.HASH || body.hash;
  if (!received) return { valid: false, reason: 'Signature absente de la réponse.' };

  const expected = computeHash(body, process.env.CMI_STORE_KEY);
  if (expected !== received) {
    return { valid: false, reason: 'Signature invalide : réponse non authentifiée.' };
  }

  // "00" est le seul code d'acceptation. Tout le reste est un refus.
  const code = body.ProcReturnCode || body.procreturncode;
  const approved = code === '00' && /approved/i.test(body.Response || '');

  return {
    valid: true,
    approved,
    orderId: body.oid,
    amount: body.amount,
    authCode: body.AuthCode || null,
    reason: approved ? null : body.ErrMsg || `Paiement refusé (code ${code || 'inconnu'}).`,
  };
}

// ---------------------------------------------------------------------------
// Suivi des sessions en cours.
//
// Conservé en mémoire : une session ne vit que le temps du paiement, quelques
// minutes tout au plus. Pour un service à fort trafic ou réparti sur plusieurs
// instances, il faudra le remplacer par une base de données.
// ---------------------------------------------------------------------------
const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000;

function pruneSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

async function createSession({ planId, returnUrl, customerEmail }) {
  if (!isConfigured()) throw new Error('CMI_CLIENT_ID ou CMI_STORE_KEY absente.');
  pruneSessions();

  const plan = getPlan(planId);
  const orderId = newOrderId();

  // returnUrl reçu = ".../checkout/return" ; on garde sa base pour construire
  // les adresses propres à CMI.
  const base = returnUrl.replace(/\/checkout\/return$/, '');

  const params = buildFormParams({
    planId,
    orderId,
    returnUrl: `${base}/checkout`,
    customerEmail,
  });

  sessions.set(orderId, {
    planId,
    createdAt: Date.now(),
    status: 'pending',
    amount: plan.amount,
    customerEmail: customerEmail || null,
    // Conservés pour que la page intermédiaire puisse reposter le formulaire
    // exactement tel qu'il a été signé.
    formParams: params,
  });

  return {
    id: orderId,
    // Page intermédiaire qui poste automatiquement le formulaire vers CMI.
    url: `${base}/checkout/cmi/${orderId}`,
    params,
  };
}

/** Marque une session payée ou refusée, à partir de la réponse de CMI. */
function applyReturn(body) {
  const check = verifyReturn(body);
  const session = sessions.get(body.oid);

  if (!check.valid) return { ...check, session: null };
  if (!session) return { valid: true, approved: false, reason: 'Commande inconnue ou expirée.' };

  if (check.approved) {
    const plan = getPlan(session.planId);
    session.status = 'paid';
    session.paidAt = Date.now();
    // Sans prélèvement récurrent, l'accès est vendu pour une période fixe.
    session.expiresAt = session.paidAt + plan.periodDays * 24 * 60 * 60 * 1000;
    session.authCode = check.authCode;
  } else {
    session.status = 'refused';
    session.reason = check.reason;
  }

  return { ...check, session };
}

async function verifySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { paid: false, reason: 'Commande inconnue ou expirée.' };
  if (session.status !== 'paid') return { paid: false, reason: session.reason || 'Paiement non abouti.' };

  return {
    paid: true,
    planId: session.planId,
    orderId: sessionId,
    amount: session.amount,
    currency: CURRENCY.toUpperCase(),
    // Pas d'essai gratuit chez CMI : le paiement est immédiat.
    trialEndsAt: null,
    expiresAt: session.expiresAt,
    customerEmail: session.customerEmail,
    provider: 'cmi',
  };
}

/** Formulaire auto-soumis vers CMI. */
function renderForm(orderId, params) {
  const fields = Object.entries(params)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${String(value).replace(/"/g, '&quot;')}">`,
    )
    .join('\n    ');

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirection vers le paiement</title>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F6F7FB;color:#0E1016;
      display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
 .card{background:#fff;border-radius:24px;padding:32px;text-align:center;max-width:340px;
       box-shadow:0 10px 40px rgba(14,16,22,.08)}
 p{color:#6B7280;font-size:14px;line-height:1.5}
 button{background:#12B76A;color:#fff;border:0;font-weight:700;font-size:15px;
        padding:14px 24px;border-radius:999px;cursor:pointer}
</style></head><body>
<div class="card">
  <h1 style="font-size:19px;margin:0 0 8px">Paiement sécurisé</h1>
  <p>Redirection vers la page de paiement CMI...</p>
  <form id="cmi" method="post" action="${GATEWAY_URL}" accept-charset="UTF-8">
    ${fields}
    <button type="submit">Continuer</button>
  </form>
</div>
<script>document.getElementById('cmi').submit();</script>
</body></html>`;
}

module.exports = {
  id: 'cmi',
  capabilities,
  isConfigured,
  createSession,
  verifySession,
  // Utilisés par les routes et par les tests.
  applyReturn,
  renderForm,
  buildFormParams,
  computeHash,
  verifyReturn,
  sessions,
};
