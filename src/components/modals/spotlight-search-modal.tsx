import {
  Center,
  Divider,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSearch } from "react-icons/lu";

const SpotlightSearchModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const [queryText, setQueryText] = useState<string>("");

  return (
    <Modal {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <InputGroup size="md">
            <InputLeftElement pointerEvents="none" h="100%" w="auto">
              <LuSearch />
            </InputLeftElement>
            <Input
              variant="unstyled"
              borderRadius={0}
              pl={6}
              placeholder={t("SpotlightSearchModal.input.placeholder")}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value.trim())}
            />
          </InputGroup>
        </ModalHeader>
        <Divider />
        <ModalBody minH="8rem">
          {!queryText && (
            <Center h="6rem">
              <Text className="secondary-text">
                ✨&nbsp;{t("SpotlightSearchModal.tip")}
              </Text>
            </Center>
          )}
          {/* TODO: Add search results */}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SpotlightSearchModal;
