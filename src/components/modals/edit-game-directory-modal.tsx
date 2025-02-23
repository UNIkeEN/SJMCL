import {
  Button,
  Flex,
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
  Stack,
  Text,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { useToast } from "@/contexts/toast";

interface EditGameDirectoryModalProps extends Omit<ModalProps, "children"> {
  add?: boolean;
  currentName?: string;
  currentPath?: string;
}

const EditGameDirectoryModal: React.FC<EditGameDirectoryModalProps> = ({
  add = false,
  currentName = "",
  currentPath = "",
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const initialRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { getGameInstanceList } = useData();

  const [dirName, setDirName] = useState<string>("");
  const [dirPath, setDirPath] = useState<string>("");
  const [isDirNameEmpty, setIsDirNameEmpty] = useState<boolean>(false);
  const [isDirNameTooLong, setIsDirNameTooLong] = useState<boolean>(false);
  const [isDirNameExist, setIsDirNameExist] = useState<boolean>(false);
  const [isDirPathExist, setIsDirPathExist] = useState<boolean>(false);

  const handleBrowseGameDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("EditGameDirectoryModal.dialog.title"),
      });

      if (selected) {
        setDirPath(selected);
        if (
          config.localGameDirectories.map((dir) => dir.dir).includes(selected)
        )
          setIsDirPathExist(true);
        else setIsDirPathExist(false);
      }
    } catch (error) {
      console.error("Error opening directory dialog:", error);
      setDirPath("");
      toast({
        title: t("EditGameDirectoryModal.toast.error.title"),
        status: "error",
      });
    }
  };

  const handleUpdateDir = () => {
    setDirName("");
    setDirPath("");
    if (add) {
      update("localGameDirectories", [
        ...config.localGameDirectories,
        {
          name: dirName,
          dir: dirPath,
        },
      ]);
    } else {
      update(
        "localGameDirectories",
        config.localGameDirectories.map((dir) =>
          dir.dir === currentPath ? { name: dirName, dir: dirPath } : dir
        )
      );
    }
    getGameInstanceList(true); // refresh frontend state of instance list
    modalProps.onClose();
  };

  useEffect(() => {
    setDirName(currentName);
    setDirPath(currentPath);
  }, [currentName, currentPath]);

  return (
    <Modal
      size={{ base: "md", lg: "lg", xl: "xl" }}
      initialFocusRef={initialRef}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t(`EditGameDirectoryModal.header.title.${add ? "add" : "edit"}`)}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Stack direction="column" spacing={3.5}>
            <FormControl
              isRequired
              isInvalid={
                isDirNameTooLong || isDirNameEmpty || (isDirNameExist && add)
              }
            >
              <FormLabel>{t("EditGameDirectoryModal.label.dirName")}</FormLabel>
              <Input
                placeholder={t("EditGameDirectoryModal.placeholder.dirName")}
                value={dirName}
                onChange={(e) => setDirName(e.target.value)}
                onBlur={() => {
                  setIsDirNameEmpty(dirName.length === 0);
                  setIsDirNameTooLong(dirName.length > 20);
                  setIsDirNameExist(
                    config.localGameDirectories
                      .map((dir) => dir.name)
                      .includes(dirName)
                  );
                }}
                onFocus={() => {
                  setIsDirNameEmpty(false);
                  setIsDirNameTooLong(false);
                  setIsDirNameExist(false);
                }}
                required
                ref={initialRef}
                focusBorderColor={`${primaryColor}.500`}
              />
              {isDirNameTooLong && (
                <FormErrorMessage>
                  {t("EditGameDirectoryModal.errorMessage.dirName.tooLong")}
                </FormErrorMessage>
              )}
              {isDirNameEmpty && (
                <FormErrorMessage>
                  {t("EditGameDirectoryModal.errorMessage.dirName.empty")}
                </FormErrorMessage>
              )}
              {isDirNameExist && add && (
                <FormErrorMessage>
                  {t("EditGameDirectoryModal.errorMessage.dirName.exist")}
                </FormErrorMessage>
              )}
            </FormControl>

            <FormControl isRequired isInvalid={isDirPathExist && add}>
              <FormLabel>{t("EditGameDirectoryModal.label.dirPath")}</FormLabel>
              <Flex direction="row" align="center">
                <Text className="secondary-text">
                  {dirPath
                    ? dirPath
                    : t("EditGameDirectoryModal.placeholder.dirPath")}
                </Text>
                <Button
                  size="sm"
                  onClick={handleBrowseGameDir}
                  colorScheme={primaryColor}
                  variant="ghost"
                  ml="auto"
                >
                  {t("EditGameDirectoryModal.button.browse")}
                </Button>
              </Flex>
              {isDirPathExist && add && (
                <FormErrorMessage>
                  {t("EditGameDirectoryModal.errorMessage.dirPath.exist")}
                </FormErrorMessage>
              )}
            </FormControl>
          </Stack>
        </ModalBody>

        <ModalFooter mt={1}>
          <Button variant="ghost" onClick={modalProps.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            disabled={
              !dirPath ||
              isDirNameEmpty ||
              isDirNameTooLong ||
              (isDirNameExist && add) ||
              (isDirPathExist && add)
            }
            colorScheme={primaryColor}
            onClick={handleUpdateDir}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditGameDirectoryModal;
