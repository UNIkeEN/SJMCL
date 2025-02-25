import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const RoutingAccountsPage = () => {
  const router = useRouter();
  const { history } = useRoutingHistory();

  useEffect(() => {
    router.replace(
      [...history].reverse().find((route) => route.startsWith("/accounts/")) ||
        "/accounts/index"
    );
  }, [history, router]);

  return null;
};
export default RoutingAccountsPage;
