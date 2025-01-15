import {
  Avatar,
  Card,
  CardBody,
  CardProps,
  HStack,
  Image,
  Tag,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCalendar } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { PostSourceInfo, PostSummary } from "@/models/post";
import { formatRelativeTime } from "@/utils/datetime";

interface PosterCardProps extends CardProps {
  data: PostSummary;
}

// used in discover page, under masonry container
const PosterCard = ({ data }: PosterCardProps) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { title, abstract, keywords, imageSrc, source, updateAt, link } = data;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className="content-card"
      cursor="pointer"
      overflow="hidden" // show the border
      p={0}
      borderColor={`${primaryColor}.500`}
      variant={isHovered ? "outline" : "elevated"}
      onClick={() => open(link)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {imageSrc && <Image objectFit="cover" src={imageSrc} alt={title} />}
      <CardBody p={3}>
        <VStack spacing={1} alignItems="start" overflow="hidden">
          <Text fontSize="xs-sm" className="no-select">
            {title}
          </Text>
          {keywords && keywords.trim() && (
            <Wrap spacing={1}>
              {keywords.split(",").map((keyword, index) => (
                <WrapItem key={index}>
                  <Tag size="sm" colorScheme={primaryColor}>
                    {keyword.trim()}
                  </Tag>
                </WrapItem>
              ))}
            </Wrap>
          )}
          {abstract && (
            <Text fontSize="xs" className="secondary-text no-select">
              {abstract}
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
