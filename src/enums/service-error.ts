export enum AccountServiceError {
  Duplicate = "DUPLICATE",
  Expired = "EXPIRED",
  Invalid = "INVALID",
  NotFound = "NOT_FOUND",
  TextureError = "TEXTURE_ERROR",
  AuthServerError = "AUTH_SERVER_ERROR",
  Cancelled = "CANCELLED",
}

export enum InstanceError {
  InstanceNotFoundById = "INSTANCE_NOT_FOUND_BY_ID",
  ConflictNameError = "CONFLICT_NAME_ERROR",
  ServerNbtReadError = "SERVER_NBT_READ_ERROR",
  FileNotFoundError = "FILE_NOT_FOUND_ERROR",
  InvalidSourcePath = "INVALID_SOURCE_PATH",
  FileCopyFailed = "FILE_COPY_FAILED",
  FileMoveFailed = "FILE_MOVE_FAILED",
  FolderCreationFailed = "FOLDER_CREATION_FAILED",
  WorldNotExistError = "WORLD_NOT_EXSIT_ERROR",
  LevelNotExistError = "LEVEL_NOT_EXSIT_ERROR",
  LevelParseError = "LEVEL_PARSE_ERROR",
}

export enum ConfigServiceError {
  FetchError = "FETCH_ERROR",
  InvalidCode = "INVALID_CODE",
  CodeExpired = "CODE_EXPIRED",
  VersionMismatch = "VERSION_MISMATCH",
  GameDirAlreadyAdded = "GAME_DIR_ALREADY_ADDED",
  GameDirNotExist = "GAME_DIR_NOT_EXIST",
}

export enum ResourceServiceError {
  ParseError = "PARSE_ERROR",
  NoDownloadApi = "NO_DOWNLOAD_API",
}
