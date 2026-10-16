import { useState } from "react";
import { signOut, useAccount } from "@/app/lib/account";

/** Bottom-left account row: who is signed in, and sign out. */
export function AccountRow() {
  const state = useAccount();
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
      <button className="signout" onClick={leave} title={failed ? "sign out failed, try again" : "sign out"}>
        {failed ? "retry" : "sign out"}
      </button>
    </div>
  );
}
