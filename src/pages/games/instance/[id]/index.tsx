import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const InstanceDetailIndexPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { history } = useRoutingHistory();

  useEffect(() => {
    if (!id) {
      router.push("/games/all");
      return;
    }

    const instanceId = Array.isArray(id) ? id[0] : id;

    router.replace(
      [...history]
        .reverse()
        .find((route) => route.startsWith(`/games/instance/${instanceId}/`)) ||
        `/games/instance/${instanceId}/overview`
    );
  }, [history, router, id]);

  return null;
};

export default InstanceDetailIndexPage;
