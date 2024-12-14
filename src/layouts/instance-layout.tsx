import { Box, Grid, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { GridItem } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { LuHouse } from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import { InstanceContext, InstanceContextProvider } from "@/contexts/instance";

const InstanceLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <InstanceContextProvider>
      <InstanceLayoutContent>{children}</InstanceLayoutContent>
    </InstanceContextProvider>
  );
};

const InstanceLayoutContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentInstance } = useContext(InstanceContext);
  const router = useRouter();
  const { t } = useTranslation();

  if (!currentInstance) {
    return (
      <Box>
        <Text>{t("InstancePage.error.instanceNotFound")}</Text>
      </Box>
    );
  }

  const navMenuItems = [
    {
      label: (
        <HStack spacing={2}>
          <Icon as={LuHouse} />
          <Text>{t("InstancePage.navMenuList.home")}</Text>
        </HStack>
      ),
      value: `/games/instance/${currentInstance.id}/home`,
      tooltip: t("InstancePage.navMenuList.home"),
    },
  ];

  return (
    <HStack mt="auto" align="stretch" spacing={4} h="100%">
      <Box flex="1" overflowY="auto">
        <Text fontWeight="bold" fontSize="sm" mb={4}>
          {currentInstance.name}
        </Text>
        <NavMenu
          items={navMenuItems}
          selectedKeys={[router.asPath]}
          onClick={(value) => router.push(value)}
          direction="row"
        />
        <Box p={4}>{children}</Box>
      </Box>
    </HStack>
  );
};

export default InstanceLayout;
