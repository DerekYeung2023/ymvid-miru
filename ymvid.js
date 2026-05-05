import { Extension, libs } from "miru-lib";

export default class extends Extension {
  constructor() {
    super();
    this.name = "粵漫之家";
    this.id = "com.ymvid.hk";
    this.version = "1.0.1";
    this.author = "Gemini";
    this.baseUrl = "https://www.ymvid.com";
  }

  /**
   * 首页/最新更新
   */
  async latest(page) {
    // 默认展示“粤语动画”分类 (ID 为 1)
    const res = await this.request(`/hk/index.php/vod/show/id/1/page/${page}.html`);
    const $ = libs.cheerio.load(res);
    const list = [];

    $(".module-item").each((i, el) => {
      list.push({
        title: $(el).find(".module-item-title").text().trim(),
        url: $(el).find(".module-item-pic a").attr("href"),
        cover: $(el).find(".module-item-pic img").attr("data-src") || $(el).find(".module-item-pic img").attr("src"),
        update: $(el).find(".module-item-note").text().trim(),
      });
    });
    return list;
  }

  /**
   * 搜索功能
   */
  async search(kw, page) {
    const res = await this.request(`/hk/index.php/vod/search/page/${page}/wd/${encodeURIComponent(kw)}.html`);
    const $ = libs.cheerio.load(res);
    const list = [];

    $(".module-search-item").each((i, el) => {
      list.push({
        title: $(el).find(".module-card-item-title").text().trim(),
        url: $(el).find(".module-card-item-title a").attr("href"),
        cover: $(el).find(".module-item-pic img").attr("data-src"),
        update: $(el).find(".module-item-note").text().trim(),
      });
    });
    return list;
  }

  /**
   * 详情页解析 (剧集列表)
   */
  async detail(url) {
    const res = await this.request(url);
    const $ = libs.cheerio.load(res);
    
    const episodes = [];
    
    // 该站可能有多个播放源 (线路1, 线路2...)
    $(".module-tab-item").each((i, tab) => {
      const sourceName = $(tab).find("span").text().trim();
      const urls = [];
      
      // 对应 Tab 内容区的剧集链接
      $(`.module-play-list-content`).eq(i).find("a").each((j, a) => {
        urls.push({
          name: $(a).find("span").text().trim() || $(a).text().trim(),
          url: $(a).attr("href"),
        });
      });
      
      if (urls.length > 0) {
        episodes.push({ title: sourceName, urls });
      }
    });

    return {
      title: $(".page-title").first().text().trim(),
      cover: $(".module-item-pic img").first().attr("data-src"),
      desc: $(".video-info-content span").text().trim(),
      episodes,
    };
  }

  /**
   * 播放解析
   */
  async watch(url) {
    const res = await this.request(url);
    
    // 1. 提取播放器配置 JSON
    const playerMatch = res.match(/var player_aaaa=(\{.*?\})/);
    if (!playerMatch) {
      throw new Error("无法找到播放器配置");
    }

    const playerObj = JSON.parse(playerMatch[1]);
    let videoUrl = playerObj.url;

    // 2. 处理加密 (苹果 CMS 常见的 Base64 混淆)
    if (playerObj.encrypt == "1") {
      videoUrl = decodeURIComponent(atob(videoUrl));
    } else if (playerObj.encrypt == "2") {
      videoUrl = decodeURIComponent(atob(videoUrl).split("").reverse().join(""));
    }

    // 3. 判断是否需要再次嗅探或直接返回
    // 如果 URL 是以 .m3u8 结尾的直接链接
    return {
      type: videoUrl.includes(".m3u8") ? "hls" : "mp4",
      url: videoUrl,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": this.baseUrl,
        "Origin": this.baseUrl
      }
    };
  }
}
