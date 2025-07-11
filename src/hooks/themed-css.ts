import { useColorMode, useColorModeValue } from "@chakra-ui/react";
import { useEffect } from "react";
import cardStylesDark from "@/styles/dark/card.module.css";
import liquidGlassStylesDark from "@/styles/dark/liquid-glass.module.css";
import cardStylesLight from "@/styles/light/card.module.css";
import liquidGlassStylesLight from "@/styles/light/liquid-glass.module.css";

export const useThemedCSSStyle = () => {
  const { colorMode } = useColorMode();
  const styles = useColorModeValue(
    { card: cardStylesLight, liquidGlass: liquidGlassStylesLight },
    { card: cardStylesDark, liquidGlass: liquidGlassStylesDark }
  );

  useEffect(() => {
    const cssFiles = ["card.module.css", "liquid-glass.module.css"];

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
