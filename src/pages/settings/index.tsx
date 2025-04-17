import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const SettingsPage = () => {
  const router = useRouter();
  const { history } = useRoutingHistory();

  useEffect(() => {
    let lastRecord =
      [...history].reverse().find((route) => route.startsWith("/settings/")) ||
      "/settings/general";
    if (lastRecord.endsWith("/advanced"))
      lastRecord = lastRecord.replace("/advanced", "");
    router.replace(lastRecord);
  }, [history, router]);

  return null;
};

export default SettingsPage;
