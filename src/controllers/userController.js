import { supabase } from "../config/supabase.js";

export const getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email");

    if (error) throw error;

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};