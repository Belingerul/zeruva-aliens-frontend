import { Suspense } from "react";
import ConfirmEggClient from "./Client";
import ConfirmProviders from "../Providers";

export const dynamic = "force-dynamic";

export default function ConfirmEggPage() {
  return (
    <ConfirmProviders>
      <Suspense>
        <ConfirmEggClient />
      </Suspense>
    </ConfirmProviders>
  );
}
