import Cal, { getCalApi } from "@calcom/embed-react";
import React, { useEffect } from "react";

import { CAL_LINK } from "@site/src/utils/calBooking";

export default function BookingPage() {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal("ui", {
        styles: { branding: { brandColor: "#50C9F0" } },
        hideEventTypeDetails: false,
      });
    })();
  }, []);
  return (
    <Cal
      calLink={CAL_LINK}
      style={{ width: "100%", height: "100%", overflow: "scroll" }}
    />
  );
}
