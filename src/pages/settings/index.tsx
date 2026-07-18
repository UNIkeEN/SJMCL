import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const SettingsPage = () => {
  const router = useRouter();
  const { history } = useRoutingHistory();

  useEffect(() => {
    const lastRecord =
      [...history].reverse().find((route) => route.startsWith("/settings/")) ||
      "/settings/general";

    // always redirect to top-level settings page (e.g. /settings/download/ping-test → /settings/download)
    const segments = lastRecord.split("/");
    const parent =
      segments.length > 3 ? segments.slice(0, 3).join("/") : lastRecord;

    router.replace(parent);
  }, [history, router]);

  return null;
};

export default SettingsPage;
