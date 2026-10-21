// تسجيل الدخول / الخروج / تغيير اسم المستخدم وكلمة المرور
const crypto = require('crypto');
const { getSessionUser, setSession, clearSession, safeEqual } = require('./_lib/session');
const github = require('./_lib/github');

const CREDS_PATH = process.env.CREDS_PATH || 'data/creds.json';

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function readForm(req) {
  let b = req.body;
  if (typeof b === 'string') b = Object.fromEntries(new URLSearchParams(b));
  return b || {};
}

function hashPw(password, saltB64) {
  return crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), 32).toString('base64');
}

// يتحقق من البيانات: ملف creds.json في مستودع البيانات إن وُجد، وإلا متغيرات البيئة
async function checkCreds(u, p) {
  const f = await github.readFile(CREDS_PATH);
  if (f.text) {
    const c = JSON.parse(f.text);
    const okUser = safeEqual(u, c.user);
    const okPass = safeEqual(hashPw(p, c.salt), c.hash);
    return okUser && okPass;
  }
  const envUser = process.env.APP_USER;
  const envPass = process.env.APP_PASS;
  if (!envUser || !envPass) throw new Error('APP_USER و APP_PASS غير مضبوطين في إعدادات Vercel');
  return safeEqual(u, envUser) && safeEqual(p, envPass);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || '';
  try {
    if (action === 'login' && req.method === 'POST') {
      const form = readForm(req);
      const u = String(form.u || '').trim();
      const p = String(form.p || '');
      if (await checkCreds(u, p)) {
        setSession(req, res, u);
        res.status(200).json({ ok: true, user: u });
      } else {
        await sleep(1200); // إبطاء محاولات التخمين
        res.status(401).json({ error: 'bad credentials' });
      }
      return;
    }

    if (action === 'logout') {
      clearSession(req, res);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'changecreds' && req.method === 'POST') {
      const sessionUser = getSessionUser(req);
      if (!sessionUser) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const form = readForm(req);
      const cur = String(form.cur || '');
      const u = String(form.u || '').trim();
      const p = String(form.p || '');
      if (u.length < 3 || p.length < 6) {
        res.status(400).json({ error: 'اسم المستخدم 3 أحرف على الأقل وكلمة المرور 6 على الأقل' });
        return;
      }
      if (!(await checkCreds(sessionUser, cur))) {
        await sleep(1200);
        res.status(403).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        return;
      }
      const salt = crypto.randomBytes(16).toString('base64');
      const text = JSON.stringify({ user: u, salt: salt, hash: hashPw(p, salt) }, null, 2);
      for (let attempt = 0; attempt < 2; attempt++) {
        const f = await github.readFile(CREDS_PATH);
        const r = await github.writeFile(CREDS_PATH, text, f.sha, 'تحديث بيانات الدخول');
        if (!r.conflict) {
          setSession(req, res, u);
          res.status(200).json({ ok: true, user: u });
          return;
        }
      }
      res.status(409).json({ error: 'تعذر الحفظ بسبب تعارض، حاول مرة أخرى' });
      return;
    }

    res.status(404).json({ error: 'not found' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'server error' });
  }
};
