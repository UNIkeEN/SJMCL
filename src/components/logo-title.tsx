import { BoxProps, HStack, Heading, Highlight, Image } from "@chakra-ui/react";
import styles from "@/styles/logo-title.module.css";

interface LogoTitleProps extends BoxProps {}

export const TitleShort: React.FC<LogoTitleProps> = (props) => {
  return (
    <Heading size="md" className={styles.title} {...props}>
      <Highlight query="L" styles={{ color: "blue.600", userSelect: "none" }}>
        SJMCL
      </Highlight>
    </Heading>
  );
};

export const TitleFull: React.FC<LogoTitleProps> = (props) => {
  return (
    <Heading size="md" className={styles.title} {...props}>
      <Highlight query="L" styles={{ color: "blue.600", userSelect: "none" }}>
        SJMC Launcher
      </Highlight>
    </Heading>
  );
};

export const TitleFullWithLogo: React.FC<LogoTitleProps> = (props) => {
  return (
    <HStack>
      <Logo />
      <TitleFull {...props} />
    </HStack>
  );
};

export const Logo: React.FC<LogoTitleProps> = (props) => {
  return (
    <Image
      src="/images/icons/Logo_128x128.png"
      alt="Logo"
      boxSize="36px"
      {...props}
    />
  );
};
