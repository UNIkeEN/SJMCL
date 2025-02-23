export interface PostSummary {
  title: string;
  abstracts?: string;
  keywords?: string;
  imageSrc?: string;
  source: PostSourceInfo;
  updateAt: string;
  link: string;
}

export interface PostSourceInfo {
  // In the backend, only store the endpointUrl (unique, as index), and retrieve and populate the remaining fields when fetching new posts or checking if the endpoint is online.
  name?: string;
  fullName?: string;
  endpointUrl: string; // If it only contains this field, it means the data source is offline or pending.
  iconSrc?: string;
}
