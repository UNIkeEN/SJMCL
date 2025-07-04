import { Button, HStack } from "@chakra-ui/react";
import { Masonry } from "masonic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuNewspaper, LuRefreshCcw } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import PosterCard from "@/components/poster-card";
import { useLauncherConfig } from "@/contexts/config";
import { PostSummary } from "@/models/post";
import { DiscoverService } from "@/services/discover";

export const DiscoverPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [posts, setPosts] = useState<PostSummary[]>([]);

  const handleFetchPostsSummaries = useCallback(() => {
    DiscoverService.fetchPostSummaries().then((response) => {
      if (response.status === "success") setPosts(response.data);
      console.log(response);
      // no toast here, keep slient if no internet connection or etc.
    });
  }, [setPosts]);

  useEffect(() => {
    handleFetchPostsSummaries();
  }, [handleFetchPostsSummaries]);

  return (
    <Section
      className="content-full-y"
      title={t("DiscoverPage.title")}
      headExtra={
        <HStack spacing={2}>
          <Button
            leftIcon={<LuNewspaper />}
            size="xs"
            colorScheme={primaryColor}
            variant={primaryColor === "gray" ? "subtle" : "outline"}
            onClick={() => {
              router.push("/discover/sources");
            }}
          >
            {t("DiscoverPage.button.sources")}
          </Button>
          <Button
            leftIcon={<LuRefreshCcw />}
            size="xs"
            colorScheme={primaryColor}
            onClick={handleFetchPostsSummaries}
          >
            {t("General.refresh")}
          </Button>
        </HStack>
      }
    >
      {posts.length > 0 ? (
        <Masonry items={posts} render={PosterCard} columnGutter={14} />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </Section>
  );
};

export default DiscoverPage;
