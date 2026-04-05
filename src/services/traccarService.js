import axios from "axios";

const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;

// create axios instance
const api = axios.create({
  baseURL: TRACCAR_URL,
  withCredentials: true
});

let cookie = null;

// login function
const login = async () => {
  const res = await api.post(
    "/api/session",
    `email=${EMAIL}&password=${PASSWORD}`,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  cookie = res.headers["set-cookie"];
};

// get positions
export const getTraccarPositions = async () => {
  try {
    if (!cookie) {
      await login();
    }

    const res = await api.get("/api/positions", {
      headers: {
        Cookie: cookie
      }
    });

    return res.data;
  } catch (err) {
    console.error("TRACCAR ERROR:", err.response?.data || err.message);

    // retry login once if session expired
    await login();

    const res = await api.get("/api/positions", {
      headers: {
        Cookie: cookie
      }
    });

    return res.data;
  }
};

// get devices
export const getTraccarDevices = async () => {
  if (!cookie) {
    await login();
  }

  const res = await api.get("/api/devices", {
    headers: {
      Cookie: cookie
    }
  });

  return res.data;
};