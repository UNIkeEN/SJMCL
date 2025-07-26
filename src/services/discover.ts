import { invoke } from "@tauri-apps/api/core";
import {
  NewsPostRequest,
  NewsPostSummary,
  NewsSourceInfo,
} from "@/models/news-post";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Discover class for managing article posts.
 */
export class DiscoverService {
  /**
   * FETCH the list of news sources' info.
   * @returns {Promise<InvokeResponse<NewsSourceInfo[]>>}
   */
  @responseHandler("resource")
  static async fetchNewsSourcesInfo(): Promise<
    InvokeResponse<NewsSourceInfo[]>
  > {
    return await invoke("fetch_news_sources_info");
  }

  /**
   * FETCH the list of news posts' summaries.
   * @returns {Promise<InvokeResponse<NewsPostSummary[]>>}
   */

  @responseHandler("resource")
  static async fetchNewsPostSummaries(sources: NewsPostRequest[]): Promise<
    InvokeResponse<{
      posts: NewsPostSummary[];
      cursors: Record<string, number>;
    }>
  > {
    return await invoke("fetch_news_post_summaries", { requests: sources });
  }
}
