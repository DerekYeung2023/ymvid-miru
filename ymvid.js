// ==MiruExtension==
// @name         Anime1 + Gimy（稳定版）
// @version      v1.0.0
// @author       Omar
// @lang         zh-tw
// @license      MIT
// @type         bangumi
// @webSite      https://anime1.me
// @package      anime1-gimy-safe
// @icon         https://anime1.me/favicon.ico
// @nsfw         false
// ==/MiruExtension==

export default class extends Extension {

  headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "zh-CN,zh;q=0.9"
  };

  // ========= Anime1 =========

  async latest(page) {
    try {
      const url = `https://anime1.me/?cat=2`;
      const res = await this.request(url, { headers: this.headers });

      const list = res.match(/<article[\s\S]*?<\/article>/g) || [];

      return list.slice(0, 30).map(i => ({
        title: i.match(/<h2.*?>(.*?)<\/h2>/)?.[1]?.replace(/<.*?>/g, "") || "未知",
        pic: "",
        url: i.match(/href="(https:\/\/anime1\.me\/.*?)"/)?.[1] || ""
      })).filter(i => i.url);

    } catch {
      return [];
    }
  }

  async search(kw, page) {
    try {
      const key = encodeURIComponent(kw || "");
      const url = `https://anime1.me/?s=${key}`;
      const res = await this.request(url, { headers: this.headers });

      const list = res.match(/<article[\s\S]*?<\/article>/g) || [];

      return list.map(i => ({
        title: i.match(/<h2.*?>(.*?)<\/h2>/)?.[1]?.replace(/<.*?>/g, "") || "未知",
        pic: "",
        url: i.match(/href="(https:\/\/anime1\.me\/.*?)"/)?.[1] || ""
      })).filter(i => i.url);

    } catch {
      return [];
    }
  }

  async detail(url) {
    try {
      const res = await this.request(url, { headers: this.headers });

      const title = res.match(/<h1.*?>(.*?)<\/h1>/)?.[1] || "Anime1";

      // Anime1 每集一个页面，直接当播放
      return {
        title,
        desc: "",
        episodes: [{
          title: "播放",
          urls: [{
            name: "播放",
            url: url || ""
          }]
        }]
      };

    } catch {
      return {
        title: "加载失败",
        desc: "",
        episodes: []
      };
    }
  }

  // ========= 通用播放 =========

  async watch(url) {

    try {
      const html = await this.request(url, { headers: this.headers });

      // 🎯 Anime1：直接抓 m3u8
      let m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/);
      if (m3u8) {
        return {
          type: "hls",
          url: m3u8[0],
          headers: { Referer: url }
        };
      }

      // 🎯 Gimy / 其他：抓 mp4
      let mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/);
      if (mp4) {
        return {
          type: "mp4",
          url: mp4[0],
          headers: { Referer: url }
        };
      }

      // 🎯 iframe 解析
      let iframe = html.match(/<iframe.*?src="(.*?)"/);
      if (iframe) {
        let src = iframe[1] || "";

        if (!src.startsWith("http")) {
          const u = new URL(url);
          src = u.origin + src;
        }

        const html2 = await this.request(src, { headers: this.headers });

        let m3u8_2 = html2.match(/https?:\/\/.*?\.m3u8/);
        if (m3u8_2) {
          return {
            type: "hls",
            url: m3u8_2[0],
            headers: { Referer: src }
          };
        }
      }

    } catch {}

    throw new Error("无法解析播放源");
  }
}
