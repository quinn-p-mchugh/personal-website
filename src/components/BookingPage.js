import Cal, { getCalApi } from "@calcom/embed-react";
import React, { useEffect } from "react";

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
      calLink="quinnm/meet"
      style={{ width: "100%", height: "100%", overflow: "scroll" }}
    />
  );
}
