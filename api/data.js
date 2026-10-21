// قراءة وحفظ بيانات السويفتات (تتطلب تسجيل دخول)
const { getSessionUser } = require('./_lib/session');
const github = require('./_lib/github');

const DATA_PATH = process.env.DATA_PATH || 'data/swifts.json';
const MAX_BYTES = 3 * 1024 * 1024;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      const f = await github.readFile(DATA_PATH);
      res.status(200).json({ sha: f.sha, data: f.text ? JSON.parse(f.text) : null, user: user });
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      if (!body || !Array.isArray(body.data)) {
        res.status(400).json({ error: 'بيانات غير صالحة' });
        return;
      }
      const text = JSON.stringify(body.data, null, 2);
      if (text.length > MAX_BYTES) {
        res.status(413).json({ error: 'حجم البيانات كبير جداً' });
        return;
      }
      const msg = 'تحديث السويفتات (' + body.data.length + ' سجل) بواسطة ' + user;
      const r = await github.writeFile(DATA_PATH, text, body.baseSha || null, msg);
      if (r.conflict) {
        // شخص آخر عدّل البيانات: نرجّع آخر نسخة ليحدّث المتصفح نفسه
        const f = await github.readFile(DATA_PATH);
        res.status(409).json({ sha: f.sha, data: f.text ? JSON.parse(f.text) : null });
        return;
      }
      res.status(200).json({ sha: r.sha });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'server error' });
  }
};
