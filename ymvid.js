// ==MiruExtension==
// @name         通用解析引擎·稳定版
// @version      v1.0.0
// @author       Omar
// @lang         zh-tw
// @license      MIT
// @type         bangumi
// @webSite      https://example.com
// @package      universal-parser
// @icon         https://example.com/favicon.ico
// @nsfw         false
// ==/MiruExtension==

export default class extends Extension {

  sites = [
    "https://www.ymvid.com",
    "https://agedm.org",
    "https://yhdm.site"
  ];

  currentSite = "";

  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept-Language": "zh-CN,zh;q=0.9"
  };

  async req(url, referer) {
    return await this.request(url, {
      headers: {
        ...this.headers,
        Referer: referer || "",
        Origin: referer || ""
      },
      timeout: 8000
    });
  }

  // ===== 首页（简单通用）=====
  async latest(page) {
    for (let site of this.sites) {
      try {
        const url = `${site}`;
        const res = await this.req(url, site);

        const list = res.match(/href="(.*?)".*?title="(.*?)"/g) || [];

        if (list.length) {
          this.currentSite = site;

          return list.slice(0, 20).map(i => ({
            title: i.match(/title="(.*?)"/)?.[1] || "未知",
            pic: "",
            url: i.match(/href="(.*?)"/)?.[1] || ""
          })).filter(i => i.url);
        }

      } catch {}
    }

    throw new Error("全部站点失败");
  }

  // ===== 搜索（弱通用）=====
  async search(kw, page) {
    const key = encodeURIComponent(kw || "");

    for (let site of this.sites) {
      try {
        const url = `${site}/search/${key}`;
        const res = await this.req(url, site);

        const list = res.match(/href="(.*?)".*?title="(.*?)"/g) || [];

        if (list.length) {
          this.currentSite = site;

          return list.map(i => ({
            title: i.match(/title="(.*?)"/)?.[1] || "未知",
            pic: "",
            url: i.match(/href="(.*?)"/)?.[1] || ""
          })).filter(i => i.url);
        }

      } catch {}
    }

    return [];
  }

  // ===== 详情（极简通用）=====
  async detail(url) {
    const full = url.startsWith("http")
      ? url
      : this.currentSite + url;

    const res = await this.req(full, this.currentSite);

    const title = res.match(/<h1.*?>(.*?)<\/h1>/)?.[1] || "未知";

    // 👉 通用：抓所有 a 当播放列表
    const links = res.match(/<a href="(.*?)".*?>(.*?)<\/a>/g) || [];

    const urls = links.map(l => {
      const m = l.match(/href="(.*?)".*?>(.*?)<\/a>/);
      return {
        name: m?.[2]?.replace(/<.*?>/g, "") || "播放",
        url: m?.[1] || ""
      };
    }).filter(i => i.url);

    return {
      title,
      desc: "",
      episodes: [{
        title: "播放列表",
        urls: urls.slice(0, 30)
      }]
    };
  }

  // ===== 通用解析核心 =====
  async extractVideo(html, base) {

    // 1️⃣ 直接抓 m3u8
    let m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/);
    if (m3u8) return m3u8[0];

    // 2️⃣ 抓 mp4
    let mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/);
    if (mp4) return mp4[0];

    // 3️⃣ player JSON（MacCMS）
    let player = html.match(/player_.*?=\s*(\{[\s\S]*?\})/);
    if (player) {
      try {
        let obj = JSON.parse(player[1]);
        let u = obj?.url || "";

        if (u.includes(".m3u8") || u.includes(".mp4")) return u;

        // 可能是解析页
        if (u.startsWith("http")) {
          try {
            let html2 = await this.req(u, base);
            let m = html2.match(/https?:\/\/.*?\.m3u8/);
            if (m) return m[0];
          } catch {}
        }

      } catch {}
    }

    // 4️⃣ iframe 二跳
    let iframe = html.match(/<iframe.*?src="(.*?)"/);
    if (iframe) {
      let src = iframe[1] || "";
      if (!src.startsWith("http")) {
        src = base + src;
      }

      try {
        let html2 = await this.req(src, base);
        let m = html2.match(/https?:\/\/.*?\.m3u8/);
        if (m) return m[0];
      } catch {}
    }

    return null;
  }

  // ===== 播放 =====
  async watch(url) {

    let full = url.startsWith("http")
      ? url
      : this.currentSite + url;

    try {
      const html = await this.req(full, this.currentSite);

      // 多策略解析
      const video = await this.extractVideo(html, this.currentSite);

      if (video) {
        return {
          type: video.includes(".m3u8") ? "hls" : "mp4",
          url: video,
          headers: {
            Referer: this.currentSite,
            Origin: this.currentSite
          }
        };
      }

    } catch {}

    throw new Error("解析失败");
  }
}
