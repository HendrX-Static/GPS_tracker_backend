import { supabase } from "../config/supabase.js";
import { getTraccarPositions } from "../services/traccarService.js";

export const getPositions = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. get user devices
    const { data: userDevices } = await supabase
      .from("user_devices")
      .select("device_id")
      .eq("user_id", userId);

    const deviceIds = userDevices.map(d => d.device_id);

    if (deviceIds.length === 0) return res.json([]);

    // 2. get devices from DB
    const { data: devices } = await supabase
      .from("devices")
      .select("*")
      .in("id", deviceIds);

    const imeis = devices.map(d => d.imei);

    // 3. fetch from Traccar
    const positions = await getTraccarPositions();

const filtered = positions.filter(p =>
  devices.some(d => d.traccar_device_id === p.deviceId)
);

    res.json(filtered);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};