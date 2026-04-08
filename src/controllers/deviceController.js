import { supabase } from "../config/supabase.js";
import {
  createTraccarDevice,
  deleteTraccarDevice,
  getTraccarPositions
} from "../services/traccarService.js";

const safeGetTraccarPositions = async () => {
  try {
    return await getTraccarPositions();
  } catch (error) {
    console.error("TRACCAR POSITIONS ERROR:", error.message);
    return [];
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const boolFrom = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "on", "1", "yes"].includes(normalized)) return true;
    if (["false", "off", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
};

const formatLocationText = (position) => {
  const address =
    position?.address ||
    position?.attributes?.address ||
    position?.attributes?.displayName ||
    null;

  if (address) {
    const parts = String(address)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const areaParts = parts.filter((part) => {
      const lower = part.toLowerCase();
      if (lower === "india") return false;
      if (/^\d{4,8}$/.test(part)) return false;
      return true;
    });

    if (areaParts.length >= 2) {
      return `${areaParts[0]}, ${areaParts[1]}`;
    }

    if (areaParts.length === 1) {
      return areaParts[0];
    }
  }

  return "Area unavailable";
};

const buildDevicePayload = (device, position) => {
  const attrs = position?.attributes || {};
  const lastSeen =
    position?.fixTime || position?.deviceTime || position?.serverTime || null;
  const isOnline = !!position;

  const speedKmh = Math.max(0, Math.round(toNumber(position?.speed, 0) * 1.852 * 10) / 10);
  const batteryPercent = toNumber(attrs.batteryLevel ?? attrs.battery, 0);
  const voltage = toNumber(
    attrs.voltage ?? attrs.powerVoltage ?? attrs.externalPowerVoltage ?? attrs.power,
    0
  );
  const ignitionOn = boolFrom(attrs.ignition, false);
  const mainPowerOn = boolFrom(attrs.power ?? attrs.charge, false);
  const gsmSignal = toNumber(attrs.rssi ?? attrs.signal ?? attrs.gsm, 0);
  const satelliteSignal = toNumber(
    attrs.sat ?? attrs.satellites ?? attrs.satVisible ?? attrs.gpsSat,
    0
  );

  const now = Date.now();
  const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : null;
  const offlineForSeconds =
    !isOnline && lastSeenMs && Number.isFinite(lastSeenMs)
      ? Math.max(0, Math.floor((now - lastSeenMs) / 1000))
      : 0;

  const locationText = formatLocationText(position);

  return {
    id: device.id,
    name: device.name || "Unnamed Device",
    imei: device.imei,
    status: isOnline ? "online" : "offline",
    lastUpdate: lastSeen,
    speed: speedKmh,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    locationText,
    currentLocation: locationText,
    lastKnownLocation: locationText,
    currentTime: new Date().toISOString(),
    lastConnectedTime: lastSeen,
    offlineForSeconds,
    ignitionOn,
    mainPowerOn,
    batteryPercent,
    voltage,
    gsmSignal,
    satelliteSignal,
  };
};

export const getDevices = async (req, res) => {

  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";
    const userEmail = req.user.email;

    let devices;

    if (isAdmin) {
      const { data, error } = await supabase
        .from("devices")
        .select("*");

      if (error) {
        console.error("Supabase devices error:", error);
        return res.status(500).json({ error: error.message });
      }

      devices = data || [];
    } else {
      // Get candidate profile IDs for this logged-in auth user.
      // This supports both strict auth-id mapping and older email-linked rows.
      const candidateUserIds = new Set([userId]);

      if (userEmail) {
        const { data: profileByEmail, error: profileByEmailError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle();

        if (profileByEmailError) {
          console.error("Supabase profileByEmail error:", profileByEmailError);
        } else if (profileByEmail?.id) {
          candidateUserIds.add(profileByEmail.id);
        }
      }

      const candidateUserIdsArray = Array.from(candidateUserIds);

      // 1. get user's assigned devices
      const { data: userDevices, error: userDevicesError } = await supabase
        .from("user_devices")
        .select("device_id")
        .in("user_id", candidateUserIdsArray);

      if (userDevicesError) {
        console.error("Supabase userDevices error:", userDevicesError);
        return res.status(500).json({ error: userDevicesError.message });
      }

      const deviceIds = userDevices?.map((d) => d.device_id) || [];

      if (deviceIds.length === 0) {
        return res.json([]);
      }

      // 2. get device details
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .in("id", deviceIds);

      if (error) {
        console.error("Supabase devices error:", error);
        return res.status(500).json({ error: error.message });
      }

      devices = data || [];
    }

    // 3. get positions from traccar
    const positions = await safeGetTraccarPositions();

    // 4. merge data
    const result = devices.map((device) => {
      const position = positions.find(
        (p) => p.deviceId === device.traccar_device_id
      );

      return buildDevicePayload(device, position);
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
    if (err.response?.status === 401) {
      return res.status(502).json({
        error: "Traccar authentication failed. Check TRACCAR_EMAIL and TRACCAR_PASSWORD.",
      });
    }
    if (String(err.message || "").includes("TRACCAR_")) {
      return res.status(500).json({ error: err.message });
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

export const getDevicesForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const { data: userDevices, error: userDevicesError } = await supabase
      .from("user_devices")
      .select("device_id")
      .eq("user_id", userId);

    if (userDevicesError) throw userDevicesError;

    const deviceIds = (userDevices || []).map((d) => d.device_id);
    if (deviceIds.length === 0) {
      return res.json([]);
    }

    const { data: devices, error: devicesError } = await supabase
      .from("devices")
      .select("*")
      .in("id", deviceIds);

    if (devicesError) throw devicesError;

    const positions = await safeGetTraccarPositions();

    const result = (devices || []).map((device) => {
      const position = positions.find((p) => p.deviceId === device.traccar_device_id);
      return buildDevicePayload(device, position);
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const unassignDeviceFromUser = async (req, res) => {
  try {
    const { userId, deviceId } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ error: "userId and deviceId required" });
    }

    const { error } = await supabase
      .from("user_devices")
      .delete()
      .eq("user_id", userId)
      .eq("device_id", deviceId);

    if (error) throw error;

    res.json({ message: "Device unassigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId required" });
    }

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id, traccar_device_id")
      .eq("id", deviceId)
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    if (device.traccar_device_id) {
      await deleteTraccarDevice(device.traccar_device_id);
    }

    const { error: assignmentDeleteError } = await supabase
      .from("user_devices")
      .delete()
      .eq("device_id", deviceId);

    if (assignmentDeleteError) throw assignmentDeleteError;

    const { error: dbDeleteError } = await supabase
      .from("devices")
      .delete()
      .eq("id", deviceId);

    if (dbDeleteError) throw dbDeleteError;

    res.json({ message: "Device deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
