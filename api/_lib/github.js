// قراءة وكتابة ملفات داخل مستودع GitHub (مستودع البيانات الخاص)
const API = 'https://api.github.com';

function cfg() {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    throw new Error('GITHUB_REPO و GITHUB_TOKEN غير مضبوطين في إعدادات Vercel');
  }
  return { repo: repo, token: token, branch: process.env.GITHUB_BRANCH || 'main' };
}

function gh(path, opts) {
  opts = opts || {};
  const c = cfg();
  return fetch(API + path, {
    method: opts.method || 'GET',
    body: opts.body,
    headers: {
      Authorization: 'Bearer ' + c.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'safi-swift-tracker',
      'Content-Type': 'application/json'
    }
  });
}

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

// يرجع { sha, text } ، وإذا الملف غير موجود: { sha: null, text: null }
async function readFile(path) {
  const c = cfg();
  const r = await gh('/repos/' + c.repo + '/contents/' + encodePath(path) + '?ref=' + encodeURIComponent(c.branch));
  if (r.status === 404) return { sha: null, text: null };
  if (!r.ok) {
    throw new Error('فشلت قراءة الملف من GitHub (' + r.status + '): ' + (await r.text()).slice(0, 200));
  }
  const j = await r.json();
  if (Array.isArray(j) || j.type !== 'file') throw new Error('المسار ليس ملفاً: ' + path);
  let b64 = j.content;
  if (!b64) {
    // الملفات الأكبر من 1MB تُقرأ عبر blob API
    const b = await gh('/repos/' + c.repo + '/git/blobs/' + j.sha);
    if (!b.ok) throw new Error('فشلت قراءة الملف الكبير من GitHub (' + b.status + ')');
    b64 = (await b.json()).content;
  }
  return { sha: j.sha, text: Buffer.from(b64, 'base64').toString('utf8') };
}

// يكتب الملف. sha = النسخة التي بنى عليها المستخدم تعديله (أو null لإنشاء ملف جديد)
// يرجع { sha } عند النجاح، أو { conflict: true } إذا تغيّر الملف من شخص آخر
async function writeFile(path, text, sha, message) {
  const c = cfg();
  const body = {
    message: message || 'update data',
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch: c.branch
  };
  if (sha) body.sha = sha;
  const r = await gh('/repos/' + c.repo + '/contents/' + encodePath(path), {
    method: 'PUT',
    body: JSON.stringify(body)
  });
  if (r.status === 409 || r.status === 422) return { conflict: true };
  if (!r.ok) {
    throw new Error('فشل الحفظ في GitHub (' + r.status + '): ' + (await r.text()).slice(0, 200));
  }
  const j = await r.json();
  return { sha: j.content.sha };
}

module.exports = { readFile, writeFile };
