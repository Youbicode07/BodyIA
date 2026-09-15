const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

/**
 * DONNÉES DE L'UTILISATEUR
 * ========================
 *
 * Tout ce que l'application produit est rangé ici, rattaché à un compte :
 * réponses du questionnaire, programme, analyses corporelles, repas, séances.
 *
 * Deux principes tenus dans chaque route :
 *
 *  1. L'identifiant du compte vient TOUJOURS du jeton de session (`req.user`),
 *     jamais du corps de la requête. Accepter un `userId` envoyé par le
 *     téléphone laisserait n'importe qui lire les données de n'importe qui en
 *     changeant un chiffre.
 *
 *  2. La date de modification arbitre les conflits. L'application fonctionne
 *     hors ligne et rattrape ensuite : si deux versions existent, la plus
 *     récente gagne, et le serveur renvoie toujours celle qu'il a retenue pour
 *     que le téléphone s'aligne dessus.
 */

const router = express.Router();
const newId = () => crypto.randomUUID();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// Profil : les réponses du questionnaire
// ---------------------------------------------------------------------------

router.get('/profile', async (req, res, next) => {
  try {
    const row = await db.get('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
    res.json({
      answers: row ? db.fromJson(row.answers, {}) : null,
      updatedAt: row ? Number(row.updated_at) : 0,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { answers, updatedAt } = req.body || {};
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers_manquant' });
    }

    const incoming = Number(updatedAt) || Date.now();
    const existing = await db.get('SELECT updated_at FROM profiles WHERE user_id = ?', [req.user.id]);

    // La version du serveur est plus récente : on ne l'écrase pas, on la
    // renvoie. C'est le cas d'un téléphone qui rattrape après une coupure
    // alors qu'un autre appareil a déjà enregistré plus récent.
    if (existing && Number(existing.updated_at) > incoming) {
      const row = await db.get('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
      return res.json({
        answers: db.fromJson(row.answers, {}),
        updatedAt: Number(row.updated_at),
        conflict: true,
      });
    }

    if (existing) {
      await db.run('UPDATE profiles SET answers = ?, updated_at = ? WHERE user_id = ?', [
        db.toJson(answers),
        incoming,
        req.user.id,
      ]);
    } else {
      await db.run('INSERT INTO profiles (user_id, answers, updated_at) VALUES (?, ?, ?)', [
        req.user.id,
        db.toJson(answers),
        incoming,
      ]);
    }
    res.json({ answers, updatedAt: incoming, conflict: false });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Programme d'entraînement
// ---------------------------------------------------------------------------

router.get('/program', async (req, res, next) => {
  try {
    const row = await db.get('SELECT * FROM programs WHERE user_id = ?', [req.user.id]);
    res.json({
      program: row ? db.fromJson(row.payload, null) : null,
      updatedAt: row ? Number(row.updated_at) : 0,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/program', async (req, res, next) => {
  try {
    const { program } = req.body || {};
    const now = Date.now();
    const existing = await db.get('SELECT user_id FROM programs WHERE user_id = ?', [req.user.id]);

    if (program === null) {
      await db.run('DELETE FROM programs WHERE user_id = ?', [req.user.id]);
      return res.json({ program: null, updatedAt: now });
    }
    if (!program || typeof program !== 'object') {
      return res.status(400).json({ error: 'program_invalide' });
    }

    if (existing) {
      await db.run('UPDATE programs SET payload = ?, updated_at = ? WHERE user_id = ?', [
        db.toJson(program),
        now,
        req.user.id,
      ]);
    } else {
      await db.run('INSERT INTO programs (user_id, payload, updated_at) VALUES (?, ?, ?)', [
        req.user.id,
        db.toJson(program),
        now,
      ]);
    }
    res.json({ program, updatedAt: now });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Analyses corporelles
// ---------------------------------------------------------------------------

const toAnalysis = (row) => ({
  ...db.fromJson(row.payload, {}),
  id: row.id,
  date: Number(row.created_at),
  summary: row.summary ?? '',
  viewAngle: row.view_angle ?? undefined,
  photoUri: row.photo_uri ?? undefined,
});

router.get('/analyses', async (req, res, next) => {
  try {
    const rows = await db.all(
      'SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id],
    );
    res.json({ analyses: rows.map(toAnalysis) });
  } catch (err) {
    next(err);
  }
});

router.post('/analyses', async (req, res, next) => {
  try {
    const entry = req.body?.analysis;
    if (!entry || typeof entry !== 'object') {
      return res.status(400).json({ error: 'analysis_manquante' });
    }

    // L'application génère déjà un identifiant local : on le réutilise pour
    // qu'un envoi rejoué après une coupure réseau ne crée pas de doublon.
    const id = String(entry.id || newId());
    const existing = await db.get('SELECT id FROM analyses WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    if (existing) return res.json({ analysis: entry, duplicate: true });

    await db.run(
      `INSERT INTO analyses (id, user_id, created_at, summary, view_angle, photo_uri, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        Number(entry.date) || Date.now(),
        entry.summary ?? '',
        entry.viewAngle ?? null,
        entry.photoUri ?? null,
        db.toJson(entry),
      ],
    );
    res.json({ analysis: { ...entry, id }, duplicate: false });
  } catch (err) {
    next(err);
  }
});

router.delete('/analyses', async (req, res, next) => {
  try {
    await db.run('DELETE FROM analyses WHERE user_id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Repas
// ---------------------------------------------------------------------------

const toMeal = (row) => ({
  id: row.id,
  timestamp: Number(row.eaten_at),
  foodName: row.food_name,
  calories: Number(row.calories),
  protein_g: Number(row.protein_g),
  carbs_g: Number(row.carbs_g),
  fats_g: Number(row.fats_g),
  confidence: row.confidence ?? undefined,
  photoUri: row.photo_uri ?? undefined,
});

router.get('/meals', async (req, res, next) => {
  try {
    // 30 jours : assez pour le suivi hebdomadaire affiché, sans renvoyer un
    // historique entier à chaque ouverture de l'application.
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = await db.all(
      'SELECT * FROM meals WHERE user_id = ? AND eaten_at >= ? ORDER BY eaten_at DESC',
      [req.user.id, since],
    );
    res.json({ meals: rows.map(toMeal) });
  } catch (err) {
    next(err);
  }
});

router.post('/meals', async (req, res, next) => {
  try {
    const meal = req.body?.meal;
    if (!meal || typeof meal !== 'object') return res.status(400).json({ error: 'meal_manquant' });

    const id = String(meal.id || newId());
    const existing = await db.get('SELECT id FROM meals WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    if (existing) return res.json({ meal, duplicate: true });

    const num = (value) => Math.max(0, Math.round(Number(value) || 0));
    await db.run(
      `INSERT INTO meals (id, user_id, eaten_at, food_name, calories, protein_g, carbs_g, fats_g, confidence, photo_uri)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        Number(meal.timestamp) || Date.now(),
        String(meal.foodName || 'Repas'),
        num(meal.calories),
        num(meal.protein_g),
        num(meal.carbs_g),
        num(meal.fats_g),
        meal.confidence ?? null,
        meal.photoUri ?? null,
      ],
    );
    res.json({ meal: { ...meal, id }, duplicate: false });
  } catch (err) {
    next(err);
  }
});

router.delete('/meals/:id', async (req, res, next) => {
  try {
    await db.run('DELETE FROM meals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Séances réalisées
// ---------------------------------------------------------------------------

router.get('/workouts', async (req, res, next) => {
  try {
    const rows = await db.all(
      'SELECT * FROM workout_logs WHERE user_id = ? ORDER BY done_at DESC LIMIT 300',
      [req.user.id],
    );
    res.json({ workouts: rows.map((row) => db.fromJson(row.payload, {})) });
  } catch (err) {
    next(err);
  }
});

router.post('/workouts', async (req, res, next) => {
  try {
    const workout = req.body?.workout;
    if (!workout || typeof workout !== 'object') {
      return res.status(400).json({ error: 'workout_manquant' });
    }

    const id = String(workout.id || newId());
    const existing = await db.get('SELECT id FROM workout_logs WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    if (existing) return res.json({ workout, duplicate: true });

    await db.run(
      'INSERT INTO workout_logs (id, user_id, done_at, payload) VALUES (?, ?, ?, ?)',
      [id, req.user.id, Number(workout.date) || Date.now(), db.toJson({ ...workout, id })],
    );
    res.json({ workout: { ...workout, id }, duplicate: false });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Effacement complet (« Refaire mon questionnaire », suppression de compte)
// ---------------------------------------------------------------------------

router.post('/reset', async (req, res, next) => {
  try {
    const { keepAccount = true } = req.body || {};
    await db.run('DELETE FROM analyses WHERE user_id = ?', [req.user.id]);
    await db.run('DELETE FROM workout_logs WHERE user_id = ?', [req.user.id]);
    await db.run('DELETE FROM meals WHERE user_id = ?', [req.user.id]);
    await db.run('DELETE FROM programs WHERE user_id = ?', [req.user.id]);
    await db.run('DELETE FROM profiles WHERE user_id = ?', [req.user.id]);

    // Suppression de compte : l'abonnement part avec, mais le journal des
    // paiements est conservé (obligation comptable, et seule trace en cas de
    // contestation). La colonne user_id y passe simplement à NULL.
    if (!keepAccount) {
      await db.run('DELETE FROM subscriptions WHERE user_id = ?', [req.user.id]);
      await db.run('DELETE FROM users WHERE id = ?', [req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
