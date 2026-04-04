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