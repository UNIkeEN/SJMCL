import { Avatar, Box, IconButton } from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { LuGithub } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { OptionItemGroup } from "@/components/common/option-item";
import { WrapCardGroup } from "@/components/common/wrap-card";

export const CoreContributorsList = [
  {
    username: "UNIkeEN",
    contribution: "fullStackDev",
  },
  {
    username: "Reqwey",
    contribution: "fullStackDev",
  },
  {
    username: "SundayChen",
    contribution: "fullStackDev",
  },
  {
    username: "w1049",
    contribution: "backendDev",
  },
  {
    username: "Toolmanp",
    contribution: "backendDev",
  },
  {
    username: "fangtiancheng",
    contribution: "backendDev",
  },
  {
    username: "ModistAndrew",
    contribution: "backendDev",
  },
  {
    username: "1357310795",
    contribution: "frontendDev",
  },
  {
    username: "HsxMark",
    contribution: "frontendDev",
  },
  {
    username: "baiyuansjtu",
    contribution: "frontendDev",
  },
  {
    username: "xunying123",
    contribution: "externalAPI",
  },
  {
    username: "hans362",
    contribution: "externalAPI",
  },
  {
    username: "ff98sha",
    contribution: "doc",
  },
  {
    username: "pangbo13",
    contribution: "cicd",
  },
  {
    username: "Minecrafter-Pythoner",
    contribution: "cicd",
  },
  {
    username: "hebingchang",
    contribution: "mascot",
  },
  {
    username: "Neuteria",
    contribution: "design",
  },
  {
    username: "Stya-hr",
    contribution: "design",
  },
];

const ContributorsPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <OptionItemGroup
        items={[
          {
            title: t("ContributorsPage.all"),
            children: (
              <CommonIconButton
                label="https://github.com/UNIkeEN/SJMCL/graphs/contributors"
                icon="external"
                withTooltip
                tooltipPlacement="bottom-end"
                size="xs"
                h={18}
                onClick={() =>
                  openUrl(
                    "https://github.com/UNIkeEN/SJMCL/graphs/contributors"
                  )
                }
              />
            ),
          },
        ]}
      />
      <WrapCardGroup
        title={t("ContributorsPage.core")}
        items={CoreContributorsList.map((item) => {
          return {
            cardContent: {
              title: item.username,
              description: t(
                `ContributorsPage.contribution.${item.contribution}`
              ),
              image: (
                <Avatar
                  size="sm"
                  name={item.username}
                  src={`https://avatars.githubusercontent.com/${item.username}`}
                />
              ),
              extraContent: (
                <Box position="absolute" top={0.5} right={1}>
                  <IconButton
                    size="xs"
                    variant="ghost"
                    aria-label={`${item.username}-github`}
                    icon={<LuGithub />}
                    onClick={() => {
                      openUrl(`https://github.com/${item.username}`);
                    }}
                  />
                </Box>
              ),
            },
          };
        })}
      />
    </>
  );
};
export default ContributorsPage;
