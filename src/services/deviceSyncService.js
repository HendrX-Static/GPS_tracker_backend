import { supabase } from "../config/supabase.js";
import { getTraccarDevices } from "./traccarService.js";

export const syncDevices = async () => {
  try {
    const traccarDevices = await getTraccarDevices();

    for (const tDevice of traccarDevices) {
      const imei = tDevice.uniqueId;

      // find matching device in our DB
      const { data: device } = await supabase
        .from("devices")
        .select("*")
        .eq("imei", imei)
        .single();

      if (device) {
        // update traccar_device_id
        await supabase
          .from("devices")
          .update({ traccar_device_id: tDevice.id })
          .eq("id", device.id);
      }
    }

    console.log("Device sync completed");
  } catch (err) {
    console.error(err);
  }
};