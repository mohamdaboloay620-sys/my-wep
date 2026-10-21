// إدارة الجلسات: كوكي موقّع (HMAC) بدون أي قاعدة بيانات
const crypto = require('crypto');

const COOKIE_NAME = 'safi_session';
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET غير مضبوط (يجب أن يكون 16 حرف على الأقل)');
  }
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

// مقارنة آمنة ضد هجمات التوقيت
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const hb = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function makeToken(user) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = exp + '.' + Buffer.from(String(user), 'utf8').toString('base64url');
  return payload + '.' + sign(payload);
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

// يرجع اسم المستخدم إذا كانت الجلسة صالحة، وإلا null
function getSessionUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[0] + '.' + parts[1];
  if (!safeEqual(parts[2], sign(payload))) return null;
  if (!(Number(parts[0]) > Date.now())) return null;
  try {
    return Buffer.from(parts[1], 'base64url').toString('utf8');
  } catch (e) {
    return null;
  }
}

function cookieFlags(req) {
  const https = (req.headers['x-forwarded-proto'] || '').indexOf('https') === 0;
  return 'HttpOnly; SameSite=Strict; Path=/' + (https ? '; Secure' : '');
}

function setSession(req, res, user) {
  res.setHeader(
    'Set-Cookie',
    COOKIE_NAME + '=' + makeToken(user) + '; Max-Age=' + SESSION_HOURS * 3600 + '; ' + cookieFlags(req)
  );
}

function clearSession(req, res) {
  res.setHeader('Set-Cookie', COOKIE_NAME + '=; Max-Age=0; ' + cookieFlags(req));
}

module.exports = { getSessionUser, setSession, clearSession, safeEqual };
