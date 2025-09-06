import {
  Button,
  FormControl,
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
  Text,
  VStack,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import OAuthLoginPanel from "@/components/oauth-login-panel";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { PlayerType } from "@/enums/account";
import { DeviceAuthResponseInfo, Player } from "@/models/account";
import { AccountService } from "@/services/account";

interface ReLoginPlayerModalProps extends Omit<ModalProps, "children"> {
  player: Player;
  onSuccess?: () => void;
  onError?: () => void;
}
const ReLoginPlayerModal: React.FC<ReLoginPlayerModalProps> = ({
  player,
  onSuccess,
  onError,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;
  const isOAuth = !!player.refreshToken;

  const [oauthCodeResponse, setOAuthCodeResponse] =
    useState<DeviceAuthResponseInfo>();
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  if (player.playerType === PlayerType.Offline) return null;

  const handleCloseModal = () => {
    props.onClose();
    onError?.();
  };

  const handleReLogin = async (isOAuth = false) => {
    setIsLoading(true);
    if (isOAuth) {
      if (!oauthCodeResponse) return;
      openUrl(oauthCodeResponse.verificationUri);
      AccountService.reloginPlayerOAuth(player.id, oauthCodeResponse).then(
        (response) => {
          if (response.status === "success") {
            toast({
              title: response.message,
              status: "success",
            });
            props.onClose();
            onSuccess?.();
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
            onError?.();
          }
          setIsLoading(false);
        }
      );
    } else {
      AccountService.reloginPlayer3rdPartyPassword(player.id, password).then(
        (response) => {
          if (response.status === "success") {
            toast({
              title: response.message,
              status: "success",
            });
            props.onClose();
            onSuccess?.();
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
          setIsLoading(false);
          setPassword("");
        }
      );
    }
  };

  const handleFetchOAuthCode = () => {
    if (player.playerType === PlayerType.Offline) return;
    setOAuthCodeResponse(undefined);
    setIsLoading(true);
    AccountService.fetchOAuthCode(
      player.playerType,
      player.authServer?.authUrl
    ).then((response) => {
      if (response.status === "success") {
        setOAuthCodeResponse(response.data);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
      setIsLoading(false);
    });
  };

  return (
    <Modal {...props} onClose={handleCloseModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ReLoginPlayerModal.modal.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={3.5} align="flex-start">
            {isOAuth ? (
              <OAuthLoginPanel
                authType={player.playerType}
                authCode={oauthCodeResponse?.userCode}
                callback={() =>
                  oauthCodeResponse
                    ? handleReLogin(true)
                    : handleFetchOAuthCode()
                }
                isLoading={isLoading}
              />
            ) : (
              <>
                <FormControl>
                  <FormLabel>{t("ReLoginPlayerModal.label.user")}</FormLabel>
                  <Text>{player.name}</Text>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>
                    {t("ReLoginPlayerModal.label.password")}
                  </FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("ReLoginPlayerModal.placeholder.password")}
                    focusBorderColor={`${primaryColor}.500`}
                  />
                </FormControl>
              </>
            )}
          </VStack>
        </ModalBody>
        {!isOAuth && (
          <ModalFooter>
            <Button variant="ghost" onClick={handleCloseModal}>
              {t("General.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={() => handleReLogin()}
              isDisabled={!password.trim()}
              isLoading={isLoading}
            >
              {t("ReLoginPlayerModal.button.login")}
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ReLoginPlayerModal;
