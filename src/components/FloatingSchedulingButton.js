import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

export default function FloatingSchedulingButton() {
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      Cal("floatingButton", {
        calLink: "quinnm/meet",
        buttonPosition: "bottom-right",
        buttonColor: "#111111",
        buttonTextColor: "#111111",
      });
      cal("ui", {
        styles: { branding: { brandColor: "#111111" } },
        hideEventTypeDetails: false,
      });
    })();
  }, []);
}
