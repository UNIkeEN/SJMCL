import { IconButton, Image, Tooltip } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEllipsis } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { Section } from "@/components/common/section";
import { WrapCardGroup } from "@/components/common/wrap-card";
import { Screenshot } from "@/models/game-instance";
import { mockScreenshots } from "@/models/mock/game-instance";

const InstanceScreenshotsPage: React.FC = () => {
  const { t } = useTranslation();

  const ScreenshotsCard = ({ screenshot }: { screenshot: Screenshot }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: "100%", height: "100%" }}
      >
        <Image
          src={screenshot.imgSrc}
          alt={screenshot.fileName}
          objectFit="cover"
          w="100%"
          h="100%"
          position="relative"
          borderRadius="md"
        />
        {isHovered && (
          <Tooltip
            label={t("InstanceScreenshotsPage.button.more")}
            placement="auto"
          >
            <IconButton
              icon={<LuEllipsis />}
              aria-label="more"
              colorScheme="blackAlpha"
              variant="solid"
              size="xs"
              position="absolute"
              top={1}
              right={1}
              onClick={() => {}}
            />
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <Section>
      <WrapCardGroup
        cardAspectRatio={16 / 9}
        items={mockScreenshots.map((screenshot) => ({
          cardContent: <ScreenshotsCard screenshot={screenshot} />,
          p: 0,
        }))}
      />
    </Section>
  );
};

export default InstanceScreenshotsPage;
