import { Box } from "@chakra-ui/react";
import { useLauncherConfig } from "@/contexts/config";

interface WindowsCloseButtonProps {
  onClick: () => void;
}

export const WindowsCloseButton: React.FC<WindowsCloseButtonProps> = ({
  onClick,
}) => {
  const { config } = useLauncherConfig();
  const isMac =
    config.basicInfo.osType === "macos" || config.basicInfo.osType === "darwin";

  if (!isMac) return null;

  return (
    <Box
      as="button"
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
      _hover={{
        "& .windows-close-icon": {
          opacity: 1,
        },
      }}
      onClick={onClick}
    >
      <Box
        className="windows-close-icon"
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
