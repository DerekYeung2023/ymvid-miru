// ==MiruExtension==
// @name         粵漫網
// @version      v0.0.4
// @author       Gemini
// @lang         zh-tw
// @license      MIT
// @icon         https://www.ymvid.com/favicon.ico
// @package      ymvid.com
// @type         bangumi
// @webSite      https://www.ymvid.com
// @nsfw         false
// ==/MiruExtension==

export default class extends Extension {
  async latest(page) {
    const res = await this.request(`/index.php/vod/type/id/1/page/${page}.html`);
    const list = res.match(/<div class="module-item">[\s\S]*?<\/div>\s*<\/div>/g) || [];
    return list.map((item) => {
      const title = item.match(/title="(.*?)"/)?.[1] || "未知";
      const pic = item.match(/data-src="(.*?)"/)?.[1] || "";
      const url = item.match(/href="(.*?)"/)?.[1] || "";
      return {
        title,
        pic: pic.startsWith("http") ? pic : this.webSite + pic,
        url,
      };
    });
  }

  async search(kw, page) {
    const res = await this.request(`/vodsearch/${kw}----------${page}---.html`);
    const list = res.match(/<div class="module-card-item">[\s\S]*?<\/div>\s*<\/div>/g) || [];
    return list.map((item) => {
      const title = item.match(/<strong>(.*?)<\/strong>/)?.[1]?.replace(/<.*?>/g, "") || "未知";
      const pic = item.match(/data-src="(.*?)"/)?.[1] || "";
      const url = item.match(/href="(.*?)"/)?.[1] || "";
      return {
        title,
        pic: pic.startsWith("http") ? pic : this.webSite + pic,
        url,
      };
    });
  }

  async detail(url) {
    const res = await this.request(url);
    const title = res.match(/<h1 class="page-title">(.*?)<\/h1>/)?.[1] || "未知";
    const desc = res.match(/<div class="module-info-content">([\s\S]*?)<\/div>/)?.[1]?.replace(/<.*?>/g, "").trim() || "暫無簡介";
    const episodes = [];
    const playListMatches = res.match(/<div class="module-play-list-content\s*">([\s\S]*?)<\/div>/g) || [];
    
    playListMatches.forEach((listHtml, index) => {
      const links = listHtml.match(/<a href="(.*?)"><span>(.*?)<\/span><\/a>/g) || [];
      const urls = links.map(link => {
        const m = link.match(/href="(.*?)"><span>(.*?)<\/span>/);
        return { name: m[2], url: m[1] };
      });
      episodes.push({ title: `線路 ${index + 1}`, urls });
    });
    return { title, desc, episodes };
  }

  async watch(url) {
    const res = await this.request(url);
    const playerJson = res.match(/var player_aaaa=({.*?})<\/script>/)?.[1];
    if (!playerJson) throw new Error("找不到播放源數據");
    
    const playerObj = JSON.parse(playerJson);
    let videoUrl = playerObj.url;
    
    // 處理 MacCMS 常見的加密方式
    if (playerObj.encrypt == 1) {
      videoUrl = unescape(videoUrl);
    } else if (playerObj.encrypt == 2) {
      videoUrl = atob(videoUrl);
    }
    
    return { 
      type: videoUrl.includes(".m3u8") ? "hls" : "mp4", 
      url: videoUrl 
    };
  }
}

