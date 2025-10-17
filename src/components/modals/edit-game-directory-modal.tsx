import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Stack,
  useDisclosure,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useRoutingHistory } from "@/contexts/routing-history";
import { useToast } from "@/contexts/toast";
import { ConfigService } from "@/services/config";
import { isPathSanitized } from "@/utils/string";

interface ActionSelectDialogProps extends Omit<ModalProps, "children"> {
  title: string;
  body: string | React.ReactElement;
  firstOption: string;
  secondOption: string;
  onFirstOption?: () => void;
  onSecondOption?: () => void;
}

interface EditGameDirectoryModalProps extends Omit<ModalProps, "children"> {
  add?: boolean;
  currentName?: string;
  currentPath?: string;
}

export const ActionSelectDialog: React.FC<ActionSelectDialogProps> = ({
  title,
  body,
  firstOption,
  secondOption,
  onFirstOption,
  onSecondOption,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      isOpen={modalProps.isOpen}
      leastDestructiveRef={cancelRef}
      onClose={modalProps.onClose}
      autoFocus={false}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{title}</AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody>{body}</AlertDialogBody>
          <AlertDialogFooter>
            <Button
              ref={cancelRef}
              onClick={modalProps.onClose}
              variant="ghost"
            >
              {t("General.cancel")}
            </Button>
            <Button colorScheme={primaryColor} onClick={onFirstOption}>
              {firstOption}
            </Button>
            <Button colorScheme={primaryColor} onClick={onSecondOption}>
              {secondOption}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

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
  const { getInstanceList } = useGlobalData();
  const { removeHistory, replaceHistory } = useRoutingHistory();

  const [dirName, setDirName] = useState<string>("");
  const [dirPath, setDirPath] = useState<string>("");
  const [subDirPath, setSubDirPath] = useState<string>("");
  const [isDirNameEmpty, setIsDirNameEmpty] = useState<boolean>(false);
  const [isDirNameTooLong, setIsDirNameTooLong] = useState<boolean>(false);
  const [isDirNameExist, setIsDirNameExist] = useState<boolean>(false);
  const [isDirNameInvalid, setIsDirNameInvalid] = useState<boolean>(false);
  const [isDirPathExist, setIsDirPathExist] = useState<boolean>(false);
  const [isDirPathInvalid, setIsDirPathInvalid] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {
    isOpen: isAddSubDirDialogOpen,
    onOpen: onAddSubDirDialogOpen,
    onClose: onAddSubDirDialogClose,
  } = useDisclosure();

  const handleBrowseGameDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("EditGameDirectoryModal.dialog.browse.title"),
      });

      if (selected) {
        setDirPath(selected);
        setIsDirPathExist(
          config.localGameDirectories
            .map((dir) => dir.dir)
            .includes(selected) && selected !== currentPath
        );
      }
    } catch (error) {
      setDirPath("");
      toast({
        title: t("EditGameDirectoryModal.toast.error.title"),
        status: "error",
      });
    }
  };

  const onDirPathBlur = () => {
    setDirPath((prevDirPath) => {
      let tempDirPath = prevDirPath;
      if (
        tempDirPath[tempDirPath.length - 1] === "/" ||
        tempDirPath[tempDirPath.length - 1] === "\\"
      )
        tempDirPath = tempDirPath.slice(0, -1);
      if (config.basicInfo.platform === "windows")
        tempDirPath = tempDirPath.replace(/\//g, "\\");
      else tempDirPath = tempDirPath.replace(/\\/g, "/");
      setIsDirPathExist(
        config.localGameDirectories
          .map((dir) => dir.dir)
          .includes(tempDirPath) && tempDirPath !== currentPath
      );
      return tempDirPath;
    }); // normalize path
  };

  const handleCheckGameDirectory = async (dir: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await ConfigService.checkGameDirectory(dir);
      if (response.status !== "success") {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
        return false;
      } else {
        if (response.data === "") return true;
        setSubDirPath(response.data);
        onAddSubDirDialogOpen();
        return false;
      }
    } catch (error) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubDir = async () => {
    handleUpdateDir(subDirPath);
    onAddSubDirDialogClose();
  };

  const handleAddOriginalDir = async () => {
    handleUpdateDir(dirPath, true);
    onAddSubDirDialogClose();
  };

  const handleUpdateDir = async (
    _dirPath: string,
    skipCheck: boolean = false
  ) => {
    if (!isPathSanitized(_dirPath)) {
      setIsDirPathInvalid(true);
      return;
    }
    if (currentPath === _dirPath && currentName === dirName) {
      setDirName("");
      setDirPath("");
      modalProps.onClose();
      return;
    }
    if (!skipCheck && _dirPath !== currentPath) {
      const isValid = await handleCheckGameDirectory(_dirPath);
      if (!isValid) return;
    }
    if (add) {
      update("localGameDirectories", [
        ...config.localGameDirectories,
        {
          name: dirName,
          dir: _dirPath,
        },
      ]);
    } else {
      update(
        "localGameDirectories",
        config.localGameDirectories.map((dir) =>
          dir.dir === currentPath ? { name: dirName, dir: _dirPath } : dir
        )
      );

      if (currentPath === _dirPath) {
        // only update dir name, instance not changed
        replaceHistory(
          `/instances/details/${currentName}:`,
          `/instances/details/${dirName}:`
        );
      } else {
        // update dir path, instance may change, remove all route history
        removeHistory(`/instances/details/${currentName}:`);
      }
      replaceHistory(
        `/instances/list/${currentName}`,
        `/instances/list/${dirName}`
      );
    }
    getInstanceList(true); // refresh frontend state of instance list
    setDirName("");
    setDirPath("");
    setSubDirPath("");
    modalProps.onClose();
  };

  useEffect(() => {
    if (currentName) setDirName(currentName);
    if (currentPath) setDirPath(currentPath);
  }, [currentName, currentPath, modalProps.isOpen]);

  const handleCloseModal = () => {
    setIsDirNameEmpty(false);
    setIsDirNameTooLong(false);
    setIsDirNameExist(false);
    setIsDirNameInvalid(false);
    setIsDirPathExist(false);
    setIsDirPathInvalid(false);
    setIsLoading(false);
    modalProps.onClose();
  };

  return (
    <Modal
      size={{ base: "md", lg: "lg", xl: "xl" }}
      initialFocusRef={initialRef}
      {...modalProps}
      onClose={handleCloseModal}
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
                isDirNameTooLong ||
                isDirNameEmpty ||
                isDirNameInvalid ||
                isDirNameExist
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
                      .includes(dirName) && dirName !== currentName
                  );
                  setIsDirNameInvalid(/[\/:\\?#&%]/.test(dirName));
                }}
                onFocus={() => {
                  setIsDirNameEmpty(false);
                  setIsDirNameTooLong(false);
                  setIsDirNameExist(false);
                  setIsDirNameInvalid(false);
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
              {isDirNameInvalid && (
                <FormErrorMessage>
                  {t(
                    "EditGameDirectoryModal.errorMessage.dirName.hasInvalidChar"
                  )}
                </FormErrorMessage>
              )}
              {isDirNameExist && (
                <FormErrorMessage>
                  {t("EditGameDirectoryModal.errorMessage.dirName.exist")}
                </FormErrorMessage>
              )}
            </FormControl>

            <FormControl
              isRequired
              isInvalid={isDirPathExist || isDirPathInvalid}
            >
              <FormLabel>{t("EditGameDirectoryModal.label.dirPath")}</FormLabel>
              <Flex direction="row" align="center">
                <InputGroup size="sm">
                  <Input
                    pr={12}
                    value={dirPath}
                    onChange={(e) => setDirPath(e.target.value)}
                    placeholder={t(
                      "EditGameDirectoryModal.placeholder.dirPath"
                    )}
                    onFocus={() => {
                      setIsDirPathExist(false);
                      setIsDirPathInvalid(false);
                    }}
                    onBlur={onDirPathBlur}
                  />
                  <InputRightElement w={16}>
                    <Button
                      h={6}
                      size="sm"
                      variant="ghost"
                      onClick={handleBrowseGameDir}
                      colorScheme={primaryColor}
                    >
                      {t("General.browse")}
                    </Button>
                  </InputRightElement>
                </InputGroup>
              </Flex>
              {isDirPathExist && (
                <FormErrorMessage>
                  {t("EditGameDirectoryModal.errorMessage.dirPath.exist")}
                </FormErrorMessage>
              )}
              {isDirPathInvalid && (
                <FormErrorMessage>
                  {t("EditGameDirectoryModal.errorMessage.dirPath.invalid")}
                </FormErrorMessage>
              )}
            </FormControl>
          </Stack>
        </ModalBody>

        <ModalFooter mt={1}>
          <Button variant="ghost" onClick={handleCloseModal}>
            {t("General.cancel")}
          </Button>
          <Button
            disabled={
              !dirPath ||
              isDirNameEmpty ||
              isDirNameTooLong ||
              isDirNameInvalid ||
              isDirNameExist ||
              isDirPathExist ||
              isDirPathInvalid
            }
            colorScheme={primaryColor}
            onClick={() => handleUpdateDir(dirPath)}
            isLoading={isLoading}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
      <ActionSelectDialog
        isOpen={isAddSubDirDialogOpen}
        onClose={onAddSubDirDialogClose}
        title={t("EditGameDirectoryModal.dialog.addSubDir.title")}
        body={t("EditGameDirectoryModal.dialog.addSubDir.body")}
        firstOption={t("EditGameDirectoryModal.dialog.addSubDir.addOriginDir")}
        secondOption={t("EditGameDirectoryModal.dialog.addSubDir.addSubDir")}
        onFirstOption={handleAddOriginalDir}
        onSecondOption={handleAddSubDir}
      />
    </Modal>
  );
};

export default EditGameDirectoryModal;
