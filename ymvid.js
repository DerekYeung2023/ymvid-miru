// ==MiruExtension==
// @name         多站聚合·稳定版
// @version      v1.0.0
// @author       Omar
// @lang         zh-tw
// @license      MIT
// @type         bangumi
// @webSite      https://www.ymvid.com
// @package      multi-source-safe
// @icon         https://www.ymvid.com/favicon.ico
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
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "zh-CN,zh;q=0.9"
  };

  async req(url, site) {
    return await this.request(url, {
      headers: {
        ...this.headers,
        Referer: site,
        Origin: site
      }
    });
  }

  async tryRequest(path) {
    for (let site of this.sites) {
      try {
        const res = await this.req(site + path, site);
        this.currentSite = site;
        return res;
      } catch (e) {
        continue;
      }
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

    return list.map(item => ({
      title: item.match(/title="(.*?)"/)?.[1] || "未知",
      pic: this.fixPic(item.match(/data-src="(.*?)"/)?.[1] || ""),
      url: item.match(/href="(.*?)"/)?.[1] || ""
    }));
  }

  // ===== 搜索 =====
  async search(kw, page) {
    const key = encodeURIComponent(kw || "");
    const res = await this.tryRequest(`/vodsearch/${key}----------${page}---.html`);

    const list = res.match(/module-card-item[\s\S]*?<\/div>\s*<\/div>/g) || [];

    return list.map(item => ({
      title: item.match(/<strong>(.*?)<\/strong>/)?.[1]?.replace(/<.*?>/g, "") || "未知",
      pic: this.fixPic(item.match(/data-src="(.*?)"/)?.[1] || ""),
      url: item.match(/href="(.*?)"/)?.[1] || ""
    }));
  }

  // ===== 详情 =====
  async detail(url) {
    const res = await this.req(this.currentSite + url, this.currentSite);

    const title = res.match(/<h1.*?>(.*?)<\/h1>/)?.[1] || "未知";
    const desc = res.match(/module-info-content([\s\S]*?)<\/div>/)?.[1]
      ?.replace(/<.*?>/g, "")
      .trim() || "暂无简介";

    const episodes = [];

    const blocks = res.match(/module-play-list-content[\s\S]*?<\/div>/g) || [];

    blocks.forEach((b, i) => {
      const links = b.match(/<a href="(.*?)".*?>(.*?)<\/a>/g) || [];

      const urls = links.map(l => {
        const m = l.match(/href="(.*?)".*?>(.*?)<\/a>/);
        return {
          name: m?.[2]?.replace(/<.*?>/g, "") || "播放",
          url: m?.[1] || ""
        };
      }).filter(i => i.url);

      episodes.push({
        title: `线路 ${i + 1}`,
        urls
      });
    });

    return { title, desc, episodes };
  }

  // ===== 播放 =====
  async watch(url) {

    const res = await this.req(this.currentSite + url, this.currentSite);

    const links = res.match(/href="(.*?)"/g) || [];

    const playUrls = links
      .map(l => l.match(/"(.*?)"/)?.[1])
      .filter(Boolean)
      .slice(0, 5);

    const parse = async (p) => {
      try {
        const html = await this.req(this.currentSite + p, this.currentSite);

        const m = html.match(/player_.*?=\s*(\{[\s\S]*?\})/);
        if (!m) return null;

        let u = "";

        try {
          const obj = JSON.parse(m[1]);
          u = obj?.url || "";
        } catch {
          return null;
        }

        if (!u) return null;

        if (!u.includes(".m3u8")) {
          try {
            const html2 = await this.request(u);
            const m3u8 = html2.match(/https?:\/\/.*?\.m3u8/);
            if (m3u8) u = m3u8[0];
          } catch {}
        }

        return u || null;

      } catch {
        return null;
      }
    };

    for (let p of playUrls) {
      const real = await parse(p);
      if (real) {
        return {
          type: real.includes(".m3u8") ? "hls" : "mp4",
          url: real,
          headers: {
            Referer: this.currentSite,
            Origin: this.currentSite
          }
        };
      }
    }

    throw new Error("无可用播放源");
  }
}
