export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Android box'tan veri yükleme: PUT /yukle/digiturk-YYYY-MM-DD veya /yukle/dsmart-YYYY-MM-DD
    if (url.pathname.startsWith("/yukle/")) {
      if (request.method !== "PUT") return new Response("Yalnizca PUT", { status: 405 });
      const anahtar = url.pathname.slice("/yukle/".length);
      if (!/^(digiturk|dsmart)-\d{4}-\d{2}-\d{2}$/.test(anahtar)) {
        return new Response("Gecersiz anahtar", { status: 400 });
      }
      const sifre = await env.EPG.get("yukleme-sifresi");
      if (!sifre || request.headers.get("X-Yukleme-Sifresi") !== sifre) {
        return new Response("Yetkisiz", { status: 401 });
      }
      const govde = await request.arrayBuffer();
      if (govde.byteLength < 1000 || govde.byteLength > 20 * 1024 * 1024) {
        return new Response("Gecersiz boyut", { status: 413 });
      }
      await env.EPG.put(anahtar, govde, { expirationTtl: 10 * 24 * 3600 });
      return new Response(`Kaydedildi: ${anahtar} (${govde.byteLength} bayt)`);
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
