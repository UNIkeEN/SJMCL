import {
  Button,
  HStack,
  IconButton,
  Image,
  Tag,
  TagLabel,
  Text,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuPlus, LuTrash } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import AddDiscoverSourceModal from "@/components/modals/add-post-source-modal";
import { useLauncherConfig } from "@/contexts/config";
import { NewsSourceInfo } from "@/models/news-post";
import { DiscoverService } from "@/services/discover";

export const DiscoverSourcesPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const sources = config.discoverSourceEndpoints;

  const [sourcesInfo, setSourcesInfo] = useState<NewsSourceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    isOpen: isAddDiscoverSourceModalOpen,
    onOpen: onAddDiscoverSourceModalOpen,
    onClose: onAddDiscoverSourceModalClose,
  } = useDisclosure();

  const handleFetchNewsSourcesInfo = useCallback(() => {
    DiscoverService.fetchNewsSourcesInfo().then((response) => {
      if (response.status === "success") {
        setSourcesInfo(response.data);
        setIsLoading(false);
      }
      // no toast here, keep slient if no internet connection or etc.
    });
  }, [setSourcesInfo]);

  const handleRemoveSource = (urlToRemove: string) => {
    const updated = sources.filter((url) => url !== urlToRemove);
    update("discoverSourceEndpoints", updated);
    setSourcesInfo(updated.map((url) => ({ endpointUrl: url })));
    handleFetchNewsSourcesInfo();
  };

  useEffect(() => {
    if (sources.length === 0) return;
    // iniailly load url from config
    setSourcesInfo(
      sources.map((url) => ({
        endpointUrl: url,
      }))
    );
    // query details use invoke
    handleFetchNewsSourcesInfo();
  }, [sources, handleFetchNewsSourcesInfo]);

  return (
    <Section
      className="content-full-y"
      title={t("DiscoverPage.sources")}
      withBackButton
      headExtra={
        <Button
          leftIcon={<LuPlus />}
          size="xs"
          colorScheme={primaryColor}
          onClick={onAddDiscoverSourceModalOpen}
        >
          {t("DiscoverSourcesPage.button.addSource")}
        </Button>
      }
    >
      {sourcesInfo.length > 0 ? (
        <OptionItemGroup
          items={sourcesInfo.map((source) => (
            <OptionItem
              key={source.endpointUrl}
              title={source.name || ""}
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
                  fallbackSrc="/images/icons/UnknownWorld.webp"
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
                  <Tag colorScheme="green">
                    <LuCheck />
                    <TagLabel ml={0.5}>
                      {t("DiscoverSourcesPage.tag.online")}
                    </TagLabel>
                  </Tag>
                )}
                {isLoading && <BeatLoader size={6} color="grey" />}
                <Tooltip label={t("DiscoverSourcesPage.button.deleteSource")}>
                  <IconButton
                    size="sm"
                    aria-label="delete-source"
                    icon={<LuTrash />}
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => handleRemoveSource(source.endpointUrl)}
                  />
                </Tooltip>
              </HStack>
            </OptionItem>
          ))}
        />
      ) : (
        <Empty
          withIcon={false}
          size="sm"
          description={t("DiscoverPage.NoSources")}
        />
      )}
      <AddDiscoverSourceModal
        isOpen={isAddDiscoverSourceModalOpen}
        onClose={onAddDiscoverSourceModalClose}
      />
    </Section>
  );
};

export default DiscoverSourcesPage;
