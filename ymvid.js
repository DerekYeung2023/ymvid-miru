/**
 * @name 粵漫之家
 * @version 1.0.3
 * @author Gemini
 * @description 粵語配音動畫資源站，適配 Miru 1.8.1+
 */

class Extension extends Miru.Extension {
  constructor() {
    super();
    this.name = "粵漫之家";
    this.id = "com.ymvid.hk.fixed";
    this.version = "1.0.3";
    this.author = "Gemini";
    this.description = "專業粵語動畫資源站";
    this.icon = "https://www.ymvid.com/favicon.ico";
    this.baseUrl = "https://www.ymvid.com";
  }

  async latest(page) {
    const res = await this.request(`/hk/index.php/vod/show/id/1/page/${page}.html`);
    const $ = Miru.libs.cheerio.load(res);
    const list = [];

    $(".module-item").each((i, el) => {
      list.push({
        title: $(el).find(".module-item-title").text().trim().toString(),
        url: $(el).find(".module-item-pic a").attr("href").toString(),
        cover: ($(el).find(".module-item-pic img").attr("data-src") || $(el).find(".module-item-pic img").attr("src")).toString(),
        update: $(el).find(".module-item-note").text().trim().toString(),
      });
    });
    return list;
  }

  async search(kw, page) {
    const res = await this.request(`/hk/index.php/vod/search/page/${page}/wd/${encodeURIComponent(kw)}.html`);
    const $ = Miru.libs.cheerio.load(res);
    const list = [];

    $(".module-search-item").each((i, el) => {
      list.push({
        title: $(el).find(".module-card-item-title").text().trim().toString(),
        url: $(el).find(".module-card-item-title a").attr("href").toString(),
        cover: $(el).find(".module-item-pic img").attr("data-src").toString(),
        update: $(el).find(".module-item-note").text().trim().toString(),
      });
    });
    return list;
  }

  async detail(url) {
    const res = await this.request(url);
    const $ = Miru.libs.cheerio.load(res);
    const episodes = [];

    $(".module-tab-item").each((i, tab) => {
      const sourceName = $(tab).find("span").text().trim().toString() || `線路 ${i + 1}`;
      const urls = [];
      $(`.module-play-list-content`).eq(i).find("a").each((j, a) => {
        urls.push({
          name: ($(a).find("span").text().trim() || $(a).text().trim()).toString(),
          url: $(a).attr("href").toString(),
        });
      });
      if (urls.length > 0) {
        episodes.push({ title: sourceName, urls });
      }
    });

    return {
      title: $(".page-title").first().text().trim().toString(),
      cover: $(".module-item-pic img").first().attr("data-src").toString(),
      desc: $(".video-info-content span").text().trim().toString(),
      episodes,
    };
  }

  async watch(url) {
    const res = await this.request(url);
    const playerMatch = res.match(/var player_aaaa=(\{.*?\})/);
    if (!playerMatch) throw new Error("解析失敗");

    const playerObj = JSON.parse(playerMatch[1]);
    let videoUrl = playerObj.url.toString();

    if (playerObj.encrypt == "1") {
      videoUrl = decodeURIComponent(atob(videoUrl));
    } else if (playerObj.encrypt == "2") {
      videoUrl = decodeURIComponent(atob(videoUrl).split("").reverse().join(""));
    }

    return {
      type: videoUrl.includes(".m3u8") ? "hls" : "mp4",
      url: videoUrl,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": this.baseUrl
      }
    };
  }
}

// 导出插件实例
export default Extension;

