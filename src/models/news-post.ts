type ImageSrcUnion = [string, number, number];

export interface NewsPostSummary {
  title: string;
  abstract?: string;
  keywords?: string;
  imageSrc?: ImageSrcUnion;
  source: NewsSourceInfo;
  createAt: string;
  link: string;
}

export interface NewsSourceInfo {
  // In the backend, only store the endpointUrl (unique, as index), and retrieve and populate the remaining fields when fetching new posts or checking if the endpoint is online.
  name?: string;
  fullName?: string;
  endpointUrl: string; // If it only contains this field, it means the data source is offline or pending.
  iconSrc?: string;
}

export interface NewsPostRequest {
  url: string;
  cursor: number | null;
}
