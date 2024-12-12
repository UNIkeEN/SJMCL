import {
  Alert,
  AlertIcon,
  Button,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import CreatePlayerModal from "@/components/modals/create-player-modal";
import { isProd } from "@/utils/env";

// ============================================================
// This page is only for developers to test components, etc.
// DO NOT commit changes to this page.
// ============================================================

const DevTestPage = () => {
  const router = useRouter();
  useEffect(() => {
    if (isProd) {
      router.push("/launch");
    }
  }, [router]);

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <VStack>
      <Alert status="warning" fontSize="sm" variant="left-accent">
        <AlertIcon />
        This Page is only for developer to test components and etc. It will not
        shown in production mode.
      </Alert>

      {/* Add test components here */}
      <CreatePlayerModal
        isOpen={isOpen}
        onClose={onClose}
        initialPlayerType="3rdparty"
      />
      <Button onClick={onOpen}>Open CreatePlayerModal</Button>
    </VStack>
  );
};

export default DevTestPage;
