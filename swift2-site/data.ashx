<%@ WebHandler Language="C#" Class="DataHandler" %>
using System;
using System.IO;
using System.Text;
using System.Web;
using System.Threading;
using System.Security.Cryptography;

public class DataHandler : IHttpHandler
{
    // بيانات الدخول (محفوظة على السيرفر فقط، ما بتظهر للمتصفح)
    const string USERNAME = "aboalaa";
    const string PASSWORD = "abualaa@123";

    const int SESSION_HOURS = 12;

    static readonly object Lock = new object();
    static byte[] secretKey;

    public void ProcessRequest(HttpContext ctx)
    {
        ctx.Response.ContentEncoding = Encoding.UTF8;
        ctx.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        try
        {
            string action = ctx.Request.QueryString["action"];

            if (action == "login" && ctx.Request.HttpMethod == "POST")
            {
                DoLogin(ctx);
                return;
            }
            if (action == "logout")
            {
                HttpCookie dead = new HttpCookie(CookieName(ctx), "");
                dead.Expires = DateTime.UtcNow.AddDays(-1);
                dead.Path = CookiePath(ctx);
                dead.HttpOnly = true;
                ctx.Response.Cookies.Add(dead);
                ctx.Response.ContentType = "application/json";
                ctx.Response.Write("{\"ok\":true}");
                return;
            }

            // أي طلب بيانات يحتاج تسجيل دخول
            if (!IsAuthenticated(ctx))
            {
                ctx.Response.StatusCode = 401;
                ctx.Response.ContentType = "text/plain";
                ctx.Response.Write("unauthorized");
                return;
            }

            string dir = ctx.Server.MapPath("~/App_Data");
            string path = Path.Combine(dir, "data.json");
            lock (Lock)
            {
                if (ctx.Request.HttpMethod == "POST")
                {
                    string body;
                    using (StreamReader sr = new StreamReader(ctx.Request.InputStream, Encoding.UTF8))
                        body = sr.ReadToEnd();
                    if (string.IsNullOrWhiteSpace(body) || body.Length > 5000000)
                    {
                        ctx.Response.StatusCode = 400;
                        ctx.Response.ContentType = "text/plain";
                        ctx.Response.Write("empty or too large body");
                        return;
                    }
                    if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                    File.WriteAllText(path, body, new UTF8Encoding(false));
                    ctx.Response.ContentType = "application/json";
                    ctx.Response.Write("{\"ok\":true}");
                }
                else
                {
                    ctx.Response.ContentType = "application/json";
                    if (File.Exists(path))
                        ctx.Response.Write(File.ReadAllText(path, Encoding.UTF8));
                }
            }
        }
        catch (Exception ex)
        {
            ctx.Response.StatusCode = 500;
            ctx.Response.ContentType = "text/plain";
            ctx.Response.Write(ex.GetType().Name + ": " + ex.Message);
        }
    }

    void DoLogin(HttpContext ctx)
    {
        string u = ctx.Request.Form["u"] ?? "";
        string p = ctx.Request.Form["p"] ?? "";
        bool ok = SafeEquals(u, USERNAME) & SafeEquals(p, PASSWORD);
        if (!ok)
        {
            Thread.Sleep(1200); // إبطاء محاولات التخمين
            ctx.Response.StatusCode = 401;
            ctx.Response.ContentType = "text/plain";
            ctx.Response.Write("bad credentials");
            return;
        }
        string payload = DateTime.UtcNow.AddHours(SESSION_HOURS).Ticks.ToString();
        string token = payload + "." + Sign(ctx, payload);
        HttpCookie c = new HttpCookie(CookieName(ctx), token);
        c.HttpOnly = true;
        c.Path = CookiePath(ctx);
        ctx.Response.Cookies.Add(c);
        ctx.Response.ContentType = "application/json";
        ctx.Response.Write("{\"ok\":true}");
    }

    // اسم الكوكي يختلف لكل موقع حتى ما يعمل الموقعين تسجيل خروج لبعض
    static string CookieName(HttpContext ctx)
    {
        using (SHA256 sha = SHA256.Create())
        {
            byte[] d = sha.ComputeHash(Encoding.UTF8.GetBytes(ctx.Server.MapPath("~/").ToLower()));
            return "auth_" + BitConverter.ToString(d, 0, 4).Replace("-", "").ToLower();
        }
    }

    static string CookiePath(HttpContext ctx)
    {
        string p = ctx.Request.ApplicationPath;
        return string.IsNullOrEmpty(p) ? "/" : p;
    }

    bool IsAuthenticated(HttpContext ctx)
    {
        HttpCookie c = ctx.Request.Cookies[CookieName(ctx)];
        if (c == null || string.IsNullOrEmpty(c.Value)) return false;
        string[] parts = c.Value.Split('.');
        if (parts.Length != 2) return false;
        if (!SafeEquals(parts[1], Sign(ctx, parts[0]))) return false;
        long ticks;
        if (!long.TryParse(parts[0], out ticks)) return false;
        return ticks > DateTime.UtcNow.Ticks;
    }

    static byte[] GetKey(HttpContext ctx)
    {
        lock (Lock)
        {
            if (secretKey != null) return secretKey;
            string dir = ctx.Server.MapPath("~/App_Data");
            string keyPath = Path.Combine(dir, "auth.key");
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            if (File.Exists(keyPath))
            {
                secretKey = File.ReadAllBytes(keyPath);
            }
            else
            {
                byte[] k = new byte[32];
                using (RandomNumberGenerator rng = RandomNumberGenerator.Create())
                    rng.GetBytes(k);
                File.WriteAllBytes(keyPath, k);
                secretKey = k;
            }
            return secretKey;
        }
    }

    static string Sign(HttpContext ctx, string payload)
    {
        using (HMACSHA256 h = new HMACSHA256(GetKey(ctx)))
        {
            byte[] sig = h.ComputeHash(Encoding.UTF8.GetBytes(payload));
            StringBuilder sb = new StringBuilder();
            foreach (byte b in sig) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }

    static bool SafeEquals(string a, string b)
    {
        byte[] x = Encoding.UTF8.GetBytes(a ?? "");
        byte[] y = Encoding.UTF8.GetBytes(b ?? "");
        int diff = x.Length ^ y.Length;
        for (int i = 0; i < x.Length && i < y.Length; i++) diff |= x[i] ^ y[i];
        return diff == 0;
    }

    public bool IsReusable { get { return false; } }
}
