import axios from "axios";

const TRACCAR_URL = process.env.TRACCAR_URL;
const EMAIL = process.env.TRACCAR_EMAIL;
const PASSWORD = process.env.TRACCAR_PASSWORD;

export const getTraccarDevices = async () => {
  const res = await axios.get(`${TRACCAR_URL}/api/devices`, {
    auth: {
      username: EMAIL,
      password: PASSWORD
    }
  });

  return res.data;
};

export const getTraccarPositions = async () => {
  const res = await axios.get(`${TRACCAR_URL}/api/positions`, {
    auth: {
      username: EMAIL,
      password: PASSWORD
    }
  });

  return res.data;
};