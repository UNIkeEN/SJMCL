import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const GamesPage = () => {
  const router = useRouter();
  const { history } = useRoutingHistory();

  useEffect(() => {
    let lastRecord =
      [...history].reverse().find((route) => route.startsWith("/games/")) ||
      "/games/all";
    if (lastRecord.endsWith("settings/advanced"))
      lastRecord = lastRecord.replace("settings/advanced", "settings");
    router.replace(lastRecord);
  }, [history, router]);

  return null;
};

export default GamesPage;
