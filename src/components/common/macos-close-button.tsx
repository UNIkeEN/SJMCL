import { Box, ModalCloseButton } from "@chakra-ui/react";
import { useLauncherConfig } from "@/contexts/config";
import { isMacPlatform } from "@/utils/platform";

interface MacosCloseButtonProps {
  onClick: () => void;
}

export const MacosCloseButton: React.FC<MacosCloseButtonProps> = ({
  onClick,
}) => {
  const { config } = useLauncherConfig();
  const isMac = isMacPlatform(config.basicInfo.osType);

  if (!isMac) {
    return <ModalCloseButton onClick={onClick} />;
  }

  return (
    <Box
      as="button"
      type="button"
      position="absolute"
      top="11px"
      left="12px"
      w="12px"
      h="12px"
      borderRadius="full"
      bg="#ff5f57"
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      transition="all 0.1s"
      aria-label="Close"
      _hover={{
        "& .macos-close-icon": {
          opacity: 1,
        },
      }}
      _focus={{
        outline: "2px solid #007AFF",
        outlineOffset: "2px",
      }}
      onClick={onClick}
    >
      <Box
        className="macos-close-icon"
        w="6px"
        h="6px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        opacity={0}
        transition="opacity 0.1s"
      >
        <svg
          width="6"
          height="6"
          viewBox="0 0 6 6"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L5 5M5 1L1 5"
            stroke="black"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </Box>
    </Box>
  );
};
