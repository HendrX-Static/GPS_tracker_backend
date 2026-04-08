import { supabase } from "../config/supabase.js";
import {
  createTraccarDevice,
  deleteTraccarDevice,
  getTraccarPositions
} from "../services/traccarService.js";

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

    const normalizedName = name.trim();
    const normalizedImei = String(imei).trim();

    if (!normalizedName || !normalizedImei) {
      return res.status(400).json({ error: "Name and IMEI required" });
    }

    const { data: existingDevice, error: existingDeviceError } = await supabase
      .from("devices")
      .select("id")
      .eq("imei", normalizedImei)
      .maybeSingle();

    if (existingDeviceError) throw existingDeviceError;

    if (existingDevice) {
      return res.status(409).json({ error: "Device with this IMEI already exists" });
    }

    const traccarDevice = await createTraccarDevice({
      name: normalizedName,
      imei: normalizedImei
    });

    let createdDevice;

    try {
      const { data, error } = await supabase
      .from("devices")
      .insert([{
        name: normalizedName,
        imei: normalizedImei,
        traccar_device_id: traccarDevice.id
      }])
      .select()
      .single();

      if (error) throw error;

      createdDevice = data;
    } catch (dbError) {
      try {
        await deleteTraccarDevice(traccarDevice.id);
      } catch (rollbackError) {
        console.error("ROLLBACK ERROR:", rollbackError.message);
      }

      throw dbError;
    }

    res.json(createdDevice);

  } catch (err) {
    console.error(err);

    if (err.response?.status === 409) {
      return res.status(409).json({ error: "Device already exists in Traccar" });
    }

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
