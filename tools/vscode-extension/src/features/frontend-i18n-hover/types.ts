import * as vscode from "vscode";

export interface TranslationKeySelection {
  fullKey: string;
  segments: string[];
  segmentIndex: number;
  scopedKey: string;
  selectedSegment: string;
  range: vscode.Range;
}

export interface LocaleFileInfo {
  locale: string;
  uri: vscode.Uri;
}

export interface OpenLocaleKeyCommandArgs {
  uri: string;
  locale: string;
  scopedKey: string;
  leaf: boolean;
  createIfMissing: boolean;
}
