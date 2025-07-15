import {
  Avatar,
  Card,
  CardBody,
  CardProps,
  HStack,
  Image,
  Skeleton,
  Tag,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCalendar } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import { PostSourceInfo, PostSummary } from "@/models/post";
import { formatRelativeTime } from "@/utils/datetime";
import { cleanHtmlText } from "@/utils/string";

interface PosterCardProps extends CardProps {
  data: PostSummary;
}

// used in discover page, under masonry container
const PosterCard = ({ data }: PosterCardProps) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const themedStyles = useThemedCSSStyle();

  const { title, abstract, keywords, imageSrc, source, updateAt, link } = data;
  const [isHovered, setIsHovered] = useState(false);
  const [src, width, height] = imageSrc || [];

  return (
    <Card
      className={themedStyles.card["card-front"]}
      cursor="pointer"
      overflow="hidden" // show the border
      p={0}
      borderColor={`${primaryColor}.500`}
      variant={isHovered ? "outline" : "elevated"}
      onClick={() => openUrl(link)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {src && (
        <Skeleton isLoaded={!!src} height="auto">
          <Image
            objectFit="cover"
            src={src}
            alt={title}
            width={width}
            height={height}
            style={{ height: "auto" }}
          />
        </Skeleton>
      )}

      <CardBody p={3}>
        <VStack spacing={1} alignItems="start" overflow="hidden">
          <Text fontSize="xs-sm">{title}</Text>
          {keywords && keywords.trim() && (
            <Wrap spacing={1}>
              {keywords.split(",").map((keyword, index) => (
                <WrapItem key={index}>
                  <Tag colorScheme={primaryColor}>{keyword.trim()}</Tag>
                </WrapItem>
              ))}
            </Wrap>
          )}
          {abstract && (
            <Text fontSize="xs" className="secondary-text">
              {cleanHtmlText(abstract)}
            </Text>
          )}
          <HStack className="secondary-text" fontSize="xs" mt={1} spacing={1}>
            <LuCalendar size={12} />
            <Text>{formatRelativeTime(updateAt, t).replace("on", "")}</Text>
            {(source as PostSourceInfo).name !== undefined && (
              <>
                <Avatar
                  name={source.name}
                  size="2xs"
                  src={source.iconSrc}
                  ml={1}
                />
                <Text>{source.name}</Text>
              </>
            )}
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default PosterCard;
