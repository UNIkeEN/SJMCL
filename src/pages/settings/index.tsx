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

    const replacements: [string, string][] = [
      ["/advanced", "/"],
      ["/ping-test", "/download"],
    ];
    replacements.forEach(([suffix, replacement]) => {
      if (lastRecord.endsWith(suffix)) {
        lastRecord = lastRecord.replace(suffix, replacement);
      }
    });

    router.replace(lastRecord);
  }, [history, router]);

  return null;
};

export default SettingsPage;
