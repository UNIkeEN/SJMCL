import { HStack, Icon, IconButton, Image, Tooltip } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuFolderOpen } from "react-icons/lu";
import { WrapCardGroup } from "@/components/common/wrap-card";
import { mockScreenshots } from "@/models/game-instance";

const ScreenshotsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <HStack w="100%" h="100%" align="start" justify="space-between">
      <WrapCardGroup
        title={t("ScreenshotsPage.title")}
        spacing={3.5}
        cardAspectRatio={16 / 9}
        items={mockScreenshots.map((screenshot) => ({
          cardContent: (
            <>
              <Image
                src={screenshot.imgUrl}
                alt={screenshot.fileName}
                objectFit="cover"
                w="100%"
                h="100%"
                position="relative"
                borderRadius="md"
              />
              <Tooltip
                label={t("ScreenshotsPage.openFolder")}
                placement="right"
              >
                <IconButton
                  icon={<Icon as={LuFolderOpen} />}
                  aria-label={t("ScreenshotsPage.openFolder")}
                  variant="solid"
                  size="xs"
                  colorScheme="blackAlpha"
                  position="absolute"
                  top={1}
                  right={1}
                />
              </Tooltip>
            </>
          ),
          p: 0,
        }))}
      />
    </HStack>
  );
};

export default ScreenshotsPage;
