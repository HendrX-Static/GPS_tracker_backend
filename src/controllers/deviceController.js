import { supabase } from "../config/supabase.js";

export const getDevices = async (req, res) => {
  const userId = req.user.sub;

  const { data, error } = await supabase
    .from("user_devices")
    .select("devices(*)")
    .eq("user_id", userId);

  if (error) return res.status(500).json(error);

  res.json(data.map(d => d.devices));
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