import {
  Button,
  HStack,
  IconButton,
  Image,
  Tag,
  TagLabel,
  TagLeftIcon,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuPlus, LuTrash } from "react-icons/lu";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { mockPostSources } from "@/models/mock/post";
import { PostSourceInfo } from "@/models/post";

export const DiscoverSourcesPage = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [sources, setSources] = useState<PostSourceInfo[]>([]);

  useEffect(() => {
    setSources(mockPostSources);
  }, []);

  return (
    <Section
      className="content-full-y"
      title={t("DiscoverPage.Button.sources")}
      withBackButton
      headExtra={
        <Button
          leftIcon={<LuPlus />}
          size="xs"
          colorScheme={primaryColor}
          isDisabled // TBD
        >
          {t("DiscoverSourcesPage.Button.addSource")}
        </Button>
      }
    >
      {sources.length > 0 ? (
        <OptionItemGroup
          items={sources.map((source) => (
            <OptionItem
              key={source.endpointUrl}
              isLoading={source.name == null}
              title={source.name || "Placeholder for Skeleton"}
              titleExtra={
                <Text className="secondary-text" fontSize="xs-sm">
                  {source.fullName}
                </Text>
              }
              prefixElement={
                <Image
                  src={source.iconSrc}
                  alt={source.iconSrc}
                  boxSize="28px"
                  style={{ borderRadius: "4px" }}
                />
              }
              description={
                <Text fontSize="xs-sm" className="secondary-text">
                  {source.endpointUrl}
                </Text>
              }
            >
              <HStack>
                {source.name && (
                  <Tag size="sm" colorScheme="green">
                    <LuCheck />
                    <TagLabel ml={0.5}>
                      {t("DiscoverSourcesPage.tag.online")}
                    </TagLabel>
                  </Tag>
                )}
                <Tooltip label={t("DiscoverSourcesPage.Button.deleteSource")}>
                  <IconButton
                    size="sm"
                    aria-label="delete-source"
                    icon={<LuTrash />}
                    variant="ghost"
                    colorScheme="red"
                  />
                </Tooltip>
              </HStack>
            </OptionItem>
          ))}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-xl font-bold">{t("DiscoverPage.NoSources")}</div>
        </div>
      )}
    </Section>
  );
};

export default DiscoverSourcesPage;
