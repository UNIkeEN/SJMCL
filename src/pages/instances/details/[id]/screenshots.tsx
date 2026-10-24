import { Center, Image, useDisclosure } from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import router from "next/router";
import { useCallback, useEffect, useState } from "react";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import { WrapCardGroup } from "@/components/common/wrap-card";
import PreviewScreenshotModal from "@/components/modals/preview-screenshot-modal";
import { useInstanceSharedData } from "@/contexts/instance";
import { GetStateFlag } from "@/hooks/get-state";
import { ScreenshotInfo } from "@/models/instance/misc";

const InstanceScreenshotsPage: React.FC = () => {
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
          pathname: "/instances/details/[id]/screenshots",
          query: { id: instanceId },
        },
        undefined,
        { shallow: true }
      );
    }
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
            as: "button",
            "aria-label": screenshot.fileName,
            cardContent: (
              <Image
                src={convertFileSrc(screenshot.filePath)}
                alt={screenshot.fileName}
                objectFit="cover"
                w="100%"
                h="100%"
                borderRadius="md"
              />
            ),
            isFullClickZone: true,
            onSelect: () => {
              setCurrentScreenshot(screenshot);
              onScreenshotPreviewModalOpen();
            },
            sx: {
              padding: "0 !important",
            },
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
