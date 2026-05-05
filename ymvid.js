// ==MiruExtension==
// @name         多站聚合·终极版 v4
// @version      v4.0.0
// @author       OmarGPT
// @lang         zh-tw
// @type         bangumi
// ==/MiruExtension==

export default class extends Extension {

  // 🌐 多站池
  sites = [
    "https://www.ymvid.com",
    "https://agedm.org",
    "https://yhdm.site",
    "https://dm84.site",
    "https://mxdm.tv",
    "https://girigirilove.com",
    "https://omofun.tv",
    "https://anime1.me",
    "https://www.zzzfun.one"
  ];

  currentSite = "";
  lastGoodSite = "";

  headers = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    "Accept-Language": "zh-CN,zh;q=0.9",
  };

  // ===== 缓存 =====
  CACHE_KEY = "miru_cache_v4";
  CACHE_TTL = 1000 * 60 * 60 * 6;

  loadCache() {
    try { return JSON.parse(localStorage.getItem(this.CACHE_KEY) || "{}"); }
    catch { return {}; }
  }

  saveCache(c) {
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(c));
  }

  getCache(k) {
    const c = this.loadCache();
    const item = c[k];
    if (!item) return null;

    if (Date.now() - item.ts > this.CACHE_TTL) {
      delete c[k];
      this.saveCache(c);
      return null;
    }
    return item.url;
  }

  setCache(k, url) {
    const c = this.loadCache();
    c[k] = { url, ts: Date.now() };
    this.saveCache(c);
  }

  // ===== CDN评分 =====
  scoreCDN(url) {
    const u = url.toLowerCase();

    if (u.includes("aliyuncs") || u.includes("alicdn")) return -50;
    if (u.includes("myqcloud")) return -40;
    if (u.includes("hwcdn")) return -30;
    if (u.includes("cdn")) return -10;

    if (u.includes("jx.") || u.includes("parse") || u.includes("api"))
      return 100;

    return 0;
  }

  // ===== 请求 =====
  async req(url, site) {
    return await this.request(url, {
      headers: {
        ...this.headers,
        Referer: site,
        Origin: site
      }
    });
  }

  // ===== 多站 fallback =====
  async tryRequest(path) {
    const order = this.lastGoodSite
      ? [this.lastGoodSite, ...this.sites.filter(s => s !== this.lastGoodSite)]
      : this.sites;

    for (let site of order) {
      try {
        const res = await this.req(site + path, site);
        this.currentSite = site;
        this.lastGoodSite = site;
        return res;
      } catch {}
    }
    throw new Error("全部站点失败");
  }

  fixPic(pic) {
    if (!pic) return "";
    if (pic.startsWith("http")) return pic;
    if (pic.startsWith("//")) return "https:" + pic;
    return this.currentSite + pic;
  }

  // ===== 首页 =====
  async latest(page) {
    const res = await this.tryRequest(`/index.php/vod/type/id/1/page/${page}.html`);
    const list = res.match(/module-item[\s\S]*?<\/div>\s*<\/div>/g) || [];

    return list.map(i => ({
      title: i.match(/title="(.*?)"/)?.[1] || "未知",
      pic: this.fixPic(i.match(/data-src="(.*?)"/)?.[1]),
      url: i.match(/href="(.*?)"/)?.[1]
    }));
  }

  // ===== 搜索 =====
  async search(kw, page) {
    const key = encodeURIComponent(kw);
    const res = await this.tryRequest(`/vodsearch/${key}----------${page}---.html`);

    const list = res.match(/module-card-item[\s\S]*?<\/div>\s*<\/div>/g) || [];

    return list.map(i => ({
      title: i.match(/<strong>(.*?)<\/strong>/)?.[1]?.replace(/<.*?>/g, "") || "未知",
      pic: this.fixPic(i.match(/data-src="(.*?)"/)?.[1]),
      url: i.match(/href="(.*?)"/)?.[1]
    }));
  }

  // ===== 详情 =====
  async detail(url) {
    const res = await this.req(this.currentSite + url, this.currentSite);

    const title = res.match(/<h1.*?>(.*?)<\/h1>/)?.[1] || "未知";
    const desc = res.match(/module-info-content([\s\S]*?)<\/div>/)?.[1]?.replace(/<.*?>/g, "").trim();

    const episodes = [];
    const blocks = res.match(/module-play-list-content[\s\S]*?<\/div>/g) || [];

    blocks.forEach((b, i) => {
      const links = b.match(/<a href="(.*?)".*?>(.*?)<\/a>/g) || [];
      episodes.push({
        title: `线路 ${i + 1}`,
        urls: links.map(l => {
          const m = l.match(/href="(.*?)".*?>(.*?)<\/a>/);
          return { name: m?.[2]?.replace(/<.*?>/g, ""), url: m?.[1] };
        })
      });
    });

    return { title, desc, episodes };
  }

  // ===== 选1080P =====
  async pickBestVariant(m3u8) {
    try {
      const text = await this.request(m3u8);
      if (!text.includes("#EXT-X-STREAM-INF")) return m3u8;

      const lines = text.split("\n");
      let variants = [];

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("RESOLUTION")) {
          const h = parseInt(lines[i].match(/x(\d+)/)?.[1] || 0);
          const url = lines[i + 1]?.trim();
          if (url) variants.push({ url, h });
        }
      }

      variants.sort((a, b) => (b.h >= 1080 ? 10000 : b.h) - (a.h >= 1080 ? 10000 : a.h));

      let best = variants[0]?.url;
      if (!best) return m3u8;

      if (!best.startsWith("http")) {
        const base = m3u8.substring(0, m3u8.lastIndexOf("/") + 1);
        best = base + best;
      }

      return best;

    } catch {
      return m3u8;
    }
  }

  // ===== 跳片头 =====
  async skipIntro(m3u8) {
    try {
      const text = await this.request(m3u8);
      const lines = text.split("\n");

      let t = 0, idx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXTINF")) {
          t += parseFloat(lines[i].match(/:(.*?),/)?.[1] || 0);
          if (t >= 10) { idx = i; break; }
        }
      }

      return "data:application/vnd.apple.mpegurl;base64," +
        btoa(lines.slice(0, 3).join("\n") + "\n" + lines.slice(idx).join("\n"));

    } catch {
      return m3u8;
    }
  }

  // ===== 跳片尾 =====
  async skipOutro(m3u8) {
    try {
      const text = await this.request(m3u8);
      const lines = text.split("\n");

      let segs = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXTINF")) {
          const sec = parseFloat(lines[i].match(/:(.*?),/)?.[1] || 0);
          segs.push({ sec, lines: [lines[i], lines[i + 1]] });
        }
      }

      let total = 0, cut = segs.length;
      for (let i = segs.length - 1; i >= 0; i--) {
        total += segs[i].sec;
        if (total >= 25) { cut = i; break; }
      }

      const kept = segs.slice(0, cut).flatMap(s => s.lines);

      return "data:application/vnd.apple.mpegurl;base64," +
        btoa(lines.slice(0, 3).join("\n") + "\n" + kept.join("\n"));

    } catch {
      return m3u8;
    }
  }

  // ===== 播放 =====
  async watch(url) {

    const key = this.currentSite + url;

    const cached = this.getCache(key);
    if (cached) {
      return {
        type: "hls",
        url: cached,
        headers: { Referer: this.currentSite }
      };
    }

    const res = await this.req(this.currentSite + url, this.currentSite);

    const links = res.match(/href="(.*?)"/g) || [];
    const playUrls = links.slice(0, 5).map(l => l.match(/"(.*?)"/)?.[1]);

    const parse = async (p) => {
      try {
        const html = await this.req(this.currentSite + p, this.currentSite);
        const m = html.match(/player_.*?=\s*(\{[\s\S]*?\})/);
        if (!m) return null;

        let u = JSON.parse(m[1]).url;

        if (!u.includes(".m3u8")) {
          const html2 = await this.request(u);
          const m3u8 = html2.match(/https?:\/\/.*?\.m3u8/);
          if (m3u8) u = m3u8[0];
        }

        return u;

      } catch {
        return null;
      }
    };

    let candidates = [];
    for (let p of playUrls) {
      const u = await parse(p);
      if (u) candidates.push(u);
    }

    const results = await Promise.all(
      candidates.map(async u => {
        const start = Date.now();
        try {
          await this.request(u, { timeout: 3000 });
          return { url: u, score: Date.now() - start + this.scoreCDN(u) };
        } catch {
          return { url: u, score: 99999 };
        }
      })
    );

    results.sort((a, b) => a.score - b.score);

    for (let r of results) {
      try {
        let u = r.url;

        u = await this.pickBestVariant(u);
        u = await this.skipIntro(u);
        u = await this.skipOutro(u);

        this.setCache(key, u);

        return {
          type: "hls",
          url: u,
          headers: { Referer: this.currentSite }
        };

      } catch {}
    }

    throw new Error("全部线路失败");
  }
}
