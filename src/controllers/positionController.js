import { supabase } from "../config/supabase.js";
import { getTraccarPositions } from "../services/traccarService.js";

export const getPositions = async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";
  const userEmail = req.user.email;

  try {
    let devices = [];

    if (isAdmin) {
      const { data, error } = await supabase.from("devices").select("*");
      if (error) throw error;
      devices = data || [];
    } else {
      const candidateUserIds = new Set([userId]);

      if (userEmail) {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle();

        if (profileByEmail?.id) {
          candidateUserIds.add(profileByEmail.id);
        }
      }

      // 1. get user devices
      const { data: userDevices, error: userDevicesError } = await supabase
        .from("user_devices")
        .select("device_id")
        .in("user_id", Array.from(candidateUserIds));

      if (userDevicesError) throw userDevicesError;

      const deviceIds = (userDevices || []).map((d) => d.device_id);
      if (deviceIds.length === 0) return res.json([]);

      // 2. get devices from DB
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .in("id", deviceIds);

      if (error) throw error;
      devices = data || [];
    }

    // 3. fetch from Traccar
    const positions = await getTraccarPositions();

    const filtered = positions.filter((p) =>
      devices.some((d) => d.traccar_device_id === p.deviceId)
    );

    res.json(filtered);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
