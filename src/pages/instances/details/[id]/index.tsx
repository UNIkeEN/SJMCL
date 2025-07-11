import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const InstanceDetailIndexPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { history } = useRoutingHistory();

  useEffect(() => {
    if (id === undefined) {
      router.push("/instances/list");
      return;
    }

    const instanceId = Array.isArray(id) ? id[0] : id;
    const encodedId = encodeURIComponent(instanceId);

    router.replace(
      [...history]
        .reverse()
        .find((route) =>
          route.startsWith(`/instances/details/${encodedId}/`)
        ) || `/instances/details/${encodedId}/overview`
    );
  }, [history, router, id]);

  return null;
};

export default InstanceDetailIndexPage;
