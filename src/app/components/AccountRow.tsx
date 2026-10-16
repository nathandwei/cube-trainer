import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/app/components/IconButton";
import { signOut, useAccount } from "@/app/lib/account";
import { navigate, useRoute } from "@/app/lib/router";

/** Bottom-left account row: who is signed in, and sign out. */
export function AccountRow() {
  const state = useAccount();
  const route = useRoute();
  const [failed, setFailed] = useState(false);
  if (state.status !== "signed-in") return null;
  const { account } = state;

  async function leave() {
    try {
      setFailed(false);
      await signOut();
    } catch (error) {
      console.error("Sign out failed", error);
      setFailed(true);
    }
  }

  return (
    <div className="account">
      {account.picture ? (
        <img className="avatar" src={account.picture} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="avatar initial" aria-hidden="true">
          {account.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="name" title={account.email}>
        {account.name}
      </span>
      <span className="account-actions">
        {route.page !== "settings" && <IconButton icon={Settings} label="Settings" className="tip-up" onClick={() => navigate("/settings")} />}
        <IconButton icon={LogOut} label={failed ? "Sign out failed: try again" : "Sign out"} className={`tip-up ${failed ? "failed" : ""}`} onClick={() => void leave()} />
      </span>
    </div>
  );
}
