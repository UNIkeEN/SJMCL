import { useRouter } from "next/router";
import { useEffect } from "react";
import { useRoutingHistory } from "@/contexts/routing-history";

const AccountsPage = () => {
  const router = useRouter();
  const { history } = useRoutingHistory();

  useEffect(() => {
    router.replace(
      [...history].reverse().find((route) => route.startsWith("/accounts/")) ||
        "/accounts/all"
    );
  }, [history, router]);

  return null;
};
export default AccountsPage;
