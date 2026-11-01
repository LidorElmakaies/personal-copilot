export const pad2 = (n) => String(n).padStart(2, '0');

// In the device's own time zone: "18:12".
export const formatTime = (date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
