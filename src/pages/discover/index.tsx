import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

export default function DiscoverIndexPage() {
  const router = useRouter();
  const { history } = useRoutingHistory();

  useEffect(() => {
    let lastRecord =
      [...history].reverse().find((route) => route.startsWith("/discover/")) ||
      "/discover/home";
    if (lastRecord.endsWith("discover/sources"))
      lastRecord = lastRecord.replace(
        "discover/sources",
        "discover/community-news"
      );
    router.replace(lastRecord);
  }, [history, router]);

  return null;
}
