import type { ButtonProps } from "@chakra-ui/react";
import type { MouseEventHandler } from "react";
import type { IconType } from "react-icons";
import { type ExtensionSlotKey, ExtensionUISlotKey } from "@/enums/extension";
import type {
  GameServerInfo,
  InstanceSummary,
  LocalModInfo,
  ResourcePackInfo,
  SchematicInfo,
  ShaderPackInfo,
} from "@/models/instance/misc";
import type { WorldInfo } from "@/models/instance/world";
import type { JavaInfo } from "@/models/system-info";
import type { ExtensionContributionBase } from "./contribution";

interface ExtensionInstanceSlotContextBase {
  instanceId: string | undefined;
  summary: InstanceSummary | undefined;
}

export type ExtensionSlotContextMap = {
  [ExtensionUISlotKey.InstanceWorldItemMenuOperations]: ExtensionInstanceSlotContextBase & {
    save: WorldInfo;
  };
  [ExtensionUISlotKey.InstanceServerItemMenuOperations]: ExtensionInstanceSlotContextBase & {
    server: GameServerInfo;
  };
  [ExtensionUISlotKey.InstanceModItemMenuOperations]: ExtensionInstanceSlotContextBase & {
    mod: LocalModInfo;
  };
  [ExtensionUISlotKey.InstanceSchematicItemMenuOperations]: ExtensionInstanceSlotContextBase & {
    schematic: SchematicInfo;
  };
  [ExtensionUISlotKey.InstanceShaderPackItemMenuOperations]: ExtensionInstanceSlotContextBase & {
    pack: ShaderPackInfo;
  };
  [ExtensionUISlotKey.GameErrorWindowOperations]: ExtensionInstanceSlotContextBase & {
    launchingId: number;
    javaInfo: JavaInfo | undefined;
  };
} & {
  [K in
    | ExtensionUISlotKey.InstanceResourcePackItemMenuOperations
    | ExtensionUISlotKey.InstanceServerResPackItemMenuOperations]: ExtensionInstanceSlotContextBase & {
    pack: ResourcePackInfo;
  };
};

interface CommonIconButtonSlotItem {
  icon: string | IconType;
  label?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  danger?: boolean;
}

export type ExtensionSlotItemMap = {
  [K in
    | ExtensionUISlotKey.InstanceWorldItemMenuOperations
    | ExtensionUISlotKey.InstanceServerItemMenuOperations
    | ExtensionUISlotKey.InstanceModItemMenuOperations
    | ExtensionUISlotKey.InstanceResourcePackItemMenuOperations
    | ExtensionUISlotKey.InstanceServerResPackItemMenuOperations
    | ExtensionUISlotKey.InstanceSchematicItemMenuOperations
    | ExtensionUISlotKey.InstanceShaderPackItemMenuOperations]: CommonIconButtonSlotItem;
} & {
  [ExtensionUISlotKey.GameErrorWindowOperations]: ButtonProps;
};

export interface ExtensionSlotDefinition<K extends ExtensionSlotKey> {
  getItems: (context: ExtensionSlotContextMap[K]) => ExtensionSlotItemMap[K][];
}

export interface ExtensionSlotContribution<K extends ExtensionSlotKey>
  extends ExtensionSlotDefinition<K>, ExtensionContributionBase {
  key: K;
}

export type ExtensionSlotRegistry = Partial<{
  [K in ExtensionSlotKey]: ExtensionSlotDefinition<K>;
}>;

export type ExtensionSlotContributionRegistry = Partial<{
  [K in ExtensionSlotKey]: ExtensionSlotContribution<K>;
}>;
