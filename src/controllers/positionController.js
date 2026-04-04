import { supabase } from "../config/supabase.js";

export const getPositions = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. get user's devices
    const { data: userDevices, error } = await supabase
      .from("user_devices")
      .select("device_id")
      .eq("user_id", userId);

    if (error) throw error;

    const deviceIds = userDevices.map(d => d.device_id);

    if (deviceIds.length === 0) {
      return res.json([]);
    }

    // 2. MOCK positions (later from Traccar)
    const mockPositions = [
      {
        deviceId: deviceIds[0],
        latitude: 28.6139,
        longitude: 77.2090,
        speed: 45
      }
    ];

    res.json(mockPositions);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};