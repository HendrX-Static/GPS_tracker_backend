import axios from "axios";

const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;

// create axios instance with basic auth
const api = axios.create({
  baseURL: TRACCAR_URL,
  auth: {
    username: EMAIL,
    password: PASSWORD
  }
});

// get devices
export const getTraccarDevices = async () => {
   try {
    console.log("TRACCAR URL:", TRACCAR_URL);

    const res = await api.get("/api/devices");

    return res.data;
  } catch (err) {
    console.error("TRACCAR ERROR FULL:", err.message);
    console.error("TRACCAR ERROR RESPONSE:", err.response?.data);
    throw err;
  }
};

// get positions
export const getTraccarPositions = async () => {
  const res = await api.get("/api/positions");
  return res.data;
};