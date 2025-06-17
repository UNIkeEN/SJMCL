import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Checkbox,
  Flex,
  HStack,
  Text,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useLauncherConfig } from "@/contexts/config";

interface GenericConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string | React.ReactElement;
  btnOK: string;
  btnCancel: string;
  onOKCallback?: () => void;
  isAlert?: boolean;
  showDontAskAgain?: boolean; // ✅ 新增参数：是否显示“不再显示此提示”
  onDontAskAgainChange?: (checked: boolean) => void; // ✅ 新增回调
}

const GenericConfirmDialog: React.FC<GenericConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  body,
  btnOK,
  btnCancel,
  onOKCallback,
  isAlert = false,
  showDontAskAgain = true,
  onDontAskAgainChange,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontAskAgain(checked);
    onDontAskAgainChange?.(checked);
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      autoFocus={false}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{title}</AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody>{body}</AlertDialogBody>
          <AlertDialogFooter>
            <Flex flex="1" align="center">
              {showDontAskAgain && (
                <HStack>
                  <Checkbox
                    isChecked={dontAskAgain}
                    onChange={handleCheckboxChange}
                    mr={0} // HStack 自动处理间距，可去掉
                  />
                  <Text fontSize="sm">不再显示此提示</Text>
                </HStack>
              )}
            </Flex>

            {btnCancel && (
              <Button ref={cancelRef} onClick={onClose} variant="ghost">
                {btnCancel}
              </Button>
            )}
            <Button
              colorScheme={isAlert ? "red" : primaryColor}
              onClick={onOKCallback}
            >
              {btnOK}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default GenericConfirmDialog;
