// static extension metadata
export interface ExtensionFrontend {
  entry: string;
}

export interface ExtensionInfo {
  identifier: string;
  name: string;
  description?: string | null;
  iconSrc: string;
  frontend?: ExtensionFrontend | null;
}
