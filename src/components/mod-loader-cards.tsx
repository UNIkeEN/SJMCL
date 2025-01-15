import {
  BoxProps,
  Card,
  Flex,
  Grid,
  HStack,
  Icon,
  IconButton,
  Image,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuChevronRight } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";

interface ModLoaderCardsProps extends BoxProps {
  installedType: "none" | "Fabric" | "Forge" | "NeoForge";
  installedVersion?: string;
}

const ModLoaderCards: React.FC<ModLoaderCardsProps> = ({
  installedType,
  installedVersion,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const baseTypes = ["Fabric", "Forge", "NeoForge"];
  const loaderTypes =
    installedType === "none"
      ? baseTypes
      : [installedType, ...baseTypes.filter((type) => type !== installedType)];

  const renderCard = (type: string) => {
    const isInstalled = type === installedType && installedType !== "none";
    return (
      <Card
        key={type}
        className="content-card"
        pr={1.5}
        variant={isInstalled ? "outline" : "elevated"}
        borderColor={isInstalled ? `${primaryColor}.500` : "transparent"}
      >
        <Flex justify="space-between" alignItems="center">
          <HStack spacing={2}>
            <Image
              src={`/images/icons/${type}.png`}
              alt={type}
              boxSize="28px"
              style={{ borderRadius: "4px" }}
            />
            <VStack spacing={0} alignItems="start">
              <Text
                fontSize="xs-sm"
                className="no-select"
                fontWeight={isInstalled ? "bold" : "normal"}
                color={isInstalled ? primaryColor : "inherit"}
                mt={isInstalled ? -0.5 : 0}
              >
                {type}
              </Text>
              <Text fontSize="xs" className="secondary-text no-select">
                {isInstalled
                  ? `${t("ModLoaderCards.installed")} ${installedVersion}`
                  : t("ModLoaderCards.unInstalled")}
              </Text>
            </VStack>
          </HStack>
          <IconButton
            aria-label={type}
            icon={<Icon as={LuChevronRight} boxSize={3.5} />}
            variant="ghost"
            size="xs"
          />
        </Flex>
      </Card>
    );
  };

  return (
    <Grid
      templateColumns={
        installedType === "none" ? "repeat(3, 1fr)" : "1.35fr 1fr 1fr"
      }
      gap={3.5}
      {...boxProps}
    >
      {loaderTypes.map(renderCard)}
    </Grid>
  );
};

export default ModLoaderCards;
