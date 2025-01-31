import {
  BoxProps,
  Center,
  Fade,
  Icon,
  Image,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import { LuBox, LuCalendarClock } from "react-icons/lu";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { mockScreenshots } from "@/models/mock/game-instance";

// All these widgets are used in InstanceContext with WarpCard wrapped.
interface InstanceWidgetBaseProps extends Omit<BoxProps, "children"> {
  title?: string;
  children: React.ReactNode;
  icon?: IconType;
}

const InstanceWidgetBase: React.FC<InstanceWidgetBaseProps> = ({
  title,
  children,
  icon: IconComponent,
  ...props
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  return (
    <VStack align="stretch" spacing={2} {...props}>
      {title && (
        <Text
          fontSize="md"
          fontWeight="bold"
          lineHeight="16px" // the same as fontSize 'md'
          mb={1}
          zIndex={999}
          color="white"
          mixBlendMode="exclusion"
          noOfLines={1}
        >
          {title}
        </Text>
      )}
      {children}
      {IconComponent && (
        <Icon
          as={IconComponent}
          position="absolute"
          color={`${primaryColor}.100`}
          boxSize={20}
          bottom={-5}
          right={-5}
        />
      )}
    </VStack>
  );
};

export const InstanceBasicInfoWidget = () => {
  const { t } = useTranslation();
  const { summary } = useInstanceSharedData();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.basicInfo.title")}
      icon={LuBox}
    >
      <OptionItem
        title={t("InstanceWidgets.basicInfo.gameVersion")}
        description={
          <VStack
            spacing={0}
            fontSize="xs"
            alignItems="flex-start"
            className="secondary-text"
          >
            <Text>{summary?.version}</Text>
            {summary?.modLoader.type && (
              <Text>{`${summary.modLoader.type} ${summary?.modLoader.version}`}</Text>
            )}
          </VStack>
        }
        prefixElement={
          <Image src={summary?.iconSrc} alt={summary?.iconSrc} boxSize="28px" />
        }
      />
      <OptionItem
        title={t("InstanceWidgets.basicInfo.playTime")}
        description={"12.1 小时"}
        prefixElement={
          <Center boxSize={7} color={`${primaryColor}.600`}>
            <LuCalendarClock fontSize="24px" />
          </Center>
        }
      />
    </InstanceWidgetBase>
  );
};

export const InstanceScreenshotsWidget = () => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % mockScreenshots.length);
    }, 10000); // carousel (TODO: transition)
    return () => clearInterval(interval);
  }, []);

  return (
    <InstanceWidgetBase title={t("InstanceWidgets.screenshots.title")}>
      <Image
        src={mockScreenshots[currentIndex].imgSrc}
        alt={mockScreenshots[currentIndex].fileName}
        objectFit="cover"
        position="absolute"
        borderRadius="md"
        w="100%"
        h="100%"
        ml={-3}
        mt={-3}
      />
    </InstanceWidgetBase>
  );
};
