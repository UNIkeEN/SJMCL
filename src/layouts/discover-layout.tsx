import { Grid, GridItem, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuBoxes,
  LuEarth,
  LuHaze,
  LuHouse,
  LuMessagesSquare,
  LuNewspaper,
  LuPackage,
  LuPuzzle,
  LuSearch,
  LuSquareLibrary,
} from "react-icons/lu";
import NavMenu, { MenuItem } from "@/components/common/nav-menu";
import { useSharedModals } from "@/contexts/shared-modal";

interface DiscoverMenuItemConfig {
  key: string;
  icon: IconType;
  route?: string;
  onClick?: () => void;
}

const DiscoverLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { openSharedModal } = useSharedModals();

  const handleSearch = () => {
    openSharedModal("spotlight-search");
  };

  const discoverDomainList: DiscoverMenuItemConfig[][] = [
    [
      { key: "search", icon: LuSearch, onClick: handleSearch },
      {
        key: "home",
        icon: LuHouse,
        route: "/discover/home",
      },
    ],
    [
      {
        key: "minecraft-news",
        icon: LuNewspaper,
        route: "/discover/minecraft-news",
      },
      {
        key: "community-news",
        icon: LuMessagesSquare,
        route: "/discover/community-news",
      },
    ],
    [
      {
        key: "modpack",
        icon: LuBoxes,
        route: "/discover/resource?type=modpack",
      },
      {
        key: "mod",
        icon: LuSquareLibrary,
        route: "/discover/resource?type=mod",
      },
      { key: "world", icon: LuEarth, route: "/discover/resource?type=world" },
      {
        key: "resourcepack",
        icon: LuPackage,
        route: "/discover/resource?type=resourcepack",
      },
      { key: "shader", icon: LuHaze, route: "/discover/resource?type=shader" },
      {
        key: "datapack",
        icon: LuPuzzle,
        route: "/discover/resource?type=datapack",
      },
    ],
  ];

  const createMenuItems = (
    items: DiscoverMenuItemConfig[]
  ): Array<MenuItem & { route?: string; onClick?: () => void }> => {
    return items.map((item) => ({
      label: (
        <HStack spacing={2} overflow="hidden">
          <Icon as={item.icon} />
          <Text fontSize="sm" className="ellipsis-text">
            {t(`DiscoverLayout.discoverDomainList.${item.key}`)}
          </Text>
        </HStack>
      ),
      value: item.route || item.key,
      route: item.route,
      onClick: item.onClick,
    }));
  };

  const handleMenuClick = (value: any, item: any) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.route) {
      router.push(item.route);
    }
  };

  return (
    <Grid templateColumns="1fr 3fr" gap={4} h="100%">
      <GridItem className="content-full-y">
        <VStack align="stretch" spacing={4}>
          {discoverDomainList.map((group, index) => {
            const menuItems = createMenuItems(group);
            const itemsWithMetadata = menuItems.map((item, idx) => ({
              ...item,
              originalItem: group[idx],
            }));

            return (
              <NavMenu
                key={index}
                selectedKeys={[router.asPath]}
                onClick={(value) => {
                  const item = itemsWithMetadata.find((i) => i.value === value);
                  if (item) {
                    handleMenuClick(value, item);
                  }
                }}
                items={menuItems}
              />
            );
          })}
        </VStack>
      </GridItem>
      <GridItem className="content-full-y" key={router.asPath}>
        <VStack align="stretch" spacing={4} h="100%">
          {children}
        </VStack>
      </GridItem>
    </Grid>
  );
};

export default DiscoverLayout;
