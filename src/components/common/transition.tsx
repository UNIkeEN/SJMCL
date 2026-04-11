import { Fade as ChakraFade, FadeProps } from "@chakra-ui/react";
import { forwardRef } from "react";

export const Fade = forwardRef<HTMLDivElement, FadeProps>((props, ref) => {
  return (
    <ChakraFade
      ref={ref}
      {...props}
      style={{
        height: "100%",
        width: "100%",
        ...props.style,
      }}
      transition={{
        enter: { duration: 0.35, ease: "easeInOut" },
        exit: { duration: 0.3, ease: "easeOut" },
        ...props.transition,
      }}
    />
  );
});

Fade.displayName = "Fade";
