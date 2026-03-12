import {
  Box,
  BoxProps,
  HStack,
  Icon,
  Image,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";
import { FaStar } from "react-icons/fa6";
import Empty from "@/components/common/empty";
import {
  OptionItemGroup,
  OptionItemProps,
} from "@/components/common/option-item";
import { WrapCardGroup } from "@/components/common/wrap-card";
import InstanceMenu from "@/components/instance-menu";
import { useLauncherConfig } from "@/contexts/config";
import { InstanceSummary } from "@/models/instance/misc";
import { generateInstanceDesc, getInstanceIconSrc } from "@/utils/instance";

interface InstancesViewProps extends BoxProps {
  instances: InstanceSummary[];
  selectedInstance: InstanceSummary | undefined;
  viewType: string;
  onSelectInstance?: (instance: InstanceSummary) => void;
  onSelectCallback?: () => void;
  withMenu?: boolean;
}

const InstancesView: React.FC<InstancesViewProps> = ({
  instances,
  selectedInstance,
  viewType,
  onSelectInstance,
  onSelectCallback = () => {},
  withMenu = true,
  ...boxProps
}) => {
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const handleSelectInstance = (instance: InstanceSummary) => {
    if (onSelectInstance) {
      onSelectInstance(instance);
    } else {
      update("states.shared.selectedInstanceId", instance.id);
    }
    onSelectCallback();
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
        <Radio
          value={instance.id}
          onClick={() => handleSelectInstance(instance)}
          colorScheme={primaryColor}
        />
        <Image
          boxSize="32px"
          src={getInstanceIconSrc(instance.iconSrc, instance.versionPath)}
          alt={instance.name}
          fallbackSrc="/images/icons/JEIcon_Release.png"
        />
      </HStack>
    ),
    ...(!withMenu && {
      isFullClickZone: true,
      onClick: () => handleSelectInstance(instance),
    }),
    children: withMenu ? (
      <InstanceMenu instance={instance} variant="buttonGroup" />
    ) : (
      <></>
    ),
  }));

  const gridItems = instances.map((instance) => ({
    cardContent: {
      title: instance.name,
      description: generateInstanceDesc(instance) || String.fromCharCode(160),
      image: (
        <Image
          boxSize="36px"
          src={getInstanceIconSrc(instance.iconSrc, instance.versionPath)}
          alt={instance.name}
          fallbackSrc="/images/icons/JEIcon_Release.png"
        />
      ),
      extraContent: (
        <HStack spacing={1} position="absolute" top={0.5} right={1}>
          {instance.starred && <Icon as={FaStar} color="yellow.500" />}
          {withMenu && <InstanceMenu instance={instance} />}
        </HStack>
      ),
    },
    isSelected: selectedInstance?.id === instance.id,
    radioValue: instance.id,
    onSelect: () => handleSelectInstance(instance),
  }));

  return (
    <Box {...boxProps}>
      {instances.length > 0 ? (
        <RadioGroup value={selectedInstance?.id}>
          {viewType === "list" ? (
            <OptionItemGroup items={listItems} />
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
