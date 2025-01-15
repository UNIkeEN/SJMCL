export interface PostSummary {
  title: string;
  abstract?: string;
  keywords?: string;
  imageSrc?: string;
  source: PostSourceInfo; // The post server response does not include this field in every item, so the client request function needs to add this field.
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
