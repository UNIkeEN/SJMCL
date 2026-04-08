import { t } from "i18next";
import { InvokeResponse } from "@/models/response";
import { isDev } from "@/utils/env";
import { logger } from "@/utils/logging";

export function responseHandler(serviceDomain: string): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>
  ): TypedPropertyDescriptor<any> | void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      ...args: any[]
    ): Promise<InvokeResponse<any>> {
      try {
        const data = await originalMethod.apply(this, args);
        const message = t(
          `Services.${serviceDomain}.${String(propertyKey)}.success`
        );
        return { status: "success", message, data };
      } catch (error: any) {
        const message = t(
          `Services.${serviceDomain}.${String(propertyKey)}.error.title`
        );

        const details = String(error)
          ? t(
              `Services.${serviceDomain}.${String(propertyKey)}.error.description.${String(error)}`,
              {
                defaultValue: String(error),
              }
            )
          : "";

        if (isDev) {
          const errorSet = {
            Key: String(error),
            "Service Domain": serviceDomain,
            "Property Key": String(propertyKey),
            "Localized Message": message,
            "Localized Details": details,
          };
          console.table(errorSet);
        }
        logger.error(
          `Invoke ${String(propertyKey)} failed: ${message} - ${details}`
        );

        return { status: "error", message, details, raw_error: error };
      }
    };

    return descriptor;
  };
}
