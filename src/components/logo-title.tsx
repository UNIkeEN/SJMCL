import { BoxProps, HStack, Heading, Image } from "@chakra-ui/react";

interface LogoTitleProps extends BoxProps {}

const pixelFont = {
  fontFamily: "'Silkscreen', monospace",
  letterSpacing: "0.02em",
};

export const TitleShort: React.FC<LogoTitleProps> = (props) => {
  return (
    <Heading size="md" style={pixelFont} {...props}>
      Easy-Launcher
    </Heading>
  );
};

export const TitleFull: React.FC<LogoTitleProps> = (props) => {
  return (
    <Heading size="md" style={pixelFont} {...props}>
      easy-launcher
    </Heading>
  );
};

export const TitleFullWithLogo: React.FC<LogoTitleProps> = (props) => {
  return (
    <HStack>
      <Image src="/images/icons/Logo_128x128.png" alt="Logo" boxSize="36px" />
      <TitleFull {...props} />
    </HStack>
  );
};
