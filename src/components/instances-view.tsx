import {
  Box,
  BoxProps,
  HStack,
  Icon,
  Image,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";
import { CSSProperties } from "react";
import { FaStar } from "react-icons/fa6";
import Empty from "@/components/common/empty";
import {
  OptionItemGroup,
  OptionItemProps,
} from "@/components/common/option-item";
import { WrapCardGroup } from "@/components/common/wrap-card";
import InstanceMenu from "@/components/instance-menu";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { InstanceSummary } from "@/models/instance/misc";
import { generateInstanceDesc } from "@/utils/instance";

interface InstancesViewProps extends BoxProps {
  instances: InstanceSummary[];
  viewType: string;
  onSelectCallback?: () => void;
  withMenu?: boolean;
}

const instanceListSurfaceStyleOverrides = {
  "--sjmcl-card-front-bg": "var(--sjmcl-instance-list-bg)",
  "--sjmcl-card-front-backdrop": "var(--sjmcl-instance-list-backdrop)",
  "--sjmcl-card-front-shadow": "var(--sjmcl-instance-list-shadow)",
  "--sjmcl-card-front-border": "var(--sjmcl-instance-list-border)",
  "--sjmcl-option-item-hover-bg": "var(--sjmcl-instance-list-hover-bg)",
  "--sjmcl-option-item-active-bg": "var(--sjmcl-instance-list-active-bg)",
} as CSSProperties;

const InstancesView: React.FC<InstancesViewProps> = ({
  instances,
  viewType,
  onSelectCallback = () => {},
  withMenu = true,
  ...boxProps
}) => {
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { selectedInstance } = useGlobalData();

  const handleUpdateSelectedInstance = (instance: InstanceSummary) => {
    update("states.shared.selectedInstanceId", instance.id);
    onSelectCallback();
  };

  const handleSelectById = (instanceId: string) => {
    const instance = instances.find((item) => item.id === instanceId);
    if (instance) {
      handleUpdateSelectedInstance(instance);
    }
  };

  const listItems: OptionItemProps[] = instances.map((instance) => ({
    title: instance.name,
    description: [generateInstanceDesc(instance), instance.description]
      .filter(Boolean)
      .join(", "),
    ...{
      titleExtra: instance.starred && <Icon as={FaStar} color="yellow.500" />,
    },
    maxTitleLines: 1,
    maxDescriptionLines: 2,
    titleLineWrap: false,
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio value={instance.id} colorScheme={primaryColor} />
        <Image
          boxSize="32px"
          objectFit="cover"
          src={instance.iconSrc}
          alt={instance.name}
        />
      </HStack>
    ),
    isFullClickZone: true,
    onClick: () => handleUpdateSelectedInstance(instance),
    children: withMenu ? (
      <Box
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <InstanceMenu instance={instance} variant="buttonGroup" />
      </Box>
    ) : (
      <></>
    ),
  }));

  const gridItems = instances.map((instance) => ({
    cardContent: {
      title: instance.name,
      description: generateInstanceDesc(instance) || String.fromCharCode(160),
      image: instance.iconSrc,
      extraContent: (
        <HStack spacing={1} position="absolute" top={0.5} right={1}>
          {instance.starred && <Icon as={FaStar} color="yellow.500" />}
          {withMenu && <InstanceMenu instance={instance} />}
        </HStack>
      ),
    },
    isSelected: selectedInstance?.id === instance.id,
    radioValue: instance.id,
    onSelect: () => handleUpdateSelectedInstance(instance),
  }));

  return (
    <Box {...boxProps}>
      {instances.length > 0 ? (
        <RadioGroup
          value={selectedInstance?.id}
          onChange={(nextValue) => handleSelectById(nextValue as string)}
        >
          {viewType === "list" ? (
            <Box style={instanceListSurfaceStyleOverrides}>
              <OptionItemGroup items={listItems} />
            </Box>
          ) : (
            <WrapCardGroup items={gridItems} variant="radio" />
          )}
        </RadioGroup>
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </Box>
  );
};

export default InstancesView;
