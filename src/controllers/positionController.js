export const getPositions = async (req, res) => {
  const mockData = [
    {
      deviceId: 1,
      latitude: 28.6139,
      longitude: 77.2090,
      speed: 45,
      fixTime: new Date()
    },
    {
      deviceId: 2,
      latitude: 28.7041,
      longitude: 77.1025,
      speed: 30,
      fixTime: new Date()
    }
  ];

  res.json(mockData);
};