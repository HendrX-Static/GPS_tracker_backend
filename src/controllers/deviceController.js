import { supabase } from "../config/supabase.js";
import { getTraccarPositions } from "../services/traccarService.js";

export const getDevices = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. get user's devices
    const { data: userDevices } = await supabase
      .from("user_devices")
      .select("device_id")
      .eq("user_id", userId);

    const deviceIds = userDevices.map(d => d.device_id);

    if (deviceIds.length === 0) return res.json([]);

    // 2. get device details
    const { data: devices } = await supabase
      .from("devices")
      .select("*")
      .in("id", deviceIds);

    // 3. get positions from traccar
    const positions = await getTraccarPositions();

    // 4. merge data
    const result = devices.map(device => {
      const position = positions.find(
        p => p.deviceId === device.traccar_device_id
      );

      return {
        id: device.id,
        name: device.name || "Unnamed Device",
        imei: device.imei,
        status: position ? "online" : "offline",
        lastUpdate: position?.fixTime || null,
        speed: position?.speed || 0,
        latitude: position?.latitude || null,
        longitude: position?.longitude || null
      };
    });

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const assignDevice = async (req, res) => {
  const { user_id, device_id } = req.body;

  // basic validation
  if (!user_id || !device_id) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const { error } = await supabase
    .from("user_devices")
    .insert({ user_id, device_id });

  if (error) {
    return res.status(500).json(error);
  }

  res.json({ message: "Device assigned successfully" });
};
export const registerDevice = async (req, res) => {
  const userId = req.user.id;
  const { imei, name } = req.body;

  if (!imei) {
    return res.status(400).json({ error: "IMEI required" });
  }

  try {
    // 1. check if device exists
    let { data: device } = await supabase
      .from("devices")
      .select("*")
      .eq("imei", imei)
      .single();

    // 2. if not exists → create
    if (!device) {
      const { data: newDevice, error } = await supabase
        .from("devices")
        .insert({ imei, name })
        .select()
        .single();

      if (error) throw error;

      device = newDevice;
    }

    // 3. check if already assigned
    const { data: existing } = await supabase
      .from("user_devices")
      .select("*")
      .eq("device_id", device.id)
      .single();

    if (existing) {
      return res.status(400).json({
        error: "Device already registered"
      });
    }

    // 4. assign to user
    const { error } = await supabase
      .from("user_devices")
      .insert({
        user_id: userId,
        device_id: device.id
      });

    if (error) throw error;

    res.json({
      message: "Device registered successfully",
      device
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};