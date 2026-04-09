import { supabase } from "../config/supabase.js";
import { getTraccarRoute, getTraccarTrips } from "../services/traccarService.js";

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toSpeedKmh = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * 1.852 * 10) / 10);
};

const toDurationSeconds = (trip) => {
  const raw = Number(trip?.duration);
  if (Number.isFinite(raw) && raw > 0) {
    // Traccar commonly returns duration in milliseconds.
    if (raw > 100000) return Math.round(raw / 1000);
    return Math.round(raw);
  }

  const start = toDateOrNull(trip?.startTime);
  const end = toDateOrNull(trip?.endTime);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
};

const resolveAccessibleDevice = async (req, appDeviceId) => {
  if (req.user.role === "admin") {
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("id", appDeviceId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  const candidateUserIds = new Set([req.user.id]);

  if (req.user.email) {
    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", req.user.email)
      .maybeSingle();

    if (profileByEmail?.id) {
      candidateUserIds.add(profileByEmail.id);
    }
  }

  const { data: link, error: linkError } = await supabase
    .from("user_devices")
    .select("device_id")
    .in("user_id", Array.from(candidateUserIds))
    .eq("device_id", appDeviceId)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!link) return null;

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("*")
    .eq("id", appDeviceId)
    .maybeSingle();

  if (deviceError) throw deviceError;
  return device;
};

export const getTripHistory = async (req, res) => {
  try {
    const { deviceId, from, to } = req.query;

    if (!deviceId || !from || !to) {
      return res.status(400).json({ error: "deviceId, from and to are required" });
    }

    const fromDate = toDateOrNull(from);
    const toDate = toDateOrNull(to);

    if (!fromDate || !toDate || fromDate >= toDate) {
      return res.status(400).json({ error: "Invalid date range" });
    }

    const device = await resolveAccessibleDevice(req, deviceId);
    if (!device) {
      return res.status(403).json({ error: "Device access denied" });
    }

    const trips = await getTraccarTrips(
      device.traccar_device_id,
      fromDate.toISOString(),
      toDate.toISOString()
    );

    const normalized = (trips || []).map((trip, index) => ({
      id: `${device.id}-${trip.startTime || "start"}-${index}`,
      startTime: trip.startTime,
      endTime: trip.endTime,
      distanceKm: Math.max(0, Number(trip.distance || 0) / 1000),
      durationSec: toDurationSeconds(trip),
      avgSpeedKmh: toSpeedKmh(trip.averageSpeed),
      maxSpeedKmh: toSpeedKmh(trip.maxSpeed),
      startAddress: trip.startAddress || null,
      endAddress: trip.endAddress || null,
    }));

    res.json({
      deviceId: device.id,
      deviceName: device.name,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      trips: normalized,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const getTripPlayback = async (req, res) => {
  try {
    const { deviceId, from, to } = req.query;

    if (!deviceId || !from || !to) {
      return res.status(400).json({ error: "deviceId, from and to are required" });
    }

    const fromDate = toDateOrNull(from);
    const toDate = toDateOrNull(to);

    if (!fromDate || !toDate || fromDate >= toDate) {
      return res.status(400).json({ error: "Invalid date range" });
    }

    const device = await resolveAccessibleDevice(req, deviceId);
    if (!device) {
      return res.status(403).json({ error: "Device access denied" });
    }

    const route = await getTraccarRoute(
      device.traccar_device_id,
      fromDate.toISOString(),
      toDate.toISOString()
    );

    let points = (route || [])
      .filter((point) => point.latitude != null && point.longitude != null)
      .map((point) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        time:
          point.fixTime ||
          point.deviceTime ||
          point.serverTime ||
          null,
        speedKmh: toSpeedKmh(point.speed),
        ignitionOn: !!point?.attributes?.ignition,
      }));

    // Keep playback smooth for very long routes.
    if (points.length > 1500) {
      const step = Math.ceil(points.length / 1500);
      points = points.filter((_point, index) => index % step === 0);
    }

    res.json({
      deviceId: device.id,
      deviceName: device.name,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      points,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
