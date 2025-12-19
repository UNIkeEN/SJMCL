import { Box, Image, ImageProps } from "@chakra-ui/react";
import { base64ImgSrc } from "@/utils/string";

interface AvatarWrapperProps extends ImageProps {
  avatar: Array<string>;
}

const AvatarWrapper: React.FC<AvatarWrapperProps> = ({ avatar, ...props }) => {
  return (
    <Box position="relative" display="inline-block" {...props}>
      <Image
        src={base64ImgSrc(avatar[0])}
        alt="face"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 0 1px rgba(0, 0, 0, 0.3))",
        }}
      />
      <Image
        src={base64ImgSrc(avatar[1])}
        alt="hat"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 0 2px rgba(0, 0, 0, 0.3))",
        }}
      />
    </Box>
  );
};

export default AvatarWrapper;
