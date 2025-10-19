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
import { LuChevronRight, LuX } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { ModLoaderType } from "@/enums/instance";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import { parseModLoaderVersion } from "@/utils/instance";

interface ModLoaderCardsProps extends BoxProps {
  currentType: ModLoaderType;
  currentVersion?: string;
  displayMode: "entry" | "selector";
  loading?: boolean;
  onTypeSelect?: (type: ModLoaderType) => void;
}

const ModLoaderCards: React.FC<ModLoaderCardsProps> = ({
  currentType,
  currentVersion,
  displayMode,
  loading = false,
  onTypeSelect,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const themedStyles = useThemedCSSStyle();

  const borderWidth = "1px";
  const basePadding = boxProps.padding || "12px";
  const selectedPadding = `calc(${basePadding} - ${borderWidth})`;

  const loaderTypes: ModLoaderType[] = [
    ModLoaderType.Fabric,
    ModLoaderType.Forge,
    ModLoaderType.NeoForge,
  ];

  const renderCard = (type: ModLoaderType) => {
    const isSelected =
      type === currentType && currentType !== ModLoaderType.Unknown;

    return (
      <Card
        key={type}
        className={themedStyles.card["card-front"]}
        pr={1.5}
        variant={isSelected ? "outline" : "elevated"}
        borderColor={isSelected ? `${primaryColor}.500` : "transparent"}
        borderWidth={isSelected ? borderWidth : 0}
        p={isSelected ? selectedPadding : basePadding}
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
                fontWeight={isSelected ? "bold" : "normal"}
                color={isSelected ? `${primaryColor}.600` : "inherit"}
                mt={displayMode === "entry" && isSelected ? -0.5 : 0}
              >
                {type}
              </Text>
              <Text fontSize="xs" className="secondary-text">
                {displayMode === "entry"
                  ? isSelected
                    ? `${t("ModLoaderCards.installed")} ${parseModLoaderVersion(currentVersion || "")}`
                    : t("ModLoaderCards.unInstalled")
                  : isSelected
                    ? currentVersion || t("ModLoaderCards.versionNotSelected")
                    : currentType === ModLoaderType.Unknown
                      ? t("ModLoaderCards.versionNotSelected")
                      : t("ModLoaderCards.notCompatibleWith", {
                          modLoader: currentType,
                        })}
              </Text>
            </VStack>
          </HStack>
          <IconButton
            aria-label={type}
            icon={
              <Icon
                as={
                  displayMode === "selector" && isSelected
                    ? LuX
                    : LuChevronRight
                }
                boxSize={3.5}
              />
            }
            variant="ghost"
            size="xs"
            disabled={loading}
            onClick={() => onTypeSelect?.(type)}
          />
        </Flex>
      </Card>
    );
  };

  return (
    <>
      <Grid templateColumns="repeat(3, 1fr)" gap={3.5} {...boxProps}>
        {loaderTypes.map(renderCard)}
      </Grid>
    </>
  );
};

export default ModLoaderCards;
