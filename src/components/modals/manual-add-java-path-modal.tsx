import {
  Button,
  Flex,
  FormControl,
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
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";

interface ManualAddJavaPathModalProps extends Omit<ModalProps, "children"> {
  onSubmitCallback?: (path: string | null) => void;
}

const ManualAddJavaPathModal: React.FC<ManualAddJavaPathModalProps> = ({
  onSubmitCallback,
  ...props
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [innerPath, setInnerPath] = useState<string>("");

  useEffect(() => {
    if (props.isOpen) {
      setInnerPath("");
    }
  }, [props.isOpen]);

  const handleSubmit = () => {
    const finalPath = innerPath.trim();
    onSubmitCallback?.(finalPath || null);
    props.onClose();
  };

  const handleClose = () => {
    onSubmitCallback?.(null);
    props.onClose();
  };

  const handleBrowseJava = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        ...(config.basicInfo.platform === "windows" && {
          filters: [
            {
              name: "Java",
              extensions: ["exe"],
            },
          ],
        }),
      });

      if (selected && typeof selected === "string") {
        setInnerPath(selected);
      }
    } catch (error) {
      setInnerPath("");
      toast({
        title: t("JavaSettingsPage.toast.addFailed.title"),
        status: "error",
      });
    }
  };

  return (
    <Modal {...props} onClose={handleClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ManualAddJavaPathModal.modal.header")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl isRequired>
            <FormLabel>{t("ManualAddJavaPathModal.label.javaPath")}</FormLabel>
            <Flex direction="row" align="center">
              <InputGroup size="sm">
                <Input
                  pr={12}
                  value={innerPath}
                  onChange={(e) => setInnerPath(e.target.value)}
                  placeholder={t("ManualAddJavaPathModal.placeholder.javaPath")}
                  focusBorderColor={`${primaryColor}.500`}
                  required
                />
                <InputRightElement w={16}>
                  <Button
                    h={6}
                    size="sm"
                    variant="ghost"
                    onClick={handleBrowseJava}
                    colorScheme={primaryColor}
                  >
                    {t("General.browse")}
                  </Button>
                </InputRightElement>
              </InputGroup>
            </Flex>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleSubmit}
            isDisabled={!innerPath.trim()}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ManualAddJavaPathModal;
