import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const InstanceDetailIndexPage = () => {
  const router = useRouter();
  const { id, screenshotIndex } = router.query;
  const { history } = useRoutingHistory();

  useEffect(() => {
    if (!id) {
      router.push("/games/all");
      return;
    }

    const instanceId = Array.isArray(id) ? id[0] : id;

    const targetRoute =
      [...history]
        .reverse()
        .find((route) => route.startsWith(`/games/instance/${instanceId}/`)) ||
      `/games/instance/${instanceId}/overview`;

    router.replace(targetRoute.split("?")[0]);
  }, [history, router, id, screenshotIndex]);

  return null;
};

export default InstanceDetailIndexPage;
