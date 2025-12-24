import { Box, BoxProps, Image } from "@chakra-ui/react";
import { base64ImgSrc } from "@/utils/string";

interface PlayerAvatarProps extends BoxProps {
  avatar: Array<string>;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ avatar, ...props }) => {
  return (
    <Box position="relative" display="inline-block" {...props}>
      {!!avatar[0] && (
        <Image
          src={base64ImgSrc(avatar[0])}
          alt="face"
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          filter="drop-shadow(0 0 1px rgba(0, 0, 0, 0.3))"
        />
      )}
      {!!avatar[1] && (
        <Image
          src={base64ImgSrc(avatar[1])}
          alt="hat"
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          filter="drop-shadow(0 0 2px rgba(0, 0, 0, 0.3))"
        />
      )}
    </Box>
  );
};

export default PlayerAvatar;
