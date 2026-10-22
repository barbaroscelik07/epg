export default {
  async fetch(request, env) {
    const dosya = await env.EPG.get("guide.xml", { type: "stream" });
    if (!dosya) {
      return new Response("EPG dosyasi bulunamadi", { status: 404 });
    }
    return new Response(dosya, {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  },
};
