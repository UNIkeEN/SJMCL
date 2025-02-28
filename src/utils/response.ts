import { t } from "i18next";
import {
  AccountServiceError,
  ConfigServiceError,
  InstanceError,
  ResourceServiceError,
} from "@/enums/service-error";
import { InvokeResponse } from "@/models/response";
import { isDev } from "@/utils/env";

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
        let details = "";

        switch (serviceDomain) {
          case "account":
            if (Object.values(AccountServiceError).includes(error)) {
              details = t(
                `Services.${serviceDomain}.${String(propertyKey)}.error.description.${error}`
              );
            }
            break;
          case "instance":
            if (Object.values(InstanceError).includes(error)) {
              details = t(
                `Services.${serviceDomain}.${String(propertyKey)}.error.description.${error}`
              );
            }
            break;
          case "config":
            if (Object.values(ConfigServiceError).includes(error)) {
              details = t(
                `Services.${serviceDomain}.${String(propertyKey)}.error.description.${error}`
              );
            }
            break;
          case "resource":
            if (Object.values(ResourceServiceError).includes(error)) {
              details = t(
                `Services.${serviceDomain}.${String(propertyKey)}.error.description.${error}`
              );
            }
            break;
          default:
            break;
        }

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

        return { status: "error", message, details, raw_error: error };
      }
    };

    return descriptor;
  };
}
