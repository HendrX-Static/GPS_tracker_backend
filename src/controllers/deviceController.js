import { supabase } from "../config/supabase.js";
import { getTraccarPositions } from "../services/traccarService.js";

export const getDevices = async (req, res) => {

  try {
    const userId = req.user.id;

    // 1. get user's devices
    const { data: userDevices, error: userDevicesError } = await supabase
      .from("user_devices")
      .select("device_id")
      .eq("user_id", userId);

    if (userDevicesError) {
      console.error("Supabase userDevices error:", userDevicesError);
      return res.status(500).json({ error: userDevicesError.message });
    }


    // ✅ FIX: safe mapping
    const deviceIds = userDevices?.map(d => d.device_id) || [];


    if (deviceIds.length === 0) {
      console.log("No devices found");
      return res.json([]);
    }

    // 2. get device details
    const { data: devices, error: devicesError } = await supabase
      .from("devices")
      .select("*")
      .in("id", deviceIds);

    if (devicesError) {
      console.error("Supabase devices error:", devicesError);
      return res.status(500).json({ error: devicesError.message });
    }


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
    console.error("CONTROLLER ERROR:", err); // 🔥 VERY IMPORTANT
    res.status(500).json({ error: err.message });
  }
};
export const createDevice = async (req, res) => {
  try {
    const { name, imei } = req.body;

    if (!name || !imei) {
      return res.status(400).json({ error: "Name and IMEI required" });
    }

    const { data, error } = await supabase
      .from("devices")
      .insert([{ name, imei }])
      .select()
      .single();

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
export const assignDeviceToUser = async (req, res) => {
  try {
    const { userId, deviceId } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ error: "userId and deviceId required" });
    }

    // check if already assigned
    const { data: existing } = await supabase
      .from("user_devices")
      .select("*")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existing) {
      return res.json({ message: "Already assigned" });
    }

    const { error } = await supabase
      .from("user_devices")
      .insert([{ user_id: userId, device_id: deviceId }]);

    if (error) throw error;

    res.json({ message: "Device assigned successfully" });

  } catch (err) {
    console.error(err);
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