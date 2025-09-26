import {
  Center,
  IconButton,
  Image,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import router from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEllipsis } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import { WrapCardGroup } from "@/components/common/wrap-card";
import PreviewScreenshotModal from "@/components/modals/preview-screenshot-modal";
import { useInstanceSharedData } from "@/contexts/instance";
import { GetStateFlag } from "@/hooks/get-state";
import { ScreenshotInfo } from "@/models/instance/misc";

const InstanceScreenshotsPage: React.FC = () => {
  const { t } = useTranslation();

  const { getScreenshotList, isScreenshotListLoading: isLoading } =
    useInstanceSharedData();
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [currentScreenshot, setCurrentScreenshot] =
    useState<ScreenshotInfo | null>(null);

  const getScreenshotListWrapper = useCallback(
    (sync?: boolean) => {
      getScreenshotList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return;
          setScreenshots(data || []);
        })
        .catch((e) => setScreenshots([]));
    },
    [getScreenshotList]
  );

  useEffect(() => {
    getScreenshotListWrapper();
  }, [getScreenshotListWrapper]);

  useEffect(() => {
    // This page does not have a refresh button, so we need to fetch the screenshot list when the page is mounted
    getScreenshotListWrapper(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    isOpen: isScreenshotPreviewModalOpen,
    onOpen: onScreenshotPreviewModalOpen,
    onClose: onScreenshotPreviewModalClose,
  } = useDisclosure();

  useEffect(() => {
    const { screenshotIndex } = router.query;
    if (screenshotIndex) {
      setCurrentScreenshot(screenshots[Number(screenshotIndex)]);
      onScreenshotPreviewModalOpen();
    }
  }, [screenshots, onScreenshotPreviewModalOpen]);

  const handleCloseModal = () => {
    onScreenshotPreviewModalClose();
    const { id } = router.query;
    if (id !== undefined) {
      const instanceId = Array.isArray(id) ? id[0] : id;
      router.replace(
        {
          pathname: `/instances/details/${encodeURIComponent(instanceId)}/screenshots`,
          query: {},
        },
        undefined,
        { shallow: true }
      );
    }
  };

  const ScreenshotsCard = ({ screenshot }: { screenshot: ScreenshotInfo }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: "100%", height: "100%" }}
      >
        <Image
          src={convertFileSrc(screenshot.filePath)}
          alt={screenshot.fileName}
          objectFit="cover"
          w="100%"
          h="100%"
          position="relative"
          borderRadius="md"
        />
        {isHovered && (
          <Tooltip
            label={t("InstanceScreenshotsPage.button.details")}
            placement="auto"
          >
            <IconButton
              icon={<LuEllipsis />}
              aria-label="details"
              colorScheme="blackAlpha"
              variant="solid"
              size="xs"
              position="absolute"
              top={1}
              right={1}
              onClick={() => {
                setCurrentScreenshot(screenshot);
                onScreenshotPreviewModalOpen();
              }}
            />
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <Section>
      {isLoading ? (
        <Center mt={4}>
          <BeatLoader size={16} color="gray" />
        </Center>
      ) : screenshots.length > 0 ? (
        <WrapCardGroup
          cardAspectRatio={16 / 9}
          items={screenshots.map((screenshot) => ({
            cardContent: <ScreenshotsCard screenshot={screenshot} />,
            p: 0,
          }))}
        />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
      {currentScreenshot && (
        <PreviewScreenshotModal
          screenshot={currentScreenshot}
          isOpen={isScreenshotPreviewModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </Section>
  );
};

export default InstanceScreenshotsPage;
