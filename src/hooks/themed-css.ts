import { useColorMode, useColorModeValue } from "@chakra-ui/react";
import { useEffect } from "react";
import cardStylesDark from "@/styles/dark/card.module.css";
import cardStylesLight from "@/styles/light/card.module.css";

export const useThemedCSSStyle = () => {
  const { colorMode } = useColorMode();
  const styles = useColorModeValue(
    { card: cardStylesLight },
    { card: cardStylesDark }
  );

  useEffect(() => {
    const cssFiles = ["card.module.css", "other.module.css"];

    return () => {
      const links = document.querySelectorAll("link");
      links.forEach((link) => {
        cssFiles.forEach((file) => {
          if (link.href.includes(file)) {
            link.remove();
          }
        });
      });
    };
  }, [colorMode]);

  return styles;
};
