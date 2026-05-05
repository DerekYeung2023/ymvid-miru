// ==MiruExtension==
// @name         粵漫網（防封強化版）
// @version      v1.0.0
// @author       OmarGPT
// @lang         zh-tw
// @license      MIT
// @icon         https://www.ymvid.com/favicon.ico
// @package      ymvid.com
// @type         bangumi
// @webSite      https://www.ymvid.com
// @nsfw         false
// ==/MiruExtension==

export default class extends Extension {

  // 🔥 核心：统一请求封装（防 403）
  async req(url) {
    return await this.request(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Referer": this.webSite,
        "Origin": this.webSite,
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Connection": "keep-alive",
      },
    });
  }

  fixPic(pic) {
    if (!pic) return "";
    if (pic.startsWith("http")) return pic;
    if (pic.startsWith("//")) return "https:" + pic;
    return this.webSite + pic;
  }

  async latest(page) {
    const res = await this.req(`/index.php/vod/type/id/1/page/${page}.html`);

    const list = res.match(/module-item[\s\S]*?<\/div>\s*<\/div>/g) || [];

    return list.map(item => {
      const title = item.match(/title="(.*?)"/)?.[1] || "未知";
      const pic = this.fixPic(item.match(/data-src="(.*?)"/)?.[1]);
      const url = item.match(/href="(.*?)"/)?.[1] || "";

      return { title, pic, url };
    });
  }

  async search(kw, page) {
    const key = encodeURIComponent(kw);
    const res = await this.req(`/vodsearch/${key}----------${page}---.html`);

    const list = res.match(/module-card-item[\s\S]*?<\/div>\s*<\/div>/g) || [];

    return list.map(item => {
      const title = item.match(/<strong>(.*?)<\/strong>/)?.[1]?.replace(/<.*?>/g, "") || "未知";
      const pic = this.fixPic(item.match(/data-src="(.*?)"/)?.[1]);
      const url = item.match(/href="(.*?)"/)?.[1] || "";

      return { title, pic, url };
    });
  }

  async detail(url) {
    const res = await this.req(url);

    const title = res.match(/<h1.*?>(.*?)<\/h1>/)?.[1] || "未知";
    const desc = res.match(/module-info-content([\s\S]*?)<\/div>/)?.[1]?.replace(/<.*?>/g, "").trim() || "暂无简介";

    const episodes = [];

    const playList = res.match(/module-play-list-content[\s\S]*?<\/div>/g) || [];

    playList.forEach((block, i) => {
      const links = block.match(/<a href="(.*?)".*?>(.*?)<\/a>/g) || [];

      const urls = links.map(l => {
        const m = l.match(/href="(.*?)".*?>(.*?)<\/a>/);
        return {
          name: m?.[2]?.replace(/<.*?>/g, "") || "播放",
          url: m?.[1]
        };
      });

      episodes.push({
        title: `线路 ${i + 1}`,
        urls
      });
    });

    return { title, desc, episodes };
  }

  async watch(url) {
    const res = await this.req(url);

    const match = res.match(/player_.*?=\s*(\{[\s\S]*?\})/);
    if (!match) throw new Error("解析失败");

    let player = JSON.parse(match[1]);
    let videoUrl = player.url;

    // 🔐 解密
    if (player.encrypt == 1) {
      videoUrl = decodeURIComponent(escape(videoUrl));
    } else if (player.encrypt == 2) {
      videoUrl = atob(videoUrl);
    }

    // 🔁 iframe 二跳解析
    if (videoUrl.includes("http") && !videoUrl.includes(".m3u8") && !videoUrl.includes(".mp4")) {
      try {
        const iframeRes = await this.req(videoUrl);
        const m3u8 = iframeRes.match(/https?:\/\/.*?\.m3u8/);
        if (m3u8) videoUrl = m3u8[0];
      } catch (e) {}
    }

    return {
      type: videoUrl.includes(".m3u8") ? "hls" : "mp4",
      url: videoUrl,

      // 🔥 防盗链关键
      headers: {
        Referer: this.webSite,
        Origin: this.webSite,
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"
      }
    };
  }
}
