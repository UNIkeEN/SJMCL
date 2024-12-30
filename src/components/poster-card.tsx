import {
  Card,
  CardBody,
  CardProps,
  Image,
  Text,
  VStack,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useState } from "react";
import { useLauncherConfig } from "@/contexts/config";
import { PostSummary } from "@/models/post";

interface PosterCardProps extends CardProps {
  data: PostSummary;
}

// used in discover page, under masonry container
const PosterCard = ({ data }: PosterCardProps) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { title, abstract, imageSrc, link } = data;
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
        <VStack spacing={0} alignItems="start" overflow="hidden">
          <Text fontSize="xs-sm" className="no-select">
            {title}
          </Text>
          {abstract && (
            <Text fontSize="xs" className="secondary-text no-select">
              {abstract}
            </Text>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

export default PosterCard;
