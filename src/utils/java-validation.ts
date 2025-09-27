import { JavaInfo } from "@/models/system-info";
import { ConfigService } from "@/services/config";

export interface JavaValidationResult {
  isValid: boolean;
  error?: string;
}

export interface JavaValidationOptions {
  platform: string;
  existingJavaPaths: string[];
  javaInfos: JavaInfo[];
}

export class JavaPathValidator {
  static validateFileName(
    javaPath: string,
    platform: string
  ): JavaValidationResult {
    const fileName = javaPath.split(/[/\\]/).pop();
    const expectedFileName = platform === "windows" ? "java.exe" : "java";

    if (fileName !== expectedFileName) {
      return {
        isValid: false,
        error: "invalid",
      };
    }

    return { isValid: true };
  }

  static validateDuplication(
    javaPath: string,
    existingJavaPaths: string[],
    javaInfos: JavaInfo[]
  ): JavaValidationResult {
    const isDuplicated =
      existingJavaPaths.includes(javaPath) ||
      javaInfos.some((java) => java.execPath === javaPath);

    if (isDuplicated) {
      return {
        isValid: false,
        error: "duplicated",
      };
    }

    return { isValid: true };
  }

  static async validateJavaExecutable(
    javaPath: string
  ): Promise<JavaValidationResult> {
    try {
      const response = await ConfigService.validateJava(javaPath);
      if (response.status !== "success") {
        return {
          isValid: false,
          error: "invalid",
        };
      }
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: "invalid",
      };
    }
  }

  static async validateJavaPath(
    javaPath: string,
    options: JavaValidationOptions
  ): Promise<JavaValidationResult> {
    const fileNameValidation = this.validateFileName(
      javaPath,
      options.platform
    );
    if (!fileNameValidation.isValid) {
      return fileNameValidation;
    }

    const duplicationValidation = this.validateDuplication(
      javaPath,
      options.existingJavaPaths,
      options.javaInfos
    );
    if (!duplicationValidation.isValid) {
      return duplicationValidation;
    }

    return await this.validateJavaExecutable(javaPath);
  }
}
