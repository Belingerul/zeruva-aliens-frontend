import { Suspense } from "react";
import ConfirmShipClient from "./Client";
import ConfirmProviders from "../Providers";

export const dynamic = "force-dynamic";

export default function ConfirmShipPage() {
  return (
    <ConfirmProviders>
      <Suspense>
        <ConfirmShipClient />
      </Suspense>
    </ConfirmProviders>
  );
}
