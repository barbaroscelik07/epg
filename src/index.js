export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GECICI TEST: Digiturk'e Cloudflare uzerinden erisilebiliyor mu?
    if (url.pathname === "/test-digiturk") {
      const t = new Date();
      const gun = `${String(t.getUTCMonth() + 1).padStart(2, "0")}/${String(t.getUTCDate()).padStart(2, "0")}/${t.getUTCFullYear()}`;
      const hedef = `https://www.digiturk.com.tr/Ajax/GetTvGuideFromDigiturk?Day=${encodeURIComponent(gun)}+00%3A00%3A00`;
      try {
        const r = await fetch(hedef, {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
          },
        });
        const metin = await r.text();
        const kanal = (metin.match(/channelDetail/g) || []).length;
        return new Response(
          `Durum: ${r.status}\nBoyut: ${metin.length} karakter\nProgram kaydi: ${kanal}\nCloudflare merkezi: ${request.cf && request.cf.colo}\n\nIlk 300 karakter:\n${metin.slice(0, 300)}`,
          { headers: { "content-type": "text/plain; charset=utf-8" } }
        );
      } catch (e) {
        return new Response(`Hata: ${e.message}`, { status: 500 });
      }
    }

    const dosya = await env.EPG.get("guide.xml", { type: "stream" });
    if (!dosya) {
      return new Response("EPG dosyasi bulunamadi", { status: 404 });
    }
    return new Response(dosya, {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  },
};
