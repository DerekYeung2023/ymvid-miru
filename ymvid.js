import { Extension, libs } from "miru-lib";

export default class extends Extension {
  constructor() {
    super();
    this.name = "粵漫之家";
    this.id = "com.ymvid.hk.anime"; // 确保 ID 唯一
    this.version = "1.0.2";
    this.author = "Gemini";
    this.baseUrl = "https://www.ymvid.com";
    this.description = "粵語配音動畫資源站"; // 必须包含描述
    this.icon = "https://www.ymvid.com/favicon.ico"; // 必须包含图标链接
  }

  // 首页最新更新
  async latest(page) {
    const res = await this.request(`/hk/index.php/vod/show/id/1/page/${page}.html`);
    const $ = libs.cheerio.load(res);
    const list = [];

    $(".module-item").each((i, el) => {
      const title = $(el).find(".module-item-title").text().trim();
      const url = $(el).find(".module-item-pic a").attr("href");
      const cover = $(el).find(".module-item-pic img").attr("data-src") || $(el).find(".module-item-pic img").attr("src");
      
      // 核心修复：确保所有字段都不是 null
      list.push({
        title: title || "未知标题",
        url: url || "",
        cover: cover || "",
        update: $(el).find(".module-item-note").text().trim() || "",
      });
    });
    return list;
  }

  // 搜索
  async search(kw, page) {
    const res = await this.request(`/hk/index.php/vod/search/page/${page}/wd/${encodeURIComponent(kw)}.html`);
    const $ = libs.cheerio.load(res);
    const list = [];

    $(".module-search-item").each((i, el) => {
      list.push({
        title: $(el).find(".module-card-item-title").text().trim() || "未知",
        url: $(el).find(".module-card-item-title a").attr("href") || "",
        cover: $(el).find(".module-item-pic img").attr("data-src") || "",
        update: $(el).find(".module-item-note").text().trim() || "",
      });
    });
    return list;
  }

  // 详情
  async detail(url) {
    const res = await this.request(url);
    const $ = libs.cheerio.load(res);
    const episodes = [];

    $(".module-tab-item").each((i, tab) => {
      const sourceName = $(tab).find("span").text().trim() || `线路 ${i + 1}`;
      const urls = [];
      $(`.module-play-list-content`).eq(i).find("a").each((j, a) => {
        urls.push({
          name: $(a).find("span").text().trim() || $(a).text().trim() || `第 ${j + 1} 集`,
          url: $(a).attr("href") || "",
        });
      });
      if (urls.length > 0) {
        episodes.push({ title: sourceName, urls });
      }
    });

    return {
      title: $(".page-title").first().text().trim() || "未知剧集",
      cover: $(".module-item-pic img").first().attr("data-src") || "",
      desc: $(".video-info-content span").text().trim() || "暂无简介",
      episodes,
    };
  }

  // 播放解析
  async watch(url) {
    const res = await this.request(url);
    const playerMatch = res.match(/var player_aaaa=(\{.*?\})/);
    if (!playerMatch) throw new Error("无法提取播放地址");

    const playerObj = JSON.parse(playerMatch[1]);
    let videoUrl = playerObj.url || "";

    // 解密逻辑
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
