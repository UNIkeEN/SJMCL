import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, address: string) => void;
}

export const AddServerModal = ({
  isOpen,
  onClose,
  onAdd,
}: AddServerModalProps) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  useEffect(() => {
    if (!address || !address.includes(".") || address.length < 3) {
      setQueryResult(null);
      setIsQuerying(false);
      return;
    }

    const delayTimer = setTimeout(async () => {
      setIsQuerying(true);
      try {
        const result = await invoke("ping_server", { address });
        setQueryResult(result);
      } catch (err) {
        setQueryResult({ error: true });
      } finally {
        setIsQuerying(false);
      }
    }, 600);

    return () => clearTimeout(delayTimer);
  }, [address]);

  const handleConfirm = () => {
    if (address.trim()) {
      onAdd(name || "Minecraft Server", address.trim());
      handleClose();
    }
  };

  const handleClose = () => {
    setName("");
    setAddress("");
    setQueryResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="sm">
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent
        bg="rgba(25, 25, 25, 0.9)"
        color="white"
        borderRadius="xl"
        border="1px solid rgba(255,255,255,0.1)"
      >
        <ModalHeader fontSize="md">添加服务器</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontSize="xs" opacity={0.6}>
                名称 (可选)
              </FormLabel>
              <Input
                variant="filled"
                bg="rgba(0,0,0,0.3)"
                _hover={{ bg: "rgba(0,0,0,0.4)" }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel fontSize="xs" opacity={0.6}>
                地址 (IP / 域名)
              </FormLabel>
              <Input
                variant="filled"
                bg="rgba(0,0,0,0.3)"
                _hover={{ bg: "rgba(0,0,0,0.4)" }}
                placeholder="play.example.com"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </FormControl>

            {/*overview */}
            <Box
              minH="70px"
              p={3}
              borderRadius="md"
              bg="whiteAlpha.50"
              border="1px solid"
              borderColor="whiteAlpha.100"
            >
              {isQuerying ? (
                <HStack spacing={3}>
                  <Skeleton
                    startColor="whiteAlpha.200"
                    endColor="whiteAlpha.300"
                    borderRadius="sm"
                    boxSize="40px"
                  />

                  <VStack align="start" spacing={2} flex={1}>
                    <Skeleton
                      startColor="whiteAlpha.200"
                      endColor="whiteAlpha.300"
                      h="12px"
                      w="80%"
                    />
                    <Skeleton
                      startColor="whiteAlpha.200"
                      endColor="whiteAlpha.300"
                      h="10px"
                      w="40%"
                    />
                  </VStack>
                </HStack>
              ) : queryResult?.error ? (
                <Text fontSize="xs" color="red.300" textAlign="center" py={4}>
                  无法解析或连接服务器
                </Text>
              ) : queryResult ? (
                <HStack spacing={3}>
                  <Image
                    src={queryResult.favicon}
                    alt="Server Favicon"
                    fallbackSrc="/images/icons/UnknownWorld.webp"
                    boxSize="40px"
                    borderRadius="sm"
                  />
                  <VStack align="start" spacing={0} flex={1}>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      noOfLines={1}
                      color="blue.200"
                    >
                      {queryResult.motd || "Minecraft Server"}
                    </Text>
                    <Text fontSize="2xs" opacity={0.6}>
                      {queryResult.version} • {queryResult.players}/
                      {queryResult.maxPlayers}
                    </Text>
                  </VStack>
                  <Badge colorScheme="green" variant="subtle" fontSize="2xs">
                    在线
                  </Badge>
                </HStack>
              ) : (
                <Text
                  fontSize="xs"
                  color="whiteAlpha.400"
                  textAlign="center"
                  py={4}
                >
                  输入地址后自动预览
                </Text>
              )}
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button size="sm" variant="ghost" mr={3} onClick={handleClose}>
            取消
          </Button>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={handleConfirm}
            isDisabled={!address.trim() || isQuerying}
          >
            确定添加
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddServerModal;
