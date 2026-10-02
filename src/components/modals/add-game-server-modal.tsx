import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { GameServerInfo } from "@/models/instance/misc";
import { InstanceService } from "@/services/instance";

interface AddGameServerModalProps extends Omit<ModalProps, "children"> {
  presetAddr?: string;
  instanceId: string;
  /** When set, the modal edits this servers.dat entry instead of appending. */
  editingServer?: GameServerInfo | null;
  /** Called after a successful add/update so the parent can refresh selectively. */
  onSuccess?: (payload: { mode: "add" | "edit"; index: number }) => void;
}

const AddGameServerModal: React.FC<AddGameServerModalProps> = ({
  presetAddr = "",
  instanceId,
  editingServer = null,
  onSuccess,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { isOpen, onClose } = modalProps;
  const initialRef = useRef(null);

  const isEditing = editingServer != null;

  const [serverAddr, setServerAddr] = useState<string>("");
  const [serverName, setServerName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isServerAddrTouched, setIsServerAddrTouched] = useState(false);
  const trimmedServerAddr = serverAddr.trim();
  const isServerAddrInvalid = isServerAddrTouched && !trimmedServerAddr;
  const serverNamePlaceholder = t("AddGameServerModal.placeholder.serverName");

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        setServerAddr(editingServer.ip);
        setServerName(editingServer.name);
      } else {
        setServerAddr(presetAddr);
        setServerName("");
      }
      setIsServerAddrTouched(false);
    }
  }, [isOpen, presetAddr, isEditing, editingServer]);

  const handleSubmit = useCallback(() => {
    if (!instanceId || !trimmedServerAddr) return;
    setIsLoading(true);

    const finalServerName =
      serverName.trim() ||
      (isEditing ? editingServer.name : serverNamePlaceholder);

    const request = isEditing
      ? InstanceService.updateGameServer(
          instanceId,
          editingServer.index,
          trimmedServerAddr,
          finalServerName
        )
      : InstanceService.addGameServer(
          instanceId,
          trimmedServerAddr,
          finalServerName
        );

    request
      .then((response) => {
        if (response.status === "success") {
          toast({
            title: response.message,
            status: "success",
          });
          const index = isEditing
            ? editingServer.index
            : typeof response.data === "number"
              ? response.data
              : -1;
          if (index >= 0) {
            onSuccess?.({ mode: isEditing ? "edit" : "add", index });
          }
          onClose?.();
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [
    instanceId,
    trimmedServerAddr,
    serverName,
    isEditing,
    editingServer,
    serverNamePlaceholder,
    toast,
    onSuccess,
    onClose,
  ]);

  return (
    <Modal
      size={{ base: "md", lg: "lg", xl: "xl" }}
      initialFocusRef={initialRef}
      returnFocusOnClose={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isEditing
            ? t("AddGameServerModal.header.editTitle")
            : t("AddGameServerModal.header.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl isInvalid={isServerAddrInvalid} isRequired>
              <FormLabel htmlFor="serverAddr">
                {t("AddGameServerModal.label.serverAddr")}
              </FormLabel>
              <Input
                id="serverAddr"
                type="url"
                placeholder={t("AddGameServerModal.placeholder.serverAddr")}
                value={serverAddr}
                onChange={(e) => setServerAddr(e.target.value)}
                onBlur={() => setIsServerAddrTouched(true)}
                ref={initialRef}
                focusBorderColor={`${primaryColor}.500`}
              />
              {isServerAddrInvalid && (
                <FormErrorMessage>
                  {t("AddGameServerModal.serverAddrRequired")}
                </FormErrorMessage>
              )}
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="serverName">
                {t("AddGameServerModal.label.serverName")}
              </FormLabel>
              <Input
                id="serverName"
                type="text"
                placeholder={serverNamePlaceholder}
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                focusBorderColor={`${primaryColor}.500`}
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleSubmit}
            isLoading={isLoading}
            isDisabled={!trimmedServerAddr}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddGameServerModal;
